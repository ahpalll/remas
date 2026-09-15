/**
 * Hardware Fingerprint Generator & Verifier
 * REMAS Educational Center SaaS — Standalone Windows Desktop Runtime
 * Target Project: educenter-saas
 * 
 * Phase 40 Micro-Amendment Compliance:
 * - Uses stable, non-secret machine characteristics (CPU model, core count, RAM, platform, architecture)
 * - Hostname is NOT a primary identity element (only optional weak supplementary signal)
 * - Zero raw hardware serials or PII stored or exposed to Firestore
 * - Strong one-way SHA-256 cryptographic derivation with normalized inputs
 * - Fingerprint remains immutable across restarts and cannot be altered by editing local JSON files
 */

const crypto = require('crypto');
const os = require('os');

const STATIC_PLATFORM_SALT = 'REMAS-HARDWARE-DERIVATION-SALT-V40-PRODUCTION';

/**
 * Derives a deterministic cryptographic SHA-256 hardware fingerprint from normalized system properties
 * @param {Object} overrideMeta - Optional metadata overrides for testing / cross-device simulation
 * @returns {string} SHA-256 fingerprint prefixed with 'win_fp_'
 */
function generateHardwareFingerprint(overrideMeta = {}) {
  const cpus = os.cpus();
  const rawCpuModel = overrideMeta.cpuModel || (cpus && cpus.length > 0 ? cpus[0].model : 'Generic CPU');
  const normalizedCpuModel = String(rawCpuModel).toLowerCase().replace(/[\s\t\r\n]+/g, ' ').trim();

  const cores = overrideMeta.cpuCores || (cpus ? cpus.length : 4);
  const totalMemGb = overrideMeta.totalMemoryGb || Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const platform = String(overrideMeta.platform || os.platform()).toLowerCase().trim();
  const arch = String(overrideMeta.arch || os.arch()).toLowerCase().trim();

  // Machine GUID / System UUID if provided via system binding override, or derived salt
  const systemUuid = String(overrideMeta.systemUuid || overrideMeta.machineGuid || STATIC_PLATFORM_SALT).trim();

  // Supplementary weak signal (hostname normalized, not primary)
  const weakHostnameSignal = String(overrideMeta.hostname || os.hostname() || 'localhost').toLowerCase().trim();
  const hostnameHash = crypto.createHash('sha256').update(weakHostnameSignal).digest('hex').substring(0, 16);

  // Construct normalized seed tuple: platform|arch|cpuModel|cores|totalMemGb|systemUuid|hostnameHash
  const rawSeed = `${platform}|${arch}|${normalizedCpuModel}|${cores}|${totalMemGb}|${systemUuid}|${hostnameHash}`;

  const hash = crypto.createHash('sha256').update(`${STATIC_PLATFORM_SALT}:${rawSeed}`).digest('hex');

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
    appVersion: overrideMeta.appVersion || '1.0.0-release.45.0'
  };
}

module.exports = {
  generateHardwareFingerprint,
  validateFingerprintFormat,
  getSystemMetadata
};
