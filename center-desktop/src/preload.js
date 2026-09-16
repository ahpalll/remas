/**
 * Secure IPC Context Bridge Preload Script
 * REMAS Educational Center SaaS — Windows Desktop
 * Version: 1.0.0-release.46.0
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDeviceFingerprint: () => ipcRenderer.invoke('get-device-fingerprint'),
  getSystemMetadata: () => ipcRenderer.invoke('get-system-metadata'),
  getDeviceStatus: () => ipcRenderer.invoke('get-device-status'),
  validateDevice: (payload) => ipcRenderer.invoke('validate-device', payload),
  activateDevice: (payload) => ipcRenderer.invoke('activate-device', payload),
  sendHeartbeat: (payload) => ipcRenderer.invoke('send-heartbeat', payload),
  callBackendService: (method, ...args) => ipcRenderer.invoke('call-backend-service', { method, args })
});
