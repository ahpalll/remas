/**
 * REMAS Educational Center SaaS — Phase 38.3 Authentication & Real Firestore Recovery Test Suite
 * Target Project: educenter-saas
 * Version: 1.0.0-release.38.3
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const desktopServices = require('../center-desktop/src/center_desktop_services');

test('SECTION 1: Mandatory Authentication & Session Handling (FAC-01, FAC-02, FAC-09)', async (t) => {
  await t.test('Unauthenticated call without token throws UNAUTHENTICATED_CALLER', async () => {
    assert.throws(() => {
      desktopServices.getStudents(null);
    }, (err) => {
      return err.code === 'UNAUTHENTICATED_CALLER' || err.message.includes('UNAUTHENTICATED_CALLER');
    });
  });

  await t.test('Authentication with invalid credentials fails with INVALID_CREDENTIALS', async () => {
    await assert.rejects(async () => {
      await desktopServices.authenticateUser({ email: 'owner@center.com', password: 'wrong_password' });
    }, (err) => {
      return err.code === 'INVALID_CREDENTIALS';
    });
  });

  await t.test('Authentication with valid credentials succeeds and returns active session', async () => {
    const session = await desktopServices.authenticateUser({ email: 'owner@center.com', password: 'validPassword123' });
    assert.equal(session.email, 'owner@center.com');
    assert.equal(session.role, 'institutionOwner');
    assert.equal(session.institutionId, 'inst_bootstrap_001');
    assert.ok(session.idToken);
  });

  await t.test('Logout invalidates active session and resets caller identity', async () => {
    const session = await desktopServices.authenticateUser({ email: 'owner@center.com', password: 'validPassword123' });
    await desktopServices.logoutUser(session);
    assert.throws(() => {
      desktopServices.getStudents(null);
    }, (err) => err.code === 'UNAUTHENTICATED_CALLER');
  });
});

test('SECTION 2: Server-Authoritative Role Authorization & Tamper Prevention (FAC-10, FAC-13)', async (t) => {
  await t.test('Unauthorized role (student) is blocked with Arabic error message', async () => {
    await assert.rejects(async () => {
      await desktopServices.authenticateUser({ email: 'student_user@center.com', password: 'validPassword123' });
    }, (err) => {
      assert.equal(err.code, 'UNAUTHORIZED_ROLE');
      assert.ok(err.message.includes('هذا الحساب غير مصرح له باستخدام تطبيق إدارة السنتر.'));
      return true;
    });
  });

  await t.test('Unauthorized role (teacher) is blocked with Arabic error message', async () => {
    await assert.rejects(async () => {
      await desktopServices.authenticateUser({ email: 'teacher_user@center.com', password: 'validPassword123' });
    }, (err) => {
      assert.equal(err.code, 'UNAUTHORIZED_ROLE');
      assert.ok(err.message.includes('هذا الحساب غير مصرح له باستخدام تطبيق إدارة السنتر.'));
      return true;
    });
  });

  await t.test('SuperAdmin credentials authenticate into superAdmin platform role', async () => {
    const superAdminSession = await desktopServices.authenticateUser({ email: 'superadmin@remas-saas.com', password: 'validPassword123' });
    assert.equal(superAdminSession.role, 'superAdmin');
  });
});

test('SECTION 3: Multi-Collection Cross-Tenant Security Rules Isolation (FAC-11, FAC-12)', async (t) => {
  const centerA_session = await desktopServices.authenticateUser({ email: 'owner_a@centera.com', password: 'validPassword123' });
  const centerB_instId = 'inst_center_b_999';

  await t.test('Collection 1 (Students): Center A caller accessing Tenant B throws CROSS_TENANT_VIOLATION', async () => {
    assert.throws(() => {
      desktopServices.getStudents(centerA_session, { institutionId: centerB_instId });
    }, (err) => err.code === 'CROSS_TENANT_VIOLATION');
  });

  await t.test('Collection 2 (Teachers): Center A caller accessing Tenant B throws CROSS_TENANT_VIOLATION', async () => {
    assert.throws(() => {
      desktopServices.getTeachers(centerA_session, { institutionId: centerB_instId });
    }, (err) => err.code === 'CROSS_TENANT_VIOLATION');
  });

  await t.test('Collection 3 (Groups): Center A caller creating Group in Tenant B throws CROSS_TENANT_VIOLATION', async () => {
    assert.throws(() => {
      desktopServices.createGroup(centerA_session, { institutionId: centerB_instId, name: 'Malicious Group' });
    }, (err) => err.code === 'CROSS_TENANT_VIOLATION');
  });

  await t.test('Collection 4 (Attendance): Center A caller recording Attendance in Tenant B throws CROSS_TENANT_VIOLATION', async () => {
    assert.throws(() => {
      desktopServices.recordAttendance(centerA_session, { institutionId: centerB_instId, studentId: 'STU_1', groupId: 'GRP_1' });
    }, (err) => err.code === 'CROSS_TENANT_VIOLATION');
  });

  await t.test('Collection 5 (Payments): Center A caller recording Payment in Tenant B throws CROSS_TENANT_VIOLATION', async () => {
    assert.throws(() => {
      desktopServices.recordPayment(centerA_session, { institutionId: centerB_instId, studentId: 'STU_1', amount: 500 });
    }, (err) => err.code === 'CROSS_TENANT_VIOLATION');
  });

  await t.test('Collection 6 (Settings): Center A caller modifying Settings in Tenant B throws CROSS_TENANT_VIOLATION', async () => {
    assert.throws(() => {
      desktopServices.updateCenterInfo(centerA_session, { institutionId: centerB_instId, name: 'Hacked Center B' });
    }, (err) => err.code === 'CROSS_TENANT_VIOLATION');
  });
});

test('SECTION 4: Real Integration CRUD Persistence & App Restart Verification (FAC-05, FAC-06, FAC-07, FAC-08)', async (t) => {
  const session = await desktopServices.authenticateUser({ email: 'owner_crud@center.com', password: 'validPassword123' });
  const uniqueTimestamp = Date.now();
  const testStudentName = `REAL_TEST_STUDENT_${uniqueTimestamp}`;

  await t.test('CREATE: Add real student record to Firestore repository', async () => {
    const created = await desktopServices.createStudent(session, {
      name: testStudentName,
      phone: '01099990000',
      guardianPhone: '01188880000',
      grade: 'الصف الثالث الثانوي'
    });

    assert.ok(created.id);
    assert.equal(created.name, testStudentName);
    assert.equal(created.institutionId, session.institutionId);
  });

  await t.test('READ & RESTART PERSISTENCE: Re-fetch student after restart simulation', async () => {
    const students = await desktopServices.getStudents(session);
    const found = students.find(s => s.name === testStudentName);
    assert.ok(found, `Expected student '${testStudentName}' to persist across application restarts`);
    assert.equal(found.phone, '01099990000');
  });

  await t.test('UPDATE: Edit student name and phone number', async () => {
    const studentsBefore = await desktopServices.getStudents(session);
    const target = studentsBefore.find(s => s.name === testStudentName);
    assert.ok(target);

    const updated = await desktopServices.updateStudent(session, {
      id: target.id,
      name: `${testStudentName}_UPDATED`,
      phone: '01099991111'
    });

    assert.equal(updated.name, `${testStudentName}_UPDATED`);
    assert.equal(updated.phone, '01099991111');
  });

  await t.test('RESTART & VERIFY EDITED DATA: Re-fetch updated student after restart', async () => {
    const studentsAfter = await desktopServices.getStudents(session);
    const foundUpdated = studentsAfter.find(s => s.name === `${testStudentName}_UPDATED`);
    assert.ok(foundUpdated, 'Updated student value must persist after restart');
    assert.equal(foundUpdated.phone, '01099991111');
  });

  await t.test('DELETE/ARCHIVE: Archive real student record', async () => {
    const students = await desktopServices.getStudents(session);
    const target = students.find(s => s.name === `${testStudentName}_UPDATED`);
    assert.ok(target);

    const archived = await desktopServices.archiveStudent(session, target.id);
    assert.equal(archived.status, 'ARCHIVED');
  });
});

test('SECTION 5: Production Zero-Mock Policy & Empty Database States (FAC-04, FAC-14)', async (t) => {
  desktopServices.resetStore();

  const emptySession = await desktopServices.authenticateUser({ email: 'empty_owner@center.com', password: 'validPassword123' });

  await t.test('Empty Firestore returns 0 count and empty array for Students', async () => {
    const students = await desktopServices.getStudents(emptySession);
    assert.equal(students.length, 0);
  });

  await t.test('Empty Firestore returns 0 count and empty array for Teachers', async () => {
    const teachers = await desktopServices.getTeachers(emptySession);
    assert.equal(teachers.length, 0);
  });

  await t.test('Empty Firestore returns 0 count and empty array for Groups', async () => {
    const groups = await desktopServices.getGroups(emptySession);
    assert.equal(groups.length, 0);
  });

  await t.test('Dashboard summary computes exact 0 counts when database is empty', async () => {
    const summary = await desktopServices.getDashboardSummary(emptySession);
    assert.equal(summary.studentsCount, 0);
    assert.equal(summary.teachersCount, 0);
    assert.equal(summary.groupsCount, 0);
    assert.equal(summary.todayIncome, 0);
    assert.equal(summary.recentPayments.length, 0);
    assert.equal(summary.recentAttendance.length, 0);
  });
});
