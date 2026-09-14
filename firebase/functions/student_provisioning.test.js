const assert = require('assert');

// E.164 Egyptian phone normalization helper test suite
function normalizeEgyptianPhone(phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') {
    throw new Error('INVALID_PHONE: Phone number is required');
  }
  let cleaned = phoneInput.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+20')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('01')) {
    cleaned = '2' + cleaned;
  }
  if (cleaned.startsWith('201') && cleaned.length === 12) {
    const canonical = '+' + cleaned;
    if (/^\+201[0125]\d{8}$/.test(canonical)) {
      return canonical;
    }
  }
  throw new Error(`INVALID_PHONE_FORMAT: Phone '${phoneInput}' is not a valid Egyptian mobile number (+201XXXXXXXXX)`);
}

function runTests() {
  console.log('--- RUNNING CLOUD FUNCTIONS UNIT TESTS ---');

  // Test 1: Egyptian Phone E.164 Normalization
  assert.strictEqual(normalizeEgyptianPhone('01011112222'), '+201011112222');
  assert.strictEqual(normalizeEgyptianPhone('+201122223333'), '+201122223333');
  assert.strictEqual(normalizeEgyptianPhone('201255556666'), '+201255556666');
  assert.strictEqual(normalizeEgyptianPhone(' 015 9999 8888 '), '+201599998888');
  console.log('✓ Test 1: Egyptian E.164 Phone Normalization Passed');

  // Test 2: Invalid Phone Rejection
  assert.throws(() => normalizeEgyptianPhone('12345'), /INVALID_PHONE_FORMAT/);
  assert.throws(() => normalizeEgyptianPhone('0223456789'), /INVALID_PHONE_FORMAT/);
  console.log('✓ Test 2: Invalid Phone Rejection Passed');

  // Test 3: Caller Authorization Logic
  function validateCaller(context, data) {
    if (!context || !context.auth) throw new Error('UNAUTHENTICATED');
    const callerRole = context.auth.token.role;
    const callerInstId = context.auth.token.institutionId;

    if (!['institutionOwner', 'admin', 'superAdmin'].includes(callerRole)) {
      throw new Error('PERMISSION_DENIED');
    }

    if (callerRole !== 'superAdmin') {
      if (data.institutionId && data.institutionId !== callerInstId) {
        throw new Error('CROSS_TENANT_DENIED');
      }
      return callerInstId;
    }
    return data.institutionId;
  }

  const instAAdminContext = { auth: { uid: 'admin_a', token: { role: 'admin', institutionId: 'inst_A' } } };
  const studentContext = { auth: { uid: 'stu_1', token: { role: 'student', institutionId: 'inst_A' } } };

  assert.strictEqual(validateCaller(instAAdminContext, {}), 'inst_A');
  assert.throws(() => validateCaller(instAAdminContext, { institutionId: 'inst_B' }), /CROSS_TENANT_DENIED/);
  assert.throws(() => validateCaller(studentContext, {}), /PERMISSION_DENIED/);
  assert.throws(() => validateCaller(null, {}), /UNAUTHENTICATED/);
  console.log('✓ Test 3: Caller Authorization & Tenant Boundary Passed');

  console.log('ALL CLOUD FUNCTION UNIT TESTS PASSED SUCCESSFULLY.');
}

runTests();
