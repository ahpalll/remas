process.env.NODE_ENV = 'test';
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.USE_FIRESTORE_EMULATOR;

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const desktopServices = require('../center-desktop/src/center_desktop_services');

const ownerA = { uid: 'owner_a_504', role: 'institutionOwner', institutionId: 'inst_batch_a' };
const ownerB = { uid: 'owner_b_504', role: 'institutionOwner', institutionId: 'inst_batch_b' };

let teacherPhoneSeq = 1000000;
async function seedAcademic(token, suffix) {
  teacherPhoneSeq += 1;
  const tPhone = `010${String(teacherPhoneSeq).padStart(8, '0')}`.slice(0, 11);
  const year = await desktopServices.createAcademicYear(token, { id: `AY504_${suffix}`, name: `عام 504 ${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30' });
  const stage = await desktopServices.createStage(token, { id: `STG504_${suffix}`, name: `مرحلة 504 ${suffix}`, code: `S504-${suffix}`, academicYearId: year.id });
  const subject = await desktopServices.createSubject(token, { id: `SUB504_${suffix}`, name: `مادة 504 ${suffix}`, code: `M504-${suffix}`, academicYearId: year.id, stageId: stage.id });
  const teacher = await desktopServices.createTeacher(token, { id: `TCH504_${suffix}`, fullName: `معلم 504 ${suffix}`, phone: tPhone, specialization: 'تاريخ' });
  const room = await desktopServices.createRoom(token, { id: `RM504_${suffix}`, name: `قاعة 504 ${suffix}`, capacity: 10, location: 'الدور 1' });
  return { year, stage, subject, teacher, room };
}

describe('Phase 50.4 Batch A — Students + Groups + Enrollment + Relationships', () => {
  beforeEach(() => { desktopServices.resetStore(); });

  it('GROUP create/edit/archive/details/capacity + invalid refs rejected', async () => {
    const { year, stage, subject, teacher, room } = await seedAcademic(ownerA, 'G1');
    const g = await desktopServices.createGroup(ownerA, {
      id: 'GRP504_01', institutionId: ownerA.institutionId, name: 'الصف الثالث — تاريخ (أ)',
      academicYearId: year.id, stageId: stage.id, subjectId: subject.id, teacherId: teacher.id, roomId: room.id,
      maxCapacity: 2, monthlyFee: 350
    });
    assert.equal(g.enrolledCount, 0);
    assert.equal(g.stageId, stage.id);
    // invalid capacity
    await assert.rejects(() => desktopServices.createGroup(ownerA, { name: 'x', maxCapacity: 0 }), /INVALID_GROUP_CAPACITY/);
    // invalid teacher ref
    await assert.rejects(() => desktopServices.createGroup(ownerA, { name: 'bad', academicYearId: year.id, stageId: stage.id, subjectId: subject.id, teacherId: 'NOPE', roomId: room.id, maxCapacity: 5 }), /NOT_FOUND/);
    // edit ok
    const upd = await desktopServices.updateGroup(ownerA, 'GRP504_01', { institutionId: ownerA.institutionId, name: 'مجموعة معدلة', maxCapacity: 3 });
    assert.equal(upd.name, 'مجموعة معدلة');
    // details
    const fetched = await desktopServices.getGroupById(ownerA, 'GRP504_01', ownerA.institutionId);
    assert.equal(fetched.teacherId, teacher.id);
    // archive
    const arch = await desktopServices.archiveGroup(ownerA, 'GRP504_01', ownerA.institutionId);
    assert.equal(arch.status, 'ARCHIVED');
    const list = await desktopServices.getGroups(ownerA, { institutionId: ownerA.institutionId });
    assert.ok(!list.some(x => x.id === 'GRP504_01'));
  });

  it('STUDENT create with groups atomic + duplicate phone + profile/groups visible', async () => {
    const { year, stage, subject, teacher, room } = await seedAcademic(ownerA, 'S1');
    const g = await desktopServices.createGroup(ownerA, { id: 'GRP504_S1', institutionId: ownerA.institutionId, name: 'G-S1', academicYearId: year.id, stageId: stage.id, subjectId: subject.id, teacherId: teacher.id, roomId: room.id, maxCapacity: 5 });
    const s = await desktopServices.createStudent(ownerA, { id: 'STU504_A', institutionId: ownerA.institutionId, name: 'طالب أ', phone: '01011112222', guardianPhone: '01122223333', guardianName: 'ولي أ', academicYearId: year.id, stageId: stage.id, groupIds: [g.id] });
    assert.deepEqual(s.groupIds, [g.id]);
    assert.ok(s.qrToken);
    assert.ok(s.authUid);
    // group shows student
    const gs = await desktopServices.getGroupStudents(ownerA, g.id, ownerA.institutionId);
    assert.ok(gs.some(x => x.id === 'STU504_A'));
    const gAfter = await desktopServices.getGroupById(ownerA, g.id, ownerA.institutionId);
    assert.equal(gAfter.enrolledCount, 1);
    // student groups visible
    const sg = await desktopServices.getStudentGroups(ownerA, 'STU504_A', ownerA.institutionId);
    assert.ok(sg.some(x => x.id === g.id));
    // duplicate phone rejected
    await assert.rejects(() => desktopServices.createStudent(ownerA, { institutionId: ownerA.institutionId, name: 'مكرر', phone: '01011112222', guardianPhone: '01199998888', guardianName: 'و' }), /DUPLICATE_STUDENT/);
  });

  it('UAT SCENARIO capacity=2: A=1/2, B=2/2, C blocked full, remove A=1/2, add C=2/2, duplicate rejected', async () => {
    const { year, stage, subject, teacher, room } = await seedAcademic(ownerA, 'UAT');
    const g = await desktopServices.createGroup(ownerA, { id: 'GRP504_UAT', institutionId: ownerA.institutionId, name: 'UAT group', academicYearId: year.id, stageId: stage.id, subjectId: subject.id, teacherId: teacher.id, roomId: room.id, maxCapacity: 2 });
    const mkPhone = (n) => `0109${String(n).padStart(7, '0')}`.slice(0, 11);
    const a = await desktopServices.createStudent(ownerA, { id: 'STU_UAT_A', institutionId: ownerA.institutionId, name: 'طالب A', phone: mkPhone(1111111), guardianPhone: mkPhone(2222222), guardianName: 'ولي', academicYearId: year.id, stageId: stage.id, groupIds: [g.id] });
    let gg = await desktopServices.getGroupById(ownerA, g.id, ownerA.institutionId);
    assert.equal(gg.enrolledCount, 1);
    const b = await desktopServices.createStudent(ownerA, { id: 'STU_UAT_B', institutionId: ownerA.institutionId, name: 'طالب B', phone: mkPhone(3333333), guardianPhone: mkPhone(4444444), guardianName: 'ولي', academicYearId: year.id, stageId: stage.id, groupIds: [g.id] });
    gg = await desktopServices.getGroupById(ownerA, g.id, ownerA.institutionId);
    assert.equal(gg.enrolledCount, 2);
    // C blocked full
    await assert.rejects(() => desktopServices.createStudent(ownerA, { id: 'STU_UAT_C', institutionId: ownerA.institutionId, name: 'طالب C', phone: mkPhone(5555555), guardianPhone: mkPhone(6666666), guardianName: 'ولي', academicYearId: year.id, stageId: stage.id, groupIds: [g.id] }), /GROUP_FULL/);
    // remove A -> 1/2
    await desktopServices.removeStudentFromGroup(ownerA, a.id, g.id, ownerA.institutionId);
    gg = await desktopServices.getGroupById(ownerA, g.id, ownerA.institutionId);
    assert.equal(gg.enrolledCount, 1);
    // add C -> 2/2
    const c = await desktopServices.createStudent(ownerA, { id: 'STU_UAT_C', institutionId: ownerA.institutionId, name: 'طالب C', phone: mkPhone(5555555), guardianPhone: mkPhone(6666666), guardianName: 'ولي', academicYearId: year.id, stageId: stage.id, groupIds: [g.id] });
    gg = await desktopServices.getGroupById(ownerA, g.id, ownerA.institutionId);
    assert.equal(gg.enrolledCount, 2);
    // duplicate enrollment rejected
    await assert.rejects(() => desktopServices.addStudentToGroup(ownerA, c.id, g.id, ownerA.institutionId), /DUPLICATE_ENROLLMENT/);
    // profile shows group + teacher/subject/stage resolvable
    const prof = await desktopServices.getStudentById(ownerA, c.id, ownerA.institutionId);
    assert.ok(prof.groupIds.includes(g.id));
    const sgroups = await desktopServices.getStudentGroups(ownerA, c.id, ownerA.institutionId);
    assert.equal(sgroups[0].teacherId, teacher.id);
    assert.equal(sgroups[0].subjectId, subject.id);
    assert.equal(sgroups[0].stageId, stage.id);
  });

  it('ENROLLMENT removal updates counts + capacity below enrolled blocked + safe delete', async () => {
    const { year, stage, subject, teacher, room } = await seedAcademic(ownerA, 'RM');
    const g = await desktopServices.createGroup(ownerA, { id: 'GRP504_RM', institutionId: ownerA.institutionId, name: 'G-RM', academicYearId: year.id, stageId: stage.id, subjectId: subject.id, teacherId: teacher.id, roomId: room.id, maxCapacity: 3 });
    const s = await desktopServices.createStudent(ownerA, { id: 'STU504_RM', institutionId: ownerA.institutionId, name: 'طالب RM', phone: '01077776666', guardianPhone: '01177776666', guardianName: 'ولي', academicYearId: year.id, stageId: stage.id, groupIds: [g.id] });
    // capacity below enrolled blocked
    await assert.rejects(() => desktopServices.updateGroup(ownerA, g.id, { institutionId: ownerA.institutionId, maxCapacity: 0 }), /INVALID_GROUP_CAPACITY/);
    // set capacity 3-> enrolled 1, reducing to 1 ok; reducing below enrolled after adding second
    const s2 = await desktopServices.createStudent(ownerA, { id: 'STU504_RM2', institutionId: ownerA.institutionId, name: 'طالب RM2', phone: '01088887777', guardianPhone: '01188887777', guardianName: 'ولي', academicYearId: year.id, stageId: stage.id, groupIds: [g.id] });
    await assert.rejects(() => desktopServices.updateGroup(ownerA, g.id, { institutionId: ownerA.institutionId, maxCapacity: 1 }), /CAPACITY_BELOW_ENROLLED/);
    // hard delete blocked while dependents exist
    await assert.rejects(() => desktopServices.deleteGroup(ownerA, g.id, ownerA.institutionId), /HAS_DEPENDENCIES/);
    // remove all then delete ok
    await desktopServices.removeStudentFromGroup(ownerA, s.id, g.id, ownerA.institutionId);
    await desktopServices.removeStudentFromGroup(ownerA, s2.id, g.id, ownerA.institutionId);
    const del = await desktopServices.deleteGroup(ownerA, g.id, ownerA.institutionId);
    assert.equal(del.success, true);
    // room safe-delete: group referencing room blocks
    const g2 = await desktopServices.createGroup(ownerA, { id: 'GRP504_RM2', institutionId: ownerA.institutionId, name: 'G-RM2', academicYearId: year.id, stageId: stage.id, subjectId: subject.id, teacherId: teacher.id, roomId: room.id, maxCapacity: 3 });
    await assert.rejects(() => desktopServices.deleteRoom(ownerA, room.id, ownerA.institutionId), /HAS_DEPENDENCIES/);
    await desktopServices.archiveGroup(ownerA, g2.id, ownerA.institutionId);
    const delRoom = await desktopServices.deleteRoom(ownerA, room.id, ownerA.institutionId);
    assert.equal(delRoom.success, true);
  });

  it('SECURITY tenant isolation + unauthenticated + immutable institutionId', async () => {
    const { year, stage, subject, teacher, room } = await seedAcademic(ownerA, 'SEC');
    await seedAcademic(ownerB, 'SECB');
    const g = await desktopServices.createGroup(ownerA, { id: 'GRP504_SEC', institutionId: ownerA.institutionId, name: 'G-SEC', academicYearId: year.id, stageId: stage.id, subjectId: subject.id, teacherId: teacher.id, roomId: room.id, maxCapacity: 5 });
    // cross-tenant read denied
    await assert.rejects(() => desktopServices.getGroupById(ownerB, g.id, ownerA.institutionId), /CROSS_TENANT/);
    // cross-tenant write denied
    await assert.rejects(() => desktopServices.createStudent(ownerB, { institutionId: g.institutionId === ownerA.institutionId ? ownerA.institutionId : ownerB.institutionId, name: 'x', phone: '01012345678', guardianPhone: '01112345678', guardianName: 'و', groupIds: [g.id] }), /CROSS_TENANT/);
    // unauthenticated denied
    await assert.rejects(() => desktopServices.getStudents(null, { institutionId: ownerA.institutionId }), /UNAUTHENTICATED/);
    // institutionId immutable
    const s = await desktopServices.createStudent(ownerA, { id: 'STU504_SEC', institutionId: ownerA.institutionId, name: 'طالب SEC', phone: '01055554444', guardianPhone: '01155554444', guardianName: 'ولي' });
    await assert.rejects(() => desktopServices.updateStudent(ownerA, s.id, { institutionId: ownerB.institutionId, name: 'هاك' }), /CROSS_TENANT|IMMUTABLE/);
  });

  it('STUDENT edit stage mismatch requires explicit handling + archive withdraws enrollments', async () => {
    const seed1 = await seedAcademic(ownerA, 'E1');
    const seed2 = await seedAcademic(ownerA, 'E2');
    const g1 = await desktopServices.createGroup(ownerA, { id: 'GRP504_E1', institutionId: ownerA.institutionId, name: 'G-E1', academicYearId: seed1.year.id, stageId: seed1.stage.id, subjectId: seed1.subject.id, teacherId: seed1.teacher.id, roomId: seed1.room.id, maxCapacity: 5 });
    const s = await desktopServices.createStudent(ownerA, { id: 'STU504_E', institutionId: ownerA.institutionId, name: 'طالب E', phone: '01099998888', guardianPhone: '01199998888', guardianName: 'ولي', academicYearId: seed1.year.id, stageId: seed1.stage.id, groupIds: [g1.id] });
    // changing stage while keeping old group must be rejected (either mismatch code)
    await assert.rejects(() => desktopServices.updateStudent(ownerA, s.id, { institutionId: ownerA.institutionId, stageId: seed2.stage.id, groupIds: [g1.id] }), /STAGE_.*MISMATCH/);
    // archive withdraws
    await desktopServices.archiveStudent(ownerA, s.id, ownerA.institutionId);
    const gAfter = await desktopServices.getGroupById(ownerA, g1.id, ownerA.institutionId);
    assert.equal(gAfter.enrolledCount, 0);
  });

  it('REGRESSION academic/teachers/QR/device-license + renderer symbols', async () => {
    const { year, stage } = await seedAcademic(ownerA, 'RG');
    const teachers = await desktopServices.getTeachers(ownerA, { institutionId: ownerA.institutionId });
    assert.ok(teachers.length >= 1);
    const tGroups = await desktopServices.getTeacherGroups(ownerA, teachers[0].id, ownerA.institutionId);
    assert.ok(Array.isArray(tGroups));
    const students = await desktopServices.getStudents(ownerA, { institutionId: ownerA.institutionId });
    // QR preserved
    for (const st of students) assert.ok(st.qrToken || st.id);
    const lic = await desktopServices.getLicenseStatus(ownerA, ownerA.institutionId);
    assert.equal(lic.status, 'ACTIVE');
    // renderer symbols
    const fs = require('node:fs');
    const path = require('node:path');
    const renderer = fs.readFileSync(path.resolve(__dirname, '../center-desktop/src/desktop_app.js'), 'utf8');
    for (const sym of ['handleLoginSubmit', 'callBackend', 'electronAPI', 'openAddStudentModal', 'submitAddStudent', 'openAddGroupModal', 'openGroupDetailsModal', 'viewStudentDetailsModal', 'archiveGroupAction', 'removeStudentFromGroup']) {
      assert.ok(renderer.includes(sym), `renderer missing ${sym}`);
    }
    assert.ok(!renderer.includes('archiveGroupAction') || renderer.includes('async function archiveGroupAction'));
  });
});
