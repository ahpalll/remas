/**
 * Academic Operations & Teaching Workflow Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const crypto = require('node:crypto');

// In-memory data stores for unit testing and offline test execution
const inMemorySessions = new Map();
const inMemorySessionAttendance = new Map();
const inMemoryAuditLogs = [];

// External reference getters from related domain services in memory or mock
let mockTeachersMap = new Map();
let mockGroupsMap = new Map();
let mockEnrollmentsMap = new Map();

/**
 * Lazy helper for Firebase Admin Firestore
 */
function getFirestoreDb() {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  const { initializeApp, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || 'educenter-saas-test'
    });
  }
  return getFirestore();
}

/**
 * Allowed Session Status Transitions
 */
const ALLOWED_SESSION_STATUS_TRANSITIONS = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal State
  CANCELLED: []  // Terminal State
};

/**
 * Validates caller token, role authority, and tenant boundaries
 */
function validateCaller(callerToken, targetInstitutionId, allowedRoles = ['superAdmin', 'institutionOwner', 'admin', 'teacher']) {
  if (!callerToken || !callerToken.uid) {
    const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }

  const callerRole = callerToken.role;
  const callerInstId = callerToken.institutionId;

  if (callerRole !== 'superAdmin') {
    if (!allowedRoles.includes(callerRole)) {
      const err = new Error(`UNAUTHORIZED_CALLER_ROLE: Role ${callerRole} cannot perform this operation`);
      err.code = 'UNAUTHORIZED_CALLER_ROLE';
      throw err;
    }
    if (!callerInstId) {
      const err = new Error('UNAUTHORIZED_CALLER_TENANT: Missing institutionId claim');
      err.code = 'UNAUTHORIZED_CALLER_TENANT';
      throw err;
    }
    if (targetInstitutionId && targetInstitutionId !== callerInstId) {
      const err = new Error(`CROSS_TENANT_VIOLATION: Caller cannot access target tenant ${targetInstitutionId}`);
      err.code = 'CROSS_TENANT_VIOLATION';
      throw err;
    }
    return callerInstId;
  }

  if (!targetInstitutionId) {
    const err = new Error('MISSING_TARGET_INSTITUTION: superAdmin must specify targetInstitutionId');
    err.code = 'MISSING_TARGET_INSTITUTION';
    throw err;
  }

  return targetInstitutionId;
}

/**
 * Records auditable system events without sensitive values
 */
async function recordAuditEvent({ event, actor, institutionId, environment = 'PRODUCTION', result = 'SUCCESS', details = {} }) {
  const nowISO = new Date().toISOString();
  
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.secret;

  const logEntry = {
    eventId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    event,
    actor,
    institutionId,
    environment,
    timestamp: nowISO,
    result,
    details: sanitizedDetails
  };

  inMemoryAuditLogs.push(logEntry);

  try {
    const db = getFirestoreDb();
    if (db) {
      await db.collection('auditLogs').doc(logEntry.eventId).set(logEntry);
    }
  } catch (err) {
    console.error('Failed to persist audit log:', err.message);
  }

  return logEntry;
}

/**
 * Helper to seed mock teacher/group data in unit tests
 */
function seedMockDomainData({ teachers = [], groups = [], enrollments = [] }) {
  mockTeachersMap.clear();
  mockGroupsMap.clear();
  mockEnrollmentsMap.clear();

  teachers.forEach(t => mockTeachersMap.set(t.id, t));
  groups.forEach(g => mockGroupsMap.set(g.id, g));
  enrollments.forEach(e => mockEnrollmentsMap.set(e.id, e));
}

/**
 * ----------------------------------------------------
 * TEACHING ASSIGNMENT APIs
 * ----------------------------------------------------
 */

async function assignTeacherToGroup(callerToken, payload) {
  const institutionId = validateCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);
  const { teacherId, groupId } = payload;

  if (!teacherId || !groupId) {
    const err = new Error('MISSING_REQUIRED_FIELDS: teacherId and groupId are required');
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  // Lookup teacher
  let teacher = mockTeachersMap.get(teacherId);
  if (!teacher) {
    const db = getFirestoreDb();
    if (db) {
      const snap = await db.collection('teachers').doc(teacherId).get();
      if (snap.exists) teacher = snap.data();
    }
  }

  if (!teacher) {
    const err = new Error(`TEACHER_NOT_FOUND: Teacher ${teacherId} does not exist`);
    err.code = 'TEACHER_NOT_FOUND';
    throw err;
  }

  if (teacher.institutionId !== institutionId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Teacher belongs to institution ${teacher.institutionId}`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  if (teacher.status && teacher.status !== 'ACTIVE') {
    const err = new Error(`INACTIVE_TEACHER: Teacher ${teacherId} is not in ACTIVE status`);
    err.code = 'INACTIVE_TEACHER';
    throw err;
  }

  // Lookup group
  let group = mockGroupsMap.get(groupId);
  if (!group) {
    const db = getFirestoreDb();
    if (db) {
      const snap = await db.collection('groups').doc(groupId).get();
      if (snap.exists) group = snap.data();
    }
  }

  if (!group) {
    const err = new Error(`GROUP_NOT_FOUND: Group ${groupId} does not exist`);
    err.code = 'GROUP_NOT_FOUND';
    throw err;
  }

  if (group.institutionId !== institutionId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Group belongs to institution ${group.institutionId}`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  // Validate qualification: teacher must be assigned subject & grade of group if defined
  if (group.subjectId && teacher.assignedSubjects && teacher.assignedSubjects.length > 0) {
    if (!teacher.assignedSubjects.includes(group.subjectId)) {
      const err = new Error(`TEACHER_NOT_QUALIFIED: Teacher ${teacherId} is not assigned subject ${group.subjectId}`);
      err.code = 'TEACHER_NOT_QUALIFIED';
      throw err;
    }
  }

  if (group.stageId && teacher.assignedLevels && teacher.assignedLevels.length > 0) {
    if (!teacher.assignedLevels.includes(group.stageId) && !teacher.assignedLevels.includes(group.gradeId)) {
      const err = new Error(`TEACHER_NOT_QUALIFIED: Teacher ${teacherId} is not assigned level/stage ${group.stageId}`);
      err.code = 'TEACHER_NOT_QUALIFIED';
      throw err;
    }
  }

  // Update group teacher assignment
  const updatedGroup = { ...group, teacherId, updatedAt: new Date().toISOString() };
  mockGroupsMap.set(groupId, updatedGroup);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('groups').doc(groupId).update({ teacherId, updatedAt: updatedGroup.updatedAt });
  }

  await recordAuditEvent({
    event: 'TEACHING_ASSIGNMENT_CHANGED',
    actor: callerToken.uid,
    institutionId,
    details: { groupId, teacherId, teacherName: teacher.fullName, groupName: group.name }
  });

  return { status: 'SUCCESS', group: updatedGroup };
}

/**
 * ----------------------------------------------------
 * SESSION MANAGEMENT APIs
 * ----------------------------------------------------
 */

async function createSession(callerToken, payload) {
  const institutionId = validateCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher']);
  const { groupId, subjectId, teacherId, roomId, title, sessionDate, startTime, endTime, notes } = payload;

  if (!groupId || !sessionDate || !startTime || !endTime) {
    const err = new Error('MISSING_REQUIRED_FIELDS: groupId, sessionDate, startTime, and endTime are required');
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  // Lookup group to get defaults and verify tenant
  let group = mockGroupsMap.get(groupId);
  if (!group) {
    const db = getFirestoreDb();
    if (db) {
      const snap = await db.collection('groups').doc(groupId).get();
      if (snap.exists) group = snap.data();
    }
  }

  if (!group) {
    const err = new Error(`GROUP_NOT_FOUND: Group ${groupId} does not exist`);
    err.code = 'GROUP_NOT_FOUND';
    throw err;
  }

  if (group.institutionId !== institutionId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Group belongs to institution ${group.institutionId}`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const effectiveTeacherId = teacherId || group.teacherId;
  const effectiveSubjectId = subjectId || group.subjectId;
  const effectiveRoomId = roomId || group.roomId;

  // Teacher caller check: Teacher can only create sessions for groups assigned to them
  if (callerToken.role === 'teacher') {
    if (group.teacherId && group.teacherId !== callerToken.uid && effectiveTeacherId !== callerToken.uid) {
      const err = new Error(`TEACHER_NOT_ASSIGNED_TO_GROUP: Teacher ${callerToken.uid} is not assigned to group ${groupId}`);
      err.code = 'TEACHER_NOT_ASSIGNED_TO_GROUP';
      throw err;
    }
  }

  // Check schedule conflicts: Same room or same teacher at overlapping time on sessionDate
  const existingSessions = Array.from(inMemorySessions.values()).filter(
    s => s.institutionId === institutionId && s.sessionDate === sessionDate && s.status !== 'CANCELLED'
  );

  for (const existing of existingSessions) {
    const isSameRoom = effectiveRoomId && existing.roomId === effectiveRoomId;
    const isSameTeacher = effectiveTeacherId && existing.teacherId === effectiveTeacherId;

    if (isSameRoom || isSameTeacher) {
      // Overlap check: (start1 < end2) && (end1 > start2)
      if (startTime < existing.endTime && endTime > existing.startTime) {
        const err = new Error(`SESSION_SCHEDULE_CONFLICT: Schedule conflict detected for ${isSameRoom ? 'room ' + effectiveRoomId : 'teacher ' + effectiveTeacherId}`);
        err.code = 'SESSION_SCHEDULE_CONFLICT';
        throw err;
      }
    }
  }

  const sessionId = payload.id || `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const sessionDoc = {
    id: sessionId,
    institutionId,
    groupId,
    subjectId: effectiveSubjectId || null,
    teacherId: effectiveTeacherId || null,
    roomId: effectiveRoomId || null,
    title: title ? title.trim() : `حصة ${group.name}`,
    sessionDate,
    startTime,
    endTime,
    status: 'SCHEDULED',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  inMemorySessions.set(sessionId, sessionDoc);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('sessions').doc(sessionId).set(sessionDoc);
  }

  await recordAuditEvent({
    event: 'SESSION_CREATED',
    actor: callerToken.uid,
    institutionId,
    details: { sessionId, groupId, title: sessionDoc.title, sessionDate, startTime, endTime }
  });

  return { status: 'SUCCESS', session: sessionDoc };
}

async function getSession(callerToken, sessionId, targetInstitutionId) {
  const institutionId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher', 'student', 'parent']);

  let session = inMemorySessions.get(sessionId);
  if (!session) {
    const db = getFirestoreDb();
    if (db) {
      const snap = await db.collection('sessions').doc(sessionId).get();
      if (snap.exists) session = snap.data();
    }
  }

  if (!session) {
    const err = new Error(`SESSION_NOT_FOUND: Session ${sessionId} does not exist`);
    err.code = 'SESSION_NOT_FOUND';
    throw err;
  }

  if (session.institutionId !== institutionId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Session belongs to institution ${session.institutionId}`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  // Teacher caller restriction: Teacher can only access sessions where they are the assigned teacher
  if (callerToken.role === 'teacher') {
    if (session.teacherId && session.teacherId !== callerToken.uid) {
      const err = new Error(`TEACHER_NOT_ASSIGNED_TO_GROUP: Teacher ${callerToken.uid} is not assigned to session ${sessionId}`);
      err.code = 'TEACHER_NOT_ASSIGNED_TO_GROUP';
      throw err;
    }
  }

  return { status: 'SUCCESS', session };
}

async function updateSession(callerToken, sessionId, payload) {
  const { session } = await getSession(callerToken, sessionId, payload.targetInstitutionId);
  const institutionId = session.institutionId;

  if (['COMPLETED', 'CANCELLED'].includes(session.status)) {
    const err = new Error(`INVALID_SESSION_STATUS: Cannot update session in terminal status ${session.status}`);
    err.code = 'INVALID_SESSION_STATUS';
    throw err;
  }

  const updatedFields = {
    title: payload.title !== undefined ? payload.title.trim() : session.title,
    roomId: payload.roomId !== undefined ? payload.roomId : session.roomId,
    notes: payload.notes !== undefined ? payload.notes : session.notes,
    updatedAt: new Date().toISOString()
  };

  const updatedSession = { ...session, ...updatedFields };
  inMemorySessions.set(sessionId, updatedSession);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('sessions').doc(sessionId).update(updatedFields);
  }

  await recordAuditEvent({
    event: 'SESSION_UPDATED',
    actor: callerToken.uid,
    institutionId,
    details: { sessionId, updatedFields }
  });

  return { status: 'SUCCESS', session: updatedSession };
}

async function setSessionStatus(callerToken, sessionId, newStatus, targetInstitutionId) {
  const { session } = await getSession(callerToken, sessionId, targetInstitutionId);
  const institutionId = session.institutionId;

  const currentStatus = session.status || 'SCHEDULED';
  const allowedTransitions = ALLOWED_SESSION_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    const err = new Error(`INVALID_SESSION_STATUS: Cannot transition session status from ${currentStatus} to ${newStatus}`);
    err.code = 'INVALID_SESSION_STATUS';
    throw err;
  }

  const updatedSession = { ...session, status: newStatus, updatedAt: new Date().toISOString() };
  inMemorySessions.set(sessionId, updatedSession);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('sessions').doc(sessionId).update({ status: newStatus, updatedAt: updatedSession.updatedAt });
  }

  await recordAuditEvent({
    event: 'SESSION_STATUS_CHANGED',
    actor: callerToken.uid,
    institutionId,
    details: { sessionId, previousStatus: currentStatus, newStatus }
  });

  return { status: 'SUCCESS', session: updatedSession };
}

async function listSessions(callerToken, targetInstitutionId, filters = {}) {
  const institutionId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher']);

  let results = Array.from(inMemorySessions.values()).filter(s => s.institutionId === institutionId);

  // If caller is teacher, scope results to teacher's sessions only
  if (callerToken.role === 'teacher') {
    results = results.filter(s => s.teacherId === callerToken.uid);
  }

  if (filters.groupId) {
    results = results.filter(s => s.groupId === filters.groupId);
  }
  if (filters.teacherId && callerToken.role !== 'teacher') {
    results = results.filter(s => s.teacherId === filters.teacherId);
  }
  if (filters.status) {
    results = results.filter(s => s.status === filters.status);
  }

  const db = getFirestoreDb();
  if (db) {
    const snap = await db.collection('sessions').where('institutionId', '==', institutionId).get();
    results = snap.docs.map(doc => doc.data());
    if (callerToken.role === 'teacher') {
      results = results.filter(s => s.teacherId === callerToken.uid);
    }
  }

  return { status: 'SUCCESS', sessions: results, count: results.length };
}

/**
 * ----------------------------------------------------
 * SESSION ATTENDANCE APIs
 * ----------------------------------------------------
 */

async function recordSessionAttendance(callerToken, payload) {
  const { sessionId, attendanceList } = payload; // attendanceList: Array<{ studentId, status: 'PRESENT'|'LATE'|'ABSENT'|'EXCUSED', lateMinutes, notes }>

  if (!sessionId || !Array.isArray(attendanceList)) {
    const err = new Error('MISSING_REQUIRED_FIELDS: sessionId and attendanceList array are required');
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  const { session } = await getSession(callerToken, sessionId, payload.targetInstitutionId);
  const institutionId = session.institutionId;

  // Teacher authorization check: teacher must be assigned to this session
  if (callerToken.role === 'teacher') {
    if (session.teacherId && session.teacherId !== callerToken.uid) {
      const err = new Error(`TEACHER_NOT_ASSIGNED_TO_GROUP: Teacher ${callerToken.uid} is not authorized for session ${sessionId}`);
      err.code = 'TEACHER_NOT_ASSIGNED_TO_GROUP';
      throw err;
    }
  }

  const recordedRecords = [];
  const nowISO = new Date().toISOString();

  for (const item of attendanceList) {
    if (!item.studentId || !item.status) continue;
    
    if (!['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].includes(item.status)) {
      const err = new Error(`INVALID_ATTENDANCE_STATUS: Status ${item.status} is invalid`);
      err.code = 'INVALID_ATTENDANCE_STATUS';
      throw err;
    }

    const recordId = `att_rec_${sessionId}_${item.studentId}`;
    const recordDoc = {
      id: recordId,
      institutionId,
      sessionId,
      groupId: session.groupId,
      studentId: item.studentId,
      status: item.status,
      lateMinutes: item.status === 'LATE' ? (Number(item.lateMinutes) || 0) : 0,
      notes: item.notes || '',
      recordedBy: callerToken.uid,
      createdAt: nowISO,
      updatedAt: nowISO
    };

    inMemorySessionAttendance.set(recordId, recordDoc);
    recordedRecords.push(recordDoc);

    const db = getFirestoreDb();
    if (db) {
      await db.collection('attendanceRecords').doc(recordId).set(recordDoc);
    }
  }

  await recordAuditEvent({
    event: 'SESSION_ATTENDANCE_RECORDED',
    actor: callerToken.uid,
    institutionId,
    details: { sessionId, recordCount: recordedRecords.length }
  });

  return { status: 'SUCCESS', sessionId, recordedCount: recordedRecords.length, records: recordedRecords };
}

async function listSessionAttendance(callerToken, sessionId, targetInstitutionId) {
  const { session } = await getSession(callerToken, sessionId, targetInstitutionId);
  const institutionId = session.institutionId;

  let records = Array.from(inMemorySessionAttendance.values()).filter(r => r.sessionId === sessionId);

  const db = getFirestoreDb();
  if (db) {
    const snap = await db.collection('attendanceRecords').where('sessionId', '==', sessionId).get();
    records = snap.docs.map(doc => doc.data());
  }

  return { status: 'SUCCESS', sessionId, records, count: records.length };
}

function clearInMemoryStores() {
  inMemorySessions.clear();
  inMemorySessionAttendance.clear();
  inMemoryAuditLogs.length = 0;
  mockTeachersMap.clear();
  mockGroupsMap.clear();
  mockEnrollmentsMap.clear();
}

function getInMemoryAuditLogs() {
  return [...inMemoryAuditLogs];
}

module.exports = {
  validateCaller,
  recordAuditEvent,
  seedMockDomainData,
  ALLOWED_SESSION_STATUS_TRANSITIONS,
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
};
