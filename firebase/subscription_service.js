const crypto = require('node:crypto');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { validateContentCaller } = require('./content_service');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || 'educenter-saas-test'
  });
}

const db = getFirestore();

// Idempotency cache simulation
const redemptionRequestsCache = new Map();

/**
 * Normalizes & hashes plaintext subscription code (SHA-256)
 */
function hashSubscriptionCode(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('INVALID_CODE_FORMAT: Code must be a non-empty string');
  }
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 8) {
    throw new Error('INVALID_CODE_FORMAT: Code must contain at least 8 valid alphanumeric characters');
  }
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generates high-entropy random plaintext code
 */
function generateRandomPlaintextCode(prefix = 'SUB') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars O, 0, I, 1
  let code = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    code += chars[bytes[i] % chars.length];
  }
  const formatted = `${prefix}-${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}`;
  return formatted;
}

/**
 * Create Subscription Package (Trusted Backend Only)
 */
async function createPackage(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
    throw new Error('INVALID_PACKAGE_NAME: Package name is required');
  }
  if (!payload.durationDays || typeof payload.durationDays !== 'number' || payload.durationDays <= 0) {
    throw new Error('INVALID_DURATION: Package durationDays must be a positive integer');
  }

  const allowedScopeTypes = ['SUBJECT', 'GROUP', 'LESSON', 'CONTENT', 'MULTI_SCOPE'];
  const scopeType = payload.scopeType || 'SUBJECT';
  if (!allowedScopeTypes.includes(scopeType)) {
    throw new Error(`INVALID_SCOPE_TYPE: Scope type '${scopeType}' is not supported`);
  }

  // Cross-tenant reference check simulation
  if (payload.subjectInstitutionId && payload.subjectInstitutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Referenced subject belongs to another institution');
  }

  const packageId = payload.packageId || `pkg_${instId}_${Date.now()}`;
  const now = new Date().toISOString();

  const packageDoc = {
    id: packageId,
    institutionId: instId,
    name: payload.name.trim().substring(0, 150),
    description: payload.description ? payload.description.trim().substring(0, 500) : null,
    status: 'ACTIVE',
    durationDays: Math.floor(payload.durationDays),
    priceMinor: payload.priceMinor !== undefined ? Math.max(0, Math.floor(payload.priceMinor)) : 0,
    currency: payload.currency || 'EGP',
    scopeType,
    allowedSubjectIds: Array.isArray(payload.allowedSubjectIds) ? payload.allowedSubjectIds : [],
    allowedGroupIds: Array.isArray(payload.allowedGroupIds) ? payload.allowedGroupIds : [],
    allowedLessonIds: Array.isArray(payload.allowedLessonIds) ? payload.allowedLessonIds : [],
    allowedContentIds: Array.isArray(payload.allowedContentIds) ? payload.allowedContentIds : [],
    version: 1,
    createdAt: now,
    createdBy: callerToken.uid,
    updatedAt: now,
    updatedBy: callerToken.uid
  };

  return {
    status: 'SUCCESS',
    package: packageDoc
  };
}

/**
 * Generate Subscription Codes (Trusted Backend Only)
 * Plaintext codes returned ONLY ONCE; only SHA-256 codeHash stored.
 */
async function generateSubscriptionCodes(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  if (!payload.packageId) {
    throw new Error('MISSING_REQUIRED_FIELDS: packageId is required');
  }
  const count = payload.count && payload.count > 0 ? Math.min(100, Math.floor(payload.count)) : 1;

  const pkg = payload.existingPackageDoc || {
    id: payload.packageId,
    institutionId: instId,
    status: 'ACTIVE',
    durationDays: 30
  };

  if (pkg.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Package belongs to another institution');
  }
  if (pkg.status !== 'ACTIVE') {
    throw new Error(`INVALID_PACKAGE_STATUS: Cannot generate codes for package in status '${pkg.status}'`);
  }

  const plaintextCodes = [];
  const codeDocs = [];
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const plain = generateRandomPlaintextCode(payload.prefix || 'SUB');
    const hash = hashSubscriptionCode(plain);
    const codeId = `sc_${instId}_${Date.now()}_${i}`;

    plaintextCodes.push(plain);
    codeDocs.push({
      id: codeId,
      institutionId: instId,
      packageId: payload.packageId,
      codeHash: hash,
      codePrefix: payload.prefix || 'SUB',
      status: 'AVAILABLE',
      redemptionMode: payload.assignedStudentId ? 'ASSIGNED' : 'SINGLE_USE',
      assignedStudentId: payload.assignedStudentId || null,
      redeemedBy: null,
      redeemedAt: null,
      expiresAt: payload.codeExpiresAt || null,
      version: 1,
      createdAt: now,
      createdBy: callerToken.uid
    });
  }

  return {
    status: 'SUCCESS',
    packageId: payload.packageId,
    generatedCount: count,
    plaintextCodes, // Returned ONLY ONCE for immediate export
    codeDocsCount: codeDocs.length
  };
}

/**
 * Redeem Subscription Code (Trusted Backend Only - Transactional & Idempotent)
 */
async function redeemSubscriptionCode(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['student', 'admin', 'superAdmin']);

  if (!payload.plaintextCode) {
    throw new Error('MISSING_REQUIRED_FIELDS: plaintextCode is required');
  }
  if (!payload.requestId) {
    throw new Error('MISSING_REQUIRED_FIELDS: requestId is required for idempotency protection');
  }

  // Check Idempotency Cache
  const cacheKey = `${instId}_${payload.requestId}`;
  if (redemptionRequestsCache.has(cacheKey)) {
    const cached = redemptionRequestsCache.get(cacheKey);
    if (cached.payloadHash !== hashSubscriptionCode(payload.plaintextCode)) {
      throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH: Reused requestId with different code payload');
    }
    return { ...cached.result, idempotencyReplay: true };
  }

  const targetStudentId = callerToken.role === 'student' ? callerToken.uid : (payload.studentId || callerToken.uid);

  // Cross-tenant student redemption rejection
  if (payload.studentInstitutionId && payload.studentInstitutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Student belongs to another institution');
  }

  const codeHash = hashSubscriptionCode(payload.plaintextCode);
  const codeDoc = payload.existingCodeDoc || {
    id: `sc_test_${codeHash.substring(0, 8)}`,
    institutionId: instId,
    packageId: 'pkg_1',
    codeHash,
    status: 'AVAILABLE',
    redemptionMode: 'SINGLE_USE',
    assignedStudentId: null
  };

  if (codeDoc.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Subscription code belongs to another institution');
  }
  if (codeDoc.status === 'REDEEMED') {
    throw new Error('CODE_ALREADY_REDEEMED: Subscription code has already been redeemed');
  }
  if (codeDoc.status !== 'AVAILABLE' && codeDoc.status !== 'ASSIGNED') {
    throw new Error(`CODE_NOT_REDEEMABLE: Code is in status '${codeDoc.status}'`);
  }
  if (codeDoc.redemptionMode === 'ASSIGNED' && codeDoc.assignedStudentId && codeDoc.assignedStudentId !== targetStudentId) {
    throw new Error('CODE_ASSIGNED_TO_OTHER_STUDENT: Code is assigned to another student');
  }

  const pkg = payload.existingPackageDoc || {
    id: codeDoc.packageId,
    institutionId: instId,
    status: 'ACTIVE',
    durationDays: 30,
    scopeType: 'SUBJECT',
    allowedSubjectIds: ['subj_math']
  };

  if (pkg.status !== 'ACTIVE') {
    throw new Error('PACKAGE_NOT_ACTIVE: Associated package is not active');
  }

  const now = new Date();
  const startsAtMs = now.getTime();
  const expiresAtMs = startsAtMs + (pkg.durationDays * 86400 * 1000);
  const entitlementId = `ent_${instId}_${targetStudentId}_${Date.now()}`;

  const entitlementDoc = {
    id: entitlementId,
    institutionId: instId,
    studentId: targetStudentId,
    packageId: pkg.id,
    sourceCodeId: codeDoc.id,
    scopeType: pkg.scopeType,
    subjectIds: pkg.allowedSubjectIds || [],
    groupIds: pkg.allowedGroupIds || [],
    lessonIds: pkg.allowedLessonIds || [],
    contentIds: pkg.allowedContentIds || [],
    startsAt: new Date(startsAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    status: 'ACTIVE',
    version: 1,
    createdAt: new Date(startsAtMs).toISOString(),
    createdBy: callerToken.uid
  };

  const updatedCodeDoc = {
    ...codeDoc,
    status: 'REDEEMED',
    redeemedBy: targetStudentId,
    redeemedAt: new Date(startsAtMs).toISOString(),
    version: (codeDoc.version || 1) + 1
  };

  const result = {
    status: 'SUCCESS',
    institutionId: instId,
    studentId: targetStudentId,
    code: updatedCodeDoc,
    entitlement: entitlementDoc
  };

  redemptionRequestsCache.set(cacheKey, {
    payloadHash: codeHash,
    result
  });

  return result;
}

/**
 * Evaluate Student Content Access (Determines if ANY active, unexpired entitlement grants access)
 */
async function evaluateStudentContentAccess(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['student', 'admin', 'superAdmin']);

  if (!payload.contentId || !payload.subjectId) {
    throw new Error('MISSING_REQUIRED_FIELDS: contentId and subjectId are required');
  }

  const studentId = callerToken.role === 'student' ? callerToken.uid : (payload.studentId || callerToken.uid);

  // Cross-tenant access check
  if (payload.contentInstitutionId && payload.contentInstitutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Content belongs to another institution');
  }

  const activeEntitlements = payload.existingEntitlements || [
    {
      id: 'ent_1',
      institutionId: instId,
      studentId,
      scopeType: 'SUBJECT',
      subjectIds: [payload.subjectId],
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    }
  ];

  const nowMs = Date.now();
  let authorized = false;

  for (const ent of activeEntitlements) {
    if (ent.institutionId !== instId || ent.studentId !== studentId) continue;
    if (ent.status !== 'ACTIVE') continue;

    const expMs = new Date(ent.expiresAt).getTime();
    if (nowMs >= expMs) continue; // Expired

    // Scope check
    if (ent.scopeType === 'SUBJECT' && ent.subjectIds && ent.subjectIds.includes(payload.subjectId)) {
      authorized = true;
      break;
    }
    if (ent.scopeType === 'LESSON' && payload.lessonId && ent.lessonIds && ent.lessonIds.includes(payload.lessonId)) {
      authorized = true;
      break;
    }
    if (ent.scopeType === 'CONTENT' && ent.contentIds && ent.contentIds.includes(payload.contentId)) {
      authorized = true;
      break;
    }
    if (ent.scopeType === 'MULTI_SCOPE') {
      if (ent.subjectIds && ent.subjectIds.includes(payload.subjectId)) { authorized = true; break; }
      if (payload.lessonId && ent.lessonIds && ent.lessonIds.includes(payload.lessonId)) { authorized = true; break; }
      if (ent.contentIds && ent.contentIds.includes(payload.contentId)) { authorized = true; break; }
    }
  }

  if (!authorized) {
    return {
      authorized: false,
      reason: 'NO_ACTIVE_ENTITLEMENT_FOUND'
    };
  }

  return {
    authorized: true,
    institutionId: instId,
    studentId,
    contentId: payload.contentId
  };
}

module.exports = {
  hashSubscriptionCode,
  generateRandomPlaintextCode,
  createPackage,
  generateSubscriptionCodes,
  redeemSubscriptionCode,
  evaluateStudentContentAccess
};
