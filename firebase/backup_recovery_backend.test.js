/**
 * Phase 30 — Backup & Disaster Recovery Backend Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TARGET_PROJECT_ID,
  verifyBackupReadiness,
  generateDisasterRecoveryRunbook
} = require('./backup_disaster_recovery_service');

describe('Phase 30 — Backup & Disaster Recovery Verification', () => {

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

  it('1. Target Project Alignment — Aligns target project strictly to educenter-saas', () => {
    assert.equal(TARGET_PROJECT_ID, 'educenter-saas');
  });

  it('2. Backup Readiness Verification — Confirms PITR & backup configuration parameters', async () => {
    const res = await verifyBackupReadiness({ environment: 'PRODUCTION', config: validConfig });
    assert.equal(res.status, 'VERIFIED');
    assert.equal(res.readinessState, 'READINESS_CONFIRMED');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.equal(res.backupConfig.pitrEnabled, true);
    assert.equal(res.backupConfig.pitrRetentionDays, 7);
    assert.equal(res.backupConfig.scheduleFrequency, 'DAILY');
    assert.equal(res.backupConfig.rpoTargetMinutes, 60);
    assert.equal(res.backupConfig.rtoTargetHours, 4);
  });

  it('3. Non-Destructive Production Guard — Enforces PROHIBITED status for live production destructive restore', async () => {
    const res = await verifyBackupReadiness({ environment: 'PRODUCTION', config: validConfig });
    assert.equal(res.restoreSafety.destructiveRestoreOnProd, 'PROHIBITED');
    assert.equal(res.restoreSafety.testEnvironmentRestoreOnly, true);
    assert.equal(res.restoreSafety.nonDestructiveAuditPassed, true);
  });

  it('4. Missing Credentials Rejection — Returns BLOCKED status when credentials are omitted', async () => {
    const res = await verifyBackupReadiness({ environment: 'PRODUCTION', config: {} });
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.reason, 'MISSING_PRODUCTION_CREDENTIALS');
  });

  it('5. Disaster Recovery Runbook Generator — Generates compliant RPO/RTO disaster recovery procedures', () => {
    const runbook = generateDisasterRecoveryRunbook();
    assert.equal(runbook.targetProjectId, 'educenter-saas');
    assert.ok(runbook.sla.rpoTarget.includes('RPO < 1 Hour'));
    assert.ok(runbook.sla.rtoTarget.includes('RTO < 4 Hours'));
    assert.equal(runbook.recoveryProcedures.length, 5);
    assert.ok(runbook.recoveryProcedures[2].command.includes('gcloud firestore databases restore'));
  });

});
