const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateParentCaller,
  validateParentChildRelationship,
  getParentDashboard,
  getParentChildren,
  getChildProfile,
  getChildGroups,
  getChildSchedule,
  getChildAttendance,
  getChildGrades,
  getChildExamResults,
  getChildContentAccess
} = require('./parent_service');

// -------------------------------------------------------------
// PHASE 16 PARENT PORTAL BACKEND TESTS (35 ASSERTIONS)
// -------------------------------------------------------------

// ROLE & TENANT AUTHORIZATION TESTS (1-8)
test('Phase 16 Test 1: Valid parent caller authorization (validateParentCaller)', () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const instId = validateParentCaller(caller, 'inst_A');
  assert.equal(instId, 'inst_A');
});

test('Phase 16 Test 2: SuperAdmin caller authorization -> ALLOWED', () => {
  const caller = { uid: 'super_1', role: 'superAdmin' };
  const instId = validateParentCaller(caller, 'inst_B');
  assert.equal(instId, 'inst_B');
});

test('Phase 16 Test 3: Student role attempt -> DENIED (UNAUTHORIZED_ROLE)', () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  assert.throws(() => validateParentCaller(caller, 'inst_A'), /UNAUTHORIZED_ROLE/);
});

test('Phase 16 Test 4: Teacher role attempt -> DENIED (UNAUTHORIZED_ROLE)', () => {
  const caller = { uid: 'teacher_1', role: 'teacher', institutionId: 'inst_A' };
  assert.throws(() => validateParentCaller(caller, 'inst_A'), /UNAUTHORIZED_ROLE/);
});

test('Phase 16 Test 5: Admin role attempt on Parent endpoint -> DENIED (UNAUTHORIZED_ROLE)', () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  assert.throws(() => validateParentCaller(caller, 'inst_A'), /UNAUTHORIZED_ROLE/);
});

test('Phase 16 Test 6: Unauthenticated request -> DENIED (UNAUTHENTICATED)', () => {
  assert.throws(() => validateParentCaller(null, 'inst_A'), /UNAUTHENTICATED/);
});

test('Phase 16 Test 7: Parent A accessing Tenant B -> DENIED (CROSS_TENANT_VIOLATION)', () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  assert.throws(() => validateParentCaller(caller, 'inst_B'), /CROSS_TENANT_VIOLATION/);
});

test('Phase 16 Test 8: Valid Parent-Child relationship check (validateParentChildRelationship)', () => {
  const isAllowed = validateParentChildRelationship('parent_1', 'stu_1', 'inst_A');
  assert.equal(isAllowed, true);
});

// PARENT-CHILD AUTHORIZATION TESTS (9-14)
test('Phase 16 Test 9: Parent accessing un-linked student -> DENIED (UNAUTHORIZED_PARENT_RELATIONSHIP)', () => {
  assert.throws(
    () => validateParentChildRelationship('parent_1', 'stu_unlinked_99', 'inst_A'),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 10: Parent A accessing Parent B child -> DENIED', () => {
  const links = { 'parent_a': ['stu_a_1'], 'parent_b': ['stu_b_1'] };
  assert.throws(
    () => validateParentChildRelationship('parent_a', 'stu_b_1', 'inst_A', links),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 11: Missing childId parameter -> REJECTED (MISSING_CHILD_ID)', () => {
  assert.throws(
    () => validateParentChildRelationship('parent_1', null, 'inst_A'),
    /MISSING_CHILD_ID/
  );
});

test('Phase 16 Test 12: getParentDashboard for authenticated parent', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getParentDashboard(caller);
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.parentUid, 'parent_1');
  assert.ok(res.childrenCount > 0);
});

test('Phase 16 Test 13: getParentDashboard for student role -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(async () => await getParentDashboard(caller), /UNAUTHORIZED_ROLE/);
});

test('Phase 16 Test 14: getParentChildren returns linked children only', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getParentChildren(caller);
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.children.length, 2);
});

// PROFILE, GROUPS, SCHEDULE TESTS (15-22)
test('Phase 16 Test 15: getChildProfile for authorized child', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildProfile(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.profile.fullName, 'محمد أحمد علي');
});

test('Phase 16 Test 16: getChildProfile for unlinked child -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildProfile(caller, { childId: 'stu_hacked_99' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 17: getChildGroups for authorized child', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildGroups(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.ok(res.groups.length > 0);
});

test('Phase 16 Test 18: getChildGroups for unlinked child -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildGroups(caller, { childId: 'stu_other' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 19: getChildSchedule for authorized child', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildSchedule(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.ok(res.schedule.length > 0);
});

test('Phase 16 Test 20: getChildSchedule for unlinked child -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildSchedule(caller, { childId: 'stu_other' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 21: Cross-tenant child profile access -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildProfile(caller, { targetInstitutionId: 'inst_B', childId: 'stu_1' }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 16 Test 22: Unauthenticated child profile access -> DENIED', async () => {
  await assert.rejects(
    async () => await getChildProfile(null, { childId: 'stu_1' }),
    /UNAUTHENTICATED/
  );
});

// ATTENDANCE & GRADES SECURITY TESTS (23-30)
test('Phase 16 Test 23: getChildAttendance returns correct summary stats (Phase 7 rule matching)', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildAttendance(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.summary.totalSessions, 2);
  assert.equal(res.summary.presentCount, 2);
  assert.equal(res.summary.attendancePercentage, 100.0);
});

test('Phase 16 Test 24: getChildAttendance for unlinked child -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildAttendance(caller, { childId: 'stu_other' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 25: getChildGrades returns exam scores & percentages', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildGrades(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.ok(res.grades.length > 0);
  assert.equal(res.grades[0].percentage, 96.0);
});

test('Phase 16 Test 26: getChildGrades does NOT expose answer keys or question bank data', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildGrades(caller, { childId: 'stu_1' });
  assert.equal(res.grades[0].answerKey, undefined);
  assert.equal(res.grades[0].correctAnswer, undefined);
  assert.equal(res.grades[0].questionBankId, undefined);
});

test('Phase 16 Test 27: getChildGrades for unlinked child -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildGrades(caller, { childId: 'stu_other' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 28: getChildExamResults returns read-only online exam summary', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildExamResults(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.results[0].status, 'SUBMITTED');
});

test('Phase 16 Test 29: getChildExamResults does NOT expose answer choices or correct answers', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildExamResults(caller, { childId: 'stu_1' });
  assert.equal(res.results[0].correctAnswers, undefined);
  assert.equal(res.results[0].questionsSnap, undefined);
});

test('Phase 16 Test 30: getChildExamResults for unlinked child -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildExamResults(caller, { childId: 'stu_other' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

// EDUCATIONAL CONTENT & SUBSCRIPTION TESTS (31-35)
test('Phase 16 Test 31: getChildContentAccess returns content availability notice (NO signed playback URLs issued)', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildContentAccess(caller, { childId: 'stu_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.ok(res.contentAvailabilityNotice.length > 0);
  assert.equal(res.signedUrl, undefined);
  assert.equal(res.playbackUrl, undefined);
});

test('Phase 16 Test 32: getChildContentAccess returns active entitlements info (NO plaintext codes or codeHash)', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  const res = await getChildContentAccess(caller, { childId: 'stu_1' });
  assert.equal(res.activeEntitlements[0].status, 'ACTIVE');
  assert.equal(res.activeEntitlements[0].plaintextCode, undefined);
  assert.equal(res.activeEntitlements[0].codeHash, undefined);
});

test('Phase 16 Test 33: getChildContentAccess for unlinked child -> DENIED', async () => {
  const caller = { uid: 'parent_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildContentAccess(caller, { childId: 'stu_other' }),
    /UNAUTHORIZED_PARENT_RELATIONSHIP/
  );
});

test('Phase 16 Test 34: SuperAdmin global parent access to child data -> ALLOWED', async () => {
  const caller = { uid: 'super_1', role: 'superAdmin' };
  const res = await getChildProfile(caller, { targetInstitutionId: 'inst_B', childId: 'stu_1', existingLinks: { 'super_1': ['stu_1'] } });
  assert.equal(res.status, 'SUCCESS');
});

test('Phase 16 Test 35: Teacher role calling getChildProfile -> DENIED', async () => {
  const caller = { uid: 't1', role: 'teacher', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await getChildProfile(caller, { childId: 'stu_1' }),
    /UNAUTHORIZED_ROLE/
  );
});
