/**
 * Phase 26 — Student Enrollment & Group Operations Test Suite
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Set NODE_ENV = 'test' to use isolated in-memory testing store
process.env.NODE_ENV = 'test';

const {
  createStudent,
  getStudent,
  updateStudentProfile,
  changeStudentStatus,
  regenerateStudentQR,
  listStudents,
  createGroup,
  getGroup,
  updateGroup,
  setGroupStatus,
  listGroups,
  enrollStudentInGroup,
  withdrawStudentFromGroup,
  linkGuardianToStudent,
  listGuardians,
  clearInMemoryStores,
  getInMemoryAuditLogs
} = require('./student_enrollment_service');

const superAdminToken = { uid: 'usr_super_admin', role: 'superAdmin' };
const ownerToken = { uid: 'usr_owner_inst1', role: 'institutionOwner', institutionId: 'inst_001' };
const adminToken = { uid: 'usr_admin_inst1', role: 'admin', institutionId: 'inst_001' };
const teacherToken = { uid: 'usr_teacher_inst1', role: 'teacher', institutionId: 'inst_001' };
const studentToken = { uid: 'usr_student_inst1', role: 'student', institutionId: 'inst_001' };
const otherTenantOwnerToken = { uid: 'usr_owner_inst2', role: 'institutionOwner', institutionId: 'inst_002' };

beforeEach(() => {
  clearInMemoryStores();
});

test('1. createStudent — Successfully creates student with code and QR hash', async () => {
  const payload = {
    fullName: 'أحمد محمود العلي',
    phone: '01012345678',
    parentPhone: '01098765432',
    stageId: 'stage_sec',
    gradeId: 'grade_sec_1',
    targetInstitutionId: 'inst_001'
  };

  const res = await createStudent(adminToken, payload);

  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.institutionId, 'inst_001');
  assert.ok(res.student.id.startsWith('stu_'));
  assert.ok(res.student.studentCode.startsWith('STU-2026-'));
  assert.equal(res.student.fullName, 'أحمد محمود العلي');
  assert.equal(res.student.phone, '+201012345678');
  assert.equal(res.student.parentPhone, '+201098765432');
  assert.equal(res.student.status, 'ACTIVE');
  assert.ok(res.rawToken);
  assert.ok(res.student.qrTokenHash);
  assert.notEqual(res.rawToken, res.student.qrTokenHash);
});

test('2. getStudent & listStudents — Retrieves and lists students by tenant', async () => {
  await createStudent(ownerToken, { fullName: 'طالب 1', phone: '01111111111' });
  await createStudent(ownerToken, { fullName: 'طالب 2', phone: '01222222222' });

  const listRes = await listStudents(ownerToken);
  assert.equal(listRes.status, 'SUCCESS');
  assert.equal(listRes.count, 2);

  const singleRes = await getStudent(ownerToken, listRes.students[0].id);
  assert.equal(singleRes.status, 'SUCCESS');
  assert.equal(singleRes.student.fullName, 'طالب 1');
});

test('3. updateStudentProfile — Updates editable profile fields', async () => {
  const created = await createStudent(ownerToken, { fullName: 'طالب للتعديل', phone: '01012345678' });
  const studentId = created.student.id;

  const updateRes = await updateStudentProfile(ownerToken, studentId, {
    fullName: 'طالب تم تعديله',
    notes: 'ملاحظة خاصة'
  });

  assert.equal(updateRes.status, 'SUCCESS');
  assert.equal(updateRes.student.fullName, 'طالب تم تعديله');
  assert.equal(updateRes.student.notes, 'ملاحظة خاصة');
});

test('4. changeStudentStatus — Enforces valid status transitions', async () => {
  const created = await createStudent(ownerToken, { fullName: 'طالب تغيير الحالة' });
  const studentId = created.student.id;

  // ACTIVE -> SUSPENDED (Valid)
  const res1 = await changeStudentStatus(ownerToken, studentId, 'SUSPENDED');
  assert.equal(res1.status, 'SUCCESS');
  assert.equal(res1.student.status, 'SUSPENDED');

  // SUSPENDED -> ACTIVE (Valid)
  const res2 = await changeStudentStatus(ownerToken, studentId, 'ACTIVE');
  assert.equal(res2.status, 'SUCCESS');
  assert.equal(res2.student.status, 'ACTIVE');

  // ACTIVE -> GRADUATED (Valid)
  const res3 = await changeStudentStatus(ownerToken, studentId, 'GRADUATED');
  assert.equal(res3.status, 'SUCCESS');

  // GRADUATED -> ACTIVE (Invalid - GRADUATED can only transition to ARCHIVED)
  await assert.rejects(
    async () => {
      await changeStudentStatus(ownerToken, studentId, 'ACTIVE');
    },
    (err) => err.code === 'INVALID_STATUS_TRANSITION'
  );
});

test('5. regenerateStudentQR — Generates fresh raw token and updates hash', async () => {
  const created = await createStudent(ownerToken, { fullName: 'طالب بطاقة' });
  const studentId = created.student.id;

  const regenRes = await regenerateStudentQR(ownerToken, studentId);
  assert.equal(regenRes.status, 'SUCCESS');
  assert.ok(regenRes.rawToken);
  assert.ok(regenRes.qrTokenHash);
  assert.notEqual(regenRes.rawToken, created.rawToken);
  assert.notEqual(regenRes.qrTokenHash, created.student.qrTokenHash);
});

test('6. createGroup & updateGroup — Manages class group definition and max capacity', async () => {
  const groupRes = await createGroup(ownerToken, {
    name: 'مجموعة الفيزياء - الصف الأول الثانوي',
    subjectId: 'sub_physics',
    teacherId: 'tch_001',
    maxCapacity: 25,
    feePerSession: 100
  });

  assert.equal(groupRes.status, 'SUCCESS');
  assert.equal(groupRes.group.name, 'مجموعة الفيزياء - الصف الأول الثانوي');
  assert.equal(groupRes.group.maxCapacity, 25);
  assert.equal(groupRes.group.enrolledCount, 0);

  const updateRes = await updateGroup(ownerToken, groupRes.group.id, {
    maxCapacity: 30
  });
  assert.equal(updateRes.status, 'SUCCESS');
  assert.equal(updateRes.group.maxCapacity, 30);
});

test('7. enrollStudentInGroup — Enrolls student and increments group enrolled count', async () => {
  const stRes = await createStudent(ownerToken, { fullName: 'طالب مجموعة' });
  const grpRes = await createGroup(ownerToken, { name: 'مجموعة 1', maxCapacity: 2 });

  const enrRes = await enrollStudentInGroup(ownerToken, {
    studentId: stRes.student.id,
    groupId: grpRes.group.id
  });

  assert.equal(enrRes.status, 'SUCCESS');
  assert.equal(enrRes.enrollment.status, 'ENROLLED');
  assert.equal(enrRes.groupEnrolledCount, 1);

  const updatedGrp = await getGroup(ownerToken, grpRes.group.id);
  assert.equal(updatedGrp.group.enrolledCount, 1);
});

test('8. enrollStudentInGroup — Enforces group maxCapacity limit', async () => {
  const st1 = await createStudent(ownerToken, { fullName: 'طالب 1' });
  const st2 = await createStudent(ownerToken, { fullName: 'طالب 2' });
  const grpRes = await createGroup(ownerToken, { name: 'مجموعة محدودة السعة', maxCapacity: 1 });

  // First enrollment (Capacity 1/1) -> SUCCESS
  await enrollStudentInGroup(ownerToken, { studentId: st1.student.id, groupId: grpRes.group.id });

  // Second enrollment (Exceeds capacity) -> Rejected
  await assert.rejects(
    async () => {
      await enrollStudentInGroup(ownerToken, { studentId: st2.student.id, groupId: grpRes.group.id });
    },
    (err) => err.code === 'GROUP_CAPACITY_EXCEEDED'
  );
});

test('9. enrollStudentInGroup — Prevents duplicate active enrollment', async () => {
  const st = await createStudent(ownerToken, { fullName: 'طالب تكرار' });
  const grp = await createGroup(ownerToken, { name: 'مجموعة تكرار', maxCapacity: 10 });

  await enrollStudentInGroup(ownerToken, { studentId: st.student.id, groupId: grp.group.id });

  await assert.rejects(
    async () => {
      await enrollStudentInGroup(ownerToken, { studentId: st.student.id, groupId: grp.group.id });
    },
    (err) => err.code === 'DUPLICATE_ENROLLMENT'
  );
});

test('10. withdrawStudentFromGroup — Withdraws student and decrements enrolled count', async () => {
  const st = await createStudent(ownerToken, { fullName: 'طالب انسحاب' });
  const grp = await createGroup(ownerToken, { name: 'مجموعة انسحاب', maxCapacity: 10 });

  const enr = await enrollStudentInGroup(ownerToken, { studentId: st.student.id, groupId: grp.group.id });
  assert.equal(enr.groupEnrolledCount, 1);

  const withdrawRes = await withdrawStudentFromGroup(ownerToken, enr.enrollment.id);
  assert.equal(withdrawRes.status, 'SUCCESS');
  assert.equal(withdrawRes.enrollment.status, 'WITHDRAWN');

  const updatedGrp = await getGroup(ownerToken, grp.group.id);
  assert.equal(updatedGrp.group.enrolledCount, 0);
});

test('11. linkGuardianToStudent — Links guardian profile to student', async () => {
  const st = await createStudent(ownerToken, { fullName: 'طالب ولي أمر' });

  const linkRes = await linkGuardianToStudent(ownerToken, {
    studentId: st.student.id,
    fullName: 'محمود العلي',
    phone: '01000000000',
    relationshipType: 'FATHER',
    isPrimary: true
  });

  assert.equal(linkRes.status, 'SUCCESS');
  assert.equal(linkRes.guardian.fullName, 'محمود العلي');
  assert.equal(linkRes.guardian.phone, '+201000000000');
  assert.equal(linkRes.link.relationshipType, 'FATHER');
  assert.equal(linkRes.link.isPrimary, true);

  const guardiansList = await listGuardians(ownerToken);
  assert.equal(guardiansList.count, 1);
});

test('12. CROSS_TENANT_VIOLATION — Blocks cross-tenant student access', async () => {
  const st = await createStudent(ownerToken, { fullName: 'طالب مستأجر 1' });

  await assert.rejects(
    async () => {
      await getStudent(otherTenantOwnerToken, st.student.id);
    },
    (err) => err.code === 'CROSS_TENANT_VIOLATION'
  );
});

test('13. UNAUTHORIZED_CALLER_ROLE — Rejects unprivileged roles (teacher, student)', async () => {
  await assert.rejects(
    async () => {
      await createStudent(teacherToken, { fullName: 'طالب مدرس' });
    },
    (err) => err.code === 'UNAUTHORIZED_CALLER_ROLE'
  );

  await assert.rejects(
    async () => {
      await createStudent(studentToken, { fullName: 'طالب طالب' });
    },
    (err) => err.code === 'UNAUTHORIZED_CALLER_ROLE'
  );
});

test('14. SuperAdmin Access — SuperAdmin can operate specifying targetInstitutionId', async () => {
  const res = await createStudent(superAdminToken, {
    fullName: 'طالب بواسطة السوبر أدمن',
    targetInstitutionId: 'inst_001'
  });

  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.institutionId, 'inst_001');

  await assert.rejects(
    async () => {
      await createStudent(superAdminToken, { fullName: 'طالب بدون مؤسسة' });
    },
    (err) => err.code === 'MISSING_TARGET_INSTITUTION'
  );
});

test('15. Audit Log — Records auditable system events for all operations', async () => {
  const stRes = await createStudent(ownerToken, { fullName: 'طالب التدقيق' });
  const grpRes = await createGroup(ownerToken, { name: 'مجموعة التدقيق', maxCapacity: 5 });
  await enrollStudentInGroup(ownerToken, { studentId: stRes.student.id, groupId: grpRes.group.id });
  await linkGuardianToStudent(ownerToken, { studentId: stRes.student.id, fullName: 'ولي أمر التدقيق', phone: '01055555555' });

  const logs = getInMemoryAuditLogs();
  const eventTypes = logs.map(l => l.event);

  assert.ok(eventTypes.includes('STUDENT_ENROLLED'));
  assert.ok(eventTypes.includes('GROUP_CREATED'));
  assert.ok(eventTypes.includes('STUDENT_GROUP_ASSIGNED'));
  assert.ok(eventTypes.includes('STUDENT_GUARDIAN_LINKED'));
});
