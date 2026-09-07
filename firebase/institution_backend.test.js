process.env.NODE_ENV = 'test';

/**
 * Phase 24 — Institution Management & Admin Onboarding Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  createInstitution,
  getInstitution,
  updateInstitution,
  listInstitutions,
  setInstitutionStatus,
  assignInitialAdmin,
  getAuditLogs,
  resetInMemoryState
} = require('./institution_service');

describe('Phase 24 — Institution Management & Tenant Onboarding', () => {

  const superAdminToken = { uid: 'uid_super_admin', role: 'superAdmin' };
  const adminTenant1Token = { uid: 'uid_admin_t1', role: 'institutionOwner', institutionId: 'inst_demo_01' };
  const adminTenant2Token = { uid: 'uid_admin_t2', role: 'admin', institutionId: 'inst_demo_02' };
  const teacherToken = { uid: 'uid_teacher_t1', role: 'teacher', institutionId: 'inst_demo_01' };
  const studentToken = { uid: 'uid_student_t1', role: 'student', institutionId: 'inst_demo_01' };
  const parentToken = { uid: 'uid_parent_t1', role: 'parent', institutionId: 'inst_demo_01' };

  beforeEach(() => {
    resetInMemoryState();
  });

  it('allows SuperAdmin to create a new institution', async () => {
    const res = await createInstitution(superAdminToken, {
      customInstitutionId: 'inst_demo_01',
      name: 'REMAS Primary Center',
      type: 'CENTER',
      status: 'ACTIVE'
    });

    assert.equal(res.status, 'INSTITUTION_CREATED');
    assert.equal(res.institutionId, 'inst_demo_01');
    assert.equal(res.data.name, 'REMAS Primary Center');
    assert.equal(res.data.status, 'ACTIVE');
  });

  it('rejects unauthenticated caller for institution creation', async () => {
    await assert.rejects(
      async () => {
        await createInstitution(null, { name: 'Test Center' });
      },
      (err) => {
        assert.ok(err.message.includes('UNAUTHENTICATED_CALLER'));
        return true;
      }
    );
  });

  it('rejects non-SuperAdmin roles (admin/teacher/student/parent) for institution creation', async () => {
    const rolesToTest = [adminTenant1Token, teacherToken, studentToken, parentToken];

    for (const token of rolesToTest) {
      await assert.rejects(
        async () => {
          await createInstitution(token, { name: 'Unauthorized Center' });
        },
        (err) => {
          assert.equal(err.code, 'UNAUTHORIZED_CALLER_ROLE');
          return true;
        }
      );
    }
  });

  it('prevents duplicate institution creation', async () => {
    await createInstitution(superAdminToken, {
      customInstitutionId: 'inst_demo_dup',
      name: 'Duplicate Test Center'
    });

    await assert.rejects(
      async () => {
        await createInstitution(superAdminToken, {
          customInstitutionId: 'inst_demo_dup',
          name: 'Duplicate Test Center Again'
        });
      },
      (err) => {
        assert.equal(err.code, 'DUPLICATE_INSTITUTION');
        return true;
      }
    );
  });

  it('enforces tenant isolation on getInstitution', async () => {
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_demo_01', name: 'Center 1' });
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_demo_02', name: 'Center 2' });

    // SuperAdmin gets any institution
    const superRes = await getInstitution(superAdminToken, 'inst_demo_01');
    assert.equal(superRes.status, 'SUCCESS');
    assert.equal(superRes.institution.name, 'Center 1');

    // Admin gets own institution
    const ownRes = await getInstitution(adminTenant1Token, 'inst_demo_01');
    assert.equal(ownRes.status, 'SUCCESS');

    // Cross-tenant access attempt -> DENIED
    await assert.rejects(
      async () => {
        await getInstitution(adminTenant1Token, 'inst_demo_02');
      },
      (err) => {
        assert.equal(err.code, 'CROSS_TENANT_VIOLATION');
        return true;
      }
    );
  });

  it('protects immutable fields on updateInstitution', async () => {
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_demo_01', name: 'Original Name' });

    // Attempt to modify institutionId -> DENIED
    await assert.rejects(
      async () => {
        await updateInstitution(adminTenant1Token, 'inst_demo_01', { institutionId: 'inst_hack_01' });
      },
      (err) => {
        assert.equal(err.code, 'IMMUTABLE_FIELD_MODIFICATION');
        return true;
      }
    );

    // Valid update by tenant admin
    const updateRes = await updateInstitution(adminTenant1Token, 'inst_demo_01', { name: 'Updated Center Name' });
    assert.equal(updateRes.status, 'INSTITUTION_UPDATED');
    assert.equal(updateRes.institution.name, 'Updated Center Name');
  });

  it('filters listInstitutions strictly by role authority', async () => {
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_demo_01', name: 'Center 1' });
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_demo_02', name: 'Center 2' });

    // SuperAdmin sees all
    const superList = await listInstitutions(superAdminToken);
    assert.equal(superList.institutions.length, 2);

    // Tenant Admin sees only own tenant
    const adminList = await listInstitutions(adminTenant1Token);
    assert.equal(adminList.institutions.length, 1);
    assert.equal(adminList.institutions[0].institutionId, 'inst_demo_01');

    // Student / Teacher DENIED
    await assert.rejects(
      async () => {
        await listInstitutions(studentToken);
      },
      (err) => {
        assert.equal(err.code, 'UNAUTHORIZED_CALLER_ROLE');
        return true;
      }
    );
  });

  it('supports status lifecycle transitions (ACTIVE, SUSPENDED, ARCHIVED)', async () => {
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_demo_01', name: 'Center 1' });

    // Suspend institution
    const suspendRes = await setInstitutionStatus(superAdminToken, 'inst_demo_01', 'SUSPENDED');
    assert.equal(suspendRes.status, 'STATUS_UPDATED');
    assert.equal(suspendRes.newStatus, 'SUSPENDED');

    // Reactivate institution
    const activateRes = await setInstitutionStatus(superAdminToken, 'inst_demo_01', 'ACTIVE');
    assert.equal(activateRes.status, 'STATUS_UPDATED');
    assert.equal(activateRes.newStatus, 'ACTIVE');

    // Non-SuperAdmin cannot change status -> DENIED
    await assert.rejects(
      async () => {
        await setInstitutionStatus(adminTenant1Token, 'inst_demo_01', 'SUSPENDED');
      },
      (err) => {
        assert.equal(err.code, 'UNAUTHORIZED_CALLER_ROLE');
        return true;
      }
    );
  });

  it('allows SuperAdmin to assign initial Admin to an institution', async () => {
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_demo_01', name: 'Center 1' });

    const assignRes = await assignInitialAdmin(superAdminToken, {
      institutionId: 'inst_demo_01',
      email: 'admin@center1.com',
      fullName: 'Primary Center Admin',
      targetRole: 'institutionOwner'
    });

    assert.equal(assignRes.status, 'ADMIN_ASSIGNED');
    assert.equal(assignRes.institutionId, 'inst_demo_01');
    assert.equal(assignRes.role, 'institutionOwner');
  });

  it('records auditable event logs for institution operations without secret leaks', async () => {
    await createInstitution(superAdminToken, { customInstitutionId: 'inst_audit_01', name: 'Audit Center' });
    await setInstitutionStatus(superAdminToken, 'inst_audit_01', 'SUSPENDED');

    const logs = getAuditLogs();
    assert.ok(logs.length >= 2);

    const createLog = logs.find((l) => l.event === 'INSTITUTION_CREATED');
    assert.ok(createLog);
    assert.equal(createLog.institutionId, 'inst_audit_01');

    const suspendLog = logs.find((l) => l.event === 'INSTITUTION_SUSPENDED');
    assert.ok(suspendLog);
    assert.equal(suspendLog.institutionId, 'inst_audit_01');

    // Verify zero secret fields exist in details
    for (const log of logs) {
      assert.equal(log.details.password, undefined);
      assert.equal(log.details.secret, undefined);
      assert.equal(log.details.token, undefined);
    }
  });

});
