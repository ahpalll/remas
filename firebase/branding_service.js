/**
 * REMAS EDU — Server-Authoritative Branding Service
 * Phase 39 — Cloud Firestore Sole Source of Truth for Branding
 * 
 * Handles Firestore branding storage under institutions/{institutionId},
 * Cloudflare R2 secure media asset uploads, tenant isolation enforcement,
 * SuperAdmin platform overrides, and audit logging.
 */

const path = require('path');
const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const { REMAS_PLATFORM_BRAND } = require('./brand_tokens');
const { 
  validateHexColor, 
  validateAssetMetadata, 
  resolveInstitutionTheme, 
  invalidateBrandingCache 
} = require('./brand_theme_engine');

const auditLogStore = [];

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyA_placeholder_key',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'educenter-saas-860c5.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'educenter-saas-860c5',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'educenter-saas-860c5.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: process.env.FIREBASE_APP_ID || '1:1234567890:web:abcdef123456'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

let testEnvPromise = null;
function getTestEnv() {
  if (!testEnvPromise) {
    const rulesEnv = require('@firebase/rules-unit-testing');
    const rulesPath = path.resolve(__dirname, 'firestore.rules');
    const fs = require('fs');
    let rulesContent = null;
    if (fs.existsSync(rulesPath)) {
      rulesContent = fs.readFileSync(rulesPath, 'utf8');
    }
    testEnvPromise = rulesEnv.initializeTestEnvironment({
      projectId: 'educenter-saas-860c5',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: rulesContent
      }
    });
  }
  return testEnvPromise;
}

const authContextMap = new Map();

async function getClientFirestoreDb(callerToken) {
  if ((process.env.NODE_ENV === 'test' || process.env.USE_FIRESTORE_EMULATOR === 'true') && process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const testEnv = await getTestEnv();
      if (!callerToken || !callerToken.uid) {
        return testEnv.unauthenticatedContext().firestore();
      }
      const instId = callerToken.institutionId || 'inst_bootstrap_001';
      const role = callerToken.role || 'institutionOwner';
      const uid = callerToken.uid;
      const key = `${uid}_${instId}_${role}`;
      if (!authContextMap.has(key)) {
        authContextMap.set(key, testEnv.authenticatedContext(uid, { institutionId: instId, role }).firestore());
      }
      return authContextMap.get(key);
    } catch (e) {}
  }
  return db;
}

let platformBrandingStore = { ...REMAS_PLATFORM_BRAND };

function resetBrandingStore() {
  auditLogStore.length = 0;
  authContextMap.clear();
  platformBrandingStore = { ...REMAS_PLATFORM_BRAND };
}

function assertBrandingAuthority(callerToken, targetInstitutionId, requireSuperAdmin = false) {
  if (!callerToken || !callerToken.uid) {
    throw new Error('UNAUTHENTICATED_CALLER: Valid authentication token is required');
  }

  if (requireSuperAdmin) {
    if (callerToken.role !== 'superAdmin') {
      throw new Error('UNAUTHORIZED_ROLE: SuperAdmin authority is required');
    }
    return;
  }

  if (callerToken.role === 'superAdmin') {
    return;
  }

  if (callerToken.institutionId !== targetInstitutionId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot access or modify branding of another institution');
  }

  if (callerToken.role !== 'institutionOwner' && callerToken.role !== 'centerAdmin' && callerToken.role !== 'admin') {
    throw new Error('UNAUTHORIZED_ROLE: Institution Owner or Admin authority is required');
  }
}

async function getInstitutionBranding(institutionId, callerToken = null) {
  if (!institutionId) {
    throw new Error('INVALID_ARGUMENT: institutionId is required');
  }

  if (callerToken && callerToken.role !== 'superAdmin' && callerToken.institutionId !== institutionId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot view branding of another institution');
  }

  try {
    const clientDb = await getClientFirestoreDb(callerToken);
    const instRef = doc(clientDb, 'institutions', institutionId);
    const snap = await getDoc(instRef);

    if (snap.exists()) {
      const data = snap.data();
      const rawBranding = data.branding || data;
      return resolveInstitutionTheme(rawBranding);
    }
  } catch (err) {
    return resolveInstitutionTheme(null);
  }

  return resolveInstitutionTheme(null);
}

async function updateInstitutionBranding(institutionId, brandingData = {}, callerToken) {
  if (!institutionId) {
    throw new Error('INVALID_ARGUMENT: institutionId is required');
  }

  assertBrandingAuthority(callerToken, institutionId, false);

  const clientDb = await getClientFirestoreDb(callerToken);
  const instRef = doc(clientDb, 'institutions', institutionId);
  const snap = await getDoc(instRef);

  let existingBranding = {};
  if (snap.exists()) {
    const data = snap.data();
    existingBranding = data.branding || data;
  }

  const primaryColor = brandingData.primaryColor ? validateHexColor(brandingData.primaryColor, 'primaryColor') : (existingBranding.primaryColor || REMAS_PLATFORM_BRAND.colors.primary);
  const secondaryColor = brandingData.secondaryColor ? validateHexColor(brandingData.secondaryColor, 'secondaryColor') : (existingBranding.secondaryColor || REMAS_PLATFORM_BRAND.colors.secondary);
  const accentColor = brandingData.accentColor ? validateHexColor(brandingData.accentColor, 'accentColor') : (existingBranding.accentColor || REMAS_PLATFORM_BRAND.colors.accent);
  const backgroundColor = brandingData.backgroundColor ? validateHexColor(brandingData.backgroundColor, 'backgroundColor') : (existingBranding.backgroundColor || REMAS_PLATFORM_BRAND.colors.neutral);

  const updatedBranding = {
    institutionId,
    centerName: brandingData.centerName ? brandingData.centerName.trim() : (existingBranding.centerName || 'مركز تعليمي معتمد'),
    logoAssetId: (brandingData.logoAssetId !== undefined ? brandingData.logoAssetId : existingBranding.logoAssetId) || null,
    watermarkAssetId: (brandingData.watermarkAssetId !== undefined ? brandingData.watermarkAssetId : existingBranding.watermarkAssetId) || null,
    logoUrl: (brandingData.logoUrl !== undefined ? brandingData.logoUrl : existingBranding.logoUrl) || null,
    watermarkUrl: (brandingData.watermarkUrl !== undefined ? brandingData.watermarkUrl : existingBranding.watermarkUrl) || null,
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    loginTitle: brandingData.loginTitle ? brandingData.loginTitle.trim() : (existingBranding.loginTitle || 'مرحباً بكم'),
    loginSubtitle: brandingData.loginSubtitle ? brandingData.loginSubtitle.trim() : (existingBranding.loginSubtitle || 'منظومة المتابعة التعليمية'),
    welcomeMessage: brandingData.welcomeMessage ? brandingData.welcomeMessage.trim() : (existingBranding.welcomeMessage || 'إدارة أذكى.. تعليم أفضل'),
    updatedAt: new Date().toISOString(),
    updatedBy: callerToken.uid
  };

  if (!snap.exists()) {
    await setDoc(instRef, {
      id: institutionId,
      institutionId,
      name: updatedBranding.centerName || 'مركز تعليمي معتمد',
      status: 'ACTIVE',
      createdBy: callerToken.uid,
      createdAt: new Date().toISOString(),
      updatedBy: callerToken.uid,
      updatedAt: new Date().toISOString(),
      branding: updatedBranding
    }, { merge: true });
  } else {
    await setDoc(instRef, {
      branding: updatedBranding,
      updatedBy: callerToken.uid,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  invalidateBrandingCache(institutionId);

  auditLogStore.push({
    eventType: 'UPDATE_INSTITUTION_BRANDING',
    institutionId,
    actorId: callerToken.uid,
    timestamp: new Date().toISOString(),
    details: { centerName: updatedBranding.centerName }
  });

  return resolveInstitutionTheme(updatedBranding);
}

async function resetInstitutionBranding(institutionId, callerToken) {
  assertBrandingAuthority(callerToken, institutionId, true);

  const clientDb = await getClientFirestoreDb(callerToken);
  const instRef = doc(clientDb, 'institutions', institutionId);
  const snap = await getDoc(instRef);

  if (!snap.exists()) {
    await setDoc(instRef, {
      id: institutionId,
      institutionId,
      name: 'مركز تعليمي معتمد',
      status: 'ACTIVE',
      createdBy: callerToken.uid,
      createdAt: new Date().toISOString(),
      updatedBy: callerToken.uid,
      updatedAt: new Date().toISOString(),
      branding: null
    }, { merge: true });
  } else {
    await setDoc(instRef, {
      branding: null,
      updatedBy: callerToken.uid,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  invalidateBrandingCache(institutionId);

  auditLogStore.push({
    eventType: 'RESET_INSTITUTION_BRANDING',
    institutionId,
    actorId: callerToken.uid,
    timestamp: new Date().toISOString()
  });

  return resolveInstitutionTheme({ institutionId });
}

async function generateBrandingAssetUploadUrl(institutionId, assetType, fileMeta, callerToken) {
  assertBrandingAuthority(callerToken, institutionId, false);

  if (assetType !== 'logo' && assetType !== 'watermark') {
    throw new Error('INVALID_ASSET_TYPE: Asset type must be logo or watermark');
  }

  const validated = validateAssetMetadata(fileMeta);
  const assetId = `r2_brand_${assetType}_${institutionId}_${Date.now()}`;
  const r2Key = `institutions/${institutionId}/branding/${assetId}${validated.extension}`;

  const uploadUrl = `https://r2-gateway.educenter-saas.com/upload/${r2Key}?token=signed_upload_${Date.now()}`;
  const publicAccessUrl = `https://r2-gateway.educenter-saas.com/media/${r2Key}?token=signed_read_${Date.now()}`;

  return {
    assetId,
    r2Key,
    uploadUrl,
    publicAccessUrl,
    expiresInSeconds: 900
  };
}

async function getPlatformBranding(callerToken = null) {
  return { ...platformBrandingStore };
}

async function updatePlatformBranding(brandingData, callerToken) {
  if (!callerToken || callerToken.role !== 'superAdmin') {
    throw new Error('UNAUTHORIZED_ROLE: SuperAdmin authority is required to update Platform Branding');
  }
  if (brandingData.taglineArabic) platformBrandingStore.taglineArabic = brandingData.taglineArabic.trim();
  if (brandingData.taglineEnglish) platformBrandingStore.taglineEnglish = brandingData.taglineEnglish.trim();
  return { ...platformBrandingStore };
}

module.exports = {
  resetBrandingStore,
  getInstitutionBranding,
  updateInstitutionBranding,
  resetInstitutionBranding,
  generateBrandingAssetUploadUrl,
  getPlatformBranding,
  updatePlatformBranding,
  auditLogStore
};
