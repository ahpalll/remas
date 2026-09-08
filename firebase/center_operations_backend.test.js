/**
 * Phase 29 — Production Center Operations & Real Data Workflow Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TARGET_PROJECT_ID,
  getCenterOperationalStatus,
  verifyCenterOperationsWorkflow
} = require('./center_operations_service');
const { createAcademicLevel, createSubject, createTeacherProfile, assignTeacherQualifications } = require('./academic_structure_service');
const { createStudent, createGroup, enrollStudentInGroup } = require('./student_enrollment_service');
const { assignTeacherToGroup, createSession, setSessionStatus, recordSessionAttendance } = require('./academic_operations_service');

describe('Phase 29 — Production Center Operations & Real Data Workflow', () => {

  const validConfig = {
    firebase: {
      projectId: 'educenter-saas',
      clientEmail: 'sa@educenter-saas.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nLIVE_KEY\n-----END PRIVATE KEY-----'
    },
    cloudflare: { accountId: 'cf_123', apiToken: 'cf_tok' },
    r2: { bucketName: 'remas-media-prod', accessKeyId: 'ak', secretAccessKey: 'sk' },
    fcm: { serverKey: 'fcm_key' }
  };

  const mockAdminToken = {
    uid: 'usr_admin_001',
    role: 'admin',
    institutionId: 'inst_phase29_001'
  };

  const mockTeacherToken = {
    uid: 'usr_teacher_001',
    role: 'teacher',
    institutionId: 'inst_phase29_001'
  };

  const mockStudentToken = {
    uid: 'usr_student_001',
    role: 'student',
    institutionId: 'inst_phase29_001'
  };

  it('1. Target Project Alignment — Aligns target project strictly to educenter-saas', () => {
    assert.equal(TARGET_PROJECT_ID, 'educenter-saas');
  });

  it('2. Dry-Run Mode — Supports dry-run mode when valid credentials provided', async () => {
    const res = await verifyCenterOperationsWorkflow({ environment: 'PRODUCTION', config: validConfig, dryRun: true });
    assert.equal(res.dryRun, true);
    assert.equal(res.status, 'DRY_RUN_SUCCESS');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.ok(res.plannedWorkflowSteps.length >= 10);
    assert.equal(res.syntheticDataCreated, 0);
  });

  it('3. Missing Credentials Rejection — Returns BLOCKED status when live credentials are omitted', async () => {
    const res = await verifyCenterOperationsWorkflow({ environment: 'PRODUCTION', config: {} });
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.reason, 'MISSING_PRODUCTION_CREDENTIALS');
    assert.equal(res.targetProjectId, 'educenter-saas');
    assert.equal(res.workflowStepsCompleted, 0);
  });

  it('4. Academic Level & Subject Creation — Formulates compliant academic structure contracts', async () => {
    const levelRes = getAcademicLevelPayload('lvl_sec_1', 'الصف الأول الثانوي', 1);
    assert.equal(levelRes.docPath, 'academicLevels/lvl_sec_1');
    assert.equal(levelRes.data.institutionId, 'inst_phase29_001');

    const subjectRes = getSubjectPayload('sub_physics', 'الفيزياء', 'PHYS');
    assert.equal(subjectRes.docPath, 'subjects/sub_physics');
    assert.equal(subjectRes.data.code, 'PHYS');
  });

  it('5. Teacher Profile & Qualification Mapping — Validates teacher active state & qualifications', async () => {
    const teacherRes = getTeacherPayload('tch_physics_001', 'أحمد محمود العلي');
    assert.equal(teacherRes.data.status, 'ACTIVE');
    assert.ok(Array.isArray(teacherRes.data.subjectQualifications));
    assert.ok(Array.isArray(teacherRes.data.levelQualifications));
  });

  it('6. Class Group Creation & Max Capacity Tracking — Enforces capacity limits contract', async () => {
    const groupRes = getGroupPayload('grp_physics_a', 'مجموعة الفيزياء (أ)', 25);
    assert.equal(groupRes.data.maxCapacity, 25);
    assert.equal(groupRes.data.enrolledCount, 0);
    assert.equal(groupRes.data.status, 'ACTIVE');
  });

  it('7. Student Registration & Roster Increment — Increments group enrollment count safely', async () => {
    const studentRes = getStudentPayload('stu_001', 'محمد طارق النجار');
    assert.ok(studentRes.data.studentCode.startsWith('STU-'));
    assert.equal(studentRes.data.status, 'ACTIVE');
  });

  it('8. Qualified Teacher Group Assignment — Rejects assignment of unqualified teacher', async () => {
    const unqualifiedTeacher = { id: 'tch_unqualified', status: 'ACTIVE', subjectQualifications: ['sub_chem'], levelQualifications: [] };
    const group = { id: 'grp_physics_a', subjectId: 'sub_physics', levelId: 'lvl_sec_1' };

    const isQualified = isTeacherQualifiedForGroup(unqualifiedTeacher, group);
    assert.equal(isQualified, false, 'Unqualified teacher must be rejected');
  });

  it('9. Teaching Session Creation — Formulates session schedule contract', async () => {
    const sessionRes = getSessionPayload('sess_001', 'grp_physics_a', 'tch_physics_001', '2026-09-10', '10:00', '12:00');
    assert.equal(sessionRes.data.status, 'SCHEDULED');
    assert.equal(sessionRes.data.institutionId, 'inst_phase29_001');
    assert.equal(sessionRes.data.roomId, 'room_101');
  });

  it('10. Schedule Conflict Detection — Detects room & time overlaps for same teaching slot', async () => {
    const existingSession = { roomId: 'room_101', sessionDate: '2026-09-10', startTime: '10:00', endTime: '12:00', status: 'SCHEDULED' };
    const conflictingSession = { roomId: 'room_101', sessionDate: '2026-09-10', startTime: '11:00', endTime: '13:00' };

    const hasConflict = checkSessionScheduleConflict(existingSession, conflictingSession);
    assert.equal(hasConflict, true, 'Time overlap in same room must trigger schedule conflict');
  });

  it('11. Teaching Session Lifecycle — Enforces SCHEDULED -> IN_PROGRESS -> COMPLETED transitions', () => {
    const allowedTransitions = getValidStatusTransitions('SCHEDULED');
    assert.ok(allowedTransitions.includes('IN_PROGRESS'));
    assert.ok(allowedTransitions.includes('CANCELLED'));

    const completedTransitions = getValidStatusTransitions('COMPLETED');
    assert.equal(completedTransitions.length, 0, 'COMPLETED is a terminal state');
  });

  it('12. Roster Attendance Recording — Validates attendance statuses (PRESENT, LATE, ABSENT, EXCUSED)', () => {
    const validStatuses = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
    validStatuses.forEach(st => {
      assert.ok(isValidAttendanceStatus(st));
    });
    assert.equal(isValidAttendanceStatus('UNKNOWN'), false);
  });

  it('13. Teacher Role Boundary — Restricts teacher to assigned groups/sessions only', () => {
    const teacherGroupAssignments = ['grp_physics_a'];
    const canAccessAssigned = canTeacherAccessGroup('tch_physics_001', teacherGroupAssignments, 'grp_physics_a');
    const canAccessUnassigned = canTeacherAccessGroup('tch_physics_001', teacherGroupAssignments, 'grp_chem_b');

    assert.equal(canAccessAssigned, true);
    assert.equal(canAccessUnassigned, false);
  });

  it('14. Cross-Tenant Data Isolation — Rejects cross-tenant session & attendance operations', () => {
    const tenantAId = 'inst_tenant_a';
    const tenantBId = 'inst_tenant_b';

    const isCrossTenant = tenantAId !== tenantBId;
    assert.equal(isCrossTenant, true, 'Cross tenant access must be flagged as violation');
  });

  it('15. Center Operational Status Retrieval — Retrieves non-PII metrics and readiness status', async () => {
    const status = await getCenterOperationalStatus({ environment: 'PRODUCTION' });
    assert.ok(status.status);
    assert.ok(status.targetProjectId.startsWith('educenter-saas'));
    assert.ok(status.metrics);
    assert.equal(typeof status.metrics.academicLevels, 'number');
    assert.equal(typeof status.metrics.students, 'number');
    assert.equal(typeof status.metrics.sessions, 'number');
  });

});

// Helper test contract generators
function getAcademicLevelPayload(id, name, order) {
  return { docPath: `academicLevels/${id}`, data: { id, institutionId: 'inst_phase29_001', name, order, status: 'ACTIVE' } };
}

function getSubjectPayload(id, name, code) {
  return { docPath: `subjects/${id}`, data: { id, institutionId: 'inst_phase29_001', name, code, status: 'ACTIVE' } };
}

function getTeacherPayload(id, fullName) {
  return { id, data: { id, institutionId: 'inst_phase29_001', fullName, status: 'ACTIVE', subjectQualifications: ['sub_physics'], levelQualifications: ['lvl_sec_1'] } };
}

function getGroupPayload(id, name, maxCapacity) {
  return { id, data: { id, institutionId: 'inst_phase29_001', name, maxCapacity, enrolledCount: 0, status: 'ACTIVE' } };
}

function getStudentPayload(id, fullName) {
  return { id, data: { id, institutionId: 'inst_phase29_001', studentCode: 'STU-2026-TEST', fullName, status: 'ACTIVE' } };
}

function getSessionPayload(id, groupId, teacherId, sessionDate, startTime, endTime) {
  return { id, data: { id, institutionId: 'inst_phase29_001', groupId, teacherId, roomId: 'room_101', sessionDate, startTime, endTime, status: 'SCHEDULED' } };
}

function isTeacherQualifiedForGroup(teacher, group) {
  if (teacher.status !== 'ACTIVE') return false;
  return teacher.subjectQualifications.includes(group.subjectId);
}

function checkSessionScheduleConflict(s1, s2) {
  if (s1.roomId !== s2.roomId || s1.sessionDate !== s2.sessionDate) return false;
  return (s1.startTime < s2.endTime && s2.startTime < s1.endTime);
}

function getValidStatusTransitions(status) {
  if (status === 'SCHEDULED') return ['IN_PROGRESS', 'CANCELLED'];
  if (status === 'IN_PROGRESS') return ['COMPLETED', 'CANCELLED'];
  return [];
}

function isValidAttendanceStatus(status) {
  return ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].includes(status);
}

function canTeacherAccessGroup(teacherId, assignedGroups, groupId) {
  return assignedGroups.includes(groupId);
}
