/**
 * Phase 23 — Production Data Model & Tenant Bootstrap Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TARGET_PROJECT_ID,
  getTenantBootstrapPayload,
  bootstrapTenant,
  getProductionDataCounts
} = require('./production_data_bootstrap');

describe('Phase 23 — Production Data Model & Tenant Bootstrap', () => {

  it('aligns target project strictly to educenter-saas', () => {
    assert.equal(TARGET_PROJECT_ID, 'educenter-saas');
  });

  it('generates compliant tenant bootstrap payload', () => {
    const payload = getTenantBootstrapPayload('inst_demo_01', 'REMAS Educational Center');
    assert.equal(payload.docPath, 'institutions/inst_demo_01');
    assert.equal(payload.data.institutionId, 'inst_demo_01');
    assert.equal(payload.data.name, 'REMAS Educational Center');
    assert.equal(payload.data.type, 'CENTER');
    assert.equal(payload.data.status, 'ACTIVE');
    assert.equal(payload.data.targetProjectId, 'educenter-saas');
    assert.ok(payload.data.createdAt);
  });

  it('rejects bootstrap for invalid environment', async () => {
    await assert.rejects(
      async () => {
        await bootstrapTenant({ environment: 'DEVELOPMENT' });
      },
      (err) => {
        assert.equal(err.code, 'INVALID_ENVIRONMENT_GUARD');
        return true;
      }
    );
  });

  it('returns BLOCKED status when live credentials are omitted', async () => {
    const res = await bootstrapTenant({ environment: 'PRODUCTION', config: {} });
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.reason, 'MISSING_PRODUCTION_CREDENTIALS');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.equal(res.writeCount, 0);
  });

  it('supports dry-run mode when valid credentials provided', async () => {
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

    const res = await bootstrapTenant({ environment: 'PRODUCTION', config: validConfig, dryRun: true });
    assert.equal(res.dryRun, true);
    assert.equal(res.status, 'DRY_RUN_SUCCESS');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.ok(res.plannedCreates.includes('institutions/inst_bootstrap_001'));
  });

  it('provisions single primary tenant cleanly when valid credentials provided', async () => {
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

    const res = await bootstrapTenant({ environment: 'PRODUCTION', config: validConfig, dryRun: false });
    assert.equal(res.dryRun, false);
    assert.equal(res.status, 'BOOTSTRAP_SUCCESS');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.equal(res.writeCount, 1);
    assert.equal(res.deleteCount, 0);
    assert.equal(res.userRecordsCreated, 0);
    assert.equal(res.subscriptionCodesCreated, 0);
    assert.equal(res.financialRecordsCreated, 0);
  });

  it('retrieves non-PII production metrics counts', async () => {
    const metrics = await getProductionDataCounts({ environment: 'PRODUCTION' });
    assert.equal(metrics.status, 'METRICS_RETRIEVED');
    assert.equal(metrics.targetProjectId, 'educenter-saas');
    assert.ok(metrics.counts);
    assert.equal(typeof metrics.counts.institutions, 'number');
    assert.equal(typeof metrics.counts.profiles, 'number');
    assert.equal(typeof metrics.counts.students, 'number');
  });

});
