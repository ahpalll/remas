process.env.NODE_ENV = 'test';

/**
 * Phase 25 — Academic Structure & Teacher Operations Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  createAcademicLevel,
  getAcademicLevel,
  updateAcademicLevel,
  setAcademicLevelStatus,
  listAcademicLevels,
  createSubject,
  getSubject,
  updateSubject,
  setSubjectStatus,
  listSubjects,
  createTeacherProfile,
  getTeacherProfile,
  updateTeacherProfile,
  assignTeacherSubjectsAndLevels,
  setTeacherStatus,
  listTeachers,
  getAuditLogs,
  resetInMemoryAcademicState
} = require('./academic_structure_service');

describe('Phase 25 — Academic Structure & Teacher Operations', () => {

  const superAdminToken = { uid: 'uid_super_admin', role: 'superAdmin' };
  const adminTenant1Token = { uid: 'uid_admin_t1', role: 'institutionOwner', institutionId: 'inst_demo_01' };
  const adminTenant2Token = { uid: 'uid_admin_t2', role: 'admin', institutionId: 'inst_demo_02' };
  const teacherToken = { uid: 'uid_teacher_t1', role: 'teacher', institutionId: 'inst_demo_01' };
  const studentToken = { uid: 'uid_student_t1', role: 'student', institutionId: 'inst_demo_01' };

  beforeEach(() => {
    resetInMemoryAcademicState();
  });

  // --------------------------------------------------------------------------
  // Scenario 1 & 2: Academic Level Creation (SuperAdmin & Admin inside own tenant)
  // --------------------------------------------------------------------------
  it('allows SuperAdmin to create academic level for any tenant', async () => {
    const res = await createAcademicLevel(superAdminToken, {
      targetInstitutionId: 'inst_demo_01',
      name: 'Secondary Grade 1',
      code: 'sec_1',
      order: 10
    });
    assert.equal(res.status, 'LEVEL_CREATED');
    assert.equal(res.data.name, 'Secondary Grade 1');
    assert.equal(res.data.institutionId, 'inst_demo_01');
  });

  it('allows Tenant Admin to create academic level in own tenant', async () => {
    const res = await createAcademicLevel(adminTenant1Token, {
      name: 'Primary Grade 1',
      code: 'pri_1',
      order: 1
    });
    assert.equal(res.status, 'LEVEL_CREATED');
    assert.equal(res.data.institutionId, 'inst_demo_01');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Admin cross-tenant level rejection
  // --------------------------------------------------------------------------
  it('rejects cross-tenant academic level creation by Tenant Admin', async () => {
    await assert.rejects(
      async () => {
        await createAcademicLevel(adminTenant1Token, {
          targetInstitutionId: 'inst_demo_02',
          name: 'Hack Level',
          code: 'hack_1'
        });
      },
      (err) => {
        assert.equal(err.code, 'CROSS_TENANT_VIOLATION');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Duplicate level rejection
  // --------------------------------------------------------------------------
  it('prevents duplicate academic level creation within same institution', async () => {
    await createAcademicLevel(adminTenant1Token, { name: 'Prep Grade 1', code: 'prep_1' });

    await assert.rejects(
      async () => {
        await createAcademicLevel(adminTenant1Token, { name: 'Prep Grade 1', code: 'prep_1' });
      },
      (err) => {
        assert.equal(err.code, 'DUPLICATE_ACADEMIC_LEVEL');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 5 & 6: Admin update & disable level
  // --------------------------------------------------------------------------
  it('allows Admin to update and disable academic level in own tenant', async () => {
    const createRes = await createAcademicLevel(adminTenant1Token, { name: 'Grade 10', code: 'g10' });
    const levelId = createRes.levelId;

    const updateRes = await updateAcademicLevel(adminTenant1Token, levelId, { name: 'Grade 10 General' });
    assert.equal(updateRes.status, 'LEVEL_UPDATED');
    assert.equal(updateRes.level.name, 'Grade 10 General');

    const statusRes = await setAcademicLevelStatus(adminTenant1Token, levelId, undefined, 'DISABLED');
    assert.equal(statusRes.status, 'STATUS_UPDATED');
    assert.equal(statusRes.newStatus, 'DISABLED');
  });

  // --------------------------------------------------------------------------
  // Scenario 7 & 8: Subject Creation & Duplicate Rejection
  // --------------------------------------------------------------------------
  it('allows Admin to create subject and prevents duplicates in same tenant', async () => {
    const res = await createSubject(adminTenant1Token, {
      name: 'Advanced Mathematics',
      code: 'math_adv',
      description: 'Calculus and Algebra'
    });
    assert.equal(res.status, 'SUBJECT_CREATED');
    assert.equal(res.data.name, 'Advanced Mathematics');

    await assert.rejects(
      async () => {
        await createSubject(adminTenant1Token, {
          name: 'Advanced Mathematics',
          code: 'math_adv'
        });
      },
      (err) => {
        assert.equal(err.code, 'DUPLICATE_SUBJECT');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Cross-tenant subject rejection
  // --------------------------------------------------------------------------
  it('rejects cross-tenant subject operations by Tenant Admin', async () => {
    const subRes = await createSubject(adminTenant1Token, { name: 'Physics', code: 'phy_1' });

    await assert.rejects(
      async () => {
        await getSubject(adminTenant2Token, subRes.subjectId, 'inst_demo_01');
      },
      (err) => {
        assert.equal(err.code, 'CROSS_TENANT_VIOLATION');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 10 & 11: Teacher Profile Creation & Institution Linking
  // --------------------------------------------------------------------------
  it('creates teacher profile cleanly linked to institutionId', async () => {
    const res = await createTeacherProfile(adminTenant1Token, {
      fullName: 'Dr. Mohamed Ahmed',
      email: 'mohamed@center.com',
      phone: '01000000001',
      specialization: 'Physics'
    });
    assert.equal(res.status, 'TEACHER_CREATED');
    assert.equal(res.data.institutionId, 'inst_demo_01');
    assert.equal(res.data.email, 'mohamed@center.com');
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Cross-tenant teacher rejection
  // --------------------------------------------------------------------------
  it('rejects cross-tenant teacher administration by Admin in tenant B', async () => {
    const tchRes = await createTeacherProfile(adminTenant1Token, {
      fullName: 'Teacher Tenant 1',
      email: 'teacher1@t1.com'
    });

    await assert.rejects(
      async () => {
        await updateTeacherProfile(adminTenant2Token, tchRes.teacherId, { fullName: 'Hacked Name' }, 'inst_demo_01');
      },
      (err) => {
        assert.equal(err.code, 'CROSS_TENANT_VIOLATION');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Teacher Assignment (Subjects & Levels)
  // --------------------------------------------------------------------------
  it('allows Admin to assign subjects and levels to teacher profile', async () => {
    const lvlRes = await createAcademicLevel(adminTenant1Token, { name: 'Secondary 1', code: 'sec_1' });
    const subRes = await createSubject(adminTenant1Token, { name: 'Chemistry', code: 'chem_1' });
    const tchRes = await createTeacherProfile(adminTenant1Token, { fullName: 'Prof. Sarah', email: 'sarah@t1.com' });

    const assignRes = await assignTeacherSubjectsAndLevels(adminTenant1Token, tchRes.teacherId, {
      subjectIds: [subRes.subjectId],
      levelIds: [lvlRes.levelId]
    });

    assert.equal(assignRes.status, 'ASSIGNMENT_UPDATED');
    assert.ok(assignRes.subjectIds.includes(subRes.subjectId));
    assert.ok(assignRes.levelIds.includes(lvlRes.levelId));
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Unauthorized Teacher / Student Administration Rejection
  // --------------------------------------------------------------------------
  it('rejects level, subject, and teacher creation by Teacher or Student roles', async () => {
    const unauthorizedTokens = [teacherToken, studentToken];

    for (const token of unauthorizedTokens) {
      await assert.rejects(
        async () => {
          await createAcademicLevel(token, { name: 'Unauthorized Level' });
        },
        (err) => {
          assert.equal(err.code, 'UNAUTHORIZED_CALLER_ROLE');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await createSubject(token, { name: 'Unauthorized Subject' });
        },
        (err) => {
          assert.equal(err.code, 'UNAUTHORIZED_CALLER_ROLE');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await createTeacherProfile(token, { fullName: 'Unauthorized Teacher', email: 'unauth@t1.com' });
        },
        (err) => {
          assert.equal(err.code, 'UNAUTHORIZED_CALLER_ROLE');
          return true;
        }
      );
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Audit Events Logging without secret leaks
  // --------------------------------------------------------------------------
  it('records structured audit logs for academic structure events without password/secret leaks', async () => {
    await createAcademicLevel(adminTenant1Token, { name: 'Level Audit', code: 'lvl_audit' });
    await createSubject(adminTenant1Token, { name: 'Subject Audit', code: 'subj_audit' });
    await createTeacherProfile(adminTenant1Token, { fullName: 'Teacher Audit', email: 'audit@t1.com' });

    const logs = getAuditLogs();
    assert.ok(logs.length >= 3);

    const levelLog = logs.find((l) => l.event === 'ACADEMIC_LEVEL_CREATED');
    assert.ok(levelLog);
    assert.equal(levelLog.institutionId, 'inst_demo_01');

    const subjectLog = logs.find((l) => l.event === 'SUBJECT_CREATED');
    assert.ok(subjectLog);

    const teacherLog = logs.find((l) => l.event === 'TEACHER_CREATED');
    assert.ok(teacherLog);

    // Verify zero secret leaks
    for (const log of logs) {
      assert.equal(log.details.password, undefined);
      assert.equal(log.details.secret, undefined);
      assert.equal(log.details.token, undefined);
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Multi-Tenant List Filtering Isolation
  // --------------------------------------------------------------------------
  it('ensures listAcademicLevels, listSubjects, and listTeachers filter strictly by tenant boundary', async () => {
    await createAcademicLevel(adminTenant1Token, { name: 'T1 Level', code: 't1_lvl' });
    await createAcademicLevel(superAdminToken, { targetInstitutionId: 'inst_demo_02', name: 'T2 Level', code: 't2_lvl' });

    await createSubject(adminTenant1Token, { name: 'T1 Subject', code: 't1_subj' });
    await createSubject(superAdminToken, { targetInstitutionId: 'inst_demo_02', name: 'T2 Subject', code: 't2_subj' });

    await createTeacherProfile(adminTenant1Token, { fullName: 'T1 Teacher', email: 't1@t1.com' });
    await createTeacherProfile(superAdminToken, { targetInstitutionId: 'inst_demo_02', fullName: 'T2 Teacher', email: 't2@t2.com' });

    const t1Levels = await listAcademicLevels(adminTenant1Token);
    assert.equal(t1Levels.levels.length, 1);
    assert.equal(t1Levels.levels[0].institutionId, 'inst_demo_01');

    const t1Subjects = await listSubjects(adminTenant1Token);
    assert.equal(t1Subjects.subjects.length, 1);
    assert.equal(t1Subjects.subjects[0].institutionId, 'inst_demo_01');

    const t1Teachers = await listTeachers(adminTenant1Token);
    assert.equal(t1Teachers.teachers.length, 1);
    assert.equal(t1Teachers.teachers[0].institutionId, 'inst_demo_01');
  });

});
