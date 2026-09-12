process.env.NODE_ENV = 'test';
process.env.USE_FIRESTORE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'rules-test-full-platform-phase42';
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
let ownerA;
let ownerB;
let teacherA;
let studentA;
let parentA;
let superAdmin;

test.before(async () => {
  testEnv = await testEnvPromise;
  ownerA = testEnv.authenticatedContext('owner_a', { institutionId: 'inst_A', role: 'institutionOwner' }).firestore();
  ownerB = testEnv.authenticatedContext('owner_b', { institutionId: 'inst_B', role: 'institutionOwner' }).firestore();
  teacherA = testEnv.authenticatedContext('teacher_a', { institutionId: 'inst_A', role: 'teacher' }).firestore();
  studentA = testEnv.authenticatedContext('student_a', { institutionId: 'inst_A', role: 'student' }).firestore();
  parentA = testEnv.authenticatedContext('parent_a', { role: 'parent' }).firestore();
  superAdmin = testEnv.authenticatedContext('superadmin_1', { role: 'superAdmin' }).firestore();
});

test.after(async () => {
  if (testEnv) await testEnv.cleanup();
});

test.beforeEach(async () => {
  await clearEmulatorDb();
  resetLicenseStore();
});

// ============================================================
// 1. MULTI-TENANT ISOLATION RULES (INSTITUTION A vs INSTITUTION B)
// ============================================================

test('P18. Firestore Rules — Strict Multi-Tenant Cross-Access Prevention', async () => {
  const docA = ownerA.collection('institutions').doc('inst_A').collection('schedules').doc('sched_001');
  const docBByOwnerA = ownerA.collection('institutions').doc('inst_B').collection('schedules').doc('sched_001');
  const docBByOwnerB = ownerB.collection('institutions').doc('inst_B').collection('schedules').doc('sched_001');

  // Owner A creating in own tenant -> SUCCEEDS
  await assertSucceeds(docA.set({ name: 'Schedule A', createdBy: 'owner_a' }));

  // Owner A accessing tenant B -> DENIED
  await assertFails(docBByOwnerA.get());
  await assertFails(docBByOwnerA.set({ name: 'Cross-Tenant Tamper' }));

  // Owner B accessing tenant B -> SUCCEEDS
  await assertSucceeds(docBByOwnerB.get());
});

// ============================================================
// 2. CROSS-SURFACE REVOCATION CHECK
// ============================================================

test('P17. SuperAdmin Cross-Surface Revocation Verification', async () => {
  const superAdminToken = { uid: 'superadmin_1', role: 'superadmin' };
  const ownerToken = { uid: 'owner_a', institutionId: 'inst_A', role: 'institutionOwner' };
  const fp = 'win_fp_1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';

  // 1. SuperAdmin creates license
  const lic = await createCenterLicense({ institutionId: 'inst_A', callerToken: superAdminToken });
  await activateCenterLicense({
    licenseCode: lic.license.licenseCode,
    institutionId: 'inst_A',
    deviceFingerprintHash: fp,
    callerToken: superAdminToken
  });

  // 2. Center Desktop checks authorization -> VALID
  const valBefore = await validateCenterLicense({ institutionId: 'inst_A', deviceFingerprintHash: fp, callerToken: ownerToken });
  assert.equal(valBefore.valid, true);

  // 3. SuperAdmin Revokes License
  await revokeCenterLicense({ institutionId: 'inst_A', reason: 'Emergency Cross-Surface Test Revoke', callerToken: superAdminToken });

  // 4. Center Desktop checks authorization -> DENIED IMMEDIATELY
  const valAfter = await validateCenterLicense({ institutionId: 'inst_A', deviceFingerprintHash: fp, callerToken: ownerToken });
  assert.equal(valAfter.valid, false);
  assert.equal(valAfter.status, 'LICENSE_REVOKED');
});

// ============================================================
// 3. ZERO SECRETS SCAN IN COMPILED & SOURCE ARTIFACTS
// ============================================================

test('P21. Zero Privileged Secrets Audit Scan', async () => {
  const forbiddenTokens = ['firebase-admin', 'serviceAccountKey.json', 'private_key'];
  const dirsToScan = [
    path.resolve(__dirname, '../superadmin_app/lib'),
    path.resolve(__dirname, '../admin-web/src'),
    path.resolve(__dirname, '../center-desktop/src'),
    path.resolve(__dirname, '../student_app/lib'),
    path.resolve(__dirname, '../teacher_app/lib'),
    path.resolve(__dirname, '../parent_app/lib'),
    path.resolve(__dirname, '../parent-portal/src')
  ];

  let matches = 0;
  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile()) {
          const content = fs.readFileSync(p, 'utf8');
          for (const token of forbiddenTokens) {
            if (content.includes(token)) {
              console.error(`FORBIDDEN SECRET TOKEN [${token}] found in ${p}`);
              matches++;
            }
          }
        }
      }
    };
    walk(dir);
  }
  assert.equal(matches, 0, 'Zero privileged secrets permitted in client codebases');
});
