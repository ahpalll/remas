/**
 * REMAS EDU — Official Central Brand Tokens & Constants
 * 
 * Defines the immutable REMAS EDU Platform Identity and theme tokens.
 */

const REMAS_PLATFORM_BRAND = Object.freeze({
  nameEnglish: 'REMAS EDU',
  nameArabic: 'رِماس للتقنية التعليمية',
  taglineArabic: 'إدارة أذكى.. تعليم أفضل',
  taglineEnglish: 'SMARTER MANAGEMENT .. A BRIGHTER EDUCATION',
  descriptionEnglish: 'REMAS Educational Platform',
  version: '1.0.0-release.39',
  
  // Official Brand Palette
  colors: Object.freeze({
    primary: '#0F172A',      // Deep Navy Blue
    secondary: '#0284C7',    // Bright / Cyan Blue
    accent: '#D97706',       // Gold
    supporting: '#E0F2FE',   // Light Blue
    neutral: '#FFFFFF',      // White
    darkBackground: '#0A192F'// Deep Blue / Navy
  }),

  // Required Brand Asset File Identifiers
  requiredAssetIdentifiers: Object.freeze([
    'remas_logo_primary',
    'remas_logo_horizontal',
    'remas_logo_arabic',
    'remas_icon',
    'remas_splash_logo',
    'remas_app_icon'
  ])
});

module.exports = {
  REMAS_PLATFORM_BRAND
};
