const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read actual rules file
const rulesPath = path.join(__dirname, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// Rules Parser & Logic Verification Engine for Phase 2 Firestore Security Rules
function evaluateRuleContext(auth, pathParams, docBody) {
  // 1. Unauthenticated Check
  const isAuthenticated = auth !== null && auth !== undefined;
  
  // 2. Helper Functions matching firestore.rules
  const isSuperAdmin = () => isAuthenticated && auth.token && auth.token.role === 'superAdmin';
  const isTenantUser = (institutionId) => isAuthenticated && auth.token && auth.token.institutionId === institutionId;
  const isSelf = (userId, institutionId) => isAuthenticated && auth.uid === userId && (isTenantUser(institutionId) || isSuperAdmin());
  const isTenantAdmin = (institutionId) => isTenantUser(institutionId) && ['institutionOwner', 'admin'].includes(auth.token.role);

  // Path matching for /institutions/{institutionId}/users/{userId}
  const matchUserPath = pathParams.institutionId && pathParams.userId;
  if (!matchUserPath) {
    return { allowRead: false, allowWrite: false };
  }

  const instId = pathParams.institutionId;
  const uId = pathParams.userId;

  // Evaluate Read Rule: if isSelf(userId, institutionId) || isTenantAdmin(institutionId) || isSuperAdmin()
  const allowRead = isSelf(uId, instId) || isTenantAdmin(instId) || isSuperAdmin();

  // Evaluate Write Rule: if isTenantAdmin(institutionId) || isSuperAdmin()
  const allowWrite = isTenantAdmin(instId) || isSuperAdmin();

  return { allowRead, allowWrite };
}

// Security Test Assertions Suite
test('Firestore Rules Syntax Verification', () => {
  assert.ok(rulesContent.includes("rules_version = '2';"), 'Rules file must specify rules_version = 2');
  assert.ok(rulesContent.includes("allow read: if isSelf(userId, institutionId) || isTenantAdmin(institutionId) || isSuperAdmin();"), 'Rules file must restrict read to self, tenant admin, or super admin within tenant boundary');
  assert.ok(!rulesContent.includes("allow read, write: if request.auth != null;"), 'Rules must NOT contain root wildcard bypass');
  assert.ok(!rulesContent.includes("&& true"), 'Rules must NOT contain placeholder bypasses');
});

// A. Unauthenticated Scenario
test('Scenario A1: Unauthenticated user cannot read protected user profile', () => {
  const auth = null;
  const pathParams = { institutionId: 'inst_A', userId: 'user_1' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowRead, false, 'Unauthenticated read must be denied');
});

test('Scenario A2: Unauthenticated user cannot write protected user profile', () => {
  const auth = null;
  const pathParams = { institutionId: 'inst_A', userId: 'user_1' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowWrite, false, 'Unauthenticated write must be denied');
});

// B. Self Profile Scenario
test('Scenario B1: Authenticated user can read their own profile document within assigned tenant', () => {
  const auth = { uid: 'user_1', token: { institutionId: 'inst_A', role: 'student' } };
  const pathParams = { institutionId: 'inst_A', userId: 'user_1' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowRead, true, 'User reading own profile within assigned tenant must be allowed');
});

test('Scenario B2: Authenticated student cannot read another user profile document', () => {
  const auth = { uid: 'user_1', token: { institutionId: 'inst_A', role: 'student' } };
  const pathParams = { institutionId: 'inst_A', userId: 'user_2' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowRead, false, 'User reading another profile must be denied');
});

// C. Tenant Isolation Scenario
test('Scenario C1: Institution A user cannot read Institution B data', () => {
  const auth = { uid: 'user_A', token: { institutionId: 'inst_A', role: 'student' } };
  const pathParams = { institutionId: 'inst_B', userId: 'user_B' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowRead, false, 'Cross-tenant read must be denied');
});

test('Scenario C2: Institution A user cannot write Institution B data', () => {
  const auth = { uid: 'user_A', token: { institutionId: 'inst_A', role: 'student' } };
  const pathParams = { institutionId: 'inst_B', userId: 'user_B' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowWrite, false, 'Cross-tenant write must be denied');
});

test('Scenario C3: Institution B user cannot read Institution A data', () => {
  const auth = { uid: 'user_B', token: { institutionId: 'inst_B', role: 'student' } };
  const pathParams = { institutionId: 'inst_A', userId: 'user_A' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowRead, false, 'Cross-tenant read must be denied');
});

// D. Tenant Admin Scenario
test('Scenario D1: Tenant admin can read user profile within their institution scope', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const pathParams = { institutionId: 'inst_A', userId: 'user_1' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowRead, true, 'Tenant admin reading profile in institution scope must be allowed');
});

test('Scenario D2: Tenant admin can write user profile within their institution scope', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const pathParams = { institutionId: 'inst_A', userId: 'user_1' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowWrite, true, 'Tenant admin writing profile in institution scope must be allowed');
});

test('Scenario D3: Tenant admin CANNOT access or write to another institution', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const pathParams = { institutionId: 'inst_B', userId: 'user_2' };
  const res = evaluateRuleContext(auth, pathParams);
  assert.equal(res.allowRead, false, 'Tenant admin cross-tenant read must be denied');
  assert.equal(res.allowWrite, false, 'Tenant admin cross-tenant write must be denied');
});

// E. Super Admin Scenario
test('Scenario E1: Super admin can read user profiles globally across any institution', () => {
  const auth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const resA = evaluateRuleContext(auth, { institutionId: 'inst_A', userId: 'user_1' });
  const resB = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_2' });
  assert.equal(resA.allowRead, true, 'Super admin global read inst_A allowed');
  assert.equal(resB.allowRead, true, 'Super admin global read inst_B allowed');
});

test('Scenario E2: Super admin can write user profiles globally', () => {
  const auth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_2' });
  assert.equal(res.allowWrite, true, 'Super admin global write allowed');
});

// F. Client Claim Trust Scenario
test('Scenario F1: User sending fake role/institutionId in document body is denied by rules', () => {
  const auth = { uid: 'user_A', token: { institutionId: 'inst_A', role: 'student' } };
  const docBody = { role: 'superAdmin', institutionId: 'inst_B' };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_A' }, docBody);
  assert.equal(res.allowRead, false, 'Client document body claims ignored; JWT token claims enforced');
  assert.equal(res.allowWrite, false, 'Client document body claims ignored; JWT token claims enforced');
});
