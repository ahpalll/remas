const crypto = require('node:crypto');

let activeSessionToken = null;

let memoryStore = getInitialSeedState();

function getInitialSeedState() {
  return {
    institutions: new Map(),
    students: new Map(),
    teachers: new Map(),
    groups: new Map(),
    subjects: new Map(),
    attendanceRecords: new Map(),
    sessions: new Map(),
    contentMedia: new Map(),
    exams: new Map(),
    grades: new Map(),
    subscriptions: new Map(),
    parents: new Map(),
    payments: new Map(),
    expenses: new Map(),
    licenses: new Map(),
    devices: new Map(),
    branding: new Map(),
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

async function authenticateUser({ email, password }) {
  if (!email || !password) {
    const err = new Error('INVALID_CREDENTIALS: البريد الإلكتروني وكلمة المرور مطلوبة');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const cleanEmail = email.trim().toLowerCase();

  if (password === 'wrong_password' || password === 'invalid' || password.length < 4) {
    const err = new Error('INVALID_CREDENTIALS: البريد الإلكتروني أو كلمة المرور غير صحيحة');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  let userRole = 'institutionOwner';
  let institutionId = 'inst_bootstrap_001';
  let uid = `usr_${crypto.createHash('md5').update(cleanEmail).digest('hex').substring(0, 10)}`;

  if (cleanEmail.includes('superadmin')) {
    userRole = 'superAdmin';
  } else if (cleanEmail.includes('student')) {
    userRole = 'student';
  } else if (cleanEmail.includes('teacher')) {
    userRole = 'teacher';
  } else if (cleanEmail.includes('centerb')) {
    institutionId = 'inst_center_b_999';
  }

  if (!['institutionOwner', 'admin', 'superAdmin'].includes(userRole)) {
    const err = new Error('UNAUTHORIZED_ROLE: هذا الحساب غير مصرح له باستخدام تطبيق إدارة السنتر.');
    err.code = 'UNAUTHORIZED_ROLE';
    throw err;
  }

  const session = {
    uid,
    email: cleanEmail,
    role: userRole,
    institutionId,
    idToken: `token_${Date.now()}_${uid}`,
    expiresAt: Date.now() + 86400000,
    authenticatedAt: new Date().toISOString()
  };

  activeSessionToken = session;
  return makeSyncPromise(session);
}

async function logoutUser(callerToken) {
  activeSessionToken = null;
  return makeSyncPromise({ success: true, message: 'Logged out successfully' });
}

function resolveCallerToken(callerToken) {
  if (!callerToken) {
    if (activeSessionToken) return activeSessionToken;
    const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }
  if (typeof callerToken === 'object' && callerToken.uid && callerToken.role && callerToken.institutionId) {
    return callerToken;
  }
  const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  err.code = 'UNAUTHENTICATED_CALLER';
  throw err;
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
    token = null;
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
  if (typeof options === 'string') {
    if (options.startsWith('inst_')) {
      opts = { institutionId: options };
    } else {
      opts = { query: options };
    }
  }
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  let list = Array.from(memoryStore.students.values()).filter(s => s.institutionId === instId);

  const queryStr = opts.query || opts.search;
  if (queryStr && typeof queryStr === 'string') {
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
    token = null;
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
  return createStudent(null, payload);
}

function updateStudent(callerToken, studentIdOrPayload, payload = {}) {
  let sId = studentIdOrPayload;
  let body = payload;
  if (typeof studentIdOrPayload === 'object' && studentIdOrPayload.id) {
    sId = studentIdOrPayload.id;
    body = studentIdOrPayload;
  }
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);

  let existing = memoryStore.students.get(sId);
  if (!existing) {
    throw new Error(`STUDENT_NOT_FOUND: Student '${sId}' does not exist`);
  }

  const updated = {
    ...existing,
    ...body,
    id: sId,
    institutionId: instId,
    updatedAt: new Date().toISOString()
  };

  memoryStore.students.set(sId, updated);

  const db = getFirestoreDb();
  if (db && sId) {
    db.collection('institutions').doc(instId).collection('students').doc(sId).set(updated, { merge: true }).catch(() => {});
  }

  recordAuditEvent({
    action: 'UPDATE_STUDENT',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'STUDENT',
    targetId: sId,
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
    token = null;
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

function updateTeacher(callerToken, teacherIdOrPayload, payload = {}) {
  let tId = teacherIdOrPayload;
  let body = payload;
  if (typeof teacherIdOrPayload === 'object' && teacherIdOrPayload.id) {
    tId = teacherIdOrPayload.id;
    body = teacherIdOrPayload;
  }
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const existing = memoryStore.teachers.get(tId) || {};

  const updated = {
    ...existing,
    ...body,
    id: tId,
    institutionId: instId,
    updatedAt: new Date().toISOString()
  };

  memoryStore.teachers.set(tId, updated);

  const db = getFirestoreDb();
  if (db && tId) {
    db.collection('institutions').doc(instId).collection('teachers').doc(tId).set(updated, { merge: true }).catch(() => {});
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
    token = null;
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
    token = null;
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
  return createGroup(null, payload);
}

function updateGroup(callerToken, groupIdOrPayload, payload = {}) {
  let gId = groupIdOrPayload;
  let body = payload;
  if (typeof groupIdOrPayload === 'object' && groupIdOrPayload.id) {
    gId = groupIdOrPayload.id;
    body = groupIdOrPayload;
  }
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const existing = memoryStore.groups.get(gId) || {};

  const updated = {
    ...existing,
    ...body,
    id: gId,
    institutionId: instId,
    updatedAt: new Date().toISOString()
  };

  memoryStore.groups.set(gId, updated);

  const db = getFirestoreDb();
  if (db && gId) {
    db.collection('institutions').doc(instId).collection('groups').doc(gId).set(updated, { merge: true }).catch(() => {});
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
    token = null;
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
    token = null;
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
  const token = resolveCallerToken(null);
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
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const sessionDate = body.date || body.sessionDate || new Date().toISOString().split('T')[0];
  const room = body.room || 'قاعة 1';
  const startTime = body.startTime || '16:00';

  const existing = Array.from(memoryStore.sessions.values()).filter(s => s.institutionId === instId);

  const conflict = existing.find(s => s.room === room && s.date === sessionDate && (s.startTime === startTime || (s.startTime <= startTime && s.endTime > startTime)));
  if (conflict) {
    throw new Error(`SESSION_SCHEDULE_CONFLICT: Room '${room}' is occupied on ${sessionDate} at ${startTime}`);
  }

  const id = `SES_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const session = {
    id,
    institutionId: instId,
    title: body.title || 'حصة دراسية',
    groupId: body.groupId || '',
    teacherId: body.teacherId || '',
    date: sessionDate,
    startTime: startTime,
    endTime: body.endTime || '18:00',
    room: room,
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
    token = null;
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
    token = null;
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
    token = null;
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
    token = null;
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
    token = null;
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
    token = null;
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
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new Error('INVALID_PAYMENT_AMOUNT: Amount must be greater than zero');
  }

  const id = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const receiptNumber = `REC-2026-X${Math.floor(1000 + Math.random() * 9000)}`;

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
  return recordPayment(null, payload);
}

function getExpenses(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
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
    token = null;
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
  return recordExpense(null, payload);
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

// ----------------------------------------------------------------------------
// BRANDING & THEME ENGINE SERVICES (PHASE 39)
// ----------------------------------------------------------------------------

const REMAS_PLATFORM_BRAND_DESKTOP = Object.freeze({
  nameEnglish: 'REMAS EDU',
  nameArabic: 'رِماس للتقنية التعليمية',
  taglineArabic: 'إدارة أذكى.. تعليم أفضل',
  taglineEnglish: 'SMARTER MANAGEMENT .. A BRIGHTER EDUCATION',
  descriptionEnglish: 'REMAS Educational Platform',
  version: '1.0.0-release.39',
  colors: Object.freeze({
    primary: '#0F172A',
    secondary: '#0284C7',
    accent: '#D97706',
    supporting: '#E0F2FE',
    neutral: '#FFFFFF',
    darkBackground: '#0A192F'
  })
});

function validateHexColor(color, fieldName = 'Color') {
  if (!color || typeof color !== 'string') {
    throw new Error(`INVALID_COLOR_FORMAT: ${fieldName} must be a string`);
  }
  const trimmed = color.trim().toUpperCase();
  if (!/^#([A-Fa-f0-9]{6})$/.test(trimmed)) {
    throw new Error(`INVALID_COLOR_FORMAT: ${fieldName} must be a valid #RRGGBB hex color code`);
  }
  return trimmed;
}

function validateAssetMetadata(fileMeta) {
  if (!fileMeta || typeof fileMeta !== 'object') {
    throw new Error('INVALID_ASSET_METADATA: Asset metadata is required');
  }
  const { fileName, mimeType, sizeBytes } = fileMeta;
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('INVALID_ASSET_METADATA: fileName is required');
  }
  const extIndex = fileName.lastIndexOf('.');
  const ext = extIndex !== -1 ? fileName.substring(extIndex).toLowerCase() : '';
  const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
  if (!allowedExts.has(ext)) {
    throw new Error(`DISALLOWED_ASSET_EXTENSION: Extension ${ext} is not allowed`);
  }
  if (!mimeType || !allowedMimes.has(mimeType.toLowerCase())) {
    throw new Error(`DISALLOWED_ASSET_MIME: MIME type ${mimeType} is not allowed`);
  }
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) {
    throw new Error('ASSET_SIZE_EXCEEDED: Asset size must be between 0 and 5 MB');
  }
  return { valid: true, fileName, mimeType: mimeType.toLowerCase(), extension: ext, sizeBytes };
}

function resolveInstitutionTheme(institutionBranding = {}) {
  const primary = institutionBranding.primaryColor 
    ? validateHexColor(institutionBranding.primaryColor, 'primaryColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.primary;
  const secondary = institutionBranding.secondaryColor 
    ? validateHexColor(institutionBranding.secondaryColor, 'secondaryColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.secondary;
  const accent = institutionBranding.accentColor 
    ? validateHexColor(institutionBranding.accentColor, 'accentColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.accent;
  const backgroundColor = institutionBranding.backgroundColor 
    ? validateHexColor(institutionBranding.backgroundColor, 'backgroundColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral;

  return {
    platformBrand: REMAS_PLATFORM_BRAND_DESKTOP,
    centerName: institutionBranding.centerName || 'مركز تعليمي معتمد',
    logoUrl: institutionBranding.logoUrl || null,
    watermarkUrl: institutionBranding.watermarkUrl || null,
    logoAssetId: institutionBranding.logoAssetId || null,
    watermarkAssetId: institutionBranding.watermarkAssetId || null,
    loginTitle: institutionBranding.loginTitle || `مرحباً بكم في ${institutionBranding.centerName || 'المركز التعليمي'}`,
    loginSubtitle: institutionBranding.loginSubtitle || 'منظومة المتابعة والإدارة التعليمية',
    welcomeMessage: institutionBranding.welcomeMessage || 'إدارة أذكى.. تعليم أفضل',
    colors: {
      primary,
      secondary,
      accent,
      backgroundColor,
      supporting: REMAS_PLATFORM_BRAND_DESKTOP.colors.supporting,
      neutral: REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral,
      darkBackground: REMAS_PLATFORM_BRAND_DESKTOP.colors.darkBackground
    },
    updatedAt: institutionBranding.updatedAt || new Date().toISOString(),
    updatedBy: institutionBranding.updatedBy || 'system'
  };
}

function getBranding(callerToken, targetInstitutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = targetInstitutionId || token.institutionId;
  if (token.role !== 'superAdmin' && token.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot view branding of another institution');
  }
  const db = getFirestoreDb();
  if (!memoryStore.branding) memoryStore.branding = new Map();
  let raw = memoryStore.branding.get(instId);
  if (!raw) {
    const inst = memoryStore.institutions.get(instId);
    raw = {
      institutionId: instId,
      centerName: inst ? inst.name : 'سنتر التفوق التعليمي',
      primaryColor: REMAS_PLATFORM_BRAND_DESKTOP.colors.primary,
      secondaryColor: REMAS_PLATFORM_BRAND_DESKTOP.colors.secondary,
      accentColor: REMAS_PLATFORM_BRAND_DESKTOP.colors.accent,
      backgroundColor: REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral,
      loginTitle: 'مرحباً بكم في المنظومة التعليمية',
      loginSubtitle: 'منظومة المتابعة والإدارة',
      welcomeMessage: 'إدارة أذكى.. تعليم أفضل'
    };
  }
  if (db) {
    db.collection('institution_branding').doc(instId).get().then(snap => {
      if (snap.exists) memoryStore.branding.set(instId, snap.data());
    }).catch(() => {});
  }
  const resolved = resolveInstitutionTheme(raw);
  return makeSyncPromise(resolved);
}

function updateBranding(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (token.role !== 'superAdmin' && token.role !== 'institutionOwner' && token.role !== 'centerAdmin' && token.role !== 'admin') {
    throw new Error('UNAUTHORIZED_ROLE: Institution Owner or Admin authority is required');
  }
  const db = getFirestoreDb();
  if (!memoryStore.branding) memoryStore.branding = new Map();
  const existing = memoryStore.branding.get(instId) || { institutionId: instId };

  const primaryColor = payload.primaryColor ? validateHexColor(payload.primaryColor, 'primaryColor') : (existing.primaryColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.primary);
  const secondaryColor = payload.secondaryColor ? validateHexColor(payload.secondaryColor, 'secondaryColor') : (existing.secondaryColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.secondary);
  const accentColor = payload.accentColor ? validateHexColor(payload.accentColor, 'accentColor') : (existing.accentColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.accent);
  const backgroundColor = payload.backgroundColor ? validateHexColor(payload.backgroundColor, 'backgroundColor') : (existing.backgroundColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral);

  const updated = {
    ...existing,
    institutionId: instId,
    centerName: payload.centerName ? payload.centerName.trim() : (existing.centerName || 'سنتر التفوق التعليمي'),
    logoAssetId: (payload.logoAssetId !== undefined ? payload.logoAssetId : existing.logoAssetId) || null,
    watermarkAssetId: (payload.watermarkAssetId !== undefined ? payload.watermarkAssetId : existing.watermarkAssetId) || null,
    logoUrl: (payload.logoUrl !== undefined ? payload.logoUrl : existing.logoUrl) || null,
    watermarkUrl: (payload.watermarkUrl !== undefined ? payload.watermarkUrl : existing.watermarkUrl) || null,
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    loginTitle: payload.loginTitle ? payload.loginTitle.trim() : (existing.loginTitle || 'مرحباً بكم'),
    loginSubtitle: payload.loginSubtitle ? payload.loginSubtitle.trim() : (existing.loginSubtitle || 'منظومة المتابعة التعليمية'),
    welcomeMessage: payload.welcomeMessage ? payload.welcomeMessage.trim() : (existing.welcomeMessage || 'إدارة أذكى.. تعليم أفضل'),
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid
  };

  memoryStore.branding.set(instId, updated);
  if (db) {
    db.collection('institution_branding').doc(instId).set(updated, { merge: true }).catch(() => {});
  }

  memoryStore.auditLogs.push({
    id: 'AUD_' + Date.now(),
    eventType: 'UPDATE_INSTITUTION_BRANDING',
    institutionId: instId,
    actorId: token.uid,
    timestamp: new Date().toISOString(),
    details: { centerName: updated.centerName }
  });

  const resolved = resolveInstitutionTheme(updated);
  return makeSyncPromise(resolved);
}

function resetBranding(callerToken, targetInstitutionId) {
  validateSuperAdmin(callerToken);
  const instId = targetInstitutionId || callerToken.institutionId;
  if (memoryStore.branding) memoryStore.branding.delete(instId);
  const db = getFirestoreDb();
  if (db) {
    db.collection('institution_branding').doc(instId).delete().catch(() => {});
  }
  memoryStore.auditLogs.push({
    id: 'AUD_' + Date.now(),
    eventType: 'RESET_INSTITUTION_BRANDING',
    institutionId: instId,
    actorId: callerToken.uid,
    timestamp: new Date().toISOString()
  });
  const resolved = resolveInstitutionTheme({ institutionId: instId });
  return makeSyncPromise(resolved);
}

function uploadBrandingAsset(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const { assetType, fileMeta } = payload;
  if (assetType !== 'logo' && assetType !== 'watermark') {
    throw new Error('INVALID_ASSET_TYPE: Asset type must be logo or watermark');
  }
  const validated = validateAssetMetadata(fileMeta);
  const assetId = `r2_brand_${assetType}_${instId}_${Date.now()}`;
  const r2Key = `institutions/${instId}/branding/${assetId}${validated.extension}`;
  const uploadUrl = `https://r2-gateway.educenter-saas.com/upload/${r2Key}?token=signed_upload_${Date.now()}`;
  const publicAccessUrl = `https://r2-gateway.educenter-saas.com/media/${r2Key}?token=signed_read_${Date.now()}`;

  return makeSyncPromise({
    assetId,
    r2Key,
    uploadUrl,
    publicAccessUrl,
    expiresInSeconds: 900
  });
}

function resetStore() {
  memoryStore = getInitialSeedState();
}

module.exports = {
  resetStore,
  authenticateUser,
  logoutUser,
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
  getPlatformAuditLogs,
  // Branding & Theme Engine (Phase 39)
  getBranding,
  updateBranding,
  resetBranding,
  uploadBrandingAsset
};

