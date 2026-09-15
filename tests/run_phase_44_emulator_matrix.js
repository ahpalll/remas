process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { setDoc, getDoc, doc, updateDoc } = require('firebase/firestore');

async function runPhase44TestMatrix() {
  const rulesPath = path.resolve(__dirname, '../firebase/firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('============================================================');
  console.log('PHASE 44 ARCHITECTURE EMULATOR RULES MATRIX TEST ENGINE');
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
  const studentA = testEnv.authenticatedContext('studentA_uid', { institutionId: 'inst_A', role: 'student' }).firestore();
  const parentA = testEnv.authenticatedContext('parentA_uid', { institutionId: 'inst_A', role: 'parent' }).firestore();

  let passed = 0;
  let failed = 0;
  const matrixResults = {};

  async function testRule(caseId, description, promise, shouldSucceed) {
    try {
      if (shouldSucceed) {
        await assertSucceeds(promise);
        console.log(`[PASS] Case ${caseId}: ${description} -> ALLOWED`);
      } else {
        await assertFails(promise);
        console.log(`[PASS] Case ${caseId}: ${description} -> DENIED`);
      }
      matrixResults[caseId] = 'PASS';
      passed++;
    } catch (err) {
      console.error(`[FAIL] Case ${caseId}: ${description} -> Expected ${shouldSucceed ? 'ALLOW' : 'DENY'}, but got failure: ${err.message}`);
      matrixResults[caseId] = 'FAIL';
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

    // Teachers
    await setDoc(doc(adminDb, 'institutions/inst_A/teachers/tA'), {
      authUid: 'teacherA_uid',
      name: 'Teacher A1',
      subject: 'Math'
    });
    await setDoc(doc(adminDb, 'institutions/inst_B/teachers/tB'), {
      authUid: 'teacherB_uid',
      name: 'Teacher B1',
      subject: 'Physics'
    });

    // Students
    await setDoc(doc(adminDb, 'institutions/inst_A/students/sA'), {
      authUid: 'studentA_uid',
      name: 'Student A1',
      status: 'ACTIVE',
      parentUid: 'parentA_uid'
    });
    await setDoc(doc(adminDb, 'institutions/inst_A/students/sB'), {
      authUid: 'studentB_uid',
      name: 'Student A2',
      status: 'ACTIVE',
      parentUid: 'parentB_uid'
    });

    // Licenses
    await setDoc(doc(adminDb, 'licenses/lic_A'), {
      institutionId: 'inst_A',
      status: 'ACTIVE',
      code: 'LIC-A-100'
    });
  });

  console.log('--- EXECUTING MANDATORY TEST CASES A THROUGH O ---');

  // A. SuperAdmin reads Institution A = PASS
  await testRule('A', 'SuperAdmin reads Institution A', getDoc(doc(superAdmin, 'institutions/inst_A')), true);

  // B. SuperAdmin reads Institution B = PASS
  await testRule('B', 'SuperAdmin reads Institution B', getDoc(doc(superAdmin, 'institutions/inst_B')), true);

  // C. Owner A reads Institution A = PASS
  await testRule('C', 'Owner A reads Institution A', getDoc(doc(ownerA, 'institutions/inst_A')), true);

  // D. Owner A reads Institution B = DENIED
  await testRule('D', 'Owner A reads Institution B', getDoc(doc(ownerA, 'institutions/inst_B')), false);

  // E. Owner B reads Institution A = DENIED
  await testRule('E', 'Owner B reads Institution A', getDoc(doc(ownerB, 'institutions/inst_A')), false);

  // F. Teacher A reads authorized data = PASS
  await testRule('F', 'Teacher A reads own teacher profile in Inst A', getDoc(doc(teacherA, 'institutions/inst_A/teachers/tA')), true);

  // G. Teacher A reads unauthorized data = DENIED
  await testRule('G', 'Teacher A reads Inst B teacher profile', getDoc(doc(teacherA, 'institutions/inst_B/teachers/tB')), false);

  // H. Student A reads own authorized data = PASS
  await testRule('H', 'Student A reads own student profile in Inst A', getDoc(doc(studentA, 'institutions/inst_A/students/sA')), true);

  // I. Student A reads Student B private data = DENIED
  await testRule('I', 'Student A reads Student B private data', getDoc(doc(studentA, 'institutions/inst_A/students/sB')), false);

  // J. Parent A reads linked child = PASS
  await testRule('J', 'Parent A reads linked child student record', getDoc(doc(parentA, 'institutions/inst_A/students/sA')), true);

  // K. Parent A reads unrelated child = DENIED
  await testRule('K', 'Parent A reads unrelated child student record', getDoc(doc(parentA, 'institutions/inst_A/students/sB')), false);

  // L. Owner tries role escalation = DENIED
  await testRule('L', 'Owner A tries role escalation on user doc', updateDoc(doc(ownerA, 'institutions/inst_A/users/ownerA_uid'), { role: 'superAdmin', updatedAt: 'SERVER_TIMESTAMP' }), false);

  // M. Owner tries institutionId change = DENIED
  await testRule('M', 'Owner A tries institutionId change on institution doc', updateDoc(doc(ownerA, 'institutions/inst_A'), { institutionId: 'inst_HACKED', updatedBy: 'ownerA_uid' }), false);

  // N. Student tries admin write = DENIED
  await testRule('N', 'Student A tries admin write (create student)', setDoc(doc(studentA, 'institutions/inst_A/students/sHacked'), { name: 'Hacked Student' }), false);

  // O. Teacher tries SuperAdmin operation = DENIED
  await testRule('O', 'Teacher A tries SuperAdmin operation (create license)', setDoc(doc(teacherA, 'licenses/lic_Hacked'), { institutionId: 'inst_A' }), false);

  await testEnv.cleanup();

  console.log('\n============================================================');
  console.log(`PHASE 44 EMULATOR MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('MATRIX SUMMARY:', JSON.stringify(matrixResults, null, 2));
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase44TestMatrix().catch(err => {
  console.error('CRITICAL PHASE 44 EMULATOR MATRIX EXCEPTION:', err);
  process.exit(1);
});
