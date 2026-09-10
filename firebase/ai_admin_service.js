/**
 * SuperAdmin AI Management & Center AI Controls Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 * Supports: Google Gemini & OpenRouter Multi-Provider Architecture
 */

const {
  getAISettingsMetadata,
  testGeminiKeyConnection,
  testOpenRouterKeyConnection,
  rotateGeminiKey,
  rotateOpenRouterKey,
  disableAI: disableAISecret,
  enableAI: enableAISecret,
  setProviderRouting,
  setProviderModel
} = require('./ai_secret_provider');

// In-Memory & Firestore Center AI Preferences Store
const CENTER_AI_CONFIG_STORE = new Map();

// In-Memory Audit Event Log Store for AI Admin operations
const AI_ADMIN_AUDIT_LOGS = [];

// In-Memory Usage Tracker Store
const AI_USAGE_STATS_STORE = [];

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
 * Retrieves SuperAdmin Global Multi-Provider AI Settings
 * SuperAdmin Only
 */
async function getSuperAdminAISettings(callerToken) {
  assertSuperAdminRole(callerToken);
  const metadata = getAISettingsMetadata();
  return {
    success: true,
    primaryProvider: metadata.primaryProvider,
    fallbackProvider: metadata.fallbackProvider,
    status: metadata.status,
    provider: metadata.provider,
    model: metadata.model,
    keyMasked: metadata.keyMasked,
    hasActiveKey: metadata.hasActiveKey,
    gemini: metadata.gemini,
    openrouter: metadata.openrouter
  };
}

/**
 * Tests live connection to Google Gemini or OpenRouter API
 * SuperAdmin Only
 */
async function testAIConnection(callerToken, { provider = 'gemini', candidateKey = null, model = null } = {}) {
  assertSuperAdminRole(callerToken);

  let testRes;
  if (provider === 'openrouter') {
    testRes = await testOpenRouterKeyConnection(candidateKey, model);
  } else {
    testRes = await testGeminiKeyConnection(candidateKey, model);
  }

  recordAIAuditEvent({
    eventType: 'AI_KEY_TESTED',
    actorId: callerToken.uid,
    result: testRes.success ? 'SUCCESS' : 'FAILED',
    details: {
      provider,
      status: testRes.status,
      message: testRes.message,
      isCandidateKey: !!candidateKey
    }
  });

  return testRes;
}

/**
 * Executes Safe Zero-Downtime Key Rotation for Gemini or OpenRouter
 * SuperAdmin Only
 */
async function rotateAIKey(callerToken, { provider = 'gemini', candidateKey, model = null } = {}) {
  assertSuperAdminRole(callerToken);

  let rotationRes;
  if (provider === 'openrouter') {
    rotationRes = await rotateOpenRouterKey(candidateKey, model, callerToken.uid);
  } else {
    rotationRes = await rotateGeminiKey(candidateKey, callerToken.uid);
  }

  recordAIAuditEvent({
    eventType: rotationRes.success ? 'AI_KEY_REPLACED' : 'AI_KEY_ROTATION_FAILED',
    actorId: callerToken.uid,
    result: rotationRes.success ? 'SUCCESS' : 'FAILED',
    details: {
      provider,
      status: rotationRes.status,
      message: rotationRes.message,
      keyMasked: rotationRes.keyMasked || 'N/A',
      activeKeyPreserved: rotationRes.activeKeyPreserved
    }
  });

  return rotationRes;
}

/**
 * Updates Primary and Fallback Provider Routing
 * SuperAdmin Only
 */
async function updateAIRouting(callerToken, { primaryProvider, fallbackProvider }) {
  assertSuperAdminRole(callerToken);

  const res = setProviderRouting({ primaryProvider, fallbackProvider }, callerToken.uid);

  recordAIAuditEvent({
    eventType: 'AI_PROVIDER_CHANGED',
    actorId: callerToken.uid,
    result: 'SUCCESS',
    details: { primaryProvider, fallbackProvider }
  });

  return res;
}

/**
 * Updates Model for specific Provider
 * SuperAdmin Only
 */
async function updateProviderModelConfig(callerToken, { provider, model }) {
  assertSuperAdminRole(callerToken);

  const res = setProviderModel(provider, model, callerToken.uid);

  recordAIAuditEvent({
    eventType: 'AI_MODEL_CHANGED',
    actorId: callerToken.uid,
    result: 'SUCCESS',
    details: { provider, model }
  });

  return res;
}

/**
 * Disables AI Provider System Globally (or per provider)
 * SuperAdmin Only
 */
async function disableAI(callerToken, { provider = 'all' } = {}) {
  assertSuperAdminRole(callerToken);

  const res = disableAISecret(provider, callerToken.uid);

  recordAIAuditEvent({
    eventType: 'AI_KEY_DISABLED',
    actorId: callerToken.uid,
    result: 'SUCCESS',
    details: { provider, status: res.status, message: res.message }
  });

  return res;
}

/**
 * Enables AI Provider System Globally (or per provider)
 * SuperAdmin Only
 */
async function enableAI(callerToken, { provider = 'all' } = {}) {
  assertSuperAdminRole(callerToken);

  const res = enableAISecret(provider, callerToken.uid);

  recordAIAuditEvent({
    eventType: 'AI_PROVIDER_ENABLED',
    actorId: callerToken.uid,
    result: res.success ? 'SUCCESS' : 'FAILED',
    details: { provider, status: res.status, message: res.message }
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
 * NOTE: Center Admin CANNOT view or edit Gemini/OpenRouter API key!
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

/**
 * Record and retrieve AI usage statistics per provider, model, institution
 */
function recordAIUsageStat({ provider, model, institutionId, success, tokens = 0, latencyMs = 0 }) {
  AI_USAGE_STATS_STORE.push({
    id: `usg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    provider,
    model,
    institutionId,
    success,
    tokens,
    latencyMs,
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString()
  });
}

async function getAIUsageStats(callerToken, { provider, model, institutionId, date } = {}) {
  assertSuperAdminRole(callerToken);

  let filtered = [...AI_USAGE_STATS_STORE];
  if (provider) filtered = filtered.filter(s => s.provider === provider);
  if (model) filtered = filtered.filter(s => s.model === model);
  if (institutionId) filtered = filtered.filter(s => s.institutionId === institutionId);
  if (date) filtered = filtered.filter(s => s.date === date);

  const totalRequests = filtered.length;
  const successfulRequests = filtered.filter(s => s.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const totalTokens = filtered.reduce((acc, curr) => acc + (curr.tokens || 0), 0);

  return {
    success: true,
    totalRequests,
    successfulRequests,
    failedRequests,
    totalTokens,
    records: filtered.slice(0, 100)
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
  updateAIRouting,
  updateProviderModelConfig,
  disableAI,
  enableAI,
  getCenterAISettings,
  updateCenterAISettings,
  recordAIUsageStat,
  getAIUsageStats,
  getAIAuditLogs,
  AI_ADMIN_AUDIT_LOGS
};
