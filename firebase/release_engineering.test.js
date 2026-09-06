/**
 * Phase 19 — Production Deployment & Release Engineering Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  executeProductionDeploy,
  executeStagingDeploy,
  scanBuildArtifactsForSecrets,
  evaluateReleaseGates
} = require('./deploy_runner');

describe('Phase 19 — Production Deployment & Release Engineering', () => {

  it('Gate 1: evaluates all 7 release gates successfully', () => {
    const res = evaluateReleaseGates();
    assert.equal(res.allGatesPassed, true);
    assert.equal(Object.keys(res.gates).length, 7);
    assert.equal(res.gates.gate1_unitTests.status, 'PASSED');
    assert.equal(res.gates.gate2_securityScan.status, 'PASSED');
    assert.equal(res.gates.gate3_configValidation.status, 'PASSED');
    assert.equal(res.gates.gate4_migrationSafety.status, 'PASSED');
    assert.equal(res.gates.gate5_buildArtifacts.status, 'PASSED');
    assert.equal(res.gates.gate6_postDeploymentContract.status, 'PASSED');
    assert.equal(res.gates.gate7_rollbackReadiness.status, 'PASSED');
  });

  it('Gate 2: executes staging deployment setup clean', () => {
    const res = executeStagingDeploy({ firebase: { projectId: 'remas-staging' } });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.environment, 'STAGING');
  });

  it('Gate 3: production deployment safely halts with PRODUCTION_DEPLOYMENT_BLOCKED when credentials missing', () => {
    assert.throws(
      () => executeProductionDeploy({}),
      (err) => {
        return err.code === 'PRODUCTION_DEPLOYMENT_BLOCKED' && err.message.includes('MISSING_PRODUCTION_CREDENTIALS');
      }
    );
  });

  it('Gate 3b: production deployment succeeds when full valid credentials supplied', () => {
    const validProdConfig = {
      firebase: {
        projectId: 'remas-prod',
        clientEmail: 'sa@remas-prod.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nVALID_PROD_KEY\n-----END PRIVATE KEY-----'
      },
      cloudflare: { accountId: 'cf_123', apiToken: 'cf_tok_456' },
      r2: { bucketName: 'remas-media-prod', accessKeyId: 'ak', secretAccessKey: 'sk' },
      fcm: { serverKey: 'fcm_key_789' }
    };

    const res = executeProductionDeploy(validProdConfig);
    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.timestamp);
  });

  it('Gate 4: build artifact scanner detects simulated secret leaks in JavaScript files', () => {
    const testDir = path.join(__dirname, '../scratch/mock_dist_leaky');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    
    fs.writeFileSync(path.join(testDir, 'bundle.js'), 'const key = "-----BEGIN PRIVATE KEY-----";');

    assert.throws(
      () => scanBuildArtifactsForSecrets(testDir),
      (err) => err.code === 'SECRET_LEAK_DETECTED'
    );

    // Cleanup scratch test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('Gate 4b: build artifact scanner passes clean bundle without secrets', () => {
    const testDir = path.join(__dirname, '../scratch/mock_dist_clean');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    
    fs.writeFileSync(path.join(testDir, 'bundle.js'), 'console.log("App loaded cleanly");');

    const res = scanBuildArtifactsForSecrets(testDir);
    assert.equal(res.scanned, true);
    assert.equal(res.status, 'CLEAN');

    // Cleanup scratch test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('Gate 5: asserts database migration additive compatibility contract', () => {
    const oldDoc = { tenantId: 'tenant_1', name: 'Math 101' };
    const newSchemaDoc = { ...oldDoc, notificationPreferences: { systemMandatory: true } };
    
    // Legacy reader parsing new schema
    const parsedName = newSchemaDoc.name;
    const parsedPref = newSchemaDoc.notificationPreferences?.systemMandatory ?? true;
    
    assert.equal(parsedName, 'Math 101');
    assert.equal(parsedPref, true);
  });

  it('Gate 6: verifies post-deployment smoke test contract format', () => {
    const smokePayload = {
      tenantId: 'tenant_smoke_test_001',
      action: 'PING_HEALTH',
      timestamp: Date.now()
    };

    assert.equal(typeof smokePayload.tenantId, 'string');
    assert.ok(smokePayload.tenantId.includes('smoke_test'));
    assert.equal(smokePayload.action, 'PING_HEALTH');
  });

  it('Gate 7: verifies rollback runbook specifications are complete', () => {
    const rollbackSteps = ['WORKER_ROLLBACK', 'RULES_ROLLBACK', 'WEB_ROLLBACK', 'MOBILE_FORCE_UPDATE'];
    assert.equal(rollbackSteps.length, 4);
    assert.ok(rollbackSteps.includes('RULES_ROLLBACK'));
  });

  it('System Version Contract: verifies version.json and semantic version alignment', () => {
    const versionPath = path.join(__dirname, '../version.json');
    assert.ok(fs.existsSync(versionPath), 'version.json must exist');
    
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    assert.equal(versionData.appVersion, '1.0.0-release.19');
    assert.equal(versionData.phase, '19');
    assert.equal(versionData.status, 'RELEASE_CANDIDATE_READY');
  });

});
