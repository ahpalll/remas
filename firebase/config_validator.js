/**
 * Production Environment Configuration & Audit Logging Validation Layer
 * REMAS Educational Center SaaS Monorepo
 */

const ALLOWED_ENVIRONMENTS = ['DEV', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'];

/**
 * Normalizes environment string to uppercase canonical format: DEV, STAGING, PRODUCTION
 */
function normalizeEnvironment(env) {
  if (!env || typeof env !== 'string') return 'INVALID';
  const u = env.trim().toUpperCase();
  if (u === 'DEVELOPMENT' || u === 'DEV') return 'DEV';
  if (u === 'STAGING') return 'STAGING';
  if (u === 'PRODUCTION' || u === 'PROD') return 'PRODUCTION';
  return 'INVALID';
}

/**
 * Validates environment configuration object.
 * Throws structured error with code if configuration is missing or invalid.
 */
function validateEnvironmentConfig(envInput, config = {}) {
  const normEnv = normalizeEnvironment(envInput);
  if (normEnv === 'INVALID') {
    const err = new Error(`Invalid environment: ${envInput}`);
    err.code = 'INVALID_ENVIRONMENT';
    throw err;
  }

  if (normEnv === 'PRODUCTION') {
    if (!config || Object.keys(config).length === 0) {
      const err = new Error('Production environment config object is completely missing');
      err.code = 'MISSING_PRODUCTION_CONFIG';
      throw err;
    }

    // Validate Firebase Config
    if (!config.firebase || !config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey) {
      const err = new Error('Production Firebase configuration is missing or incomplete');
      err.code = 'MISSING_FIREBASE_CONFIG';
      throw err;
    }

    // Validate Cloudflare Config
    if (!config.cloudflare || !config.cloudflare.accountId || !config.cloudflare.apiToken) {
      const err = new Error('Production Cloudflare configuration is missing or incomplete');
      err.code = 'MISSING_CLOUDFLARE_CONFIG';
      throw err;
    }

    // Validate R2 Config
    if (!config.r2 || !config.r2.bucketName || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
      const err = new Error('Production R2 storage configuration is missing or incomplete');
      err.code = 'MISSING_R2_CONFIG';
      throw err;
    }

    // Validate FCM Config
    if (!config.fcm || !config.fcm.serverKey) {
      const err = new Error('Production FCM configuration is missing or incomplete');
      err.code = 'MISSING_FCM_CONFIG';
      throw err;
    }
  } else if (normEnv === 'STAGING') {
    if (config.firebase && !config.firebase.projectId) {
      const err = new Error('Staging Firebase configuration missing projectId');
      err.code = 'MISSING_FIREBASE_CONFIG';
      throw err;
    }
  }

  return {
    valid: true,
    environment: normEnv,
    timestamp: new Date().toISOString()
  };
}

/**
 * Sensitive fields regex for log redaction
 */
const SENSITIVE_KEY_PATTERN = /password|secret|token|bearer|private_key|privatekey|authorization|code/i;

/**
 * Recursively sanitizes objects to prevent secret leakage in log streams.
 */
function sanitizeLogPayload(payload) {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string') {
    // Redact JWT tokens or long bearer strings if matched
    if (/^Bearer\s+[A-Za-z0-9\-_.]+/i.test(payload) || /^eyJ[A-Za-z0-9\-_.]+/i.test(payload)) {
      return '[REDACTED_TOKEN]';
    }
    return payload;
  }
  if (typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map(sanitizeLogPayload);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogPayload(value);
    }
  }
  return sanitized;
}

/**
 * Valid audit event types for system observability
 */
const VALID_AUDIT_EVENT_TYPES = [
  'LOGIN_FAILURE',
  'LOGIN_SUCCESS',
  'SUBSCRIPTION_REDEEMED',
  'ENTITLEMENT_CREATED',
  'ENTITLEMENT_REVOKED',
  'MEDIA_ACCESS_DENIED',
  'MEDIA_ACCESS_GRANTED',
  'PARENT_CHILD_ACCESS_DENIED',
  'CROSS_TENANT_ACCESS_DENIED',
  'NOTIFICATION_SENT',
  'NOTIFICATION_FAILED'
];

/**
 * Creates a Production-Safe Audit Logger
 */
function createProductionLogger(envInput = 'DEV', logSink = null) {
  const normEnv = normalizeEnvironment(envInput);
  const sink = logSink || ((entry) => console.log(JSON.stringify(entry)));

  return {
    logAuditEvent(eventType, { tenantId = null, actorId = null, correlationId = null, details = {} } = {}) {
      if (!VALID_AUDIT_EVENT_TYPES.includes(eventType)) {
        throw new Error(`Invalid audit event type: ${eventType}`);
      }

      const entry = {
        timestamp: new Date().toISOString(),
        environment: normEnv,
        eventType,
        tenantId,
        actorId,
        correlationId: correlationId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        details: sanitizeLogPayload(details)
      };

      sink(entry);
      return entry;
    }
  };
}

module.exports = {
  normalizeEnvironment,
  validateEnvironmentConfig,
  sanitizeLogPayload,
  createProductionLogger,
  VALID_AUDIT_EVENT_TYPES
};
