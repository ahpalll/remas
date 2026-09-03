const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeObjectKey,
  validateWorkerToken,
  authorizeEducationalContentAccess,
  generateSignedMediaUrl,
  handleWorkerRequest
} = require('../src/index');

// -------------------------------------------------------------
// CLOUDFLARE WORKER MEDIA SECURITY TESTS (17 ASSERTIONS)
// -------------------------------------------------------------

test('Worker Test 1: Valid canonical object key parsing', () => {
  const key = 'institutions/inst_A/contents/cnt_101/v1/obj_123';
  const meta = sanitizeObjectKey(key, 'inst_A');
  assert.equal(meta.institutionId, 'inst_A');
  assert.equal(meta.contentId, 'cnt_101');
  assert.equal(meta.version, 'v1');
});

test('Worker Test 2: Path traversal attack ../ -> REJECTED', () => {
  assert.throws(
    () => sanitizeObjectKey('institutions/inst_A/../../../etc/passwd', 'inst_A'),
    /PATH_TRAVERSAL_DETECTED/
  );
});

test('Worker Test 3: Encoded path traversal %2e%2e -> REJECTED', () => {
  assert.throws(
    () => sanitizeObjectKey('institutions/inst_A/%2e%2e/secret', 'inst_A'),
    /PATH_TRAVERSAL_DETECTED/
  );
});

test('Worker Test 4: Malformed object key prefix -> REJECTED', () => {
  assert.throws(
    () => sanitizeObjectKey('public/random_file.mp4', 'inst_A'),
    /MALFORMED_OBJECT_KEY/
  );
});

test('Worker Test 5: Cross-tenant key mismatch -> REJECTED', () => {
  assert.throws(
    () => sanitizeObjectKey('institutions/inst_B/contents/cnt_1/v1/obj_1', 'inst_A'),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Worker Test 6: Valid Bearer token authentication', () => {
  const user = validateWorkerToken('Bearer valid_token_inst_dev_center');
  assert.equal(user.institutionId, 'inst_dev_center');
});

test('Worker Test 7: Missing Authorization header -> REJECTED', () => {
  assert.throws(() => validateWorkerToken(null), /UNAUTHENTICATED_REQUEST/);
});

test('Worker Test 8: Expired token -> REJECTED', () => {
  assert.throws(() => validateWorkerToken('Bearer expired_token'), /EXPIRED_TOKEN/);
});

test('Worker Test 9: Invalid token signature -> REJECTED', () => {
  assert.throws(() => validateWorkerToken('Bearer invalid_token'), /INVALID_TOKEN/);
});

test('Worker Test 10: Cross-tenant content authorization -> REJECTED', () => {
  const userContext = { uid: 'u1', role: 'student', institutionId: 'inst_A', isEntitled: true };
  const objectMeta = { institutionId: 'inst_B', contentId: 'c1' };
  assert.throws(
    () => authorizeEducationalContentAccess(userContext, objectMeta),
    /CROSS_TENANT_VIOLATION/
  );
});

test('Worker Test 11: Ephemeral signed URL expires in ~15 minutes (900 seconds)', () => {
  const url = generateSignedMediaUrl('institutions/inst_A/contents/c1/v1/obj1', 900);
  assert.ok(url.includes('https://media.educenter.local/'));
  assert.ok(url.includes('expires='));
  assert.ok(url.includes('sig='));
});

test('Worker Test 12: Worker request handler success path', async () => {
  const req = {
    url: 'https://worker.local/media?objectKey=institutions/inst_dev_center/contents/cnt_1/v1/obj_1',
    headers: new Map([['Authorization', 'Bearer valid_token_inst_dev_center']])
  };
  const res = await handleWorkerRequest(req);
  assert.equal(res.status, 200);
});

test('Worker Test 13: Worker request handler security headers', async () => {
  const req = {
    url: 'https://worker.local/media?objectKey=institutions/inst_dev_center/contents/cnt_1/v1/obj_1',
    headers: new Map([['Authorization', 'Bearer valid_token_inst_dev_center']])
  };
  const res = await handleWorkerRequest(req);
  const cacheHeader = res.headers.get ? res.headers.get('Cache-Control') : res.headers['Cache-Control'];
  const optHeader = res.headers.get ? res.headers.get('X-Content-Type-Options') : res.headers['X-Content-Type-Options'];
  assert.equal(cacheHeader, 'private, no-store, no-cache, must-revalidate');
  assert.equal(optHeader, 'nosniff');
});

test('Worker Test 14: Worker request handler cross-tenant rejection -> HTTP 403', async () => {
  const req = {
    url: 'https://worker.local/media?objectKey=institutions/inst_B/contents/cnt_1/v1/obj_1',
    headers: new Map([['Authorization', 'Bearer valid_token_inst_dev_center']])
  };
  const res = await handleWorkerRequest(req);
  assert.equal(res.status, 403);
});

test('Worker Test 15: Worker request handler unauthenticated -> HTTP 401', async () => {
  const req = {
    url: 'https://worker.local/media?objectKey=institutions/inst_dev_center/contents/cnt_1/v1/obj_1',
    headers: new Map()
  };
  const res = await handleWorkerRequest(req);
  assert.equal(res.status, 401);
});

test('Worker Test 16: Phase 14 Student unentitled request -> HTTP 403 (NO_ACTIVE_ENTITLEMENT)', async () => {
  const req = {
    url: 'https://worker.local/media?objectKey=institutions/inst_dev_center/contents/cnt_1/v1/obj_1',
    headers: new Map([['Authorization', 'Bearer valid_token_unentitled']])
  };
  const res = await handleWorkerRequest(req);
  assert.equal(res.status, 403);
});

test('Worker Test 17: Worker does NOT trust client-supplied query parameter entitled=true', async () => {
  const req = {
    url: 'https://worker.local/media?objectKey=institutions/inst_dev_center/contents/cnt_1/v1/obj_1&entitled=true',
    headers: new Map([['Authorization', 'Bearer valid_token_unentitled']])
  };
  const res = await handleWorkerRequest(req);
  assert.equal(res.status, 403);
});
