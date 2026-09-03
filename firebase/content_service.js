const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || 'educenter-saas-test'
  });
}

const db = getFirestore();

const ALLOWED_CONTENT_TYPES = ['VIDEO', 'PDF', 'IMAGE', 'AUDIO', 'DOCUMENT', 'LESSON_NOTE', 'LINK'];
const ALLOWED_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

/**
 * Validates caller authorization for content management operations
 */
function validateContentCaller(callerToken, targetInstitutionId, requiredRoleList = ['superAdmin', 'institutionOwner', 'admin']) {
  if (!callerToken || !callerToken.uid || !callerToken.role) {
    throw new Error('UNAUTHENTICATED_CALLER: Missing caller credentials');
  }

  const callerRole = callerToken.role;
  const callerInstId = callerToken.institutionId;

  if (!requiredRoleList.includes(callerRole)) {
    throw new Error(`UNAUTHORIZED_ROLE: Role '${callerRole}' cannot perform educational content mutations`);
  }

  let resolvedInstitutionId;
  if (callerRole === 'superAdmin') {
    if (!targetInstitutionId) throw new Error('MISSING_TARGET_INSTITUTION');
    resolvedInstitutionId = targetInstitutionId;
  } else {
    if (!callerInstId) throw new Error('UNAUTHORIZED_CALLER_TENANT');
    if (targetInstitutionId && targetInstitutionId !== callerInstId) {
      throw new Error('CROSS_TENANT_VIOLATION: Caller cannot operate outside assigned tenant claim');
    }
    resolvedInstitutionId = callerInstId;
  }

  return resolvedInstitutionId;
}

/**
 * Create Lesson (Trusted Backend Only)
 */
async function createLesson(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
    throw new Error('INVALID_TITLE: Lesson title is required and must be non-empty');
  }
  if (!payload.subjectId) {
    throw new Error('MISSING_REQUIRED_FIELDS: Subject ID is required for a lesson');
  }

  // Cross-tenant reference check simulation
  if (payload.subjectInstitutionId && payload.subjectInstitutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Referenced subject belongs to another institution');
  }

  const title = payload.title.trim().substring(0, 200);
  const lessonId = payload.lessonId || `les_${instId}_${Date.now()}`;
  const now = new Date().toISOString();

  const lessonDoc = {
    id: lessonId,
    institutionId: instId,
    subjectId: payload.subjectId,
    stageId: payload.stageId || null,
    title,
    description: payload.description ? payload.description.trim().substring(0, 1000) : null,
    lessonNumber: payload.lessonNumber && payload.lessonNumber > 0 ? Math.floor(payload.lessonNumber) : 1,
    sortOrder: payload.sortOrder !== undefined ? Math.floor(payload.sortOrder) : 1,
    status: 'DRAFT',
    version: 1,
    createdAt: now,
    createdBy: callerToken.uid,
    updatedAt: now,
    updatedBy: callerToken.uid,
    publishedAt: null,
    archivedAt: null
  };

  return {
    status: 'SUCCESS',
    lesson: lessonDoc
  };
}

/**
 * Update Lesson (Trusted Backend Only)
 */
async function updateLesson(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!payload.lessonId) {
    throw new Error('MISSING_REQUIRED_FIELDS: Lesson ID is required');
  }
  if (payload.title !== undefined && (!payload.title || !payload.title.trim())) {
    throw new Error('INVALID_TITLE: Lesson title cannot be empty');
  }

  const existingDoc = payload.existingLessonDoc || {
    id: payload.lessonId,
    institutionId: instId,
    title: 'Existing Lesson',
    status: 'DRAFT',
    version: 1
  };

  if (existingDoc.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Lesson belongs to another institution');
  }
  if (existingDoc.status === 'ARCHIVED') {
    throw new Error('INVALID_STATUS_TRANSITION: Cannot update an archived lesson');
  }

  const now = new Date().toISOString();
  const updatedDoc = {
    ...existingDoc,
    title: payload.title !== undefined ? payload.title.trim().substring(0, 200) : existingDoc.title,
    description: payload.description !== undefined ? (payload.description ? payload.description.trim().substring(0, 1000) : null) : existingDoc.description,
    lessonNumber: payload.lessonNumber !== undefined ? Math.floor(payload.lessonNumber) : existingDoc.lessonNumber,
    sortOrder: payload.sortOrder !== undefined ? Math.floor(payload.sortOrder) : existingDoc.sortOrder,
    version: (existingDoc.version || 1) + 1,
    updatedAt: now,
    updatedBy: callerToken.uid
  };

  return {
    status: 'SUCCESS',
    lesson: updatedDoc
  };
}

/**
 * Archive Lesson (Trusted Backend Only)
 */
async function archiveLesson(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!payload.lessonId) {
    throw new Error('MISSING_REQUIRED_FIELDS: Lesson ID is required');
  }

  const existingDoc = payload.existingLessonDoc || {
    id: payload.lessonId,
    institutionId: instId,
    status: 'PUBLISHED',
    version: 1
  };

  if (existingDoc.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Lesson belongs to another institution');
  }

  const now = new Date().toISOString();
  const archivedDoc = {
    ...existingDoc,
    status: 'ARCHIVED',
    archivedAt: now,
    version: (existingDoc.version || 1) + 1,
    updatedAt: now,
    updatedBy: callerToken.uid
  };

  return {
    status: 'SUCCESS',
    lesson: archivedDoc
  };
}

/**
 * Create Educational Content (Trusted Backend Only)
 */
async function createContent(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
    throw new Error('INVALID_TITLE: Content title is required and must be non-empty');
  }
  if (!payload.lessonId || !payload.subjectId) {
    throw new Error('MISSING_REQUIRED_FIELDS: Lesson ID and Subject ID are required');
  }
  if (!payload.contentType || !ALLOWED_CONTENT_TYPES.includes(payload.contentType)) {
    throw new Error(`INVALID_CONTENT_TYPE: Content type '${payload.contentType}' is not supported`);
  }
  if (payload.durationSeconds !== undefined && (typeof payload.durationSeconds !== 'number' || payload.durationSeconds < 0)) {
    throw new Error('INVALID_NUMERIC_VALUE: Duration seconds must be a non-negative number');
  }
  if (payload.fileSizeBytes !== undefined && (typeof payload.fileSizeBytes !== 'number' || payload.fileSizeBytes < 0)) {
    throw new Error('INVALID_NUMERIC_VALUE: File size bytes must be a non-negative number');
  }

  // Cross-tenant reference check
  if (payload.lessonInstitutionId && payload.lessonInstitutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Referenced lesson belongs to another institution');
  }

  const contentId = payload.contentId || `cnt_${instId}_${Date.now()}`;
  const now = new Date().toISOString();

  const contentDoc = {
    id: contentId,
    institutionId: instId,
    lessonId: payload.lessonId,
    subjectId: payload.subjectId,
    stageId: payload.stageId || null,
    groupId: payload.groupId || null,
    title: payload.title.trim().substring(0, 200),
    description: payload.description ? payload.description.trim().substring(0, 1000) : null,
    contentType: payload.contentType,
    status: 'DRAFT',
    sortOrder: payload.sortOrder !== undefined ? Math.floor(payload.sortOrder) : 1,
    tags: Array.isArray(payload.tags) ? payload.tags.map(t => String(t).trim()).filter(Boolean) : [],
    durationSeconds: payload.durationSeconds ? Math.floor(payload.durationSeconds) : null,
    fileSizeBytes: payload.fileSizeBytes ? Math.floor(payload.fileSizeBytes) : null,
    mimeType: payload.mimeType || null,
    externalReference: payload.externalReference || null,
    version: 1,
    createdAt: now,
    createdBy: callerToken.uid,
    updatedAt: now,
    updatedBy: callerToken.uid,
    publishedAt: null,
    archivedAt: null
  };

  return {
    status: 'SUCCESS',
    content: contentDoc
  };
}

/**
 * Update Educational Content (Trusted Backend Only)
 */
async function updateContent(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!payload.contentId) {
    throw new Error('MISSING_REQUIRED_FIELDS: Content ID is required');
  }
  if (payload.contentType && !ALLOWED_CONTENT_TYPES.includes(payload.contentType)) {
    throw new Error(`INVALID_CONTENT_TYPE: Content type '${payload.contentType}' is not supported`);
  }

  const existingDoc = payload.existingContentDoc || {
    id: payload.contentId,
    institutionId: instId,
    title: 'Existing Content',
    status: 'DRAFT',
    version: 1
  };

  if (existingDoc.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Content belongs to another institution');
  }
  if (existingDoc.status === 'ARCHIVED') {
    throw new Error('INVALID_STATUS_TRANSITION: Cannot update archived content');
  }

  const now = new Date().toISOString();
  const updatedDoc = {
    ...existingDoc,
    title: payload.title !== undefined ? payload.title.trim().substring(0, 200) : existingDoc.title,
    description: payload.description !== undefined ? (payload.description ? payload.description.trim().substring(0, 1000) : null) : existingDoc.description,
    contentType: payload.contentType || existingDoc.contentType,
    sortOrder: payload.sortOrder !== undefined ? Math.floor(payload.sortOrder) : existingDoc.sortOrder,
    version: (existingDoc.version || 1) + 1,
    updatedAt: now,
    updatedBy: callerToken.uid
  };

  return {
    status: 'SUCCESS',
    content: updatedDoc
  };
}

/**
 * Publish Content (Trusted Backend Only)
 */
async function publishContent(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!payload.contentId) {
    throw new Error('MISSING_REQUIRED_FIELDS: Content ID is required');
  }

  const existingDoc = payload.existingContentDoc || {
    id: payload.contentId,
    institutionId: instId,
    status: 'DRAFT',
    version: 1
  };

  if (existingDoc.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Content belongs to another institution');
  }

  const now = new Date().toISOString();
  const publishedDoc = {
    ...existingDoc,
    status: 'PUBLISHED',
    publishedAt: now,
    version: (existingDoc.version || 1) + 1,
    updatedAt: now,
    updatedBy: callerToken.uid
  };

  return {
    status: 'SUCCESS',
    content: publishedDoc
  };
}

/**
 * Archive Content (Trusted Backend Only)
 */
async function archiveContent(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!payload.contentId) {
    throw new Error('MISSING_REQUIRED_FIELDS: Content ID is required');
  }

  const existingDoc = payload.existingContentDoc || {
    id: payload.contentId,
    institutionId: instId,
    status: 'PUBLISHED',
    version: 1
  };

  if (existingDoc.institutionId !== instId) {
    throw new Error('CROSS_TENANT_VIOLATION: Content belongs to another institution');
  }

  const now = new Date().toISOString();
  const archivedDoc = {
    ...existingDoc,
    status: 'ARCHIVED',
    archivedAt: now,
    version: (existingDoc.version || 1) + 1,
    updatedAt: now,
    updatedBy: callerToken.uid
  };

  return {
    status: 'SUCCESS',
    content: archivedDoc
  };
}

/**
 * Reorder Content Items (Trusted Backend Only)
 */
async function reorderContent(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId);

  if (!Array.isArray(payload.contentOrders) || payload.contentOrders.length === 0) {
    throw new Error('INVALID_INPUT: contentOrders array is required');
  }

  return {
    status: 'SUCCESS',
    institutionId: instId,
    updatedCount: payload.contentOrders.length
  };
}

module.exports = {
  validateContentCaller,
  createLesson,
  updateLesson,
  archiveLesson,
  createContent,
  updateContent,
  publishContent,
  archiveContent,
  reorderContent
};
