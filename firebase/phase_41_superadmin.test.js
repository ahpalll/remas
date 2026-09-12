process.env.NODE_ENV = 'test';
process.env.USE_FIRESTORE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'rules-test-superadmin-phase41';
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
  resetLicenseStore,
  createCenterLicense,
  activateCenterLicense,
  validateCenterLicense,
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
let unauthDb;
let ownerDb;
let teacherDb;
let studentDb;
let parentDb;
let superAdminLowerDb;
let superAdminUpperDb;

test.before(async () => {
  testEnv = await testEnvPromise;
  unauthDb = testEnv.unauthenticatedContext().firestore();
  ownerDb = testEnv.authenticatedContext('user_owner_1', { institutionId: 'inst_001', role: 'institutionOwner' }).firestore();
  teacherDb = testEnv.authenticatedContext('user_teacher_1', { institutionId: 'inst_001', role: 'teacher' }).firestore();
  studentDb = testEnv.authenticatedContext('user_student_1', { institutionId: 'inst_001', role: 'student' }).firestore();
  parentDb = testEnv.authenticatedContext('user_parent_1', { role: 'parent' }).firestore();
  superAdminLowerDb = testEnv.authenticatedContext('superadmin_lower', { role: 'superadmin' }).firestore();
  superAdminUpperDb = testEnv.authenticatedContext('superadmin_upper', { role: 'superAdmin' }).firestore();
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
// 1. ONE AUTHORITATIVE SUPERADMIN ROLE & FIRESTORE RULES
// ============================================================

test('S01/S02/S03. Firestore Rules — Role-based authorization & denial matrix', async () => {
  const healthDocUnauth = unauthDb.collection('systemHealth').doc('check_001');
  const healthDocOwner = ownerDb.collection('systemHealth').doc('check_001');
  const healthDocTeacher = teacherDb.collection('systemHealth').doc('check_001');
  const healthDocStudent = studentDb.collection('systemHealth').doc('check_001');
  const healthDocParent = parentDb.collection('systemHealth').doc('check_001');
  const healthDocSuperLower = superAdminLowerDb.collection('systemHealth').doc('check_001');
  const healthDocSuperUpper = superAdminUpperDb.collection('systemHealth').doc('check_001');

  // Direct system health reads
  await assertFails(healthDocUnauth.get());
  await assertFails(healthDocOwner.get());
  await assertFails(healthDocTeacher.get());
  await assertFails(healthDocStudent.get());
  await assertFails(healthDocParent.get());

  // Canonical superadmin claims (both 'superadmin' and 'superAdmin') allowed
  await assertSucceeds(healthDocSuperLower.get());
  await assertSucceeds(healthDocSuperUpper.get());
});

test('S06-S11. Trusted Backend License Operations & Device Unbinding', async () => {
  const callerToken = { uid: 'superadmin_test', role: 'superadmin' };

  // 1. Create center license
  const createRes = await createCenterLicense({
    institutionId: 'inst_test_41',
    validityDays: 365,
    callerToken
  });
  assert.equal(createRes.status, 'LICENSE_CREATED_SUCCESSFULLY');
  const license = createRes.license;
  assert.ok(license.licenseCode);
  assert.equal(license.status, 'PENDING_ACTIVATION');

  // 2. Activate with hardware fingerprint
  const actResult = await activateCenterLicense({
    licenseCode: license.licenseCode,
    institutionId: 'inst_test_41',
    deviceFingerprintHash: 'win_fp_8f93e12a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abc',
    callerToken
  });
  assert.equal(actResult.status, 'LICENSE_ACTIVATED_SUCCESSFULLY');

  // 3. Suspend
  const suspendResult = await suspendCenterLicense({
    institutionId: 'inst_test_41',
    reason: 'SuperAdmin security test suspension',
    callerToken
  });
  assert.equal(suspendResult.status, 'LICENSE_SUSPENDED_SUCCESSFULLY');

  // 4. Validate suspended license -> fails
  const valSuspended = await validateCenterLicense({
    institutionId: 'inst_test_41',
    deviceFingerprintHash: 'win_fp_8f93e12a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abc',
    callerToken
  });
  assert.equal(valSuspended.valid, false);
  assert.equal(valSuspended.status, 'LICENSE_SUSPENDED');

  // 5. Renew / Reactivate
  const renewResult = await renewCenterLicense({
    institutionId: 'inst_test_41',
    extensionDays: 365,
    callerToken
  });
  assert.equal(renewResult.status, 'LICENSE_RENEWED_SUCCESSFULLY');

  // 6. Unbind device
  const unbindResult = await unbindDevice({
    institutionId: 'inst_test_41',
    reason: 'SuperAdmin device reset',
    callerToken
  });
  assert.equal(unbindResult.status, 'DEVICE_UNBOUND_SUCCESSFULLY');
  assert.equal(unbindResult.license.deviceBindingStatus, 'UNBOUND');

  // 7. Revoke license
  const revokeResult = await revokeCenterLicense({
    institutionId: 'inst_test_41',
    reason: 'SuperAdmin test revoke',
    callerToken
  });
  assert.equal(revokeResult.status, 'LICENSE_REVOKED_SUCCESSFULLY');
});

test('S20. Zero Client Secrets Audit Scan', async () => {
  const forbiddenTokens = [
    'firebase-admin',
    'serviceAccountKey.json',
    'private_key',
    'AIzaSy_FAKE_SECRET_KEY',
    'sk-or-v1-FAKE_OPENROUTER_SECRET_KEY'
  ];

  const targetDirs = [
    path.resolve(__dirname, '../superadmin_app/lib'),
    path.resolve(__dirname, '../admin-web/src'),
    path.resolve(__dirname, '../center-desktop/src')
  ];

  let matchesFound = 0;

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.dart'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const token of forbiddenTokens) {
            if (content.includes(token)) {
              console.error(`FORBIDDEN TOKEN FOUND [${token}] in ${fullPath}`);
              matchesFound++;
            }
          }
        }
      }
    };
    walk(dir);
  }

  assert.equal(matchesFound, 0, 'Must have zero client secrets in mobile, web, or desktop codebases');
});
