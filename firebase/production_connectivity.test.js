/**
 * Phase 21 — Production Connectivity Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkProductionConnectivity } = require('./production_connectivity_service');

describe('Phase 21 — Production Connectivity & Infrastructure Health', () => {

  it('returns BLOCKED status when production credentials object is completely missing', async () => {
    const report = await checkProductionConnectivity('PRODUCTION', {});
    assert.equal(report.status, 'BLOCKED');
    assert.equal(report.reason, 'MISSING_PRODUCTION_CREDENTIALS');
    assert.equal(report.environment, 'PRODUCTION');
    assert.equal(report.firebase.configured, false);
    assert.equal(report.firebase.firestore, 'BLOCKED');
    assert.equal(report.firebase.auth, 'BLOCKED');
  });

  it('returns BLOCKED status when placeholder credentials are provided', async () => {
    const placeholderConfig = {
      firebase: { projectId: 'FIREBASE_PROJECT_ID_PLACEHOLDER' }
    };
    const report = await checkProductionConnectivity('PRODUCTION', placeholderConfig);
    assert.equal(report.status, 'BLOCKED');
    assert.equal(report.reason, 'MISSING_PRODUCTION_CREDENTIALS');
  });

  it('returns PASS status and structured health report when full valid credentials supplied', async () => {
    const validConfig = {
      firebase: {
        projectId: 'remas-prod',
        clientEmail: 'sa@remas-prod.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----'
      },
      cloudflare: { accountId: 'cf_123', apiToken: 'cf_tok' },
      r2: { bucketName: 'remas-media-prod', accessKeyId: 'ak', secretAccessKey: 'sk' },
      fcm: { serverKey: 'fcm_key' }
    };

    const report = await checkProductionConnectivity('PRODUCTION', validConfig);
    assert.equal(report.status, 'PASS');
    assert.equal(report.firebase.configured, true);
    assert.equal(report.firebase.projectId, 'remas-prod');
    assert.equal(report.firebase.firestore, 'PASS');
    assert.equal(report.firebase.auth, 'PASS');
    assert.equal(report.cloudflare.worker, 'PASS');
    assert.equal(report.r2.bucket, 'PASS');
    assert.equal(report.fcm.gateway, 'PASS');
  });

  it('redacts all sensitive keys from returned health report', async () => {
    const validConfig = {
      firebase: {
        projectId: 'remas-prod',
        clientEmail: 'sa@remas-prod.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nSECRET_KEY\n-----END PRIVATE KEY-----'
      },
      cloudflare: { accountId: 'cf_123', apiToken: 'SECRET_API_TOKEN' },
      r2: { bucketName: 'remas-media-prod', accessKeyId: 'ak', secretAccessKey: 'SECRET_R2_KEY' },
      fcm: { serverKey: 'SECRET_FCM_KEY' }
    };

    const report = await checkProductionConnectivity('PRODUCTION', validConfig);
    const serialized = JSON.stringify(report);

    assert.equal(serialized.includes('SECRET_KEY'), false, 'Private keys must not be present in health report');
    assert.equal(serialized.includes('SECRET_API_TOKEN'), false, 'API Tokens must not be present in health report');
    assert.equal(serialized.includes('SECRET_R2_KEY'), false, 'R2 secrets must not be present in health report');
    assert.equal(serialized.includes('SECRET_FCM_KEY'), false, 'FCM keys must not be present in health report');
  });

  it('isolates health-check document namespace to systemHealth/{checkId}', async () => {
    const validConfig = {
      firebase: {
        projectId: 'remas-prod',
        clientEmail: 'sa@remas-prod.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----'
      },
      cloudflare: { accountId: 'cf_123', apiToken: 'cf_tok' },
      r2: { bucketName: 'remas-media-prod', accessKeyId: 'ak', secretAccessKey: 'sk' },
      fcm: { serverKey: 'fcm_key' }
    };

    const report = await checkProductionConnectivity('PRODUCTION', validConfig);
    assert.ok(report.healthCheckId.startsWith('check_'));
    assert.equal(report.firebase.healthCheckDoc.environment, 'PRODUCTION');
    assert.equal(report.firebase.healthCheckDoc.releaseVersion, '1.0.0-release.21');
  });

});
