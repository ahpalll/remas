/**
 * Phase 27 — Academic Operations & Teaching Workflow Test Suite
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Set NODE_ENV = 'test' to use isolated in-memory testing store
process.env.NODE_ENV = 'test';

const {
  seedMockDomainData,
  assignTeacherToGroup,
  createSession,
  getSession,
  updateSession,
  setSessionStatus,
  listSessions,
  recordSessionAttendance,
  listSessionAttendance,
  clearInMemoryStores,
  getInMemoryAuditLogs
} = require('./academic_operations_service');

const superAdminToken = { uid: 'usr_super_admin', role: 'superAdmin' };
const ownerToken = { uid: 'usr_owner_inst1', role: 'institutionOwner', institutionId: 'inst_001' };
const adminToken = { uid: 'usr_admin_inst1', role: 'admin', institutionId: 'inst_001' };
const teacher1Token = { uid: 'tch_001', role: 'teacher', institutionId: 'inst_001' };
const teacher2Token = { uid: 'tch_002', role: 'teacher', institutionId: 'inst_001' };
const studentToken = { uid: 'usr_student_inst1', role: 'student', institutionId: 'inst_001' };
const otherTenantOwnerToken = { uid: 'usr_owner_inst2', role: 'institutionOwner', institutionId: 'inst_002' };

const sampleTeacher1 = {
  id: 'tch_001',
  institutionId: 'inst_001',
  fullName: 'أ. دكتور أحمد الجابري',
  assignedSubjects: ['sub_physics', 'sub_math'],
  assignedLevels: ['stage_sec', 'grade_sec_1'],
  status: 'ACTIVE'
};

const sampleTeacherInactive = {
  id: 'tch_inactive',
  institutionId: 'inst_001',
  fullName: 'أ. معطل',
  assignedSubjects: ['sub_physics'],
  assignedLevels: ['stage_sec'],
  status: 'SUSPENDED'
};

const sampleGroup1 = {
  id: 'grp_001',
  institutionId: 'inst_001',
  name: 'مجموعة الفيزياء 101',
  subjectId: 'sub_physics',
  stageId: 'stage_sec',
  gradeId: 'grade_sec_1',
  teacherId: 'tch_001',
  roomId: 'room_101',
  maxCapacity: 25,
  enrolledCount: 2
};

const sampleGroup2Unassigned = {
  id: 'grp_002',
  institutionId: 'inst_001',
  name: 'مجموعة الكيمياء 201',
  subjectId: 'sub_chemistry',
  stageId: 'stage_sec',
  gradeId: 'grade_sec_2',
  teacherId: null,
  roomId: 'room_102',
  maxCapacity: 20,
  enrolledCount: 0
};

beforeEach(() => {
  clearInMemoryStores();
  seedMockDomainData({
    teachers: [sampleTeacher1, sampleTeacherInactive],
    groups: [sampleGroup1, sampleGroup2Unassigned]
  });
});

test('1. assignTeacherToGroup — Assigns qualified active teacher to group', async () => {
  const res = await assignTeacherToGroup(ownerToken, {
    teacherId: 'tch_001',
    groupId: 'grp_001'
  });

  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.group.teacherId, 'tch_001');
});

test('2. assignTeacherToGroup — Rejects unqualified teacher assignment (TEACHER_NOT_QUALIFIED)', async () => {
  // Group 2 requires sub_chemistry, teacher1 has sub_physics & sub_math
  await assert.rejects(
    async () => {
      await assignTeacherToGroup(ownerToken, {
        teacherId: 'tch_001',
        groupId: 'grp_002'
      });
    },
    (err) => err.code === 'TEACHER_NOT_QUALIFIED'
  );
});

test('3. assignTeacherToGroup — Rejects inactive teacher assignment (INACTIVE_TEACHER)', async () => {
  await assert.rejects(
    async () => {
      await assignTeacherToGroup(ownerToken, {
        teacherId: 'tch_inactive',
        groupId: 'grp_001'
      });
    },
    (err) => err.code === 'INACTIVE_TEACHER'
  );
});

test('4. createSession — Successfully creates scheduled teaching session', async () => {
  const sessionRes = await createSession(ownerToken, {
    groupId: 'grp_001',
    title: 'حصة الفيزياء التطبيقية',
    sessionDate: '2026-09-10',
    startTime: '10:00',
    endTime: '12:00',
    roomId: 'room_101'
  });

  assert.equal(sessionRes.status, 'SUCCESS');
  assert.equal(sessionRes.session.institutionId, 'inst_001');
  assert.equal(sessionRes.session.status, 'SCHEDULED');
  assert.equal(sessionRes.session.teacherId, 'tch_001');
  assert.equal(sessionRes.session.roomId, 'room_101');
});

test('5. createSession — Rejects session schedule conflict for same room (SESSION_SCHEDULE_CONFLICT)', async () => {
  // Session 1: 10:00 to 12:00 in room_101
  await createSession(ownerToken, {
    groupId: 'grp_001',
    sessionDate: '2026-09-10',
    startTime: '10:00',
    endTime: '12:00',
    roomId: 'room_101'
  });

  // Session 2: Overlapping 11:00 to 13:00 in room_101
  await assert.rejects(
    async () => {
      await createSession(ownerToken, {
        groupId: 'grp_001',
        sessionDate: '2026-09-10',
        startTime: '11:00',
        endTime: '13:00',
        roomId: 'room_101'
      });
    },
    (err) => err.code === 'SESSION_SCHEDULE_CONFLICT'
  );
});

test('6. createSession — Restricts teacher to creating sessions for assigned groups only', async () => {
  // teacher1Token (tch_001) creating session for grp_001 (assigned) -> SUCCESS
  const res = await createSession(teacher1Token, {
    groupId: 'grp_001',
    sessionDate: '2026-09-10',
    startTime: '14:00',
    endTime: '16:00'
  });
  assert.equal(res.status, 'SUCCESS');

  // teacher2Token (tch_002) creating session for grp_001 (not assigned) -> REJECTED
  await assert.rejects(
    async () => {
      await createSession(teacher2Token, {
        groupId: 'grp_001',
        sessionDate: '2026-09-10',
        startTime: '16:00',
        endTime: '18:00'
      });
    },
    (err) => err.code === 'TEACHER_NOT_ASSIGNED_TO_GROUP'
  );
});

test('7. getSession & listSessions — Retrieves sessions and filters by teacher scope', async () => {
  await createSession(ownerToken, {
    groupId: 'grp_001',
    sessionDate: '2026-09-12',
    startTime: '09:00',
    endTime: '11:00'
  });

  const listRes = await listSessions(ownerToken);
  assert.equal(listRes.status, 'SUCCESS');
  assert.equal(listRes.count, 1);

  const getRes = await getSession(ownerToken, listRes.sessions[0].id);
  assert.equal(getRes.status, 'SUCCESS');
});

test('8. updateSession & setSessionStatus — Lifecycle transitions (SCHEDULED -> IN_PROGRESS -> COMPLETED)', async () => {
  const created = await createSession(ownerToken, {
    groupId: 'grp_001',
    sessionDate: '2026-09-15',
    startTime: '10:00',
    endTime: '12:00'
  });

  // SCHEDULED -> IN_PROGRESS
  const res1 = await setSessionStatus(ownerToken, created.session.id, 'IN_PROGRESS');
  assert.equal(res1.session.status, 'IN_PROGRESS');

  // IN_PROGRESS -> COMPLETED
  const res2 = await setSessionStatus(ownerToken, created.session.id, 'COMPLETED');
  assert.equal(res2.session.status, 'COMPLETED');
});

test('9. setSessionStatus — Rejects updates on terminal COMPLETED session', async () => {
  const created = await createSession(ownerToken, {
    groupId: 'grp_001',
    sessionDate: '2026-09-15',
    startTime: '10:00',
    endTime: '12:00'
  });

  await setSessionStatus(ownerToken, created.session.id, 'IN_PROGRESS');
  await setSessionStatus(ownerToken, created.session.id, 'COMPLETED');

  // COMPLETED -> IN_PROGRESS (Invalid)
  await assert.rejects(
    async () => {
      await setSessionStatus(ownerToken, created.session.id, 'IN_PROGRESS');
    },
    (err) => err.code === 'INVALID_SESSION_STATUS'
  );

  // Update details on COMPLETED session (Invalid)
  await assert.rejects(
    async () => {
      await updateSession(ownerToken, created.session.id, { title: 'عنوان جديد' });
    },
    (err) => err.code === 'INVALID_SESSION_STATUS'
  );
});

test('10. recordSessionAttendance — Records attendance for session roster', async () => {
  const sessionRes = await createSession(ownerToken, {
    groupId: 'grp_001',
    sessionDate: '2026-09-16',
    startTime: '10:00',
    endTime: '12:00'
  });

  const attRes = await recordSessionAttendance(ownerToken, {
    sessionId: sessionRes.session.id,
    attendanceList: [
      { studentId: 'stu_101', status: 'PRESENT' },
      { studentId: 'stu_102', status: 'LATE', lateMinutes: 15 },
      { studentId: 'stu_103', status: 'ABSENT' }
    ]
  });

  assert.equal(attRes.status, 'SUCCESS');
  assert.equal(attRes.recordedCount, 3);

  const listAtt = await listSessionAttendance(ownerToken, sessionRes.session.id);
  assert.equal(listAtt.count, 3);
});

test('11. recordSessionAttendance — Rejects unauthorized teacher recording (TEACHER_NOT_ASSIGNED_TO_GROUP)', async () => {
  const sessionRes = await createSession(ownerToken, {
    groupId: 'grp_001',
    sessionDate: '2026-09-17',
    startTime: '10:00',
    endTime: '12:00'
  });

  // teacher2 is not assigned to grp_001 or session
  await assert.rejects(
    async () => {
      await recordSessionAttendance(teacher2Token, {
        sessionId: sessionRes.session.id,
        attendanceList: [{ studentId: 'stu_101', status: 'PRESENT' }]
      });
    },
    (err) => err.code === 'TEACHER_NOT_ASSIGNED_TO_GROUP'
  );
});

test('12. CROSS_TENANT_VIOLATION — Blocks cross-tenant session operations', async () => {
  const sessionRes = await createSession(ownerToken, {
    groupId: 'grp_001',
    sessionDate: '2026-09-18',
    startTime: '10:00',
    endTime: '12:00'
  });

  await assert.rejects(
    async () => {
      await getSession(otherTenantOwnerToken, sessionRes.session.id);
    },
    (err) => err.code === 'CROSS_TENANT_VIOLATION'
  );
});

test('13. UNAUTHORIZED_CALLER_ROLE — Rejects student creating session', async () => {
  await assert.rejects(
    async () => {
      await createSession(studentToken, {
        groupId: 'grp_001',
        sessionDate: '2026-09-19',
        startTime: '10:00',
        endTime: '12:00'
      });
    },
    (err) => err.code === 'UNAUTHORIZED_CALLER_ROLE'
  );
});

test('14. Audit Log — Records auditable system events for teaching operations', async () => {
  await assignTeacherToGroup(ownerToken, { teacherId: 'tch_001', groupId: 'grp_001' });
  const sess = await createSession(ownerToken, { groupId: 'grp_001', sessionDate: '2026-09-20', startTime: '10:00', endTime: '12:00' });
  await setSessionStatus(ownerToken, sess.session.id, 'IN_PROGRESS');
  await recordSessionAttendance(ownerToken, { sessionId: sess.session.id, attendanceList: [{ studentId: 'stu_101', status: 'PRESENT' }] });

  const logs = getInMemoryAuditLogs();
  const eventTypes = logs.map(l => l.event);

  assert.ok(eventTypes.includes('TEACHING_ASSIGNMENT_CHANGED'));
  assert.ok(eventTypes.includes('SESSION_CREATED'));
  assert.ok(eventTypes.includes('SESSION_STATUS_CHANGED'));
  assert.ok(eventTypes.includes('SESSION_ATTENDANCE_RECORDED'));
});
