/**
 * REMAS EDU — Dynamic Theme Engine & Validation System
 * 
 * Provides color validation, asset validation, theme token resolution,
 * fallback logic to REMAS Platform Tokens, and cache invalidation.
 */

const { REMAS_PLATFORM_BRAND } = require('./brand_tokens');

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6})$/;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const themeCache = new Map();

/**
 * Validates a color string to ensure it is a strict 6-digit hex code (#RRGGBB).
 * Throws an error on invalid or malicious color strings.
 */
function validateHexColor(color, fieldName = 'Color') {
  if (!color || typeof color !== 'string') {
    throw new Error(`INVALID_COLOR_FORMAT: ${fieldName} must be a string`);
  }
  const trimmed = color.trim().toUpperCase();
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    throw new Error(`INVALID_COLOR_FORMAT: ${fieldName} must be a valid #RRGGBB hex color code (e.g. #0F172A)`);
  }
  return trimmed;
}

/**
 * Validates asset metadata before upload or metadata storage.
 * Rejects non-image formats (HTML, JS, EXE, APK, unsanitized SVG).
 */
function validateAssetMetadata(fileMeta) {
  if (!fileMeta || typeof fileMeta !== 'object') {
    throw new Error('INVALID_ASSET_METADATA: Asset metadata is required');
  }

  const { fileName, mimeType, sizeBytes } = fileMeta;

  if (!fileName || typeof fileName !== 'string') {
    throw new Error('INVALID_ASSET_METADATA: fileName is required');
  }

  const extIndex = fileName.lastIndexOf('.');
  const ext = extIndex !== -1 ? fileName.substring(extIndex).toLowerCase() : '';

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`DISALLOWED_ASSET_EXTENSION: Extension ${ext} is not allowed. Must be .png, .jpg, .jpeg, or .webp`);
  }

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(`DISALLOWED_ASSET_MIME: MIME type ${mimeType} is not allowed. Must be image/png, image/jpeg, or image/webp`);
  }

  if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > MAX_ASSET_SIZE_BYTES) {
    throw new Error(`ASSET_SIZE_EXCEEDED: Asset size must be greater than 0 and less than ${MAX_ASSET_SIZE_BYTES / (1024 * 1024)} MB`);
  }

  return {
    valid: true,
    fileName,
    mimeType: mimeType.toLowerCase(),
    extension: ext,
    sizeBytes
  };
}

/**
 * Resolves full branding theme for an institution by merging institution-specific overrides
 * with REMAS EDU Platform default tokens.
 */
function resolveInstitutionTheme(institutionBranding = {}) {
  const primary = institutionBranding.primaryColor 
    ? validateHexColor(institutionBranding.primaryColor, 'primaryColor')
    : REMAS_PLATFORM_BRAND.colors.primary;

  const secondary = institutionBranding.secondaryColor 
    ? validateHexColor(institutionBranding.secondaryColor, 'secondaryColor')
    : REMAS_PLATFORM_BRAND.colors.secondary;

  const accent = institutionBranding.accentColor 
    ? validateHexColor(institutionBranding.accentColor, 'accentColor')
    : REMAS_PLATFORM_BRAND.colors.accent;

  const backgroundColor = institutionBranding.backgroundColor 
    ? validateHexColor(institutionBranding.backgroundColor, 'backgroundColor')
    : REMAS_PLATFORM_BRAND.colors.neutral;

  return {
    platformBrand: REMAS_PLATFORM_BRAND,
    centerName: institutionBranding.centerName || 'مركز تعليمي معتمد',
    logoUrl: institutionBranding.logoUrl || null,
    watermarkUrl: institutionBranding.watermarkUrl || null,
    logoAssetId: institutionBranding.logoAssetId || null,
    watermarkAssetId: institutionBranding.watermarkAssetId || null,
    loginTitle: institutionBranding.loginTitle || `مرحباً بكم في ${institutionBranding.centerName || 'المركز التعليمي'}`,
    loginSubtitle: institutionBranding.loginSubtitle || 'منظومة المتابعة والإدارة التعليمية',
    welcomeMessage: institutionBranding.welcomeMessage || 'أهلاً بكم في منصتنا التعليمية',
    colors: {
      primary,
      secondary,
      accent,
      backgroundColor,
      supporting: REMAS_PLATFORM_BRAND.colors.supporting,
      neutral: REMAS_PLATFORM_BRAND.colors.neutral,
      darkBackground: REMAS_PLATFORM_BRAND.colors.darkBackground
    },
    updatedAt: institutionBranding.updatedAt || new Date().toISOString(),
    updatedBy: institutionBranding.updatedBy || 'system'
  };
}

/**
 * Cached Theme Fetcher
 */
async function getThemeWithCache(institutionId, fetcherFn) {
  if (themeCache.has(institutionId)) {
    return themeCache.get(institutionId);
  }
  const rawBranding = await fetcherFn(institutionId);
  const resolved = resolveInstitutionTheme(rawBranding);
  themeCache.set(institutionId, resolved);
  return resolved;
}

/**
 * Invalidates cache entry for a specific institution
 */
function invalidateBrandingCache(institutionId) {
  themeCache.delete(institutionId);
}

/**
 * Clears all cached themes
 */
function clearAllBrandingCache() {
  themeCache.clear();
}

module.exports = {
  validateHexColor,
  validateAssetMetadata,
  resolveInstitutionTheme,
  getThemeWithCache,
  invalidateBrandingCache,
  clearAllBrandingCache
};
