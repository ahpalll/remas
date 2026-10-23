/**
 * D.2.1 — Center Desktop content-upload constants (packaged copy).
 *
 * Source of truth: `firebase/content_config.js` (repo root, NOT packaged).
 * This file exists ONLY because Electron packages `center-desktop/` alone —
 * `require('../../firebase/...')` cannot resolve inside the installed app.
 * Values below MUST mirror the source exactly; `phase_52_d21_packaging.test.js`
 * enforces parity on every protocol run. No fake fallbacks, no bypasses.
 */

const CONTENT_TYPES = Object.freeze(['VIDEO', 'PDF', 'IMAGE', 'DOCUMENT', 'FILE', 'TEXT', 'HOMEWORK_REF']);

const CONTENT_TYPE_ALIASES = Object.freeze({
  LESSON_NOTE: 'TEXT',
  LINK: 'TEXT',
  AUDIO: 'DOCUMENT'
});

const MAX_FILE_SIZE_BYTES = Object.freeze({
  VIDEO: 2 * 1024 * 1024 * 1024, // 2 GB
  PDF: 100 * 1024 * 1024, // 100 MB
  IMAGE: 20 * 1024 * 1024, // 20 MB
  DOCUMENT: 50 * 1024 * 1024, // 50 MB
  FILE: 50 * 1024 * 1024, // 50 MB
  TEXT: 1 * 1024 * 1024, // 1 MB (inline text body cap)
  HOMEWORK_REF: 10 * 1024, // 10 KB (reference only, no binary)
  ATTACHMENT: 20 * 1024 * 1024 // 20 MB (homework submission attachments)
});

const ALLOWED_MIME_TYPES = Object.freeze({
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  PDF: ['application/pdf'],
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  FILE: ['application/pdf', 'application/zip', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  TEXT: ['text/plain', 'text/markdown'],
  HOMEWORK_REF: ['text/plain']
});

const DISALLOWED_EXTENSIONS = Object.freeze(['.exe', '.dll', '.bat', '.sh', '.bin', '.cmd', '.scr', '.vbs', '.js', '.html', '.htm']);

function normalizeContentType(t) {
  if (!t || typeof t !== 'string') return t;
  const u = t.trim().toUpperCase();
  if (CONTENT_TYPES.includes(u)) return u;
  if (CONTENT_TYPE_ALIASES[u]) return CONTENT_TYPE_ALIASES[u];
  return u; // unknown — caller validates against CONTENT_TYPES
}

// CENTRAL CONTENT HUB CORE mirror (must match firebase/content_config.js).
function validateGroupIdsMirror(groupIds) {
  if (groupIds === null || groupIds === undefined) return null;
  if (!Array.isArray(groupIds)) throw new Error('INVALID_GROUP_TARGET: groupIds must be an array or null');
  if (groupIds.length === 0) throw new Error('INVALID_GROUP_TARGET: groupIds [] is not allowed — use null for subject-wide');
  if (groupIds.length > 50) throw new Error('INVALID_GROUP_TARGET: groupIds exceeds 50');
  const seen = new Set();
  for (const g of groupIds) {
    if (typeof g !== 'string' || !g.trim()) throw new Error('INVALID_GROUP_TARGET: each groupId must be a non-empty string');
    if (seen.has(g)) throw new Error('INVALID_GROUP_TARGET: duplicate groupId');
    seen.add(g);
  }
  return groupIds.slice();
}

// Packaged mirror of assertGroupTargetingValid (source: firebase/content_config.js).
// Parity enforced by phase_52_d21_packaging.test.js + content_hub_hardening.test.js.
function assertGroupTargetingValid({ groupIds, institutionId, stageId = null, subjectId = null, academicYearId = null, termId = null, groupDirectory = null, requireActive = true }) {
  if (groupIds === null || groupIds === undefined) return null;
  const normalized = validateGroupIdsMirror(groupIds);
  if (!institutionId || typeof institutionId !== 'string' || !institutionId.trim()) {
    throw new Error('INVALID_GROUP_TARGET: institutionId is required to validate group targeting');
  }
  if (!Array.isArray(groupDirectory)) {
    throw new Error('UNVERIFIED_GROUP_TARGET: group directory is required — groupIds must be verified against the institution groups before persistence');
  }
  const byId = new Map();
  for (const g of groupDirectory) {
    if (g && g.id) byId.set(g.id, g);
  }
  for (const gid of normalized) {
    const g = byId.get(gid);
    if (!g) throw new Error(`UNKNOWN_GROUP: group '${gid}' does not exist in institution '${institutionId}'`);
    if (g.institutionId !== undefined && g.institutionId !== null && g.institutionId !== institutionId) {
      throw new Error(`CROSS_TENANT_VIOLATION: group '${gid}' belongs to another institution`);
    }
    if (stageId !== null && stageId !== undefined && g.stageId !== undefined && g.stageId !== null && g.stageId !== stageId) {
      throw new Error(`INVALID_GROUP_STAGE: group '${gid}' does not belong to the selected stage`);
    }
    if (subjectId !== null && subjectId !== undefined && g.subjectId !== undefined && g.subjectId !== null && g.subjectId !== subjectId) {
      throw new Error(`INVALID_GROUP_SUBJECT: group '${gid}' does not belong to the selected subject`);
    }
    if (academicYearId !== null && academicYearId !== undefined && g.academicYearId !== undefined && g.academicYearId !== null && g.academicYearId !== '' && g.academicYearId !== academicYearId) {
      throw new Error(`INVALID_GROUP_YEAR: group '${gid}' does not belong to the selected academic year`);
    }
    if (termId !== null && termId !== undefined && g.termId !== undefined && g.termId !== null && g.termId !== termId) {
      throw new Error(`INVALID_GROUP_TERM: group '${gid}' does not belong to the selected term`);
    }
    if (requireActive && g.status !== undefined && g.status !== null && g.status !== 'ACTIVE') {
      throw new Error(`INACTIVE_GROUP: group '${gid}' is not ACTIVE (status: ${g.status})`);
    }
  }
  return normalized;
}

// BATCH 1 mirror — academic context + unit/source validators (source: firebase/content_config.js).
function validateAcademicYearId(v, opts = {}) {
  const required = opts.required === true;
  if (v === undefined || v === null || v === '') {
    if (required) throw new Error('MISSING_ACADEMIC_YEAR: academicYearId is required for this record');
    return null;
  }
  if (typeof v !== 'string' || !v.trim()) throw new Error('INVALID_ACADEMIC_YEAR: academicYearId must be a non-empty string');
  return v;
}

function validateTermId(v, opts = {}) {
  const required = opts.required === true;
  if (v === undefined || v === null || v === '') {
    if (required) throw new Error('MISSING_TERM: termId is required for this record');
    return null;
  }
  if (typeof v !== 'string' || !v.trim()) throw new Error('INVALID_TERM: termId must be a non-empty string');
  return v;
}

function assertAcademicContextValid({ academicYearId = null, termId = null, institutionId, academicDirectory = null, requireYear = false, requireTerm = false }) {
  const year = validateAcademicYearId(academicYearId, { required: requireYear });
  const term = validateTermId(termId, { required: requireTerm });
  if (!institutionId || typeof institutionId !== 'string' || !institutionId.trim()) {
    throw new Error('INVALID_ACADEMIC_CONTEXT: institutionId is required to validate academic context');
  }
  if (year === null && term === null) return { academicYearId: null, termId: null };
  if (!academicDirectory || typeof academicDirectory !== 'object') {
    throw new Error('UNVERIFIED_ACADEMIC_CONTEXT: academic directory is required — year/term must be verified before persistence');
  }
  if (year !== null && Array.isArray(academicDirectory.years)) {
    const y = academicDirectory.years.find((r) => r && r.id === year);
    if (!y) throw new Error(`UNKNOWN_ACADEMIC_YEAR: academic year '${year}' does not exist in institution '${institutionId}'`);
    if (y.institutionId !== undefined && y.institutionId !== null && y.institutionId !== institutionId) {
      throw new Error(`CROSS_TENANT_VIOLATION: academic year '${year}' belongs to another institution`);
    }
  }
  if (term !== null) {
    if (!Array.isArray(academicDirectory.terms)) {
      throw new Error('UNVERIFIED_ACADEMIC_CONTEXT: term directory is required to verify termId');
    }
    const t = academicDirectory.terms.find((r) => r && r.id === term);
    if (!t) throw new Error(`UNKNOWN_TERM: term '${term}' does not exist in institution '${institutionId}'`);
    if (t.institutionId !== undefined && t.institutionId !== null && t.institutionId !== institutionId) {
      throw new Error(`CROSS_TENANT_VIOLATION: term '${term}' belongs to another institution`);
    }
    if (year !== null && t.academicYearId !== undefined && t.academicYearId !== null && t.academicYearId !== year) {
      throw new Error(`INVALID_TERM_YEAR: term '${term}' does not belong to academic year '${year}'`);
    }
    if (t.status !== undefined && t.status !== null && t.status !== 'ACTIVE') {
      throw new Error(`INACTIVE_TERM: term '${term}' is not ACTIVE (status: ${t.status})`);
    }
  }
  return { academicYearId: year, termId: term };
}

function assertUnitContextValid({ unitId, institutionId, academicYearId = null, termId = null, stageId = null, subjectId = null, unitDirectory = null }) {
  if (unitId === undefined || unitId === null || unitId === '') return null;
  if (typeof unitId !== 'string' || !unitId.trim()) throw new Error('INVALID_UNIT: unitId must be a non-empty string');
  if (!Array.isArray(unitDirectory)) {
    throw new Error('UNVERIFIED_UNIT: unit directory is required — unitId must be verified before persistence');
  }
  const u = unitDirectory.find((r) => r && r.id === unitId);
  if (!u) throw new Error(`UNKNOWN_UNIT: unit '${unitId}' does not exist in institution '${institutionId}'`);
  if (u.institutionId !== undefined && u.institutionId !== null && u.institutionId !== institutionId) {
    throw new Error(`CROSS_TENANT_VIOLATION: unit '${unitId}' belongs to another institution`);
  }
  const pairs = [['academicYearId', academicYearId, 'INVALID_UNIT_YEAR'], ['termId', termId, 'INVALID_UNIT_TERM'], ['stageId', stageId, 'INVALID_UNIT_STAGE'], ['subjectId', subjectId, 'INVALID_UNIT_SUBJECT']];
  for (const [field, expected, code] of pairs) {
    if (expected !== null && expected !== undefined && u[field] !== undefined && u[field] !== null && u[field] !== expected) {
      throw new Error(`${code}: unit '${unitId}' does not belong to the selected context`);
    }
  }
  if (u.status !== undefined && u.status !== null && u.status !== 'ACTIVE') {
    throw new Error(`INACTIVE_UNIT: unit '${unitId}' is not ACTIVE (status: ${u.status})`);
  }
  return unitId;
}

// BATCH 2A fix mirror — canonical eligible-source predicate + generation
// filter (source: firebase/source_service.js). Parity enforced by tests.
function sourceEligibilityMirror(s, ctx) {
  const c = ctx || {};
  if (!s) return { ok: false, reason: 'UNKNOWN_SOURCE' };
  if (s.status === 'ARCHIVED') return { ok: false, reason: 'ARCHIVED' };
  if (s.status !== 'PUBLISHED') return { ok: false, reason: 'DRAFT' };
  if (!s.objectKey) return { ok: false, reason: 'NO_FILE' };
  const strict = [['academicYearId', 'YEAR'], ['termId', 'TERM'], ['stageId', 'STAGE'], ['subjectId', 'SUBJECT']];
  for (const [field, code] of strict) {
    const want = c[field];
    const has = s[field];
    if (want !== undefined && want !== null && want !== '' && has !== undefined && has !== null && has !== want) {
      return { ok: false, reason: `${code}_MISMATCH` };
    }
  }
  return { ok: true, reason: '' };
}

function sourceMatchesNarrowingMirror(s, ctx) {
  const c = ctx || {};
  for (const field of ['unitId', 'lessonId']) {
    const want = c[field];
    const has = s[field];
    if (want !== undefined && want !== null && want !== '' && has !== undefined && has !== null && has !== '' && has !== want) {
      return false;
    }
  }
  return true;
}

function filterSourcesForGenerationMirror(sources, ctx) {
  const eligible = [];
  const ineligible = [];
  for (const s of (sources || [])) {
    if (!sourceMatchesNarrowingMirror(s, ctx)) continue;
    const e = sourceEligibilityMirror(s, ctx);
    if (e.ok) eligible.push(s);
    else ineligible.push({ id: s && s.id, reason: e.reason });
  }
  return { eligible, ineligible };
}

function assertSourceRefValid({ sourceId, institutionId, academicYearId = null, termId = null, stageId = null, subjectId = null, sourceDirectory = null }) {
  if (sourceId === undefined || sourceId === null || sourceId === '') return null;
  if (typeof sourceId !== 'string' || !sourceId.trim()) throw new Error('INVALID_SOURCE_REF: sourceId must be a non-empty string');
  if (!Array.isArray(sourceDirectory)) {
    throw new Error('UNVERIFIED_SOURCE_REF: source directory is required — sourceId must be verified before persistence');
  }
  const s = sourceDirectory.find((r) => r && r.id === sourceId);
  if (!s) throw new Error(`UNKNOWN_SOURCE: source '${sourceId}' does not exist in institution '${institutionId}'`);
  if (s.institutionId !== undefined && s.institutionId !== null && s.institutionId !== institutionId) {
    throw new Error(`CROSS_TENANT_VIOLATION: source '${sourceId}' belongs to another institution`);
  }
  const pairs = [['academicYearId', academicYearId, 'INVALID_SOURCE_YEAR'], ['termId', termId, 'INVALID_SOURCE_TERM'], ['stageId', stageId, 'INVALID_SOURCE_STAGE'], ['subjectId', subjectId, 'INVALID_SOURCE_SUBJECT']];
  for (const [field, expected, code] of pairs) {
    if (expected !== null && expected !== undefined && s[field] !== undefined && s[field] !== null && s[field] !== expected) {
      throw new Error(`${code}: source '${sourceId}' does not belong to the selected academic context`);
    }
  }
  return { sourceId, sourceStatus: s.status || null, usable: s.status === 'PUBLISHED' };
}

const ACCESS_TYPES = Object.freeze(['FREE', 'SUBSCRIPTION_REQUIRED']);
const HOMEWORK_MODES = Object.freeze(['DIGITAL', 'PAPER', 'HYBRID']);
const QUESTION_TYPES_HUB = Object.freeze(['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'SHORT_ANSWER', 'ESSAY']);
const QUESTION_TYPE_ALIASES_HUB = Object.freeze({ SHORT_TEXT: 'SHORT_ANSWER' });
const QUESTION_DIFFICULTIES = Object.freeze(['EASY', 'MEDIUM', 'HARD']);
const EXAM_OWNER_SCOPES = Object.freeze(['CENTER', 'TEACHER']);
const EXAM_STATUSES_HUB = Object.freeze(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']);
const UNIT_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
const SOURCE_STATUSES = Object.freeze(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const SOURCE_MIME_TYPES = Object.freeze([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown',
  'image/jpeg', 'image/png', 'image/webp'
]);
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const GRADE_REVIEW_STATUSES = Object.freeze(['PENDING', 'GRADED', 'REVIEW_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED_RESULT', 'FINALIZED']);
const APPROVAL_DECISIONS = Object.freeze(['APPROVED', 'REJECTED']);
const GRADING_RULES = Object.freeze(['EXACT', 'EXACT_SET']);
// BATCH 2A mirror — AI question review workflow (source: firebase/ai_question_service.js).
const GENERATION_QUESTION_STATUSES = Object.freeze(['AI_GENERATED', 'DUPLICATE_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED']);

function transitionQuestionStatusMirror(existingStatus, toStatus) {
  const edges = {
    AI_GENERATED: ['ACTIVE', 'REJECTED', 'DUPLICATE_REVIEW', 'ARCHIVED'],
    DUPLICATE_REVIEW: ['ACTIVE', 'REJECTED', 'ARCHIVED'],
    ACTIVE: ['ARCHIVED'],
    // Mirror of firebase/ai_question_service.js: REJECTED -> ARCHIVED is the
    // old-question cleanup path (terminal to terminal, document preserved).
    REJECTED: ['ARCHIVED'],
    ARCHIVED: []
  };
  if (!(edges[existingStatus] || []).includes(toStatus) && existingStatus !== toStatus) {
    throw new Error(`INVALID_STATUS_TRANSITION: Cannot move question ${existingStatus} -> ${toStatus}`);
  }
  return toStatus;
}

module.exports = {
  CONTENT_TYPES,
  CONTENT_TYPE_ALIASES,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  DISALLOWED_EXTENSIONS,
  normalizeContentType,
  validateGroupIdsMirror,
  assertGroupTargetingValid,
  validateAcademicYearId,
  validateTermId,
  assertAcademicContextValid,
  assertUnitContextValid,
  assertSourceRefValid,
  sourceEligibilityMirror,
  sourceMatchesNarrowingMirror,
  filterSourcesForGenerationMirror,
  ACCESS_TYPES,
  HOMEWORK_MODES,
  QUESTION_TYPES_HUB,
  QUESTION_TYPE_ALIASES_HUB,
  QUESTION_DIFFICULTIES,
  EXAM_OWNER_SCOPES,
  EXAM_STATUSES_HUB,
  UNIT_STATUSES,
  SOURCE_STATUSES,
  SOURCE_MIME_TYPES,
  MAX_SOURCE_BYTES,
  GRADE_REVIEW_STATUSES,
  APPROVAL_DECISIONS,
  GRADING_RULES,
  GENERATION_QUESTION_STATUSES,
  transitionQuestionStatusMirror
};
