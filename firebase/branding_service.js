/**
 * REMAS EDU — Server-Authoritative Branding Service
 * 
 * Handles Firestore branding storage, Cloudflare R2 secure media asset uploads,
 * tenant isolation enforcement, SuperAdmin platform overrides, and audit logging.
 */

const { REMAS_PLATFORM_BRAND } = require('./brand_tokens');
const { 
  validateHexColor, 
  validateAssetMetadata, 
  resolveInstitutionTheme, 
  invalidateBrandingCache 
} = require('./brand_theme_engine');

// In-Memory Storage for Tests & Server Service Instance
const brandingStore = new Map();
const platformBrandingStore = {
  ...REMAS_PLATFORM_BRAND
};
const auditLogStore = [];

function resetBrandingStore() {
  brandingStore.clear();
  auditLogStore.length = 0;
}

/**
 * Validates identity token and institution authorization
 */
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
    return; // SuperAdmin can access any institution
  }

  if (callerToken.institutionId !== targetInstitutionId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot access or modify branding of another institution');
  }

  if (callerToken.role !== 'institutionOwner' && callerToken.role !== 'centerAdmin') {
    throw new Error('UNAUTHORIZED_ROLE: Institution Owner or Admin authority is required');
  }
}

/**
 * Retrieves branding metadata for an institution
 */
async function getInstitutionBranding(institutionId, callerToken = null) {
  if (!institutionId) {
    throw new Error('INVALID_ARGUMENT: institutionId is required');
  }

  // If caller token is provided, verify tenant scope (optional for public splash if allowed, but strict for updates)
  if (callerToken && callerToken.role !== 'superAdmin' && callerToken.institutionId !== institutionId) {
    throw new Error('CROSS_TENANT_VIOLATION: Cannot view branding of another institution');
  }

  const rawBranding = brandingStore.get(institutionId) || {
    institutionId,
    centerName: 'مركز تعليمي معتمد',
    primaryColor: REMAS_PLATFORM_BRAND.colors.primary,
    secondaryColor: REMAS_PLATFORM_BRAND.colors.secondary,
    accentColor: REMAS_PLATFORM_BRAND.colors.accent,
    backgroundColor: REMAS_PLATFORM_BRAND.colors.neutral
  };

  return resolveInstitutionTheme(rawBranding);
}

/**
 * Updates institution branding metadata
 */
async function updateInstitutionBranding(institutionId, brandingData = {}, callerToken) {
  if (!institutionId) {
    throw new Error('INVALID_ARGUMENT: institutionId is required');
  }

  assertBrandingAuthority(callerToken, institutionId, false);

  const existing = brandingStore.get(institutionId) || { institutionId };

  // Validate colors if provided
  const primaryColor = brandingData.primaryColor ? validateHexColor(brandingData.primaryColor, 'primaryColor') : (existing.primaryColor || REMAS_PLATFORM_BRAND.colors.primary);
  const secondaryColor = brandingData.secondaryColor ? validateHexColor(brandingData.secondaryColor, 'secondaryColor') : (existing.secondaryColor || REMAS_PLATFORM_BRAND.colors.secondary);
  const accentColor = brandingData.accentColor ? validateHexColor(brandingData.accentColor, 'accentColor') : (existing.accentColor || REMAS_PLATFORM_BRAND.colors.accent);
  const backgroundColor = brandingData.backgroundColor ? validateHexColor(brandingData.backgroundColor, 'backgroundColor') : (existing.backgroundColor || REMAS_PLATFORM_BRAND.colors.neutral);

  const updatedBranding = {
    ...existing,
    institutionId,
    centerName: brandingData.centerName ? brandingData.centerName.trim() : (existing.centerName || 'مركز تعليمي معتمد'),
    logoAssetId: brandingData.logoAssetId !== undefined ? brandingData.logoAssetId : existing.logoAssetId,
    watermarkAssetId: brandingData.watermarkAssetId !== undefined ? brandingData.watermarkAssetId : existing.watermarkAssetId,
    logoUrl: brandingData.logoUrl !== undefined ? brandingData.logoUrl : existing.logoUrl,
    watermarkUrl: brandingData.watermarkUrl !== undefined ? brandingData.watermarkUrl : existing.watermarkUrl,
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    loginTitle: brandingData.loginTitle ? brandingData.loginTitle.trim() : existing.loginTitle,
    loginSubtitle: brandingData.loginSubtitle ? brandingData.loginSubtitle.trim() : existing.loginSubtitle,
    welcomeMessage: brandingData.welcomeMessage ? brandingData.welcomeMessage.trim() : existing.welcomeMessage,
    updatedAt: new Date().toISOString(),
    updatedBy: callerToken.uid
  };

  brandingStore.set(institutionId, updatedBranding);
  invalidateBrandingCache(institutionId);

  // Record Audit Event
  auditLogStore.push({
    eventType: 'UPDATE_INSTITUTION_BRANDING',
    institutionId,
    actorId: callerToken.uid,
    timestamp: new Date().toISOString(),
    details: { centerName: updatedBranding.centerName }
  });

  return resolveInstitutionTheme(updatedBranding);
}

/**
 * Resets an institution's branding to REMAS Platform Defaults (SuperAdmin only)
 */
async function resetInstitutionBranding(institutionId, callerToken) {
  assertBrandingAuthority(callerToken, institutionId, true); // Must be SuperAdmin

  brandingStore.delete(institutionId);
  invalidateBrandingCache(institutionId);

  auditLogStore.push({
    eventType: 'RESET_INSTITUTION_BRANDING',
    institutionId,
    actorId: callerToken.uid,
    timestamp: new Date().toISOString()
  });

  return resolveInstitutionTheme({ institutionId });
}

/**
 * Generates secure media presigned upload URL for branding asset (Cloudflare R2 Gateway)
 */
async function generateBrandingAssetUploadUrl(institutionId, assetType, fileMeta, callerToken) {
  assertBrandingAuthority(callerToken, institutionId, false);

  if (assetType !== 'logo' && assetType !== 'watermark') {
    throw new Error('INVALID_ASSET_TYPE: Asset type must be logo or watermark');
  }

  const validated = validateAssetMetadata(fileMeta);
  const assetId = `r2_brand_${assetType}_${institutionId}_${Date.now()}`;
  const r2Key = `institutions/${institutionId}/branding/${assetId}${validated.extension}`;

  // Presigned URL generation simulating Cloudflare R2 private signed gateway URL
  const uploadUrl = `https://r2-gateway.educenter-saas.com/upload/${r2Key}?token=signed_upload_${Date.now()}`;
  const publicAccessUrl = `https://r2-gateway.educenter-saas.com/media/${r2Key}?token=signed_read_${Date.now()}`;

  return {
    assetId,
    r2Key,
    uploadUrl,
    publicAccessUrl,
    expiresInSeconds: 900 // 15-minute presigned expiry
  };
}

/**
 * SuperAdmin Platform Default Branding Fetcher
 */
async function getPlatformBranding(callerToken = null) {
  return { ...platformBrandingStore };
}

/**
 * SuperAdmin Platform Default Branding Update
 */
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
