/**
 * SuperAdmin AI Management & Center AI Controls Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const {
  getAISettingsMetadata,
  testGeminiKeyConnection,
  rotateGeminiKey,
  disableGeminiAI,
  enableGeminiAI
} = require('./ai_secret_provider');

// In-Memory & Firestore Center AI Preferences Store
const CENTER_AI_CONFIG_STORE = new Map();

// In-Memory Audit Event Log Store for AI Admin operations
const AI_ADMIN_AUDIT_LOGS = [];

function recordAIAuditEvent({ eventType, actorId, institutionId = 'GLOBAL', result, details = {} }) {
  const logEntry = {
    id: `audit_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    eventType, // AI_KEY_TESTED, AI_KEY_ACTIVATED, AI_KEY_REPLACED, AI_KEY_DISABLED, AI_PROVIDER_CHANGED, AI_MODEL_CHANGED, CENTER_AI_SETTINGS_UPDATED
    actorId,
    institutionId,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    result,
    details // MUST NOT contain raw API key!
  };
  AI_ADMIN_AUDIT_LOGS.push(logEntry);
  return logEntry;
}

/**
 * Validates SuperAdmin role access
 */
function assertSuperAdminRole(callerToken) {
  if (!callerToken || !callerToken.uid || !callerToken.role) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }
  if (callerToken.role !== 'superadmin') {
    throw new Error(`UNAUTHORIZED_ROLE: Role '${callerToken.role}' cannot manage global AI settings or keys`);
  }
}

/**
 * Retrieves SuperAdmin Global AI Settings
 * SuperAdmin Only
 */
async function getSuperAdminAISettings(callerToken) {
  assertSuperAdminRole(callerToken);
  const metadata = getAISettingsMetadata();
  return {
    success: true,
    status: metadata.status,
    provider: metadata.provider,
    model: metadata.model,
    keyMasked: metadata.keyMasked,
    hasActiveKey: metadata.hasActiveKey,
    lastTestedAt: metadata.lastTestedAt,
    lastRotatedAt: metadata.lastRotatedAt
  };
}

/**
 * Tests live connection to Google Gemini API (Active key or Candidate new key)
 * SuperAdmin Only
 */
async function testAIConnection(callerToken, { candidateKey = null } = {}) {
  assertSuperAdminRole(callerToken);

  const testRes = await testGeminiKeyConnection(candidateKey);

  recordAIAuditEvent({
    eventType: 'AI_KEY_TESTED',
    actorId: callerToken.uid,
    result: testRes.success ? 'SUCCESS' : 'FAILED',
    details: {
      status: testRes.status,
      message: testRes.message,
      isCandidateKey: !!candidateKey
    }
  });

  return testRes;
}

/**
 * Executes Safe Zero-Downtime Key Rotation
 * SuperAdmin Only
 */
async function rotateAIKey(callerToken, { candidateKey }) {
  assertSuperAdminRole(callerToken);

  const rotationRes = await rotateGeminiKey(candidateKey, callerToken.uid);

  recordAIAuditEvent({
    eventType: rotationRes.success ? 'AI_KEY_REPLACED' : 'AI_KEY_ROTATION_FAILED',
    actorId: callerToken.uid,
    result: rotationRes.success ? 'SUCCESS' : 'FAILED',
    details: {
      status: rotationRes.status,
      message: rotationRes.message,
      keyMasked: rotationRes.keyMasked || 'N/A',
      activeKeyPreserved: rotationRes.activeKeyPreserved
    }
  });

  return rotationRes;
}

/**
 * Disables AI Provider System Globally
 * SuperAdmin Only
 */
async function disableAI(callerToken) {
  assertSuperAdminRole(callerToken);

  const res = disableGeminiAI(callerToken.uid);

  recordAIAuditEvent({
    eventType: 'AI_KEY_DISABLED',
    actorId: callerToken.uid,
    result: 'SUCCESS',
    details: { status: res.status, message: res.message }
  });

  return res;
}

/**
 * Enables AI Provider System Globally
 * SuperAdmin Only
 */
async function enableAI(callerToken) {
  assertSuperAdminRole(callerToken);

  const res = enableGeminiAI(callerToken.uid);

  recordAIAuditEvent({
    eventType: 'AI_PROVIDER_ENABLED',
    actorId: callerToken.uid,
    result: res.success ? 'SUCCESS' : 'FAILED',
    details: { status: res.status, message: res.message }
  });

  return res;
}

/**
 * Retrieves Center-Specific AI Settings (Separate from Global Provider Key!)
 * SuperAdmin or Center Admin of targetInstitutionId
 */
async function getCenterAISettings(callerToken, targetInstitutionId) {
  if (!callerToken || !callerToken.uid || !callerToken.role) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }

  const isSuperAdmin = callerToken.role === 'superadmin';
  const isCenterAdmin = callerToken.role === 'admin' && callerToken.institutionId === targetInstitutionId;

  if (!isSuperAdmin && !isCenterAdmin) {
    throw new Error(`UNAUTHORIZED_ROLE: Role '${callerToken.role}' cannot access center AI settings for institution '${targetInstitutionId}'`);
  }

  const config = CENTER_AI_CONFIG_STORE.get(targetInstitutionId) || {
    institutionId: targetInstitutionId,
    aiEnabled: true,
    dailyLimitPerStudent: 50,
    allowedFeatures: ['QA', 'LESSON_EXPLAIN', 'SUMMARIZE', 'SELF_TEST', 'WEAKNESS_ANALYSIS', 'STUDY_PLAN']
  };

  return {
    success: true,
    institutionId: config.institutionId,
    aiEnabled: config.aiEnabled,
    dailyLimitPerStudent: config.dailyLimitPerStudent,
    allowedFeatures: config.allowedFeatures
  };
}

/**
 * Updates Center-Specific AI Controls (Toggle Center AI, set daily limits)
 * NOTE: Center Admin CANNOT view or edit Gemini API key!
 */
async function updateCenterAISettings(callerToken, { targetInstitutionId, aiEnabled, dailyLimitPerStudent }) {
  if (!callerToken || !callerToken.uid || !callerToken.role) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  }

  const isSuperAdmin = callerToken.role === 'superadmin';
  const isCenterAdmin = callerToken.role === 'admin' && callerToken.institutionId === targetInstitutionId;

  if (!isSuperAdmin && !isCenterAdmin) {
    throw new Error(`UNAUTHORIZED_ROLE: Role '${callerToken.role}' cannot modify center AI settings for institution '${targetInstitutionId}'`);
  }

  const current = CENTER_AI_CONFIG_STORE.get(targetInstitutionId) || {
    institutionId: targetInstitutionId,
    aiEnabled: true,
    dailyLimitPerStudent: 50,
    allowedFeatures: ['QA', 'LESSON_EXPLAIN', 'SUMMARIZE', 'SELF_TEST', 'WEAKNESS_ANALYSIS', 'STUDY_PLAN']
  };

  const updated = {
    ...current,
    aiEnabled: typeof aiEnabled === 'boolean' ? aiEnabled : current.aiEnabled,
    dailyLimitPerStudent: typeof dailyLimitPerStudent === 'number' && dailyLimitPerStudent > 0 ? dailyLimitPerStudent : current.dailyLimitPerStudent,
    updatedAt: new Date().toISOString(),
    updatedBy: callerToken.uid
  };

  CENTER_AI_CONFIG_STORE.set(targetInstitutionId, updated);

  recordAIAuditEvent({
    eventType: 'CENTER_AI_SETTINGS_UPDATED',
    actorId: callerToken.uid,
    institutionId: targetInstitutionId,
    result: 'SUCCESS',
    details: {
      aiEnabled: updated.aiEnabled,
      dailyLimitPerStudent: updated.dailyLimitPerStudent
    }
  });

  return {
    success: true,
    institutionId: targetInstitutionId,
    aiEnabled: updated.aiEnabled,
    dailyLimitPerStudent: updated.dailyLimitPerStudent,
    message: 'تم تحديث إعدادات الذكاء الاصطناعي الخاصة بالسنتر بنجاح'
  };
}

function getAIAuditLogs() {
  return [...AI_ADMIN_AUDIT_LOGS];
}

module.exports = {
  assertSuperAdminRole,
  getSuperAdminAISettings,
  testAIConnection,
  rotateAIKey,
  disableAI,
  enableAI,
  getCenterAISettings,
  updateCenterAISettings,
  getAIAuditLogs,
  AI_ADMIN_AUDIT_LOGS
};
