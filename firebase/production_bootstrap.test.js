/**
 * Phase 21 — Production System Bootstrap Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getSystemMetadataPayloads,
  evaluateProductionGuards,
  executeProductionBootstrap
} = require('./production_bootstrap');

describe('Phase 21 — Safe Production System Bootstrap', () => {

  const validProdConfig = {
    firebase: {
      projectId: 'remas-prod',
      clientEmail: 'sa@remas-prod.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----'
    },
    cloudflare: { accountId: 'cf_123', apiToken: 'cf_tok' },
    r2: { bucketName: 'remas-media-prod', accessKeyId: 'ak', secretAccessKey: 'sk' },
    fcm: { serverKey: 'fcm_key' }
  };

  it('evaluates system metadata payloads schema accurately', () => {
    const payloads = getSystemMetadataPayloads();
    assert.ok(payloads['systemMetadata/appConfig']);
    assert.ok(payloads['systemMetadata/systemRoles']);
    assert.ok(payloads['systemMetadata/subscriptionScopes']);

    assert.equal(payloads['systemMetadata/appConfig'].releaseVersion, '1.0.0-release.21');
    assert.equal(payloads['systemMetadata/appConfig'].supportedRoles.length, 5);
  });

  it('rejects bootstrap for invalid environment via Production Guards', () => {
    assert.throws(
      () => evaluateProductionGuards('DEVELOPMENT', validProdConfig),
      (err) => err.code === 'INVALID_ENVIRONMENT_GUARD'
    );
  });

  it('rejects bootstrap when production credentials missing via Production Guards', () => {
    assert.throws(
      () => evaluateProductionGuards('PRODUCTION', {}),
      (err) => err.code === 'PRODUCTION_BOOTSTRAP_BLOCKED'
    );
  });

  it('executes dry-run mode cleanly without writing data', async () => {
    const res = await executeProductionBootstrap({
      environment: 'PRODUCTION',
      config: validProdConfig,
      dryRun: true
    });

    assert.equal(res.dryRun, true);
    assert.equal(res.status, 'DRY_RUN_SUCCESS');
    assert.equal(res.plannedCreates.length, 3);
    assert.equal(res.plannedUpdates.length, 0);
    assert.equal(res.plannedDeletes.length, 0);
  });

  it('executes live system bootstrap idempotently writing ONLY system metadata', async () => {
    const res1 = await executeProductionBootstrap({
      environment: 'PRODUCTION',
      config: validProdConfig,
      dryRun: false
    });

    const res2 = await executeProductionBootstrap({
      environment: 'PRODUCTION',
      config: validProdConfig,
      dryRun: false
    });

    assert.equal(res1.status, 'BOOTSTRAP_SUCCESS');
    assert.equal(res2.status, 'BOOTSTRAP_SUCCESS');
    assert.equal(res1.writtenDocuments.length, 3);
    assert.equal(res2.writtenDocuments.length, 3);

    // Verify 0 tenant/user records created
    assert.equal(res1.userRecordsCreated, 0);
    assert.equal(res1.subscriptionCodesCreated, 0);
    assert.equal(res1.financialRecordsCreated, 0);
  });

  it('asserts tenant and user domain data boundaries remain 100% untouched', () => {
    const payloads = getSystemMetadataPayloads();
    const docKeys = Object.keys(payloads);

    const touchesUserCollections = docKeys.some(
      (k) => k.startsWith('students') || k.startsWith('parents') || k.startsWith('finance') || k.startsWith('attendance')
    );

    assert.equal(touchesUserCollections, false, 'System bootstrap must never mutate student/parent/finance collections');
  });

});
