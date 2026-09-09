/**
 * Secure IPC Context Bridge Preload Script
 * REMAS Educational Center SaaS — Windows Desktop
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDeviceFingerprint: () => ipcRenderer.invoke('get-device-fingerprint'),
  getSystemMetadata: () => ipcRenderer.invoke('get-system-metadata'),
  getDeviceStatus: () => ipcRenderer.invoke('get-device-status'),
  validateDevice: (payload) => ipcRenderer.invoke('validate-device', payload),
  activateDevice: (payload) => ipcRenderer.invoke('activate-device', payload),
  sendHeartbeat: (payload) => ipcRenderer.invoke('send-heartbeat', payload)
});
