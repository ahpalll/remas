process.env.NODE_ENV = 'test';
process.env.USE_FIRESTORE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { REMAS_PLATFORM_BRAND } = require('./brand_tokens');
const { 
  validateHexColor, 
  validateAssetMetadata, 
  resolveInstitutionTheme, 
  invalidateBrandingCache 
} = require('./brand_theme_engine');
const { 
  resetBrandingStore, 
  getInstitutionBranding, 
  updateInstitutionBranding, 
  resetInstitutionBranding, 
  generateBrandingAssetUploadUrl, 
  getPlatformBranding, 
  updatePlatformBranding 
} = require('./branding_service');
const desktopServices = require('../center-desktop/src/center_desktop_services');

const http = require('http');

function clearEmulatorDb() {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 8080,
      path: '/emulator/v1/projects/educenter-saas-860c5/databases/(default)/documents',
      method: 'DELETE'
    }, () => resolve());
    req.on('error', () => resolve());
    req.end();
  });
}

describe('Phase 39 — REMAS EDU White-Label Branding System Suite', () => {

  const superAdminToken = { uid: 'user_superadmin', role: 'superAdmin', institutionId: 'platform' };
  const centerAOwnerToken = { uid: 'user_owner_a', role: 'institutionOwner', institutionId: 'inst_center_A' };
  const centerBOwnerToken = { uid: 'user_owner_b', role: 'institutionOwner', institutionId: 'inst_center_B' };
  const studentAToken = { uid: 'user_student_a', role: 'student', institutionId: 'inst_center_A' };

  beforeEach(async () => {
    resetBrandingStore();
    await clearEmulatorDb();
    await updateInstitutionBranding('inst_center_A', { centerName: 'مركز ألف' }, superAdminToken);
    await updateInstitutionBranding('inst_center_B', { centerName: 'مركز باء' }, superAdminToken);
  });

  describe('SECTION A — Brand Tokens & Model Standards', () => {

    it('A1. REMAS Platform Brand identity tokens remain immutable & correct', () => {
      assert.equal(REMAS_PLATFORM_BRAND.nameEnglish, 'REMAS EDU');
      assert.equal(REMAS_PLATFORM_BRAND.nameArabic, 'رِماس للتقنية التعليمية');
      assert.equal(REMAS_PLATFORM_BRAND.taglineArabic, 'إدارة أذكى.. تعليم أفضل');
      assert.equal(REMAS_PLATFORM_BRAND.taglineEnglish, 'SMARTER MANAGEMENT .. A BRIGHTER EDUCATION');
      assert.equal(REMAS_PLATFORM_BRAND.colors.primary, '#0F172A');
      assert.equal(REMAS_PLATFORM_BRAND.colors.secondary, '#0284C7');
      assert.equal(REMAS_PLATFORM_BRAND.colors.accent, '#D97706');
    });

    it('A2. Strict #RRGGBB Color validation accepts valid hex and normalizes case', () => {
      assert.equal(validateHexColor('#0f172a', 'primary'), '#0F172A');
      assert.equal(validateHexColor('#38bdf8', 'secondary'), '#38BDF8');
      assert.equal(validateHexColor('#D97706', 'accent'), '#D97706');
    });

    it('A3. Asset metadata validation accepts valid image types (.png, .jpg, .webp)', () => {
      const valid = validateAssetMetadata({
        fileName: 'center_logo.png',
        mimeType: 'image/png',
        sizeBytes: 1024 * 500
      });
      assert.equal(valid.valid, true);
      assert.equal(valid.extension, '.png');
    });
  });

  describe('SECTION B — Branding CRUD Operations & Theme Engine', () => {

    it('B1. Unconfigured center resolves seamlessly to REMAS Platform Default tokens', async () => {
      const theme = await getInstitutionBranding('inst_center_A', centerAOwnerToken);
      assert.equal(theme.platformBrand.nameEnglish, 'REMAS EDU');
      assert.equal(theme.colors.primary, '#0F172A');
      assert.equal(theme.colors.secondary, '#0284C7');
      assert.equal(theme.colors.accent, '#D97706');
    });

    it('B2. Center Owner updates institution branding metadata & updates resolved theme', async () => {
      const updated = await updateInstitutionBranding('inst_center_A', {
        centerName: 'سنتر الأوائل التعليمي',
        primaryColor: '#1E293B',
        secondaryColor: '#0EA5E9',
        accentColor: '#F59E0B',
        loginTitle: 'مرحباً بكم في سنتر الأوائل',
        loginSubtitle: 'منظومة التفوق والنجاح',
        welcomeMessage: 'نتمنى لكم عاماً دراسياً سعيداً'
      }, centerAOwnerToken);

      assert.equal(updated.centerName, 'سنتر الأوائل التعليمي');
      assert.equal(updated.colors.primary, '#1E293B');
      assert.equal(updated.colors.secondary, '#0EA5E9');
      assert.equal(updated.colors.accent, '#F59E0B');
      assert.equal(updated.loginTitle, 'مرحباً بكم في سنتر الأوائل');
    });

    it('B3. Desktop services engine getBranding & updateBranding operate consistently', async () => {
      const initial = await desktopServices.getBranding(centerAOwnerToken, 'inst_center_A');
      assert.ok(initial.colors.primary);

      const saved = await desktopServices.updateBranding(centerAOwnerToken, {
        institutionId: 'inst_center_A',
        centerName: 'سنتر الريادة الحديث',
        primaryColor: '#0A192F',
        accentColor: '#EAB308'
      });

      assert.equal(saved.centerName, 'سنتر الريادة الحديث');
      assert.equal(saved.colors.primary, '#0A192F');
      assert.equal(saved.colors.accent, '#EAB308');

      const reFetched = await desktopServices.getBranding(centerAOwnerToken, 'inst_center_A');
      assert.equal(reFetched.centerName, 'سنتر الريادة الحديث');
    });
  });

  describe('SECTION C — Tenant Isolation & Cross-Tenant Guards', () => {

    it('C1. Center A owner rejected when attempting to read Center B branding via token check', async () => {
      await assert.rejects(
        async () => {
          await getInstitutionBranding('inst_center_B', centerAOwnerToken);
        },
        (err) => err.message.includes('CROSS_TENANT_VIOLATION')
      );
    });

    it('C2. Center A owner rejected when attempting to update Center B branding', async () => {
      await assert.rejects(
        async () => {
          await updateInstitutionBranding('inst_center_B', { centerName: 'اختراق الهوية' }, centerAOwnerToken);
        },
        (err) => err.message.includes('CROSS_TENANT_VIOLATION')
      );
    });

    it('C3. Desktop service rejects cross-tenant branding query', async () => {
      await assert.rejects(
        async () => {
          await desktopServices.getBranding(centerAOwnerToken, 'inst_center_B');
        },
        (err) => err.message.includes('CROSS_TENANT_VIOLATION') || err.code === 'permission-denied' || err.message.includes('permission-denied')
      );
    });
  });

  describe('SECTION D — Security Input Validation & Sanitization', () => {

    it('D1. Reject invalid hex color payload (prevents CSS / HTML injection)', () => {
      assert.throws(
        () => validateHexColor('#0F172A; body{background:red}', 'primaryColor'),
        (err) => err.message.includes('INVALID_COLOR_FORMAT')
      );
      assert.throws(
        () => validateHexColor('red', 'primaryColor'),
        (err) => err.message.includes('INVALID_COLOR_FORMAT')
      );
    });

    it('D2. Reject dangerous file asset metadata (executable content, HTML, JS)', () => {
      assert.throws(
        () => validateAssetMetadata({ fileName: 'malicious.html', mimeType: 'text/html', sizeBytes: 1024 }),
        (err) => err.message.includes('DISALLOWED_ASSET_EXTENSION')
      );
      assert.throws(
        () => validateAssetMetadata({ fileName: 'script.js', mimeType: 'application/javascript', sizeBytes: 1024 }),
        (err) => err.message.includes('DISALLOWED_ASSET_EXTENSION')
      );
      assert.throws(
        () => validateAssetMetadata({ fileName: 'payload.exe', mimeType: 'application/x-msdownload', sizeBytes: 1024 }),
        (err) => err.message.includes('DISALLOWED_ASSET_EXTENSION')
      );
    });

    it('D3. Reject oversized branding asset upload (> 5MB limit)', () => {
      assert.throws(
        () => validateAssetMetadata({ fileName: 'huge_logo.png', mimeType: 'image/png', sizeBytes: 10 * 1024 * 1024 }),
        (err) => err.message.includes('ASSET_SIZE_EXCEEDED')
      );
    });
  });

  describe('SECTION E — Role Authorization & Permission Bounds', () => {

    it('E1. Unauthenticated caller rejected from modifying institution branding', async () => {
      await assert.rejects(
        async () => {
          await updateInstitutionBranding('inst_center_A', { centerName: 'سنتر بدون توثيق' }, null);
        },
        (err) => err.message.includes('UNAUTHENTICATED_CALLER')
      );
    });

    it('E2. Student role caller rejected from modifying institution branding', async () => {
      await assert.rejects(
        async () => {
          await updateInstitutionBranding('inst_center_A', { centerName: 'تعديل طالب' }, studentAToken);
        },
        (err) => err.message.includes('UNAUTHORIZED_ROLE')
      );
    });

    it('E3. Center Owner prohibited from modifying global REMAS Platform Branding', async () => {
      await assert.rejects(
        async () => {
          await updatePlatformBranding({ taglineArabic: 'تعديل سنتر' }, centerAOwnerToken);
        },
        (err) => err.message.includes('UNAUTHORIZED_ROLE')
      );
    });
  });

  describe('SECTION F — SuperAdmin Platform Controls & Reset Engine', () => {

    it('F1. SuperAdmin can read and update branding for any institution', async () => {
      const updated = await updateInstitutionBranding('inst_center_B', {
        centerName: 'سنتر المنارة - مراجعة الإدارة',
        primaryColor: '#0F172A'
      }, superAdminToken);

      assert.equal(updated.centerName, 'سنتر المنارة - مراجعة الإدارة');
    });

    it('F2. SuperAdmin Reset restores center branding to REMAS Platform Defaults', async () => {
      await updateInstitutionBranding('inst_center_A', {
        centerName: 'سنتر مخصص',
        primaryColor: '#1E293B'
      }, centerAOwnerToken);

      const resetTheme = await resetInstitutionBranding('inst_center_A', superAdminToken);
      assert.equal(resetTheme.centerName, 'مركز تعليمي معتمد');
      assert.equal(resetTheme.colors.primary, '#0F172A');
    });

    it('F3. SuperAdmin can update Platform Branding taglines', async () => {
      const updatedPlatform = await updatePlatformBranding({
        taglineArabic: 'منظومة رِماس الرقمية المتطورة'
      }, superAdminToken);

      assert.equal(updatedPlatform.taglineArabic, 'منظومة رِماس الرقمية المتطورة');
    });
  });

  describe('SECTION G — Cloudflare R2 Presigned Asset Uploads', () => {

    it('G1. Generate secure Cloudflare R2 presigned upload URL for branding logo', async () => {
      const uploadData = await generateBrandingAssetUploadUrl('inst_center_A', 'logo', {
        fileName: 'brand_logo.png',
        mimeType: 'image/png',
        sizeBytes: 1024 * 200
      }, centerAOwnerToken);

      assert.ok(uploadData.assetId.startsWith('r2_brand_logo_'));
      assert.ok(uploadData.uploadUrl.includes('r2-gateway.educenter-saas.com'));
      assert.equal(uploadData.expiresInSeconds, 900);
    });
  });

  describe('SECTION H — E2E Persistence & Multi-Center Isolation', () => {

    it('H1. Multi-Center Persistence: Center A and Center B maintain distinct isolated brandings', async () => {
      await desktopServices.updateBranding(centerAOwnerToken, {
        institutionId: 'inst_center_A',
        centerName: 'مركز ألف التعليمي',
        primaryColor: '#0F172A',
        secondaryColor: '#0284C7'
      });

      await desktopServices.updateBranding(centerBOwnerToken, {
        institutionId: 'inst_center_B',
        centerName: 'مركز باء المتميز',
        primaryColor: '#1E293B',
        secondaryColor: '#0EA5E9'
      });

      const themeA = await desktopServices.getBranding(centerAOwnerToken, 'inst_center_A');
      const themeB = await desktopServices.getBranding(centerBOwnerToken, 'inst_center_B');

      assert.equal(themeA.centerName, 'مركز ألف التعليمي');
      assert.equal(themeA.colors.primary, '#0F172A');

      assert.equal(themeB.centerName, 'مركز باء المتميز');
      assert.equal(themeB.colors.primary, '#1E293B');

      assert.notEqual(themeA.centerName, themeB.centerName);
      assert.notEqual(themeA.colors.primary, themeB.colors.primary);
    });
  });
});
