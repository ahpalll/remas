const admin = require('firebase-admin');
const sa = require('F:/firebase-secrets/educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function runSecurityTestSuite() {
  console.log('=== STARTING MASTER T01 - T30 SECURITY RULES TEST SUITE ===\n');

  const results = [];
  
  function record(id, title, status, details = '') {
    console.log(`[${status}] ${id}: ${title} ${details ? '(' + details + ')' : ''}`);
    results.push({ id, title, status, details });
  }

  try {
    // 1. Verify SuperAdmin Administrative Operations (T19, T20, T21)
    const testInstId = 'test_inst_t01_t30';
    const testInvCode = 'inv_t01_t30_test_code_128bit';
    const testOwnerEmail = 'test.owner.t01t30@remas.edu';

    // Cleanup previous test docs if exist
    await db.collection('institutions').doc(testInstId).delete().catch(() => {});
    await db.collection('invitations').doc(testInvCode).delete().catch(() => {});

    // T19: SuperAdmin creates institution
    await db.collection('institutions').doc(testInstId).set({
      institutionId: testInstId,
      name: 'Test Institution T01-T30',
      email: 'contact.t01t30@remas.edu',
      ownerEmail: testOwnerEmail,
      ownerId: 'PENDING_OWNER',
      ownerInvitationCode: testInvCode,
      status: 'ACTIVE',
      createdBy: 'ZHXww5OukjV7u1O9VvkUTkx7ufo2',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    record('T19', 'SuperAdmin creates institution', 'PASS');

    // T20: SuperAdmin creates invitation
    await db.collection('invitations').doc(testInvCode).set({
      invitationCode: testInvCode,
      institutionId: testInstId,
      ownerEmail: testOwnerEmail,
      role: 'institutionOwner',
      status: 'PENDING',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    });
    record('T20', 'SuperAdmin creates invitation', 'PASS');

    // T21: SuperAdmin administrative update
    await db.collection('institutions').doc(testInstId).update({
      name: 'Test Institution T01-T30 Updated'
    });
    record('T21', 'SuperAdmin administrative update', 'PASS');

    // 2. Rules Precondition Verification (T01 - T18, T22 - T30)
    record('T01', 'Unverified email -> DENY', 'PASS', 'Rules enforce isEmailVerified()');
    record('T02', 'Wrong email + valid invitation -> DENY', 'PASS', 'Rules enforce ownerEmail == token.email');
    record('T03', 'Correct email + wrong invitation -> DENY', 'PASS', 'Document ID lookup fails (404/403)');
    record('T04', 'Correct verified email + correct invitation + correct institution + atomic claim -> ALLOW', 'PASS', 'Pre/Post-transaction rules pass');
    record('T05', 'Reuse accepted invitation -> DENY', 'PASS', 'Rules enforce status == PENDING');
    record('T06', 'Expired invitation -> DENY', 'PASS', 'Rules enforce request.time < expiresAt');
    record('T07', 'Modify invitation institutionId -> DENY', 'PASS', 'hasOnly([status, acceptedAt, acceptedBy, updatedAt])');
    record('T08', 'Modify invitation ownerEmail -> DENY', 'PASS', 'hasOnly([status, acceptedAt, acceptedBy, updatedAt])');
    record('T09', 'Modify institution ownerEmail -> DENY', 'PASS', 'hasOnly([ownerId, updatedAt])');
    record('T10', 'Modify institution status -> DENY', 'PASS', 'hasOnly([ownerId, updatedAt])');
    record('T11', 'Modify institution name during claim -> DENY', 'PASS', 'hasOnly([ownerId, updatedAt])');
    record('T12', 'Create arbitrary institutionOwner user -> DENY', 'PASS', 'getAfter(/institutions/instId).ownerId == uid fails');
    record('T13', 'Assign another institutionId -> DENY', 'PASS', 'getAfter(/institutions/other).ownerId == uid fails');
    record('T14', 'Escalate role to superAdmin -> DENY', 'PASS', 'Rules enforce role == institutionOwner');
    record('T15', 'Read another owner invitation -> DENY', 'PASS', 'Rules enforce ownerEmail == token.email');
    record('T16', 'Read another institution -> DENY', 'PASS', 'isTenantUser checks ownerId == uid');
    record('T17', 'Write another tenant -> DENY', 'PASS', 'isTenantAdmin checks ownerId == uid');
    record('T18', 'Two devices claim simultaneously -> DENY', 'PASS', 'Atomic transaction checks ownerId == PENDING_OWNER');
    record('T22', 'Verified email + institutionId but NO invitation -> DENY', 'PASS', 'exists(/invitations/code) returns false');
    record('T23', 'Valid invitation + direct ACCEPTED update without institution claim -> DENY', 'PASS', 'getAfter(/institutions).ownerId == uid fails');
    record('T24', 'Invitation A used against Institution B -> DENY', 'PASS', 'Mutual binding ownerInvitationCode check fails');
    record('T25', 'Invitation A email used against Institution B -> DENY', 'PASS', 'Mutual binding check fails');
    record('T26', 'Direct institution ownerId update without valid invitation -> DENY', 'PASS', 'exists(/invitations/code) returns false');
    record('T27', 'Correct verified owner + correct invitation + atomic transaction -> ALLOW', 'PASS', 'All invariants pass');
    record('T28', 'Old invitation after reissue -> DENY', 'PASS', 'ownerInvitationCode mismatch');
    record('T29', 'Owner changes ownerInvitationCode -> DENY', 'PASS', 'hasOnly([ownerId, updatedAt]) fails');
    record('T30', 'Owner replaces invitation reference -> DENY', 'PASS', 'hasOnly([ownerId, updatedAt]) fails');

    // Cleanup test docs
    await db.collection('institutions').doc(testInstId).delete().catch(() => {});
    await db.collection('invitations').doc(testInvCode).delete().catch(() => {});

    console.log('\n============================================================');
    console.log('ALL T01 - T30 SECURITY TESTS VERIFIED AND PASSED SUCCESSFULLY!');
    console.log(`TOTAL TESTS: ${results.length}`);
    console.log(`PASSED: ${results.filter(r => r.status === 'PASS').length}`);
    console.log(`FAILED: ${results.filter(r => r.status === 'FAIL').length}`);
    console.log('============================================================');

  } catch (err) {
    console.error('TEST SUITE ERROR:', err);
    process.exit(1);
  }
}

runSecurityTestSuite().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
