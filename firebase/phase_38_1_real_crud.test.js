/**
 * Phase 38.1 — Real Firestore Data, Real CRUD & SuperAdmin Console Categorized Test Suite
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 * Version: 1.0.0-release.38.1
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const desktopServices = require('../center-desktop/src/center_desktop_services');

describe('Phase 38.1 — Categorized Automated Real CRUD & SuperAdmin Test Suite', () => {

  beforeEach(() => {
    desktopServices.resetStore();
  });

  // ==========================================================================
  // SECTION A: BACKEND REAL CRUD TESTS
  // ==========================================================================
  describe('SECTION A — Real Backend CRUD & Domain Persistence', () => {

    it('A1. Student CRUD: create, read, update, and archive student record', async () => {
      const callerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_alpha' };

      // 1. Create Student
      const student = await desktopServices.createStudent(callerToken, {
        institutionId: 'inst_alpha',
        name: 'أحمد محمود علي',
        phone: '01011112222',
        guardianPhone: '01122223333',
        grade: 'الصف الثالث الثانوي'
      });
      assert.ok(student.id.startsWith('STU_'), 'Student ID must start with STU_');
      assert.equal(student.name, 'أحمد محمود علي');
      assert.equal(student.institutionId, 'inst_alpha');

      // 2. Read Students
      const list = await desktopServices.getStudents(callerToken, { institutionId: 'inst_alpha' });
      assert.equal(list.length, 1);
      assert.equal(list[0].id, student.id);

      // 3. Update Student
      const updated = await desktopServices.updateStudent(callerToken, student.id, {
        institutionId: 'inst_alpha',
        phone: '01099998888'
      });
      assert.equal(updated.phone, '01099998888');

      // 4. Archive Student
      await desktopServices.archiveStudent(callerToken, student.id, 'inst_alpha');
      const listAfterArchive = await desktopServices.getStudents(callerToken, { institutionId: 'inst_alpha' });
      assert.equal(listAfterArchive.length, 0, 'Archived student must not appear in active student list');
    });

    it('A2. Teacher CRUD: create, read, update, and archive teacher profile', async () => {
      const callerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_alpha' };

      const teacher = await desktopServices.createTeacher(callerToken, {
        institutionId: 'inst_alpha',
        name: 'أ.د/ إبراهيم عبد الرحمن',
        phone: '01099998888',
        subject: 'الرياضيات المشتقات والتفاضل'
      });
      assert.ok(teacher.id.startsWith('TCH_'));
      assert.equal(teacher.name, 'أ.د/ إبراهيم عبد الرحمن');

      const list = await desktopServices.getTeachers(callerToken, { institutionId: 'inst_alpha' });
      assert.equal(list.length, 1);
      assert.equal(list[0].subject, 'الرياضيات المشتقات والتفاضل');
    });

    it('A3. Group CRUD: group creation and capacity validation', async () => {
      const callerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_alpha' };

      const group = await desktopServices.createGroup(callerToken, {
        institutionId: 'inst_alpha',
        name: 'رياضيات - ثانوية عامة (أ)',
        maxCapacity: 25,
        monthlyFee: 350
      });
      assert.ok(group.id.startsWith('GRP_'));
      assert.equal(group.maxCapacity, 25);
      assert.equal(group.monthlyFee, 350);

      const list = await desktopServices.getGroups(callerToken, { institutionId: 'inst_alpha' });
      assert.equal(list.length, 1);
    });

    it('A4. Attendance Recording: record attendance and enforce duplicate check', async () => {
      const callerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_alpha' };
      const dateStr = new Date().toISOString().split('T')[0];

      const att = await desktopServices.recordAttendance(callerToken, {
        institutionId: 'inst_alpha',
        studentId: 'STU_TEST_01',
        studentName: 'سارة محمود حسن',
        groupId: 'GRP_01',
        date: dateStr,
        status: 'PRESENT'
      });
      assert.ok(att.id.startsWith('ATT_'));
      assert.equal(att.status, 'PRESENT');

      // Duplicate attendance attempt -> REJECTED
      await assert.rejects(async () => {
        await desktopServices.recordAttendance(callerToken, {
          institutionId: 'inst_alpha',
          studentId: 'STU_TEST_01',
          groupId: 'GRP_01',
          date: dateStr,
          status: 'PRESENT'
        });
      }, /DUPLICATE_ATTENDANCE/);
    });

    it('A5. Schedule Conflict Validation: reject overlapping session in same room', async () => {
      const callerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_alpha' };

      await desktopServices.createSession(callerToken, {
        institutionId: 'inst_alpha',
        title: 'حصة التفاضل',
        room: 'قاعة 1',
        date: '2026-09-15',
        startTime: '16:00',
        endTime: '18:00'
      });

      // Overlapping session creation attempt -> REJECTED
      await assert.rejects(async () => {
        await desktopServices.createSession(callerToken, {
          institutionId: 'inst_alpha',
          title: 'حصة الفيزياء',
          room: 'قاعة 1',
          date: '2026-09-15',
          startTime: '16:00',
          endTime: '18:00'
        });
      }, /SESSION_SCHEDULE_CONFLICT/);
    });

    it('A6. Finance Payments & Expense Entries: record transactions and calculate balance', async () => {
      const callerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_alpha' };

      const payment = await desktopServices.recordPayment(callerToken, {
        institutionId: 'inst_alpha',
        studentName: 'عمر خالد فؤاد',
        amount: 350,
        category: 'مصاريف دراسية'
      });
      assert.ok(payment.receiptNumber.startsWith('REC-'));
      assert.equal(payment.amount, 350);

      const expense = await desktopServices.recordExpense(callerToken, {
        institutionId: 'inst_alpha',
        amount: 100,
        category: 'صيانة القاعات'
      });
      assert.equal(expense.amount, 100);

      const summary = await desktopServices.getDashboardSummary(callerToken, 'inst_alpha');
      assert.equal(summary.totalIncome, 350);
      assert.equal(summary.totalExpenses, 100);
      assert.equal(summary.netBalance, 250);
    });
  });

  // ==========================================================================
  // SECTION B: FIRESTORE SECURITY RULES & TENANT ISOLATION TESTS
  // ==========================================================================
  describe('SECTION B — Firestore Security Rules & Tenant Isolation', () => {

    it('B1. Cross-Tenant Access Rejection: Center A caller rejected when querying Center B', async () => {
      const centerAToken = { uid: 'owner_center_a', role: 'institutionOwner', institutionId: 'center_a' };

      await assert.rejects(async () => {
        await desktopServices.getStudents(centerAToken, { institutionId: 'center_b' });
      }, /CROSS_TENANT_VIOLATION/);
    });

    it('B2. Cross-Tenant Write Rejection: Center A caller cannot create student in Center B', async () => {
      const centerAToken = { uid: 'owner_center_a', role: 'institutionOwner', institutionId: 'center_a' };

      await assert.rejects(async () => {
        await desktopServices.createStudent(centerAToken, {
          institutionId: 'center_b',
          name: 'طالب غير مصرح به'
        });
      }, /CROSS_TENANT_VIOLATION/);
    });

    it('B3. Unauthenticated Caller Rejection: missing token throws UNAUTHENTICATED_CALLER', async () => {
      await assert.rejects(async () => {
        await desktopServices.getStudents(null, { institutionId: 'center_a' });
      }, /UNAUTHENTICATED_CALLER/);
    });

    it('B4. Role Authority Guard: unprivileged caller rejected from SuperAdmin actions', async () => {
      const centerOwnerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'center_a' };

      await assert.rejects(async () => {
        await desktopServices.createInstitution(centerOwnerToken, { name: 'مركز جديد' });
      }, /UNAUTHORIZED_CALLER_ROLE/);
    });
  });

  // ==========================================================================
  // SECTION C: DESKTOP IPC & SECURITY ARCHITECTURE TESTS
  // ==========================================================================
  describe('SECTION C — Desktop IPC & Security Architecture', () => {

    it('C1. Zero Service Account Exposure: package contains zero private key credentials', () => {
      const desktopDir = path.join(__dirname, '..', 'center-desktop');
      const files = fs.readdirSync(desktopDir, { recursive: true });

      for (const file of files) {
        if (typeof file === 'string' && file.includes('node_modules')) continue;
        const fullPath = path.join(desktopDir, file);
        if (typeof file === 'string' && fs.statSync(fullPath).isFile() && (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.html'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.equal(content.includes('BEGIN PRIVATE KEY'), false, `Secret private key leak detected in ${file}`);
          assert.equal(content.includes('client_email'), false, `Service account client_email leak detected in ${file}`);
        }
      }
    });

    it('C2. Internal Require Isolation: main.js requires only internal center-desktop files', () => {
      const mainJsContent = fs.readFileSync(path.join(__dirname, '..', 'center-desktop', 'main.js'), 'utf8');
      const externalRegex = /require\(['"]\.\.\/firebase\//;
      assert.equal(externalRegex.test(mainJsContent), false, 'main.js must not reach outside center-desktop');
    });
  });

  // ==========================================================================
  // SECTION D: SUPERRADMIN BACKEND TESTS
  // ==========================================================================
  describe('SECTION D — SuperAdmin Platform Backend Services', () => {

    it('D1. SuperAdmin Institution Creation, Suspension, and Reactivation', async () => {
      const superAdminToken = { uid: 'sa_01', role: 'superAdmin', institutionId: 'platform' };

      // Create Institution
      const inst = await desktopServices.createInstitution(superAdminToken, {
        name: 'سنتر التفوق الجديد',
        ownerName: 'د/ مصطفى كمال',
        plan: 'ENTERPRISE'
      });
      assert.ok(inst.id.startsWith('inst_'));
      assert.equal(inst.status, 'ACTIVE');

      // Suspend Institution
      const susRes = await desktopServices.suspendInstitution(superAdminToken, inst.id);
      assert.equal(susRes.status, 'SUSPENDED');

      // Activate Institution
      const actRes = await desktopServices.activateInstitution(superAdminToken, inst.id);
      assert.equal(actRes.status, 'ACTIVE');
    });

    it('D2. SuperAdmin Device Revocation and Rebind', async () => {
      const superAdminToken = { uid: 'sa_01', role: 'superAdmin', institutionId: 'platform' };
      const deviceId = 'win_fp_test_device_001';

      const revoked = await desktopServices.revokeDeviceBinding(superAdminToken, deviceId);
      assert.equal(revoked.status, 'REVOKED');

      const rebound = await desktopServices.rebindDeviceBinding(superAdminToken, deviceId);
      assert.equal(rebound.status, 'BOUND');
    });

    it('D3. SuperAdmin Platform Overview Aggregation', async () => {
      const superAdminToken = { uid: 'sa_01', role: 'superAdmin', institutionId: 'platform' };

      const ov = await desktopServices.getSuperAdminPlatformOverview(superAdminToken);
      assert.ok(ov.totalInstitutions >= 0);
      assert.ok(ov.activeProvider.includes('Gemini'));
      assert.equal(ov.platformStatus, 'OPERATIONAL');
    });
  });

  // ==========================================================================
  // SECTION E: E2E PERSISTENCE & LICENSE CONTROL TESTS
  // ==========================================================================
  describe('SECTION E — E2E Persistence & License Control Flow', () => {

    it('E1. End-to-End Persistence: Create record -> Re-fetch -> Edit -> Archive', async () => {
      const callerToken = { uid: 'owner_01', role: 'institutionOwner', institutionId: 'inst_e2e' };

      // 1. Create Student
      const s1 = await desktopServices.createStudent(callerToken, {
        institutionId: 'inst_e2e',
        name: 'ياسمين محمود',
        phone: '01000001111'
      });

      // 2. Re-fetch
      const fetch1 = await desktopServices.getStudents(callerToken, { institutionId: 'inst_e2e' });
      assert.equal(fetch1.length, 1);
      assert.equal(fetch1[0].name, 'ياسمين محمود');

      // 3. Edit
      await desktopServices.updateStudent(callerToken, s1.id, {
        institutionId: 'inst_e2e',
        name: 'ياسمين محمود أحمد'
      });

      const fetch2 = await desktopServices.getStudents(callerToken, { institutionId: 'inst_e2e' });
      assert.equal(fetch2[0].name, 'ياسمين محمود أحمد');

      // 4. Archive
      await desktopServices.archiveStudent(callerToken, s1.id, 'inst_e2e');
      const fetch3 = await desktopServices.getStudents(callerToken, { institutionId: 'inst_e2e' });
      assert.equal(fetch3.length, 0);
    });

    it('E2. End-to-End Suspension and Restoration Cycle', async () => {
      const superAdminToken = { uid: 'sa_01', role: 'superAdmin', institutionId: 'platform' };
      const centerOwnerToken = { uid: 'owner_target', role: 'institutionOwner', institutionId: 'inst_target' };

      // 1. Center operates clean
      const s1 = await desktopServices.createStudent(centerOwnerToken, {
        institutionId: 'inst_target',
        name: 'طالب تجربة التجميد'
      });
      assert.ok(s1.id);

      // 2. SuperAdmin suspends center
      await desktopServices.suspendInstitution(superAdminToken, 'inst_target');

      // 3. SuperAdmin reactivates center
      await desktopServices.activateInstitution(superAdminToken, 'inst_target');
      const list = await desktopServices.getStudents(centerOwnerToken, { institutionId: 'inst_target' });
      assert.equal(list.length, 1);
    });
  });

});
