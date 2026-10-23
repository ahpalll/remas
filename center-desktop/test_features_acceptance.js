process.env.NODE_ENV = 'test';
delete process.env.FIRESTORE_EMULATOR_HOST;

const assert = require('assert');
const services = require('./src/center_desktop_services.js');

async function runAcceptanceTests() {
  console.log('--- STARTING COMPREHENSIVE ACCEPTANCE TESTS ---');

  // Setup test environment
  process.env.TEST_OFFLINE = 'true';
  services.resetStore();

  const callerToken = {
    uid: 'owner_123',
    institutionId: 'inst_test_center',
    role: 'owner',
    permissions: ['all']
  };

  // -------------------------------------------------------------
  // Test 1: Invoice & Receipt Configuration
  // -------------------------------------------------------------
  console.log('[Test 1] Testing Invoice Config...');
  const initialInvoice = await services.getInvoiceConfig(callerToken, { institutionId: 'inst_test_center' });
  assert.ok(initialInvoice.centerName, 'Default centerName should exist');

  const updatedInvoice = await services.updateInvoiceConfig(callerToken, {
    institutionId: 'inst_test_center',
    centerName: 'سنتر رماس للغات والعلوم',
    phone: '01012345678',
    taxNumber: 'TAX-998877',
    terms: 'المصروفات لا تسترد بعد الحصة الثانية.',
    receiptFormat: 'both'
  });
  assert.strictEqual(updatedInvoice.centerName, 'سنتر رماس للغات والعلوم');
  assert.strictEqual(updatedInvoice.taxNumber, 'TAX-998877');
  console.log('✅ Test 1 Passed: Invoice config successfully read and updated.');

  // -------------------------------------------------------------
  // Test 2: WhatsApp Automation Configuration & Message Dispatch
  // -------------------------------------------------------------
  console.log('[Test 2] Testing WhatsApp Configuration & Messaging...');
  const waConfig = await services.getWhatsAppConfig(callerToken, { institutionId: 'inst_test_center' });
  assert.strictEqual(waConfig.enabled, false);

  const updatedWa = await services.updateWhatsAppConfig(callerToken, {
    institutionId: 'inst_test_center',
    enabled: true,
    provider: 'direct_web',
    autoSendAttendance: true,
    autoSendPaymentReceipt: true,
    autoSendPaymentDueReminder: true,
    scheduleReminderHour: 11
  });
  assert.strictEqual(updatedWa.enabled, true);
  assert.strictEqual(updatedWa.scheduleReminderHour, 11);

  // Dispatch message with Egyptian phone normalization (01012345678 -> 201012345678)
  const dispatchRes = await services.sendWhatsAppMessage(callerToken, {
    institutionId: 'inst_test_center',
    phone: '01012345678',
    message: 'مرحباً بكم في سنتر رماس'
  });
  assert.ok(dispatchRes.success);
  assert.ok(dispatchRes.waMeUrl.includes('201012345678'));
  assert.ok(dispatchRes.directUrl.includes('web.whatsapp.com'));
  console.log('✅ Test 2 Passed: WhatsApp config & phone normalization verified.');

  // -------------------------------------------------------------
  // Test 3: Accrued Dues Calculation Formula (4 Sessions = 1 Month)
  // Formula: sessionRate = price / 4. Accrued = sessionsAttended * sessionRate. Net = max(0, Accrued - Paid)
  // -------------------------------------------------------------
  console.log('[Test 3] Testing Accrued Attendance Dues Calculation...');
  const academicYear = await services.createAcademicYear(callerToken, {
    institutionId: 'inst_test_center',
    name: 'العام الدراسي 2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30'
  });

  const stage = await services.createStage(callerToken, {
    institutionId: 'inst_test_center',
    name: 'المرحلة الثانوية',
    academicYearId: academicYear.id
  });

  // Create subject with price 400 LE/month -> sessionRate = 400 / 4 = 100 LE
  const subject = await services.createSubject(callerToken, {
    institutionId: 'inst_test_center',
    name: 'الرياضيات المتقدمة',
    academicYearId: academicYear.id,
    stageId: stage.id,
    price: 400
  });

  const teacher = await services.createTeacher(callerToken, {
    institutionId: 'inst_test_center',
    name: 'أ/ محمد إبراهيم',
    phone: '01055554433',
    subjectIds: [subject.id],
    stageIds: [stage.id]
  });

  await services.assignTeacherSubject(callerToken, {
    institutionId: 'inst_test_center',
    teacherId: teacher.id,
    subjectId: subject.id
  });
  await services.assignTeacherStage(callerToken, {
    institutionId: 'inst_test_center',
    teacherId: teacher.id,
    stageId: stage.id
  });

  const room = await services.createRoom(callerToken, {
    institutionId: 'inst_test_center',
    name: 'قاعة الأوائل',
    capacity: 35
  });

  const group = await services.createGroup(callerToken, {
    institutionId: 'inst_test_center',
    name: 'مجموعة النخبة',
    academicYearId: academicYear.id,
    subjectId: subject.id,
    subjectName: subject.name,
    stageId: stage.id,
    teacherId: teacher.id,
    teacherName: teacher.name,
    roomId: room.id,
    roomName: room.name,
    price: 400,
    capacity: 25
  });

  // Create student enrolled in the group
  const student = await services.createStudent(callerToken, {
    institutionId: 'inst_test_center',
    name: 'أحمد محمود علي',
    phone: '01099887766',
    guardianPhone: '01011223344',
    guardianName: 'محمود علي',
    stageId: stage.id,
    groupIds: [group.id]
  });

  // Simulate 3 attended sessions for the student in this group
  // Expected accrued: 3 * 100 = 300 LE
  for (let i = 1; i <= 3; i++) {
    const ses = await services.createSession(callerToken, {
      institutionId: 'inst_test_center',
      groupId: group.id,
      date: `2026-10-0${i}`,
      startTime: '10:00',
      endTime: '12:00',
      room: room.name
    });
    await services.startSession(callerToken, ses.id, 'inst_test_center');
    await services.recordAttendance(callerToken, {
      institutionId: 'inst_test_center',
      sessionId: ses.id,
      studentId: student.id,
      groupId: group.id,
      status: 'PRESENT'
    });
  }

  // Calculate dues before payment: Accrued = 300, Paid = 0, Net Due = 300
  let dues = await services.calcAccruedStudentDues(callerToken, { institutionId: 'inst_test_center' });
  const stDueBefore = dues.studentsBreakdown.find(s => s.studentId === student.id);
  assert.ok(stDueBefore, 'Student should be present in dues breakdown');
  assert.strictEqual(stDueBefore.attendedSessionsCount, 3);
  assert.strictEqual(stDueBefore.totalAccrued, 300, '3 sessions at 100 LE each should equal 300 LE');
  assert.strictEqual(stDueBefore.totalPaid, 0);
  assert.strictEqual(stDueBefore.netDue, 300);

  // Now record payment of 200 LE
  await services.recordPayment(callerToken, {
    institutionId: 'inst_test_center',
    studentId: student.id,
    studentName: student.name,
    amount: 200,
    paymentMethod: 'CASH'
  });

  // Re-calculate dues after payment: Accrued = 300, Paid = 200, Net Due = 100
  dues = await services.calcAccruedStudentDues(callerToken, { institutionId: 'inst_test_center' });
  const stDueAfter = dues.studentsBreakdown.find(s => s.studentId === student.id);
  assert.strictEqual(stDueAfter.totalAccrued, 300);
  assert.strictEqual(stDueAfter.totalPaid, 200);
  assert.strictEqual(stDueAfter.netDue, 100, 'Remaining net due should be 300 - 200 = 100 LE');
  console.log('✅ Test 3 Passed: Attendance-based accrued dues formula (price / 4) verified exactly.');

  // -------------------------------------------------------------
  // Test 4: Subscriptions & AI VIP Voucher Hub
  // -------------------------------------------------------------
  console.log('[Test 4] Testing AI VIP Voucher Hub...');
  // Generate a batch of 5 vouchers
  const batchRes = await services.generateAiVoucherBatch(callerToken, {
    institutionId: 'inst_test_center',
    count: 5,
    quotaQuestions: 60,
    price: 45,
    name: 'باقة التفوق للذكاء الاصطناعي VIP'
  });
  assert.strictEqual(batchRes.count, 5);
  assert.strictEqual(batchRes.vouchers.length, 5);
  const sampleVoucher = batchRes.vouchers[0];
  assert.ok(sampleVoucher.code.startsWith('VIP-'));
  assert.strictEqual(sampleVoucher.status, 'ACTIVE');

  // Student redeems the voucher code
  const redeemRes = await services.redeemAiVoucher(callerToken, {
    institutionId: 'inst_test_center',
    code: sampleVoucher.code,
    studentId: student.id
  });
  assert.strictEqual(redeemRes.success, true);
  assert.strictEqual(redeemRes.quotaAdded, 60);

  // Check student balance updated
  const updatedStudent = await services.getStudentById(callerToken, student.id, 'inst_test_center');
  assert.strictEqual(updatedStudent.isVip, true);
  assert.strictEqual(updatedStudent.aiQuestionsBalance, 60);

  // Attempting to redeem the same voucher code again must fail with ALREADY_REDEEMED
  let failedAsExpected = false;
  try {
    await services.redeemAiVoucher(callerToken, {
      institutionId: 'inst_test_center',
      code: sampleVoucher.code,
      studentId: student.id
    });
  } catch (err) {
    failedAsExpected = err.message.includes('ALREADY_REDEEMED');
  }
  assert.ok(failedAsExpected, 'Double redemption of voucher must be blocked');
  console.log('✅ Test 4 Passed: AI VIP Voucher Batch Minting, Redemption, and Balance Quota verified.');

  // -------------------------------------------------------------
  // Test 5: Session Validity Window, Automatic Lateness & Absence
  // -------------------------------------------------------------
  console.log('[Test 5] Testing Session Attendance Validity Windows (Late & Absence)...');
  // 1. Create a session with lateThreshold = 10 minutes, closeAttendance = 30 minutes
  const timedSession = await services.createSession(callerToken, {
    institutionId: 'inst_test_center',
    title: 'حصة اختبار مدة الصلاحية والحضور',
    groupId: group.id,
    date: '2026-10-25',
    startTime: '10:00',
    endTime: '12:00',
    room: room.name,
    lateThresholdMinutes: 10,
    closeAttendanceMinutes: 30
  });
  assert.strictEqual(timedSession.lateThresholdMinutes, 10);
  assert.strictEqual(timedSession.closeAttendanceMinutes, 30);

  // Start the session
  const startedSession = await services.startSession(callerToken, timedSession.id, 'inst_test_center');
  assert.strictEqual(startedSession.status, 'OPEN');
  assert.ok(startedSession.openedAt, 'openedAt should be recorded upon startSession');

  // Create two additional students enrolled in the group
  const studentOnTime = await services.createStudent(callerToken, {
    institutionId: 'inst_test_center',
    name: 'سارة خالد محمود',
    phone: '01011112233',
    guardianPhone: '01011112234',
    stageId: stage.id,
    groupIds: [group.id]
  });

  const studentLate = await services.createStudent(callerToken, {
    institutionId: 'inst_test_center',
    name: 'عمر شريف حسن',
    phone: '01022223344',
    guardianPhone: '01022223345',
    stageId: stage.id,
    groupIds: [group.id]
  });

  const studentExpired = await services.createStudent(callerToken, {
    institutionId: 'inst_test_center',
    name: 'مريم طارق يوسف',
    phone: '01033334455',
    guardianPhone: '01033334456',
    stageId: stage.id,
    groupIds: [group.id]
  });

  // Scenario A: On-time attendance (within lateThreshold) -> recorded as PRESENT
  const recOnTime = await services.recordAttendance(callerToken, {
    institutionId: 'inst_test_center',
    sessionId: timedSession.id,
    studentId: studentOnTime.id,
    groupId: group.id,
    status: 'PRESENT'
  });
  assert.strictEqual(recOnTime.status, 'PRESENT', 'Student arriving within threshold must be PRESENT');

  // Scenario B: Late arrival (simulating 15 minutes elapsed, which is > 10m threshold and < 30m close limit)
  // We simulate by updating openedAt to 15 minutes ago
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await services.updateSession(callerToken, timedSession.id, {
    institutionId: 'inst_test_center',
    openedAt: fifteenMinutesAgo,
    startedAt: fifteenMinutesAgo
  });

  const recLate = await services.recordAttendance(callerToken, {
    institutionId: 'inst_test_center',
    sessionId: timedSession.id,
    studentId: studentLate.id,
    groupId: group.id,
    status: 'PRESENT' // default scan attempt
  });
  assert.strictEqual(recLate.status, 'LATE', 'Student arriving after lateThresholdMinutes must be automatically marked LATE');

  // Scenario C: Expired window (simulating 45 minutes elapsed, which is > 30m closeAttendanceMinutes)
  const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  await services.updateSession(callerToken, timedSession.id, {
    institutionId: 'inst_test_center',
    openedAt: fortyFiveMinutesAgo,
    startedAt: fortyFiveMinutesAgo
  });

  let expiredBlockedAsExpected = false;
  try {
    await services.recordAttendance(callerToken, {
      institutionId: 'inst_test_center',
      sessionId: timedSession.id,
      studentId: studentExpired.id,
      groupId: group.id,
      status: 'PRESENT'
    });
  } catch (err) {
    expiredBlockedAsExpected = err.message.includes('ATTENDANCE_WINDOW_EXPIRED');
  }
  assert.ok(expiredBlockedAsExpected, 'Attendance scan after closeAttendanceMinutes must be rejected with ATTENDANCE_WINDOW_EXPIRED');

  // Scenario D: Auto-mark remaining unrecorded students as ABSENT
  const absentResult = await services.markSessionRemainingAbsent(callerToken, {
    institutionId: 'inst_test_center',
    sessionId: timedSession.id
  });
  assert.strictEqual(absentResult.success, true);
  assert.ok(absentResult.markedAbsentCount >= 1, 'At least studentExpired should be marked ABSENT');
  const foundAbsentStudent = absentResult.absentStudents.find(s => s.id === studentExpired.id);
  assert.ok(foundAbsentStudent, 'studentExpired must be in the marked absent list');

  console.log('✅ Test 5 Passed: Session validity window, auto LATE conversion, expired rejection, and bulk absence verified.');

  console.log('\n🌟 ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY WITH 100% PASS RATE! 🌟');
}

runAcceptanceTests().catch(err => {
  console.error('❌ Acceptance Test Failed:', err);
  process.exit(1);
});
