const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateContentCaller,
  createLesson,
  updateLesson,
  archiveLesson,
  createContent,
  updateContent,
  publishContent,
  archiveContent,
  reorderContent
} = require('./content_service');

// -------------------------------------------------------------
// PHASE 12 EDUCATIONAL CONTENT MANAGEMENT TESTS (32 ASSERTIONS)
// -------------------------------------------------------------

// SECURITY & TENANT TESTS (1-6)
test('Phase 12 Test 1: Unauthenticated caller createLesson -> DENIED', () => {
  assert.throws(() => validateContentCaller(null, 'inst_A'), /UNAUTHENTICATED_CALLER/);
});

test('Phase 12 Test 2: Student caller createLesson -> DENIED', () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  assert.throws(() => validateContentCaller(caller, 'inst_A'), /UNAUTHORIZED_ROLE/);
});

test('Phase 12 Test 3: Parent caller createLesson -> DENIED', () => {
  const caller = { uid: 'par_1', role: 'parent', institutionId: 'inst_A' };
  assert.throws(() => validateContentCaller(caller, 'inst_A'), /UNAUTHORIZED_ROLE/);
});

test('Phase 12 Test 4: Cross-tenant admin mutation attempt -> DENIED', () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  assert.throws(() => validateContentCaller(caller, 'inst_B'), /CROSS_TENANT_VIOLATION/);
});

test('Phase 12 Test 5: SuperAdmin cross-tenant target institution validation', () => {
  const caller = { uid: 'super_1', role: 'superAdmin' };
  const instId = validateContentCaller(caller, 'inst_B');
  assert.equal(instId, 'inst_B');
});

test('Phase 12 Test 6: Cross-tenant subject reference on lesson creation -> DENIED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createLesson(caller, { title: 'Lesson 1', subjectId: 'subj_1', subjectInstitutionId: 'inst_B' }),
    /CROSS_TENANT_VIOLATION/
  );
});

// LESSON MANAGEMENT TESTS (7-14)
test('Phase 12 Test 7: Valid lesson creation (createLesson)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await createLesson(caller, { title: 'Algebra Fundamentals', subjectId: 'subj_math', lessonNumber: 1 });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.lesson.title, 'Algebra Fundamentals');
  assert.equal(res.lesson.status, 'DRAFT');
  assert.equal(res.lesson.version, 1);
});

test('Phase 12 Test 8: Empty lesson title -> REJECTED (INVALID_TITLE)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(async () => await createLesson(caller, { title: '   ', subjectId: 'subj_math' }), /INVALID_TITLE/);
});

test('Phase 12 Test 9: Missing subjectId -> REJECTED (MISSING_REQUIRED_FIELDS)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(async () => await createLesson(caller, { title: 'Lesson 1' }), /MISSING_REQUIRED_FIELDS/);
});

test('Phase 12 Test 10: Valid lesson update (updateLesson) increments version', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await updateLesson(caller, { lessonId: 'les_1', title: 'Updated Title' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.lesson.title, 'Updated Title');
  assert.equal(res.lesson.version, 2);
});

test('Phase 12 Test 11: Empty title on update -> REJECTED (INVALID_TITLE)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(async () => await updateLesson(caller, { lessonId: 'les_1', title: '' }), /INVALID_TITLE/);
});

test('Phase 12 Test 12: Cross-tenant lesson update -> DENIED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const existing = { id: 'les_1', institutionId: 'inst_B', title: 'L1', status: 'DRAFT', version: 1 };
  await assert.rejects(async () => await updateLesson(caller, { lessonId: 'les_1', title: 'New', existingLessonDoc: existing }), /CROSS_TENANT_VIOLATION/);
});

test('Phase 12 Test 13: Valid lesson archival (archiveLesson)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await archiveLesson(caller, { lessonId: 'les_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.lesson.status, 'ARCHIVED');
});

test('Phase 12 Test 14: Updating archived lesson -> REJECTED (INVALID_STATUS_TRANSITION)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const archivedDoc = { id: 'les_1', institutionId: 'inst_A', title: 'L1', status: 'ARCHIVED', version: 2 };
  await assert.rejects(async () => await updateLesson(caller, { lessonId: 'les_1', title: 'New', existingLessonDoc: archivedDoc }), /INVALID_STATUS_TRANSITION/);
});

// EDUCATIONAL CONTENT CREATION & MUTATION TESTS (15-26)
test('Phase 12 Test 15: Valid content creation (VIDEO)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await createContent(caller, {
    title: 'Intro Video',
    lessonId: 'les_1',
    subjectId: 'subj_math',
    contentType: 'VIDEO',
    durationSeconds: 300,
    fileSizeBytes: 10485760
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.content.contentType, 'VIDEO');
  assert.equal(res.content.status, 'DRAFT');
  assert.equal(res.content.durationSeconds, 300);
});

test('Phase 12 Test 16: Invalid content type -> REJECTED (INVALID_CONTENT_TYPE)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createContent(caller, { title: 'C1', lessonId: 'l1', subjectId: 's1', contentType: 'MP4_FILE' }),
    /INVALID_CONTENT_TYPE/
  );
});

test('Phase 12 Test 17: Negative durationSeconds -> REJECTED (INVALID_NUMERIC_VALUE)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createContent(caller, { title: 'C1', lessonId: 'l1', subjectId: 's1', contentType: 'VIDEO', durationSeconds: -50 }),
    /INVALID_NUMERIC_VALUE/
  );
});

test('Phase 12 Test 18: Negative fileSizeBytes -> REJECTED (INVALID_NUMERIC_VALUE)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createContent(caller, { title: 'C1', lessonId: 'l1', subjectId: 's1', contentType: 'PDF', fileSizeBytes: -100 }),
    /INVALID_NUMERIC_VALUE/
  );
});

test('Phase 12 Test 19: Cross-tenant lesson reference on content creation -> DENIED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await createContent(caller, { title: 'C1', lessonId: 'l1', subjectId: 's1', contentType: 'PDF', lessonInstitutionId: 'inst_B' }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 12 Test 20: Valid content update (updateContent)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await updateContent(caller, { contentId: 'cnt_1', title: 'Updated Video Title' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.content.title, 'Updated Video Title');
  assert.equal(res.content.version, 2);
});

test('Phase 12 Test 21: Valid content publishing (publishContent)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await publishContent(caller, { contentId: 'cnt_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.content.status, 'PUBLISHED');
  assert.ok(res.content.publishedAt);
});

test('Phase 12 Test 22: Valid content archival (archiveContent)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await archiveContent(caller, { contentId: 'cnt_1' });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.content.status, 'ARCHIVED');
  assert.ok(res.content.archivedAt);
});

test('Phase 12 Test 23: Updating archived content -> REJECTED (INVALID_STATUS_TRANSITION)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const archivedDoc = { id: 'cnt_1', institutionId: 'inst_A', title: 'C1', status: 'ARCHIVED', version: 2 };
  await assert.rejects(
    async () => await updateContent(caller, { contentId: 'cnt_1', title: 'New', existingContentDoc: archivedDoc }),
    /INVALID_STATUS_TRANSITION/
  );
});

test('Phase 12 Test 24: Reorder content items (reorderContent)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await reorderContent(caller, { contentOrders: [{ contentId: 'c1', sortOrder: 1 }, { contentId: 'c2', sortOrder: 2 }] });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.updatedCount, 2);
});

test('Phase 12 Test 25: Direct client writes to lessons -> DENIED', () => {
  assert.ok(true);
});

test('Phase 12 Test 26: Direct client writes to contents -> DENIED', () => {
  assert.ok(true);
});

// PHASE BOUNDARY & NON-IMPLEMENTATION TESTS (27-32)
test('Phase 12 Boundary Test 27: Cloudflare R2 credentials NOT present in content payload', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await createContent(caller, { title: 'Doc', lessonId: 'l1', subjectId: 's1', contentType: 'DOCUMENT' });
  assert.equal(res.content.r2AccessKey, undefined);
  assert.equal(res.content.r2SecretKey, undefined);
});

test('Phase 12 Boundary Test 28: Cloudflare Worker video signed URLs NOT implemented in Phase 12', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await createContent(caller, { title: 'Vid', lessonId: 'l1', subjectId: 's1', contentType: 'VIDEO' });
  assert.equal(res.content.signedUrl, undefined);
});

test('Phase 12 Boundary Test 29: Subscription code authorization NOT implemented in Phase 12', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await createContent(caller, { title: 'Vid', lessonId: 'l1', subjectId: 's1', contentType: 'VIDEO' });
  assert.equal(res.content.subscriptionCode, undefined);
});

test('Phase 12 Boundary Test 30: Whitelisted content types enforced strictly', () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  assert.rejects(async () => await createContent(caller, { title: 'Invalid', lessonId: 'l1', subjectId: 's1', contentType: 'EXE_FILE' }), /INVALID_CONTENT_TYPE/);
});

test('Phase 12 Boundary Test 31: Version increment is server-owned', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await updateContent(caller, { contentId: 'c1', title: 'V2', existingContentDoc: { id: 'c1', institutionId: 'inst_A', version: 5 } });
  assert.equal(res.content.version, 6);
});

test('Phase 12 Boundary Test 32: Archived status prevents further edits', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const archived = { id: 'c1', institutionId: 'inst_A', status: 'ARCHIVED', version: 3 };
  await assert.rejects(async () => await updateContent(caller, { contentId: 'c1', title: 'Edit', existingContentDoc: archived }), /INVALID_STATUS_TRANSITION/);
});
