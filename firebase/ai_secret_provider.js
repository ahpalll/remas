/**
 * Server-Side AI Secret Provider & Zero-Downtime Key Rotation Engine
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const fs = require('node:fs');
const path = require('node:path');

const SECRETS_DIR = 'F:\\firebase-secrets';
const SECRET_STORE_PATH = path.join(SECRETS_DIR, 'gemini_secret_store.json');
const TXT_KEY_PATH = path.join(SECRETS_DIR, 'gemini_api_key.txt');

/**
 * Creates masked representation of API key showing only last 4 characters
 * Example: "AQ.Ab8RN...HOg" -> "••••••••••••HOg"
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string' || key.trim() === '') {
    return 'غير معرّف';
  }
  const trimmed = key.trim();
  if (trimmed.length <= 4) {
    return '••••';
  }
  const last4 = trimmed.substring(trimmed.length - 4);
  return `••••••••••••${last4}`;
}

/**
 * Ensures secrets directory and initial store file exist
 */
function ensureSecretStore() {
  if (!fs.existsSync(SECRETS_DIR)) {
    try {
      fs.mkdirSync(SECRETS_DIR, { recursive: true });
    } catch (err) {
      // Ignore
    }
  }

  if (!fs.existsSync(SECRET_STORE_PATH)) {
    let initialKey = '';
    if (fs.existsSync(TXT_KEY_PATH)) {
      try {
        initialKey = fs.readFileSync(TXT_KEY_PATH, 'utf8').trim();
      } catch (e) {}
    }

    const initialStore = {
      activeKey: initialKey,
      previousKey: '',
      status: initialKey ? 'ENABLED' : 'DISABLED',
      provider: 'Google Gemini',
      model: 'gemini-2.5-flash',
      lastTestedAt: initialKey ? new Date().toISOString() : null,
      lastRotatedAt: initialKey ? new Date().toISOString() : null,
      keyMasked: maskApiKey(initialKey)
    };

    try {
      fs.writeFileSync(SECRET_STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    } catch (e) {}
  }
}

/**
 * Retrieves the current active Gemini API Key from server secret store
 */
function getActiveGeminiKey() {
  ensureSecretStore();

  if (fs.existsSync(SECRET_STORE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(SECRET_STORE_PATH, 'utf8'));
      if (data.status === 'DISABLED') {
        return null;
      }
      if (data.activeKey) {
        return data.activeKey.trim();
      }
    } catch (e) {}
  }

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    return process.env.GEMINI_API_KEY.trim();
  }

  if (fs.existsSync(TXT_KEY_PATH)) {
    try {
      const key = fs.readFileSync(TXT_KEY_PATH, 'utf8').trim();
      if (key) return key;
    } catch (e) {}
  }

  return null;
}

/**
 * Tests live connection to Google Gemini API using candidate key without modifying active key
 */
async function testGeminiKeyConnection(candidateKey) {
  const keyToTest = candidateKey || getActiveGeminiKey();

  if (!keyToTest || typeof keyToTest !== 'string' || keyToTest.trim() === '') {
    return {
      success: false,
      status: 'FAILED',
      reason: 'MISSING_API_KEY',
      message: 'لم يتم تزويد مفتاح API صريح للاختبار'
    };
  }

  try {
    const fetch = globalThis.fetch || require('node-fetch');
    const modelName = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${keyToTest.trim()}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: 'اختبار الاتصال السريع.' }] }],
      generationConfig: { temperature: 0.1 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok || res.status === 429) {
      return {
        success: true,
        status: 'SUCCESS',
        model: modelName,
        provider: 'Google Gemini',
        rateLimited: res.status === 429,
        message: res.status === 429
          ? 'تم التحقق من صحة مفتاح Gemini API بنجاح (المفتاح مقبول وصحيح من Google)'
          : 'تم الاتصال بنجاح بمزود Gemini 2.5 Flash'
      };
    }

    const rawErr = await res.text();
    const safeErr = rawErr.replace(/key=[A-Za-z0-9_-]+/g, 'key=[REDACTED]');
    return {
      success: false,
      status: 'FAILED',
      reason: `HTTP_${res.status}`,
      message: `فشل تفعيل المفتاح: HTTP ${res.status} - ${safeErr.substring(0, 100)}`
    };
  } catch (err) {
    const safeMsg = (err.message || '').replace(/key=[A-Za-z0-9_-]+/g, 'key=[REDACTED]');
    return {
      success: false,
      status: 'FAILED',
      reason: 'NETWORK_ERROR',
      message: `خطأ في الاتصال بالشبكة: ${safeMsg}`
    };
  }
}

/**
 * Performs Zero-Downtime Safe Key Rotation
 * If new key passes test -> Activates new key.
 * If new key fails test -> Keeps current valid active key untouched.
 */
async function rotateGeminiKey(newCandidateKey, actorId = 'superadmin') {
  ensureSecretStore();

  if (!newCandidateKey || typeof newCandidateKey !== 'string' || newCandidateKey.trim() === '') {
    return {
      success: false,
      status: 'INVALID_INPUT',
      message: 'الرجاء تزويد نص المفتاح الجديد المراد اختباره وتفعيله.',
      activeKeyPreserved: true
    };
  }

  const trimmedKey = newCandidateKey.trim();

  // Step 1: Test connection with candidate key FIRST
  const testRes = await testGeminiKeyConnection(trimmedKey);
  if (!testRes.success) {
    return {
      success: false,
      status: 'ROTATION_FAILED_INVALID_KEY',
      testError: testRes.message,
      message: 'فشل اختبار المفتاح الجديد. تم الإبقاء على المفتاح الحالي الفعال بدون أي انقطاع.',
      activeKeyPreserved: true
    };
  }

  // Step 2: Test passed -> Save and activate new key
  let store = {};
  if (fs.existsSync(SECRET_STORE_PATH)) {
    try {
      store = JSON.parse(fs.readFileSync(SECRET_STORE_PATH, 'utf8'));
    } catch (e) {}
  }

  const oldKey = store.activeKey || '';
  const nowISO = new Date().toISOString();

  store.previousKey = oldKey;
  store.activeKey = trimmedKey;
  store.status = 'ENABLED';
  store.provider = 'Google Gemini';
  store.model = 'gemini-2.5-flash';
  store.lastTestedAt = nowISO;
  store.lastRotatedAt = nowISO;
  store.keyMasked = maskApiKey(trimmedKey);
  store.lastRotatedBy = actorId;

  try {
    fs.writeFileSync(SECRET_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    fs.writeFileSync(TXT_KEY_PATH, trimmedKey, 'utf8');
  } catch (e) {}

  return {
    success: true,
    status: 'ROTATION_SUCCESSFUL',
    message: 'تم تفعيل واستبدال مفتاح Gemini API بنجاح وتح تحديث بيانات الاعتماد الآمنة بالسيرفر.',
    keyMasked: store.keyMasked,
    activeKeyPreserved: false
  };
}

/**
 * Disables AI Provider System globally
 */
function disableGeminiAI(actorId = 'superadmin') {
  ensureSecretStore();
  let store = {};
  if (fs.existsSync(SECRET_STORE_PATH)) {
    try {
      store = JSON.parse(fs.readFileSync(SECRET_STORE_PATH, 'utf8'));
    } catch (e) {}
  }

  store.status = 'DISABLED';
  store.lastDisabledAt = new Date().toISOString();
  store.disabledBy = actorId;

  try {
    fs.writeFileSync(SECRET_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {}

  return {
    success: true,
    status: 'AI_DISABLED',
    message: 'تم تعطيل نظام الذكاء الاصطناعي بنجاح'
  };
}

/**
 * Enables AI Provider System globally
 */
function enableGeminiAI(actorId = 'superadmin') {
  ensureSecretStore();
  let store = {};
  if (fs.existsSync(SECRET_STORE_PATH)) {
    try {
      store = JSON.parse(fs.readFileSync(SECRET_STORE_PATH, 'utf8'));
    } catch (e) {}
  }

  if (!store.activeKey) {
    return {
      success: false,
      status: 'NO_KEY_CONFIGURED',
      message: 'تعذر التفعيل: لا يوجد مفتاح فعال مخزن في السيرفر.'
    };
  }

  store.status = 'ENABLED';
  store.lastEnabledAt = new Date().toISOString();
  store.enabledBy = actorId;

  try {
    fs.writeFileSync(SECRET_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {}

  return {
    success: true,
    status: 'AI_ENABLED',
    message: 'تم تفعيل نظام الذكاء الاصطناعي بنجاح'
  };
}

/**
 * Retrieves safe metadata representation for UI console (NO raw API keys returned!)
 */
function getAISettingsMetadata() {
  ensureSecretStore();
  let store = {};
  if (fs.existsSync(SECRET_STORE_PATH)) {
    try {
      store = JSON.parse(fs.readFileSync(SECRET_STORE_PATH, 'utf8'));
    } catch (e) {}
  }

  const activeKey = getActiveGeminiKey();
  const status = store.status === 'DISABLED' ? 'DISABLED' : (activeKey ? 'ENABLED' : 'ERROR');

  return {
    status,
    provider: 'Google Gemini',
    model: 'gemini-2.5-flash',
    keyMasked: maskApiKey(activeKey),
    hasActiveKey: !!activeKey,
    lastTestedAt: store.lastTestedAt || null,
    lastRotatedAt: store.lastRotatedAt || null
  };
}

/**
 * Checks whether AI system is globally disabled by SuperAdmin
 */
function isAIDisabledGlobally() {
  ensureSecretStore();
  if (fs.existsSync(SECRET_STORE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(SECRET_STORE_PATH, 'utf8'));
      if (data.status === 'DISABLED') return true;
    } catch (e) {}
  }
  return false;
}

module.exports = {
  maskApiKey,
  getActiveGeminiKey,
  isAIDisabledGlobally,
  testGeminiKeyConnection,
  rotateGeminiKey,
  disableGeminiAI,
  enableGeminiAI,
  getAISettingsMetadata
};
