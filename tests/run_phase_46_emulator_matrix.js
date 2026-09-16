process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { setDoc, getDoc, doc, updateDoc, Timestamp } = require('firebase/firestore');

async function runPhase46TestMatrix() {
  const rulesPath = path.resolve(__dirname, '../firebase/firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('============================================================');
  console.log('PHASE 46 REAL SUPERADMIN CENTER ONBOARDING RULES MATRIX');
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
  const pendingInvitee = testEnv.authenticatedContext('invitee_uid', { email: 'pending_owner@center.com' }).firestore();

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

    // Pre-existing Institution A & B
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
    await setDoc(doc(adminDb, 'users/ownerA_uid'), {
      uid: 'ownerA_uid',
      email: 'ownerA@center.com',
      role: 'institutionOwner',
      institutionId: 'inst_A'
    });

    // Licenses
    await setDoc(doc(adminDb, 'licenses/lic_A'), {
      licenseId: 'lic_A',
      institutionId: 'inst_A',
      status: 'ACTIVE',
      plan: 'PRO'
    });

    // Device Bindings
    await setDoc(doc(adminDb, 'deviceBindings/bind_A'), {
      bindingId: 'bind_A',
      institutionId: 'inst_A',
      deviceFingerprintHash: 'fp_a_123',
      status: 'BOUND'
    });

    // Students
    await setDoc(doc(adminDb, 'institutions/inst_B/students/sB'), {
      authUid: 'studentB_uid',
      name: 'Student B1',
      status: 'ACTIVE'
    });

    // Invitations
    const futureDate = Timestamp.fromDate(new Date(Date.now() + 864000000));
    const pastDate = Timestamp.fromDate(new Date(Date.now() - 864000000));

    await setDoc(doc(adminDb, 'institutions/inst_A/invitations/inv_valid'), {
      invitationId: 'inv_valid',
      institutionId: 'inst_A',
      email: 'pending_owner@center.com',
      role: 'institutionOwner',
      status: 'PENDING',
      createdAt: Timestamp.now(),
      expiresAt: futureDate
    });

    await setDoc(doc(adminDb, 'institutions/inst_A/invitations/inv_expired'), {
      invitationId: 'inv_expired',
      institutionId: 'inst_A',
      email: 'pending_owner@center.com',
      role: 'institutionOwner',
      status: 'PENDING',
      createdAt: pastDate,
      expiresAt: pastDate
    });

    await setDoc(doc(adminDb, 'institutions/inst_A/invitations/inv_used'), {
      invitationId: 'inv_used',
      institutionId: 'inst_A',
      email: 'pending_owner@center.com',
      role: 'institutionOwner',
      status: 'ACCEPTED',
      createdAt: pastDate,
      expiresAt: futureDate
    });
  });

  console.log('--- EXECUTING MANDATORY PHASE 46 EMULATOR MATRIX F46-01 THROUGH F46-12 ---');

  // F46-01: SuperAdmin creates institution → PASS
  await testRule('F46-01', 'SuperAdmin creates institution', setDoc(doc(superAdmin, 'institutions/inst_C'), { institutionId: 'inst_C', name: 'Center C', status: 'ACTIVE', createdBy: 'superadmin_uid' }), true);

  // F46-02: Owner cannot create institution → DENY
  await testRule('F46-02', 'Owner cannot create institution', setDoc(doc(ownerA, 'institutions/inst_hack'), { institutionId: 'inst_hack', name: 'Hack Center', status: 'ACTIVE', createdBy: 'ownerA_uid' }), false);

  // F46-03: SuperAdmin creates license → PASS
  await testRule('F46-03', 'SuperAdmin creates license', setDoc(doc(superAdmin, 'licenses/lic_C'), { licenseId: 'lic_C', institutionId: 'inst_C', status: 'ACTIVE', plan: 'PRO' }), true);

  // F46-04: Owner modifies license → DENY
  await testRule('F46-04', 'Owner modifies license', updateDoc(doc(ownerA, 'licenses/lic_A'), { status: 'SUSPENDED' }), false);

  // F46-05: SuperAdmin binds device → PASS
  await testRule('F46-05', 'SuperAdmin binds device', setDoc(doc(superAdmin, 'deviceBindings/bind_C'), { bindingId: 'bind_C', institutionId: 'inst_C', deviceFingerprintHash: 'fp_c_999', status: 'BOUND' }), true);

  // F46-06: Owner modifies device binding → DENY
  await testRule('F46-06', 'Owner modifies device binding', updateDoc(doc(ownerA, 'deviceBindings/bind_A'), { status: 'UNBOUND' }), false);

  // F46-07: Owner changes institutionId → DENY
  await testRule('F46-07', 'Owner changes institutionId in user document', updateDoc(doc(ownerA, 'users/ownerA_uid'), { institutionId: 'inst_B' }), false);

  // F46-08: Owner changes role → DENY
  await testRule('F46-08', 'Owner changes role in user document', updateDoc(doc(ownerA, 'users/ownerA_uid'), { role: 'superAdmin' }), false);

  // F46-09: Valid owner invitation → PASS
  await testRule('F46-09', 'Valid owner invitation read by matching user', getDoc(doc(pendingInvitee, 'institutions/inst_A/invitations/inv_valid')), true);

  // F46-10: Expired invitation → DENY
  await testRule('F46-10', 'Expired invitation read', getDoc(doc(pendingInvitee, 'institutions/inst_A/invitations/inv_expired')), false);

  // F46-11: Used invitation → DENY
  await testRule('F46-11', 'Used invitation read', getDoc(doc(pendingInvitee, 'institutions/inst_A/invitations/inv_used')), false);

  // F46-12: Institution A Owner accesses Institution B → DENY
  await testRule('F46-12', 'Institution A Owner accesses Institution B student data', getDoc(doc(ownerA, 'institutions/inst_B/students/sB')), false);

  await testEnv.cleanup();

  console.log('\n============================================================');
  console.log(`PHASE 46 EMULATOR MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('MATRIX SUMMARY:', JSON.stringify(matrixResults, null, 2));
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase46TestMatrix().catch(err => {
  console.error('CRITICAL PHASE 46 EMULATOR MATRIX EXCEPTION:', err);
  process.exit(1);
});
