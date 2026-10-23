/**
 * REMAS NEW Badge Service Tests
 * Run with: node tests/new_badge_service.test.js
 */

const {
  FEATURE_REGISTRY,
  shouldShowNewBadge,
  markFeatureSeen,
  getChangelog
} = require('../src/new_badge_service');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// Mock localStorage for Node environment
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = v; },
  removeItem: (k) => { delete storage[k]; }
};

// ─── Feature Registry Tests ───
console.log('\n[1] Feature Registry Tests');
assert(Array.isArray(FEATURE_REGISTRY), 'FEATURE_REGISTRY is an array');
assert(FEATURE_REGISTRY.length > 0, 'FEATURE_REGISTRY is not empty');
assert(FEATURE_REGISTRY.every(f => f.id && f.version && f.label), 'All features have id, version, label');
const ids = FEATURE_REGISTRY.map(f => f.id);
assert(new Set(ids).size === ids.length, 'Feature IDs are unique');

// ─── shouldShowNewBadge Tests ───
console.log('\n[2] shouldShowNewBadge Tests');

// User has NOT seen feature, feature version <= app version → show badge
const testUser1 = 'user_abc';
storage[`remas_new_seen_${testUser1}`] = JSON.stringify([]);
const result1 = shouldShowNewBadge('content_management', '52.0.0', testUser1, true);
assert(result1 === true, 'Shows NEW badge for unseen feature with matching version');

// User HAS seen feature → do not show
storage[`remas_new_seen_${testUser1}`] = JSON.stringify(['content_management']);
const result2 = shouldShowNewBadge('content_management', '52.0.0', testUser1, true);
assert(result2 === false, 'Does NOT show NEW badge after user has seen feature');

// Feature version > app version → do not show (feature not yet in this app)
const result3 = shouldShowNewBadge('content_management', '51.0.0', testUser1, true);
assert(result3 === false, 'Does NOT show badge when feature version > app version');

// Unknown feature → do not show
const result4 = shouldShowNewBadge('nonexistent_feature', '99.0.0', testUser1, true);
assert(result4 === false, 'Does NOT show badge for unknown feature');

// No permission → do not show (hidden for inaccessible modules)
const resultNoPerm = shouldShowNewBadge('content_management', '52.0.0', testUser1, false);
assert(resultNoPerm === false, 'Does NOT show badge when user lacks permission');

// Different user who has NOT seen it → show
const testUser2 = 'user_xyz';
storage[`remas_new_seen_${testUser2}`] = JSON.stringify([]);
const result5 = shouldShowNewBadge('content_management', '52.0.0', testUser2, true);
assert(result5 === true, 'Shows badge for different user who has not seen it');

// ─── markFeatureSeen Tests ───
console.log('\n[3] markFeatureSeen Tests');
const testUser3 = 'user_mark';
storage[`remas_new_seen_${testUser3}`] = JSON.stringify([]);
assert(shouldShowNewBadge('ai_usage', '52.0.0', testUser3, true) === true, 'Badge visible before markFeatureSeen');
markFeatureSeen(testUser3, 'ai_usage');
const seenList = JSON.parse(storage[`remas_new_seen_${testUser3}`]);
assert(seenList.includes('ai_usage'), 'markFeatureSeen stores feature ID');
assert(shouldShowNewBadge('ai_usage', '52.0.0', testUser3, true) === false, 'Badge hidden after markFeatureSeen');

// ─── getChangelog Tests ───
console.log('\n[4] getChangelog Tests');
const changelog = getChangelog('52.0.0');
assert(Array.isArray(changelog), 'getChangelog returns array');
assert(changelog.length > 0, 'getChangelog not empty');
assert(changelog.every(c => c.id && c.version && c.feature), 'Changelog items have required fields');

// Future features (version > current app) must NOT appear in changelog
const allVersions = changelog.map(c => c.version);
assert(allVersions.every(v => {
  const [aMaj, aMin] = v.split('.').map(Number);
  return aMaj < 52 || (aMaj === 52 && aMin <= 0);
}), 'Changelog excludes features from future versions');

// Changelog with full current version shows all shipped features
const fullChangelog = getChangelog('99.0.0');
assert(fullChangelog.length === FEATURE_REGISTRY.length, 'Changelog shows all features when app is up-to-date');

// ─── Summary ───
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
