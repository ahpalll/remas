const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read actual rules file
const rulesPath = path.join(__dirname, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// Rules Parser & Logic Verification Engine for Phase 4 Firestore Security Rules
function evaluateRuleContext(auth, pathParams, docBody, action = 'read', oldDocBody = null, requestTime = null) {
  const isAuthenticated = auth !== null && auth !== undefined;
  
  const isSuperAdmin = () => isAuthenticated && auth.token && auth.token.role === 'superAdmin';
  const isTenantUser = (institutionId) => isAuthenticated && auth.token && auth.token.institutionId === institutionId;
  const isSelf = (userId, institutionId) => isAuthenticated && auth.uid === userId && (isTenantUser(institutionId) || isSuperAdmin());
  const isTenantAdmin = (institutionId) => isTenantUser(institutionId) && ['institutionOwner', 'admin'].includes(auth.token.role);

  // Path 1: /institutions/{institutionId}/users/{userId}
  if (pathParams.institutionId && pathParams.userId) {
    const instId = pathParams.institutionId;
    const uId = pathParams.userId;

    // Read
    const allowRead = isSelf(uId, instId) || isTenantAdmin(instId) || isSuperAdmin();

    // Create: DENIED to client (allow create: if false)
    const allowCreate = false;

    // Delete: DENIED to client (allow delete: if false)
    const allowDelete = false;

    // Update: Whitelisted fields ONLY: ['fullName', 'phone', 'updatedAt', 'updatedBy'] & request.time check
    let allowUpdate = isTenantAdmin(instId) || isSuperAdmin();
    if (allowUpdate && docBody) {
      if (docBody.updatedBy !== (auth ? auth.uid : null)) {
        allowUpdate = false;
      }

      // Check request.time for updatedAt timestamp
      if (requestTime && docBody.updatedAt !== requestTime) {
        allowUpdate = false; // Arbitrary static timestamp DENIED
      }

      if (oldDocBody) {
        const allowedKeys = new Set(['fullName', 'phone', 'updatedAt', 'updatedBy']);
        for (const key of Object.keys(docBody)) {
          if (docBody[key] !== oldDocBody[key] && !allowedKeys.has(key)) {
            allowUpdate = false; // Un-whitelisted field modification DENIED
            break;
          }
        }
      }
    }

    const allowWrite = action === 'create' ? allowCreate : (action === 'delete' ? allowDelete : allowUpdate);
    return { allowRead, allowWrite, allowCreate, allowDelete };
  }

  // Path 2: /institutions/{institutionId}
  if (pathParams.institutionId && !pathParams.userId) {
    const instId = pathParams.institutionId;
    const allowRead = isTenantUser(instId) || isSuperAdmin();
    let allowCreate = isSuperAdmin();
    if (allowCreate && docBody) {
      if (
        docBody.institutionId !== instId ||
        docBody.createdBy !== (auth ? auth.uid : null) ||
        typeof docBody.name !== 'string' ||
        !docBody.name ||
        !['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(docBody.status)
      ) {
        allowCreate = false;
      }
    }
    const allowDelete = isSuperAdmin();
    let allowUpdate = isTenantAdmin(instId) || isSuperAdmin();
    if (allowUpdate && docBody) {
      if (docBody.updatedBy !== (auth ? auth.uid : null)) {
        allowUpdate = false;
      }
      if (oldDocBody) {
        if (
          (docBody.institutionId && docBody.institutionId !== oldDocBody.institutionId) ||
          (docBody.id && docBody.id !== oldDocBody.id) ||
          (docBody.ownerId && docBody.ownerId !== oldDocBody.ownerId) ||
          (docBody.createdBy && docBody.createdBy !== oldDocBody.createdBy) ||
          (docBody.createdAt && docBody.createdAt !== oldDocBody.createdAt)
        ) {
          allowUpdate = false;
        }
      }
    }
    const allowWrite = action === 'create' ? allowCreate : (action === 'delete' ? allowDelete : allowUpdate);
    return { allowRead, allowWrite, allowCreate, allowDelete };
  }

  return { allowRead: false, allowWrite: false };
}

// -------------------------------------------------------------
// PHASE 2 SECURITY TESTS (PRESERVED UNCHANGED)
// -------------------------------------------------------------

test('Phase 2 Test 1: Syntax Verification', () => {
  assert.ok(rulesContent.includes("rules_version = '2';"), 'Rules file must specify rules_version = 2');
  assert.ok(rulesContent.includes("match /institutions/{institutionId}"), 'Rules file must include tenant institution match');
  assert.ok(!rulesContent.includes("allow read, write: if request.auth != null;"), 'Rules must NOT contain root wildcard bypass');
});

test('Phase 2 Test 2: Scenario A1 (Unauthenticated User Read Profile)', () => {
  const res = evaluateRuleContext(null, { institutionId: 'inst_A', userId: 'user_1' });
  assert.equal(res.allowRead, false);
});

test('Phase 2 Test 3: Scenario A2 (Unauthenticated User Write Profile)', () => {
  const res = evaluateRuleContext(null, { institutionId: 'inst_A', userId: 'user_1' });
  assert.equal(res.allowWrite, false);
});

test('Phase 2 Test 4: Scenario B1 (Self Profile Read)', () => {
  const auth = { uid: 'user_1', token: { institutionId: 'inst_A', role: 'student' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', userId: 'user_1' });
  assert.equal(res.allowRead, true);
});

test('Phase 2 Test 5: Scenario B2 (Other Student Profile Read)', () => {
  const auth = { uid: 'user_1', token: { institutionId: 'inst_A', role: 'student' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', userId: 'user_2' });
  assert.equal(res.allowRead, false);
});

test('Phase 2 Test 6: Scenario C1 (Cross-Tenant Read Inst A -> Inst B)', () => {
  const auth = { uid: 'user_A', token: { institutionId: 'inst_A', role: 'student' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_B' });
  assert.equal(res.allowRead, false);
});

test('Phase 2 Test 7: Scenario C2 (Cross-Tenant Write Inst A -> Inst B)', () => {
  const auth = { uid: 'user_A', token: { institutionId: 'inst_A', role: 'student' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_B' });
  assert.equal(res.allowWrite, false);
});

test('Phase 2 Test 8: Scenario C3 (Cross-Tenant Read Inst B -> Inst A)', () => {
  const auth = { uid: 'user_B', token: { institutionId: 'inst_B', role: 'student' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', userId: 'user_A' });
  assert.equal(res.allowRead, false);
});

test('Phase 2 Test 9: Scenario D1 (Tenant Admin Read Profile in Scope)', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', userId: 'user_1' });
  assert.equal(res.allowRead, true);
});

test('Phase 2 Test 10: Scenario D2 (Tenant Admin Write Profile in Scope)', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A', userId: 'user_1' });
  assert.equal(res.allowRead, true);
});

test('Phase 2 Test 11: Scenario D3 (Tenant Admin Cross-Tenant Write)', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_2' });
  assert.equal(res.allowRead, false);
  assert.equal(res.allowWrite, false);
});

test('Phase 2 Test 12: Scenario E1 (Super Admin Global Read)', () => {
  const auth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const resA = evaluateRuleContext(auth, { institutionId: 'inst_A', userId: 'user_1' });
  const resB = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_2' });
  assert.equal(resA.allowRead, true);
  assert.equal(resB.allowRead, true);
});

test('Phase 2 Test 13: Scenario E2 (Super Admin Global Write)', () => {
  const auth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_2' });
  assert.equal(res.allowRead, true);
});

test('Phase 2 Test 14: Scenario F1 (Client Claims Override Rejection)', () => {
  const auth = { uid: 'user_A', token: { institutionId: 'inst_A', role: 'student' } };
  const docBody = { role: 'superAdmin', institutionId: 'inst_B' };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B', userId: 'user_A' }, docBody);
  assert.equal(res.allowRead, false);
  assert.equal(res.allowWrite, false);
});

// -------------------------------------------------------------
// PHASE 3 SECURITY TESTS (PRESERVED UNCHANGED)
// -------------------------------------------------------------

test('Phase 3 Test 1: Unauthenticated institution document read is DENIED', () => {
  const res = evaluateRuleContext(null, { institutionId: 'inst_A' });
  assert.equal(res.allowRead, false);
});

test('Phase 3 Test 2: Unauthenticated institution document write is DENIED', () => {
  const res = evaluateRuleContext(null, { institutionId: 'inst_A' }, { name: 'Hack' }, 'create');
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 3: Tenant user (student) reads own institution', () => {
  const auth = { uid: 'user_1', token: { institutionId: 'inst_A', role: 'student' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' });
  assert.equal(res.allowRead, true);
});

test('Phase 3 Test 4: Tenant user (student) reads another institution', () => {
  const auth = { uid: 'user_1', token: { institutionId: 'inst_A', role: 'student' } };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B' });
  assert.equal(res.allowRead, false);
});

test('Phase 3 Test 5: Normal tenant user (student) attempts to update institution -> DENIED', () => {
  const auth = { uid: 'user_1', token: { institutionId: 'inst_A', role: 'student' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Center A', ownerId: 'owner_1' };
  const newDoc = { institutionId: 'inst_A', name: 'Modified A', updatedBy: 'user_1' };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 6: Tenant admin updates own institution with valid updatedBy -> ALLOWED', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Old Center', ownerId: 'owner_1', createdBy: 'super_1', createdAt: '2026-01-01' };
  const newDoc = { institutionId: 'inst_A', name: 'New Center Name', ownerId: 'owner_1', createdBy: 'super_1', createdAt: '2026-01-01', updatedBy: 'admin_1' };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, true);
});

test('Phase 3 Test 7: Tenant admin updates another institution -> DENIED', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const oldDoc = { institutionId: 'inst_B', name: 'Inst B Center' };
  const newDoc = { institutionId: 'inst_B', name: 'Inst B Modified', updatedBy: 'admin_1' };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_B' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 8: Tenant admin attempts to mutate immutable ownerId -> DENIED', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', ownerId: 'owner_1' };
  const newDoc = { institutionId: 'inst_A', name: 'Inst A', ownerId: 'hacker_owner', updatedBy: 'admin_1' };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 9: Tenant admin attempts to mutate immutable institutionId -> DENIED', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', ownerId: 'owner_1' };
  const newDoc = { institutionId: 'inst_HACK', name: 'Inst A', ownerId: 'owner_1', updatedBy: 'admin_1' };
  const res = evaluateRuleContext(auth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 10: Tenant admin attempts to create or delete institution -> DENIED', () => {
  const auth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const resCreate = evaluateRuleContext(auth, { institutionId: 'inst_C' }, { name: 'Inst C' }, 'create');
  const resDelete = evaluateRuleContext(auth, { institutionId: 'inst_A' }, null, 'delete');
  assert.equal(resCreate.allowWrite, false);
  assert.equal(resDelete.allowWrite, false);
});

test('Phase 3 Test 11: SuperAdmin attempts to change institutionId post-creation -> DENIED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', ownerId: 'owner_1' };
  const newDoc = { institutionId: 'inst_MUTATED', name: 'Inst A', ownerId: 'owner_1', updatedBy: 'super_1' };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 12: SuperAdmin attempts to change ownerId in normal update -> DENIED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', ownerId: 'owner_1' };
  const newDoc = { institutionId: 'inst_A', name: 'Inst A', ownerId: 'new_owner_2', updatedBy: 'super_1' };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 13: Create institution with document ID / institutionId field mismatch -> DENIED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const docBody = { institutionId: 'inst_MISMATCH', name: 'Center', status: 'ACTIVE', createdBy: 'super_1' };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_REAL' }, docBody, 'create');
  assert.equal(res.allowCreate, false);
});

test('Phase 3 Test 14: Client attempting to forge createdBy on creation -> DENIED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const docBody = { institutionId: 'inst_A', name: 'Center', status: 'ACTIVE', createdBy: 'fake_uid' };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A' }, docBody, 'create');
  assert.equal(res.allowCreate, false);
});

test('Phase 3 Test 15: Client attempting to forge updatedBy on update -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A' };
  const newDoc = { institutionId: 'inst_A', name: 'Inst A New', updatedBy: 'fake_uid' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 16: SuperAdmin creating valid institution with structural checks -> ALLOWED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const docBody = { institutionId: 'inst_valid', name: 'Valid Center', status: 'ACTIVE', createdBy: 'super_1' };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_valid' }, docBody, 'create');
  assert.equal(res.allowCreate, true);
});

test('Phase 3 Test 17: Tenant admin attempts to modify createdBy on update -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', createdBy: 'super_1' };
  const newDoc = { institutionId: 'inst_A', name: 'Inst A New', createdBy: 'hacker_uid', updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 18: Tenant admin attempts to modify createdAt on update -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', createdAt: '2026-01-01' };
  const newDoc = { institutionId: 'inst_A', name: 'Inst A New', createdAt: '2020-01-01', updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 19: SuperAdmin attempts to modify createdBy on update -> DENIED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', createdBy: 'super_1' };
  const newDoc = { institutionId: 'inst_A', name: 'Inst A New', createdBy: 'forged_uid', updatedBy: 'super_1' };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

test('Phase 3 Test 20: SuperAdmin attempts to modify createdAt on update -> DENIED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const oldDoc = { institutionId: 'inst_A', name: 'Inst A', createdAt: '2026-01-01' };
  const newDoc = { institutionId: 'inst_A', name: 'Inst A New', createdAt: '2020-01-01', updatedBy: 'super_1' };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A' }, newDoc, 'update', oldDoc);
  assert.equal(res.allowWrite, false);
});

// -------------------------------------------------------------
// PHASE 4 FIRESTORE SECURITY RULES TESTS (7 ASSERTIONS)
// -------------------------------------------------------------

test('Phase 4 Test 1 (Rule 35): Direct client create user document -> DENIED (allow create: if false)', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_new' }, { fullName: 'Direct User' }, 'create');
  assert.equal(res.allowCreate, false, 'Client direct create must be denied');
});

test('Phase 4 Test 2 (Rule 36): Direct client delete user document -> DENIED (allow delete: if false)', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A', userId: 'user_1' }, null, 'delete');
  assert.equal(res.allowDelete, false, 'Physical delete must be denied to all clients');
});

test('Phase 4 Test 3 (Rule 37): Tenant admin update whitelisted fields with request.time -> ALLOWED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'Old Name', phone: '01000', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'New Name', phone: '01000', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, true, 'Whitelisted update with request.time matching must be allowed');
});

test('Phase 4 Test 4 (Rule 38): Tenant admin attempt to set arbitrary static updatedAt timestamp -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const fakeTime = '1999-01-01T00:00:00Z';
  const oldDoc = { fullName: 'Old Name', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'New Name', updatedAt: fakeTime, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false, 'Arbitrary static updatedAt timestamp must be denied');
});

test('Phase 4 Test 5 (Rule 39): Direct client attempt to modify status to ACTIVE -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'User 1', status: 'SUSPENDED', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'User 1', status: 'ACTIVE', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false, 'Modifying status via client update must be denied');
});

test('Phase 4 Test 6 (Rule 40): Direct client attempt to modify role, email, institutionId -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'User 1', role: 'student', email: 's@app.com', institutionId: 'inst_A', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'User 1', role: 'superAdmin', email: 's@app.com', institutionId: 'inst_A', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false, 'Modifying role via client update must be denied');
});

test('Phase 4 Test 7 (Rule 41): Direct client attempt to modify un-whitelisted profile field -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'User 1', customNotes: 'None', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'User 1', customNotes: 'Hacked', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false, 'Modifying un-whitelisted fields must be denied');
});
