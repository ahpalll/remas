/**
 * Trusted Device Binding & Licensing Backend Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { generateHardwareFingerprint, validateFingerprintFormat, getSystemMetadata } = require('./device_fingerprint');

const TARGET_PROJECT_ID = 'educenter-saas';

// In-Memory Stateful Registry for Verification & Testing Engine
const _deviceBindingsStore = new Map();
const _auditLogsStore = [];

/**
 * Reset in-memory store (for unit tests)
 */
function resetStore() {
  _deviceBindingsStore.clear();
  _auditLogsStore.length = 0;
}

/**
 * Requests device activation for an institution
 */
async function requestDeviceActivation({
  institutionId,
  deviceFingerprint,
  deviceMeta = {},
  callerToken,
  dryRun = false
} = {}) {
  // 1. Authentication Check
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Request missing caller authentication token.');
  }

  // 2. Role Check (Admin or SuperAdmin required)
  const role = callerToken.role || 'unprivileged';
  if (role !== 'superadmin' && role !== 'admin' && role !== 'institutionOwner') {
    throw new Error('UNAUTHORIZED_CALLER_ROLE: Only Institution Admin or SuperAdmin can activate center devices.');
  }

  // 3. Tenant Boundary Scoping
  if (role !== 'superadmin' && callerToken.institutionId !== institutionId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot activate device for another institution.');
  }

  // 4. Fingerprint Format Validation
  const fp = deviceFingerprint || generateHardwareFingerprint(deviceMeta);
  if (!validateFingerprintFormat(fp)) {
    throw new Error('INVALID_FINGERPRINT_FORMAT: Malformed hardware fingerprint string.');
  }

  const timestamp = new Date().toISOString();
  const bindingId = `bind_${institutionId}_${Date.now()}`;

  // 5. Existing Active Binding Check (1 Device Per Center Rule)
  const activeBinding = Array.from(_deviceBindingsStore.values()).find(
    b => b.institutionId === institutionId && (b.bindingStatus === 'ACTIVE' || b.bindingStatus === 'PENDING_ACTIVATION')
  );

  if (activeBinding) {
    if (activeBinding.deviceId === fp) {
      // Same device reactivation -> PASS
      activeBinding.lastSeenAt = timestamp;
      _logAuditEvent({
        institutionId,
        eventType: 'DEVICE_BINDING_VALIDATED',
        details: `Same device re-activation confirmed for ${fp}`,
        performedBy: callerToken.uid || 'system'
      });
      return {
        status: 'ALREADY_ACTIVE_SAME_DEVICE',
        institutionId,
        binding: activeBinding,
        message: 'الجهاز مفعّل بالفعل لهذه المؤسسة (Same Device Re-activation).'
      };
    } else {
      // Different device attempt -> DENIED
      _logAuditEvent({
        institutionId,
        eventType: 'DEVICE_ACTIVATION_REJECTED',
        details: `Rejected activation attempt from secondary device ${fp}. Active device is ${activeBinding.deviceId}`,
        performedBy: callerToken.uid || 'system'
      });
      throw new Error('DEVICE_LIMIT_EXCEEDED: عذراً، تملك هذه المؤسسة جهازاً فعالاً آخر بالفعل (1 Device Per Center). للتغيير يرجى التواصل مع SuperAdmin.');
    }
  }

  // 6. Create New Device Binding
  const meta = { ...getSystemMetadata(deviceMeta), ...deviceMeta };
  const record = {
    bindingId,
    institutionId,
    deviceId: fp,
    deviceName: meta.deviceName,
    osVersion: meta.osVersion,
    appVersion: meta.appVersion,
    cpuCores: meta.cpuCores,
    totalMemoryGb: meta.totalMemoryGb,
    bindingStatus: 'ACTIVE',
    activatedAt: timestamp,
    lastSeenAt: timestamp,
    revokedAt: null,
    revocationReason: null,
    activatedByUserId: callerToken.uid || 'admin_user',
    updatedAt: timestamp
  };

  if (!dryRun) {
    _deviceBindingsStore.set(bindingId, record);
  }

  _logAuditEvent({
    institutionId,
    eventType: 'DEVICE_BOUND_SUCCESSFULLY',
    details: `Device ${fp} bound successfully to institution ${institutionId}`,
    performedBy: callerToken.uid || 'system'
  });

  return {
    status: 'DEVICE_BOUND_SUCCESSFULLY',
    institutionId,
    binding: record,
    message: 'تم تفعيل الجهاز وربطه بالمؤسسة بنجاح.'
  };
}

/**
 * Validates device binding status for runtime authorization
 */
async function validateDeviceBinding({
  institutionId,
  deviceFingerprint,
  institutionStatus = 'ACTIVE',
  subscriptionStatus = 'ACTIVE',
  callerToken
} = {}) {
  if (!callerToken) {
    return { valid: false, status: 'UNAUTHENTICATED', reason: 'غير موثق' };
  }

  // Tenant Status Check
  if (institutionStatus === 'SUSPENDED') {
    return { valid: false, status: 'INSTITUTION_SUSPENDED', reason: 'تم إيقاف حساب المؤسسة من قبل الإدارة' };
  }

  // Subscription Status Check
  if (subscriptionStatus === 'EXPIRED') {
    return { valid: false, status: 'SUBSCRIPTION_EXPIRED', reason: 'انتهت صلاحية اشتراك المؤسسة' };
  }

  const activeBinding = Array.from(_deviceBindingsStore.values()).find(
    b => b.institutionId === institutionId && b.bindingStatus === 'ACTIVE'
  );

  const revokedBinding = Array.from(_deviceBindingsStore.values()).find(
    b => b.institutionId === institutionId && b.deviceId === deviceFingerprint && b.bindingStatus === 'REVOKED'
  );

  if (revokedBinding) {
    return {
      valid: false,
      status: 'REVOKED',
      reason: `تم إلغاء تفعيل هذا الجهاز: ${revokedBinding.revocationReason || 'قرار إداري'}`,
      revokedAt: revokedBinding.revokedAt
    };
  }

  if (!activeBinding) {
    return {
      valid: false,
      status: 'UNBOUND',
      reason: 'لا يوجد جهاز مفعّل حالياً لهذه المؤسسة (يتطلب التفعيل الأول)'
    };
  }

  if (activeBinding.deviceId !== deviceFingerprint) {
    return {
      valid: false,
      status: 'DEVICE_MISMATCH',
      reason: 'هذا الجهاز غير مصرح له بتشغيل نسخة السنتر (مرتبط بجهاز آخر)'
    };
  }

  return {
    valid: true,
    status: 'ACTIVE',
    bindingId: activeBinding.bindingId,
    lastSeenAt: activeBinding.lastSeenAt,
    activatedAt: activeBinding.activatedAt
  };
}

/**
 * SuperAdmin action to revoke an active device binding
 */
async function revokeDeviceBinding({
  institutionId,
  bindingId,
  reason = 'Administrative Revocation',
  callerToken,
  dryRun = false
} = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Request missing authentication token.');
  }

  if (callerToken.role !== 'superadmin') {
    throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can revoke center device bindings.');
  }

  const targetBindingId = bindingId || Array.from(_deviceBindingsStore.values()).find(b => b.institutionId === institutionId && b.bindingStatus === 'ACTIVE')?.bindingId;

  if (!targetBindingId || !_deviceBindingsStore.has(targetBindingId)) {
    throw new Error('BINDING_NOT_FOUND: Device binding record does not exist.');
  }

  const binding = _deviceBindingsStore.get(targetBindingId);
  const timestamp = new Date().toISOString();

  binding.bindingStatus = 'REVOKED';
  binding.revokedAt = timestamp;
  binding.revocationReason = reason;
  binding.updatedAt = timestamp;

  if (!dryRun) {
    _deviceBindingsStore.set(targetBindingId, binding);
  }

  _logAuditEvent({
    institutionId,
    eventType: 'DEVICE_BINDING_REVOKED',
    details: `Device binding ${targetBindingId} revoked by SuperAdmin. Reason: ${reason}`,
    performedBy: callerToken.uid || 'superadmin'
  });

  return {
    status: 'REVOKED_SUCCESSFULLY',
    institutionId,
    binding,
    message: 'تم إلغاء تفعيل الجهاز بنجاح.'
  };
}

/**
 * SuperAdmin action to replace an active device binding with a new device
 */
async function replaceDeviceBinding({
  institutionId,
  newDeviceFingerprint,
  deviceMeta = {},
  reason = 'Hardware Replacement',
  callerToken,
  dryRun = false
} = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Request missing authentication token.');
  }

  if (callerToken.role !== 'superadmin') {
    throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can replace center device bindings.');
  }

  if (!validateFingerprintFormat(newDeviceFingerprint)) {
    throw new Error('INVALID_FINGERPRINT_FORMAT: Malformed new hardware fingerprint string.');
  }

  // Revoke previous binding if active
  const previousBinding = Array.from(_deviceBindingsStore.values()).find(
    b => b.institutionId === institutionId && b.bindingStatus === 'ACTIVE'
  );

  const timestamp = new Date().toISOString();
  if (previousBinding) {
    previousBinding.bindingStatus = 'REPLACED';
    previousBinding.revokedAt = timestamp;
    previousBinding.revocationReason = `Replaced with new device: ${reason}`;
    previousBinding.updatedAt = timestamp;
  }

  // Create new active binding
  const newBindingId = `bind_${institutionId}_${Date.now()}`;
  const meta = { ...getSystemMetadata(deviceMeta), ...deviceMeta };
  const newRecord = {
    bindingId: newBindingId,
    institutionId,
    deviceId: newDeviceFingerprint,
    deviceName: meta.deviceName,
    osVersion: meta.osVersion,
    appVersion: meta.appVersion,
    cpuCores: meta.cpuCores,
    totalMemoryGb: meta.totalMemoryGb,
    bindingStatus: 'ACTIVE',
    activatedAt: timestamp,
    lastSeenAt: timestamp,
    revokedAt: null,
    revocationReason: null,
    activatedByUserId: callerToken.uid || 'superadmin',
    updatedAt: timestamp
  };

  if (!dryRun) {
    _deviceBindingsStore.set(newBindingId, newRecord);
  }

  _logAuditEvent({
    institutionId,
    eventType: 'DEVICE_BINDING_REPLACED',
    details: `Device binding replaced for ${institutionId}. New Device: ${newDeviceFingerprint}`,
    performedBy: callerToken.uid || 'superadmin'
  });

  return {
    status: 'DEVICE_REPLACED_SUCCESSFULLY',
    institutionId,
    previousBindingId: previousBinding?.bindingId || null,
    newBinding: newRecord,
    message: 'تم استبدال تفعيل الجهاز بنجاح.'
  };
}

/**
 * Sends online heartbeat from Windows Desktop App to refresh lastSeenAt
 */
async function heartbeatDevice({
  institutionId,
  deviceFingerprint,
  appVersion,
  callerToken
} = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Missing authentication token.');
  }

  const activeBinding = Array.from(_deviceBindingsStore.values()).find(
    b => b.institutionId === institutionId && b.deviceId === deviceFingerprint && b.bindingStatus === 'ACTIVE'
  );

  if (!activeBinding) {
    const revoked = Array.from(_deviceBindingsStore.values()).find(
      b => b.institutionId === institutionId && b.deviceId === deviceFingerprint && b.bindingStatus === 'REVOKED'
    );
    if (revoked) {
      return { status: 'REVOKED', valid: false, reason: 'Device binding revoked by SuperAdmin' };
    }
    return { status: 'UNBOUND', valid: false, reason: 'No active device binding found' };
  }

  const timestamp = new Date().toISOString();
  activeBinding.lastSeenAt = timestamp;
  if (appVersion) activeBinding.appVersion = appVersion;

  return {
    status: 'HEARTBEAT_ACKNOWLEDGED',
    valid: true,
    lastSeenAt: timestamp
  };
}

/**
 * SuperAdmin listing of all registered center devices
 */
async function listAllCenterDevices({ callerToken } = {}) {
  if (!callerToken) {
    throw new Error('UNAUTHENTICATED: Missing authentication token.');
  }

  if (callerToken.role !== 'superadmin') {
    throw new Error('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list all center devices.');
  }

  return Array.from(_deviceBindingsStore.values());
}

/**
 * Retrieves audit log entries for testing & inspection
 */
function getAuditLogs(institutionId) {
  if (!institutionId) return _auditLogsStore;
  return _auditLogsStore.filter(l => l.institutionId === institutionId);
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

module.exports = {
  TARGET_PROJECT_ID,
  resetStore,
  requestDeviceActivation,
  validateDeviceBinding,
  revokeDeviceBinding,
  replaceDeviceBinding,
  heartbeatDevice,
  listAllCenterDevices,
  getAuditLogs
};
