/**
 * Trusted Center Licensing & Single Device Binding Backend Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { generateHardwareFingerprint, validateFingerprintFormat, getSystemMetadata } = require('./device_fingerprint');

const TARGET_PROJECT_ID = 'educenter-saas';

// In-Memory Store for Stateful Backend Operations & Unit Testing
const _licensesStore = new Map();
const _auditLogsStore = [];

/**
 * Resets in-memory stores (for testing)
 */
function resetLicenseStore() {
  _licensesStore.clear();
  _auditLogsStore.length = 0;
}

/**
 * Creates a new Center License record (SuperAdmin Only)
 */
async function createCenterLicense({
  institutionId,
  validityDays = 365,
  callerToken,
  dryRun = false
} = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Missing authentication token.');
  }

  if (callerToken.role !== 'superadmin') {
    throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can create center licenses.');
  }

  if (!institutionId) {
    throw new Error('MISSING_INSTITUTION_ID: Target institutionId is required.');
  }

  const timestamp = new Date();
  const expiresTimestamp = new Date(timestamp.getTime() + validityDays * 86400000);
  const licenseId = `lic_${institutionId}_${Date.now()}`;
  const codeSalt = Math.random().toString(36).substring(2, 8).toUpperCase();
  const licenseCode = `REMAS-${institutionId.substring(0, 8).toUpperCase()}-${timestamp.getFullYear()}-${codeSalt}`;

  const licenseRecord = {
    licenseId,
    institutionId,
    licenseCode,
    status: 'PENDING_ACTIVATION', // PENDING_ACTIVATION, ACTIVE, SUSPENDED, EXPIRED, REVOKED
    issuedAt: timestamp.toISOString(),
    activatedAt: null,
    expiresAt: expiresTimestamp.toISOString(),
    deviceBindingStatus: 'UNBOUND', // UNBOUND, BOUND, REVOKED, SUSPENDED
    deviceInstallationId: null,
    deviceFingerprintHash: null,
    deviceName: null,
    osVersion: null,
    appVersion: null,
    lastSeenAt: null,
    revokedAt: null,
    revocationReason: null,
    createdBy: callerToken.uid || 'superadmin',
    updatedAt: timestamp.toISOString()
  };

  if (!dryRun) {
    _licensesStore.set(institutionId, licenseRecord);
  }

  _logAuditEvent({
    institutionId,
    eventType: 'LICENSE_CREATED',
    details: `Created center license ${licenseId} (Code: ${licenseCode}) valid for ${validityDays} days`,
    performedBy: callerToken.uid || 'superadmin'
  });

  return {
    status: 'LICENSE_CREATED_SUCCESSFULLY',
    license: licenseRecord
  };
}

/**
 * Activates a Center License on a specific Windows Device
 */
async function activateCenterLicense({
  licenseCode,
  institutionId,
  deviceFingerprintHash,
  deviceInstallationId,
  deviceMeta = {},
  callerToken,
  dryRun = false
} = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Request missing authentication token.');
  }

  const role = callerToken.role || 'unprivileged';
  if (role !== 'superadmin' && role !== 'admin' && role !== 'institutionOwner') {
    throw new Error('UNAUTHORIZED_CALLER_ROLE: Only Institution Admin or SuperAdmin can activate center licenses.');
  }

  if (role !== 'superadmin' && callerToken.institutionId !== institutionId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot activate license for another institution.');
  }

  const license = _licensesStore.get(institutionId);
  if (!license) {
    throw new Error('LICENSE_NOT_FOUND: No center license found for target institution.');
  }

  if (licenseCode && license.licenseCode !== licenseCode) {
    throw new Error('INVALID_LICENSE_CODE: Provided license code is invalid for this institution.');
  }

  const now = new Date();
  if (new Date(license.expiresAt) < now) {
    license.status = 'EXPIRED';
    throw new Error('SUBSCRIPTION_EXPIRED: License has expired.');
  }

  if (license.status === 'SUSPENDED' && role !== 'superadmin') {
    throw new Error('LICENSE_SUSPENDED: License is currently suspended by SuperAdmin.');
  }

  if (license.status === 'REVOKED' && role !== 'superadmin') {
    throw new Error('LICENSE_REVOKED: License has been revoked by SuperAdmin.');
  }

  const fp = deviceFingerprintHash || generateHardwareFingerprint(deviceMeta);
  if (!validateFingerprintFormat(fp)) {
    throw new Error('INVALID_FINGERPRINT_FORMAT: Malformed hardware fingerprint string.');
  }

  const instId = deviceInstallationId || `inst_uuid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = now.toISOString();

  // Check 1-Device Binding Limit
  if (license.deviceBindingStatus === 'BOUND') {
    if (license.deviceFingerprintHash === fp) {
      // Same device reactivation -> PASS
      if (role === 'superadmin') {
        license.status = 'ACTIVE';
      }
      license.lastSeenAt = timestamp;
      license.updatedAt = timestamp;
      _logAuditEvent({
        institutionId,
        eventType: 'LICENSE_ACTIVATED',
        details: `Re-activated license on same device ${fp}`,
        performedBy: callerToken.uid || 'system'
      });

      return {
        status: 'ALREADY_ACTIVE_SAME_DEVICE',
        institutionId,
        license,
        message: 'الترخيص مفعّل بالفعل على هذا الجهاز (Same Device Re-activation).'
      };
    } else {
      // Different device attempt -> DENIED
      _logAuditEvent({
        institutionId,
        eventType: 'ACTIVATION_FAILED',
        details: `Activation attempt rejected for secondary device ${fp}. License bound to ${license.deviceFingerprintHash}`,
        performedBy: callerToken.uid || 'system'
      });
      throw new Error('DEVICE_LIMIT_EXCEEDED: عذراً، الترخيص مرتبط بجهاز أخر بالفعل (1 Device Per Center). للتغيير يرجى التواصل مع SuperAdmin.');
    }
  }

  // Bind License to Device
  const meta = { ...getSystemMetadata(deviceMeta), ...deviceMeta };
  license.status = 'ACTIVE';
  license.deviceBindingStatus = 'BOUND';
  license.activatedAt = timestamp;
  license.lastSeenAt = timestamp;
  license.deviceInstallationId = instId;
  license.deviceFingerprintHash = fp;
  license.deviceName = meta.deviceName;
  license.osVersion = meta.osVersion;
  license.appVersion = meta.appVersion;
  license.updatedAt = timestamp;

  if (!dryRun) {
    _licensesStore.set(institutionId, license);
  }

  _logAuditEvent({
    institutionId,
    eventType: 'LICENSE_ACTIVATED',
    details: `License ${license.licenseId} bound & activated on device ${fp}`,
    performedBy: callerToken.uid || 'system'
  });

  _logAuditEvent({
    institutionId,
    eventType: 'DEVICE_BOUND',
    details: `Device ${fp} bound to installation ${instId}`,
    performedBy: callerToken.uid || 'system'
  });

  return {
    status: 'LICENSE_ACTIVATED_SUCCESSFULLY',
    institutionId,
    license,
    message: 'تم تفعيل الترخيص وربط الجهاز بالمؤسسة بنجاح.'
  };
}

/**
 * Validates Center License & Device Binding at runtime
 */
async function validateCenterLicense({
  institutionId,
  deviceFingerprintHash,
  deviceInstallationId,
  institutionStatus = 'ACTIVE',
  callerToken
} = {}) {
  if (!callerToken) {
    return { valid: false, status: 'UNAUTHENTICATED', reason: 'غير موثق' };
  }

  if (institutionStatus === 'SUSPENDED') {
    return { valid: false, status: 'INSTITUTION_SUSPENDED', reason: 'تم إيقاف حساب المؤسسة من قبل الإدارة' };
  }

  const license = _licensesStore.get(institutionId);
  if (!license) {
    return { valid: false, status: 'LICENSE_NOT_FOUND', reason: 'لا يوجد ترخيص مسجل لهذه المؤسسة' };
  }

  const now = new Date();
  if (new Date(license.expiresAt) < now) {
    license.status = 'EXPIRED';
    return { valid: false, status: 'SUBSCRIPTION_EXPIRED', reason: 'انتهت صلاحية ترخيص المؤسسة' };
  }

  if (license.status === 'SUSPENDED') {
    return { valid: false, status: 'LICENSE_SUSPENDED', reason: 'ترخيص المؤسسة معلق حالياً' };
  }

  if (license.status === 'REVOKED') {
    return { valid: false, status: 'LICENSE_REVOKED', reason: `تم إلغاء ترخيص المؤسسة: ${license.revocationReason || 'قرار إداري'}` };
  }

  if (license.deviceBindingStatus === 'REVOKED') {
    return { valid: false, status: 'DEVICE_REVOKED', reason: 'تم إلغاء تفعيل هذا الجهاز من قبل إدارة المنصة' };
  }

  if (license.deviceBindingStatus !== 'BOUND') {
    return { valid: false, status: 'UNBOUND', reason: 'الترخيص غير مرتبط بجهاز حالياً (يتطلب التفعيل الأول)' };
  }

  if (license.deviceFingerprintHash !== deviceFingerprintHash) {
    return { valid: false, status: 'DEVICE_MISMATCH', reason: 'هذا الجهاز غير مصرح له بتشغيل نسخة السنتر (مرتبط بجهاز آخر)' };
  }

  return {
    valid: true,
    status: 'ACTIVE',
    licenseId: license.licenseId,
    expiresAt: license.expiresAt,
    lastSeenAt: license.lastSeenAt,
    deviceInstallationId: license.deviceInstallationId
  };
}

/**
 * Gets details of a specific institution license
 */
async function getCenterLicense({ institutionId, callerToken } = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Missing authentication token.');
  }

  if (callerToken.role !== 'superadmin' && callerToken.institutionId !== institutionId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot view license of another institution.');
  }

  const license = _licensesStore.get(institutionId);
  if (!license) {
    throw new Error('LICENSE_NOT_FOUND: No license found for target institution.');
  }

  return license;
}

/**
 * Lists all center licenses across all institutions (SuperAdmin Only)
 */
async function listCenterLicenses({ callerToken } = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Missing authentication token.');
  }

  if (callerToken.role !== 'superadmin') {
    throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list center licenses.');
  }

  return Array.from(_licensesStore.values());
}

/**
 * Suspends a Center License (SuperAdmin Only)
 */
async function suspendCenterLicense({ institutionId, reason = 'Administrative Suspension', callerToken, dryRun = false } = {}) {
  if (!callerToken) throw new Error('UNAUTHENTICATED: Missing authentication token.');
  if (callerToken.role !== 'superadmin') throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can suspend center licenses.');

  const license = _licensesStore.get(institutionId);
  if (!license) throw new Error('LICENSE_NOT_FOUND: No license found.');

  const timestamp = new Date().toISOString();
  license.status = 'SUSPENDED';
  license.revocationReason = reason;
  license.updatedAt = timestamp;

  if (!dryRun) _licensesStore.set(institutionId, license);

  _logAuditEvent({
    institutionId,
    eventType: 'LICENSE_SUSPENDED',
    details: `License ${license.licenseId} suspended by SuperAdmin. Reason: ${reason}`,
    performedBy: callerToken.uid || 'superadmin'
  });

  return { status: 'LICENSE_SUSPENDED_SUCCESSFULLY', license };
}

/**
 * Revokes a Center License & Device Binding (SuperAdmin Only)
 */
async function revokeCenterLicense({ institutionId, reason = 'Revoked by SuperAdmin', callerToken, dryRun = false } = {}) {
  if (!callerToken) throw new Error('UNAUTHENTICATED: Missing authentication token.');
  if (callerToken.role !== 'superadmin') throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can revoke center licenses.');

  const license = _licensesStore.get(institutionId);
  if (!license) throw new Error('LICENSE_NOT_FOUND: No license found.');

  const timestamp = new Date().toISOString();
  license.status = 'REVOKED';
  license.deviceBindingStatus = 'REVOKED';
  license.revokedAt = timestamp;
  license.revocationReason = reason;
  license.updatedAt = timestamp;

  if (!dryRun) _licensesStore.set(institutionId, license);

  _logAuditEvent({
    institutionId,
    eventType: 'LICENSE_REVOKED',
    details: `License ${license.licenseId} revoked by SuperAdmin. Reason: ${reason}`,
    performedBy: callerToken.uid || 'superadmin'
  });

  return { status: 'LICENSE_REVOKED_SUCCESSFULLY', license };
}

/**
 * Renews / Extends expiration date of a Center License (SuperAdmin Only)
 */
async function renewCenterLicense({ institutionId, extensionDays = 365, callerToken, dryRun = false } = {}) {
  if (!callerToken) throw new Error('UNAUTHENTICATED: Missing authentication token.');
  if (callerToken.role !== 'superadmin') throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can renew center licenses.');

  const license = _licensesStore.get(institutionId);
  if (!license) throw new Error('LICENSE_NOT_FOUND: No license found.');

  const currentExpiry = new Date(license.expiresAt).getTime() > Date.now() ? new Date(license.expiresAt) : new Date();
  const newExpiry = new Date(currentExpiry.getTime() + extensionDays * 86400000);
  const timestamp = new Date().toISOString();

  license.expiresAt = newExpiry.toISOString();
  if (license.status === 'EXPIRED') license.status = 'ACTIVE';
  license.updatedAt = timestamp;

  if (!dryRun) _licensesStore.set(institutionId, license);

  _logAuditEvent({
    institutionId,
    eventType: 'LICENSE_RENEWED',
    details: `License ${license.licenseId} renewed for ${extensionDays} days until ${newExpiry.toISOString()}`,
    performedBy: callerToken.uid || 'superadmin'
  });

  return { status: 'LICENSE_RENEWED_SUCCESSFULLY', license };
}

/**
 * Unbinds active device binding allowing re-binding (SuperAdmin Only)
 */
async function unbindDevice({ institutionId, reason = 'Authorized Hardware Reset', callerToken, dryRun = false } = {}) {
  if (!callerToken) throw new Error('UNAUTHENTICATED: Missing authentication token.');
  if (callerToken.role !== 'superadmin') throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can unbind center devices.');

  const license = _licensesStore.get(institutionId);
  if (!license) throw new Error('LICENSE_NOT_FOUND: No license found.');

  const prevFp = license.deviceFingerprintHash;
  const timestamp = new Date().toISOString();

  license.deviceBindingStatus = 'UNBOUND';
  license.deviceFingerprintHash = null;
  license.deviceInstallationId = null;
  license.updatedAt = timestamp;

  if (!dryRun) _licensesStore.set(institutionId, license);

  _logAuditEvent({
    institutionId,
    eventType: 'DEVICE_UNBOUND',
    details: `Device ${prevFp} unbound from license ${license.licenseId}. Reason: ${reason}`,
    performedBy: callerToken.uid || 'superadmin'
  });

  return { status: 'DEVICE_UNBOUND_SUCCESSFULLY', license };
}

/**
 * Forces immediate deactivation of center device (SuperAdmin Only)
 */
async function forceDeactivateDevice({ institutionId, reason = 'Force Deactivation Requested', callerToken, dryRun = false } = {}) {
  return revokeCenterLicense({ institutionId, reason, callerToken, dryRun });
}

/**
 * Returns current device binding & license status for an institution
 */
async function getDeviceStatus({ institutionId, deviceFingerprintHash, callerToken } = {}) {
  return validateCenterLicense({ institutionId, deviceFingerprintHash, callerToken });
}

function _logAuditEvent({ institutionId, eventType, details, performedBy }) {
  _auditLogsStore.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    institutionId,
    eventType,
    details,
    performedBy,
    timestamp: new Date().toISOString()
  });
}

function getAuditLogsStore(institutionId) {
  if (!institutionId) return _auditLogsStore;
  return _auditLogsStore.filter(l => l.institutionId === institutionId);
}

module.exports = {
  TARGET_PROJECT_ID,
  resetLicenseStore,
  createCenterLicense,
  activateCenterLicense,
  validateCenterLicense,
  getCenterLicense,
  listCenterLicenses,
  suspendCenterLicense,
  revokeCenterLicense,
  renewCenterLicense,
  unbindDevice,
  forceDeactivateDevice,
  getDeviceStatus,
  getAuditLogsStore
};
