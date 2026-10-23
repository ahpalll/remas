/**
 * REMAS Update Cycle Tests — Phase 3
 *
 * Local, offline coverage of the ENTIRE update decision cycle:
 *   [1] Discovery: newer available / none / wrong platform+channel+status /
 *       network failure / untrusted source / newest-of-many selection
 *   [2] Trust verification with the REAL release keypair (embedded public key
 *       round-trip) + attacker scenarios: wrong signature, public-key swap
 *       attack, missing hash, tampered hash, unsigned, untrusted URL, http
 *   [3] Download cycle over a REAL local HTTP server: success, progress,
 *       cache reuse (no re-download), tampered-cache recovery, HTTP error,
 *       interrupted transfer, retry-after-failure, untrusted source blocked
 *       before any request
 *   [4] Safe-close launcher: exact production template + real behavioral test
 *       (script waits for process exit, then launches installer)
 *   [5] Static data-safety guards (installer must never wipe user data)
 *
 * Run: node tests/update_cycle.test.js
 */

const {
  REMAS_UPDATE_PUBLIC_KEY,
  TRUSTED_DOWNLOAD_HOSTS,
  compareVersions,
  buildSigningPayload,
  verifyUpdate,
  downloadFile,
  checkForUpdates,
  downloadUpdate,
  isTrustedDownloadUrl
} = require('../src/update_service');
const { buildUpdateLauncherScript } = require('../src/update_launcher');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

let passed = 0;
let failed = 0;
const skipped = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}
function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}
function skip(message) {
  skipped.push(message);
  console.log(`  ~ SKIP: ${message}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Real release keypair (private key stays local, git-ignored) ───
const PRIVATE_KEY_PATH = path.join(__dirname, '..', '.release-keys', 'release_private.pem');
const realPrivateKey = fs.existsSync(PRIVATE_KEY_PATH) ? fs.readFileSync(PRIVATE_KEY_PATH, 'utf8') : null;

function signWith(privateKeyPem, release) {
  return crypto.sign('RSA-SHA256', Buffer.from(buildSigningPayload(release)), privateKeyPem).toString('base64');
}

/** Duck-typed Firestore mock that actually applies .where() equality filters. */
function makeDb(docs, opts = {}) {
  return {
    collection: () => {
      const filters = [];
      let limitN = 25;
      const chain = {
        where(field, _op, value) {
          filters.push({ field, value });
          return chain;
        },
        limit(n) {
          limitN = n;
          return chain;
        },
        async get() {
          if (opts.failWith) throw opts.failWith;
          let out = docs.filter((d) => filters.every((f) => d[f.field] === f.value));
          out = out.slice(0, limitN);
          return {
            empty: out.length === 0,
            docs: out.map((d, i) => ({ id: d.id || `rel_${i}`, data: () => ({ ...d }) }))
          };
        }
      };
      return chain;
    }
  };
}

const CURRENT = '1.0.0-release.52.1.0';
const TRUSTED_HOSTS = ['updates.remas-host.example'];
const trustedUrl = 'https://updates.remas-host.example/setup.exe';

function baseRelease(overrides = {}) {
  return {
    id: 'rel_base',
    version: '1.0.0-release.53.0.0',
    sha256Hash: 'a'.repeat(64),
    downloadUrl: trustedUrl,
    platform: 'windows-x64',
    channel: 'stable',
    status: 'APPROVED',
    published: true,
    minVersion: '1.0.0-release.50.0.0',
    size: 1000,
    signature: 'placeholder-signature-for-discovery-only',
    releaseNotes: 'ملاحظات الإصدار',
    ...overrides
  };
}

async function main() {
  // ═══════════════════════════════════════════════════════════════
  console.log('\n[1] Update Discovery');
  // ═══════════════════════════════════════════════════════════════
  {
    const r = await checkForUpdates(makeDb([]), CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS });
    assert(r.available === false, 'Empty release list → no update');
    assert(r.reason.includes('لا توجد تحديثات متاحة'), 'Empty list reason is clear (Arabic)');

    const newer = await checkForUpdates(makeDb([baseRelease()]), CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS });
    assert(newer.available === true, 'Newer version → update available');
    assertEqual(newer.version, '1.0.0-release.53.0.0', 'Correct newer version selected');
    assertEqual(newer.hash, 'a'.repeat(64), 'Hash exposed to verifier');
    assertEqual(newer.releaseId, 'rel_base', 'Release id exposed for audit');
    assertEqual(newer.mandatory, false, 'minVersion below current → optional update');

    const same = await checkForUpdates(
      makeDb([baseRelease({ version: CURRENT })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(same.available === false, 'Same version → no update (no false upgrade)');

    const older = await checkForUpdates(
      makeDb([baseRelease({ version: '1.0.0-release.51.0.0' })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(older.available === false, 'Older version → no update');

    const wrongPlatform = await checkForUpdates(
      makeDb([baseRelease({ platform: 'android-arm' })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(wrongPlatform.available === false, 'Android release is never offered to Windows client');

    const wrongChannel = await checkForUpdates(
      makeDb([baseRelease({ channel: 'beta' })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(wrongChannel.available === false, 'Other channel (beta) not offered on stable');

    const notApproved = await checkForUpdates(
      makeDb([baseRelease({ status: 'PENDING' })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(notApproved.available === false, 'Non-APPROVED release never offered');

    const unpublished = await checkForUpdates(
      makeDb([baseRelease({ published: false })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(unpublished.available === false, 'Unpublished release never offered');

    const netFail = await checkForUpdates(
      makeDb([baseRelease()], { failWith: new Error('ECONNREFUSED') }),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(netFail.available === false, 'Network failure → NO update (failure ≠ update)');
    assert((netFail.reason || '').includes('تعذر التحقق'), 'Network failure reason is clear');

    const evilOnly = await checkForUpdates(
      makeDb([baseRelease({ downloadUrl: 'https://evil.example/setup.exe' })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assert(evilOnly.available === false, 'Untrusted source alone → hidden (not offered)');
    assert((evilOnly.reason || '').includes('غير موثوق'), 'Untrusted source reason is explicit');

    const evilAndTrusted = await checkForUpdates(
      makeDb([
        baseRelease({ id: 'rel_evil', version: '1.0.0-release.99.0.0', downloadUrl: 'https://evil.example/setup.exe' }),
        baseRelease({ id: 'rel_good', version: '1.0.0-release.54.0.0' })
      ]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assertEqual(evilAndTrusted.releaseId, 'rel_good', 'Trust gate picks trusted release even when a higher untrusted one exists');

    const many = await checkForUpdates(
      makeDb([
        baseRelease({ id: 'rel_low', version: '1.0.0-release.53.0.0' }),
        baseRelease({ id: 'rel_high', version: '1.0.0-release.54.0.0' }),
        baseRelease({ id: 'rel_mid', version: '1.0.0-release.53.5.0' })
      ]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assertEqual(many.releaseId, 'rel_high', 'Highest semver wins (not lexicographic, not first)');
    assertEqual(many.version, '1.0.0-release.54.0.0', 'Highest semver value selected');

    const belowMin = await checkForUpdates(
      makeDb([baseRelease({ minVersion: '1.0.0-release.55.0.0' })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assertEqual(belowMin.available, true, 'Update still offered when client below minVersion');
    assertEqual(belowMin.mandatory, true, 'Client below minVersion → MANDATORY update');

    const forced = await checkForUpdates(
      makeDb([baseRelease({ mandatory: true })]),
      CURRENT, 'stable', { trustedHosts: TRUSTED_HOSTS }
    );
    assertEqual(forced.mandatory, true, 'Release marked mandatory → mandatory');

    const defaultHosts = isTrustedDownloadUrl(trustedUrl); // uses TRUSTED_DOWNLOAD_HOSTS (empty)
    assertEqual(defaultHosts, false, 'Default TRUSTED_DOWNLOAD_HOSTS is empty → nothing trusted yet (fail-closed activation)');
    assertEqual(Array.isArray(TRUSTED_DOWNLOAD_HOSTS) && TRUSTED_DOWNLOAD_HOSTS.length, 0, 'No host is silently trusted out of the box');
  }

  // ═══════════════════════════════════════════════════════════════
  console.log('\n[2] Trust Verification (REAL embedded public key)');
  // ═══════════════════════════════════════════════════════════════
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remas-cycle-'));
  const payloadBytes = Buffer.from('REMAS UPDATE INSTALLER PAYLOAD — ' + 'x'.repeat(4096));
  const payloadHash = crypto.createHash('sha256').update(payloadBytes).digest('hex');
  const goodFile = path.join(tmpDir, 'good.exe');
  fs.writeFileSync(goodFile, payloadBytes);

  const attackerKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  if (!realPrivateKey) {
    skip('REAL signing key (.release-keys/release_private.pem) missing — run: node scripts/sign_release.js generate-keypair');
  } else {
    const goodRelease = {
      version: '1.0.0-release.54.0.0',
      sha256Hash: payloadHash,
      downloadUrl: trustedUrl,
      platform: 'windows-x64',
      channel: 'stable',
      minVersion: '1.0.0-release.50.0.0',
      size: payloadBytes.length
    };
    goodRelease.signature = signWith(realPrivateKey, goodRelease);

    // 2.1 — Production path: embedded public key verifies the real signature
    const ok = verifyUpdate(goodFile, goodRelease, { trustedHosts: TRUSTED_HOSTS });
    assert(ok.valid === true, 'REAL signed release verifies against EMBEDDED public key (keypair round-trip)');

    // 2.2 — Signature from a different key → rejected
    const wrongKeyRelease = { ...goodRelease, signature: signWith(attackerKeys.privateKey, goodRelease) };
    const wrongKey = verifyUpdate(goodFile, wrongKeyRelease, { trustedHosts: TRUSTED_HOSTS });
    assert(wrongKey.valid === false, 'Signature from foreign key → REJECTED');
    assert((wrongKey.error || '').includes('توقيع'), 'Wrong-signature error is explicit');

    // 2.3 — Public-key swap attack: attacker writes their own publicKey into the doc
    const swap = { ...goodRelease, publicKey: attackerKeys.publicKey };
    swap.signature = signWith(attackerKeys.privateKey, swap);
    const swapResult = verifyUpdate(goodFile, swap, { trustedHosts: TRUSTED_HOSTS });
    assert(swapResult.valid === false, 'publicKey-swap attack (self-signed doc) → REJECTED');
    assert((swapResult.error || '').includes('لا يطابق مفتاح التطبيق'), 'Key-swap rejection is explicit');

    // 2.4 — Missing hash → never skip integrity
    const noHash = { ...goodRelease, sha256Hash: '', hash: '' };
    noHash.signature = signWith(realPrivateKey, noHash);
    const noHashResult = verifyUpdate(goodFile, noHash, { trustedHosts: TRUSTED_HOSTS });
    assert(noHashResult.valid === false, 'Missing SHA-256 in release doc → REJECTED (no skip)');
    assert((noHashResult.error || '').includes('SHA-256'), 'Missing-hash error is explicit');

    // 2.5 — Tampered hash value
    const badHash = { ...goodRelease, sha256Hash: 'b'.repeat(64), hash: 'b'.repeat(64) };
    badHash.signature = signWith(realPrivateKey, badHash);
    const badHashResult = verifyUpdate(goodFile, badHash, { trustedHosts: TRUSTED_HOSTS });
    assert(badHashResult.valid === false, 'Hash not matching file → REJECTED');
    assert((badHashResult.error || '').includes('غير متطابقة'), 'Hash-mismatch error is explicit');

    // 2.6 — Unsigned release
    const unsigned = { ...goodRelease, signature: '' };
    const unsignedResult = verifyUpdate(goodFile, unsigned, { trustedHosts: TRUSTED_HOSTS });
    assert(unsignedResult.valid === false, 'Unsigned release → REJECTED');
    assert((unsignedResult.error || '').includes('توقيع'), 'Unsigned error is explicit');

    // 2.7 — Correct signature but untrusted host
    const evilUrlRelease = { ...goodRelease, downloadUrl: 'https://evil.example/setup.exe' };
    evilUrlRelease.signature = signWith(realPrivateKey, evilUrlRelease);
    const evilUrlResult = verifyUpdate(goodFile, evilUrlRelease, { trustedHosts: TRUSTED_HOSTS });
    assert(evilUrlResult.valid === false, 'Valid signature but UNTRUSTED host → REJECTED');
    assert((evilUrlResult.error || '').includes('غير موثوق'), 'Untrusted-source error is explicit');

    // 2.8 — http on a listed non-loopback host → rejected (https required)
    const plain = { ...goodRelease, downloadUrl: 'http://updates.remas-host.example/setup.exe' };
    plain.signature = signWith(realPrivateKey, plain);
    const plainResult = verifyUpdate(goodFile, plain, { trustedHosts: TRUSTED_HOSTS });
    assertEqual(plainResult.valid, false, 'Plain http to non-loopback host → REJECTED even if host is listed');

    // 2.9 — Dangerous schemes
    for (const url of ['file:///C:/Windows/System32/calc.exe', 'ftp://x/y.exe', 'javascript:alert(1)']) {
      const rel = { ...goodRelease, downloadUrl: url };
      rel.signature = signWith(realPrivateKey, rel);
      assert(verifyUpdate(goodFile, rel, { trustedHosts: TRUSTED_HOSTS }).valid === false, `Scheme ${url.split(':')[0]}: → REJECTED`);
    }

    // 2.10 — Tampered file (integrity after download)
    const tamperedFile = path.join(tmpDir, 'tampered.exe');
    fs.writeFileSync(tamperedFile, Buffer.concat([payloadBytes, Buffer.from('EVIL')]));
    const tampered = verifyUpdate(tamperedFile, goodRelease, { trustedHosts: TRUSTED_HOSTS });
    assert(tampered.valid === false, 'File modified after signing → REJECTED (hash)');

    // 2.11 — Loopback http is allowed ONLY when explicitly listed (E2E path)
    assert(isTrustedDownloadUrl('http://127.0.0.1:8099/a.exe', ['127.0.0.1']) === true, 'Loopback http allowed when explicitly trusted (local E2E)');
    assert(isTrustedDownloadUrl('http://127.0.0.1:8099/a.exe', ['other.host']) === false, 'Loopback not implicitly trusted without listing');
  }

  // ═══════════════════════════════════════════════════════════════
  console.log('\n[3] Download Cycle (real local HTTP server)');
  // ═══════════════════════════════════════════════════════════════
  if (!realPrivateKey) {
    skip('Download-cycle tests need the real signing key');
  } else {
    const body = crypto.randomBytes(256 * 1024);
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
    const hits = { good: 0, flaky: 0, err: 0 };

    const server = http.createServer((req, res) => {
      if (req.url === '/good/setup.exe') {
        hits.good++;
        res.writeHead(200, { 'Content-Length': body.length });
        res.end(body);
      } else if (req.url === '/flaky/setup.exe') {
        hits.flaky++;
        if (hits.flaky === 1) {
          // Promise more bytes than delivered, then kill the socket mid-stream
          res.writeHead(200, { 'Content-Length': body.length + 5000 });
          res.write(body.slice(0, Math.floor(body.length / 2)));
          setTimeout(() => res.destroy(), 30);
        } else {
          res.writeHead(200, { 'Content-Length': body.length });
          res.end(body);
        }
      } else if (req.url === '/err/setup.exe') {
        hits.err++;
        res.writeHead(500);
        res.end('boom');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const origin = `http://127.0.0.1:${port}`;
    const dlOpts = { trustedHosts: ['127.0.0.1'] };
    const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remas-dl-'));

    const mkRelease = (version, urlPath) => {
      const rel = {
        version,
        sha256Hash: bodyHash,
        downloadUrl: `${origin}${urlPath}`,
        platform: 'windows-x64',
        channel: 'stable',
        minVersion: '1.0.0-release.50.0.0',
        size: body.length
      };
      rel.signature = signWith(realPrivateKey, rel);
      return rel;
    };

    try {
      // 3.1 — Successful download with progress
      const progressLog = [];
      const relGood = mkRelease('9.0.1', '/good/setup.exe');
      const first = await downloadUpdate(relGood, dlDir, (p) => progressLog.push(p), dlOpts);
      assert(first.cached === false, 'First download is fresh (not cached)');
      assertEqual(first.hash, bodyHash, 'Downloaded file hash matches release hash');
      assert(progressLog.length > 0 && progressLog[progressLog.length - 1].percent > 0, 'Progress callback fired with percent (UI bar source)');
      assertEqual(hits.good, 1, 'Server served the file exactly once');

      // 3.2 — Cache reuse: NO redundant re-download, but re-verified
      const second = await downloadUpdate(relGood, dlDir, () => {}, dlOpts);
      assertEqual(second.cached, true, 'Second call reuses verified cache');
      assertEqual(hits.good, 1, 'No redundant re-download (server not hit again)');
      assertEqual(second.hash, bodyHash, 'Cached file re-verified against hash + signature');

      // 3.3 — Tampered cache is discarded and re-downloaded
      fs.appendFileSync(first.path, Buffer.from('TAMPER'));
      const third = await downloadUpdate(relGood, dlDir, () => {}, dlOpts);
      assertEqual(third.cached, false, 'Tampered cache detected → re-downloaded');
      assertEqual(hits.good, 2, 'Tampered cache actually re-fetched');
      assertEqual(third.hash, bodyHash, 'Re-downloaded file verified again');

      // 3.4 — HTTP 500 → clear failure, no leftover file
      const relErr = mkRelease('9.0.2', '/err/setup.exe');
      let errFailed = false;
      let errMessage = '';
      try {
        await downloadUpdate(relErr, dlDir, () => {}, dlOpts);
      } catch (e) {
        errFailed = true;
        errMessage = e.message || '';
      }
      assert(errFailed === true, 'HTTP 500 → download FAILS (never fake success)');
      assert(errMessage.includes('HTTP 500'), 'HTTP error surfaced clearly');
      assert(fs.existsSync(path.join(dlDir, 'remas-update-9.0.2.exe')) === false, 'No partial file left after HTTP error');

      // 3.5 — Interrupted transfer → failure + no leftovers
      const relFlaky = mkRelease('9.0.3', '/flaky/setup.exe');
      let cutFailed = false;
      let cutMessage = '';
      try {
        await downloadUpdate(relFlaky, dlDir, () => {}, dlOpts);
      } catch (e) {
        cutFailed = true;
        cutMessage = e.message || '';
      }
      assert(cutFailed === true, 'Interrupted download → FAILS (truncated file never accepted)');
      assert(fs.existsSync(path.join(dlDir, 'remas-update-9.0.3.exe')) === false, 'No partial file left after interruption');
      assert((cutMessage || '').length > 0, 'Interruption produces a clear error message');

      // 3.6 — Retry after failure succeeds
      const retry = await downloadUpdate(relFlaky, dlDir, () => {}, dlOpts);
      assertEqual(retry.cached, false, 'Retry after interruption SUCCEEDS');
      assertEqual(retry.hash, bodyHash, 'Retried download verified');
      assertEqual(hits.flaky, 2, 'Retry hit the server again (2 attempts total)');

      // 3.7 — Untrusted URL blocked BEFORE any network request
      const relEvil = mkRelease('9.0.4', '/good/setup.exe');
      relEvil.downloadUrl = 'https://evil.example/setup.exe';
      relEvil.signature = signWith(realPrivateKey, relEvil);
      const hitsBefore = hits.good + hits.flaky + hits.err;
      let evilFailed = false;
      let evilMessage = '';
      try {
        await downloadUpdate(relEvil, dlDir, () => {}, dlOpts);
      } catch (e) {
        evilFailed = true;
        evilMessage = e.message || '';
      }
      assert(evilFailed === true, 'Untrusted downloadUrl → download refused');
      assert((evilMessage || '').includes('غير موثوق'), 'Refusal reason is explicit');
      const hitsAfter = hits.good + hits.flaky + hits.err;
      assertEqual(hitsAfter, hitsBefore, 'NOT A SINGLE byte requested from anywhere for untrusted URL');

      // 3.8 — Connection refused (port closed) → clean failure
      const relDead = {
        version: '9.0.5',
        sha256Hash: bodyHash,
        downloadUrl: 'http://127.0.0.1:1/setup.exe', // port 1 never open
        platform: 'windows-x64', channel: 'stable', minVersion: '0.0.0', size: body.length
      };
      relDead.signature = signWith(realPrivateKey, relDead);
      let deadFailed = false;
      try {
        await downloadUpdate(relDead, dlDir, () => {}, dlOpts);
      } catch (_) {
        deadFailed = true;
      }
      assert(deadFailed === true, 'Connection refused → clean failure (no crash, no fake success)');
      assert(fs.existsSync(path.join(dlDir, 'remas-update-9.0.5.exe')) === false, 'No file left after connection failure');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(dlDir, { recursive: true, force: true });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  console.log('\n[4] Safe-Close Launcher (production template + real behavior)');
  // ═══════════════════════════════════════════════════════════════
  {
    const installerPath = path.join(os.tmpdir(), 'my setup.exe');
    const script = buildUpdateLauncherScript(4242, installerPath, '/S');
    assert(script.startsWith('@echo off\r\n'), 'Template starts with @echo off (CRLF)');
    assert(script.includes(':waitloop'), 'Template has wait loop label');
    assert(script.includes('tasklist /FI "PID eq 4242"'), 'Template waits for the exact app PID');
    assert(script.includes('if NOT ERRORLEVEL 1 (timeout /T 1 /NOBREAK >NUL & goto waitloop)'), 'Template loops until PID exits');
    assert(script.includes('start "" "C:\\Users\\'), 'Template quotes installer path');
    assert(script.includes('/S'), 'Template runs NSIS silently');
    const startIdx = script.indexOf('start ""');
    const waitIdx = script.indexOf(':waitloop');
    assert(startIdx > waitIdx, 'Installer launch happens AFTER the wait loop (safe-close timing)');

    let threw = false;
    try { buildUpdateLauncherScript(0, 'x.exe'); } catch (_) { threw = true; }
    assert(threw, 'Invalid PID rejected');
    threw = false;
    try { buildUpdateLauncherScript(1, ''); } catch (_) { threw = true; }
    assert(threw, 'Empty installer path rejected');

    // Behavioral: real script + real processes
    const behDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remas-launch-'));
    const markerPath = path.join(behDir, 'marker.cmd');
    fs.writeFileSync(markerPath, '@echo off\r\necho ARGS=%* > "%~dp0ran.txt"\r\n', 'utf8');
    const ranFile = path.join(behDir, 'ran.txt');

    const dummy = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
    const behScript = buildUpdateLauncherScript(dummy.pid, markerPath, '/S /D=' + path.join(behDir, 'isolated dir'));
    const behScriptPath = path.join(behDir, 'run.cmd');
    fs.writeFileSync(behScriptPath, behScript, 'utf8');

    const launcher = spawn('cmd.exe', ['/c', behScriptPath], { detached: true, stdio: 'ignore', windowsHide: true });
    launcher.unref();

    await sleep(3000);
    assert(fs.existsSync(ranFile) === false, 'Installer NOT launched while app process still alive (waits)');

    dummy.kill();
    let launched = false;
    for (let i = 0; i < 30 && !launched; i++) {
      await sleep(1000);
      launched = fs.existsSync(ranFile);
    }
    assert(launched, 'Installer launched AFTER the app process exited (safe close honored)');
    if (launched) {
      const out = fs.readFileSync(ranFile, 'utf8');
      assert(out.includes('/S'), 'Launched installer received silent flag');
      assert(out.includes('/D='), 'Launched installer received install args intact');
      assert(out.includes('isolated dir'), 'Path with spaces preserved through cmd quoting');
    }
    fs.rmSync(behDir, { recursive: true, force: true });
  }

  // ═══════════════════════════════════════════════════════════════
  console.log('\n[5] Static Data-Safety Guards');
  // ═══════════════════════════════════════════════════════════════
  {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const b = pkg.build || {};
    assert(b.nsis && b.nsis.deleteAppDataOnUninstall !== true, 'Installer never wipes app data on uninstall');
    assert(b.nsis && b.nsis.perMachine === false, 'Per-user install (no admin, no system dirs)');
    assert(b.win && b.win.target === 'nsis', 'Windows target is NSIS (supports silent /S upgrade)');

    const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    assert(mainSrc.includes("buildUpdateLauncherScript"), 'main.js uses the shared (tested) launcher builder');
    assert(mainSrc.includes("app.getPath('userData')"), 'Launcher/update cache live in userData (outside install dir)');
    assert(mainSrc.includes('app.quit()'), 'App quits before installation (safe timing)');

    const main = require('../src/update_service');
    assertEqual(typeof main.REMAS_UPDATE_PUBLIC_KEY, 'string', 'Public key is embedded (verify-only, shippable)');
    assert(!main.REMAS_UPDATE_PUBLIC_KEY.includes('PRIVATE'), 'Embedded key is a PUBLIC key only');
    const signerSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'sign_release.js'), 'utf8');
    assert(signerSrc.includes('.release-keys'), 'Private key path is the git-ignored .release-keys dir');
    assert(signerSrc.includes('PRIVATE KEY NEVER leaves'), 'Signer documents key custody rule');
    // No private key material anywhere in shippable sources
    const shippable = ['main.js', 'src/update_service.js', 'src/desktop_app.js', 'src/preload.js', 'src/update_launcher.js', 'package.json'];
    let leaked = null;
    for (const f of shippable) {
      const txt = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      if (txt.includes('BEGIN PRIVATE KEY') || txt.includes('release_private')) leaked = f;
    }
    assert(leaked === null, `No private key material in shippable app files${leaked ? ` (LEAK in ${leaked})` : ''}`);
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n${'='.repeat(55)}`);
  console.log(`Results: ${passed} passed, ${failed} failed${skipped.length ? `, ${skipped.length} skipped` : ''}`);
  console.log(`${'='.repeat(55)}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
