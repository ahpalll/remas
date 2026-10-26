/**
 * REMAS Educational Center SaaS — Windows Desktop Application Main Process
 * Target Project: educenter-saas
 * Version: see package.json (single source of truth — never hardcode here).
 */

const dns = require('node:dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('node:fs');
const pkg = require('./package.json');
const { generateHardwareFingerprint, getSystemMetadata } = require('./src/device_fingerprint');
let desktopServices = require('./src/center_desktop_services');
const hotpatchService = require('./src/hotpatch_service');

let mainWindow = null;
let currentDeviceStatus = {
  status: 'PENDING_VALIDATION',
  valid: false,
  fingerprint: null,
  meta: null,
  offlineGraceActive: false,
  lastValidated: null
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1100,
    minHeight: 720,
    title: `REMAS Educational Center SaaS — Windows Desktop App (v${pkg.version})`,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.setMenu(null); // Remove default browser menu bar
  
  // Intercept external URLs (WhatsApp, external links) and open in default OS browser (Chrome/Edge/WhatsApp Desktop)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// System Hardware Fingerprint Initialization
const meta = getSystemMetadata();
const fingerprint = generateHardwareFingerprint(meta);
currentDeviceStatus.fingerprint = fingerprint;
currentDeviceStatus.meta = meta;

app.whenReady().then(() => {
  // 1. Initialize Hotpatch Storage
  try {
    hotpatchService.init(app.getPath('userData'), pkg.version);

    // Reload backend module if a hotpatch exists
    if (hotpatchService.hasHotpatch('src/center_desktop_services.js')) {
      desktopServices = hotpatchService.loadHotpatchedModule('src/center_desktop_services.js', desktopServices, __dirname);
    }

    // Intercept renderer scripts to serve verified hotpatched assets
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      try {
        const redirected = hotpatchService.resolveEffectiveFileUrl(details.url, __dirname);
        if (redirected && redirected !== details.url) {
          return callback({ redirectURL: redirected });
        }
      } catch (_) {}
      callback({});
    });
  } catch (err) {
    console.warn('[Hotpatch] Setup failed, running factory base:', err.message);
  }

  createWindow();

  // 2. Gentle background hotpatch check (8 seconds after window creation)
  setTimeout(async () => {
    try {
      if (!updateDb) updateDb = getUpdateFirestore();
      const patch = await hotpatchService.checkForHotpatch(updateDb, pkg.version);
      if (patch && patch.available && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotpatch-ready', patch);
      }
    } catch (_) {}
  }, 8000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for Windows Desktop Application
// Single source of truth: center-desktop/package.json (pkg.version).
// The renderer must query this handler instead of hardcoding a version string.
ipcMain.handle('get-app-version', () => {
  return pkg.version;
});

// C.1 employee PIN verification + device-local brute-force throttle.
// PIN hashes live in Firestore employee docs; verification runs HERE in the
// Main process (node:crypto) — the renderer NEVER receives pinHash/pinSalt.
// The PIN travels this IPC channel in memory only: never logged, never
// persisted. Device-local throttle (userData) is defense-in-depth on top of
// the service-level failedAttempts/lockedUntil on the employee doc.
function pinThrottleFile() {
  try { return path.join(app.getPath('userData'), 'remas_pin_throttle.json'); }
  catch (_) { return null; }
}

function readPinThrottle() {
  try {
    const f = pinThrottleFile();
    if (!f || !fs.existsSync(f)) return {};
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    return (raw && typeof raw === 'object') ? raw : {};
  } catch (_) { return {}; }
}

function writePinThrottle(state) {
  try {
    const f = pinThrottleFile();
    if (!f) return;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(state), 'utf8');
  } catch (_) {}
}

ipcMain.handle('verify-employee-pin', async (event, { institutionId, employeeId, pin, callerToken }) => {
  try {
    const key = `${institutionId}__${employeeId}`;
    const now = Date.now();
    const state = readPinThrottle();
    const rec = state[key] || { attempts: 0, lockedUntil: 0 };
    if (rec.lockedUntil && rec.lockedUntil > now) {
      return { success: false, error: 'PIN_LOCKED_OUT: تم إيقاف المحاولات مؤقتًا — حاول لاحقًا' };
    }
    const session = await desktopServices.verifyEmployeePin(callerToken, { institutionId, employeeId, pin });
    state[key] = { attempts: 0, lockedUntil: 0 };
    writePinThrottle(state);
    return { success: true, data: session };
  } catch (err) {
    try {
      const key = `${institutionId}__${employeeId}`;
      const state = readPinThrottle();
      const rec = state[key] || { attempts: 0, lockedUntil: 0 };
      rec.attempts += 1;
      if (rec.attempts >= 10) rec.lockedUntil = Date.now() + 5 * 60000;
      state[key] = rec;
      writePinThrottle(state);
    } catch (_) {}
    return { success: false, error: (err && err.message) || 'فشل التحقق' };
  }
});

ipcMain.handle('generate-barcode', async (event, { text, bcid = 'code128', scale = 3, height = 12, includetext = true }) => {
  try {
    const bwipjs = require('bwip-js');
    const safeText = String(text || '').trim();
    if (!safeText) return { success: false, error: 'Empty text' };
    return await new Promise((resolve) => {
      bwipjs.toBuffer({
        bcid,
        text: safeText,
        scale: scale || 3,
        height: height || 12,
        includetext: includetext !== false,
        textxalign: 'center'
      }, (err, png) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, dataUrl: `data:image/png;base64,${png.toString('base64')}` });
        }
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-device-fingerprint', () => {
  return fingerprint;
});

ipcMain.handle('get-system-metadata', () => {
  return meta;
});

ipcMain.handle('get-device-status', () => {
  return currentDeviceStatus;
});

// Canonical device binding (Firestore `deviceBindings/*` via trusted callables).
// The in-memory legacy service is NOT used at runtime: validation/activation/
// heartbeat all reach the Admin-SDK backend, and SuperAdmin reads the same
// canonical docs. Failures propagate honestly (no false success).
ipcMain.handle('validate-device', async (event, { institutionId, callerToken }) => {
  try {
    const result = await desktopServices.validateDeviceStatus(callerToken, {
      institutionId
    });

    currentDeviceStatus = {
      ...currentDeviceStatus,
      valid: result.valid === true,
      status: result.valid ? 'ACTIVE' : (result.status || 'UNBOUND'),
      reason: result.reason || null,
      bindingId: result.bindingId || null,
      lastValidated: new Date().toISOString()
    };

    return result;
  } catch (err) {
    // Offline Grace Period Policy: 72 hours max
    const now = Date.now();
    const lastVal = currentDeviceStatus.lastValidated ? new Date(currentDeviceStatus.lastValidated).getTime() : 0;
    const elapsedHours = (now - lastVal) / (1000 * 3600);

    if (lastVal > 0 && elapsedHours < 72) {
      return {
        valid: true,
        status: 'ACTIVE_OFFLINE_GRACE',
        reason: `وضع عدم الاتصال المؤقت (فترة سماح 72 ساعة - المتبقي: ${Math.round(72 - elapsedHours)} ساعة)`
      };
    }

    return {
      valid: false,
      status: 'CONNECTION_REQUIRED',
      reason: (err && err.message) ? `تعذر التحقق من الخادم: ${String(err.message).slice(0, 200)}` : 'يتطلب الاتصال بالإنترنت للتحقق من ترخيص الجهاز (انتهت فترة السماح المؤقتة)'
    };
  }
});

ipcMain.handle('activate-device', async (event, { institutionId, callerToken }) => {
  try {
    const result = await desktopServices.requestDeviceBinding(callerToken, {
      institutionId,
      appVersion: pkg.version
    });
    const isBound = result && (
      result.status === 'DEVICE_BOUND_SUCCESSFULLY' ||
      result.status === 'ALREADY_ACTIVE_SAME_DEVICE' ||
      result.status === 'ACTIVE' ||
      (result.binding && result.binding.status === 'BOUND')
    );
    currentDeviceStatus = {
      ...currentDeviceStatus,
      valid: isBound,
      status: isBound ? 'ACTIVE' : (result.status || 'DEVICE_MISMATCH'),
      reason: result.message || null,
      bindingId: (result && result.binding && (result.binding.bindingId || result.binding.id)) || null,
      lastValidated: new Date().toISOString()
    };
    return result;
  } catch (err) {
    const msg = (err && err.message) || String(err);
    currentDeviceStatus = {
      ...currentDeviceStatus,
      valid: false,
      status: msg.includes('DEVICE_MISMATCH') ? 'DEVICE_MISMATCH' : 'DEVICE_ERROR',
      reason: msg,
      lastValidated: new Date().toISOString()
    };
    throw err;
  }
});

ipcMain.handle('send-heartbeat', async (event, { institutionId, callerToken }) => {
  const result = await desktopServices.deviceHeartbeat(callerToken, {
    institutionId,
    appVersion: pkg.version
  });
  return result;
});

// Bound-institution branding cache (P0).
// Written ONLY after a successful authenticated login, from the session's own
// institutionId — never hardcoded, never provisioned. Public fields only:
// { institutionId, centerName, logoUrl, colors:{primary,secondary,accent}, updatedAt }.
// No students/teachers/finance/admin data is ever stored here. Used to render
// the correct center brand on subsequent pre-auth login screens. First-ever
// login on a fresh installation has no binding and shows neutral REMAS login
// (documented limitation — no invented provisioning, no fixed institutionId).
function boundBrandingFile() {
  try { return path.join(app.getPath('userData'), 'remas_bound_branding.json'); }
  catch (_) { return null; }
}

function readBoundBranding() {
  try {
    const f = boundBrandingFile();
    if (!f || !fs.existsSync(f)) return null;
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!raw || typeof raw.institutionId !== 'string' || !raw.institutionId) return null;
    const colors = raw.colors && typeof raw.colors === 'object' ? raw.colors : {};
    const pick = (v) => (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v.trim()) ? v.trim().toUpperCase() : null);
    return {
      institutionId: raw.institutionId,
      centerName: typeof raw.centerName === 'string' ? raw.centerName.slice(0, 120) : null,
      logoUrl: typeof raw.logoUrl === 'string' ? raw.logoUrl.slice(0, 2000) : null,
      colors: {
        primary: pick(colors.primary),
        secondary: pick(colors.secondary),
        accent: pick(colors.accent)
      },
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null
    };
  } catch (_) { return null; }
}

ipcMain.handle('get-bound-branding', () => {
  return readBoundBranding();
});

ipcMain.handle('set-bound-branding', (event, payload = {}) => {
  // Strict whitelist: institutionId + public display fields only.
  if (!payload || typeof payload.institutionId !== 'string' || !payload.institutionId.trim()) {
    return { success: false, error: 'institutionId is required' };
  }
  const colors = payload.colors && typeof payload.colors === 'object' ? payload.colors : {};
  const pick = (v) => (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v.trim()) ? v.trim().toUpperCase() : null);
  const doc = {
    institutionId: payload.institutionId.trim(),
    centerName: typeof payload.centerName === 'string' ? payload.centerName.slice(0, 120) : null,
    logoUrl: typeof payload.logoUrl === 'string' ? payload.logoUrl.slice(0, 2000) : null,
    colors: {
      primary: pick(colors.primary),
      secondary: pick(colors.secondary),
      accent: pick(colors.accent)
    },
    updatedAt: new Date().toISOString()
  };
  try {
    const f = boundBrandingFile();
    if (!f) return { success: false, error: 'storage unavailable' };
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(doc, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Auto-Update IPC Handlers (RSA-signed releases only)
const updateService = require('./src/update_service');
let updateStatus = { checking: false, available: false, downloading: false, downloaded: false, error: null, version: null };
const UPDATE_DOWNLOAD_DIR = path.join(app.getPath('userData'), 'updates');
let updateDb = null;

function getUpdateFirestore() {
  try {
    const { initializeApp, getApps } = require('firebase/app');
    const { getFirestore } = require('firebase/firestore');
    if (getApps().length === 0) {
      initializeApp({
        apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'educenter-saas-860c5.firebaseapp.com',
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'educenter-saas-860c5',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'educenter-saas-860c5.firebasestorage.app'
      });
    }
    return getFirestore();
  } catch (err) {
    console.warn('[Update Firestore] Init error:', err.message);
    return null;
  }
}

ipcMain.handle('check-for-updates', async () => {
  updateStatus = { ...updateStatus, checking: true, error: null };
  try {
    const db = getUpdateFirestore();
    const result = await updateService.checkForUpdates(db, pkg.version, 'stable');
    updateStatus = { ...updateStatus, checking: false, available: !!result.available, version: result.version || null, error: result.error || null };
    return { success: true, ...result };
  } catch (err) {
    updateStatus = { ...updateStatus, checking: false, error: err.message };
    return { success: false, available: false, error: err.message };
  }
});

ipcMain.handle('download-update', async (event, { releaseInfo }) => {
  updateStatus = { ...updateStatus, downloading: true, error: null };
  try {
    fs.mkdirSync(UPDATE_DOWNLOAD_DIR, { recursive: true });
    const result = await updateService.downloadUpdate(releaseInfo, UPDATE_DOWNLOAD_DIR, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', progress);
      }
    });
    updateStatus = { ...updateStatus, downloading: false, downloaded: true };
    return { success: true, ...result };
  } catch (err) {
    updateStatus = { ...updateStatus, downloading: false, error: err.message };
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', async (event, { filePath }) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'ملف التحديث غير موجود' };
    }
    const { spawn, execFileSync } = require('node:child_process');
    const { buildUpdateLauncherScript } = require('./src/update_launcher');
    const pid = process.pid;
    // Launcher script waits for THIS process to fully exit, then runs the
    // NSIS silent installer — avoids replacing files while locked by the app.
    const launcher = path.join(app.getPath('userData'), 'run_update.cmd');
    const script = buildUpdateLauncherScript(pid, filePath, '/S');
    fs.writeFileSync(launcher, script, 'utf8');
    spawn('cmd.exe', ['/c', launcher], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => app.quit(), 500);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-update-status', () => {
  return updateStatus;
});

// ─── OTA Hot-Patching IPC Handlers ───
ipcMain.handle('check-for-hotpatch', async () => {
  try {
    const db = getUpdateFirestore();
    const result = await hotpatchService.checkForHotpatch(db, pkg.version);
    return { success: true, ...result };
  } catch (err) {
    console.warn('[Hotpatch IPC] check error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-apply-hotpatch', async (event, { patchInfo }) => {
  try {
    const result = await hotpatchService.downloadAndApplyHotpatch(patchInfo, __dirname);
    if (hotpatchService.hasHotpatch('src/center_desktop_services.js')) {
      desktopServices = hotpatchService.loadHotpatchedModule('src/center_desktop_services.js', desktopServices, __dirname);
    }
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-hotpatch-version', () => {
  return {
    appVersion: pkg.version,
    patchVersion: hotpatchService.getCurrentPatchVersion(),
    appliedAt: hotpatchService.getAppliedDate()
  };
});

ipcMain.handle('rollback-hotpatch', () => {
  return hotpatchService.rollback();
});

ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});

// Trusted Backend Service Gateway Handler for Renderer Process
ipcMain.handle('call-backend-service', async (event, { method, args = [] }) => {
  if (hotpatchService && hotpatchService.hasHotpatch('src/center_desktop_services.js')) {
    desktopServices = hotpatchService.loadHotpatchedModule('src/center_desktop_services.js', desktopServices, __dirname);
  }
  if (typeof desktopServices[method] === 'function') {
    try {
      const isLongRunningMethod = method.toLowerCase().includes('ai') || method.toLowerCase().includes('generate') || method.toLowerCase().includes('content') || method.toLowerCase().includes('upload');
      const timeoutMs = isLongRunningMethod ? 120000 : 25000;
      let timerId;
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
          const err = new Error(`NETWORK_TIMEOUT: انتهت مهلة معالجة العملية (${method}) بسبب انقطاع أو بطء الإنترنت.`);
          err.code = 'NETWORK_TIMEOUT';
          reject(err);
        }, timeoutMs);
      });
      const res = await Promise.race([
        desktopServices[method](...args),
        timeoutPromise
      ]).finally(() => {
        if (timerId) clearTimeout(timerId);
      });
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: err.message || 'Error executing desktop service', code: err.code || 'UNKNOWN_ERROR' };
    }
  }
  return { success: false, error: `Method '${method}' not found on desktop services`, code: 'METHOD_NOT_FOUND' };
});

// IPC Handler to open external URLs in Windows default browser / system application
ipcMain.handle('open-external-url', async (event, url) => {
  if (url && typeof url === 'string') {
    try {
      const { shell } = require('electron');
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Empty URL' };
});

// Native Receipt Print Handler: Opens system printer dialog with clean isolated receipt HTML
ipcMain.handle('print-receipt-native', async (event, { html } = {}) => {
  try {
    const { BrowserWindow } = require('electron');
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: auto; margin: 6mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 10px; color: #0f172a; background: #fff; direction: rtl; }
          .printable-receipt-area { max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        ${html || ''}
      </body>
      </html>
    `;

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    printWin.webContents.print({
      silent: false,
      printBackground: true
    }, (success, failureReason) => {
      try { printWin.close(); } catch (_) {}
    });
    return { success: true };
  } catch (err) {
    console.error('[print-receipt-native error]:', err);
    return { success: false, error: err.message };
  }
});

// Native PDF Export Handler: Directly generates and saves pristine PDF without browser preview issues
ipcMain.handle('save-receipt-pdf', async (event, { html, defaultFilename }) => {
  try {
    const { dialog, BrowserWindow } = require('electron');
    const saveRes = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ إيصال التحصيل كملف PDF',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename || `إيصال_تحصيل_${Date.now()}.pdf`),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (saveRes.canceled || !saveRes.filePath) {
      return { canceled: true };
    }

    const pdfWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 8mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 15px; color: #0f172a; background: #fff; direction: rtl; }
          .printable-receipt-area { max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 }
    });
    pdfWin.destroy();

    fs.writeFileSync(saveRes.filePath, pdfBuffer);
    return { success: true, filePath: saveRes.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


// Helper to render clean isolated receipt HTML to native Electron image
async function renderReceiptToNativeImage(html) {
  const { BrowserWindow } = require('electron');
  const renderWin = new BrowserWindow({
    show: false,
    width: 580,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
          font-family: 'Segoe UI', Tahoma, -apple-system, Arial, sans-serif;
          margin: 0;
          padding: 12px;
          background: #ffffff;
          color: #0f172a;
          direction: rtl;
        }
        .printable-receipt-area {
          max-width: 550px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
        .no-print { display: none !important; }
        table { width: 100%; border-collapse: collapse; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;

  await renderWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
  await new Promise(r => setTimeout(r, 150));

  const contentHeight = await renderWin.webContents.executeJavaScript(`
    Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.querySelector('.printable-receipt-area')?.scrollHeight || 0
    ) + 24
  `).catch(() => 800);

  const finalHeight = Math.max(300, Math.min(3000, contentHeight));
  renderWin.setContentSize(574, finalHeight);
  await new Promise(r => setTimeout(r, 100));

  const image = await renderWin.webContents.capturePage({
    x: 0,
    y: 0,
    width: 574,
    height: finalHeight
  });

  renderWin.destroy();
  return image;
}

// Copy Receipt Element as PNG Image directly to OS Clipboard
ipcMain.handle('copy-receipt-image-to-clipboard', async (event, payload) => {
  try {
    const { clipboard } = require('electron');
    let nativeImg;

    if (payload && payload.html) {
      nativeImg = await renderReceiptToNativeImage(payload.html);
    } else if (payload && payload.rect && mainWindow && !mainWindow.isDestroyed()) {
      nativeImg = await mainWindow.webContents.capturePage({
        x: Math.max(0, Math.round(payload.rect.x)),
        y: Math.max(0, Math.round(payload.rect.y)),
        width: Math.max(1, Math.round(payload.rect.width)),
        height: Math.max(1, Math.round(payload.rect.height))
      });
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      nativeImg = await mainWindow.webContents.capturePage();
    }

    if (nativeImg && !nativeImg.isEmpty()) {
      clipboard.writeImage(nativeImg);
      return { success: true };
    }
    return { success: false, error: 'تعذر التقاط صورة الإيصال' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Save Receipt Element directly as PNG Image file
ipcMain.handle('save-receipt-image', async (event, { html, rect, defaultFilename }) => {
  try {
    const { dialog } = require('electron');
    const fs = require('fs');
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: 'نافذة البرنامج غير متوفرة' };
    }
    const saveRes = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ صورة الإيصال كملف PNG',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename || `إيصال_تحصيل_${Date.now()}.png`),
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    });

    if (saveRes.canceled || !saveRes.filePath) {
      return { canceled: true };
    }

    let nativeImg;
    if (html) {
      nativeImg = await renderReceiptToNativeImage(html);
    } else if (rect && rect.width && rect.height) {
      nativeImg = await mainWindow.webContents.capturePage({
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
      });
    } else {
      nativeImg = await mainWindow.webContents.capturePage();
    }
    const pngBuffer = nativeImg.toPNG();
    fs.writeFileSync(saveRes.filePath, pngBuffer);
    return { success: true, filePath: saveRes.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


