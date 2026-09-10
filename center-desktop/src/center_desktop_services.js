/**
 * REMAS Educational Center SaaS — Desktop Application Services Engine
 * Handles Data Storage, CRUD Operations, and Domain Business Logic for Center Desktop
 * Target Project: educenter-saas
 * Version: 1.0.0-release.38
 */

const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'desktop_database.json');

/**
 * Initial Default Seed Data for Educational Center Operations
 */
function getInitialSeedData() {
  return {
    institution: {
      id: 'inst_bootstrap_001',
      name: 'سنتر التفوق التعليمي',
      phone: '01012345678',
      email: 'info@altafawok-center.com',
      address: 'القاهرة - مدينة نصر - شارع الطيران',
      receiptHeader: 'سنتر التفوق التعليمي - خدمات تعليمية متكاملة',
      logoUrl: null
    },
    students: [
      { id: 'STU_1001', name: 'أحمد محمد علي', phone: '01011112222', guardianPhone: '01122223333', grade: 'الصف الثالث الثانوي', groupId: 'GRP_MATH_01', groupName: 'رياضيات - ثانوية عامة (أ)', qrToken: 'QR_STU_1001', status: 'ACTIVE', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'STU_1002', name: 'سارة محمود حسن', phone: '01022223333', guardianPhone: '01133334444', grade: 'الصف الثالث الثانوي', groupId: 'GRP_PHYS_01', groupName: 'فيزياء - ثانوية عامة (أ)', qrToken: 'QR_STU_1002', status: 'ACTIVE', createdAt: '2026-09-02T11:00:00Z' },
      { id: 'STU_1003', name: 'عمر خالد فؤاد', phone: '01033334444', guardianPhone: '01144445555', grade: 'الصف الثاني الثانوي', groupId: 'GRP_MATH_02', groupName: 'رياضيات - ثانية ثانوي (ب)', qrToken: 'QR_STU_1003', status: 'ACTIVE', createdAt: '2026-09-03T12:00:00Z' }
    ],
    teachers: [
      { id: 'TCH_2001', name: 'أ.د/ إبراهيم عبد الرحمن', phone: '01099998888', email: 'ibrahim@center.com', subject: 'الرياضيات المشتقات والتفاضل', groups: ['GRP_MATH_01', 'GRP_MATH_02'], status: 'ACTIVE' },
      { id: 'TCH_2002', name: 'م/ مصطفى كمال', phone: '01088887777', email: 'kamal@center.com', subject: 'الفيزياء الحديثة والكهربية', groups: ['GRP_PHYS_01'], status: 'ACTIVE' }
    ],
    academicLevels: [
      { id: 'LVL_SEC3', name: 'الصف الثالث الثانوي', code: 'SEC3', order: 3 },
      { id: 'LVL_SEC2', name: 'الصف الثاني الثانوي', code: 'SEC2', order: 2 }
    ],
    subjects: [
      { id: 'SUBJ_MATH', name: 'الرياضيات البحتا والتطبيقية', code: 'MATH', levelId: 'LVL_SEC3' },
      { id: 'SUBJ_PHYS', name: 'الفيزياء للثانوية العامة', code: 'PHYS', levelId: 'LVL_SEC3' }
    ],
    groups: [
      { id: 'GRP_MATH_01', name: 'رياضيات - ثانوية عامة (أ)', subjectId: 'SUBJ_MATH', subjectName: 'الرياضيات', teacherId: 'TCH_2001', teacherName: 'أ.د/ إبراهيم عبد الرحمن', maxCapacity: 30, enrolledCount: 1, schedule: 'الأحد والأربعاء 04:00 مساءً', room: 'قاعة 1', monthlyFee: 350 },
      { id: 'GRP_PHYS_01', name: 'فيزياء - ثانوية عامة (أ)', subjectId: 'SUBJ_PHYS', subjectName: 'الفيزياء', teacherId: 'TCH_2002', teacherName: 'م/ مصطفى كمال', maxCapacity: 25, enrolledCount: 1, schedule: 'الإثنين والخميس 05:00 مساءً', room: 'قاعة 2', monthlyFee: 300 },
      { id: 'GRP_MATH_02', name: 'رياضيات - ثانية ثانوي (ب)', subjectId: 'SUBJ_MATH', subjectName: 'الرياضيات', teacherId: 'TCH_2001', teacherName: 'أ.د/ إبراهيم عبد الرحمن', maxCapacity: 20, enrolledCount: 1, schedule: 'الثلاثاء 03:00 مساءً', room: 'قاعة 3', monthlyFee: 300 }
    ],
    attendanceRecords: [
      { id: 'ATT_3001', studentId: 'STU_1001', studentName: 'أحمد محمد علي', groupId: 'GRP_MATH_01', date: new Date().toISOString().split('T')[0], time: '16:02:10', status: 'PRESENT', method: 'QR_SCANNER' },
      { id: 'ATT_3002', studentId: 'STU_1002', studentName: 'سارة محمود حسن', groupId: 'GRP_PHYS_01', date: new Date().toISOString().split('T')[0], time: '17:05:00', status: 'PRESENT', method: 'MANUAL' }
    ],
    sessions: [
      { id: 'SES_4001', title: 'حصة التفاضل والتكامل - الدرس الأول', groupId: 'GRP_MATH_01', teacherId: 'TCH_2001', date: new Date().toISOString().split('T')[0], startTime: '16:00', endTime: '18:00', room: 'قاعة 1', status: 'COMPLETED' }
    ],
    contentMedia: [
      { id: 'MED_5001', title: 'فيديو شرح مقدمة المشتقات وتطبيقاتها', type: 'VIDEO', subjectId: 'SUBJ_MATH', groupId: 'GRP_MATH_01', storageKey: 'courses/math/sec3_lesson1.mp4', publicCdnUrl: 'https://cdn.remas-saas.edu/media/courses/math/sec3_lesson1.mp4', expiresMinutes: 15, createdAt: '2026-09-05T09:00:00Z' },
      { id: 'MED_5002', title: 'ملزمة مذكرات التمارين والأسئلة الشاملة PDF', type: 'PDF', subjectId: 'SUBJ_MATH', groupId: 'GRP_MATH_01', storageKey: 'courses/math/sec3_workbook.pdf', publicCdnUrl: 'https://cdn.remas-saas.edu/media/courses/math/sec3_workbook.pdf', expiresMinutes: 15, createdAt: '2026-09-06T10:00:00Z' }
    ],
    exams: [
      { id: 'EXM_6001', title: 'اختبار شهر سبتمبر - الرياضيات', subjectId: 'SUBJ_MATH', groupId: 'GRP_MATH_01', maxScore: 100, examDate: '2026-09-15', status: 'SCHEDULED' }
    ],
    grades: [
      { id: 'GRD_7001', examId: 'EXM_6001', studentId: 'STU_1001', studentName: 'أحمد محمد علي', score: 92, maxScore: 100, percentage: 92.0, status: 'PASSED' }
    ],
    subscriptions: [
      { id: 'SUB_8001', packageName: 'الباقة الشهرية الكاملة - رياضيات', studentId: 'STU_1001', studentName: 'أحمد محمد علي', subjectId: 'SUBJ_MATH', code: 'SUB-MATH-2026-X912', status: 'ACTIVE', startDate: '2026-09-01', endDate: '2026-10-01' }
    ],
    parents: [
      { id: 'PAR_9001', name: 'م/ محمد علي الأحمدي', phone: '01122223333', email: 'm.ali@gmail.com', linkedStudentIds: ['STU_1001'], linkedStudentNames: ['أحمد محمد علي'] }
    ],
    payments: [
      { id: 'PAY_10001', receiptNumber: 'REC-1001', studentId: 'STU_1001', studentName: 'أحمد محمد علي', category: 'مصاريف دراسية شهرية', amount: 350, paymentDate: new Date().toISOString().split('T')[0], notes: 'سداد رسوم شهر سبتمبر' }
    ],
    expenses: [
      { id: 'EXP_20001', category: 'إيجار القاعات والكهرباء', amount: 3500, expenseDate: new Date().toISOString().split('T')[0], notes: 'فاتورة الكهرباء والصيانة الشهرية' }
    ],
    aiSettings: {
      institutionId: 'inst_bootstrap_001',
      aiEnabled: true,
      dailyLimitPerStudent: 50,
      allowedFeatures: ['QA', 'LESSON_EXPLAIN', 'SUMMARIZE', 'SELF_TEST', 'WEAKNESS_ANALYSIS', 'STUDY_PLAN']
    }
  };
}

/**
 * Loads database store from disk with fallback to seed data
 */
function loadDatabase() {
  if (fs.existsSync(STORE_PATH)) {
    try {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      // Fallback
    }
  }

  const initial = getInitialSeedData();
  saveDatabase(initial);
  return initial;
}

/**
 * Saves database store to disk
 */
function saveDatabase(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // Ignore write issues
  }
}

// -------------------------------------------------------------
// Service Methods for Center Management Application Modules
// -------------------------------------------------------------

function getDashboardSummary() {
  const db = loadDatabase();
  const todayStr = new Date().toISOString().split('T')[0];

  const totalStudents = db.students.length;
  const totalTeachers = db.teachers.length;
  const totalGroups = db.groups.length;

  const todayAttendance = db.attendanceRecords.filter(r => r.date === todayStr);
  const presentCount = todayAttendance.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absentCount = todayAttendance.filter(r => r.status === 'ABSENT').length;

  const activeSubscriptions = db.subscriptions.filter(s => s.status === 'ACTIVE').length;

  const totalRevenue = db.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalExpenses = db.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return {
    institution: db.institution,
    totalStudents,
    totalTeachers,
    totalGroups,
    presentCount,
    absentCount,
    activeSubscriptions,
    totalRevenue,
    totalExpenses,
    recentPayments: db.payments.slice(-5).reverse(),
    recentAttendance: db.attendanceRecords.slice(-5).reverse()
  };
}

// Student CRUD Operations
function getStudents({ query = '', grade = '', status = '' } = {}) {
  const db = loadDatabase();
  let list = db.students;

  if (query) {
    const q = query.toLowerCase();
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.id.includes(q));
  }
  if (grade) list = list.filter(s => s.grade === grade);
  if (status) list = list.filter(s => s.status === status);

  return list;
}

function addStudent(studentData) {
  const db = loadDatabase();
  const newId = `STU_${1000 + db.students.length + 1}`;
  const newStudent = {
    id: newId,
    name: studentData.name,
    phone: studentData.phone || '',
    guardianPhone: studentData.guardianPhone || '',
    grade: studentData.grade || 'الصف الثالث الثانوي',
    groupId: studentData.groupId || 'GRP_MATH_01',
    groupName: studentData.groupName || 'مجموعة افتراضية',
    qrToken: `QR_${newId}`,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  // Group Capacity check
  const group = db.groups.find(g => g.id === newStudent.groupId);
  if (group) {
    if (group.enrolledCount >= group.maxCapacity) {
      throw new Error(`GROUP_CAPACITY_EXCEEDED: المجموعة وصلت للحد الأقصى للسعة (${group.maxCapacity} طالب)`);
    }
    group.enrolledCount += 1;
  }

  db.students.push(newStudent);
  saveDatabase(db);
  return newStudent;
}

// Attendance Operations with Scanner and Kiosk Mode
function recordAttendanceScan({ studentCodeOrQr, groupId = null, method = 'QR_SCANNER' }) {
  const db = loadDatabase();
  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString('ar-EG');

  // Find student by ID or QR Token
  const student = db.students.find(s => s.id === studentCodeOrQr || s.qrToken === studentCodeOrQr || s.phone === studentCodeOrQr);
  if (!student) {
    throw new Error('STUDENT_NOT_FOUND: لم يتم العثور على طالب بهذا الكود أو رمز الـ QR');
  }

  const targetGroupId = groupId || student.groupId;

  // Check duplicate attendance today
  const existing = db.attendanceRecords.find(r => r.studentId === student.id && r.date === todayStr && r.groupId === targetGroupId);
  if (existing) {
    return {
      duplicate: true,
      message: `تم تسجيل حضور الطالب (${student.name}) مسبقاً اليوم في تمام الساعة ${existing.time}`,
      record: existing,
      student
    };
  }

  const newRecord = {
    id: `ATT_${3000 + db.attendanceRecords.length + 1}`,
    studentId: student.id,
    studentName: student.name,
    groupId: targetGroupId,
    date: todayStr,
    time: nowTime,
    status: 'PRESENT',
    method
  };

  db.attendanceRecords.push(newRecord);
  saveDatabase(db);

  return {
    duplicate: false,
    message: `تم تسجيل حضور الطالب (${student.name}) بنجاح 🟢`,
    record: newRecord,
    student
  };
}

// Teachers & Groups
function getTeachers() { return loadDatabase().teachers; }
function getGroups() { return loadDatabase().groups; }

function addGroup(groupData) {
  const db = loadDatabase();
  const newId = `GRP_${db.groups.length + 1}`;
  const newGroup = {
    id: newId,
    name: groupData.name,
    subjectId: groupData.subjectId || 'SUBJ_MATH',
    subjectName: groupData.subjectName || 'الرياضيات',
    teacherId: groupData.teacherId || 'TCH_2001',
    teacherName: groupData.teacherName || 'أ.د/ إبراهيم عبد الرحمن',
    maxCapacity: groupData.maxCapacity || 30,
    enrolledCount: 0,
    schedule: groupData.schedule || 'الأحد والخميس 04:00 مساءً',
    room: groupData.room || 'قاعة 1',
    monthlyFee: groupData.monthlyFee || 300
  };
  db.groups.push(newGroup);
  saveDatabase(db);
  return newGroup;
}

// Financial Payments & Receipts
function addPayment(paymentData) {
  const db = loadDatabase();
  const newId = `PAY_${10000 + db.payments.length + 1}`;
  const receiptNum = `REC-${1000 + db.payments.length + 1}`;

  const student = db.students.find(s => s.id === paymentData.studentId);
  const studentName = student ? student.name : (paymentData.studentName || 'طالب عالي');

  const newPayment = {
    id: newId,
    receiptNumber: receiptNum,
    studentId: paymentData.studentId,
    studentName,
    category: paymentData.category || 'مصاريف دراسية شهرية',
    amount: parseFloat(paymentData.amount) || 0,
    paymentDate: new Date().toISOString().split('T')[0],
    notes: paymentData.notes || ''
  };

  db.payments.push(newPayment);
  saveDatabase(db);
  return newPayment;
}

function addExpense(expenseData) {
  const db = loadDatabase();
  const newId = `EXP_${20000 + db.expenses.length + 1}`;

  const newExpense = {
    id: newId,
    category: expenseData.category || 'مصروفات تشغيلية',
    amount: parseFloat(expenseData.amount) || 0,
    expenseDate: new Date().toISOString().split('T')[0],
    notes: expenseData.notes || ''
  };

  db.expenses.push(newExpense);
  saveDatabase(db);
  return newExpense;
}

// Educational Content
function getContentMedia() { return loadDatabase().contentMedia; }
function getExams() { return loadDatabase().exams; }
function getGrades() { return loadDatabase().grades; }
function getSubscriptions() { return loadDatabase().subscriptions; }
function getParents() { return loadDatabase().parents; }
function getCenterAISettings() { return loadDatabase().aiSettings; }

function updateCenterAISettings(settingsData) {
  const db = loadDatabase();
  db.aiSettings = {
    ...db.aiSettings,
    aiEnabled: typeof settingsData.aiEnabled === 'boolean' ? settingsData.aiEnabled : db.aiSettings.aiEnabled,
    dailyLimitPerStudent: settingsData.dailyLimitPerStudent || db.aiSettings.dailyLimitPerStudent
  };
  saveDatabase(db);
  return db.aiSettings;
}

function updateCenterInfo(infoData) {
  const db = loadDatabase();
  db.institution = {
    ...db.institution,
    name: infoData.name || db.institution.name,
    phone: infoData.phone || db.institution.phone,
    email: infoData.email || db.institution.email,
    address: infoData.address || db.institution.address
  };
  saveDatabase(db);
  return db.institution;
}

module.exports = {
  getDashboardSummary,
  getStudents,
  addStudent,
  recordAttendanceScan,
  getTeachers,
  getGroups,
  addGroup,
  addPayment,
  addExpense,
  getContentMedia,
  getExams,
  getGrades,
  getSubscriptions,
  getParents,
  getCenterAISettings,
  updateCenterAISettings,
  updateCenterInfo,
  loadDatabase
};
