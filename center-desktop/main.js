/**
 * REMAS Educational Center SaaS — Windows Desktop Application Main Process
 * Target Project: educenter-saas
 * Version: 1.0.0-release.50.4.0 — Batch A Students+Groups+Enrollment
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const pkg = require('./package.json');
const { generateHardwareFingerprint, getSystemMetadata } = require('./src/device_fingerprint');
const { validateDeviceBinding, requestDeviceActivation, heartbeatDevice } = require('./src/device_binding_service');
const desktopServices = require('./src/center_desktop_services');

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
    title: 'REMAS Educational Center SaaS — Windows Desktop App (v1.0.0-release.50.4.0)',
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.setMenu(null); // Remove default browser menu bar
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for Windows Desktop Application
ipcMain.handle('get-device-fingerprint', () => {
  return fingerprint;
});

ipcMain.handle('get-system-metadata', () => {
  return meta;
});

ipcMain.handle('get-device-status', () => {
  return currentDeviceStatus;
});

ipcMain.handle('validate-device', async (event, { institutionId, callerToken }) => {
  try {
    const result = await validateDeviceBinding({
      institutionId,
      deviceFingerprint: fingerprint,
      callerToken
    });

    currentDeviceStatus = {
      ...currentDeviceStatus,
      valid: result.valid,
      status: result.status,
      reason: result.reason || null,
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
      reason: 'يتطلب الاتصال بالإنترنت للتحقق من ترخيص الجهاز (انتهت فترة السماح المؤقتة)'
    };
  }
});

ipcMain.handle('activate-device', async (event, { institutionId, callerToken }) => {
  const result = await requestDeviceActivation({
    institutionId,
    deviceFingerprint: fingerprint,
    deviceMeta: meta,
    callerToken
  });
  return result;
});

ipcMain.handle('send-heartbeat', async (event, { institutionId, callerToken }) => {
  const result = await heartbeatDevice({
    institutionId,
    deviceFingerprint: fingerprint,
    appVersion: pkg.version,
    callerToken
  });
  return result;
});

// Trusted Backend Service Gateway Handler for Renderer Process
ipcMain.handle('call-backend-service', async (event, { method, args = [] }) => {
  if (typeof desktopServices[method] === 'function') {
    try {
      const res = await desktopServices[method](...args);
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: err.message || 'Error executing desktop service' };
    }
  }
  return { success: false, error: `Method '${method}' not found on desktop services` };
});
