/**
 * REMAS Educational Center SaaS — Windows Desktop Application Main Process
 * Target Project: educenter-saas
 * Version: 1.0.0-release.32
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { generateHardwareFingerprint, getSystemMetadata } = require('../firebase/device_fingerprint');
const { validateDeviceBinding, requestDeviceActivation, heartbeatDevice } = require('../firebase/device_binding_service');

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
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'REMAS Educational Center SaaS — Windows Desktop (Single Device Licensing)',
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
    appVersion: '1.0.0-release.32',
    callerToken
  });
  return result;
});
