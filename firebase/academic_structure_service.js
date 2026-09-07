/**
 * Academic Structure & Teacher Operations Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

// In-memory data stores for unit testing and offline test execution
const inMemoryLevels = new Map();
const inMemorySubjects = new Map();
const inMemoryTeachers = new Map();
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
    // Non-blocking catch for test environment
  }

  return logEntry;
}

// ============================================================================
// ACADEMIC LEVELS / GRADES API
// ============================================================================

async function createAcademicLevel(callerToken, payload = {}) {
  const instId = validateCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const { name, code, order = 1, status = 'ACTIVE', customLevelId } = payload;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    const err = new Error('INVALID_LEVEL_NAME: Academic level name is required');
    err.code = 'INVALID_LEVEL_NAME';
    throw err;
  }

  const levelCode = code || name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

  const duplicate = Array.from(inMemoryLevels.values()).some((l) => l.institutionId === instId && l.code === levelCode);
  if (duplicate) {
    const err = new Error(`DUPLICATE_ACADEMIC_LEVEL: Academic level ${levelCode} already exists in institution`);
    err.code = 'DUPLICATE_ACADEMIC_LEVEL';
    throw err;
  }

  const levelId = customLevelId || `lvl_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();

  const levelData = {
    levelId,
    institutionId: instId,
    name: name.trim(),
    code: levelCode,
    order: Number(order),
    status,
    createdBy: callerToken.uid,
    createdAt: nowISO,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  inMemoryLevels.set(levelId, levelData);

  await recordAuditEvent({
    event: 'ACADEMIC_LEVEL_CREATED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { levelId, name: name.trim(), code: levelCode }
  });

  return { status: 'LEVEL_CREATED', levelId, data: levelData };
}

async function getAcademicLevel(callerToken, levelId, targetInstitutionId) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher', 'student']);
  
  const level = inMemoryLevels.get(levelId);
  if (!level) {
    const err = new Error(`ACADEMIC_LEVEL_NOT_FOUND: Level ${levelId} does not exist`);
    err.code = 'ACADEMIC_LEVEL_NOT_FOUND';
    throw err;
  }

  if (level.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Level ${levelId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  return { status: 'SUCCESS', level };
}

async function updateAcademicLevel(callerToken, levelId, updatePayload = {}, targetInstitutionId) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const level = inMemoryLevels.get(levelId);
  if (!level) {
    const err = new Error(`ACADEMIC_LEVEL_NOT_FOUND: Level ${levelId} does not exist`);
    err.code = 'ACADEMIC_LEVEL_NOT_FOUND';
    throw err;
  }

  if (level.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Level ${levelId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  // Protect immutable fields
  const immutableFields = ['levelId', 'institutionId', 'createdBy', 'createdAt'];
  for (const field of immutableFields) {
    if (field in updatePayload && updatePayload[field] !== level[field]) {
      const err = new Error(`IMMUTABLE_FIELD_MODIFICATION: Field ${field} cannot be modified`);
      err.code = 'IMMUTABLE_FIELD_MODIFICATION';
      throw err;
    }
  }

  const nowISO = new Date().toISOString();
  const updatedData = {
    ...level,
    ...updatePayload,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  inMemoryLevels.set(levelId, updatedData);

  await recordAuditEvent({
    event: 'ACADEMIC_LEVEL_UPDATED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { levelId, updatedFields: Object.keys(updatePayload) }
  });

  return { status: 'LEVEL_UPDATED', levelId, level: updatedData };
}

async function setAcademicLevelStatus(callerToken, levelId, targetInstitutionId, newStatus) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const level = inMemoryLevels.get(levelId);
  if (!level) {
    const err = new Error(`ACADEMIC_LEVEL_NOT_FOUND: Level ${levelId} does not exist`);
    err.code = 'ACADEMIC_LEVEL_NOT_FOUND';
    throw err;
  }

  if (level.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Level ${levelId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const validStatuses = ['ACTIVE', 'DISABLED', 'ARCHIVED'];
  if (!validStatuses.includes(newStatus)) {
    const err = new Error(`INVALID_STATUS: Status must be one of ${validStatuses.join(', ')}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const nowISO = new Date().toISOString();
  level.status = newStatus;
  level.updatedBy = callerToken.uid;
  level.updatedAt = nowISO;

  inMemoryLevels.set(levelId, level);

  await recordAuditEvent({
    event: 'ACADEMIC_LEVEL_STATUS_CHANGED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { levelId, newStatus }
  });

  return { status: 'STATUS_UPDATED', levelId, newStatus };
}

async function listAcademicLevels(callerToken, targetInstitutionId, filters = {}) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher', 'student']);

  const levels = Array.from(inMemoryLevels.values())
    .filter((l) => l.institutionId === instId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (filters.status) {
    return { status: 'SUCCESS', levels: levels.filter((l) => l.status === filters.status) };
  }

  return { status: 'SUCCESS', levels };
}

// ============================================================================
// SUBJECTS CATALOG API
// ============================================================================

async function createSubject(callerToken, payload = {}) {
  const instId = validateCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const { name, code, levelId, description = '', status = 'ACTIVE', customSubjectId } = payload;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    const err = new Error('INVALID_SUBJECT_NAME: Subject name is required');
    err.code = 'INVALID_SUBJECT_NAME';
    throw err;
  }

  const subjectCode = code || name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

  const duplicate = Array.from(inMemorySubjects.values()).some((s) => s.institutionId === instId && s.code === subjectCode);
  if (duplicate) {
    const err = new Error(`DUPLICATE_SUBJECT: Subject ${subjectCode} already exists in institution`);
    err.code = 'DUPLICATE_SUBJECT';
    throw err;
  }

  const subjectId = customSubjectId || `subj_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();

  const subjectData = {
    subjectId,
    institutionId: instId,
    levelId: levelId || null,
    name: name.trim(),
    code: subjectCode,
    description: description.trim(),
    status,
    createdBy: callerToken.uid,
    createdAt: nowISO,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  inMemorySubjects.set(subjectId, subjectData);

  await recordAuditEvent({
    event: 'SUBJECT_CREATED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { subjectId, name: name.trim(), code: subjectCode }
  });

  return { status: 'SUBJECT_CREATED', subjectId, data: subjectData };
}

async function getSubject(callerToken, subjectId, targetInstitutionId) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher', 'student']);

  const subject = inMemorySubjects.get(subjectId);
  if (!subject) {
    const err = new Error(`SUBJECT_NOT_FOUND: Subject ${subjectId} does not exist`);
    err.code = 'SUBJECT_NOT_FOUND';
    throw err;
  }

  if (subject.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Subject ${subjectId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  return { status: 'SUCCESS', subject };
}

async function updateSubject(callerToken, subjectId, updatePayload = {}, targetInstitutionId) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const subject = inMemorySubjects.get(subjectId);
  if (!subject) {
    const err = new Error(`SUBJECT_NOT_FOUND: Subject ${subjectId} does not exist`);
    err.code = 'SUBJECT_NOT_FOUND';
    throw err;
  }

  if (subject.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Subject ${subjectId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const immutableFields = ['subjectId', 'institutionId', 'createdBy', 'createdAt'];
  for (const field of immutableFields) {
    if (field in updatePayload && updatePayload[field] !== subject[field]) {
      const err = new Error(`IMMUTABLE_FIELD_MODIFICATION: Field ${field} cannot be modified`);
      err.code = 'IMMUTABLE_FIELD_MODIFICATION';
      throw err;
    }
  }

  const nowISO = new Date().toISOString();
  const updatedData = {
    ...subject,
    ...updatePayload,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  inMemorySubjects.set(subjectId, updatedData);

  await recordAuditEvent({
    event: 'SUBJECT_UPDATED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { subjectId, updatedFields: Object.keys(updatePayload) }
  });

  return { status: 'SUBJECT_UPDATED', subjectId, subject: updatedData };
}

async function setSubjectStatus(callerToken, subjectId, targetInstitutionId, newStatus) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const subject = inMemorySubjects.get(subjectId);
  if (!subject) {
    const err = new Error(`SUBJECT_NOT_FOUND: Subject ${subjectId} does not exist`);
    err.code = 'SUBJECT_NOT_FOUND';
    throw err;
  }

  if (subject.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Subject ${subjectId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const validStatuses = ['ACTIVE', 'DISABLED', 'ARCHIVED'];
  if (!validStatuses.includes(newStatus)) {
    const err = new Error(`INVALID_STATUS: Status must be one of ${validStatuses.join(', ')}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const nowISO = new Date().toISOString();
  subject.status = newStatus;
  subject.updatedBy = callerToken.uid;
  subject.updatedAt = nowISO;

  inMemorySubjects.set(subjectId, subject);

  await recordAuditEvent({
    event: 'SUBJECT_STATUS_CHANGED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { subjectId, newStatus }
  });

  return { status: 'STATUS_UPDATED', subjectId, newStatus };
}

async function listSubjects(callerToken, targetInstitutionId, filters = {}) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher', 'student']);

  let list = Array.from(inMemorySubjects.values()).filter((s) => s.institutionId === instId);

  if (filters.levelId) {
    list = list.filter((s) => s.levelId === filters.levelId);
  }
  if (filters.status) {
    list = list.filter((s) => s.status === filters.status);
  }

  return { status: 'SUCCESS', subjects: list };
}

// ============================================================================
// TEACHERS MANAGEMENT API
// ============================================================================

async function createTeacherProfile(callerToken, payload = {}) {
  const instId = validateCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const { fullName, phone, email, specialization = '', subjectIds = [], levelIds = [], status = 'ACTIVE', customTeacherId } = payload;
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    const err = new Error('INVALID_TEACHER_NAME: Teacher full name is required');
    err.code = 'INVALID_TEACHER_NAME';
    throw err;
  }

  if (!email || !email.includes('@')) {
    const err = new Error('INVALID_TEACHER_EMAIL: Valid email is required');
    err.code = 'INVALID_TEACHER_EMAIL';
    throw err;
  }

  const cleanEmail = email.toLowerCase().trim();
  const duplicate = Array.from(inMemoryTeachers.values()).some((t) => t.institutionId === instId && t.email === cleanEmail);
  if (duplicate) {
    const err = new Error(`DUPLICATE_TEACHER: Teacher with email ${cleanEmail} already exists in institution`);
    err.code = 'DUPLICATE_TEACHER';
    throw err;
  }

  const teacherId = customTeacherId || `tch_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();

  const teacherData = {
    teacherId,
    institutionId: instId,
    fullName: fullName.trim(),
    phone: phone ? phone.trim() : '',
    email: cleanEmail,
    specialization: specialization.trim(),
    subjectIds: Array.isArray(subjectIds) ? subjectIds : [],
    levelIds: Array.isArray(levelIds) ? levelIds : [],
    status,
    role: 'teacher',
    createdBy: callerToken.uid,
    createdAt: nowISO,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  inMemoryTeachers.set(teacherId, teacherData);

  await recordAuditEvent({
    event: 'TEACHER_CREATED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { teacherId, fullName: fullName.trim(), email: cleanEmail }
  });

  return { status: 'TEACHER_CREATED', teacherId, data: teacherData };
}

async function getTeacherProfile(callerToken, teacherId, targetInstitutionId) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher']);

  const teacher = inMemoryTeachers.get(teacherId);
  if (!teacher) {
    const err = new Error(`TEACHER_NOT_FOUND: Teacher profile ${teacherId} does not exist`);
    err.code = 'TEACHER_NOT_FOUND';
    throw err;
  }

  if (teacher.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Teacher profile ${teacherId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  return { status: 'SUCCESS', teacher };
}

async function updateTeacherProfile(callerToken, teacherId, updatePayload = {}, targetInstitutionId) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const teacher = inMemoryTeachers.get(teacherId);
  if (!teacher) {
    const err = new Error(`TEACHER_NOT_FOUND: Teacher profile ${teacherId} does not exist`);
    err.code = 'TEACHER_NOT_FOUND';
    throw err;
  }

  if (teacher.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Teacher profile ${teacherId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const immutableFields = ['teacherId', 'institutionId', 'createdBy', 'createdAt'];
  for (const field of immutableFields) {
    if (field in updatePayload && updatePayload[field] !== teacher[field]) {
      const err = new Error(`IMMUTABLE_FIELD_MODIFICATION: Field ${field} cannot be modified`);
      err.code = 'IMMUTABLE_FIELD_MODIFICATION';
      throw err;
    }
  }

  const nowISO = new Date().toISOString();
  const updatedData = {
    ...teacher,
    ...updatePayload,
    updatedBy: callerToken.uid,
    updatedAt: nowISO
  };

  inMemoryTeachers.set(teacherId, updatedData);

  await recordAuditEvent({
    event: 'TEACHER_UPDATED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { teacherId, updatedFields: Object.keys(updatePayload) }
  });

  return { status: 'TEACHER_UPDATED', teacherId, teacher: updatedData };
}

async function assignTeacherSubjectsAndLevels(callerToken, teacherId, payload = {}) {
  const instId = validateCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const teacher = inMemoryTeachers.get(teacherId);
  if (!teacher) {
    const err = new Error(`TEACHER_NOT_FOUND: Teacher profile ${teacherId} does not exist`);
    err.code = 'TEACHER_NOT_FOUND';
    throw err;
  }

  if (teacher.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Teacher profile ${teacherId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const { subjectIds = [], levelIds = [] } = payload;
  const nowISO = new Date().toISOString();

  teacher.subjectIds = Array.isArray(subjectIds) ? subjectIds : teacher.subjectIds;
  teacher.levelIds = Array.isArray(levelIds) ? levelIds : teacher.levelIds;
  teacher.updatedBy = callerToken.uid;
  teacher.updatedAt = nowISO;

  inMemoryTeachers.set(teacherId, teacher);

  await recordAuditEvent({
    event: 'TEACHER_ASSIGNMENT_CHANGED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { teacherId, subjectIds: teacher.subjectIds, levelIds: teacher.levelIds }
  });

  return {
    status: 'ASSIGNMENT_UPDATED',
    teacherId,
    subjectIds: teacher.subjectIds,
    levelIds: teacher.levelIds
  };
}

async function setTeacherStatus(callerToken, teacherId, targetInstitutionId, newStatus) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  const teacher = inMemoryTeachers.get(teacherId);
  if (!teacher) {
    const err = new Error(`TEACHER_NOT_FOUND: Teacher profile ${teacherId} does not exist`);
    err.code = 'TEACHER_NOT_FOUND';
    throw err;
  }

  if (teacher.institutionId !== instId) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Teacher profile ${teacherId} belongs to another institution`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  const validStatuses = ['ACTIVE', 'DISABLED', 'ARCHIVED'];
  if (!validStatuses.includes(newStatus)) {
    const err = new Error(`INVALID_STATUS: Status must be one of ${validStatuses.join(', ')}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const nowISO = new Date().toISOString();
  teacher.status = newStatus;
  teacher.updatedBy = callerToken.uid;
  teacher.updatedAt = nowISO;

  inMemoryTeachers.set(teacherId, teacher);

  await recordAuditEvent({
    event: 'TEACHER_STATUS_CHANGED',
    actor: callerToken.uid,
    institutionId: instId,
    details: { teacherId, newStatus }
  });

  return { status: 'STATUS_UPDATED', teacherId, newStatus };
}

async function listTeachers(callerToken, targetInstitutionId, filters = {}) {
  const instId = validateCaller(callerToken, targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'teacher']);

  let list = Array.from(inMemoryTeachers.values()).filter((t) => t.institutionId === instId);

  if (filters.status) {
    list = list.filter((t) => t.status === filters.status);
  }
  if (filters.subjectId) {
    list = list.filter((t) => Array.isArray(t.subjectIds) && t.subjectIds.includes(filters.subjectId));
  }
  if (filters.levelId) {
    list = list.filter((t) => Array.isArray(t.levelIds) && t.levelIds.includes(filters.levelId));
  }

  return { status: 'SUCCESS', teachers: list };
}

/**
 * Returns in-memory audit logs for verification
 */
function getAuditLogs() {
  return inMemoryAuditLogs;
}

/**
 * Resets state for unit testing
 */
function resetInMemoryAcademicState() {
  inMemoryLevels.clear();
  inMemorySubjects.clear();
  inMemoryTeachers.clear();
  inMemoryAuditLogs.length = 0;
}

module.exports = {
  createAcademicLevel,
  getAcademicLevel,
  updateAcademicLevel,
  setAcademicLevelStatus,
  listAcademicLevels,
  createSubject,
  getSubject,
  updateSubject,
  setSubjectStatus,
  listSubjects,
  createTeacherProfile,
  getTeacherProfile,
  updateTeacherProfile,
  assignTeacherSubjectsAndLevels,
  setTeacherStatus,
  listTeachers,
  recordAuditEvent,
  getAuditLogs,
  resetInMemoryAcademicState
};
