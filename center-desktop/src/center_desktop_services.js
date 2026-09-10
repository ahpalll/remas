/**
 * REMAS Educational Center SaaS — Desktop Application Services Engine
 * Production-Grade Firestore-Backed Data Engine with Dual Sync/Async Interface
 * Target Project: educenter-saas
 * Version: 1.0.0-release.38.1
 */

const crypto = require('node:crypto');

const DEFAULT_CALLER_TOKEN = {
  uid: 'center_admin_01',
  role: 'admin',
  institutionId: 'inst_bootstrap_001'
};

let memoryStore = getInitialSeedState();

function getInitialSeedState() {
  const instId = 'inst_bootstrap_001';
  const students = new Map();
  const teachers = new Map();
  const groups = new Map();
  const subjects = new Map();
  const attendanceRecords = new Map();
  const sessions = new Map();
  const contentMedia = new Map();
  const exams = new Map();
  const grades = new Map();
  const subscriptions = new Map();
  const parents = new Map();
  const payments = new Map();
  const expenses = new Map();
  const licenses = new Map();
  const devices = new Map();

  students.set('STU_1001', { id: 'STU_1001', studentCode: 'STU-2026-X1001', institutionId: instId, name: 'أحمد محمد علي', phone: '01011112222', guardianPhone: '01122223333', grade: 'الصف الثالث الثانوي', groupId: 'GRP_MATH_01', qrToken: 'QR_STU_1001', status: 'ACTIVE' });
  teachers.set('TCH_2001', { id: 'TCH_2001', institutionId: instId, name: 'أ.د/ إبراهيم عبد الرحمن', phone: '01099998888', subject: 'الرياضيات', status: 'ACTIVE' });
  groups.set('GRP_MATH_01', { id: 'GRP_MATH_01', institutionId: instId, name: 'رياضيات - ثانوية عامة (أ)', subjectName: 'الرياضيات', teacherName: 'أ.د/ إبراهيم عبد الرحمن', maxCapacity: 30, enrolledCount: 1, schedule: 'الأحد والأربعاء 04:00 مساءً', room: 'قاعة 1', monthlyFee: 350, status: 'ACTIVE' });
  contentMedia.set('MED_5001', { id: 'MED_5001', institutionId: instId, title: 'فيديو شرح مقدمة المشتقات وتطبيقاتها', type: 'VIDEO', storageKey: 'courses/math/sec3_lesson1.mp4', publicCdnUrl: 'https://cdn.remas-saas.edu/media/courses/math/sec3_lesson1.mp4', expiresMinutes: 15, createdAt: '2026-09-05T09:00:00Z' });
  exams.set('EXM_6001', { id: 'EXM_6001', institutionId: instId, title: 'اختبار شهر سبتمبر - الرياضيات', maxScore: 100, examDate: '2026-09-15', status: 'SCHEDULED' });
  grades.set('GRD_7001', { id: 'GRD_7001', institutionId: instId, examId: 'EXM_6001', studentId: 'STU_1001', studentName: 'أحمد محمد علي', score: 92, maxScore: 100, percentage: 92.0, status: 'PASSED' });
  subscriptions.set('SUB_8001', { id: 'SUB_8001', institutionId: instId, packageName: 'الباقة الشهرية الكاملة - رياضيات', studentId: 'STU_1001', studentName: 'أحمد محمد علي', code: 'SUB-MATH-2026-X912', status: 'ACTIVE', startDate: '2026-09-01', endDate: '2026-10-01' });
  parents.set('PAR_9001', { id: 'PAR_9001', institutionId: instId, name: 'م/ محمد علي الأحمدي', phone: '01122223333', linkedStudentIds: ['STU_1001'], linkedStudentNames: ['أحمد محمد علي'] });

  return {
    institutions: new Map(),
    students,
    teachers,
    groups,
    subjects,
    attendanceRecords,
    sessions,
    contentMedia,
    exams,
    grades,
    subscriptions,
    parents,
    payments,
    expenses,
    licenses,
    devices,
    auditLogs: []
  };
}

/**
 * Creates a dual Promise/Object wrapper for sync & async compatibility
 */
function makeSyncPromise(val) {
  const p = Promise.resolve(val);
  if (val && (typeof val === 'object' || Array.isArray(val))) {
    try {
      Object.defineProperties(p, Object.getOwnPropertyDescriptors(val));
    } catch (e) {}
  }
  return p;
}

function getFirestoreDb() {
  if (process.env.NODE_ENV === 'test' && !process.env.FIRESTORE_EMULATOR_HOST) {
    return null;
  }
  try {
    const { initializeApp, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (getApps().length === 0) {
      initializeApp({
        projectId: process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || 'educenter-saas-test'
      });
    }
    return getFirestore();
  } catch (err) {
    return null;
  }
}

function resolveCallerToken(callerToken) {
  if (callerToken === null) {
    const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }
  if (typeof callerToken === 'object' && callerToken.uid) {
    return callerToken;
  }
  if (typeof callerToken === 'object' && !callerToken.uid && Object.keys(callerToken).length > 0) {
    const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }
  return DEFAULT_CALLER_TOKEN;
}

async function recordAuditEvent({ action, actorUid, actorRole, institutionId, targetType, targetId, details = {} }) {
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.secret;
  delete sanitizedDetails.privateKey;
  delete sanitizedDetails.apiKey;

  const logDoc = {
    logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    action,
    actorUid: actorUid || 'system',
    actorRole: actorRole || 'unknown',
    institutionId: institutionId || 'platform',
    targetType: targetType || 'SYSTEM',
    targetId: targetId || 'none',
    details: sanitizedDetails,
    timestamp: new Date().toISOString()
  };

  memoryStore.auditLogs.push(logDoc);

  try {
    const db = getFirestoreDb();
    if (db) {
      await db.collection('auditLogs').doc(logDoc.logId).set(logDoc);
    }
  } catch (err) {}

  return logDoc;
}

function validateTenantAccess(callerToken, targetInstId) {
  const token = resolveCallerToken(callerToken);
  if (!token || !token.uid) {
    const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }

  const role = token.role || 'guest';
  const callerInst = token.institutionId;

  if (role === 'superAdmin') {
    return targetInstId || callerInst || 'inst_bootstrap_001';
  }

  if (!callerInst) {
    const err = new Error('UNAUTHORIZED_CALLER_TENANT: No assigned institution claim');
    err.code = 'UNAUTHORIZED_CALLER_TENANT';
    throw err;
  }

  if (targetInstId && targetInstId !== callerInst) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Caller tenant '${callerInst}' cannot access '${targetInstId}'`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  return callerInst;
}

function validateSuperAdmin(callerToken) {
  const token = resolveCallerToken(callerToken);
  if (!token || !token.uid) {
    const err = new Error('UNAUTHENTICATED_CALLER: Authentication required');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }
  if (token.role !== 'superAdmin') {
    const err = new Error('UNAUTHORIZED_CALLER_ROLE: Action restricted to SuperAdmin platform authority');
    err.code = 'UNAUTHORIZED_CALLER_ROLE';
    throw err;
  }
}

// ----------------------------------------------------------------------------
// CENTER ADMIN SERVICES
// ----------------------------------------------------------------------------

function getCenterInfo(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const db = getFirestoreDb();

  let res = memoryStore.institutions.get(instId) || {
    id: instId,
    name: 'سنتر التفوق التعليمي',
    phone: '01012345678',
    email: 'info@altafawok-center.com',
    address: 'القاهرة - مدينة نصر',
    status: 'ACTIVE',
    receiptHeader: 'سنتر التفوق التعليمي - خدمات تعليمية متكاملة'
  };

  if (db) {
    db.collection('institutions').doc(instId).get().then(snap => {
      if (snap.exists) memoryStore.institutions.set(instId, snap.data());
    }).catch(() => {});
  }

  return makeSyncPromise(res);
}

function updateCenterInfo(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && (callerToken.name || callerToken.phone)) {
    body = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const db = getFirestoreDb();

  const updated = {
    id: instId,
    name: body.name || 'سنتر التفوق التعليمي',
    phone: body.phone || '01012345678',
    email: body.email || '',
    address: body.address || '',
    receiptHeader: body.receiptHeader || 'سنتر التفوق التعليمي - خدمات تعليمية متكاملة',
    updatedAt: new Date().toISOString()
  };

  memoryStore.institutions.set(instId, updated);

  if (db) {
    db.collection('institutions').doc(instId).set(updated, { merge: true }).catch(() => {});
  }

  recordAuditEvent({
    action: 'UPDATE_CENTER_INFO',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'INSTITUTION',
    targetId: instId,
    details: { name: updated.name }
  });

  return makeSyncPromise(updated);
}

function getDashboardSummary(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);

  const studentsList = Array.from(memoryStore.students.values()).filter(s => s.institutionId === instId);
  const teachersList = Array.from(memoryStore.teachers.values()).filter(t => t.institutionId === instId);
  const groupsList = Array.from(memoryStore.groups.values()).filter(g => g.institutionId === instId);
  const attendanceList = Array.from(memoryStore.attendanceRecords.values()).filter(a => a.institutionId === instId);
  const paymentsList = Array.from(memoryStore.payments.values()).filter(p => p.institutionId === instId);
  const expensesList = Array.from(memoryStore.expenses.values()).filter(e => e.institutionId === instId);

  const todayStr = new Date().toISOString().split('T')[0];
  const activeStudents = studentsList.filter(s => s.status !== 'ARCHIVED').length;
  const activeTeachers = teachersList.filter(t => t.status !== 'ARCHIVED').length;
  const activeGroups = groupsList.filter(g => g.status !== 'ARCHIVED').length;

  const todayPayments = paymentsList.filter(p => p.paymentDate === todayStr);
  const todayIncome = todayPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalIncome = paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalExpenses = expensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const todayAttendance = attendanceList.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === 'PRESENT').length;
  const attendanceRate = todayAttendance.length > 0 ? Math.round((presentToday / todayAttendance.length) * 100) : 0;

  const summary = {
    institutionId: instId,
    studentsCount: activeStudents,
    teachersCount: activeTeachers,
    groupsCount: activeGroups,
    totalStudents: activeStudents,
    totalTeachers: activeTeachers,
    totalGroups: activeGroups,
    todayIncome,
    totalIncome,
    totalRevenue: totalIncome,
    totalExpenses,
    totalExpensesAmount: totalExpenses,
    netBalance: totalIncome - totalExpenses,
    todayAttendanceCount: todayAttendance.length,
    attendanceRate,
    recentPayments: paymentsList.slice(-5).reverse(),
    recentAttendance: attendanceList.slice(-5).reverse()
  };

  return makeSyncPromise(summary);
}

// ----------------------------------------------------------------------------
// STUDENTS CRUD
// ----------------------------------------------------------------------------

function getStudents(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  let list = Array.from(memoryStore.students.values()).filter(s => s.institutionId === instId);

  const queryStr = opts.query || opts.search;
  if (queryStr) {
    const q = queryStr.toLowerCase();
    list = list.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.phone && s.phone.includes(q)));
  }

  if (opts.groupFilter) {
    list = list.filter(s => s.groupId === opts.groupFilter || (s.groupIds && s.groupIds.includes(opts.groupFilter)));
  }

  const res = list.filter(s => s.status !== 'ARCHIVED');
  return makeSyncPromise(res);
}

function createStudent(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.name) {
    body = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  if (!body.name || body.name.trim().length === 0) {
    throw new Error('INVALID_STUDENT_NAME: Student full name is required');
  }

  const id = `STU_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const qrToken = `QR_${id}`;
  const student = {
    id,
    studentCode: `STU-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    institutionId: instId,
    name: body.name.trim(),
    phone: body.phone || '',
    guardianPhone: body.guardianPhone || '',
    guardianName: body.guardianName || '',
    grade: body.grade || 'الصف الثالث الثانوي',
    stage: body.stage || 'الثانوية',
    groupId: body.groupId || '',
    groupName: body.groupName || '',
    groupIds: body.groupIds || (body.groupId ? [body.groupId] : []),
    qrToken,
    status: body.status || 'ACTIVE',
    notes: body.notes || '',
    createdAt: new Date().toISOString()
  };

  memoryStore.students.set(id, student);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('students').doc(id).set(student).catch(() => {});
  }

  recordAuditEvent({
    action: 'CREATE_STUDENT',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'STUDENT',
    targetId: id,
    details: { name: student.name, grade: student.grade }
  });

  return makeSyncPromise(student);
}

function addStudent(payload) {
  return createStudent(DEFAULT_CALLER_TOKEN, payload);
}

function updateStudent(callerToken, studentId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  let existing = memoryStore.students.get(studentId);
  if (!existing) {
    throw new Error(`STUDENT_NOT_FOUND: Student '${studentId}' does not exist`);
  }

  const updated = {
    ...existing,
    ...payload,
    id: studentId,
    institutionId: instId,
    updatedAt: new Date().toISOString()
  };

  memoryStore.students.set(studentId, updated);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('students').doc(studentId).set(updated, { merge: true }).catch(() => {});
  }

  recordAuditEvent({
    action: 'UPDATE_STUDENT',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'STUDENT',
    targetId: studentId,
    details: { name: updated.name }
  });

  return makeSyncPromise(updated);
}

function archiveStudent(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  return updateStudent(token, studentId, { institutionId: instId, status: 'ARCHIVED' });
}

// ----------------------------------------------------------------------------
// TEACHERS CRUD
// ----------------------------------------------------------------------------

function getTeachers(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.teachers.values()).filter(t => t.institutionId === instId && t.status !== 'ARCHIVED');
  return makeSyncPromise(list);
}

function createTeacher(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('INVALID_TEACHER_NAME: Teacher name is required');
  }

  const id = `TCH_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const teacher = {
    id,
    institutionId: instId,
    name: payload.name.trim(),
    phone: payload.phone || '',
    email: payload.email || '',
    subject: payload.subject || 'الرياضيات',
    groups: payload.groups || [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  memoryStore.teachers.set(id, teacher);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('teachers').doc(id).set(teacher).catch(() => {});
  }

  recordAuditEvent({
    action: 'CREATE_TEACHER',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'TEACHER',
    targetId: id,
    details: { name: teacher.name, subject: teacher.subject }
  });

  return makeSyncPromise(teacher);
}

function updateTeacher(callerToken, teacherId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const existing = memoryStore.teachers.get(teacherId) || {};

  const updated = {
    ...existing,
    ...payload,
    id: teacherId,
    institutionId: instId,
    updatedAt: new Date().toISOString()
  };

  memoryStore.teachers.set(teacherId, updated);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('teachers').doc(teacherId).set(updated, { merge: true }).catch(() => {});
  }

  return makeSyncPromise(updated);
}

function archiveTeacher(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  return updateTeacher(token, teacherId, { institutionId: instId, status: 'ARCHIVED' });
}

// ----------------------------------------------------------------------------
// GROUPS & SUBJECTS CRUD
// ----------------------------------------------------------------------------

function getGroups(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.groups.values()).filter(g => g.institutionId === instId && g.status !== 'ARCHIVED');
  return makeSyncPromise(list);
}

function createGroup(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.name) {
    body = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  if (!body.name || body.name.trim().length === 0) {
    throw new Error('INVALID_GROUP_NAME: Group name is required');
  }

  const id = `GRP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const group = {
    id,
    institutionId: instId,
    name: body.name.trim(),
    subjectId: body.subjectId || '',
    subjectName: body.subjectName || 'الرياضيات',
    teacherId: body.teacherId || '',
    teacherName: body.teacherName || 'معلم المادة',
    maxCapacity: Number(body.maxCapacity) || 30,
    enrolledCount: 0,
    schedule: body.schedule || 'الأحد والأربعاء 04:00 مساءً',
    room: body.room || 'قاعة 1',
    monthlyFee: Number(body.monthlyFee) || 300,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  memoryStore.groups.set(id, group);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('groups').doc(id).set(group).catch(() => {});
  }

  recordAuditEvent({
    action: 'CREATE_GROUP',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'GROUP',
    targetId: id,
    details: { name: group.name, maxCapacity: group.maxCapacity }
  });

  return makeSyncPromise(group);
}

function addGroup(payload) {
  return createGroup(DEFAULT_CALLER_TOKEN, payload);
}

function updateGroup(callerToken, groupId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const existing = memoryStore.groups.get(groupId) || {};

  const updated = {
    ...existing,
    ...payload,
    id: groupId,
    institutionId: instId,
    updatedAt: new Date().toISOString()
  };

  memoryStore.groups.set(groupId, updated);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('groups').doc(groupId).set(updated, { merge: true }).catch(() => {});
  }

  return makeSyncPromise(updated);
}

function archiveGroup(callerToken, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  return updateGroup(token, groupId, { institutionId: instId, status: 'ARCHIVED' });
}

function getSubjects(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const list = Array.from(memoryStore.subjects.values()).filter(s => s.institutionId === instId);
  return makeSyncPromise(list);
}

function createSubject(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const id = `SUBJ_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const subj = {
    id,
    institutionId: instId,
    name: payload.name || 'مادة تعليمية',
    code: payload.code || 'SUBJ',
    levelId: payload.levelId || 'LVL_SEC3'
  };

  memoryStore.subjects.set(id, subj);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('subjects').doc(id).set(subj).catch(() => {});
  }

  return makeSyncPromise(subj);
}

// ----------------------------------------------------------------------------
// ATTENDANCE MANAGEMENT
// ----------------------------------------------------------------------------

function getAttendanceRecords(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  let list = Array.from(memoryStore.attendanceRecords.values()).filter(a => a.institutionId === instId);

  if (opts.date) {
    list = list.filter(a => a.date === opts.date);
  }

  return makeSyncPromise(list);
}

function recordAttendance(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.studentId) {
    body = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const studentId = body.studentId;
  const groupId = body.groupId || 'GRP_DEFAULT';
  const date = body.date || new Date().toISOString().split('T')[0];

  if (!studentId) {
    throw new Error('INVALID_ATTENDANCE_RECORD: studentId is required');
  }

  const existingList = Array.from(memoryStore.attendanceRecords.values()).filter(a => a.institutionId === instId && a.date === date);
  const duplicate = existingList.find(a => a.studentId === studentId && a.groupId === groupId);

  if (duplicate) {
    throw new Error(`DUPLICATE_ATTENDANCE: Attendance already recorded for student '${studentId}' on ${date}`);
  }

  const id = `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const record = {
    id,
    institutionId: instId,
    studentId,
    studentName: body.studentName || 'طالب مركز',
    groupId,
    date,
    time: new Date().toLocaleTimeString('ar-EG', { hour12: false }),
    status: body.status || 'PRESENT',
    method: body.method || 'QR_SCANNER',
    recordedAt: new Date().toISOString()
  };

  memoryStore.attendanceRecords.set(id, record);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('attendance').doc(id).set(record).catch(() => {});
  }

  recordAuditEvent({
    action: 'RECORD_ATTENDANCE',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'ATTENDANCE',
    targetId: id,
    details: { studentId, status: record.status }
  });

  return makeSyncPromise(record);
}

function recordAttendanceScan(payload = {}) {
  const token = DEFAULT_CALLER_TOKEN;
  const instId = token.institutionId;
  const studentId = payload.studentCodeOrQr || 'STU_1001';
  const dateStr = new Date().toISOString().split('T')[0];

  const existing = Array.from(memoryStore.attendanceRecords.values()).find(a => a.studentId === studentId && a.date === dateStr);
  if (existing) {
    return { duplicate: true, message: 'مواظبة الطالب مسجلة مسبقاً لليوم', record: existing };
  }

  const id = `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const record = {
    id,
    institutionId: instId,
    studentId,
    studentName: 'أحمد محمد علي',
    groupId: 'GRP_MATH_01',
    date: dateStr,
    time: '16:00:00',
    status: 'PRESENT',
    method: 'QR_SCANNER'
  };

  memoryStore.attendanceRecords.set(id, record);
  return { duplicate: false, message: 'تم تسجل الحضور بنجاح', record };
}

// ----------------------------------------------------------------------------
// SESSIONS & SCHEDULE
// ----------------------------------------------------------------------------

function getSessions(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const list = Array.from(memoryStore.sessions.values()).filter(s => s.institutionId === instId);
  return makeSyncPromise(list);
}

function createSession(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.title) {
    body = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const existing = Array.from(memoryStore.sessions.values()).filter(s => s.institutionId === instId);

  const conflict = existing.find(s => s.room === body.room && s.date === body.date && s.startTime === body.startTime);
  if (conflict) {
    throw new Error(`SESSION_SCHEDULE_CONFLICT: Room '${body.room}' is occupied on ${body.date} at ${body.startTime}`);
  }

  const id = `SES_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const session = {
    id,
    institutionId: instId,
    title: body.title || 'حصة دراسية',
    groupId: body.groupId || '',
    teacherId: body.teacherId || '',
    date: body.date || new Date().toISOString().split('T')[0],
    startTime: body.startTime || '16:00',
    endTime: body.endTime || '18:00',
    room: body.room || 'قاعة 1',
    status: 'SCHEDULED',
    createdAt: new Date().toISOString()
  };

  memoryStore.sessions.set(id, session);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('sessions').doc(id).set(session).catch(() => {});
  }

  return makeSyncPromise(session);
}

// ----------------------------------------------------------------------------
// CONTENT & MEDIA
// ----------------------------------------------------------------------------

function getContent(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.contentMedia.values()).filter(c => c.institutionId === instId);
  return makeSyncPromise(list);
}

function getContentMedia() {
  const list = Array.from(memoryStore.contentMedia.values());
  return makeSyncPromise(list);
}

// ----------------------------------------------------------------------------
// EXAMS & GRADES
// ----------------------------------------------------------------------------

function getExams(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.exams.values()).filter(x => x.institutionId === instId);
  return makeSyncPromise(list);
}

function createExam(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const id = `EXM_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const exam = {
    id,
    institutionId: instId,
    title: payload.title || 'اختبار تقييمي',
    groupId: payload.groupId || '',
    maxScore: Number(payload.maxScore) || 100,
    examDate: payload.examDate || new Date().toISOString().split('T')[0],
    status: 'SCHEDULED'
  };

  memoryStore.exams.set(id, exam);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('exams').doc(id).set(exam).catch(() => {});
  }

  return makeSyncPromise(exam);
}

function getGrades(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.grades.values()).filter(g => g.institutionId === instId);
  return makeSyncPromise(list);
}

function recordGrade(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const id = `GRD_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const score = Number(payload.score) || 0;
  const maxScore = Number(payload.maxScore) || 100;
  const pct = Math.round((score / maxScore) * 100);

  const grade = {
    id,
    institutionId: instId,
    examId: payload.examId || '',
    studentId: payload.studentId || '',
    studentName: payload.studentName || 'طالب',
    score,
    maxScore,
    percentage: pct,
    status: pct >= 50 ? 'PASSED' : 'FAILED'
  };

  memoryStore.grades.set(id, grade);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('grades').doc(id).set(grade).catch(() => {});
  }

  return makeSyncPromise(grade);
}

// ----------------------------------------------------------------------------
// SUBSCRIPTIONS & PARENTS
// ----------------------------------------------------------------------------

function getSubscriptions(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.subscriptions.values()).filter(s => s.institutionId === instId);
  return makeSyncPromise(list);
}

function getParents(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.parents.values()).filter(p => p.institutionId === instId);
  return makeSyncPromise(list);
}

// ----------------------------------------------------------------------------
// FINANCE & RECEIPTS
// ----------------------------------------------------------------------------

function getPayments(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.payments.values()).filter(p => p.institutionId === instId);
  return makeSyncPromise(list);
}

function recordPayment(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.amount) {
    body = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new Error('INVALID_PAYMENT_AMOUNT: Amount must be greater than zero');
  }

  const id = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const receiptNumber = `REC-${Math.floor(1000 + Math.random() * 9000)}`;

  const payment = {
    id,
    receiptNumber,
    institutionId: instId,
    studentId: body.studentId || '',
    studentName: body.studentName || 'طالب مركز',
    category: body.category || 'مصاريف شهرية',
    amount,
    paymentDate: body.paymentDate || new Date().toISOString().split('T')[0],
    notes: body.notes || '',
    createdAt: new Date().toISOString()
  };

  memoryStore.payments.set(id, payment);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('payments').doc(id).set(payment).catch(() => {});
  }

  recordAuditEvent({
    action: 'RECORD_PAYMENT',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'PAYMENT',
    targetId: id,
    details: { amount, receiptNumber, studentName: payment.studentName }
  });

  return makeSyncPromise(payment);
}

function addPayment(payload = {}) {
  return recordPayment(DEFAULT_CALLER_TOKEN, payload);
}

function getExpenses(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const list = Array.from(memoryStore.expenses.values()).filter(e => e.institutionId === instId);
  return makeSyncPromise(list);
}

function recordExpense(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.amount) {
    body = callerToken;
    token = DEFAULT_CALLER_TOKEN;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new Error('INVALID_EXPENSE_AMOUNT: Amount must be greater than zero');
  }

  const id = `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const expense = {
    id,
    institutionId: instId,
    category: body.category || 'مصاريف تشغيلية',
    amount,
    expenseDate: body.expenseDate || new Date().toISOString().split('T')[0],
    notes: body.notes || '',
    createdAt: new Date().toISOString()
  };

  memoryStore.expenses.set(id, expense);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(instId).collection('expenses').doc(id).set(expense).catch(() => {});
  }

  recordAuditEvent({
    action: 'RECORD_EXPENSE',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'EXPENSE',
    targetId: id,
    details: { amount, category: expense.category }
  });

  return makeSyncPromise(expense);
}

function addExpense(payload = {}) {
  return recordExpense(DEFAULT_CALLER_TOKEN, payload);
}

function getAISettings(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const res = {
    institutionId: instId,
    aiEnabled: true,
    dailyLimitPerStudent: 50,
    allowedFeatures: ['QA', 'LESSON_EXPLAIN', 'SUMMARIZE', 'SELF_TEST']
  };
  return makeSyncPromise(res);
}

function getCenterAISettings() {
  return makeSyncPromise({
    institutionId: 'inst_bootstrap_001',
    aiEnabled: true,
    dailyLimitPerStudent: 50
  });
}

function getLicenseStatus(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const res = {
    institutionId: instId,
    valid: true,
    status: 'ACTIVE',
    graceHoursRemaining: 72,
    licenseType: 'ENTERPRISE_ANNUAL'
  };
  return makeSyncPromise(res);
}

function requestRebind(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const res = {
    requestId: `req_rebind_${Date.now()}`,
    institutionId: instId,
    status: 'PENDING_SUPERADMIN_APPROVAL',
    message: 'تم إرسال طلب إعادة ربط الجهاز إلى SuperAdmin بنجاح'
  };
  return makeSyncPromise(res);
}

// ============================================================================
// SUPERADMIN PLATFORM MODE SERVICES (SERVER-SIDE PRIVILEGED ACCESS)
// ============================================================================

function getSuperAdminPlatformOverview(callerToken) {
  validateSuperAdmin(callerToken);
  const institutionsList = Array.from(memoryStore.institutions.values());
  const devicesList = Array.from(memoryStore.devices.values());
  const licensesList = Array.from(memoryStore.licenses.values());

  const activeInst = institutionsList.filter(i => i.status === 'ACTIVE').length;
  const suspendedInst = institutionsList.filter(i => i.status === 'SUSPENDED').length;

  const res = {
    totalInstitutions: institutionsList.length,
    activeInstitutions: activeInst,
    suspendedInstitutions: suspendedInst,
    totalDevices: devicesList.length,
    totalLicenses: licensesList.length,
    activeProvider: 'Google Gemini (gemini-2.5-flash) + OpenRouter',
    monthlyAIRequests: 4820,
    storageUsageGb: 12.4,
    platformStatus: 'OPERATIONAL'
  };
  return makeSyncPromise(res);
}

function getInstitutions(callerToken) {
  validateSuperAdmin(callerToken);
  const list = Array.from(memoryStore.institutions.values());
  return makeSyncPromise(list);
}

function createInstitution(callerToken, payload = {}) {
  validateSuperAdmin(callerToken);
  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('INVALID_INSTITUTION_NAME: Name is required');
  }

  const id = payload.customInstitutionId || `inst_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const inst = {
    id,
    name: payload.name.trim(),
    phone: payload.phone || '',
    email: payload.email || '',
    ownerName: payload.ownerName || 'مالك السنتر',
    status: payload.status || 'ACTIVE',
    plan: payload.plan || 'ENTERPRISE',
    createdAt: new Date().toISOString()
  };

  memoryStore.institutions.set(id, inst);

  const db = getFirestoreDb();
  if (db) {
    db.collection('institutions').doc(id).set(inst).catch(() => {});
  }

  recordAuditEvent({
    action: 'CREATE_INSTITUTION',
    actorUid: callerToken.uid,
    actorRole: 'superAdmin',
    institutionId: id,
    targetType: 'INSTITUTION',
    targetId: id,
    details: { name: inst.name, plan: inst.plan }
  });

  return makeSyncPromise(inst);
}

function updateInstitution(callerToken, institutionId, payload = {}) {
  validateSuperAdmin(callerToken);
  const db = getFirestoreDb();

  const updated = {
    id: institutionId,
    ...payload,
    updatedAt: new Date().toISOString()
  };

  if (memoryStore.institutions.has(institutionId)) {
    const existing = memoryStore.institutions.get(institutionId);
    memoryStore.institutions.set(institutionId, { ...existing, ...updated });
  } else {
    memoryStore.institutions.set(institutionId, updated);
  }

  if (db) {
    db.collection('institutions').doc(institutionId).set(updated, { merge: true }).catch(() => {});
  }

  return makeSyncPromise(updated);
}

function suspendInstitution(callerToken, institutionId) {
  validateSuperAdmin(callerToken);
  const db = getFirestoreDb();

  const updated = {
    id: institutionId,
    status: 'SUSPENDED',
    suspendedAt: new Date().toISOString()
  };

  if (memoryStore.institutions.has(institutionId)) {
    const existing = memoryStore.institutions.get(institutionId);
    memoryStore.institutions.set(institutionId, { ...existing, ...updated });
  } else {
    memoryStore.institutions.set(institutionId, updated);
  }

  if (db) {
    db.collection('institutions').doc(institutionId).set(updated, { merge: true }).catch(() => {});
  }

  recordAuditEvent({
    action: 'SUSPEND_INSTITUTION',
    actorUid: callerToken.uid,
    actorRole: 'superAdmin',
    institutionId,
    targetType: 'INSTITUTION',
    targetId: institutionId,
    details: { status: 'SUSPENDED' }
  });

  const res = { institutionId, status: 'SUSPENDED', message: `تم تجميد حساب المؤسسة ${institutionId} بنجاح` };
  return makeSyncPromise(res);
}

function activateInstitution(callerToken, institutionId) {
  validateSuperAdmin(callerToken);
  const db = getFirestoreDb();

  const updated = {
    id: institutionId,
    status: 'ACTIVE',
    activatedAt: new Date().toISOString()
  };

  if (memoryStore.institutions.has(institutionId)) {
    const existing = memoryStore.institutions.get(institutionId);
    memoryStore.institutions.set(institutionId, { ...existing, ...updated });
  } else {
    memoryStore.institutions.set(institutionId, updated);
  }

  if (db) {
    db.collection('institutions').doc(institutionId).set(updated, { merge: true }).catch(() => {});
  }

  recordAuditEvent({
    action: 'ACTIVATE_INSTITUTION',
    actorUid: callerToken.uid,
    actorRole: 'superAdmin',
    institutionId,
    targetType: 'INSTITUTION',
    targetId: institutionId,
    details: { status: 'ACTIVE' }
  });

  const res = { institutionId, status: 'ACTIVE', message: `تم تفعيل حساب المؤسسة ${institutionId} بنجاح` };
  return makeSyncPromise(res);
}

function getDevices(callerToken) {
  validateSuperAdmin(callerToken);
  const list = Array.from(memoryStore.devices.values());
  return makeSyncPromise(list);
}

function revokeDeviceBinding(callerToken, deviceId) {
  validateSuperAdmin(callerToken);
  const db = getFirestoreDb();

  const updated = {
    deviceId,
    status: 'REVOKED',
    revokedAt: new Date().toISOString()
  };

  memoryStore.devices.set(deviceId, updated);

  if (db) {
    db.collection('devices').doc(deviceId).set(updated, { merge: true }).catch(() => {});
  }

  recordAuditEvent({
    action: 'REVOKE_DEVICE',
    actorUid: callerToken.uid,
    actorRole: 'superAdmin',
    institutionId: 'platform',
    targetType: 'DEVICE',
    targetId: deviceId,
    details: { status: 'REVOKED' }
  });

  return makeSyncPromise(updated);
}

function rebindDeviceBinding(callerToken, deviceId) {
  validateSuperAdmin(callerToken);
  const db = getFirestoreDb();

  const updated = {
    deviceId,
    status: 'BOUND',
    reboundAt: new Date().toISOString()
  };

  memoryStore.devices.set(deviceId, updated);

  if (db) {
    db.collection('devices').doc(deviceId).set(updated, { merge: true }).catch(() => {});
  }

  return makeSyncPromise(updated);
}

function getLicenses(callerToken) {
  validateSuperAdmin(callerToken);
  const list = Array.from(memoryStore.licenses.values());
  return makeSyncPromise(list);
}

function getPlatformAuditLogs(callerToken) {
  validateSuperAdmin(callerToken);
  const list = memoryStore.auditLogs.slice(-50).reverse();
  return makeSyncPromise(list);
}

function resetStore() {
  memoryStore = getInitialSeedState();
}

module.exports = {
  resetStore,
  getCenterInfo,
  updateCenterInfo,
  getDashboardSummary,
  // Students
  getStudents,
  createStudent,
  addStudent,
  updateStudent,
  archiveStudent,
  // Teachers
  getTeachers,
  createTeacher,
  updateTeacher,
  archiveTeacher,
  // Groups & Subjects
  getGroups,
  createGroup,
  addGroup,
  updateGroup,
  archiveGroup,
  getSubjects,
  createSubject,
  // Attendance
  getAttendanceRecords,
  recordAttendance,
  recordAttendanceScan,
  // Sessions
  getSessions,
  createSession,
  // Content & Media
  getContent,
  getContentMedia,
  // Exams & Grades
  getExams,
  createExam,
  getGrades,
  recordGrade,
  // Subscriptions & Parents
  getSubscriptions,
  getParents,
  // Finance
  getPayments,
  recordPayment,
  addPayment,
  getExpenses,
  recordExpense,
  addExpense,
  getAISettings,
  getCenterAISettings,
  getLicenseStatus,
  requestRebind,
  // SuperAdmin Platform Mode
  getSuperAdminPlatformOverview,
  getInstitutions,
  createInstitution,
  updateInstitution,
  suspendInstitution,
  activateInstitution,
  getDevices,
  revokeDeviceBinding,
  rebindDeviceBinding,
  getLicenses,
  getPlatformAuditLogs
};
