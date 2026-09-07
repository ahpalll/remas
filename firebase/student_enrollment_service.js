/**
 * Student Enrollment & Group Operations Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const crypto = require('node:crypto');

// In-memory data stores for unit testing and offline execution
const inMemoryStudents = new Map();
const inMemoryGroups = new Map();
const inMemoryEnrollments = new Map();
const inMemoryGuardians = new Map();
const inMemoryStudentGuardians = new Map();
const inMemoryAuditLogs = [];

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
 * SHA-256 Hash helper for raw bearer tokens
 */
function hashQRToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    const err = new Error('INVALID_RAW_TOKEN: Token must be a non-empty string');
    err.code = 'INVALID_RAW_TOKEN';
    throw err;
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates non-sequential student code: STU-{YYYY}-{RANDOM_ALPHANUM_6}
 */
function generateStudentCode(yearStr = '2026') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `STU-${yearStr}-${rand}`;
}

/**
 * E.164 Phone Normalization
 */
function formatE164(phoneStr) {
  if (!phoneStr) return '';
  let cleaned = phoneStr.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('00')) {
    return `+${cleaned.substring(2)}`;
  }
  return `+20${cleaned.replace(/^0+/, '')}`;
}

/**
 * Allowed Student Status Transitions
 */
const ALLOWED_STUDENT_STATUS_TRANSITIONS = {
  ACTIVE: ['SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'ARCHIVED'],
  SUSPENDED: ['ACTIVE', 'ARCHIVED'],
  WITHDRAWN: ['ACTIVE', 'ARCHIVED'],
  GRADUATED: ['ARCHIVED'],
  ARCHIVED: [] // Terminal State
};

/**
 * Validates caller token, role authority, and tenant boundaries
 */
function validateCaller(callerToken, targetInstitutionId, allowedRoles = ['superAdmin', 'institutionOwner', 'admin']) {
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
  delete sanitizedDetails.privateKey;
  delete sanitizedDetails.apiKey;

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
 * ----------------------------------------------------
 * STUDENT MANAGEMENT APIs
 * ----------------------------------------------------
 */

async function createStudent(callerToken, payload) {
  const institutionId = validateCaller(callerToken, payload.targetInstitutionId);
  const { fullName, phone, parentPhone, stageId, gradeId, notes } = payload;

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    const err = new Error('MISSING_REQUIRED_FIELDS: fullName is required');
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  const studentId = payload.id || `stu_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const studentCode = payload.studentCode || generateStudentCode('2026');
  const rawToken = crypto.randomUUID();
  const qrTokenHash = hashQRToken(rawToken);
  const formattedPhone = formatE164(phone);
  const formattedParentPhone = formatE164(parentPhone);

  const studentDoc = {
    id: studentId,
    institutionId,
    studentCode,
    fullName: fullName.trim(),
    phone: formattedPhone,
    parentPhone: formattedParentPhone,
    stageId: stageId || null,
    gradeId: gradeId || null,
    status: payload.status || 'ACTIVE',
    qrTokenHash,
    registrationDate: new Date().toISOString(),
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  inMemoryStudents.set(studentId, studentDoc);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('students').doc(studentId).set(studentDoc);
  }

  await recordAuditEvent({
    event: 'STUDENT_ENROLLED',
    actor: callerToken.uid,
    institutionId,
    details: { studentId, studentCode, fullName: studentDoc.fullName, status: studentDoc.status }
  });

  return {
    status: 'SUCCESS',
    student: studentDoc,
    rawToken, // Returned ONCE for card/QR printing
    institutionId
  };
}

async function getStudent(callerToken, studentId, targetInstitutionId) {
  const institutionId = validateCaller(callerToken, targetInstitutionId);
  
  let student = inMemoryStudents.get(studentId);
  if (!student) {
    const db = getFirestoreDb();
    if (db) {
      const snap = await db.collection('students').doc(studentId).get();
      if (snap.exists) student = snap.data();
    }
  }

  if (!student) {
    const err = new Error(`STUDENT_NOT_FOUND: Student ${studentId} does not exist`);
    err.code = 'STUDENT_NOT_FOUND';
    throw err;
  }

  if (student.institutionId !== institutionId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Student belongs to institution ${student.institutionId}`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  return { status: 'SUCCESS', student };
}

async function updateStudentProfile(callerToken, studentId, payload) {
  const { student } = await getStudent(callerToken, studentId, payload.targetInstitutionId);
  const institutionId = student.institutionId;

  const updatedFields = {
    fullName: payload.fullName !== undefined ? payload.fullName.trim() : student.fullName,
    phone: payload.phone !== undefined ? formatE164(payload.phone) : student.phone,
    parentPhone: payload.parentPhone !== undefined ? formatE164(payload.parentPhone) : student.parentPhone,
    stageId: payload.stageId !== undefined ? payload.stageId : student.stageId,
    gradeId: payload.gradeId !== undefined ? payload.gradeId : student.gradeId,
    notes: payload.notes !== undefined ? payload.notes : student.notes,
    updatedAt: new Date().toISOString()
  };

  const updatedStudent = { ...student, ...updatedFields };
  inMemoryStudents.set(studentId, updatedStudent);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('students').doc(studentId).update(updatedFields);
  }

  await recordAuditEvent({
    event: 'STUDENT_UPDATED',
    actor: callerToken.uid,
    institutionId,
    details: { studentId, studentCode: student.studentCode, updatedFields }
  });

  return { status: 'SUCCESS', student: updatedStudent };
}

async function changeStudentStatus(callerToken, studentId, newStatus, targetInstitutionId) {
  const { student } = await getStudent(callerToken, studentId, targetInstitutionId);
  const institutionId = student.institutionId;

  const currentStatus = student.status || 'ACTIVE';
  const allowedTransitions = ALLOWED_STUDENT_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    const err = new Error(`INVALID_STATUS_TRANSITION: Cannot transition student status from ${currentStatus} to ${newStatus}`);
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }

  const updatedStudent = { ...student, status: newStatus, updatedAt: new Date().toISOString() };
  inMemoryStudents.set(studentId, updatedStudent);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('students').doc(studentId).update({ status: newStatus, updatedAt: updatedStudent.updatedAt });
  }

  await recordAuditEvent({
    event: 'STUDENT_STATUS_CHANGED',
    actor: callerToken.uid,
    institutionId,
    details: { studentId, previousStatus: currentStatus, newStatus }
  });

  return { status: 'SUCCESS', student: updatedStudent };
}

async function regenerateStudentQR(callerToken, studentId, targetInstitutionId) {
  const { student } = await getStudent(callerToken, studentId, targetInstitutionId);
  const institutionId = student.institutionId;

  const newRawToken = crypto.randomUUID();
  const newQRTokenHash = hashQRToken(newRawToken);

  const updatedStudent = {
    ...student,
    qrTokenHash: newQRTokenHash,
    updatedAt: new Date().toISOString()
  };

  inMemoryStudents.set(studentId, updatedStudent);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('students').doc(studentId).update({
      qrTokenHash: newQRTokenHash,
      updatedAt: updatedStudent.updatedAt
    });
  }

  await recordAuditEvent({
    event: 'STUDENT_QR_REGENERATED',
    actor: callerToken.uid,
    institutionId,
    details: { studentId, studentCode: student.studentCode }
  });

  return {
    status: 'SUCCESS',
    studentId,
    rawToken: newRawToken,
    qrTokenHash: newQRTokenHash
  };
}

async function listStudents(callerToken, targetInstitutionId) {
  const institutionId = validateCaller(callerToken, targetInstitutionId);

  let results = Array.from(inMemoryStudents.values()).filter(st => st.institutionId === institutionId);

  const db = getFirestoreDb();
  if (db) {
    const snap = await db.collection('students').where('institutionId', '==', institutionId).get();
    results = snap.docs.map(doc => doc.data());
  }

  return { status: 'SUCCESS', students: results, count: results.length };
}

/**
 * ----------------------------------------------------
 * CLASS GROUPS MANAGEMENT APIs
 * ----------------------------------------------------
 */

async function createGroup(callerToken, payload) {
  const institutionId = validateCaller(callerToken, payload.targetInstitutionId);
  const { name, subjectId, teacherId, roomId, stageId, gradeId, maxCapacity, schedule, feePerSession } = payload;

  if (!name || typeof name !== 'string' || !name.trim()) {
    const err = new Error('MISSING_REQUIRED_FIELDS: Group name is required');
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  const capacity = Number(maxCapacity);
  if (isNaN(capacity) || capacity <= 0) {
    const err = new Error('INVALID_GROUP_CAPACITY: maxCapacity must be a positive integer');
    err.code = 'INVALID_GROUP_CAPACITY';
    throw err;
  }

  const groupId = payload.id || `grp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const groupDoc = {
    id: groupId,
    institutionId,
    name: name.trim(),
    subjectId: subjectId || null,
    teacherId: teacherId || null,
    roomId: roomId || null,
    stageId: stageId || null,
    gradeId: gradeId || null,
    maxCapacity: capacity,
    enrolledCount: 0,
    schedule: schedule || [],
    feePerSession: Number(feePerSession) || 0,
    status: payload.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  inMemoryGroups.set(groupId, groupDoc);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('groups').doc(groupId).set(groupDoc);
  }

  await recordAuditEvent({
    event: 'GROUP_CREATED',
    actor: callerToken.uid,
    institutionId,
    details: { groupId, name: groupDoc.name, maxCapacity: capacity, status: groupDoc.status }
  });

  return { status: 'SUCCESS', group: groupDoc };
}

async function getGroup(callerToken, groupId, targetInstitutionId) {
  const institutionId = validateCaller(callerToken, targetInstitutionId);

  let group = inMemoryGroups.get(groupId);
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

  return { status: 'SUCCESS', group };
}

async function updateGroup(callerToken, groupId, payload) {
  const { group } = await getGroup(callerToken, groupId, payload.targetInstitutionId);
  const institutionId = group.institutionId;

  const updatedFields = {
    name: payload.name !== undefined ? payload.name.trim() : group.name,
    teacherId: payload.teacherId !== undefined ? payload.teacherId : group.teacherId,
    roomId: payload.roomId !== undefined ? payload.roomId : group.roomId,
    schedule: payload.schedule !== undefined ? payload.schedule : group.schedule,
    feePerSession: payload.feePerSession !== undefined ? Number(payload.feePerSession) : group.feePerSession,
    maxCapacity: payload.maxCapacity !== undefined ? Number(payload.maxCapacity) : group.maxCapacity,
    updatedAt: new Date().toISOString()
  };

  if (updatedFields.maxCapacity < group.enrolledCount) {
    const err = new Error(`CAPACITY_BELOW_ENROLLED: Cannot set maxCapacity (${updatedFields.maxCapacity}) below current enrolled count (${group.enrolledCount})`);
    err.code = 'CAPACITY_BELOW_ENROLLED';
    throw err;
  }

  const updatedGroup = { ...group, ...updatedFields };
  inMemoryGroups.set(groupId, updatedGroup);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('groups').doc(groupId).update(updatedFields);
  }

  await recordAuditEvent({
    event: 'GROUP_UPDATED',
    actor: callerToken.uid,
    institutionId,
    details: { groupId, updatedFields }
  });

  return { status: 'SUCCESS', group: updatedGroup };
}

async function setGroupStatus(callerToken, groupId, newStatus, targetInstitutionId) {
  const { group } = await getGroup(callerToken, groupId, targetInstitutionId);
  const institutionId = group.institutionId;

  if (!['ACTIVE', 'INACTIVE', 'COMPLETED', 'ARCHIVED'].includes(newStatus)) {
    const err = new Error(`INVALID_GROUP_STATUS: ${newStatus} is not a valid group status`);
    err.code = 'INVALID_GROUP_STATUS';
    throw err;
  }

  const updatedGroup = { ...group, status: newStatus, updatedAt: new Date().toISOString() };
  inMemoryGroups.set(groupId, updatedGroup);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('groups').doc(groupId).update({ status: newStatus, updatedAt: updatedGroup.updatedAt });
  }

  await recordAuditEvent({
    event: 'GROUP_STATUS_CHANGED',
    actor: callerToken.uid,
    institutionId,
    details: { groupId, previousStatus: group.status, newStatus }
  });

  return { status: 'SUCCESS', group: updatedGroup };
}

async function listGroups(callerToken, targetInstitutionId) {
  const institutionId = validateCaller(callerToken, targetInstitutionId);

  let results = Array.from(inMemoryGroups.values()).filter(g => g.institutionId === institutionId);

  const db = getFirestoreDb();
  if (db) {
    const snap = await db.collection('groups').where('institutionId', '==', institutionId).get();
    results = snap.docs.map(doc => doc.data());
  }

  return { status: 'SUCCESS', groups: results, count: results.length };
}

/**
 * ----------------------------------------------------
 * ENROLLMENT & GUARDIAN LINKING APIs
 * ----------------------------------------------------
 */

async function enrollStudentInGroup(callerToken, payload) {
  const { studentId, groupId } = payload;

  if (!studentId || !groupId) {
    const err = new Error('MISSING_REQUIRED_FIELDS: studentId and groupId are required');
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  const { student } = await getStudent(callerToken, studentId, payload.targetInstitutionId);
  const { group } = await getGroup(callerToken, groupId, payload.targetInstitutionId);

  if (student.institutionId !== group.institutionId) {
    const err = new Error('CROSS_TENANT_VIOLATION: Student and Group belong to different institutions');
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const institutionId = student.institutionId;

  // Check group capacity
  if (group.enrolledCount >= group.maxCapacity) {
    const err = new Error(`GROUP_CAPACITY_EXCEEDED: Group ${groupId} is full (${group.enrolledCount}/${group.maxCapacity})`);
    err.code = 'GROUP_CAPACITY_EXCEEDED';
    throw err;
  }

  // Check existing active enrollment
  const existingEnrollments = Array.from(inMemoryEnrollments.values()).filter(
    e => e.studentId === studentId && e.groupId === groupId && e.status === 'ENROLLED'
  );

  if (existingEnrollments.length > 0) {
    const err = new Error(`DUPLICATE_ENROLLMENT: Student ${studentId} is already enrolled in group ${groupId}`);
    err.code = 'DUPLICATE_ENROLLMENT';
    throw err;
  }

  const enrollmentId = payload.id || `enr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const enrollmentDoc = {
    id: enrollmentId,
    institutionId,
    studentId,
    groupId,
    status: 'ENROLLED',
    enrolledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  inMemoryEnrollments.set(enrollmentId, enrollmentDoc);

  // Increment group enrolled count
  group.enrolledCount += 1;
  group.updatedAt = new Date().toISOString();
  inMemoryGroups.set(groupId, group);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('enrollments').doc(enrollmentId).set(enrollmentDoc);
    await db.collection('groups').doc(groupId).update({
      enrolledCount: group.enrolledCount,
      updatedAt: group.updatedAt
    });
  }

  await recordAuditEvent({
    event: 'STUDENT_GROUP_ASSIGNED',
    actor: callerToken.uid,
    institutionId,
    details: { enrollmentId, studentId, groupId, newEnrolledCount: group.enrolledCount }
  });

  return { status: 'SUCCESS', enrollment: enrollmentDoc, groupEnrolledCount: group.enrolledCount };
}

async function withdrawStudentFromGroup(callerToken, enrollmentId, targetInstitutionId) {
  const institutionId = validateCaller(callerToken, targetInstitutionId);

  let enrollment = inMemoryEnrollments.get(enrollmentId);
  if (!enrollment) {
    const db = getFirestoreDb();
    if (db) {
      const snap = await db.collection('enrollments').doc(enrollmentId).get();
      if (snap.exists) enrollment = snap.data();
    }
  }

  if (!enrollment) {
    const err = new Error(`ENROLLMENT_NOT_FOUND: Enrollment ${enrollmentId} does not exist`);
    err.code = 'ENROLLMENT_NOT_FOUND';
    throw err;
  }

  if (enrollment.institutionId !== institutionId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Enrollment belongs to institution ${enrollment.institutionId}`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  if (enrollment.status === 'WITHDRAWN') {
    return { status: 'SUCCESS', enrollment };
  }

  const updatedEnrollment = { ...enrollment, status: 'WITHDRAWN', updatedAt: new Date().toISOString() };
  inMemoryEnrollments.set(enrollmentId, updatedEnrollment);

  // Decrement group enrolled count
  const group = inMemoryGroups.get(enrollment.groupId);
  if (group && group.enrolledCount > 0) {
    group.enrolledCount -= 1;
    group.updatedAt = new Date().toISOString();
    inMemoryGroups.set(enrollment.groupId, group);
  }

  const db = getFirestoreDb();
  if (db) {
    await db.collection('enrollments').doc(enrollmentId).update({ status: 'WITHDRAWN', updatedAt: updatedEnrollment.updatedAt });
    if (group) {
      await db.collection('groups').doc(enrollment.groupId).update({
        enrolledCount: group.enrolledCount,
        updatedAt: group.updatedAt
      });
    }
  }

  await recordAuditEvent({
    event: 'STUDENT_GROUP_WITHDRAWN',
    actor: callerToken.uid,
    institutionId,
    details: { enrollmentId, studentId: enrollment.studentId, groupId: enrollment.groupId }
  });

  return { status: 'SUCCESS', enrollment: updatedEnrollment };
}

async function linkGuardianToStudent(callerToken, payload) {
  const { studentId, fullName, phone, relationshipType, isPrimary } = payload;

  if (!studentId || !fullName || !phone) {
    const err = new Error('MISSING_REQUIRED_FIELDS: studentId, fullName, and phone are required');
    err.code = 'MISSING_REQUIRED_FIELDS';
    throw err;
  }

  const { student } = await getStudent(callerToken, studentId, payload.targetInstitutionId);
  const institutionId = student.institutionId;

  const formattedPhone = formatE164(phone);
  const guardianId = payload.guardianId || `gdn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const guardianDoc = {
    id: guardianId,
    institutionId,
    fullName: fullName.trim(),
    phone: formattedPhone,
    email: payload.email || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  inMemoryGuardians.set(guardianId, guardianDoc);

  const linkId = payload.linkId || `sg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const linkDoc = {
    id: linkId,
    institutionId,
    studentId,
    guardianId,
    relationshipType: relationshipType || 'PARENT',
    isPrimary: !!isPrimary,
    createdAt: new Date().toISOString()
  };

  inMemoryStudentGuardians.set(linkId, linkDoc);

  const db = getFirestoreDb();
  if (db) {
    await db.collection('guardians').doc(guardianId).set(guardianDoc);
    await db.collection('studentGuardians').doc(linkId).set(linkDoc);
  }

  await recordAuditEvent({
    event: 'STUDENT_GUARDIAN_LINKED',
    actor: callerToken.uid,
    institutionId,
    details: { linkId, studentId, guardianId, fullName: guardianDoc.fullName, relationshipType: linkDoc.relationshipType }
  });

  return { status: 'SUCCESS', guardian: guardianDoc, link: linkDoc };
}

async function listGuardians(callerToken, targetInstitutionId) {
  const institutionId = validateCaller(callerToken, targetInstitutionId);

  let results = Array.from(inMemoryGuardians.values()).filter(g => g.institutionId === institutionId);

  const db = getFirestoreDb();
  if (db) {
    const snap = await db.collection('guardians').where('institutionId', '==', institutionId).get();
    results = snap.docs.map(doc => doc.data());
  }

  return { status: 'SUCCESS', guardians: results, count: results.length };
}

function clearInMemoryStores() {
  inMemoryStudents.clear();
  inMemoryGroups.clear();
  inMemoryEnrollments.clear();
  inMemoryGuardians.clear();
  inMemoryStudentGuardians.clear();
  inMemoryAuditLogs.length = 0;
}

function getInMemoryAuditLogs() {
  return [...inMemoryAuditLogs];
}

module.exports = {
  hashQRToken,
  generateStudentCode,
  formatE164,
  validateCaller,
  recordAuditEvent,
  ALLOWED_STUDENT_STATUS_TRANSITIONS,
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
};
