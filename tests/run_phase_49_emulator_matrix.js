process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { setDoc, getDoc, doc, updateDoc } = require('firebase/firestore');

async function runPhase49TestMatrix() {
  const rulesPath = path.resolve(__dirname, '../firebase/firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('============================================================');
  console.log('PHASE 49 CENTER MANAGEMENT CORE & TENANT SECURITY MATRIX');
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
  const teacherA = testEnv.authenticatedContext('teacherA_uid', { institutionId: 'inst_A', role: 'teacher' }).firestore();
  const teacherB = testEnv.authenticatedContext('teacherB_uid', { institutionId: 'inst_B', role: 'teacher' }).firestore();
  const studentA = testEnv.authenticatedContext('studentA_uid', { institutionId: 'inst_A', role: 'student' }).firestore();
  const studentB = testEnv.authenticatedContext('studentB_uid', { institutionId: 'inst_B', role: 'student' }).firestore();
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

  // Seed test data with admin bypass
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    await setDoc(doc(adminDb, 'institutions/inst_A'), {
      institutionId: 'inst_A',
      name: 'Institution A',
      status: 'ACTIVE'
    });

    await setDoc(doc(adminDb, 'institutions/inst_B'), {
      institutionId: 'inst_B',
      name: 'Institution B',
      status: 'ACTIVE'
    });

    await setDoc(doc(adminDb, 'institutions/inst_A/students/stu_A'), {
      id: 'stu_A',
      institutionId: 'inst_A',
      name: 'Student A',
      authUid: 'studentA_uid',
      parentUid: 'parentA_uid',
      status: 'ACTIVE'
    });

    await setDoc(doc(adminDb, 'institutions/inst_B/students/stu_B'), {
      id: 'stu_B',
      institutionId: 'inst_B',
      name: 'Student B',
      authUid: 'studentB_uid',
      status: 'ACTIVE'
    });

    await setDoc(doc(adminDb, 'institutions/inst_A/teachers/tch_A'), {
      id: 'tch_A',
      institutionId: 'inst_A',
      name: 'Teacher A',
      authUid: 'teacherA_uid',
      status: 'ACTIVE'
    });

    await setDoc(doc(adminDb, 'institutions/inst_B/teachers/tch_B'), {
      id: 'tch_B',
      institutionId: 'inst_B',
      name: 'Teacher B',
      authUid: 'teacherB_uid',
      status: 'ACTIVE'
    });

    await setDoc(doc(adminDb, 'institutions/inst_A/groups/grp_A'), {
      id: 'grp_A',
      institutionId: 'inst_A',
      name: 'Group A',
      status: 'ACTIVE'
    });

    await setDoc(doc(adminDb, 'institutions/inst_B/groups/grp_B'), {
      id: 'grp_B',
      institutionId: 'inst_B',
      name: 'Group B',
      status: 'ACTIVE'
    });
  });

  console.log('--- EXECUTING MANDATORY PHASE 49 EMULATOR SECURITY MATRIX F49-01 THROUGH F49-10 ---\n');

  // Scenario 1: Owner A cannot read Student B in Institution B
  await testRule('F49-01', 'Owner A reads Student B in Institution B', getDoc(doc(ownerA, 'institutions/inst_B/students/stu_B')), false);

  // Scenario 2: Owner A cannot write Teacher B in Institution B
  await testRule('F49-02', 'Owner A creates/modifies Teacher in Institution B', setDoc(doc(ownerA, 'institutions/inst_B/teachers/tch_hack'), { name: 'Hacked' }), false);

  // Scenario 3: Teacher A cannot access Institution B
  await testRule('F49-03', 'Teacher A accesses Institution B document', getDoc(doc(teacherA, 'institutions/inst_B')), false);

  // Scenario 4: Teacher A cannot write Group in Institution B
  await testRule('F49-04', 'Teacher A creates Group in Institution B', setDoc(doc(teacherA, 'institutions/inst_B/groups/grp_hack'), { name: 'Hacked' }), false);

  // Scenario 5: Student A cannot access Student B
  await testRule('F49-05', 'Student A reads Student B document in Institution B', getDoc(doc(studentA, 'institutions/inst_B/students/stu_B')), false);

  // Scenario 6: Parent A cannot access unrelated Student B
  await testRule('F49-06', 'Parent A reads Student B document in Institution B', getDoc(doc(parentA, 'institutions/inst_B/students/stu_B')), false);

  // Scenario 7: Client cannot modify authUid on existing student
  await testRule('F49-07', 'Owner A modifies authUid on existing Student A', updateDoc(doc(ownerA, 'institutions/inst_A/students/stu_A'), { authUid: 'hacked_auth_uid' }), false);

  // Scenario 8: Client cannot modify institutionId on existing student
  await testRule('F49-08', 'Owner A modifies institutionId on existing Student A', updateDoc(doc(ownerA, 'institutions/inst_A/students/stu_A'), { institutionId: 'inst_B' }), false);

  // Scenario 9: Client cannot modify role on existing teacher
  await testRule('F49-09', 'Owner A adds role claim to Teacher A document', updateDoc(doc(ownerA, 'institutions/inst_A/teachers/tch_A'), { role: 'superAdmin' }), false);

  // Scenario 10: Owner A manages own Institution A Academic Year (Allowed)
  await testRule('F49-10', 'Owner A creates Academic Year in own Institution A', setDoc(doc(ownerA, 'institutions/inst_A/academicYears/AY_2026'), { name: '2025/2026', status: 'ACTIVE' }), true);

  console.log('\n============================================================');
  console.log(`PHASE 49 EMULATOR MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('MATRIX SUMMARY: ' + JSON.stringify(matrixResults, null, 2));
  console.log('============================================================\n');

  await testEnv.cleanup();
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase49TestMatrix().catch(err => {
  console.error('EMULATOR MATRIX RUNNER ERROR:', err);
  process.exit(1);
});
