/**
 * Phase 32 — Windows Desktop Packaged Runtime Regression Test Suite
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Phase 32 — Windows Packaged Runtime Dependency & Isolation Test', () => {

  it('1. Verifies center-desktop/main.js requires only internal center-desktop modules', () => {
    const mainJsPath = path.join(__dirname, '..', 'center-desktop', 'main.js');
    assert.ok(fs.existsSync(mainJsPath), 'center-desktop/main.js must exist');
    const content = fs.readFileSync(mainJsPath, 'utf8');

    // Assert zero relative requires reaching outside center-desktop (e.g. '../firebase/')
    const externalRequireRegex = /require\(['"]\.\.\/firebase\//;
    assert.equal(externalRequireRegex.test(content), false, 'main.js must not require files outside center-desktop directory');

    // Assert valid relative requires inside center-desktop
    assert.ok(content.includes("require('./src/device_fingerprint')"), 'main.js must require ./src/device_fingerprint');
    assert.ok(content.includes("require('./src/device_binding_service')"), 'main.js must require ./src/device_binding_service');
  });

  it('2. Verifies center-desktop/src/device_fingerprint.js exists and generates valid hardware fingerprint', () => {
    const fpModulePath = path.join(__dirname, '..', 'center-desktop', 'src', 'device_fingerprint.js');
    assert.ok(fs.existsSync(fpModulePath), 'center-desktop/src/device_fingerprint.js must exist');
    
    const { generateHardwareFingerprint, validateFingerprintFormat, getSystemMetadata } = require(fpModulePath);
    const meta = getSystemMetadata();
    const fp = generateHardwareFingerprint(meta);

    assert.ok(fp.startsWith('win_fp_'), 'Fingerprint must start with win_fp_');
    assert.equal(fp.length, 71, 'Fingerprint must be win_fp_ + 64 hex characters');
    assert.equal(validateFingerprintFormat(fp), true, 'Fingerprint format validation must pass');
  });

  it('3. Verifies center-desktop/src/device_binding_service.js enforces single device binding', async () => {
    const serviceModulePath = path.join(__dirname, '..', 'center-desktop', 'src', 'device_binding_service.js');
    assert.ok(fs.existsSync(serviceModulePath), 'center-desktop/src/device_binding_service.js must exist');

    const service = require(serviceModulePath);
    service.resetStore();

    const mockAdminToken = { uid: 'center_admin_001', role: 'admin', institutionId: 'inst_test_001' };
    const fp1 = 'win_fp_' + '1'.repeat(64);

    // Initial activation -> SUCCESS
    const actRes = await service.requestDeviceActivation({
      institutionId: 'inst_test_001',
      deviceFingerprint: fp1,
      callerToken: mockAdminToken
    });
    assert.equal(actRes.status, 'DEVICE_BOUND_SUCCESSFULLY');

    // Second device activation attempt -> REJECTED
    const fp2 = 'win_fp_' + '2'.repeat(64);
    await assert.rejects(
      async () => {
        await service.requestDeviceActivation({
          institutionId: 'inst_test_001',
          deviceFingerprint: fp2,
          callerToken: mockAdminToken
        });
      },
      (err) => err.message.includes('DEVICE_LIMIT_EXCEEDED')
    );
  });

  it('4. Asserts zero Firebase Admin Service Account credentials exist inside center-desktop package', () => {
    const packageJsonPath = path.join(__dirname, '..', 'center-desktop', 'package.json');
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(content);

    assert.equal(pkg.dependencies && pkg.dependencies['firebase-admin'], undefined, 'firebase-admin must not be in center-desktop dependencies');
    assert.equal(content.includes('BEGIN PRIVATE KEY'), false, 'No private key in package.json');
    assert.equal(content.includes('FIREBASE_SERVICE_ACCOUNT_JSON'), false, 'No service account env in package.json');
  });

});
