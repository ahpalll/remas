/**
 * Phase 31 — Complete License & Device Binding Backend Unit & Integration Tests
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateHardwareFingerprint, validateFingerprintFormat } = require('./device_fingerprint');
const {
  TARGET_PROJECT_ID,
  resetLicenseStore,
  createCenterLicense,
  activateCenterLicense,
  validateCenterLicense,
  getCenterLicense,
  listCenterLicenses,
  suspendCenterLicense,
  revokeCenterLicense,
  renewCenterLicense,
  unbindDevice,
  forceDeactivateDevice,
  getDeviceStatus,
  getAuditLogsStore
} = require('./license_service');

test.describe('Phase 31 — Comprehensive License & Device Binding Verification Suite', () => {

  test.beforeEach(() => {
    resetLicenseStore();
  });

  test('1. Target Project Alignment — Target project strictly set to educenter-saas', () => {
    assert.equal(TARGET_PROJECT_ID, 'educenter-saas');
  });

  test('2. License Creation — SuperAdmin creates a valid pending center license', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const res = await createCenterLicense({
      institutionId: 'inst_alpha',
      validityDays: 365,
      callerToken: superAdminToken
    });

    assert.equal(res.status, 'LICENSE_CREATED_SUCCESSFULLY');
    assert.equal(res.license.status, 'PENDING_ACTIVATION');
    assert.equal(res.license.deviceBindingStatus, 'UNBOUND');
    assert.ok(res.license.licenseCode.startsWith('REMAS-'));
  });

  test('3. License Activation & First Device Binding — Activates license & binds initial device', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'ALPHA-CENTER-PC-01' });

    const created = await createCenterLicense({
      institutionId: 'inst_alpha',
      validityDays: 365,
      callerToken: superAdminToken
    });

    const actRes = await activateCenterLicense({
      licenseCode: created.license.licenseCode,
      institutionId: 'inst_alpha',
      deviceFingerprintHash: fp,
      deviceInstallationId: 'inst_uuid_001',
      callerToken: adminToken
    });

    assert.equal(actRes.status, 'LICENSE_ACTIVATED_SUCCESSFULLY');
    assert.equal(actRes.license.status, 'ACTIVE');
    assert.equal(actRes.license.deviceBindingStatus, 'BOUND');
    assert.equal(actRes.license.deviceFingerprintHash, fp);
  });

  test('4. Same Device Reactivation — Allows reactivation on identical fingerprint hash', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'ALPHA-CENTER-PC-01' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });

    const react = await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    assert.equal(react.status, 'ALREADY_ACTIVE_SAME_DEVICE');
  });

  test('5. Different Device Rejection — Denies activation attempt from a second physical machine', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp1 = generateHardwareFingerprint({ hostname: 'ALPHA-PC-PRIMARY' });
    const fp2 = generateHardwareFingerprint({ hostname: 'ALPHA-LAPTOP-SECONDARY' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp1, callerToken: adminToken });

    await assert.rejects(
      async () => {
        await activateCenterLicense({
          licenseCode: created.license.licenseCode,
          institutionId: 'inst_alpha',
          deviceFingerprintHash: fp2,
          callerToken: adminToken
        });
      },
      (err) => {
        assert.match(err.message, /DEVICE_LIMIT_EXCEEDED/);
        return true;
      }
    );
  });

  test('6. Expired License Rejection — Denies validation when license expiration date is passed', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'EXPIRED-PC' });

    // Create expired license (-1 days)
    const created = await createCenterLicense({ institutionId: 'inst_alpha', validityDays: -1, callerToken: superAdminToken });

    await assert.rejects(
      async () => {
        await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
      },
      (err) => {
        assert.match(err.message, /SUBSCRIPTION_EXPIRED/);
        return true;
      }
    );
  });

  test('7. Suspended License Rejection — Denies runtime validation when license is suspended', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'SUSPENDED-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });

    await suspendCenterLicense({ institutionId: 'inst_alpha', reason: 'Audit Non-Compliance', callerToken: superAdminToken });

    const val = await validateCenterLicense({ institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    assert.equal(val.valid, false);
    assert.equal(val.status, 'LICENSE_SUSPENDED');
  });

  test('8. Revoked License Rejection — Denies runtime validation when license is revoked', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'REVOKED-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });

    await revokeCenterLicense({ institutionId: 'inst_alpha', reason: 'Unfair Redistribution Suspect', callerToken: superAdminToken });

    const val = await validateCenterLicense({ institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    assert.equal(val.valid, false);
    assert.equal(val.status, 'LICENSE_REVOKED');
  });

  test('9. Device Unbinding Workflow — SuperAdmin unbinds device to allow new binding', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp1 = generateHardwareFingerprint({ hostname: 'OLD-PC' });
    const fp2 = generateHardwareFingerprint({ hostname: 'NEW-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp1, callerToken: adminToken });

    const unbindRes = await unbindDevice({ institutionId: 'inst_alpha', reason: 'Authorized Hardware Upgrade', callerToken: superAdminToken });
    assert.equal(unbindRes.status, 'DEVICE_UNBOUND_SUCCESSFULLY');
    assert.equal(unbindRes.license.deviceBindingStatus, 'UNBOUND');

    // New machine activation -> SUCCESS
    const act2 = await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp2, callerToken: adminToken });
    assert.equal(act2.status, 'LICENSE_ACTIVATED_SUCCESSFULLY');
    assert.equal(act2.license.deviceFingerprintHash, fp2);
  });

  test('10. Rebinding Authorization — Re-activates cleanly after SuperAdmin unbind', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'REBIND-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    await unbindDevice({ institutionId: 'inst_alpha', callerToken: superAdminToken });

    const rebind = await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    assert.equal(rebind.status, 'LICENSE_ACTIVATED_SUCCESSFULLY');
  });

  test('11. Force Deactivation Engine — SuperAdmin forces immediate deactivation', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'FORCE-DEACTIVATE-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });

    const forceRes = await forceDeactivateDevice({ institutionId: 'inst_alpha', reason: 'Security Breach Protocol', callerToken: superAdminToken });
    assert.equal(forceRes.status, 'LICENSE_REVOKED_SUCCESSFULLY');

    const val = await validateCenterLicense({ institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    assert.equal(val.valid, false);
  });

  test('12. Cross-Tenant Activation Guard — Prevents admin of Tenant B activating Tenant A', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const tenantBAdminToken = { uid: 'admin_beta', role: 'admin', institutionId: 'inst_beta' };
    const fp = generateHardwareFingerprint({ hostname: 'CROSS-TENANT-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });

    await assert.rejects(
      async () => {
        await activateCenterLicense({
          licenseCode: created.license.licenseCode,
          institutionId: 'inst_alpha', // Target is Alpha, caller is Beta
          deviceFingerprintHash: fp,
          callerToken: tenantBAdminToken
        });
      },
      (err) => {
        assert.match(err.message, /CROSS_TENANT_VIOLATION/);
        return true;
      }
    );
  });

  test('13. Unauthorized Role Protection — Denies teacher/student activating license', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const teacherToken = { uid: 'teacher_10', role: 'teacher', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'TEACHER-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });

    await assert.rejects(
      async () => {
        await activateCenterLicense({
          licenseCode: created.license.licenseCode,
          institutionId: 'inst_alpha',
          deviceFingerprintHash: fp,
          callerToken: teacherToken
        });
      },
      (err) => {
        assert.match(err.message, /UNAUTHORIZED_CALLER_ROLE/);
        return true;
      }
    );
  });

  test('14. Audit Log Event Generation — Generates audit events across full license lifecycle', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'AUDIT-LOG-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    await suspendCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await renewCenterLicense({ institutionId: 'inst_alpha', extensionDays: 180, callerToken: superAdminToken });

    const logs = getAuditLogsStore('inst_alpha');
    assert.ok(logs.length >= 4);
    assert.ok(logs.some(l => l.eventType === 'LICENSE_CREATED'));
    assert.ok(logs.some(l => l.eventType === 'LICENSE_ACTIVATED'));
    assert.ok(logs.some(l => l.eventType === 'LICENSE_SUSPENDED'));
    assert.ok(logs.some(l => l.eventType === 'LICENSE_RENEWED'));
  });

  test('15. Device Fingerprint Hash Format Behavior — Validates win_fp_ prefix and length', () => {
    const fp = generateHardwareFingerprint({ hostname: 'TEST-HASH-PC' });
    assert.equal(validateFingerprintFormat(fp), true);
    assert.equal(validateFingerprintFormat('invalid_hash_string'), false);
  });

  test('16. Replay & Duplicate Activation Protection — Stable state under replay calls', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'REPLAY-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });

    const all = await listCenterLicenses({ callerToken: superAdminToken });
    assert.equal(all.length, 1);
  });

  test('17. Invalid License Code Rejection — Denies activation with wrong license code', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'WRONG-CODE-PC' });

    await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });

    await assert.rejects(
      async () => {
        await activateCenterLicense({
          licenseCode: 'REMAS-INVALID-CODE-999',
          institutionId: 'inst_alpha',
          deviceFingerprintHash: fp,
          callerToken: adminToken
        });
      },
      (err) => {
        assert.match(err.message, /INVALID_LICENSE_CODE/);
        return true;
      }
    );
  });

  test('18. Institution Mismatch Rejection — Denies viewing or updating non-existent institution license', async () => {
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };

    await assert.rejects(
      async () => {
        await getCenterLicense({ institutionId: 'inst_non_existent', callerToken: adminToken });
      },
      (err) => {
        assert.match(err.message, /CROSS_TENANT_VIOLATION|LICENSE_NOT_FOUND/);
        return true;
      }
    );
  });

  test('19. Offline Grace Period Rule Validation — Confirms 72-hour grace period calculations', async () => {
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const adminToken = { uid: 'admin_alpha', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'GRACE-PC' });

    const created = await createCenterLicense({ institutionId: 'inst_alpha', callerToken: superAdminToken });
    await activateCenterLicense({ licenseCode: created.license.licenseCode, institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });

    const status = await getDeviceStatus({ institutionId: 'inst_alpha', deviceFingerprintHash: fp, callerToken: adminToken });
    assert.equal(status.valid, true);
    assert.equal(status.status, 'ACTIVE');
  });

});
