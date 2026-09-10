/**
 * AI Usage Control & Rate Limiting Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const MAX_DAILY_AI_REQUESTS = 50;

const USAGE_LOGS_STORE = new Map(); // Key: `${institutionId}_${studentId}_${dateKey}` -> count

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Validates daily rate limits for student AI requests
 */
function checkRateLimit(institutionId, studentId, limitOverride = MAX_DAILY_AI_REQUESTS) {
  if (!institutionId || !studentId) {
    throw new Error('MISSING_REQUIRED_FIELDS: institutionId and studentId are required for rate limit check');
  }

  const key = `${institutionId}_${studentId}_${getTodayKey()}`;
  const currentUsage = USAGE_LOGS_STORE.get(key) || 0;

  if (currentUsage >= limitOverride) {
    return {
      allowed: false,
      currentUsage,
      limit: limitOverride,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: `تجاوزت الحد اليومي المسموح به لأسئلة المساعد الذكي (${limitOverride} سؤال/يوم). يُرجى المحاولة غداً.`
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit: limitOverride,
    remaining: limitOverride - currentUsage
  };
}

/**
 * Records AI request usage and token metrics
 */
function logAIUsage({ institutionId, studentId, feature, provider, tokenUsage = {}, status = 'SUCCESS' }) {
  const key = `${institutionId}_${studentId}_${getTodayKey()}`;
  const currentUsage = USAGE_LOGS_STORE.get(key) || 0;
  USAGE_LOGS_STORE.set(key, currentUsage + 1);

  return {
    logged: true,
    institutionId,
    studentId,
    feature,
    provider,
    dateKey: getTodayKey(),
    newTotalToday: currentUsage + 1,
    tokenUsage,
    status
  };
}

/**
 * Reset memory usage store (for unit tests)
 */
function resetUsageStore() {
  USAGE_LOGS_STORE.clear();
}

module.exports = {
  MAX_DAILY_AI_REQUESTS,
  checkRateLimit,
  logAIUsage,
  resetUsageStore
};
