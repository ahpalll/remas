/**
 * REMAS NEW Badge Service
 * Tracks new features and shows NEW badge to eligible users.
 * 
 * Each feature has:
 * - id: stable identifier (e.g., 'content_management')
 * - version: the app version when it first appeared (e.g., '53.0.0')
 * - label: display label for changelog
 * 
 * Per-user seen status is stored in localStorage keyed by employee UID.
 * Badge disappears after user navigates to the feature.
 */

// Feature registry — add new features here with their first-appearance version
const FEATURE_REGISTRY = [
  { id: 'content_management', version: '52.0.0', label: 'مركز المحتوى التعليمي' },
  { id: 'ai_usage', version: '52.0.0', label: 'استهلاك الذكاء الاصطناعي' },
  { id: 'subscriptions', version: '51.0.0', label: 'الباقات والاشتراكات' },
  { id: 'central_exams', version: '50.0.0', label: 'الاختبارات المركزية' },
  // Add new features here as they are released
];

/**
 * Compare semantic versions
 */
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const pb = b.replace(/^v/, '').split('-')[0].split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Get the seen features for a user from localStorage
 */
function getSeenFeatures(userId) {
  try {
    const key = `remas_new_seen_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Mark a feature as seen for a user
 */
function markFeatureSeen(userId, featureId) {
  try {
    const key = `remas_new_seen_${userId}`;
    const seen = getSeenFeatures(userId);
    if (!seen.includes(featureId)) {
      seen.push(featureId);
      localStorage.setItem(key, JSON.stringify(seen));
    }
  } catch (_) {
    // localStorage may be unavailable — fail silently
  }
}

/**
 * Check if a feature should show NEW badge for a user
 * @param {string} featureId - Feature ID
 * @param {string} appVersion - Current app version
 * @param {string} userId - Current user/employee ID
 * @param {boolean} hasPermission - Whether user has permission to view this feature
 */
function shouldShowNewBadge(featureId, appVersion, userId, hasPermission) {
  // No badge for features user can't access
  if (!hasPermission) return false;
  
  const feature = FEATURE_REGISTRY.find(f => f.id === featureId);
  if (!feature) return false;
  
  // Only show if the feature appeared in a version newer than or equal to user's current version
  // AND the user hasn't marked it as seen
  if (compareVersions(appVersion, feature.version) < 0) return false;
  
  const seen = getSeenFeatures(userId);
  return !seen.includes(featureId);
}

/**
 * Get all features that should show NEW badge
 */
function getNewFeatures(appVersion, userId, permissionChecker) {
  return FEATURE_REGISTRY.filter(f => {
    const hasPerm = permissionChecker ? permissionChecker(f.id) : true;
    return shouldShowNewBadge(f.id, appVersion, userId, hasPerm);
  });
}

/**
 * Get changelog for display
 */
function getChangelog(appVersion) {
  return FEATURE_REGISTRY
    // Show features that exist in (or before) the current app version —
    // future features not yet shipped must not appear.
    .filter(f => compareVersions(f.version, appVersion) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version))
    .map(f => ({
      feature: f.label,
      version: f.version,
      id: f.id
    }));
}

/**
 * Register a new feature (for future use or dynamic registration)
 */
function registerFeature(id, version, label) {
  const existing = FEATURE_REGISTRY.find(f => f.id === id);
  if (!existing) {
    FEATURE_REGISTRY.push({ id, version, label });
  }
}

const _badgeExports = {
  FEATURE_REGISTRY,
  compareVersions,
  getSeenFeatures,
  markFeatureSeen,
  shouldShowNewBadge,
  getNewFeatures,
  getChangelog,
  registerFeature
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _badgeExports;
}
if (typeof window !== 'undefined') {
  window.newBadgeService = _badgeExports;
}
