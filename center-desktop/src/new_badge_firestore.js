/**
 * REMAS NEW Badge — Firestore-driven Feature Registry
 *
 * Reads feature registry from Firestore collection `featureRegistry`.
 * Falls back to local registry if Firestore is unavailable.
 * Per-user seen status stored in Firestore collection `userSeenFeatures`.
 *
 * Collections:
 * - featureRegistry/{featureId}: { id, version, label, icon, minVersion, active }
 * - userSeenFeatures/{uid}_{featureId}: { uid, featureId, seenAt }
 */

const FEATURE_REGISTRY_COLLECTION = 'featureRegistry';
const USER_SEEN_COLLECTION = 'userSeenFeatures';

// Local fallback registry (embedded in app)
const LOCAL_REGISTRY = [
  { id: 'content_management', version: '52.0.0', label: 'مركز المحتوى التعليمي', active: true },
  { id: 'ai_usage', version: '52.0.0', label: 'استهلاك الذكاء الاصطناعي', active: true },
  { id: 'subscriptions', version: '51.0.0', label: 'الباقات والاشتراكات', active: true },
  { id: 'central_exams', version: '50.0.0', label: 'الاختبارات المركزية', active: true },
];

/**
 * Compare semantic versions
 */
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const pb = b.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Fetch feature registry from Firestore
 */
async function fetchFeatureRegistry(db) {
  try {
    const snap = await db.collection(FEATURE_REGISTRY_COLLECTION)
      .where('active', '==', true)
      .get();
    if (snap.empty) return LOCAL_REGISTRY;
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        version: data.version || '0.0.0',
        label: data.label || '',
        icon: data.icon || '',
        minVersion: data.minVersion || '0.0.0',
        active: true
      };
    });
  } catch (_) {
    return LOCAL_REGISTRY;
  }
}

/**
 * Get features with NEW badge for a specific user
 */
async function getNewFeatures(db, userId, appVersion, permissionChecker) {
  const registry = await fetchFeatureRegistry(db);
  const newFeatures = [];

  for (const feature of registry) {
    // Check if user has permission
    if (permissionChecker && !permissionChecker(feature.id)) continue;

    // Check if feature is newer than user's app version
    if (compareVersions(feature.version, appVersion) > 0) continue;

    // Check if user has already seen this feature
    const seen = await hasSeenFeature(db, userId, feature.id);
    if (!seen) {
      newFeatures.push(feature);
    }
  }

  return newFeatures;
}

/**
 * Check if user has seen a feature
 */
async function hasSeenFeature(db, userId, featureId) {
  try {
    const docId = `${userId}_${featureId}`;
    const doc = await db.collection(USER_SEEN_COLLECTION).doc(docId).get();
    return doc.exists;
  } catch (_) {
    // Fallback to localStorage
    try {
      const seen = localStorage.getItem(`remas_new_seen_${userId}`);
      if (seen) {
        const parsed = JSON.parse(seen);
        return parsed.includes(featureId);
      }
    } catch (_) {}
    return false;
  }
}

/**
 * Mark a feature as seen for a user
 */
async function markFeatureSeen(db, userId, featureId) {
  try {
    const docId = `${userId}_${featureId}`;
    await db.collection(USER_SEEN_COLLECTION).doc(docId).set({
      uid: userId,
      featureId: featureId,
      seenAt: new Date().toISOString()
    });
  } catch (_) {
    // Fallback to localStorage
    try {
      const key = `remas_new_seen_${userId}`;
      const raw = localStorage.getItem(key);
      const seen = raw ? JSON.parse(raw) : [];
      if (!seen.includes(featureId)) {
        seen.push(featureId);
        localStorage.setItem(key, JSON.stringify(seen));
      }
    } catch (_) {}
  }
}

/**
 * Get changelog for display
 */
async function getChangelog(db, appVersion) {
  const registry = await fetchFeatureRegistry(db);
  return registry
    .filter(f => compareVersions(f.version, appVersion) >= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

module.exports = {
  FEATURE_REGISTRY_COLLECTION,
  USER_SEEN_COLLECTION,
  LOCAL_REGISTRY,
  compareVersions,
  fetchFeatureRegistry,
  getNewFeatures,
  hasSeenFeature,
  markFeatureSeen,
  getChangelog
};
