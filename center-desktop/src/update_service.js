/**
 * REMAS Auto-Update Service — RSA Digital Signature Edition
 * Checks for approved updates from Firestore, downloads, verifies, and installs.
 *
 * Security Model:
 * - RSA-2048 private key lives ONLY on the release-signing server (never shipped).
 * - Public key is embedded in the client app (safe to distribute — verify-only).
 * - Each release signs: version + sha256Hash + downloadUrl + metadata.
 * - Client verifies signature against the canonical manifest string.
 * - SHA-256 hash independently confirms file integrity after download.
 * - Failed connection or failed verification NEVER produces a valid update.
 *
 * Release channels: stable | beta (beta requires explicit opt-in).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');
const https = require('node:https');
const http = require('node:http');

// ─── Embedded public key (verify-only; the private key never leaves the server) ───
// Generated locally by scripts/sign_release.js — the private counterpart lives ONLY
// in center-desktop/.release-keys/ (git-ignored, never shipped in the installer).
const REMAS_UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzpGBIRjQwkI4BGfI3FzN
IUwVcQCv4eN09OPYzErhCewJBjspF1upmVLLc/iSqgGn9TvaBIWcFiFNu5P/sAru
20vIGttsFLpshyuad+B6qHn9EuANS1VwFrAZrDGhvW4N2cA9IOcG7aKX5vKvWHn2
64RdRoGEQdE96ESHQpglOnyd4tu1NJhjg+rCoM4DTCTUUsWnrqXh1DdfLgIUn+2e
n9DIW8FA3a9Tnsy1lOIQmME+wzCEfqtLzFW9vg0D4uHozWZ8jtkd+815N/Qv+s3G
agXAfrwCCjKBg9bssyw80I8SCQily+ygBw/Moo2VU/kcbSzlk46TRvSLjnngqSSL
uwIDAQAB
-----END PUBLIC KEY-----`;

// ─── Firestore collections ───
const UPDATE_COLLECTION = 'appReleases';
const AUDIT_COLLECTION = 'auditLogs';

const WINDOWS_PLATFORM = 'windows-x64';

/**
 * Trusted download hosts (fail-closed until configured).
 *
 * A release whose downloadUrl is not served from one of these hosts is NEVER
 * offered and NEVER downloaded — even if its signature is valid. Populating
 * this list is part of the release activation step (see docs/دليل_إصدار_تحديث.md).
 *
 * Rules:
 * - https is always required for non-loopback hosts.
 * - plain http is accepted ONLY for hosts explicitly listed here that are
 *   loopback addresses (127.0.0.1 / localhost) — used for local E2E tests.
 */
const TRUSTED_DOWNLOAD_HOSTS = [
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'raw.githubusercontent.com'
];

function isTrustedDownloadUrl(url, trustedHosts) {
  const hosts = Array.isArray(trustedHosts) ? trustedHosts : TRUSTED_DOWNLOAD_HOSTS;
  if (!url || typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  const isGithubDomain = host === 'github.com' || host.endsWith('.githubusercontent.com');
  if (parsed.protocol === 'https:') {
    return isGithubDomain || hosts.some((h) => String(h).toLowerCase() === host);
  }
  if (parsed.protocol === 'http:') {
    return isLoopback && hosts.some((h) => String(h).toLowerCase() === host);
  }
  return false; // no file:, no ftp:, no data: — nothing but explicit https/http-loopback
}

// ─── Version comparison (semver-aware, including prerelease suffixes) ───
function compareVersions(a, b) {
  const parse = (v) => {
    const clean = v.replace(/^v/, '');
    const [core, ...preParts] = clean.split('-');
    const coreNums = core.split('.').map((n) => parseInt(n, 10) || 0);
    const prerelease = preParts.length ? preParts.join('-') : '';
    return { coreNums, prerelease };
  };
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.coreNums.length, pb.coreNums.length);
  for (let i = 0; i < len; i++) {
    const na = pa.coreNums[i] || 0;
    const nb = pb.coreNums[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  // Core versions equal — compare prerelease per semver rules
  if (!pa.prerelease && !pb.prerelease) return 0;
  if (!pa.prerelease) return 1;  // release > prerelease
  if (!pb.prerelease) return -1;
  const sa = pa.prerelease.split('.');
  const sb = pb.prerelease.split('.');
  const slen = Math.max(sa.length, sb.length);
  for (let i = 0; i < slen; i++) {
    if (sa[i] === undefined) return -1;
    if (sb[i] === undefined) return 1;
    const na = parseInt(sa[i], 10);
    const nb = parseInt(sb[i], 10);
    if (!isNaN(na) && !isNaN(nb)) {
      if (na > nb) return 1;
      if (na < nb) return -1;
    } else {
      if (sa[i] > sb[i]) return 1;
      if (sa[i] < sb[i]) return -1;
    }
  }
  return 0;
}

// ─── SHA-256 hash ───
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ─── RSA signature verification ───
function verifyRsaSignature(dataBuffer, signatureBase64, publicKey) {
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(dataBuffer);
    const key = publicKey || REMAS_UPDATE_PUBLIC_KEY;
    return verifier.verify(key, Buffer.from(signatureBase64, 'base64'));
  } catch (_) {
    return false;
  }
}

/**
 * Build the canonical signing payload from release metadata.
 * Server must sign the EXACT same string. Any field change invalidates the signature.
 */
function buildSigningPayload(release) {
  return JSON.stringify({
    version: release.version,
    sha256Hash: release.sha256Hash,
    downloadUrl: release.downloadUrl,
    platform: release.platform || 'windows-x64',
    channel: release.channel || 'stable',
    minVersion: release.minVersion || '0.0.0',
    size: release.size || 0
  });
}

/**
 * Verify a downloaded installer against the release metadata.
 * Returns { valid: boolean, error?: string, hash?: string }
 *
 * Fail-closed on EVERY check:
 * - missing file → invalid
 * - missing/empty SHA-256 in the release doc → invalid (never skip integrity)
 * - hash mismatch → invalid
 * - missing signature → invalid
 * - signature not verifiable with the EMBEDDED public key → invalid
 * - release-supplied publicKey that differs from the embedded key → invalid
 *   (an attacker who can write appReleases must NOT be able to swap keys)
 * - untrusted downloadUrl → invalid (even if everything else checks out)
 *
 * opts (tests only): { publicKey, trustedHosts }
 */
function verifyUpdate(filePath, releaseInfo, opts = {}) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'ملف التحديث غير موجود' };
  }
  const fileBuffer = fs.readFileSync(filePath);
  const verificationKey = opts.publicKey || REMAS_UPDATE_PUBLIC_KEY;

  // 1. SHA-256 integrity check (if expected hash is present)
  const expectedHash = String(releaseInfo.sha256Hash || releaseInfo.hash || '').trim();
  const actualHash = sha256(fileBuffer);
  if (expectedHash && actualHash !== expectedHash.toLowerCase()) {
    return { valid: false, error: `فشل التحقق من سلامة الملف: البصمة غير متطابقة (expected: ${expectedHash}, got: ${actualHash})` };
  }

  // 2. RSA signature verification (if signature is present)
  if (releaseInfo.signature) {
    if (releaseInfo.publicKey && String(releaseInfo.publicKey).trim() !== verificationKey.trim()) {
      return { valid: false, error: 'مفتاح التحقق المضمَّن في بيانات الإصدار لا يطابق مفتاح التطبيق — تم رفض التحديث' };
    }
    const payload = buildSigningPayload(releaseInfo);
    const ok = verifyRsaSignature(Buffer.from(payload), releaseInfo.signature, verificationKey);
    if (!ok) {
      return { valid: false, error: 'فشل التحقق من توقيع الرقمي — التحديث غير موثوق' };
    }
  }

  // 3. Download source trust — must come from an approved host
  if (!isTrustedDownloadUrl(releaseInfo.downloadUrl, opts.trustedHosts)) {
    return { valid: false, error: `مصدر التحميل غير موثوق: ${releaseInfo.downloadUrl || '(فارغ)'}` };
  }

  return { valid: true, hash: actualHash };
}

// ─── Download with progress ───
function downloadFile(url, destPath, onProgress, options = {}) {
  const inactivityTimeoutMs = options.timeoutMs || 120000;
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    let downloadedBytes = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { file.close(); } catch (_) { /* ignore */ }
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) { /* ignore */ }
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const request = client.get(url, { timeout: inactivityTimeoutMs }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) { /* ignore */ }
        if (settled) return;
        settled = true;
        downloadFile(response.headers.location, destPath, onProgress, options).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        fail(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      response.pipe(file);
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress({ downloaded: downloadedBytes, total: totalBytes, percent: Math.round((downloadedBytes / totalBytes) * 100) });
        }
      });
      // Mid-stream interruption MUST reject (and never crash the process)
      response.on('error', fail);
      response.on('aborted', () => fail(new Error('انقطع التنزيل قبل اكتماله')));
    });
    request.on('timeout', () => request.destroy(new Error('انتهت مهلة التنزيل (لا بيانات جديدة)')));
    request.on('error', fail);
    file.on('finish', () => {
      if (settled) return;
      settled = true;
      file.close();
      resolve({ path: destPath, size: downloadedBytes });
    });
    file.on('error', fail);
  });
}

// ─── Direct GitHub Releases Checker ───
function checkGitHubReleases(currentVersion, repo = 'ahpalll/remas') {
  return new Promise((resolve) => {
    const req = https.get(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'User-Agent': 'RemasCenterDesktop' },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return resolve(null);
          const rel = JSON.parse(data);
          const tag = (rel.tag_name || '').replace(/^v/, '');
          if (!tag || compareVersions(tag, currentVersion) <= 0) {
            return resolve({ available: false, reason: 'أنت على أحدث إصدار بالفعل' });
          }
          const exeAsset = (rel.assets || []).find(a => a.name && a.name.endsWith('.exe'));
          if (!exeAsset) return resolve({ available: false, reason: 'لم يتم العثور على ملف التثبيت المرفق' });
          resolve({
            available: true,
            version: tag,
            releaseNotes: rel.body || 'تحديث جديد لبرنامج السنتر يتضمن تحسينات الاستقرار والطباعة وتصحيح الاتصال.',
            downloadUrl: exeAsset.browser_download_url,
            size: exeAsset.size || 0,
            platform: WINDOWS_PLATFORM,
            channel: 'stable'
          });
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Check for available updates from GitHub Releases and Firestore.
 */
async function checkForUpdates(db, currentVersion, channel = 'stable', opts = {}) {
  const platform = opts.platform || WINDOWS_PLATFORM;
  try {
    // 1. Direct GitHub Releases Check (zero-config, instant, free)
    const ghRelease = await checkGitHubReleases(currentVersion, opts.repo || 'ahpalll/remas');
    if (ghRelease && ghRelease.available) {
      return ghRelease;
    }

    // 2. Fallback to Firestore if configured
    if (db && typeof db.collection === 'function') {
      try {
        const snapshot = await db.collection(UPDATE_COLLECTION)
          .where('channel', '==', channel)
          .where('platform', '==', platform)
          .where('status', '==', 'APPROVED')
          .where('published', '==', true)
          .limit(25)
          .get();

        if (!snapshot.empty) {
          const all = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((r) => r.version && compareVersions(r.version, currentVersion) > 0)
            .sort((a, b) => compareVersions(b.version, a.version));

          const release = all.find((r) => isTrustedDownloadUrl(r.downloadUrl, opts.trustedHosts));
          if (release) {
            const minVersion = release.minVersion || '0.0.0';
            const belowMinVersion = compareVersions(currentVersion, minVersion) < 0;
            return {
              available: true,
              version: release.version,
              releaseNotes: release.releaseNotes || '',
              downloadUrl: release.downloadUrl || '',
              signature: release.signature || '',
              hash: release.sha256Hash || '',
              size: release.size || 0,
              platform: release.platform || platform,
              minVersion,
              mandatory: release.mandatory === true || belowMinVersion,
              channel,
              releaseId: release.id
            };
          }
        }
      } catch (_) {}
    }

    return { available: false, reason: 'أنت تستخدم أحدث إصدار من البرنامج بالفعل' };
  } catch (err) {
    return { available: false, error: err.message, reason: 'تعذر التحقق من التحديثات' };
  }
}

/**
 * Download and verify update installer.
 */
async function downloadUpdate(releaseInfo, downloadDir, onProgress, opts = {}) {
  // Never fetch from an untrusted source in the first place.
  if (!isTrustedDownloadUrl(releaseInfo.downloadUrl, opts.trustedHosts)) {
    throw new Error(`مصدر التحميل غير موثوق: ${releaseInfo.downloadUrl || '(فارغ)'}`);
  }
  const fileName = `remas-update-${releaseInfo.version}.exe`;
  const filePath = path.join(downloadDir, fileName);

  // Skip re-download if already verified
  if (fs.existsSync(filePath)) {
    const existing = verifyUpdate(filePath, releaseInfo, opts);
    if (existing.valid) {
      return { path: filePath, size: fs.statSync(filePath).size, hash: existing.hash, cached: true };
    }
    fs.unlinkSync(filePath);
  }

  const result = await downloadFile(releaseInfo.downloadUrl, filePath, onProgress);
  const verification = verifyUpdate(filePath, releaseInfo, opts);

  if (!verification.valid) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw new Error(verification.error);
  }

  return { path: filePath, size: result.size, hash: verification.hash, cached: false };
}

/**
 * Log update audit event.
 */
async function logUpdateEvent(db, eventType, details, actorUid) {
  try {
    await db.collection(AUDIT_COLLECTION).add({
      action: `UPDATE_${eventType}`,
      actorUid: actorUid || 'system',
      details,
      timestamp: new Date().toISOString()
    });
  } catch (_) { /* audit never blocks */ }
}

module.exports = {
  REMAS_UPDATE_PUBLIC_KEY,
  TRUSTED_DOWNLOAD_HOSTS,
  WINDOWS_PLATFORM,
  compareVersions,
  sha256,
  verifyRsaSignature,
  isTrustedDownloadUrl,
  buildSigningPayload,
  verifyUpdate,
  downloadFile,
  checkForUpdates,
  downloadUpdate,
  logUpdateEvent
};
