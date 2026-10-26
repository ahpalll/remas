/**
 * REMAS Educational Center SaaS — OTA Hot-Patching Service
 * Allows delivering instant, lightweight code updates (< 1 MB)
 * directly to desktop clients without downloading the full 93 MB installer.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');
const https = require('node:https');
const http = require('node:http');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

class HotpatchService {
  constructor() {
    this.userDataDir = null;
    this.hotpatchDir = null;
    this.currentPatchDir = null;
    this.manifestPath = null;
    this.activeManifest = null;
    this.isInitialized = false;
  }

  /**
   * Initialize hotpatch directory structure
   */
  init(userDataPath) {
    this.userDataDir = userDataPath;
    this.hotpatchDir = path.join(this.userDataDir, 'hotpatches');
    this.currentPatchDir = path.join(this.hotpatchDir, 'current');
    this.manifestPath = path.join(this.currentPatchDir, 'manifest.json');

    try {
      if (!fs.existsSync(this.hotpatchDir)) {
        fs.mkdirSync(this.hotpatchDir, { recursive: true });
      }
      if (fs.existsSync(this.manifestPath)) {
        const raw = fs.readFileSync(this.manifestPath, 'utf8');
        this.activeManifest = JSON.parse(raw);
        console.log(`[Hotpatch] Active patch loaded: ${this.activeManifest.patchVersion || 'unknown'}`);
      }
    } catch (err) {
      console.warn('[Hotpatch] Failed to load manifest, rolling back:', err.message);
      this.rollback();
    }
    this.isInitialized = true;
  }

  getCurrentPatchVersion() {
    return this.activeManifest ? this.activeManifest.patchVersion : null;
  }

  getAppliedDate() {
    return this.activeManifest ? this.activeManifest.appliedAt : null;
  }

  hasHotpatch(relativePath) {
    if (!this.activeManifest) return false;
    const norm = relativePath.replace(/\\/g, '/');
    const target = path.join(this.currentPatchDir, norm);
    return fs.existsSync(target);
  }

  /**
   * Resolves the real file path: checks hotpatch cache first, falls back to bundled app path.
   */
  resolveEffectivePath(relativePath, bundledBaseDir) {
    if (this.activeManifest) {
      const norm = relativePath.replace(/\\/g, '/');
      const patchedPath = path.join(this.currentPatchDir, norm);
      if (fs.existsSync(patchedPath)) {
        return patchedPath;
      }
    }
    return path.join(bundledBaseDir, relativePath);
  }

  /**
   * Resolves file:// URLs for Electron webRequest redirection
   */
  resolveEffectiveFileUrl(fileUrl, bundledBaseDir) {
    if (!this.activeManifest || !fileUrl || typeof fileUrl !== 'string') return null;

    // Only redirect key editable assets
    const supportedAssets = ['desktop_app.js', 'center_desktop_services.js', 'new_badge_service.js'];
    const matchedAsset = supportedAssets.find(name => fileUrl.includes(`/src/${name}`) || fileUrl.endsWith(`/${name}`));
    if (!matchedAsset) return null;

    const relative = `src/${matchedAsset}`;
    const patchedFile = path.join(this.currentPatchDir, relative);
    if (fs.existsSync(patchedFile)) {
      try {
        const redirected = pathToFileURL(patchedFile).toString();
        if (redirected !== fileUrl) {
          return redirected;
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Load hotpatched Node.js module (e.g. center_desktop_services.js) safely
   */
  loadHotpatchedModule(relativePath, fallbackModule, bundledBaseDir) {
    const effective = this.resolveEffectivePath(relativePath, bundledBaseDir || __dirname);
    try {
      if (fs.existsSync(effective)) {
        delete require.cache[require.resolve(effective)];
        return require(effective);
      }
    } catch (err) {
      console.error(`[Hotpatch] Error requiring hotpatched module ${relativePath}:`, err.message);
    }
    return fallbackModule;
  }

  /**
   * Compare semver/patch numbers
   */
  isNewerPatch(remoteVersion, localVersion) {
    if (!remoteVersion) return false;
    if (!localVersion) return true;
    if (remoteVersion === localVersion) return false;

    // Strip prefixes
    const cleanR = remoteVersion.replace(/^[vV]/, '').replace(/^1\.0\.0-hp\./, '').replace(/^1\.0\.0-patch\./, '');
    const cleanL = localVersion.replace(/^[vV]/, '').replace(/^1\.0\.0-hp\./, '').replace(/^1\.0\.0-patch\./, '');

    const numR = cleanR.split('.').map(n => parseInt(n, 10) || 0);
    const numL = cleanL.split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(numR.length, numL.length);

    for (let i = 0; i < len; i++) {
      const a = numR[i] || 0;
      const b = numL[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return remoteVersion > localVersion;
  }

  /**
   * Check for hotpatch from Firestore or GitHub
   */
  async checkForHotpatch(db, currentAppVersion) {
    const currentPatch = this.getCurrentPatchVersion();

    // 1. Try Firestore licenses/system_hotpatch_latest (SuperAdmin Fleet Channel)
    if (db) {
      try {
        let data = null;
        if (typeof db.collection === 'function') {
          // Firebase compat SDK
          let snap = await db.collection('licenses').doc('system_hotpatch_latest').get();
          if (!snap.exists) snap = await db.collection('appHotpatches').doc('latest').get();
          if (snap.exists) data = snap.data();
        } else {
          // Firebase v9/v10 Modular SDK
          const { doc, getDoc } = require('firebase/firestore');
          let snap = await getDoc(doc(db, 'licenses', 'system_hotpatch_latest'));
          if (!snap.exists()) snap = await getDoc(doc(db, 'appHotpatches', 'latest'));
          if (snap.exists()) data = snap.data();
        }

        if (data && data.active !== false && data.patchVersion) {
          if (this.isNewerPatch(data.patchVersion, currentPatch)) {
            return {
              available: true,
              patchVersion: data.patchVersion,
              description: data.description || 'تحسينات وإصلاحات فورية للواجهة والعمليات',
              publishedAt: data.publishedAt || new Date().toISOString(),
              files: data.files || [],
              source: 'firestore'
            };
          }
        }
      } catch (err) {
        console.warn('[Hotpatch] Firestore check fallback:', err.message);
      }
    }

    // 2. Try GitHub Releases hotpatch-latest tag fallback
    try {
      const ghPatch = await this.checkGitHubHotpatch(currentPatch);
      if (ghPatch && ghPatch.available) {
        return ghPatch;
      }
    } catch (_) {}

    return {
      available: false,
      currentPatch: currentPatch || 'original-bundled',
      reason: 'النظام يعمل بأحدث نسخة فورية متوفرة'
    };
  }

  /**
   * Check GitHub Releases or Raw GitHub repository for hotpatch manifest
   */
  checkGitHubHotpatch(currentPatch, repo = 'ahpalll/remas') {
    return new Promise((resolve) => {
      // 1. Direct fetch from raw.githubusercontent.com (zero rate limit, instantaneous, no release tag required)
      const rawUrl = `https://raw.githubusercontent.com/${repo}/main/center-desktop/release_hotpatches/hotpatch_manifest.json`;
      const clientReq = https.get(rawUrl, {
        headers: { 'User-Agent': 'RemasHotpatchClient' },
        timeout: 8000
      }, (res) => {
        if (res.statusCode === 200) {
          let raw = '';
          res.on('data', c => raw += c);
          res.on('end', () => {
            try {
              const manifest = JSON.parse(raw);
              if (manifest && manifest.patchVersion && this.isNewerPatch(manifest.patchVersion, currentPatch)) {
                return resolve({
                  available: true,
                  patchVersion: manifest.patchVersion,
                  description: manifest.description || 'تحديث فوري للنظام يتضمن تحسينات الاستقرار وسرعة الاستجابة.',
                  publishedAt: manifest.publishedAt || new Date().toISOString(),
                  files: manifest.files || [],
                  source: 'github-raw'
                });
              } else {
                return resolve({ available: false });
              }
            } catch (_) {
              this.fallbackCheckGitHubReleases(currentPatch, repo).then(resolve);
            }
          });
          return;
        }
        this.fallbackCheckGitHubReleases(currentPatch, repo).then(resolve);
      });
      clientReq.on('error', () => this.fallbackCheckGitHubReleases(currentPatch, repo).then(resolve));
      clientReq.on('timeout', () => { clientReq.destroy(); this.fallbackCheckGitHubReleases(currentPatch, repo).then(resolve); });
    });
  }

  fallbackCheckGitHubReleases(currentPatch, repo = 'ahpalll/remas') {
    return new Promise((resolve) => {
      const req = https.get(`https://api.github.com/repos/${repo}/releases/tags/hotpatch-latest`, {
        headers: { 'User-Agent': 'RemasHotpatchClient' },
        timeout: 8000
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) return resolve(null);
            const data = JSON.parse(raw);
            const manifestAsset = (data.assets || []).find(a => a.name === 'hotpatch_manifest.json');
            if (!manifestAsset) return resolve(null);

            https.get(manifestAsset.browser_download_url, (mRes) => {
              let mData = '';
              mRes.on('data', mc => mData += mc);
              mRes.on('end', () => {
                try {
                  const manifest = JSON.parse(mData);
                  if (manifest.patchVersion && this.isNewerPatch(manifest.patchVersion, currentPatch)) {
                    resolve({
                      available: true,
                      patchVersion: manifest.patchVersion,
                      description: manifest.description || data.body || 'تحديث فوري للنظام',
                      publishedAt: manifest.publishedAt || data.published_at,
                      files: manifest.files || [],
                      source: 'github'
                    });
                  } else {
                    resolve({ available: false });
                  }
                } catch (_) { resolve(null); }
              });
            }).on('error', () => resolve(null));
          } catch (_) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  /**
   * Download and atomically apply a hotpatch
   */
  async downloadAndApplyHotpatch(patchInfo, bundledBaseDir) {
    if (!patchInfo || !Array.isArray(patchInfo.files) || patchInfo.files.length === 0) {
      throw new Error('بيانات التحديث غير صالحة أو لا تحتوي على ملفات');
    }

    const stagingDir = path.join(this.hotpatchDir, `staging_${Date.now()}`);
    fs.mkdirSync(stagingDir, { recursive: true });

    try {
      const downloadedFiles = [];

      for (const fileItem of patchInfo.files) {
        const relPath = (fileItem.relativePath || fileItem.path || '').replace(/\\/g, '/');
        if (!relPath || relPath.includes('..')) {
          throw new Error(`مسار ملف غير آمن: ${relPath}`);
        }

        const destPath = path.join(stagingDir, relPath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });

        // Download or write inline content
        let contentBuffer = null;
        if (fileItem.content) {
          contentBuffer = Buffer.from(fileItem.content, fileItem.encoding || 'utf8');
          fs.writeFileSync(destPath, contentBuffer);
        } else if (fileItem.url) {
          contentBuffer = await this.downloadFileToBuffer(fileItem.url);
          fs.writeFileSync(destPath, contentBuffer);
        } else {
          throw new Error(`الملف ${relPath} لا يحتوي على رابط أو محتوى`);
        }

        // SHA-256 verification
        if (fileItem.sha256) {
          const actualHash = crypto.createHash('sha256').update(contentBuffer).digest('hex');
          if (actualHash.toLowerCase() !== fileItem.sha256.toLowerCase()) {
            throw new Error(`فشل التحقق من أمان الملف ${relPath}: البصمة غير متطابقة`);
          }
        }

        // JavaScript Syntax Validation
        if (relPath.endsWith('.js')) {
          const codeStr = contentBuffer.toString('utf8');
          try {
            new vm.Script(codeStr, { filename: relPath });
          } catch (syntaxErr) {
            throw new Error(`خطأ برمجي داخل الملف المحدث ${relPath}: ${syntaxErr.message}`);
          }
        }

        downloadedFiles.push({ relPath, destPath, size: contentBuffer.length });
      }

      // Write patch manifest into staging
      const manifest = {
        patchVersion: patchInfo.patchVersion,
        appliedAt: new Date().toISOString(),
        description: patchInfo.description || '',
        files: downloadedFiles.map(f => ({ path: f.relPath, size: f.size }))
      };
      fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

      // Atomic directory activation
      if (fs.existsSync(this.currentPatchDir)) {
        const backupDir = path.join(this.hotpatchDir, `backup_${Date.now()}`);
        try { fs.renameSync(this.currentPatchDir, backupDir); } catch (_) {}
      }
      fs.renameSync(stagingDir, this.currentPatchDir);
      this.activeManifest = manifest;

      // Also attempt in-place copy to resources/app/ if writable (user-space install)
      if (bundledBaseDir && fs.existsSync(bundledBaseDir)) {
        try {
          for (const item of downloadedFiles) {
            const bundledTarget = path.join(bundledBaseDir, item.relPath);
            fs.mkdirSync(path.dirname(bundledTarget), { recursive: true });
            fs.copyFileSync(item.destPath, bundledTarget);
          }
          console.log('[Hotpatch] In-place application to bundled app succeeded.');
        } catch (inPlaceErr) {
          console.log('[Hotpatch] In-place write bypassed (using user hotpatch storage):', inPlaceErr.message);
        }
      }

      console.log(`[Hotpatch] Successfully applied patch ${patchInfo.patchVersion}!`);
      return { success: true, patchVersion: patchInfo.patchVersion, filesCount: downloadedFiles.length };
    } catch (err) {
      // Clean staging on failure
      try {
        if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch (_) {}
      throw err;
    }
  }

  /**
   * Helper: Download URL to memory Buffer
   */
  downloadFileToBuffer(url, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.downloadFileToBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`فشل التحميل من السيرفر (HTTP ${res.statusCode})`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('انتهى وقت تحميل التحديث')); });
    });
  }

  /**
   * Emergency Rollback: Delete applied hotpatch and return to clean factory install
   */
  rollback() {
    try {
      if (fs.existsSync(this.currentPatchDir)) {
        fs.rmSync(this.currentPatchDir, { recursive: true, force: true });
      }
      this.activeManifest = null;
      console.log('[Hotpatch] Rollback completed. Running on factory base.');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new HotpatchService();
