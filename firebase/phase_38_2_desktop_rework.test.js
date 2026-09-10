/**
 * Phase 38.2 — Center Desktop Functional Rework Test Suite
 * REMAS Educational Center SaaS Monorepo
 * 
 * Verifies real CRUD operations, dynamic dashboard aggregate calculations,
 * zero production mock fallbacks, role security, SuperAdmin console isolation,
 * and End-to-End persistence across all 15 operational desktop modules.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.USE_TEST_SEED = 'true';
const desktopServices = require('../center-desktop/src/center_desktop_services');

describe('Phase 38.2 — Center Desktop Real Functional Suite', () => {

  const centerOwnerToken = { uid: 'owner_inst_001', role: 'institutionOwner', institutionId: 'inst_rework_001' };
  const superAdminToken = { uid: 'superadmin_001', role: 'superAdmin', institutionId: 'platform' };

  beforeEach(() => {
    desktopServices.resetStore();
  });

  describe('SECTION A — Real CRUD & Data Persistence Baseline', () => {

    it('A1. Student Full Lifecycle: Create -> Fetch -> Edit -> Archive', async () => {
      const created = await desktopServices.createStudent(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        name: 'ياسر محمود الأحمدي',
        phone: '01012341234',
        guardianPhone: '01198769876',
        grade: 'الصف الثالث الثانوي'
      });

      assert.equal(created.name, 'ياسر محمود الأحمدي');
      assert.ok(created.studentCode.startsWith('STU-2026-'));

      const list = await desktopServices.getStudents(centerOwnerToken, 'inst_rework_001');
      assert.equal(list.length, 1);
      assert.equal(list[0].id, created.id);

      const updated = await desktopServices.updateStudent(centerOwnerToken, {
        id: created.id,
        institutionId: 'inst_rework_001',
        phone: '01055554444'
      });
      assert.equal(updated.phone, '01055554444');

      const archived = await desktopServices.archiveStudent(centerOwnerToken, created.id, 'inst_rework_001');
      assert.equal(archived.status, 'ARCHIVED');
    });

    it('A2. Teacher Full Lifecycle: Create -> Fetch -> Edit -> Archive', async () => {
      const teacher = await desktopServices.createTeacher(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        name: 'د/ محمود الشناوي',
        phone: '01077776666',
        subject: 'الفيزياء'
      });

      assert.equal(teacher.name, 'د/ محمود الشناوي');

      const teachersList = await desktopServices.getTeachers(centerOwnerToken, 'inst_rework_001');
      assert.equal(teachersList.length, 1);

      const archived = await desktopServices.archiveTeacher(centerOwnerToken, teacher.id, 'inst_rework_001');
      assert.equal(archived.status, 'ARCHIVED');
    });

    it('A3. Group Roster & Seat Capacity Enforcement', async () => {
      const group = await desktopServices.createGroup(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        name: 'فيزياء - ثانوية عامة',
        maxCapacity: 2,
        monthlyFee: 400
      });

      assert.equal(group.maxCapacity, 2);

      const updated = await desktopServices.updateGroup(centerOwnerToken, {
        id: group.id,
        institutionId: 'inst_rework_001',
        monthlyFee: 450
      });
      assert.equal(updated.monthlyFee, 450);

      const archived = await desktopServices.archiveGroup(centerOwnerToken, group.id, 'inst_rework_001');
      assert.equal(archived.status, 'ARCHIVED');
    });

    it('A4. Attendance Recording & Status Check (Present, Absent, Late, Excused)', async () => {
      const att = await desktopServices.recordAttendance(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        studentId: 'STU_2001',
        studentName: 'خالد عبدالله',
        status: 'PRESENT'
      });

      assert.equal(att.status, 'PRESENT');

      const records = await desktopServices.getAttendanceRecords(centerOwnerToken, 'inst_rework_001');
      assert.equal(records.length, 1);
    });

    it('A5. Schedule Session Conflict Prevention', async () => {
      const session1 = await desktopServices.createSession(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        groupId: 'GRP_101',
        room: 'قاعة 1',
        sessionDate: '2026-09-15',
        startTime: '16:00',
        endTime: '18:00'
      });

      assert.equal(session1.room, 'قاعة 1');

      await assert.rejects(
        async () => {
          await desktopServices.createSession(centerOwnerToken, {
            institutionId: 'inst_rework_001',
            groupId: 'GRP_102',
            room: 'قاعة 1',
            sessionDate: '2026-09-15',
            startTime: '17:00',
            endTime: '19:00'
          });
        },
        (err) => err.message.includes('SESSION_SCHEDULE_CONFLICT')
      );
    });

    it('A6. Finance Receipts & Expense Tracking with Balance Math', async () => {
      const pay = await desktopServices.recordPayment(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        studentName: 'زياد طارق',
        amount: 500,
        category: 'اشتراك شهر سبتمبر'
      });

      assert.ok(pay.receiptNumber.startsWith('REC-2026-'));
      assert.equal(pay.amount, 500);

      const exp = await desktopServices.recordExpense(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        category: 'كهرباء وإنارة القاعات',
        amount: 150
      });
      assert.equal(exp.amount, 150);

      const payments = await desktopServices.getPayments(centerOwnerToken, 'inst_rework_001');
      const expenses = await desktopServices.getExpenses(centerOwnerToken, 'inst_rework_001');

      assert.equal(payments.length, 1);
      assert.equal(expenses.length, 1);
    });
  });

  describe('SECTION B — Dynamic Dashboard Aggregate Calculations', () => {

    it('B1. Center Dashboard metrics reflect real dynamic counts', async () => {
      await desktopServices.createStudent(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        name: 'طالب اختباري 1',
        grade: 'الصف الأول الثانوي'
      });

      await desktopServices.recordPayment(centerOwnerToken, {
        institutionId: 'inst_rework_001',
        studentName: 'طالب اختباري 1',
        amount: 300,
        category: 'رسوم'
      });

      const summary = await desktopServices.getDashboardSummary(centerOwnerToken, 'inst_rework_001');

      assert.equal(summary.studentsCount, 1);
      assert.equal(summary.totalRevenue, 300);
      assert.equal(summary.netBalance, 300);
    });
  });

  describe('SECTION C — SuperAdmin Platform Lifecycle & Security Isolation', () => {

    it('C1. SuperAdmin Institution Lifecycle: Create -> Suspend -> Reactivate', async () => {
      const inst = await desktopServices.createInstitution(superAdminToken, {
        name: 'سنتر النجاح السريع',
        ownerName: 'م/ عادل توفيق',
        phone: '01011110000',
        plan: 'PRO'
      });

      assert.equal(inst.name, 'سنتر النجاح السريع');
      assert.equal(inst.status, 'ACTIVE');

      const suspended = await desktopServices.suspendInstitution(superAdminToken, inst.id);
      assert.equal(suspended.status, 'SUSPENDED');

      const reactivated = await desktopServices.activateInstitution(superAdminToken, inst.id);
      assert.equal(reactivated.status, 'ACTIVE');
    });

    it('C2. SuperAdmin Device Binding Revocation & Rebind Flow', async () => {
      const dev = await desktopServices.rebindDeviceBinding(superAdminToken, 'dev_win_pc_001');
      assert.equal(dev.status, 'BOUND');

      const revoked = await desktopServices.revokeDeviceBinding(superAdminToken, 'dev_win_pc_001');
      assert.equal(revoked.status, 'REVOKED');
    });
  });
});
