/**
 * Server-Side AI Secret Provider & Zero-Downtime Multi-Provider Key Rotation Engine
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 * Supports: Google Gemini & OpenRouter
 */

const fs = require('node:fs');
const path = require('node:path');

const SECRETS_DIR = 'F:\\firebase-secrets';
const SECRET_STORE_PATH = path.join(SECRETS_DIR, 'gemini_secret_store.json');
const TXT_KEY_PATH = path.join(SECRETS_DIR, 'gemini_api_key.txt');
const OPENROUTER_TXT_KEY_PATH = path.join(SECRETS_DIR, 'openrouter_api_key.txt');

/**
 * Creates masked representation of API key showing only last 4 characters
 * Example: "sk-or-v1-abc...1234" -> "••••••••••••1234"
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
 * Normalizes and returns current secret store data with migration to multi-provider format
 */
function getSecretStoreData() {
  ensureSecretStore();
  let store = {};
  if (fs.existsSync(SECRET_STORE_PATH)) {
    try {
      store = JSON.parse(fs.readFileSync(SECRET_STORE_PATH, 'utf8'));
    } catch (e) {}
  }

  // Migrate legacy single-provider schema if needed
  let changed = false;
  if (!store.primaryProvider) {
    store.primaryProvider = 'gemini';
    changed = true;
  }
  if (!store.fallbackProvider) {
    store.fallbackProvider = 'none';
    changed = true;
  }

  if (!store.gemini) {
    const legacyKey = store.activeKey || '';
    store.gemini = {
      activeKey: legacyKey,
      previousKey: store.previousKey || '',
      status: store.status === 'DISABLED' ? 'DISABLED' : (legacyKey ? 'ENABLED' : 'DISABLED'),
      model: store.model || 'gemini-2.5-flash',
      keyMasked: maskApiKey(legacyKey),
      lastTestedAt: store.lastTestedAt || null,
      lastRotatedAt: store.lastRotatedAt || null
    };
    changed = true;
  }

  if (!store.openrouter) {
    let openrouterKey = '';
    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== '') {
      openrouterKey = process.env.OPENROUTER_API_KEY.trim();
    } else if (fs.existsSync(OPENROUTER_TXT_KEY_PATH)) {
      try { openrouterKey = fs.readFileSync(OPENROUTER_TXT_KEY_PATH, 'utf8').trim(); } catch (e) {}
    }

    store.openrouter = {
      activeKey: openrouterKey,
      previousKey: '',
      status: openrouterKey ? 'ENABLED' : 'DISABLED',
      model: 'google/gemini-2.5-flash:free',
      keyMasked: maskApiKey(openrouterKey),
      tier: 'Free / Paid',
      lastTestedAt: openrouterKey ? new Date().toISOString() : null,
      lastRotatedAt: openrouterKey ? new Date().toISOString() : null
    };
    changed = true;
  }

  if (changed) {
    saveSecretStoreData(store);
  }

  return store;
}

/**
 * Saves store data while preserving legacy root fields for backwards compatibility
 */
function saveSecretStoreData(storeData) {
  if (!fs.existsSync(SECRETS_DIR)) {
    try { fs.mkdirSync(SECRETS_DIR, { recursive: true }); } catch (err) {}
  }

  // Maintain legacy top-level attributes for backwards compatibility
  const geminiKey = storeData.gemini?.activeKey || '';
  storeData.activeKey = geminiKey;
  storeData.previousKey = storeData.gemini?.previousKey || '';
  storeData.status = storeData.gemini?.status || 'DISABLED';
  storeData.provider = 'Google Gemini';
  storeData.model = storeData.gemini?.model || 'gemini-2.5-flash';
  storeData.keyMasked = maskApiKey(geminiKey);

  try {
    fs.writeFileSync(SECRET_STORE_PATH, JSON.stringify(storeData, null, 2), 'utf8');
    if (geminiKey) {
      fs.writeFileSync(TXT_KEY_PATH, geminiKey, 'utf8');
    }
    if (storeData.openrouter?.activeKey) {
      fs.writeFileSync(OPENROUTER_TXT_KEY_PATH, storeData.openrouter.activeKey, 'utf8');
    }
  } catch (e) {}
}

/**
 * Ensures secrets directory and store file exist
 */
function ensureSecretStore() {
  if (!fs.existsSync(SECRETS_DIR)) {
    try { fs.mkdirSync(SECRETS_DIR, { recursive: true }); } catch (err) {}
  }

  if (!fs.existsSync(SECRET_STORE_PATH)) {
    let initialGeminiKey = '';
    if (fs.existsSync(TXT_KEY_PATH)) {
      try { initialGeminiKey = fs.readFileSync(TXT_KEY_PATH, 'utf8').trim(); } catch (e) {}
    }
    let initialOpenRouterKey = '';
    if (fs.existsSync(OPENROUTER_TXT_KEY_PATH)) {
      try { initialOpenRouterKey = fs.readFileSync(OPENROUTER_TXT_KEY_PATH, 'utf8').trim(); } catch (e) {}
    }

    const initialStore = {
      primaryProvider: 'gemini',
      fallbackProvider: 'none',
      activeKey: initialGeminiKey,
      status: initialGeminiKey ? 'ENABLED' : 'DISABLED',
      provider: 'Google Gemini',
      model: 'gemini-2.5-flash',
      keyMasked: maskApiKey(initialGeminiKey),
      gemini: {
        activeKey: initialGeminiKey,
        previousKey: '',
        status: initialGeminiKey ? 'ENABLED' : 'DISABLED',
        model: 'gemini-2.5-flash',
        keyMasked: maskApiKey(initialGeminiKey),
        lastTestedAt: initialGeminiKey ? new Date().toISOString() : null,
        lastRotatedAt: initialGeminiKey ? new Date().toISOString() : null
      },
      openrouter: {
        activeKey: initialOpenRouterKey,
        previousKey: '',
        status: initialOpenRouterKey ? 'ENABLED' : 'DISABLED',
        model: 'google/gemini-2.5-flash:free',
        keyMasked: maskApiKey(initialOpenRouterKey),
        tier: 'Free / Paid',
        lastTestedAt: initialOpenRouterKey ? new Date().toISOString() : null,
        lastRotatedAt: initialOpenRouterKey ? new Date().toISOString() : null
      }
    };

    try {
      fs.writeFileSync(SECRET_STORE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    } catch (e) {}
  }
}

/**
 * Retrieves current active Gemini API Key
 */
function getActiveGeminiKey() {
  const store = getSecretStoreData();
  if (store.gemini && store.gemini.status !== 'DISABLED' && store.gemini.activeKey) {
    return store.gemini.activeKey.trim();
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
 * Retrieves current active OpenRouter API Key
 */
function getActiveOpenRouterKey() {
  const store = getSecretStoreData();
  if (store.openrouter && store.openrouter.status !== 'DISABLED' && store.openrouter.activeKey) {
    return store.openrouter.activeKey.trim();
  }
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== '') {
    return process.env.OPENROUTER_API_KEY.trim();
  }
  if (fs.existsSync(OPENROUTER_TXT_KEY_PATH)) {
    try {
      const key = fs.readFileSync(OPENROUTER_TXT_KEY_PATH, 'utf8').trim();
      if (key) return key;
    } catch (e) {}
  }
  return null;
}

/**
 * Returns Primary Provider ('gemini' | 'openrouter')
 */
function getPrimaryProvider() {
  const store = getSecretStoreData();
  return store.primaryProvider || 'gemini';
}

/**
 * Returns Fallback Provider ('none' | 'gemini' | 'openrouter')
 */
function getFallbackProvider() {
  const store = getSecretStoreData();
  return store.fallbackProvider || 'none';
}

/**
 * Updates Primary and Fallback Provider settings
 */
function setProviderRouting({ primaryProvider, fallbackProvider }, actorId = 'superadmin') {
  const store = getSecretStoreData();
  if (primaryProvider && ['gemini', 'openrouter'].includes(primaryProvider)) {
    store.primaryProvider = primaryProvider;
  }
  if (fallbackProvider && ['none', 'gemini', 'openrouter'].includes(fallbackProvider)) {
    store.fallbackProvider = fallbackProvider;
  }
  store.lastRoutingChangedAt = new Date().toISOString();
  store.routingChangedBy = actorId;
  saveSecretStoreData(store);
  return {
    success: true,
    primaryProvider: store.primaryProvider,
    fallbackProvider: store.fallbackProvider,
    message: 'تم تحديث مزود الذكاء الاصطناعي الرئيسي والمزود الاحتياطي بنجاح'
  };
}

/**
 * Tests live connection to Google Gemini API
 */
async function testGeminiKeyConnection(candidateKey, modelOverride = null) {
  const keyToTest = candidateKey || getActiveGeminiKey();
  if (!keyToTest || typeof keyToTest !== 'string' || keyToTest.trim() === '') {
    return {
      success: false,
      status: 'FAILED',
      reason: 'MISSING_API_KEY',
      message: 'لم يتم تزويد مفتاح Google Gemini API للاختبار'
    };
  }

  try {
    const fetch = globalThis.fetch || require('node-fetch');
    const store = getSecretStoreData();
    const modelName = modelOverride || store.gemini?.model || 'gemini-2.5-flash';
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
        status: 'CONNECTED',
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
      message: `فشل الاتصال بـ Gemini: HTTP ${res.status} - ${safeErr.substring(0, 100)}`
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
 * Tests live connection to OpenRouter API
 */
async function testOpenRouterKeyConnection(candidateKey, modelOverride = null) {
  const keyToTest = candidateKey || getActiveOpenRouterKey();
  if (!keyToTest || typeof keyToTest !== 'string' || keyToTest.trim() === '') {
    return {
      success: false,
      status: 'FAILED',
      reason: 'MISSING_API_KEY',
      message: 'لم يتم تزويد مفتاح OpenRouter API للاختبار'
    };
  }

  try {
    const fetch = globalThis.fetch || require('node-fetch');
    const store = getSecretStoreData();
    const modelName = modelOverride || store.openrouter?.model || 'google/gemini-2.5-flash:free';
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const payload = {
      model: modelName,
      messages: [{ role: 'user', content: 'اختبار الاتصال بـ OpenRouter.' }],
      max_tokens: 20
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToTest.trim()}`,
        'HTTP-Referer': 'https://remas-saas.edu',
        'X-Title': 'Remas Educational SaaS'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok || res.status === 429) {
      return {
        success: true,
        status: 'CONNECTED',
        model: modelName,
        provider: 'OpenRouter',
        rateLimited: res.status === 429,
        message: res.status === 429
          ? 'تم التحقق من صحة مفتاح OpenRouter API بنجاح (المفتاح مقبول وساري)'
          : `تم الاتصال بنجاح بمزود OpenRouter (${modelName})`
      };
    }

    const rawErr = await res.text();
    const safeErr = rawErr.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
    return {
      success: false,
      status: 'FAILED',
      reason: `HTTP_${res.status}`,
      message: `فشل الاتصال بـ OpenRouter: HTTP ${res.status} - ${safeErr.substring(0, 100)}`
    };
  } catch (err) {
    const safeMsg = (err.message || '').replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
    return {
      success: false,
      status: 'FAILED',
      reason: 'NETWORK_ERROR',
      message: `خطأ في الاتصال بالشبكة مع OpenRouter: ${safeMsg}`
    };
  }
}

/**
 * Safe Zero-Downtime Key Rotation for Google Gemini
 */
async function rotateGeminiKey(newCandidateKey, actorId = 'superadmin') {
  if (!newCandidateKey || typeof newCandidateKey !== 'string' || newCandidateKey.trim() === '') {
    return {
      success: false,
      status: 'INVALID_INPUT',
      message: 'الرجاء تزويد نص المفتاح الجديد المراد اختباره وتفعيله.',
      activeKeyPreserved: true
    };
  }

  const trimmedKey = newCandidateKey.trim();
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

  const store = getSecretStoreData();
  const oldKey = store.gemini.activeKey || '';
  const nowISO = new Date().toISOString();

  store.gemini.previousKey = oldKey;
  store.gemini.activeKey = trimmedKey;
  store.gemini.status = 'ENABLED';
  store.gemini.lastTestedAt = nowISO;
  store.gemini.lastRotatedAt = nowISO;
  store.gemini.keyMasked = maskApiKey(trimmedKey);
  store.gemini.lastRotatedBy = actorId;

  saveSecretStoreData(store);

  return {
    success: true,
    status: 'ROTATION_SUCCESSFUL',
    message: 'تم تفعيل واستبدال مفتاح Gemini API بنجاح.',
    keyMasked: store.gemini.keyMasked,
    activeKeyPreserved: false
  };
}

/**
 * Safe Zero-Downtime Key Rotation for OpenRouter
 */
async function rotateOpenRouterKey(newCandidateKey, model = null, actorId = 'superadmin') {
  if (!newCandidateKey || typeof newCandidateKey !== 'string' || newCandidateKey.trim() === '') {
    return {
      success: false,
      status: 'INVALID_INPUT',
      message: 'الرجاء تزويد نص مفتاح OpenRouter الجديد المراد اختباره وتفعيله.',
      activeKeyPreserved: true
    };
  }

  const trimmedKey = newCandidateKey.trim();
  const testRes = await testOpenRouterKeyConnection(trimmedKey, model);
  if (!testRes.success) {
    return {
      success: false,
      status: 'ROTATION_FAILED_INVALID_KEY',
      testError: testRes.message,
      message: 'فشل اختبار مفتاح OpenRouter الجديد. تم الإبقاء على المفتاح الحالي الفعال بدون أي انقطاع.',
      activeKeyPreserved: true
    };
  }

  const store = getSecretStoreData();
  const oldKey = store.openrouter.activeKey || '';
  const nowISO = new Date().toISOString();

  store.openrouter.previousKey = oldKey;
  store.openrouter.activeKey = trimmedKey;
  store.openrouter.status = 'ENABLED';
  if (model) store.openrouter.model = model;
  store.openrouter.lastTestedAt = nowISO;
  store.openrouter.lastRotatedAt = nowISO;
  store.openrouter.keyMasked = maskApiKey(trimmedKey);
  store.openrouter.lastRotatedBy = actorId;

  saveSecretStoreData(store);

  return {
    success: true,
    status: 'ROTATION_SUCCESSFUL',
    message: 'تم تفعيل واستبدال مفتاح OpenRouter API بنجاح.',
    keyMasked: store.openrouter.keyMasked,
    activeKeyPreserved: false
  };
}

/**
 * Disables AI Provider (Gemini, OpenRouter, or All)
 */
function disableAI(provider = 'all', actorId = 'superadmin') {
  const store = getSecretStoreData();
  const nowISO = new Date().toISOString();

  if (provider === 'gemini' || provider === 'all') {
    store.gemini.status = 'DISABLED';
    store.gemini.lastDisabledAt = nowISO;
  }
  if (provider === 'openrouter' || provider === 'all') {
    store.openrouter.status = 'DISABLED';
    store.openrouter.lastDisabledAt = nowISO;
  }

  saveSecretStoreData(store);
  return {
    success: true,
    status: 'AI_DISABLED',
    message: `تم تعطيل مزود الذكاء الاصطناعي (${provider}) بنجاح`
  };
}

function disableGeminiAI(actorId = 'superadmin') {
  return disableAI('gemini', actorId);
}

function disableOpenRouterAI(actorId = 'superadmin') {
  return disableAI('openrouter', actorId);
}

/**
 * Enables AI Provider (Gemini, OpenRouter, or All)
 */
function enableAI(provider = 'all', actorId = 'superadmin') {
  const store = getSecretStoreData();
  const nowISO = new Date().toISOString();

  let enabledAny = false;
  if (provider === 'gemini' || provider === 'all') {
    if (store.gemini.activeKey) {
      store.gemini.status = 'ENABLED';
      store.gemini.lastEnabledAt = nowISO;
      enabledAny = true;
    }
  }
  if (provider === 'openrouter' || provider === 'all') {
    if (store.openrouter.activeKey) {
      store.openrouter.status = 'ENABLED';
      store.openrouter.lastEnabledAt = nowISO;
      enabledAny = true;
    }
  }

  if (!enabledAny) {
    return {
      success: false,
      status: 'NO_KEY_CONFIGURED',
      message: 'تعذر التفعيل: لا يوجد مفتاح فعال مخزن للمزود المحدد.'
    };
  }

  saveSecretStoreData(store);
  return {
    success: true,
    status: 'AI_ENABLED',
    message: `تم تفعيل مزود الذكاء الاصطناعي (${provider}) بنجاح`
  };
}

function enableGeminiAI(actorId = 'superadmin') {
  return enableAI('gemini', actorId);
}

function enableOpenRouterAI(actorId = 'superadmin') {
  return enableAI('openrouter', actorId);
}

/**
 * Updates Provider Model
 */
function setProviderModel(provider, model, actorId = 'superadmin') {
  const store = getSecretStoreData();
  if (provider === 'gemini') {
    store.gemini.model = model || 'gemini-2.5-flash';
  } else if (provider === 'openrouter') {
    store.openrouter.model = model || 'google/gemini-2.5-flash:free';
  }
  saveSecretStoreData(store);
  return {
    success: true,
    provider,
    model: provider === 'gemini' ? store.gemini.model : store.openrouter.model,
    message: `تم تحديث نموذج ${provider} بنجاح`
  };
}

/**
 * Returns safe metadata representation for Multi-Provider UI Console (NO raw secrets!)
 */
function getAISettingsMetadata() {
  const store = getSecretStoreData();

  const geminiActiveKey = getActiveGeminiKey();
  const geminiStatus = store.gemini.status === 'DISABLED' ? 'DISABLED' : (geminiActiveKey ? 'ENABLED' : 'ERROR');

  const openrouterActiveKey = getActiveOpenRouterKey();
  const openrouterStatus = store.openrouter.status === 'DISABLED' ? 'DISABLED' : (openrouterActiveKey ? 'ENABLED' : 'ERROR');

  return {
    primaryProvider: store.primaryProvider || 'gemini',
    fallbackProvider: store.fallbackProvider || 'none',
    status: store.status === 'DISABLED' ? 'DISABLED' : (geminiStatus === 'ENABLED' || openrouterStatus === 'ENABLED' ? 'ENABLED' : 'ERROR'),
    provider: 'Google Gemini', // Legacy field
    model: store.gemini.model || 'gemini-2.5-flash', // Legacy field
    keyMasked: maskApiKey(geminiActiveKey), // Legacy field
    hasActiveKey: !!(geminiActiveKey || openrouterActiveKey),
    gemini: {
      status: geminiStatus,
      provider: 'Google Gemini',
      model: store.gemini.model || 'gemini-2.5-flash',
      keyMasked: maskApiKey(geminiActiveKey),
      hasActiveKey: !!geminiActiveKey,
      lastTestedAt: store.gemini.lastTestedAt || null,
      lastRotatedAt: store.gemini.lastRotatedAt || null
    },
    openrouter: {
      status: openrouterStatus,
      provider: 'OpenRouter',
      model: store.openrouter.model || 'google/gemini-2.5-flash:free',
      keyMasked: maskApiKey(openrouterActiveKey),
      hasActiveKey: !!openrouterActiveKey,
      tier: openrouterActiveKey ? (store.openrouter.model.includes(':free') ? 'Free Tier' : 'Paid Tier') : 'Not Configured',
      lastTestedAt: store.openrouter.lastTestedAt || null,
      lastRotatedAt: store.openrouter.lastRotatedAt || null
    }
  };
}

/**
 * Checks whether AI system is globally disabled by SuperAdmin
 */
function isAIDisabledGlobally() {
  const store = getSecretStoreData();
  const geminiActive = store.gemini.status === 'ENABLED' && getActiveGeminiKey();
  const openrouterActive = store.openrouter.status === 'ENABLED' && getActiveOpenRouterKey();
  return !geminiActive && !openrouterActive;
}

module.exports = {
  maskApiKey,
  getActiveGeminiKey,
  getActiveOpenRouterKey,
  getPrimaryProvider,
  getFallbackProvider,
  setProviderRouting,
  isAIDisabledGlobally,
  testGeminiKeyConnection,
  testOpenRouterKeyConnection,
  rotateGeminiKey,
  rotateOpenRouterKey,
  disableAI,
  disableGeminiAI,
  disableOpenRouterAI,
  enableAI,
  enableGeminiAI,
  enableOpenRouterAI,
  setProviderModel,
  getAISettingsMetadata,
  getSecretStoreData
};
