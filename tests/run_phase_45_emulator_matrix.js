process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { setDoc, getDoc, doc, updateDoc } = require('firebase/firestore');

async function runPhase45TestMatrix() {
  const rulesPath = path.resolve(__dirname, '../firebase/firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('============================================================');
  console.log('PHASE 45 REAL CENTER ONLINE OPERATION RULES MATRIX TEST ENGINE');
  console.log('Target Project: educenter-saas-860c5');
  console.log('Rules File: ' + rulesPath);
  console.log('============================================================\n');

  const testEnv = await initializeTestEnvironment({
    projectId: 'educenter-saas-860c5',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: rulesContent
    }
  });

  // Contexts
  const superAdmin = testEnv.authenticatedContext('superadmin_uid', { role: 'superAdmin' }).firestore();
  const ownerA = testEnv.authenticatedContext('ownerA_uid', { institutionId: 'inst_A', role: 'institutionOwner' }).firestore();
  const ownerB = testEnv.authenticatedContext('ownerB_uid', { institutionId: 'inst_B', role: 'institutionOwner' }).firestore();
  const studentA = testEnv.authenticatedContext('studentA_uid', { institutionId: 'inst_A', role: 'student' }).firestore();
  const parentA = testEnv.authenticatedContext('parentA_uid', { institutionId: 'inst_A', role: 'parent' }).firestore();

  let passed = 0;
  let failed = 0;
  const matrixResults = {};

  async function testRule(testCode, description, promise, shouldSucceed) {
    try {
      if (shouldSucceed) {
        await assertSucceeds(promise);
        console.log(`[PASS] ${testCode}: ${description} -> ALLOWED`);
      } else {
        await assertFails(promise);
        console.log(`[PASS] ${testCode}: ${description} -> DENIED`);
      }
      matrixResults[testCode] = 'PASS';
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${testCode}: ${description} -> Expected ${shouldSucceed ? 'ALLOW' : 'DENY'}, but got failure: ${err.message}`);
      matrixResults[testCode] = 'FAIL';
      failed++;
    }
  }

  // Pre-seed test data using admin rules
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // Institutions
    await setDoc(doc(adminDb, 'institutions/inst_A'), {
      institutionId: 'inst_A',
      name: 'Center A',
      status: 'ACTIVE',
      ownerId: 'ownerA_uid',
      createdBy: 'superadmin_uid',
      createdAt: '2026-01-01'
    });
    await setDoc(doc(adminDb, 'institutions/inst_B'), {
      institutionId: 'inst_B',
      name: 'Center B',
      status: 'ACTIVE',
      ownerId: 'ownerB_uid',
      createdBy: 'superadmin_uid',
      createdAt: '2026-01-01'
    });

    // Users
    await setDoc(doc(adminDb, 'institutions/inst_A/users/ownerA_uid'), {
      fullName: 'Owner A',
      phone: '+201000000001',
      role: 'institutionOwner',
      institutionId: 'inst_A'
    });

    // Students
    await setDoc(doc(adminDb, 'institutions/inst_A/students/sA'), {
      authUid: 'studentA_uid',
      name: 'Student A1',
      status: 'ACTIVE',
      parentUid: 'parentA_uid'
    });
    await setDoc(doc(adminDb, 'institutions/inst_B/students/sB'), {
      authUid: 'studentB_uid',
      name: 'Student B1',
      status: 'ACTIVE',
      parentUid: 'parentB_uid'
    });
  });

  console.log('--- EXECUTING MANDATORY PHASE 45 TEST CASES R45-01 THROUGH R45-10 ---');

  // R45-01: Owner A reads Institution A students → ALLOW
  await testRule('R45-01', 'Owner A reads Institution A students', getDoc(doc(ownerA, 'institutions/inst_A/students/sA')), true);

  // R45-02: Owner A reads Institution B students → DENY
  await testRule('R45-02', 'Owner A reads Institution B students', getDoc(doc(ownerA, 'institutions/inst_B/students/sB')), false);

  // R45-03: Owner A creates student in Institution A → ALLOW
  await testRule('R45-03', 'Owner A creates student in Institution A', setDoc(doc(ownerA, 'institutions/inst_A/students/sA_new'), { name: 'Student A New', status: 'ACTIVE', authUid: 'stu_new_uid' }), true);

  // R45-04: Owner A creates student in Institution B → DENY
  await testRule('R45-04', 'Owner A creates student in Institution B', setDoc(doc(ownerA, 'institutions/inst_B/students/sB_hack'), { name: 'Hacked Student B' }), false);

  // R45-05: Owner A updates Student A → ALLOW
  await testRule('R45-05', 'Owner A updates Student A', updateDoc(doc(ownerA, 'institutions/inst_A/students/sA'), { name: 'Student A1 Updated' }), true);

  // R45-06: Owner A updates Student B → DENY
  await testRule('R45-06', 'Owner A updates Student B', updateDoc(doc(ownerA, 'institutions/inst_B/students/sB'), { name: 'Student B1 Hacked' }), false);

  // R45-07: Owner A attempts institutionId reassignment → DENY
  await testRule('R45-07', 'Owner A attempts institutionId reassignment on institution doc', updateDoc(doc(ownerA, 'institutions/inst_A'), { institutionId: 'inst_HACKED', updatedBy: 'ownerA_uid' }), false);

  // R45-08: Owner A attempts role escalation → DENY
  await testRule('R45-08', 'Owner A attempts role escalation on user profile', updateDoc(doc(ownerA, 'institutions/inst_A/users/ownerA_uid'), { role: 'superAdmin', updatedAt: 'SERVER_TIMESTAMP' }), false);

  // R45-09: Student attempts owner/admin write → DENY
  await testRule('R45-09', 'Student attempts owner/admin write (create student)', setDoc(doc(studentA, 'institutions/inst_A/students/sHackedByStudent'), { name: 'Hacked' }), false);

  // R45-10: Parent attempts unrelated student read → DENY
  await testRule('R45-10', 'Parent attempts unrelated student read', getDoc(doc(parentA, 'institutions/inst_A/students/sB')), false);

  await testEnv.cleanup();

  console.log('\n============================================================');
  console.log(`PHASE 45 EMULATOR MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('MATRIX SUMMARY:', JSON.stringify(matrixResults, null, 2));
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase45TestMatrix().catch(err => {
  console.error('CRITICAL PHASE 45 EMULATOR MATRIX EXCEPTION:', err);
  process.exit(1);
});
