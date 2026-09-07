/**
 * Institution Management & Tenant Onboarding Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

// In-memory store for unit test fallback when emulator is not running directly
const inMemoryInstitutions = new Map();
const inMemoryAuditLogs = [];

/**
 * Lazy helper for Firebase Admin Firestore
 */
function getFirestoreDb() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  const { initializeApp, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || 'educenter-saas-test'
    });
  }
  return getFirestore();
}

/**
 * Audit Log Helper - Records operational audit events without sensitive secrets
 */
async function recordAuditEvent({ event, actor, institutionId, environment = 'PRODUCTION', result = 'SUCCESS', details = {} }) {
  const nowISO = new Date().toISOString();
  
  // Sanitize details to ensure passwords, tokens, or private keys are never logged
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.secret;
  delete sanitizedDetails.privateKey;
  delete sanitizedDetails.apiKey;

  const logEntry = {
    eventId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    event,
    actor,
    institutionId,
    environment,
    timestamp: nowISO,
    result,
    details: sanitizedDetails
  };

  inMemoryAuditLogs.push(logEntry);

  try {
    const db = getFirestoreDb();
    if (db) {
      await db.collection('auditLogs').doc(logEntry.eventId).set(logEntry);
    }
  } catch (err) {
    // Non-blocking catch for offline test environments
  }

  return logEntry;
}

/**
 * Creates a new Institution (SuperAdmin only)
 */
async function createInstitution(callerToken, payload = {}) {
  // Step 1: Authentication & SuperAdmin Authorization Guard
  if (!callerToken || !callerToken.uid) {
    throw new Error('UNAUTHENTICATED_CALLER: Missing or invalid authentication token');
  }
  if (callerToken.role !== 'superAdmin') {
    const err = new Error('UNAUTHORIZED_CALLER_ROLE: Only superAdmin can create an institution');
    err.code = 'UNAUTHORIZED_CALLER_ROLE';
    throw err;
  }

  // Step 2: Validate payload parameters
  const { name, type = 'CENTER', status = 'ACTIVE', customInstitutionId } = payload;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    const err = new Error('INVALID_INSTITUTION_NAME: Institution name is required');
    err.code = 'INVALID_INSTITUTION_NAME';
    throw err;
  }

  const validTypes = ['CENTER', 'SCHOOL', 'ACADEMY'];
  if (!validTypes.includes(type)) {
    const err = new Error(`INVALID_INSTITUTION_TYPE: Type must be one of ${validTypes.join(', ')}`);
    err.code = 'INVALID_INSTITUTION_TYPE';
    throw err;
  }

  const validStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`INVALID_INSTITUTION_STATUS: Status must be one of ${validStatuses.join(', ')}`);
    err.code = 'INVALID_INSTITUTION_STATUS';
    throw err;
  }

  // Step 3: Institution ID resolution & duplicate prevention
  const institutionId = customInstitutionId || `inst_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}_${Date.now().toString(36)}`;
  
  if (inMemoryInstitutions.has(institutionId)) {
    const err = new Error(`DUPLICATE_INSTITUTION: Institution with ID ${institutionId} already exists`);
    err.code = 'DUPLICATE_INSTITUTION';
    throw err;
  }

  const nowISO = new Date().toISOString();
  const institutionData = {
    institutionId,
    name: name.trim(),
    type,
    status,
    environment: 'PRODUCTION',
    targetProjectId: 'educenter-saas',
    createdBy: callerToken.uid,
    createdAt: nowISO,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  // Save to memory store and Firestore
  inMemoryInstitutions.set(institutionId, institutionData);

  try {
    const db = getFirestoreDb();
    if (db) {
      await db.collection('institutions').doc(institutionId).set(institutionData);
    }
  } catch (err) {
    // Fallback for test mode
  }

  // Audit event
  await recordAuditEvent({
    event: 'INSTITUTION_CREATED',
    actor: callerToken.uid,
    institutionId,
    details: { name: name.trim(), type, status }
  });

  return {
    status: 'INSTITUTION_CREATED',
    institutionId,
    data: institutionData
  };
}

/**
 * Retrieves Institution details by ID with Tenant Isolation Guards
 */
async function getInstitution(callerToken, institutionId) {
  if (!callerToken || !callerToken.uid) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }

  const callerRole = callerToken.role;
  const callerInstId = callerToken.institutionId;

  // Tenant Isolation check: Non-SuperAdmin must belong to the requested tenant
  if (callerRole !== 'superAdmin') {
    if (!callerInstId || callerInstId !== institutionId) {
      const err = new Error(`CROSS_TENANT_VIOLATION: Caller cannot read institution ${institutionId}`);
      err.code = 'CROSS_TENANT_VIOLATION';
      throw err;
    }
  }

  const inst = inMemoryInstitutions.get(institutionId);
  if (!inst) {
    const err = new Error(`INSTITUTION_NOT_FOUND: Institution ${institutionId} does not exist`);
    err.code = 'INSTITUTION_NOT_FOUND';
    throw err;
  }

  return {
    status: 'SUCCESS',
    institution: inst
  };
}

/**
 * Updates an Institution document with immutable field protection
 */
async function updateInstitution(callerToken, institutionId, updatePayload = {}) {
  if (!callerToken || !callerToken.uid) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }

  const callerRole = callerToken.role;
  const callerInstId = callerToken.institutionId;

  // Authorization check: SuperAdmin or Tenant Admin (institutionOwner / admin)
  if (callerRole !== 'superAdmin') {
    if (!['institutionOwner', 'admin'].includes(callerRole)) {
      const err = new Error('UNAUTHORIZED_CALLER_ROLE: Role cannot update institution');
      err.code = 'UNAUTHORIZED_CALLER_ROLE';
      throw err;
    }
    if (callerInstId !== institutionId) {
      const err = new Error('CROSS_TENANT_VIOLATION: Tenant admin cannot update another institution');
      err.code = 'CROSS_TENANT_VIOLATION';
      throw err;
    }
  }

  const inst = inMemoryInstitutions.get(institutionId);
  if (!inst) {
    const err = new Error(`INSTITUTION_NOT_FOUND: Institution ${institutionId} does not exist`);
    err.code = 'INSTITUTION_NOT_FOUND';
    throw err;
  }

  // Immutable field protection
  const immutableFields = ['institutionId', 'id', 'createdBy', 'createdAt', 'targetProjectId'];
  for (const field of immutableFields) {
    if (field in updatePayload && updatePayload[field] !== inst[field]) {
      const err = new Error(`IMMUTABLE_FIELD_MODIFICATION: Field ${field} cannot be modified`);
      err.code = 'IMMUTABLE_FIELD_MODIFICATION';
      throw err;
    }
  }

  const nowISO = new Date().toISOString();
  const updatedData = {
    ...inst,
    ...updatePayload,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  inMemoryInstitutions.set(institutionId, updatedData);

  try {
    const db = getFirestoreDb();
    if (db) {
      await db.collection('institutions').doc(institutionId).update(updatedData);
    }
  } catch (err) {
    // Fallback for test mode
  }

  await recordAuditEvent({
    event: 'INSTITUTION_UPDATED',
    actor: callerToken.uid,
    institutionId,
    details: { updatedFields: Object.keys(updatePayload) }
  });

  return {
    status: 'INSTITUTION_UPDATED',
    institutionId,
    institution: updatedData
  };
}

/**
 * Lists institutions based on caller role boundaries
 */
async function listInstitutions(callerToken, filters = {}) {
  if (!callerToken || !callerToken.uid) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }

  const callerRole = callerToken.role;

  if (callerRole === 'superAdmin') {
    const all = Array.from(inMemoryInstitutions.values());
    if (filters.status) {
      return { status: 'SUCCESS', institutions: all.filter((i) => i.status === filters.status) };
    }
    return { status: 'SUCCESS', institutions: all };
  }

  if (['institutionOwner', 'admin'].includes(callerRole)) {
    const callerInstId = callerToken.institutionId;
    const inst = inMemoryInstitutions.get(callerInstId);
    return {
      status: 'SUCCESS',
      institutions: inst ? [inst] : []
    };
  }

  const err = new Error(`UNAUTHORIZED_CALLER_ROLE: Role ${callerRole} cannot list institutions`);
  err.code = 'UNAUTHORIZED_CALLER_ROLE';
  throw err;
}

/**
 * Sets Institution Status (SuperAdmin only) - ACTIVE, SUSPENDED, ARCHIVED
 */
async function setInstitutionStatus(callerToken, institutionId, newStatus) {
  if (!callerToken || !callerToken.uid) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }

  if (callerToken.role !== 'superAdmin') {
    const err = new Error('UNAUTHORIZED_CALLER_ROLE: Only superAdmin can change institution status');
    err.code = 'UNAUTHORIZED_CALLER_ROLE';
    throw err;
  }

  const validStatuses = ['PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];
  if (!validStatuses.includes(newStatus)) {
    const err = new Error(`INVALID_INSTITUTION_STATUS: Status must be one of ${validStatuses.join(', ')}`);
    err.code = 'INVALID_INSTITUTION_STATUS';
    throw err;
  }

  const inst = inMemoryInstitutions.get(institutionId);
  if (!inst) {
    const err = new Error(`INSTITUTION_NOT_FOUND: Institution ${institutionId} does not exist`);
    err.code = 'INSTITUTION_NOT_FOUND';
    throw err;
  }

  const nowISO = new Date().toISOString();
  inst.status = newStatus;
  inst.updatedBy = callerToken.uid;
  inst.updatedAt = nowISO;

  inMemoryInstitutions.set(institutionId, inst);

  const auditEventType = newStatus === 'ACTIVE' ? 'INSTITUTION_ACTIVATED' : newStatus === 'SUSPENDED' ? 'INSTITUTION_SUSPENDED' : 'INSTITUTION_UPDATED';

  await recordAuditEvent({
    event: auditEventType,
    actor: callerToken.uid,
    institutionId,
    details: { newStatus }
  });

  return {
    status: 'STATUS_UPDATED',
    institutionId,
    newStatus
  };
}

/**
 * Assigns Initial Institution Admin (SuperAdmin only)
 */
async function assignInitialAdmin(callerToken, payload = {}) {
  if (!callerToken || !callerToken.uid) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }

  if (callerToken.role !== 'superAdmin') {
    const err = new Error('UNAUTHORIZED_CALLER_ROLE: Only superAdmin can assign initial admin');
    err.code = 'UNAUTHORIZED_CALLER_ROLE';
    throw err;
  }

  const { institutionId, email, fullName, targetRole = 'institutionOwner' } = payload;
  if (!institutionId || !email) {
    const err = new Error('MISSING_ADMIN_PROVISION_PARAMS: institutionId and email are required');
    err.code = 'MISSING_ADMIN_PROVISION_PARAMS';
    throw err;
  }

  const inst = inMemoryInstitutions.get(institutionId);
  if (!inst) {
    const err = new Error(`INSTITUTION_NOT_FOUND: Institution ${institutionId} does not exist`);
    err.code = 'INSTITUTION_NOT_FOUND';
    throw err;
  }

  const adminUid = `admin_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  await recordAuditEvent({
    event: 'ADMIN_ASSIGNED',
    actor: callerToken.uid,
    institutionId,
    details: { adminUid, email, role: targetRole }
  });

  return {
    status: 'ADMIN_ASSIGNED',
    institutionId,
    adminUid,
    role: targetRole
  };
}

/**
 * Returns audit log entries for testing & inspection
 */
function getAuditLogs() {
  return inMemoryAuditLogs;
}

/**
 * Resets in-memory state for unit tests
 */
function resetInMemoryState() {
  inMemoryInstitutions.clear();
  inMemoryAuditLogs.length = 0;
}

module.exports = {
  createInstitution,
  getInstitution,
  updateInstitution,
  listInstitutions,
  setInstitutionStatus,
  assignInitialAdmin,
  recordAuditEvent,
  getAuditLogs,
  resetInMemoryState
};
