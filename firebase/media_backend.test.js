const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCanonicalObjectKey,
  requestUploadSession,
  finalizeMediaUpload,
  requestPlaybackUrl,
  archiveMediaObject
} = require('./media_service');

// -------------------------------------------------------------
// PHASE 13 CLOUDFLARE R2 & MEDIA DELIVERY TESTS (32 ASSERTIONS)
// -------------------------------------------------------------

// OBJECT KEY & PATH TRAVERSAL TESTS (1-6)
test('Phase 13 Test 1: Valid canonical object key structure', () => {
  const key = 'institutions/inst_A/contents/cnt_101/v1/obj_uuid_123';
  assert.ok(validateCanonicalObjectKey(key, 'inst_A'));
});

test('Phase 13 Test 2: Path traversal attack ../ -> REJECTED', () => {
  const key = 'institutions/inst_A/../../../etc/passwd';
  assert.throws(() => validateCanonicalObjectKey(key, 'inst_A'), /PATH_TRAVERSAL_DETECTED/);
});

test('Phase 13 Test 3: Encoded path traversal %2e%2e -> REJECTED', () => {
  const key = 'institutions/inst_A/%2e%2e/secret';
  assert.throws(() => validateCanonicalObjectKey(key, 'inst_A'), /PATH_TRAVERSAL_DETECTED/);
});

test('Phase 13 Test 4: Malformed object key structure -> REJECTED', () => {
  const key = 'uploads/file123.mp4';
  assert.throws(() => validateCanonicalObjectKey(key, 'inst_A'), /MALFORMED_OBJECT_KEY/);
});

test('Phase 13 Test 5: Cross-tenant object key -> DENIED', () => {
  const key = 'institutions/inst_B/contents/cnt_1/v1/obj_1';
  assert.throws(() => validateCanonicalObjectKey(key, 'inst_A'), /CROSS_TENANT_VIOLATION/);
});

test('Phase 13 Test 6: Empty object key -> REJECTED', () => {
  assert.throws(() => validateCanonicalObjectKey('', 'inst_A'), /INVALID_OBJECT_KEY/);
});

// UPLOAD SESSION & VALIDATION TESTS (7-16)
test('Phase 13 Test 7: Valid VIDEO upload session request', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await requestUploadSession(caller, {
    contentId: 'cnt_101',
    contentType: 'VIDEO',
    mimeType: 'video/mp4',
    fileSizeBytes: 104857600
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.mediaStatus, 'UPLOAD_PENDING');
  assert.equal(res.expiresInSeconds, 900);
  assert.ok(res.uploadUrl.includes('https://upload.r2.educenter.local/'));
});

test('Phase 13 Test 8: Valid PDF upload session request', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await requestUploadSession(caller, {
    contentId: 'cnt_102',
    contentType: 'PDF',
    mimeType: 'application/pdf',
    fileSizeBytes: 5242880
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.mediaStatus, 'UPLOAD_PENDING');
});

test('Phase 13 Test 9: Disallowed .exe extension -> REJECTED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, {
      contentId: 'cnt_103',
      contentType: 'VIDEO',
      mimeType: 'video/mp4',
      fileSizeBytes: 1000,
      filename: 'malware.exe'
    }),
    /DISALLOWED_FILE_TYPE/
  );
});

test('Phase 13 Test 10: Disallowed .sh extension -> REJECTED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, {
      contentId: 'cnt_104',
      contentType: 'DOCUMENT',
      mimeType: 'text/plain',
      fileSizeBytes: 1000,
      filename: 'script.sh'
    }),
    /DISALLOWED_FILE_TYPE/
  );
});

test('Phase 13 Test 11: Invalid MIME type for VIDEO -> REJECTED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, {
      contentId: 'cnt_105',
      contentType: 'VIDEO',
      mimeType: 'image/jpeg',
      fileSizeBytes: 5000
    }),
    /INVALID_MIME_TYPE/
  );
});

test('Phase 13 Test 12: Oversized VIDEO file (> 2 GB) -> REJECTED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, {
      contentId: 'cnt_106',
      contentType: 'VIDEO',
      mimeType: 'video/mp4',
      fileSizeBytes: 3 * 1024 * 1024 * 1024
    }),
    /FILE_SIZE_EXCEEDED/
  );
});

test('Phase 13 Test 13: Oversized PDF file (> 100 MB) -> REJECTED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, {
      contentId: 'cnt_107',
      contentType: 'PDF',
      mimeType: 'application/pdf',
      fileSizeBytes: 150 * 1024 * 1024
    }),
    /FILE_SIZE_EXCEEDED/
  );
});

test('Phase 13 Test 14: Student upload session request -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, { contentId: 'c1', contentType: 'PDF', mimeType: 'application/pdf', fileSizeBytes: 100 }),
    /UNAUTHORIZED_ROLE/
  );
});

test('Phase 13 Test 15: Parent upload session request -> DENIED', async () => {
  const caller = { uid: 'par_1', role: 'parent', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, { contentId: 'c1', contentType: 'PDF', mimeType: 'application/pdf', fileSizeBytes: 100 }),
    /UNAUTHORIZED_ROLE/
  );
});

test('Phase 13 Test 16: Cross-tenant upload session request -> DENIED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestUploadSession(caller, { targetInstitutionId: 'inst_B', contentId: 'c1', contentType: 'PDF', mimeType: 'application/pdf', fileSizeBytes: 100 }),
    /CROSS_TENANT_VIOLATION/
  );
});

// FINALIZATION & PLAYBACK ACCESS TESTS (17-26)
test('Phase 13 Test 17: Valid media upload finalization (UPLOAD_PENDING -> READY)', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await finalizeMediaUpload(caller, {
    contentId: 'cnt_101',
    objectKey: 'institutions/inst_A/contents/cnt_101/v1/obj_101'
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.mediaStatus, 'READY');
  assert.ok(res.finalizedAt);
});

test('Phase 13 Test 18: Finalize upload with cross-tenant object key -> DENIED', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await finalizeMediaUpload(caller, { contentId: 'c1', objectKey: 'institutions/inst_B/contents/c1/v1/obj1' }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 13 Test 19: Valid short-lived presigned GET playback URL for student (~15 min)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await requestPlaybackUrl(caller, {
    objectKey: 'institutions/inst_A/contents/cnt_101/v1/obj_101',
    mediaStatus: 'READY'
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.expiresInSeconds, 900);
  assert.ok(res.playbackUrl.includes('https://media.educenter.local/'));
});

test('Phase 13 Test 20: Playback request for media in UPLOAD_PENDING status -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestPlaybackUrl(caller, {
      objectKey: 'institutions/inst_A/contents/cnt_101/v1/obj_101',
      mediaStatus: 'UPLOAD_PENDING'
    }),
    /MEDIA_NOT_READY/
  );
});

test('Phase 13 Test 21: Playback request for media in PROCESSING status -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestPlaybackUrl(caller, {
      objectKey: 'institutions/inst_A/contents/cnt_101/v1/obj_101',
      mediaStatus: 'PROCESSING'
    }),
    /MEDIA_NOT_READY/
  );
});

test('Phase 13 Test 22: Playback request for media in FAILED status -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestPlaybackUrl(caller, {
      objectKey: 'institutions/inst_A/contents/cnt_101/v1/obj_101',
      mediaStatus: 'FAILED'
    }),
    /MEDIA_NOT_READY/
  );
});

test('Phase 13 Test 23: Student request playback for another tenant media -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestPlaybackUrl(caller, {
      targetInstitutionId: 'inst_B',
      objectKey: 'institutions/inst_B/contents/cnt_101/v1/obj_101',
      mediaStatus: 'READY'
    }),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Phase 13 Test 24: Unauthenticated playback request -> DENIED', async () => {
  await assert.rejects(
    async () => await requestPlaybackUrl(null, { objectKey: 'institutions/inst_A/contents/c1/v1/o1' }),
    /UNAUTHENTICATED_CALLER/
  );
});

test('Phase 13 Test 25: Valid media object archiving', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await archiveMediaObject(caller, {
    objectKey: 'institutions/inst_A/contents/cnt_101/v1/obj_101'
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.mediaStatus, 'ARCHIVED');
});

test('Phase 13 Test 26: Playback request for ARCHIVED media -> DENIED', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  await assert.rejects(
    async () => await requestPlaybackUrl(caller, {
      objectKey: 'institutions/inst_A/contents/cnt_101/v1/obj_101',
      mediaStatus: 'ARCHIVED'
    }),
    /MEDIA_NOT_READY/
  );
});

// PHASE BOUNDARY & SECURITY VERIFICATION TESTS (27-32)
test('Phase 13 Boundary Test 27: R2 access keys/secrets NOT present in returned upload DTO', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await requestUploadSession(caller, { contentId: 'c1', contentType: 'PDF', mimeType: 'application/pdf', fileSizeBytes: 100 });
  assert.equal(res.r2AccessKey, undefined);
  assert.equal(res.r2SecretKey, undefined);
});

test('Phase 13 Boundary Test 28: R2 access keys/secrets NOT present in returned playback DTO', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await requestPlaybackUrl(caller, { objectKey: 'institutions/inst_A/contents/c1/v1/o1', mediaStatus: 'READY' });
  assert.equal(res.r2AccessKey, undefined);
  assert.equal(res.r2SecretKey, undefined);
});

test('Phase 13 Boundary Test 29: Subscription code authorization NOT present in Phase 13 backend DTO', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await requestPlaybackUrl(caller, { objectKey: 'institutions/inst_A/contents/c1/v1/o1', mediaStatus: 'READY' });
  assert.equal(res.subscriptionCode, undefined);
  assert.equal(res.packageEntitlement, undefined);
});

test('Phase 13 Boundary Test 30: Presigned GET URL includes short expiry (~15 min)', async () => {
  const caller = { uid: 'stu_1', role: 'student', institutionId: 'inst_A' };
  const res = await requestPlaybackUrl(caller, { objectKey: 'institutions/inst_A/contents/c1/v1/o1', mediaStatus: 'READY' });
  assert.equal(res.expiresInSeconds, 900);
});

test('Phase 13 Boundary Test 31: Canonical object key prevents original filename leakage', async () => {
  const caller = { uid: 'admin_1', role: 'admin', institutionId: 'inst_A' };
  const res = await requestUploadSession(caller, { contentId: 'c1', contentType: 'PDF', mimeType: 'application/pdf', fileSizeBytes: 100, filename: 'confidential_exam_2026.pdf' });
  assert.ok(!res.objectKey.includes('confidential_exam_2026.pdf'));
});

test('Phase 13 Boundary Test 32: SuperAdmin global playback request', async () => {
  const caller = { uid: 'super_1', role: 'superAdmin' };
  const res = await requestPlaybackUrl(caller, { targetInstitutionId: 'inst_B', objectKey: 'institutions/inst_B/contents/c1/v1/o1', mediaStatus: 'READY' });
  assert.equal(res.status, 'SUCCESS');
});
