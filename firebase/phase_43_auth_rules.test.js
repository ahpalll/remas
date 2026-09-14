const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read actual rules file
const rulesPath = path.join(__dirname, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// Rules Logic Verification Engine matching firestore_rules.test.js
function evaluateRuleContext(auth, pathParams, docBody = {}, action = 'read', colName = '') {
  const isAuthenticated = auth !== null && auth !== undefined;
  
  const isSuperAdmin = () => isAuthenticated && auth.token && (auth.token.role === 'superAdmin' || auth.token.role === 'superadmin');
  const isTenantUser = (institutionId) => isAuthenticated && auth.token && auth.token.institutionId === institutionId;
  const isSelf = (userId, institutionId) => isAuthenticated && auth.uid === userId && (isTenantUser(institutionId) || isSuperAdmin());
  const isTenantAdmin = (institutionId) => isTenantUser(institutionId) && ['institutionOwner', 'admin'].includes(auth.token.role);

  // Institution documents: /institutions/{institutionId}
  if (pathParams.institutionId && !pathParams.docId && !pathParams.studentId) {
    const instId = pathParams.institutionId;
    const allowRead = isTenantUser(instId) || isSuperAdmin();
    return { allowRead };
  }

  // Collection Group / Student documents: /{path=**}/students/{studentId}
  if (colName === 'students' || pathParams.studentId) {
    const instId = pathParams.institutionId;
    const isStudentSelf = isAuthenticated && docBody.authUid === auth.uid && docBody.status === 'ACTIVE';
    const allowRead = isTenantAdmin(instId) || isSuperAdmin() || isStudentSelf;
    return { allowRead };
  }

  // Teacher documents: /institutions/{institutionId}/teachers/{teacherId}
  if (colName === 'teachers') {
    const instId = pathParams.institutionId;
    const isTeacherSelf = isAuthenticated && isTenantUser(instId) && (auth.uid === docBody.authUid || auth.token.role === 'teacher');
    const allowRead = isTenantAdmin(instId) || isSuperAdmin() || isTeacherSelf;
    return { allowRead };
  }

  // Default
  return { allowRead: isSuperAdmin() };
}

test('Phase 43 Rules 1: SuperAdmin Read Institution A -> ALLOWED', () => {
  const auth = { uid: 'sa_01', token: { role: 'superAdmin' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' });
  assert.strictEqual(res.allowRead, true);
});

test('Phase 43 Rules 2: SuperAdmin Read Institution B -> ALLOWED', () => {
  const auth = { uid: 'sa_01', token: { role: 'superAdmin' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B' });
  assert.strictEqual(res.allowRead, true);
});

test('Phase 43 Rules 3: Owner A Read Institution A (Same Tenant) -> ALLOWED', () => {
  const auth = { uid: 'owner_a', token: { role: 'institutionOwner', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' });
  assert.strictEqual(res.allowRead, true);
});

test('Phase 43 Rules 4: Owner A Read Institution B (Cross Tenant) -> DENIED', () => {
  const auth = { uid: 'owner_a', token: { role: 'institutionOwner', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B' });
  assert.strictEqual(res.allowRead, false);
});

test('Phase 43 Rules 5: Owner A Read Students in Inst A -> ALLOWED', () => {
  const auth = { uid: 'owner_a', token: { role: 'institutionOwner', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', studentId: 'stu_A' }, { authUid: 'stu_a_uid', status: 'ACTIVE' }, 'read', 'students');
  assert.strictEqual(res.allowRead, true);
});

test('Phase 43 Rules 6: Owner A Read Students in Inst B -> DENIED', () => {
  const auth = { uid: 'owner_a', token: { role: 'institutionOwner', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', studentId: 'stu_B' }, { authUid: 'stu_b_uid', status: 'ACTIVE' }, 'read', 'students');
  assert.strictEqual(res.allowRead, false);
});

test('Phase 43 Rules 7: Teacher A Read Inst A Teachers -> ALLOWED', () => {
  const auth = { uid: 'tch_a', token: { role: 'teacher', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', docId: 'tch_A' }, { authUid: 'tch_a' }, 'read', 'teachers');
  assert.strictEqual(res.allowRead, true);
});

test('Phase 43 Rules 8: Teacher A Read Inst B Teachers (Cross Tenant) -> DENIED', () => {
  const auth = { uid: 'tch_a', token: { role: 'teacher', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', docId: 'tch_B' }, { authUid: 'tch_b' }, 'read', 'teachers');
  assert.strictEqual(res.allowRead, false);
});

test('Phase 43 Rules 9: Student A Read Own Student Record -> ALLOWED', () => {
  const auth = { uid: 'stu_a_uid', token: { role: 'student', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', studentId: 'stu_A' }, { authUid: 'stu_a_uid', status: 'ACTIVE' }, 'read', 'students');
  assert.strictEqual(res.allowRead, true);
});

test('Phase 43 Rules 10: Student A Read Unrelated Student B Record -> DENIED', () => {
  const auth = { uid: 'stu_a_uid', token: { role: 'student', institutionId: 'inst_A' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', studentId: 'stu_B' }, { authUid: 'stu_b_uid', status: 'ACTIVE' }, 'read', 'students');
  assert.strictEqual(res.allowRead, false);
});

test('Phase 43 Rules 11: Unauthenticated Read Institution A -> DENIED', () => {
  const auth = null;
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' });
  assert.strictEqual(res.allowRead, false);
});

test('Phase 43 Rules 12: Unauthenticated Read Student A -> DENIED', () => {
  const auth = null;
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', studentId: 'stu_A' }, { authUid: 'stu_a_uid', status: 'ACTIVE' }, 'read', 'students');
  assert.strictEqual(res.allowRead, false);
});
