const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  hashSubscriptionCode,
  generateRandomPlaintextCode,
  createPackage,
  generateSubscriptionCodes,
  redeemSubscriptionCode,
  evaluateStudentContentAccess
} = require('./subscription_service');

// -------------------------------------------------------------
// PHASE 14 SUBSCRIPTION CODES & ENTITLEMENT TESTS (35 ASSERTIONS)
// -------------------------------------------------------------

// HASHING & CODE GENERATION TESTS (1-5)
test('Phase 14 Test 1: Code hashing normalizes uppercase & whitespace', () => {
  const hash1 = hashSubscriptionCode('  sub-1234-5678-90ab  ');
  const hash2 = hashSubscriptionCode('SUB-1234-5678-90AB');
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 hex string
});

test('Phase 14 Test 2: Invalid code format (< 8 chars) -> REJECTED', () => {
  assert.throws(() => hashSubscriptionCode('ABC1'), /INVALID_CODE_FORMAT/);
});

test('Phase 14 Test 3: Random plaintext code generation format', () => {
  const plain = generateRandomPlaintextCode('SUB');
  assert.ok(plain.startsWith('SUB-'));
  assert.equal(plain.length, 18); // SUB-XXXX-XXXX-XXXX
});

test('Phase 14 Test 4: High entropy plaintext code randomness', () => {
  const plain1 = generateRandomPlaintextCode('SUB');
  const plain2 = generateRandomPlaintextCode('SUB');
  assert.notEqual(plain1, plain2);
});

test('Phase 14 Test 5: Plaintext code is never identical to hash', () => {
  const plain = generateRandomPlaintextCode('SUB');
  const hash = hashSubscriptionCode(plain);
  assert.notEqual(plain, hash);
});

// PACKAGE CREATION TESTS (6-11)
test('Phase 14 Test 6: Valid subscription package creation (createPackage)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await createPackage(caller, {
    name: 'Mathematics Annual Pass',
    durationDays: 365,
    priceMinor: 150000,
    scopeType: 'SUBJECT',
    allowedSubjectIds: ['subj_math']
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.package.name, 'Mathematics Annual Pass');
  assert.equal(res.package.durationDays, 365);
  assert.equal(res.package.status, 'ACTIVE');
});

test('Phase 14 Test 7: Empty package name -> REJECTED (INVALID_PACKAGE_NAME)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createPackage(caller, { name: '', durationDays: 30 }),
    /INVALID_PACKAGE_NAME/
  );
});

test('Phase 14 Test 8: Non-positive durationDays -> REJECTED (INVALID_DURATION)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createPackage(caller, { name: 'P1', durationDays: -10 }),
    /INVALID_DURATION/
  );
});

test('Phase 14 Test 9: Invalid scopeType -> REJECTED (INVALID_SCOPE_TYPE)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createPackage(caller, { name: 'P1', durationDays: 30, scopeType: 'GLOBAL_ALL' }),
    /INVALID_SCOPE_TYPE/
  );
});

test('Phase 14 Test 10: Cross-tenant subject reference in package -> DENIED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createPackage(caller, { name: 'P1', durationDays: 30, subjectInstitutionId: 'inst_B' }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 14 Test 11: Student package creation -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createPackage(caller, { name: 'P1', durationDays: 30 }),
    /UNAUTHORIZED_ROLE/
  );
});

// CODE GENERATION TESTS (12-16)
test('Phase 14 Test 12: Valid subscription code generation (generateSubscriptionCodes)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await generateSubscriptionCodes(caller, { packageId: 'pkg_1', count: 5, prefix: 'VIP' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.generatedCount, 5);
  assert.equal(res.plaintextCodes.length, 5);
  assert.ok(res.plaintextCodes[0].startsWith('VIP-'));
});

test('Phase 14 Test 13: Generating codes for suspended package -> REJECTED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const suspendedPkg = { id: 'pkg_1', institutionId: 'inst_A', status: 'SUSPENDED' };
  await assert.rejects(
    async () => await generateSubscriptionCodes(caller, { packageId: 'pkg_1', existingPackageDoc: suspendedPkg }),
    /INVALID_PACKAGE_STATUS/
  );
});

test('Phase 14 Test 14: Cross-tenant code generation -> DENIED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const instBPkg = { id: 'pkg_1', institutionId: 'inst_B', status: 'ACTIVE' };
  await assert.rejects(
    async () => await generateSubscriptionCodes(caller, { packageId: 'pkg_1', existingPackageDoc: instBPkg }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 14 Test 15: Student code generation attempt -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await generateSubscriptionCodes(caller, { packageId: 'pkg_1' }),
    /UNAUTHORIZED_ROLE/
  );
});

test('Phase 14 Test 16: Parent code generation attempt -> DENIED', async () => {
  const caller = { uid: 'par_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await generateSubscriptionCodes(caller, { packageId: 'pkg_1' }),
    /UNAUTHORIZED_ROLE/
  );
});

// CODE REDEMPTION & ATOMICITY TESTS (17-25)
test('Phase 14 Test 17: Valid student code redemption (redeemSubscriptionCode)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await redeemSubscriptionCode(caller, {
    plaintextCode: 'SUB-1234-5678-90AB',
    requestId: 'req_001'
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.code.status, 'REDEEMED');
  assert.equal(res.code.redeemedBy, 'stu_1');
  assert.equal(res.entitlement.status, 'ACTIVE');
  assert.ok(res.entitlement.expiresAt);
});

test('Phase 14 Test 18: Double redemption attempt -> DENIED (CODE_ALREADY_REDEEMED)', async () => {
  const caller = { uid: 'stu_2', role: 'student', institutionId: 'inst_A' };
  const redeemedCode = { id: 'sc_1', institutionId: 'inst_A', status: 'REDEEMED' };
  await assert.rejects(
    async () => await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-1234-5678-90AB', requestId: 'req_002', existingCodeDoc: redeemedCode }),
    /CODE_ALREADY_REDEEMED/
  );
});

test('Phase 14 Test 19: Redemption request idempotency (Same requestId returns original result)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res1 = await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-9999-8888-7777', requestId: 'req_idempotent_1' });
  const res2 = await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-9999-8888-7777', requestId: 'req_idempotent_1' });
  assert.equal(res2.idempotencyReplay, true);
  assert.equal(res1.entitlement.id, res2.entitlement.id);
});

test('Phase 14 Test 20: Idempotency payload mismatch (Same requestId + different code -> REJECTED)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-1111-2222-3333', requestId: 'req_idempotent_2' });
  await assert.rejects(
    async () => await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-4444-5555-6666', requestId: 'req_idempotent_2' }),
    /IDEMPOTENCY_PAYLOAD_MISMATCH/
  );
});

test('Phase 14 Test 21: Assigned code redeemed by assigned student -> ALLOWED', async () => {
  const caller = { uid: 'stu_assigned', role: 'student', institutionId: 'inst_A' };
  const assignedCode = { id: 'sc_1', institutionId: 'inst_A', status: 'ASSIGNED', redemptionMode: 'ASSIGNED', assignedStudentId: 'stu_assigned' };
  const res = await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-ASSIGNED-11', requestId: 'req_003', existingCodeDoc: assignedCode });
  assert.equal(res.status, 'SUCCESS');
});

test('Phase 14 Test 22: Assigned code redeemed by different student -> DENIED', async () => {
  const caller = { uid: 'stu_other', role: 'student', institutionId: 'inst_A' };
  const assignedCode = { id: 'sc_1', institutionId: 'inst_A', status: 'ASSIGNED', redemptionMode: 'ASSIGNED', assignedStudentId: 'stu_assigned' };
  await assert.rejects(
    async () => await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-ASSIGNED-11', requestId: 'req_004', existingCodeDoc: assignedCode }),
    /CODE_ASSIGNED_TO_OTHER_STUDENT/
  );
});

test('Phase 14 Test 23: Student A redeeming code from Institution B -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const instBCode = { id: 'sc_b', institutionId: 'inst_B', status: 'AVAILABLE' };
  await assert.rejects(
    async () => await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-INST-B', requestId: 'req_005', existingCodeDoc: instBCode }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 14 Test 24: Redemption of code associated with inactive package -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const inactivePkg = { id: 'pkg_inactive', institutionId: 'inst_A', status: 'SUSPENDED' };
  await assert.rejects(
    async () => await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-INACTIVE', requestId: 'req_006', existingPackageDoc: inactivePkg }),
    /PACKAGE_NOT_ACTIVE/
  );
});

test('Phase 14 Test 25: Missing requestId on redemption -> REJECTED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-1234-5678-90AB' }),
    /MISSING_REQUIRED_FIELDS/
  );
});

// ENTITLEMENT SCOPE & ACCESS EVALUATION TESTS (26-35)
test('Phase 14 Test 26: SUBJECT scope entitlement evaluation -> ALLOWED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await evaluateStudentContentAccess(caller, { contentId: 'cnt_1', subjectId: 'subj_math' });
  assert.equal(res.authorized, true);
});

test('Phase 14 Test 27: Expired entitlement evaluation -> DENIED (NO_ACTIVE_ENTITLEMENT_FOUND)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const expiredEntitlement = [{
    id: 'ent_1',
    institutionId: 'inst_A',
    studentId: 'stu_1',
    scopeType: 'SUBJECT',
    subjectIds: ['subj_math'],
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() - 100000).toISOString() // Expired
  }];
  const res = await evaluateStudentContentAccess(caller, { contentId: 'cnt_1', subjectId: 'subj_math', existingEntitlements: expiredEntitlement });
  assert.equal(res.authorized, false);
  assert.equal(res.reason, 'NO_ACTIVE_ENTITLEMENT_FOUND');
});

test('Phase 14 Test 28: Suspended entitlement evaluation -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const suspendedEntitlement = [{
    id: 'ent_1',
    institutionId: 'inst_A',
    studentId: 'stu_1',
    scopeType: 'SUBJECT',
    subjectIds: ['subj_math'],
    status: 'SUSPENDED',
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  }];
  const res = await evaluateStudentContentAccess(caller, { contentId: 'cnt_1', subjectId: 'subj_math', existingEntitlements: suspendedEntitlement });
  assert.equal(res.authorized, false);
});

test('Phase 14 Test 29: LESSON scope entitlement evaluation -> ALLOWED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const lessonEntitlement = [{
    id: 'ent_les',
    institutionId: 'inst_A',
    studentId: 'stu_1',
    scopeType: 'LESSON',
    lessonIds: ['les_algebra_1'],
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  }];
  const res = await evaluateStudentContentAccess(caller, { contentId: 'cnt_1', subjectId: 'subj_math', lessonId: 'les_algebra_1', existingEntitlements: lessonEntitlement });
  assert.equal(res.authorized, true);
});

test('Phase 14 Test 30: CONTENT scope entitlement evaluation -> ALLOWED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const contentEntitlement = [{
    id: 'ent_cnt',
    institutionId: 'inst_A',
    studentId: 'stu_1',
    scopeType: 'CONTENT',
    contentIds: ['cnt_special_video'],
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  }];
  const res = await evaluateStudentContentAccess(caller, { contentId: 'cnt_special_video', subjectId: 'subj_math', existingEntitlements: contentEntitlement });
  assert.equal(res.authorized, true);
});

test('Phase 14 Test 31: Multiple active entitlements evaluation (ANY valid entitlement grants access)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const multipleEntitlements = [
    { id: 'ent_1', institutionId: 'inst_A', studentId: 'stu_1', scopeType: 'SUBJECT', subjectIds: ['subj_physics'], status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000).toISOString() },
    { id: 'ent_2', institutionId: 'inst_A', studentId: 'stu_1', scopeType: 'SUBJECT', subjectIds: ['subj_math'], status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000).toISOString() }
  ];
  const res = await evaluateStudentContentAccess(caller, { contentId: 'cnt_1', subjectId: 'subj_math', existingEntitlements: multipleEntitlements });
  assert.equal(res.authorized, true);
});

test('Phase 14 Test 32: Student requesting access to Institution B content -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await evaluateStudentContentAccess(caller, { contentInstitutionId: 'inst_B', contentId: 'cnt_b', subjectId: 'subj_math' }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 14 Test 33: Plaintext code is never present in returned entitlement DTO', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-SECRET-CODE-99', requestId: 'req_007' });
  assert.equal(res.entitlement.plaintextCode, undefined);
  assert.equal(res.entitlement.codeHash, undefined);
});

test('Phase 14 Test 34: Plaintext code is never present in returned code doc DTO post-redemption', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await redeemSubscriptionCode(caller, { plaintextCode: 'SUB-SECRET-CODE-99', requestId: 'req_008' });
  assert.equal(res.code.plaintextCode, undefined);
});

test('Phase 14 Test 35: SuperAdmin global student access evaluation', async () => {
  const caller = { uid: 'super_1', role: 'superAdmin' };
  const res = await evaluateStudentContentAccess(caller, { targetInstitutionId: 'inst_B', contentId: 'cnt_1', subjectId: 'subj_math', studentId: 'stu_b' });
  assert.equal(res.authorized, true);
});
