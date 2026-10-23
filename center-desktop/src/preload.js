/**
 * Secure IPC Context Bridge Preload Script
 * REMAS Educational Center SaaS — Windows Desktop
 * Version: see package.json (single source of truth — never hardcode here).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  verifyEmployeePin: (payload) => ipcRenderer.invoke('verify-employee-pin', payload),
  getDeviceFingerprint: () => ipcRenderer.invoke('get-device-fingerprint'),
  getSystemMetadata: () => ipcRenderer.invoke('get-system-metadata'),
  getDeviceStatus: () => ipcRenderer.invoke('get-device-status'),
  validateDevice: (payload) => ipcRenderer.invoke('validate-device', payload),
  activateDevice: (payload) => ipcRenderer.invoke('activate-device', payload),
  sendHeartbeat: (payload) => ipcRenderer.invoke('send-heartbeat', payload),
  getBoundBranding: () => ipcRenderer.invoke('get-bound-branding'),
  setBoundBranding: (payload) => ipcRenderer.invoke('set-bound-branding', payload),
  callBackendService: (method, ...args) => ipcRenderer.invoke('call-backend-service', { method, args }),
  generateBarcode: (payload) => ipcRenderer.invoke('generate-barcode', payload),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  saveReceiptPdf: (payload) => ipcRenderer.invoke('save-receipt-pdf', payload),
  printReceiptNative: (payload) => ipcRenderer.invoke('print-receipt-native', payload),
  copyReceiptImageToClipboard: (payload) => ipcRenderer.invoke('copy-receipt-image-to-clipboard', payload),
  saveReceiptImage: (payload) => ipcRenderer.invoke('save-receipt-image', payload),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (payload) => ipcRenderer.invoke('download-update', payload),
  installUpdate: (payload) => ipcRenderer.invoke('install-update', payload),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  onUpdateProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  checkForHotpatch: () => ipcRenderer.invoke('check-for-hotpatch'),
  downloadApplyHotpatch: (payload) => ipcRenderer.invoke('download-apply-hotpatch', payload),
  getHotpatchVersion: () => ipcRenderer.invoke('get-hotpatch-version'),
  rollbackHotpatch: () => ipcRenderer.invoke('rollback-hotpatch'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  onHotpatchReady: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('hotpatch-ready', listener);
    return () => ipcRenderer.removeListener('hotpatch-ready', listener);
  }
});
