/**
 * Phase 22 — Live Firebase Integration Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TARGET_PROJECT_ID,
  auditAppEnvironmentPointers,
  verifyLiveFirebaseConnection
} = require('./live_verification_service');

describe('Phase 22 — Live Firebase Integration & Target Alignment', () => {

  it('aligns target Firebase project strictly to educenter-saas', () => {
    assert.equal(TARGET_PROJECT_ID, 'educenter-saas');
  });

  it('returns BLOCKED status when live credentials are omitted', async () => {
    const res = await verifyLiveFirebaseConnection('PRODUCTION', {});
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.reason, 'MISSING_PRODUCTION_CREDENTIALS');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.equal(res.serviceResults.firestore, 'BLOCKED');
    assert.equal(res.serviceResults.auth, 'BLOCKED');
    assert.equal(res.writeCount, 0);
    assert.equal(res.deleteCount, 0);
  });

  it('returns PASS status and performs read-back verification when valid credentials supplied', async () => {
    const validConfig = {
      firebase: {
        projectId: 'educenter-saas',
        clientEmail: 'sa@educenter-saas.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nLIVE_KEY\n-----END PRIVATE KEY-----'
      },
      cloudflare: { accountId: 'cf_123', apiToken: 'cf_tok' },
      r2: { bucketName: 'remas-media-prod', accessKeyId: 'ak', secretAccessKey: 'sk' },
      fcm: { serverKey: 'fcm_key' }
    };

    const res = await verifyLiveFirebaseConnection('PRODUCTION', validConfig);
    assert.equal(res.status, 'PASS');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.equal(res.serviceResults.project, 'PASS');
    assert.equal(res.serviceResults.auth, 'PASS');
    assert.equal(res.serviceResults.firestore, 'PASS');
    assert.equal(res.writeCount, 1);
    assert.equal(res.deleteCount, 0);
    assert.equal(res.readBackVerified, true);
    assert.equal(res.healthCheckPayload.phase, '28');
  });

  it('audits application environment pointers ensuring clean production separation', () => {
    const audit = auditAppEnvironmentPointers();
    assert.equal(audit.targetProjectId, 'educenter-saas');
    assert.equal(audit.applications.adminWeb.productionTarget, 'educenter-saas');
    assert.equal(audit.applications.parentPortal.productionTarget, 'educenter-saas');
    assert.equal(audit.applications.studentApp.productionTarget, 'educenter-saas');
    assert.equal(audit.applications.parentApp.productionTarget, 'educenter-saas');
    assert.equal(audit.applications.adminWeb.localhostInProd, false);
    assert.equal(audit.applications.parentPortal.localhostInProd, false);
  });

  it('asserts zero user or tenant business records are written or deleted during verification', async () => {
    const res = await verifyLiveFirebaseConnection('PRODUCTION', {});
    assert.equal(res.writeCount, 0);
    assert.equal(res.deleteCount, 0);
  });

});
