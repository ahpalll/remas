process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { setDoc, getDoc, doc, updateDoc } = require('firebase/firestore');

async function runTestMatrix() {
  const rulesPath = path.resolve(__dirname, '../firebase/firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('============================================================');
  console.log('RULES TEST ENGINE:');
  console.log('Firebase Emulator + @firebase/rules-unit-testing');
  console.log('RULES FILE:');
  console.log(rulesPath);
  console.log('============================================================\n');

  const testEnv = await initializeTestEnvironment({
    projectId: 'educenter-saas-860c5',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: rulesContent
    }
  });

  const ownerA = testEnv.authenticatedContext('ownerA_uid', { institutionId: 'inst_A', role: 'institutionOwner' }).firestore();
  const adminA = testEnv.authenticatedContext('adminA_uid', { institutionId: 'inst_A', role: 'admin' }).firestore();
  const teacherA = testEnv.authenticatedContext('teacherA_uid', { institutionId: 'inst_A', role: 'teacher' }).firestore();
  const studentA = testEnv.authenticatedContext('studentA_uid', { institutionId: 'inst_A', role: 'student' }).firestore();
  const ownerB = testEnv.authenticatedContext('ownerB_uid', { institutionId: 'inst_B', role: 'institutionOwner' }).firestore();
  const unauth = testEnv.unauthenticatedContext().firestore();

  let passed = 0;
  let failed = 0;

  async function testRule(description, promise, shouldSucceed) {
    try {
      if (shouldSucceed) {
        await assertSucceeds(promise);
        console.log(`[PASS] ALLOW: ${description}`);
      } else {
        await assertFails(promise);
        console.log(`[PASS] DENY : ${description}`);
      }
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${description} -> Expected ${shouldSucceed ? 'ALLOW' : 'DENY'}, but failed assertion: ${err.message}`);
      failed++;
    }
  }

  // Pre-seed Inst A and Inst B documents using admin rules or test setup
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'institutions/inst_A'), { institutionId: 'inst_A', name: 'Center A', status: 'ACTIVE', ownerId: 'ownerA_uid', createdBy: 'ownerA_uid', createdAt: '2026-01-01' });
    await setDoc(doc(adminDb, 'institutions/inst_B'), { institutionId: 'inst_B', name: 'Center B', status: 'ACTIVE', ownerId: 'ownerB_uid', createdBy: 'ownerB_uid', createdAt: '2026-01-01' });
    await setDoc(doc(adminDb, 'institutions/inst_A/students/s1'), { name: 'Student A1', status: 'active' });
    await setDoc(doc(adminDb, 'institutions/inst_B/students/s1'), { name: 'Student B1', status: 'active' });
    await setDoc(doc(adminDb, 'institutions/inst_A/teachers/t1'), { name: 'Teacher A1', subject: 'Math' });
    await setDoc(doc(adminDb, 'institutions/inst_B/teachers/t1'), { name: 'Teacher B1', subject: 'Physics' });
    await setDoc(doc(adminDb, 'institutions/inst_A/groups/g1'), { name: 'Group A1' });
    await setDoc(doc(adminDb, 'institutions/inst_B/groups/g1'), { name: 'Group B1' });
    await setDoc(doc(adminDb, 'institutions/inst_A/attendanceSessions/att1'), { date: '2026-09-11' });
    await setDoc(doc(adminDb, 'institutions/inst_B/attendanceSessions/att1'), { date: '2026-09-11' });
    await setDoc(doc(adminDb, 'institutions/inst_A/studentPayments/p1'), { amount: 100 });
    await setDoc(doc(adminDb, 'institutions/inst_B/studentPayments/p1'), { amount: 200 });
  });

  console.log('--- 1. STUDENTS COLLECTION ---');
  await testRule('A owner read A students', getDoc(doc(ownerA, 'institutions/inst_A/students/s1')), true);
  await testRule('A owner write A students', setDoc(doc(ownerA, 'institutions/inst_A/students/s2'), { name: 'Student A2', status: 'active' }), true);
  await testRule('A owner read B students', getDoc(doc(ownerA, 'institutions/inst_B/students/s1')), false);
  await testRule('A owner write B students', setDoc(doc(ownerA, 'institutions/inst_B/students/s2'), { name: 'Student B2', status: 'active' }), false);

  console.log('\n--- 2. TEACHERS COLLECTION ---');
  await testRule('A owner read A teachers', getDoc(doc(ownerA, 'institutions/inst_A/teachers/t1')), true);
  await testRule('A owner write A teachers', setDoc(doc(ownerA, 'institutions/inst_A/teachers/t2'), { name: 'Teacher A2' }), true);
  await testRule('A owner read B teachers', getDoc(doc(ownerA, 'institutions/inst_B/teachers/t1')), false);
  await testRule('A owner write B teachers', setDoc(doc(ownerA, 'institutions/inst_B/teachers/t2'), { name: 'Teacher B2' }), false);

  console.log('\n--- 3. GROUPS COLLECTION ---');
  await testRule('A owner read A groups', getDoc(doc(ownerA, 'institutions/inst_A/groups/g1')), true);
  await testRule('A owner write A groups', setDoc(doc(ownerA, 'institutions/inst_A/groups/g2'), { name: 'Group A2' }), true);
  await testRule('A owner read B groups', getDoc(doc(ownerA, 'institutions/inst_B/groups/g1')), false);
  await testRule('A owner write B groups', setDoc(doc(ownerA, 'institutions/inst_B/groups/g2'), { name: 'Group B2' }), false);

  console.log('\n--- 4. ATTENDANCE COLLECTION ---');
  await testRule('A owner read A attendance', getDoc(doc(ownerA, 'institutions/inst_A/attendanceSessions/att1')), true);
  await testRule('A owner write A attendance', setDoc(doc(ownerA, 'institutions/inst_A/attendanceSessions/att2'), { date: '2026-09-12' }), true);
  await testRule('A owner read B attendance', getDoc(doc(ownerA, 'institutions/inst_B/attendanceSessions/att1')), false);
  await testRule('A owner write B attendance', setDoc(doc(ownerA, 'institutions/inst_B/attendanceSessions/att2'), { date: '2026-09-12' }), false);

  console.log('\n--- 5. PAYMENTS COLLECTION ---');
  await testRule('A owner read A payments', getDoc(doc(ownerA, 'institutions/inst_A/studentPayments/p1')), true);
  await testRule('A owner write A payments', setDoc(doc(ownerA, 'institutions/inst_A/studentPayments/p2'), { amount: 150 }), true);
  await testRule('A owner read B payments', getDoc(doc(ownerA, 'institutions/inst_B/studentPayments/p1')), false);
  await testRule('A owner write B payments', setDoc(doc(ownerA, 'institutions/inst_B/studentPayments/p2'), { amount: 250 }), false);

  console.log('\n--- 6. SETTINGS COLLECTION (INSTITUTION DOC) ---');
  await testRule('A owner read A settings', getDoc(doc(ownerA, 'institutions/inst_A')), true);
  await testRule('A owner write A settings', updateDoc(doc(ownerA, 'institutions/inst_A'), { name: 'Updated Center A', updatedBy: 'ownerA_uid' }), true);
  await testRule('A owner read B settings', getDoc(doc(ownerA, 'institutions/inst_B')), false);
  await testRule('A owner write B settings', updateDoc(doc(ownerA, 'institutions/inst_B'), { name: 'Hacked Center B', updatedBy: 'ownerA_uid' }), false);

  console.log('\n--- 7. ROLE & TENANT AUTHORIZATION MATRIX ---');
  await testRule('unauthenticated read A students', getDoc(doc(unauth, 'institutions/inst_A/students/s1')), false);
  await testRule('unauthenticated write A students', setDoc(doc(unauth, 'institutions/inst_A/students/unauth'), { name: 'Unauth' }), false);
  await testRule('studentA write A management collection (students)', setDoc(doc(studentA, 'institutions/inst_A/students/s3'), { name: 'Hacked Student' }), false);
  await testRule('teacherA write A management collection (students)', setDoc(doc(teacherA, 'institutions/inst_A/students/s4'), { name: 'Hacked Student' }), false);
  await testRule('ownerB read A students', getDoc(doc(ownerB, 'institutions/inst_A/students/s1')), false);
  await testRule('ownerB write A students', setDoc(doc(ownerB, 'institutions/inst_A/students/s5'), { name: 'Cross Tenant Hack' }), false);

  await testEnv.cleanup();

  console.log('\n============================================================');
  console.log(`EMULATOR RULES TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestMatrix().catch(err => {
  console.error('CRITICAL TEST MATRIX EXCEPTION:', err);
  process.exit(1);
});
