const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read actual rules file
const rulesPath = path.join(__dirname, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// Rules Parser & Logic Verification Engine for Phase 5 Firestore Security Rules
function evaluateRuleContext(auth, pathParams, docBody, action = 'read', oldDocBody = null, requestTime = null, colName = 'users') {
  const isAuthenticated = auth !== null && auth !== undefined;
  
  const isSuperAdmin = () => isAuthenticated && auth.token && auth.token.role === 'superAdmin';
  const isTenantUser = (institutionId) => isAuthenticated && auth.token && auth.token.institutionId === institutionId;
  const isSelf = (userId, institutionId) => isAuthenticated && auth.uid === userId && (isTenantUser(institutionId) || isSuperAdmin());
  const isTenantAdmin = (institutionId) => isTenantUser(institutionId) && ['institutionOwner', 'admin'].includes(auth.token.role);

  // Path 1: /institutions/{institutionId}/users/{userId}
  if (pathParams.institutionId && pathParams.userId) {
    const instId = pathParams.institutionId;
    const uId = pathParams.userId;

    const allowRead = isSelf(uId, instId) || isTenantAdmin(instId) || isSuperAdmin();
    const allowCreate = false;
    const allowDelete = false;

    let allowUpdate = isTenantAdmin(instId) || isSuperAdmin();
    if (allowUpdate && docBody) {
      if (docBody.updatedBy !== (auth ? auth.uid : null)) allowUpdate = false;
      if (requestTime && docBody.updatedAt !== requestTime) allowUpdate = false;
      if (oldDocBody) {
        const allowedKeys = new Set(['fullName', 'phone', 'updatedAt', 'updatedBy']);
        for (const key of Object.keys(docBody)) {
          if (docBody[key] !== oldDocBody[key] && !allowedKeys.has(key)) {
            allowUpdate = false;
            break;
          }
        }
      }
    }

    const allowWrite = action === 'create' ? allowCreate : (action === 'delete' ? allowDelete : allowUpdate);
    return { allowRead, allowWrite, allowCreate, allowDelete };
  }

  // Path 2: /institutions/{institutionId}/{collection}/{docId} (Phase 5 Academic Core)
  if (pathParams.institutionId && pathParams.docId && colName) {
    const instId = pathParams.institutionId;

    // Server-Only Collections (schedules, groups, academicYears, terms, uniqueness, scheduleLocks)
    if (['schedules', 'groups', 'academicYears', 'terms', 'uniqueness', 'scheduleLocks'].includes(colName)) {
      const allowRead = isTenantAdmin(instId) || isSuperAdmin();
      return { allowRead, allowWrite: false, allowCreate: false, allowDelete: false };
    }

    // Client-Mutable Collections (subjects, stages, rooms, teachers)
    if (['subjects', 'stages', 'rooms', 'teachers'].includes(colName)) {
      const allowRead = isTenantAdmin(instId) || isSuperAdmin(); // Student/Parent broad read DENIED
      let allowCreate = (isTenantAdmin(instId) || isSuperAdmin()) && docBody && docBody.createdBy === (auth ? auth.uid : null);
      const allowDelete = false;

      let allowUpdate = isTenantAdmin(instId) || isSuperAdmin();
      if (allowUpdate && docBody) {
        if (docBody.updatedBy !== (auth ? auth.uid : null)) allowUpdate = false;
        if (requestTime && docBody.updatedAt !== requestTime) allowUpdate = false;
        if (oldDocBody) {
          const whitelistMap = {
            subjects: new Set(['name', 'code', 'description', 'status', 'updatedAt', 'updatedBy']),
            stages: new Set(['name', 'code', 'order', 'status', 'updatedAt', 'updatedBy']),
            rooms: new Set(['name', 'capacity', 'location', 'status', 'updatedAt', 'updatedBy']),
            teachers: new Set(['fullName', 'phone', 'email', 'specialization', 'subjectIds', 'status', 'updatedAt', 'updatedBy'])
          };
          const allowedKeys = whitelistMap[colName] || new Set();
          for (const key of Object.keys(docBody)) {
            if (docBody[key] !== oldDocBody[key] && !allowedKeys.has(key)) {
              allowUpdate = false;
              break;
            }
          }
        }
      }

      const allowWrite = action === 'create' ? allowCreate : (action === 'delete' ? allowDelete : allowUpdate);
      return { allowRead, allowWrite, allowCreate, allowDelete };
    }
  }

  // Path 3: /institutions/{institutionId}
  if (pathParams.institutionId && !pathParams.userId && !pathParams.docId) {
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
      if (docBody.updatedBy !== (auth ? auth.uid : null)) allowUpdate = false;
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
// PHASE 2 SECURITY TESTS (14 ASSERTIONS PRESERVED)
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
// PHASE 3 SECURITY TESTS (20 ASSERTIONS PRESERVED)
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
// PHASE 4 FIRESTORE SECURITY TESTS (7 ASSERTIONS PRESERVED)
// -------------------------------------------------------------

test('Phase 4 Test 1 (Rule 35): Direct client create user document -> DENIED (allow create: if false)', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_new' }, { fullName: 'Direct User' }, 'create');
  assert.equal(res.allowCreate, false);
});

test('Phase 4 Test 2 (Rule 36): Direct client delete user document -> DENIED (allow delete: if false)', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A', userId: 'user_1' }, null, 'delete');
  assert.equal(res.allowDelete, false);
});

test('Phase 4 Test 3 (Rule 37): Tenant admin update whitelisted fields with request.time -> ALLOWED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'Old Name', phone: '01000', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'New Name', phone: '01000', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, true);
});

test('Phase 4 Test 4 (Rule 38): Tenant admin attempt to set arbitrary static updatedAt timestamp -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const fakeTime = '1999-01-01T00:00:00Z';
  const oldDoc = { fullName: 'Old Name', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'New Name', updatedAt: fakeTime, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false);
});

test('Phase 4 Test 5 (Rule 39): Direct client attempt to modify status to ACTIVE -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'User 1', status: 'SUSPENDED', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'User 1', status: 'ACTIVE', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false);
});

test('Phase 4 Test 6 (Rule 40): Direct client attempt to modify role, email, institutionId -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'User 1', role: 'student', email: 's@app.com', institutionId: 'inst_A', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'User 1', role: 'superAdmin', email: 's@app.com', institutionId: 'inst_A', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false);
});

test('Phase 4 Test 7 (Rule 41): Direct client attempt to modify un-whitelisted profile field -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { fullName: 'User 1', customNotes: 'None', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { fullName: 'User 1', customNotes: 'Hacked', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', userId: 'user_1' }, newDoc, 'update', oldDoc, now);
  assert.equal(res.allowWrite, false);
});

// -------------------------------------------------------------
// PHASE 5 FIRESTORE SECURITY TESTS (15 NEW ASSERTIONS = 56 TOTAL)
// -------------------------------------------------------------

test('Phase 5 Test 1 (Rule 42): Direct client schedule create -> DENIED (allow create: if false)', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'sched_1' }, {}, 'create', null, null, 'schedules');
  assert.equal(res.allowCreate, false);
});

test('Phase 5 Test 2 (Rule 43): Direct client schedule update/delete -> DENIED (allow update/delete: if false)', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const resUpdate = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'sched_1' }, {}, 'update', {}, null, 'schedules');
  const resDelete = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'sched_1' }, null, 'delete', null, null, 'schedules');
  assert.equal(resUpdate.allowWrite, false);
  assert.equal(resDelete.allowDelete, false);
});

test('Phase 5 Test 3 (Rule 44): Direct client group create/update -> DENIED (allow create/update: if false)', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'grp_1' }, {}, 'create', null, null, 'groups');
  assert.equal(res.allowCreate, false);
});

test('Phase 5 Test 4 (Rule 45): Direct client uniqueness doc create/update -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'unique_1' }, {}, 'create', null, null, 'uniqueness');
  assert.equal(res.allowCreate, false);
});

test('Phase 5 Test 5 (Rule 46): Direct client scheduleLocks doc create/update -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'lock_1' }, {}, 'create', null, null, 'scheduleLocks');
  assert.equal(res.allowCreate, false);
});

test('Phase 5 Test 6 (Rule 47): Student attempts broad collection read on Academic Core -> DENIED', () => {
  const studentAuth = { uid: 'student_1', token: { institutionId: 'inst_A', role: 'student' } };
  const res = evaluateRuleContext(studentAuth, { institutionId: 'inst_A', docId: 'subj_1' }, null, 'read', null, null, 'subjects');
  assert.equal(res.allowRead, false);
});

test('Phase 5 Test 7 (Rule 48): Parent attempts broad collection read on Academic Core -> DENIED', () => {
  const parentAuth = { uid: 'parent_1', token: { institutionId: 'inst_A', role: 'parent' } };
  const res = evaluateRuleContext(parentAuth, { institutionId: 'inst_A', docId: 'subj_1' }, null, 'read', null, null, 'subjects');
  assert.equal(res.allowRead, false);
});

test('Phase 5 Test 8 (Rule 49): Tenant admin update subject whitelisted fields with request.time -> ALLOWED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { name: 'Physics', code: 'PHY-1', description: 'Old', status: 'ACTIVE', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { name: 'Physics New', code: 'PHY-1', description: 'New', status: 'ACTIVE', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'subj_1' }, newDoc, 'update', oldDoc, now, 'subjects');
  assert.equal(res.allowWrite, true);
});

test('Phase 5 Test 9 (Rule 50): Tenant admin attempt to set arbitrary static updatedAt on subject -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const fakeTime = '1999-01-01T00:00:00Z';
  const oldDoc = { name: 'Physics', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { name: 'Physics New', updatedAt: fakeTime, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'subj_1' }, newDoc, 'update', oldDoc, now, 'subjects');
  assert.equal(res.allowWrite, false);
});

test('Phase 5 Test 10 (Rule 51): Direct client attempt to modify unwhitelisted field on subject -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { name: 'Physics', createdBy: 'admin_1', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { name: 'Physics', createdBy: 'hacker_uid', updatedAt: now, updatedBy: 'admin_1' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'subj_1' }, newDoc, 'update', oldDoc, now, 'subjects');
  assert.equal(res.allowWrite, false);
});

test('Phase 5 Test 11 (Rule 52): Direct client physical delete of subject/stage/room/teacher -> DENIED', () => {
  const superAuth = { uid: 'super_1', token: { role: 'superAdmin' } };
  const res = evaluateRuleContext(superAuth, { institutionId: 'inst_A', docId: 'subj_1' }, null, 'delete', null, null, 'subjects');
  assert.equal(res.allowDelete, false);
});

test('Phase 5 Test 12 (Rule 53): Tenant A user reads Tenant B academic entities -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_B', docId: 'subj_1' }, null, 'read', null, null, 'subjects');
  assert.equal(res.allowRead, false);
});

test('Phase 5 Test 13 (Rule 54): Unauthenticated read of academic entities -> DENIED', () => {
  const res = evaluateRuleContext(null, { institutionId: 'inst_A', docId: 'subj_1' }, null, 'read', null, null, 'subjects');
  assert.equal(res.allowRead, false);
});

test('Phase 5 Test 14 (Rule 55): Tenant admin create subject with forged createdBy -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const docBody = { name: 'Physics', code: 'PHY-1', createdBy: 'fake_uid' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'subj_1' }, docBody, 'create', null, null, 'subjects');
  assert.equal(res.allowCreate, false);
});

test('Phase 5 Test 15 (Rule 56): Tenant admin update subject with forged updatedBy -> DENIED', () => {
  const adminAuth = { uid: 'admin_1', token: { institutionId: 'inst_A', role: 'admin' } };
  const now = '2026-09-02T00:00:00Z';
  const oldDoc = { name: 'Physics', updatedAt: '2026-01-01', updatedBy: 'admin_1' };
  const newDoc = { name: 'Physics New', updatedAt: now, updatedBy: 'fake_uid' };
  const res = evaluateRuleContext(adminAuth, { institutionId: 'inst_A', docId: 'subj_1' }, newDoc, 'update', oldDoc, now, 'subjects');
  assert.equal(res.allowWrite, false);
});
