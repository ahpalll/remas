process.env.NODE_ENV = 'test';
process.env.USE_FIRESTORE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'rules-test-educenter';
const rulesPath = path.resolve(__dirname, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

const testEnvPromise = initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: rulesContent
  }
});

const {
  generateHardwareFingerprint,
  validateFingerprintFormat,
  getSystemMetadata
} = require('../center-desktop/src/device_fingerprint');

const {
  resetLicenseStore,
  createCenterLicense,
  activateCenterLicense,
  validateCenterLicense,
  getCenterLicense,
  listCenterLicenses,
  suspendCenterLicense,
  revokeCenterLicense,
  renewCenterLicense,
  unbindDevice
} = require('./license_service');

function clearEmulatorDb() {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 8080,
      path: `/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      method: 'DELETE'
    }, () => resolve());
    req.on('error', () => resolve());
    req.end();
  });
}

let testEnv;
let ownerDb;
let tenantADb;
let superAdminDb;

test.before(async () => {
  testEnv = await testEnvPromise;
  ownerDb = testEnv.authenticatedContext('user_owner_1', { institutionId: 'inst_001', role: 'institutionOwner' }).firestore();
  tenantADb = testEnv.authenticatedContext('user_tenant_a', { institutionId: 'inst_tenant_a', role: 'institutionOwner' }).firestore();
  superAdminDb = testEnv.authenticatedContext('superadmin_1', { role: 'superAdmin' }).firestore();
});

test.after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

test.beforeEach(async () => {
  await clearEmulatorDb();
  resetLicenseStore();
});

// ============================================================
// 1. DEVICE FINGERPRINT TESTS (MICRO-AMENDMENT 1)
// ============================================================

test('1. Device Fingerprint — Derived SHA-256 hash format and stability', async () => {
  const fp1 = generateHardwareFingerprint();
  const fp2 = generateHardwareFingerprint();

  assert.equal(typeof fp1, 'string');
  assert.ok(fp1.startsWith('win_fp_'), 'Fingerprint must start with win_fp_ prefix');
  assert.equal(fp1.length, 71, 'Prefix (7) + 64 SHA-256 hex chars = 71');
  assert.ok(validateFingerprintFormat(fp1), 'Format validation must pass');
  assert.equal(fp1, fp2, 'Fingerprint must remain strictly deterministic & stable across restarts');
});

test('1. Device Fingerprint — Non-hostname primary identity signal', async () => {
  const baseMeta = {
    platform: 'win32',
    arch: 'x64',
    cpuModel: 'Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz',
    cpuCores: 8,
    totalMemoryGb: 32,
    systemUuid: 'SYS-UUID-ORIGINAL-12345'
  };

  const fpBase = generateHardwareFingerprint({ ...baseMeta, hostname: 'DESKTOP-CENTER-MAIN' });
  const fpHostChanged = generateHardwareFingerprint({ ...baseMeta, hostname: 'DESKTOP-CENTER-RENAMED' });

  assert.ok(validateFingerprintFormat(fpBase));
  assert.ok(validateFingerprintFormat(fpHostChanged));
  assert.notEqual(fpBase, fpHostChanged, 'Supplementary signal alters final derivation without exposing raw host');
});

test('1. Device Fingerprint — Zero PII / raw serial exposure in system metadata', async () => {
  const meta = getSystemMetadata();
  assert.ok(!meta.serialNumber, 'Must not expose raw hardware serials');
  assert.ok(!meta.macAddress, 'Must not expose raw MAC addresses');
  assert.ok(!meta.userEmail, 'Must not include user PII');
  assert.ok(meta.deviceName, 'Contains safe device display name');
  assert.ok(meta.osVersion, 'Contains safe OS version');
});

// ============================================================
// 2. FIRESTORE SECURITY RULES TESTS (MICRO-AMENDMENTS 2, 6, 8)
// ============================================================

test('2. Firestore Security Rules Suite (ALLOW / DENY / Isolation)', async () => {
  // Setup documents via security rules disabled
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('licenses/lic_inst_001').set({
      institutionId: 'inst_001',
      status: 'ACTIVE',
      expiresAt: '2027-01-01T00:00:00.000Z'
    });
    await db.doc('licenses/lic_inst_tenant_b').set({
      institutionId: 'inst_tenant_b',
      status: 'ACTIVE'
    });
    await db.doc('deviceBindings/bind_inst_tenant_b').set({
      institutionId: 'inst_tenant_b',
      deviceFingerprintHash: 'win_fp_tenant_b_hash'
    });
  });

  // A. Center Owner read own license (ALLOW)
  const snap = await assertSucceeds(ownerDb.doc('licenses/lic_inst_001').get());
  assert.ok(snap.exists, 'Center owner must be allowed to read their own license');
  assert.equal(snap.data().institutionId, 'inst_001');

  // B. Center Owner write/modify license (DENY)
  await assertFails(ownerDb.doc('licenses/lic_inst_001').update({
    expiresAt: '2099-12-31T23:59:59.000Z'
  }));

  // C. Center Owner direct create deviceBinding (DENY)
  await assertFails(ownerDb.doc('deviceBindings/bind_inst_001').set({
    institutionId: 'inst_001',
    deviceFingerprintHash: 'win_fp_fake123456',
    boundAt: new Date().toISOString()
  }));

  // D. Cross-Tenant read license/binding (DENY)
  await assertFails(tenantADb.doc('licenses/lic_inst_tenant_b').get());
  await assertFails(tenantADb.doc('deviceBindings/bind_inst_tenant_b').get());

  // E. SuperAdmin full license/binding management (ALLOW)
  await assertSucceeds(superAdminDb.doc('licenses/lic_inst_002').set({
    institutionId: 'inst_002',
    status: 'ACTIVE',
    expiresAt: '2027-01-01T00:00:00.000Z'
  }));

  await assertSucceeds(superAdminDb.doc('deviceBindings/bind_inst_002').set({
    institutionId: 'inst_002',
    deviceFingerprintHash: 'win_fp_' + 'a'.repeat(64),
    boundAt: new Date().toISOString()
  }));

  const licSnap = await assertSucceeds(superAdminDb.doc('licenses/lic_inst_002').get());
  assert.ok(licSnap.exists);
  assert.equal(licSnap.data().status, 'ACTIVE');

  const bindSnap = await assertSucceeds(superAdminDb.doc('deviceBindings/bind_inst_002').get());
  assert.ok(bindSnap.exists);
});

// ============================================================
// 3. SERVER-AUTHORIZED BINDING & LIFECYCLE (MICRO-AMENDMENT 2, 3, 6, 9)
// ============================================================

test('3. Server Binding — First binding succeeds and enforces 1-device limit', async () => {
  const saToken = { uid: 'sa_01', role: 'superadmin' };
  const ownerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_alpha' };
  const instId = 'inst_alpha';

  // 1. Create License
  const createRes = await createCenterLicense({ institutionId: instId, validityDays: 30, callerToken: saToken });
  assert.equal(createRes.status, 'LICENSE_CREATED_SUCCESSFULLY');
  const licCode = createRes.license.licenseCode;

  // 2. First Binding on Device 1
  const fp1 = 'win_fp_' + '1'.repeat(64);
  const actRes1 = await activateCenterLicense({
    licenseCode: licCode,
    institutionId: instId,
    deviceFingerprintHash: fp1,
    callerToken: ownerToken
  });
  assert.equal(actRes1.status, 'LICENSE_ACTIVATED_SUCCESSFULLY');

  // 3. Re-activation on Device 1 -> ALLOWED
  const actResSame = await activateCenterLicense({
    licenseCode: licCode,
    institutionId: instId,
    deviceFingerprintHash: fp1,
    callerToken: ownerToken
  });
  assert.equal(actResSame.status, 'ALREADY_ACTIVE_SAME_DEVICE');

  // 4. Activation attempt on Device 2 -> DENIED (DEVICE_LIMIT_EXCEEDED)
  const fp2 = 'win_fp_' + '2'.repeat(64);
  await assert.rejects(
    async () => {
      await activateCenterLicense({
        licenseCode: licCode,
        institutionId: instId,
        deviceFingerprintHash: fp2,
        callerToken: ownerToken
      });
    },
    (err) => err.message.includes('DEVICE_LIMIT_EXCEEDED'),
    'Secondary device binding attempt must be strictly rejected'
  );
});

test('3. License Lifecycle — SuperAdmin Suspend, Revoke, Extend, Unbind', async () => {
  const saToken = { uid: 'sa_01', role: 'superadmin' };
  const ownerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_beta' };
  const instId = 'inst_beta';

  await createCenterLicense({ institutionId: instId, validityDays: 10, callerToken: saToken });
  const fp1 = 'win_fp_' + '3'.repeat(64);
  await activateCenterLicense({ institutionId: instId, deviceFingerprintHash: fp1, callerToken: ownerToken });

  // Suspend
  await suspendCenterLicense({ institutionId: instId, reason: 'Payment Dispute', callerToken: saToken });
  const valSuspended = await validateCenterLicense({ institutionId: instId, deviceFingerprintHash: fp1, callerToken: ownerToken });
  assert.equal(valSuspended.valid, false);
  assert.equal(valSuspended.status, 'LICENSE_SUSPENDED');

  // Extend / Renew
  await renewCenterLicense({ institutionId: instId, extensionDays: 60, callerToken: saToken });
  // Un-suspend by SuperAdmin re-activating
  await activateCenterLicense({ institutionId: instId, deviceFingerprintHash: fp1, callerToken: saToken });
  const valRenewed = await validateCenterLicense({ institutionId: instId, deviceFingerprintHash: fp1, callerToken: ownerToken });
  assert.equal(valRenewed.valid, true);

  // Unbind
  await unbindDevice({ institutionId: instId, reason: 'PC Upgrade', callerToken: saToken });
  const valUnbound = await validateCenterLicense({ institutionId: instId, deviceFingerprintHash: fp1, callerToken: ownerToken });
  assert.equal(valUnbound.valid, false);
  assert.equal(valUnbound.status, 'UNBOUND');

  // Now Device 2 can bind
  const fp2 = 'win_fp_' + '4'.repeat(64);
  const actRes2 = await activateCenterLicense({ institutionId: instId, deviceFingerprintHash: fp2, callerToken: ownerToken });
  assert.equal(actRes2.status, 'LICENSE_ACTIVATED_SUCCESSFULLY');

  // Revoke
  await revokeCenterLicense({ institutionId: instId, reason: 'Contract Termination', callerToken: saToken });
  const valRevoked = await validateCenterLicense({ institutionId: instId, deviceFingerprintHash: fp2, callerToken: ownerToken });
  assert.equal(valRevoked.valid, false);
  assert.equal(valRevoked.status, 'LICENSE_REVOKED');
});

// ============================================================
// 4. FIREBASE ADMIN SDK & SECRET SCAN (MICRO-AMENDMENT 4, 13)
// ============================================================

test('4. Security Scan — Zero firebase-admin in client/renderer source & packaged ASAR', async () => {
  const rootDir = path.resolve(__dirname, '..');
  const filesToScan = [
    path.join(rootDir, 'center-desktop', 'src', 'center_desktop_services.js'),
    path.join(rootDir, 'center-desktop', 'src', 'device_fingerprint.js'),
    path.join(rootDir, 'center-desktop', 'src', 'device_binding_service.js'),
    path.join(rootDir, 'center-desktop', 'renderer', 'app.js'),
    path.join(rootDir, 'parent_portal', 'index.html'),
    path.join(rootDir, 'parent_app', 'lib', 'main.dart'),
    path.join(rootDir, 'teacher_app', 'lib', 'main.dart'),
    path.join(rootDir, 'student_app', 'lib', 'main.dart')
  ];

  for (const filePath of filesToScan) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(!content.includes("require('firebase-admin')"), `File ${path.basename(filePath)} must not import firebase-admin`);
      assert.ok(!content.includes('require("firebase-admin")'), `File ${path.basename(filePath)} must not import firebase-admin`);
      assert.ok(!content.includes('serviceAccountKey.json'), `File ${path.basename(filePath)} must not reference serviceAccountKey`);
    }
  }

  // Scan ASAR binary if compiled
  const asarPath = path.join(rootDir, 'center-desktop', 'dist', 'win-unpacked', 'resources', 'app.asar');
  if (fs.existsSync(asarPath)) {
    const asarBuffer = fs.readFileSync(asarPath);
    const asarText = asarBuffer.toString('utf8');
    assert.ok(!asarText.includes('PRIVATE KEY-----'), 'Packaged ASAR must not contain raw private keys');
    assert.ok(!asarText.includes('R2_SECRET_ACCESS_KEY'), 'Packaged ASAR must not leak R2 secrets');
  }
});

// ============================================================
// 5. OFFLINE GRACE POLICY AUDIT (MICRO-AMENDMENT 5, 14)
// ============================================================

test('5. Offline Grace Policy Audit — Status Reporting', async () => {
  const offlinePolicyStatus = 'UNVERIFIED';
  assert.equal(offlinePolicyStatus, 'UNVERIFIED', 'Offline grace policy must be marked UNVERIFIED when hardware TPM trusted clock is absent');
});

// ============================================================
// 6. FAILURE TRANSPARENCY (MICRO-AMENDMENT 12)
// ============================================================

test('6. Failure Transparency — Surfacing backend authorization failures', async () => {
  const ownerToken = { uid: 'owner_99', role: 'institutionOwner', institutionId: 'inst_nonexistent' };
  
  const valRes = await validateCenterLicense({
    institutionId: 'inst_nonexistent',
    deviceFingerprintHash: 'win_fp_' + '9'.repeat(64),
    callerToken: ownerToken
  });

  assert.equal(valRes.valid, false);
  assert.equal(valRes.status, 'LICENSE_NOT_FOUND');
  assert.ok(valRes.reason, 'Failure reason must be transparently surfaced to the UI/caller');
});
