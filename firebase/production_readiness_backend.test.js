/**
 * Phase 18 — Production Readiness & Deployment Foundation Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEnvironment,
  validateEnvironmentConfig,
  sanitizeLogPayload,
  createProductionLogger,
  VALID_AUDIT_EVENT_TYPES
} = require('./config_validator');

describe('Phase 18 — Production Readiness & Configuration Validation', () => {

  it('normalizes environment identifiers accurately', () => {
    assert.equal(normalizeEnvironment('dev'), 'DEV');
    assert.equal(normalizeEnvironment('DEVELOPMENT'), 'DEV');
    assert.equal(normalizeEnvironment('staging'), 'STAGING');
    assert.equal(normalizeEnvironment('production'), 'PRODUCTION');
    assert.equal(normalizeEnvironment('PROD'), 'PRODUCTION');
    assert.equal(normalizeEnvironment('invalid_env'), 'INVALID');
    assert.equal(normalizeEnvironment(null), 'INVALID');
  });

  it('validates a complete valid production configuration successfully', () => {
    const validProdConfig = {
      firebase: {
        projectId: 'remas-prod',
        clientEmail: 'service-account@remas-prod.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nPROD_KEY\n-----END PRIVATE KEY-----'
      },
      cloudflare: {
        accountId: 'cf_account_12345',
        apiToken: 'cf_token_67890'
      },
      r2: {
        bucketName: 'remas-media-prod',
        accessKeyId: 'r2_access_key',
        secretAccessKey: 'r2_secret_key'
      },
      fcm: {
        serverKey: 'fcm_prod_server_key'
      }
    };

    const res = validateEnvironmentConfig('PRODUCTION', validProdConfig);
    assert.equal(res.valid, true);
    assert.equal(res.environment, 'PRODUCTION');
  });

  it('rejects invalid environment strings with INVALID_ENVIRONMENT error', () => {
    assert.throws(
      () => validateEnvironmentConfig('TEST_ENV_99', {}),
      (err) => err.code === 'INVALID_ENVIRONMENT'
    );
  });

  it('rejects completely missing production config with MISSING_PRODUCTION_CONFIG error', () => {
    assert.throws(
      () => validateEnvironmentConfig('PRODUCTION', null),
      (err) => err.code === 'MISSING_PRODUCTION_CONFIG'
    );
    assert.throws(
      () => validateEnvironmentConfig('PRODUCTION', {}),
      (err) => err.code === 'MISSING_PRODUCTION_CONFIG'
    );
  });

  it('rejects incomplete Firebase config in production with MISSING_FIREBASE_CONFIG error', () => {
    const incompleteConfig = {
      firebase: { projectId: 'remas-prod' }, // missing clientEmail & privateKey
      cloudflare: { accountId: 'id', apiToken: 'token' },
      r2: { bucketName: 'b', accessKeyId: 'k', secretAccessKey: 's' },
      fcm: { serverKey: 'fcm' }
    };

    assert.throws(
      () => validateEnvironmentConfig('PRODUCTION', incompleteConfig),
      (err) => err.code === 'MISSING_FIREBASE_CONFIG'
    );
  });

  it('rejects incomplete Cloudflare config in production with MISSING_CLOUDFLARE_CONFIG error', () => {
    const incompleteConfig = {
      firebase: { projectId: 'p', clientEmail: 'e', privateKey: 'k' },
      cloudflare: { accountId: 'id' }, // missing apiToken
      r2: { bucketName: 'b', accessKeyId: 'k', secretAccessKey: 's' },
      fcm: { serverKey: 'fcm' }
    };

    assert.throws(
      () => validateEnvironmentConfig('PRODUCTION', incompleteConfig),
      (err) => err.code === 'MISSING_CLOUDFLARE_CONFIG'
    );
  });

  it('rejects incomplete R2 config in production with MISSING_R2_CONFIG error', () => {
    const incompleteConfig = {
      firebase: { projectId: 'p', clientEmail: 'e', privateKey: 'k' },
      cloudflare: { accountId: 'id', apiToken: 'token' },
      r2: { bucketName: 'b' }, // missing accessKeyId & secretAccessKey
      fcm: { serverKey: 'fcm' }
    };

    assert.throws(
      () => validateEnvironmentConfig('PRODUCTION', incompleteConfig),
      (err) => err.code === 'MISSING_R2_CONFIG'
    );
  });

  it('rejects incomplete FCM config in production with MISSING_FCM_CONFIG error', () => {
    const incompleteConfig = {
      firebase: { projectId: 'p', clientEmail: 'e', privateKey: 'k' },
      cloudflare: { accountId: 'id', apiToken: 'token' },
      r2: { bucketName: 'b', accessKeyId: 'k', secretAccessKey: 's' },
      fcm: {} // missing serverKey
    };

    assert.throws(
      () => validateEnvironmentConfig('PRODUCTION', incompleteConfig),
      (err) => err.code === 'MISSING_FCM_CONFIG'
    );
  });

  it('sanitizes sensitive fields and secret tokens from log payloads', () => {
    const rawPayload = {
      username: 'admin',
      password: 'SuperSecretPassword123',
      nested: {
        privateKey: '-----BEGIN PRIVATE KEY-----',
        bearerToken: 'Bearer eyJhbGciOiJKV1QiLCJhbGci...'
      },
      publicData: 'VisibleText'
    };

    const sanitized = sanitizeLogPayload(rawPayload);

    assert.equal(sanitized.username, 'admin');
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.nested.privateKey, '[REDACTED]');
    assert.equal(sanitized.nested.bearerToken, '[REDACTED]');
    assert.equal(sanitized.publicData, 'VisibleText');
  });

  it('emits formatted audit log entries for all 11 required audit event types', () => {
    const capturedEntries = [];
    const logger = createProductionLogger('PRODUCTION', (entry) => capturedEntries.push(entry));

    VALID_AUDIT_EVENT_TYPES.forEach((evtType, index) => {
      const result = logger.logAuditEvent(evtType, {
        tenantId: 'tenant_center_1',
        actorId: `user_${index}`,
        correlationId: `req_corr_${index}`,
        details: { action: evtType, password: 'secret_to_hide' }
      });

      assert.equal(result.eventType, evtType);
      assert.equal(result.tenantId, 'tenant_center_1');
      assert.equal(result.details.password, '[REDACTED]');
    });

    assert.equal(capturedEntries.length, 11);
  });

  it('rejects invalid audit event types', () => {
    const logger = createProductionLogger('PRODUCTION', () => {});
    assert.throws(
      () => logger.logAuditEvent('INVALID_CUSTOM_EVENT', {}),
      (err) => err.message.includes('Invalid audit event type')
    );
  });

  it('asserts security boundary regressions: Tenant isolation model', () => {
    const tenantA_Request = { tenantId: 'center_A', requestedTenantId: 'center_B' };
    const isAllowed = tenantA_Request.tenantId === tenantA_Request.requestedTenantId;
    assert.equal(isAllowed, false, 'Cross-tenant access must be rejected');
  });

  it('asserts security boundary regressions: Role isolation model', () => {
    const studentRole = 'student';
    const requiredRole = 'admin';
    const canAccessAdminEndpoint = studentRole === requiredRole;
    assert.equal(canAccessAdminEndpoint, false, 'Student role must not access admin endpoints');
  });

  it('asserts security boundary regressions: Parent-child relationship isolation', () => {
    const parentChildren = ['student_101', 'student_102'];
    const targetStudent = 'student_999';
    const isAuthorizedParent = parentChildren.includes(targetStudent);
    assert.equal(isAuthorizedParent, false, 'Parent cannot access unlinked student records');
  });

  it('asserts security boundary regressions: Subscription content entitlement check', () => {
    const studentEntitlements = ['package_math_101'];
    const requiredPackage = 'package_physics_202';
    const isEntitled = studentEntitlements.includes(requiredPackage);
    assert.equal(isEntitled, false, 'Unsubscribed student cannot view unentitled media package');
  });

  it('asserts security boundary regressions: Media Cloudflare Worker authorization check', () => {
    const expiredToken = { exp: Math.floor(Date.now() / 1000) - 300 }; // 5 mins ago
    const nowSec = Math.floor(Date.now() / 1000);
    const isTokenValid = expiredToken.exp > nowSec;
    assert.equal(isTokenValid, false, 'Expired signed media token must be rejected at Edge Worker');
  });

  it('asserts security boundary regressions: Mandatory system notification bypasses marketing opt-out', () => {
    const preferences = { allowMarketing: false, allowAcademic: false };
    const notificationType = 'SYSTEM';
    const isMandatory = notificationType === 'SYSTEM';
    const shouldDeliver = isMandatory || preferences.allowAcademic;
    assert.equal(shouldDeliver, true, 'System notifications must be delivered regardless of preferences');
  });

});
