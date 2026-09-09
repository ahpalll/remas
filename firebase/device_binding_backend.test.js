/**
 * Phase 31 — Device Binding & Licensing Backend Unit & Integration Tests
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateHardwareFingerprint, validateFingerprintFormat } = require('./device_fingerprint');
const {
  TARGET_PROJECT_ID,
  resetStore,
  requestDeviceActivation,
  validateDeviceBinding,
  revokeDeviceBinding,
  replaceDeviceBinding,
  heartbeatDevice,
  listAllCenterDevices,
  getAuditLogs
} = require('./device_binding_service');

test.describe('Phase 31 — Device Binding & Single Device Licensing Suite', () => {
  
  test.beforeEach(() => {
    resetStore();
  });

  test('1. Target Project Alignment — Aligns target project strictly to educenter-saas', () => {
    assert.equal(TARGET_PROJECT_ID, 'educenter-saas');
  });

  test('2. First Device Activation — Activates initial device for institution cleanly', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ deviceName: 'CENTER-PC-01' });

    const result = await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    assert.equal(result.status, 'DEVICE_BOUND_SUCCESSFULLY');
    assert.equal(result.binding.bindingStatus, 'ACTIVE');
    assert.equal(result.binding.deviceId, fp);

    const validation = await validateDeviceBinding({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    assert.equal(validation.valid, true);
    assert.equal(validation.status, 'ACTIVE');
  });

  test('3. Same Device Restart & Reinstall — Accepts same fingerprint on restart/reinstall', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ deviceName: 'CENTER-PC-01' });

    await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    // Simulate restart / reinstall re-activation request
    const reActivation = await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    assert.equal(reActivation.status, 'ALREADY_ACTIVE_SAME_DEVICE');
  });

  test('4. Second Device Rejection — Denies activation attempt from a secondary physical device', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const fp1 = generateHardwareFingerprint({ hostname: 'CENTER-PC-PRIMARY' });
    const fp2 = generateHardwareFingerprint({ hostname: 'CENTER-LAPTOP-SECONDARY' });

    await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp1,
      callerToken: adminToken
    });

    await assert.rejects(
      async () => {
        await requestDeviceActivation({
          institutionId: 'inst_alpha',
          deviceFingerprint: fp2,
          callerToken: adminToken
        });
      },
      (err) => {
        assert.match(err.message, /DEVICE_LIMIT_EXCEEDED/);
        return true;
      }
    );
  });

  test('5. Revoked Device Guard — Rejects runtime access when device is revoked by SuperAdmin', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const fp = generateHardwareFingerprint({ deviceName: 'CENTER-PC-REVOKE-TARGET' });

    const activated = await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    // SuperAdmin revokes binding
    await revokeDeviceBinding({
      institutionId: 'inst_alpha',
      bindingId: activated.binding.bindingId,
      reason: 'Unauthorized device cloning suspect',
      callerToken: superAdminToken
    });

    const validation = await validateDeviceBinding({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    assert.equal(validation.valid, false);
    assert.equal(validation.status, 'REVOKED');
    assert.match(validation.reason, /إلغاء تفعيل/);
  });

  test('6. Device Replacement Workflow — SuperAdmin replaces device binding cleanly', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const fpOld = generateHardwareFingerprint({ hostname: 'OLD-PC' });
    const fpNew = generateHardwareFingerprint({ hostname: 'NEW-PC' });

    await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fpOld,
      callerToken: adminToken
    });

    const replaceRes = await replaceDeviceBinding({
      institutionId: 'inst_alpha',
      newDeviceFingerprint: fpNew,
      reason: 'Upgraded hardware PC',
      callerToken: superAdminToken
    });

    assert.equal(replaceRes.status, 'DEVICE_REPLACED_SUCCESSFULLY');

    // Old device validation -> REJECTED
    const oldValidation = await validateDeviceBinding({
      institutionId: 'inst_alpha',
      deviceFingerprint: fpOld,
      callerToken: adminToken
    });
    assert.equal(oldValidation.valid, false);

    // New device validation -> ACTIVE
    const newValidation = await validateDeviceBinding({
      institutionId: 'inst_alpha',
      deviceFingerprint: fpNew,
      callerToken: adminToken
    });
    assert.equal(newValidation.valid, true);
    assert.equal(newValidation.status, 'ACTIVE');
  });

  test('7. Cross-Tenant Activation Guard — Rejects tenant admin activating another institution', async () => {
    const tenantBAdminToken = { uid: 'admin_b', role: 'admin', institutionId: 'inst_beta' };
    const fp = generateHardwareFingerprint({ hostname: 'ATTACKER-PC' });

    await assert.rejects(
      async () => {
        await requestDeviceActivation({
          institutionId: 'inst_alpha', // Target is Alpha, caller is Beta
          deviceFingerprint: fp,
          callerToken: tenantBAdminToken
        });
      },
      (err) => {
        assert.match(err.message, /CROSS_TENANT_VIOLATION/);
        return true;
      }
    );
  });

  test('8. Unauthenticated Activation Protection — Rejects activation without caller token', async () => {
    const fp = generateHardwareFingerprint({ hostname: 'ANON-PC' });

    await assert.rejects(
      async () => {
        await requestDeviceActivation({
          institutionId: 'inst_alpha',
          deviceFingerprint: fp,
          callerToken: null
        });
      },
      (err) => {
        assert.match(err.message, /UNAUTHENTICATED/);
        return true;
      }
    );
  });

  test('9. Unauthorized Role Protection — Denies student, parent, or teacher device activation', async () => {
    const teacherToken = { uid: 'teacher_10', role: 'teacher', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'TEACHER-PC' });

    await assert.rejects(
      async () => {
        await requestDeviceActivation({
          institutionId: 'inst_alpha',
          deviceFingerprint: fp,
          callerToken: teacherToken
        });
      },
      (err) => {
        assert.match(err.message, /UNAUTHORIZED_CALLER_ROLE/);
        return true;
      }
    );
  });

  test('10. SuperAdmin Cross-Tenant Listing & Revoke Control — Enforces SuperAdmin role for listAll & revoke', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const fp = generateHardwareFingerprint({ hostname: 'CENTER-PC-LIST' });

    await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    // Tenant Admin calling listAllCenterDevices -> DENIED
    await assert.rejects(
      async () => {
        await listAllCenterDevices({ callerToken: adminToken });
      },
      (err) => {
        assert.match(err.message, /UNAUTHORIZED_CALLER_ROLE/);
        return true;
      }
    );

    // SuperAdmin calling listAllCenterDevices -> PASS
    const listRes = await listAllCenterDevices({ callerToken: superAdminToken });
    assert.equal(listRes.length, 1);
  });

  test('11. Suspended / Expired Institution Guard — Rejects runtime access when tenant is suspended or expired', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'SUSPENDED-PC' });

    await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    const suspendedValidation = await validateDeviceBinding({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      institutionStatus: 'SUSPENDED',
      callerToken: adminToken
    });

    assert.equal(suspendedValidation.valid, false);
    assert.equal(suspendedValidation.status, 'INSTITUTION_SUSPENDED');

    const expiredValidation = await validateDeviceBinding({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      subscriptionStatus: 'EXPIRED',
      callerToken: adminToken
    });

    assert.equal(expiredValidation.valid, false);
    assert.equal(expiredValidation.status, 'SUBSCRIPTION_EXPIRED');
  });

  test('12. Online Heartbeat Verification — Acknowledges heartbeats and updates lastSeenAt timestamp', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const fp = generateHardwareFingerprint({ hostname: 'HEARTBEAT-PC' });

    await requestDeviceActivation({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      callerToken: adminToken
    });

    const hbRes = await heartbeatDevice({
      institutionId: 'inst_alpha',
      deviceFingerprint: fp,
      appVersion: '1.0.0-release.31',
      callerToken: adminToken
    });

    assert.equal(hbRes.status, 'HEARTBEAT_ACKNOWLEDGED');
    assert.equal(hbRes.valid, true);
    assert.ok(hbRes.lastSeenAt);
  });

  test('13. Idempotency Guard — Re-running activation produces stable single binding', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const fp = generateHardwareFingerprint({ hostname: 'IDEMPOTENT-PC' });

    await requestDeviceActivation({ institutionId: 'inst_alpha', deviceFingerprint: fp, callerToken: adminToken });
    await requestDeviceActivation({ institutionId: 'inst_alpha', deviceFingerprint: fp, callerToken: adminToken });

    const all = await listAllCenterDevices({ callerToken: superAdminToken });
    assert.equal(all.length, 1);
  });

  test('14. Concurrent Activation Attempts — Handled safely without binding duplication', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const fp = generateHardwareFingerprint({ hostname: 'CONCURRENT-PC' });

    const p1 = requestDeviceActivation({ institutionId: 'inst_alpha', deviceFingerprint: fp, callerToken: adminToken });
    const p2 = requestDeviceActivation({ institutionId: 'inst_alpha', deviceFingerprint: fp, callerToken: adminToken });

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.ok(r1.status === 'DEVICE_BOUND_SUCCESSFULLY' || r1.status === 'ALREADY_ACTIVE_SAME_DEVICE');
    assert.ok(r2.status === 'DEVICE_BOUND_SUCCESSFULLY' || r2.status === 'ALREADY_ACTIVE_SAME_DEVICE');

    const list = await listAllCenterDevices({ callerToken: superAdminToken });
    assert.equal(list.length, 1);
  });

  test('15. Audit Event Log Integrity — Generates immutable audit logs for device binding lifecycle', async () => {
    const adminToken = { uid: 'admin_001', role: 'admin', institutionId: 'inst_alpha' };
    const superAdminToken = { uid: 'superadmin_01', role: 'superadmin' };
    const fp = generateHardwareFingerprint({ hostname: 'AUDIT-PC' });

    const act = await requestDeviceActivation({ institutionId: 'inst_alpha', deviceFingerprint: fp, callerToken: adminToken });
    await revokeDeviceBinding({ institutionId: 'inst_alpha', bindingId: act.binding.bindingId, reason: 'Security Audit Test', callerToken: superAdminToken });

    const logs = getAuditLogs('inst_alpha');
    assert.ok(logs.length >= 2);
    assert.ok(logs.some(l => l.eventType === 'DEVICE_BOUND_SUCCESSFULLY'));
    assert.ok(logs.some(l => l.eventType === 'DEVICE_BINDING_REVOKED'));
  });

});
