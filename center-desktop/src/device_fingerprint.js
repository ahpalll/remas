/**
 * Hardware Fingerprint Generator & Verifier
 * REMAS Educational Center SaaS — Standalone Windows Desktop Runtime
 * Target Project: educenter-saas
 */

const crypto = require('crypto');
const os = require('os');

/**
 * Derives a deterministic cryptographic SHA-256 hardware fingerprint from non-PII system properties
 * @param {Object} overrideMeta - Optional metadata overrides for testing / cross-device simulation
 * @returns {string} SHA-256 fingerprint prefixed with 'win_fp_'
 */
function generateHardwareFingerprint(overrideMeta = {}) {
  const cpus = os.cpus();
  const model = overrideMeta.cpuModel || (cpus && cpus.length > 0 ? cpus[0].model : 'Generic CPU');
  const cores = overrideMeta.cpuCores || (cpus ? cpus.length : 4);
  const totalMem = overrideMeta.totalMemoryGb || Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const platform = overrideMeta.platform || os.platform();
  const arch = overrideMeta.arch || os.arch();
  const machineGuid = overrideMeta.machineGuid || 'REMAS-WINDOWS-MACHINE-STATIC-SALT-001';
  const hostnameHash = crypto.createHash('sha256').update(overrideMeta.hostname || os.hostname()).digest('hex').substring(0, 16);

  const rawSeed = `${platform}|${arch}|${model}|${cores}|${totalMem}|${hostnameHash}|${machineGuid}`;
  const hash = crypto.createHash('sha256').update(rawSeed).digest('hex');

  return `win_fp_${hash}`;
}

/**
 * Validates the format of a hardware fingerprint string
 * @param {string} fingerprint
 * @returns {boolean}
 */
function validateFingerprintFormat(fingerprint) {
  if (!fingerprint || typeof fingerprint !== 'string') return false;
  const regex = /^win_fp_[a-f0-9]{64}$/;
  return regex.test(fingerprint);
}

/**
 * Retrieves non-PII system metadata for device registration display
 * @param {Object} overrideMeta
 * @returns {Object}
 */
function getSystemMetadata(overrideMeta = {}) {
  const cpus = os.cpus();
  return {
    deviceName: overrideMeta.deviceName || os.hostname() || 'Windows Terminal',
    osVersion: overrideMeta.osVersion || `${os.type()} ${os.release()} (${os.arch()})`,
    arch: overrideMeta.arch || os.arch(),
    cpuCores: overrideMeta.cpuCores || (cpus ? cpus.length : 4),
    totalMemoryGb: overrideMeta.totalMemoryGb || Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    appVersion: overrideMeta.appVersion || '1.0.0-release.32'
  };
}

module.exports = {
  generateHardwareFingerprint,
  validateFingerprintFormat,
  getSystemMetadata
};
