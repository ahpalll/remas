const crypto = require('node:crypto');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { validateContentCaller } = require('./content_service');

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

// Allowed MIME Types Strategy
const ALLOWED_MIME_TYPES = {
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  PDF: ['application/pdf'],
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  LESSON_NOTE: ['application/pdf', 'text/plain', 'text/markdown'],
  LINK: ['text/plain']
};

// Maximum File Size Limits (Bytes)
const MAX_FILE_SIZE_BYTES = {
  VIDEO: 2 * 1024 * 1024 * 1024, // 2 GB
  PDF: 100 * 1024 * 1024,        // 100 MB
  IMAGE: 20 * 1024 * 1024,       // 20 MB
  AUDIO: 100 * 1024 * 1024,      // 100 MB
  DOCUMENT: 50 * 1024 * 1024,    // 50 MB
  LESSON_NOTE: 10 * 1024 * 1024, // 10 MB
  LINK: 10 * 1024                // 10 KB
};

// Disallowed Executable Extensions
const DISALLOWED_EXTENSIONS = ['.exe', '.dll', '.bat', '.sh', '.bin', '.cmd', '.scr', '.vbs', '.js'];

/**
 * Validates object key canonical format and path traversal rejection
 */
function validateCanonicalObjectKey(objectKey, expectedInstitutionId) {
  if (!objectKey || typeof objectKey !== 'string') {
    throw new Error('INVALID_OBJECT_KEY: Object key must be a non-empty string');
  }
  if (objectKey.includes('../') || objectKey.includes('..\\') || objectKey.includes('%2e%2e')) {
    throw new Error('PATH_TRAVERSAL_DETECTED: Path traversal attempt blocked');
  }

  const parts = objectKey.split('/');
  if (parts.length < 5 || parts[0] !== 'institutions' || parts[2] !== 'contents') {
    throw new Error('MALFORMED_OBJECT_KEY: Key structure must follow institutions/{instId}/contents/{contentId}/v{version}/{objectId}');
  }

  if (expectedInstitutionId && parts[1] !== expectedInstitutionId) {
    throw new Error(`CROSS_TENANT_VIOLATION: Key institution '${parts[1]}' does not match expected '${expectedInstitutionId}'`);
  }

  return true;
}

/**
 * Request Media Upload Session & Short-Lived Presigned Upload URL (Trusted Backend Only)
 */
async function requestUploadSession(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  if (!payload.contentId || !payload.contentType || !payload.mimeType || !payload.fileSizeBytes) {
    throw new Error('MISSING_REQUIRED_FIELDS: contentId, contentType, mimeType, and fileSizeBytes are required');
  }

  // Executable file extension check
  if (payload.filename) {
    const ext = payload.filename.toLowerCase().substring(payload.filename.lastIndexOf('.'));
    if (DISALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`DISALLOWED_FILE_TYPE: File extension '${ext}' is strictly prohibited`);
    }
  }

  // MIME Type Whitelist Check
  const allowedMimes = ALLOWED_MIME_TYPES[payload.contentType] || [];
  if (!allowedMimes.includes(payload.mimeType)) {
    throw new Error(`INVALID_MIME_TYPE: MIME type '${payload.mimeType}' is not allowed for content type '${payload.contentType}'`);
  }

  // File Size Limit Check
  const maxSize = MAX_FILE_SIZE_BYTES[payload.contentType] || 50 * 1024 * 1024;
  if (payload.fileSizeBytes > maxSize) {
    throw new Error(`FILE_SIZE_EXCEEDED: File size (${payload.fileSizeBytes} bytes) exceeds maximum limit (${maxSize} bytes)`);
  }

  const version = payload.version || 1;
  const objectId = crypto.randomUUID();
  const canonicalObjectKey = `institutions/${instId}/contents/${payload.contentId}/v${version}/${objectId}`;

  validateCanonicalObjectKey(canonicalObjectKey, instId);

  const expiresAtMs = Date.now() + (15 * 60 * 1000); // 15 minutes
  const uploadUrl = `https://upload.r2.educenter.local/${canonicalObjectKey}?expires=${expiresAtMs}&sig=${objectId}`;

  return {
    status: 'SUCCESS',
    institutionId: instId,
    contentId: payload.contentId,
    objectKey: canonicalObjectKey,
    uploadUrl,
    expiresInSeconds: 900,
    mediaStatus: 'UPLOAD_PENDING'
  };
}

/**
 * Finalize Media Upload (Trusted Backend Only)
 * Transitions media status UPLOAD_PENDING -> READY
 */
async function finalizeMediaUpload(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  if (!payload.contentId || !payload.objectKey) {
    throw new Error('MISSING_REQUIRED_FIELDS: contentId and objectKey are required');
  }

  validateCanonicalObjectKey(payload.objectKey, instId);

  const now = new Date().toISOString();
  return {
    status: 'SUCCESS',
    institutionId: instId,
    contentId: payload.contentId,
    objectKey: payload.objectKey,
    mediaStatus: 'READY',
    finalizedAt: now,
    finalizedBy: callerToken.uid
  };
}

/**
 * Request Ephemeral Playback / Download URL (~15 Minutes Expiry)
 * Trusted backend / worker wrapper for short-lived access
 */
async function requestPlaybackUrl(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin', 'student']);

  if (!payload.objectKey) {
    throw new Error('MISSING_REQUIRED_FIELDS: objectKey is required');
  }

  validateCanonicalObjectKey(payload.objectKey, instId);

  const mediaStatus = payload.mediaStatus || 'READY';
  if (mediaStatus !== 'READY') {
    throw new Error(`MEDIA_NOT_READY: Cannot request playback for media in status '${mediaStatus}'`);
  }

  const expiresAtMs = Date.now() + (15 * 60 * 1000);
  const signature = crypto.createHash('sha256').update(`${payload.objectKey}_${expiresAtMs}`).digest('hex');
  const playbackUrl = `https://media.educenter.local/${payload.objectKey}?expires=${expiresAtMs}&sig=${signature}`;

  return {
    status: 'SUCCESS',
    playbackUrl,
    expiresInSeconds: 900,
    objectKey: payload.objectKey
  };
}

/**
 * Archive Media Object (Trusted Backend Only)
 */
async function archiveMediaObject(callerToken, payload) {
  const instId = validateContentCaller(callerToken, payload.targetInstitutionId, ['superAdmin', 'institutionOwner', 'admin']);

  if (!payload.objectKey) {
    throw new Error('MISSING_REQUIRED_FIELDS: objectKey is required');
  }

  validateCanonicalObjectKey(payload.objectKey, instId);

  return {
    status: 'SUCCESS',
    objectKey: payload.objectKey,
    mediaStatus: 'ARCHIVED',
    archivedAt: new Date().toISOString()
  };
}

module.exports = {
  validateCanonicalObjectKey,
  requestUploadSession,
  finalizeMediaUpload,
  requestPlaybackUrl,
  archiveMediaObject
};
