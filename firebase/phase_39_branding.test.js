process.env.NODE_ENV = 'test';
process.env.USE_FIRESTORE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  const teacherAToken = { uid: 'user_teacher_a', role: 'teacher', institutionId: 'inst_center_A' };
  const parentAToken = { uid: 'user_parent_a', role: 'parent', institutionId: 'inst_center_A' };

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
        loginTitle: 'مرحباً بكم في سنتر الأوائل'
      }, centerAOwnerToken);

      assert.equal(updated.centerName, 'سنتر الأوائل التعليمي');
      assert.equal(updated.colors.primary, '#1E293B');

      const theme = await getInstitutionBranding('inst_center_A', centerAOwnerToken);
      assert.equal(theme.centerName, 'سنتر الأوائل التعليمي');
      assert.equal(theme.colors.primary, '#1E293B');
      assert.equal(theme.colors.secondary, '#0EA5E9');
    });
  });

  describe('SECTION E — Security & Cross-Tenant Security Rules Isolation', () => {

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
      assert.equal(resetTheme.centerName, 'رِماس للتقنية التعليمية');
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

  describe('SECTION I — Multi-Client Branding Resolution & Security Audit', () => {

    it('I1. Student App: Unauthenticated caller gets REMAS Platform Defaults', async () => {
      const theme = await getInstitutionBranding('inst_center_A', null);
      assert.equal(theme.centerName, 'رِماس للتقنية التعليمية');
      assert.equal(theme.colors.primary, '#0F172A');
    });

    it('I2. Student App: Authenticated student receives authorized institution branding', async () => {
      await updateInstitutionBranding('inst_center_A', {
        centerName: 'سنتر الطالب المتميز',
        primaryColor: '#0F172A'
      }, superAdminToken);

      const theme = await getInstitutionBranding('inst_center_A', studentAToken);
      assert.equal(theme.centerName, 'سنتر الطالب المتميز');
      assert.equal(theme.colors.primary, '#0F172A');
    });

    it('I3. Teacher App: Authenticated teacher receives authorized institution branding', async () => {
      await updateInstitutionBranding('inst_center_A', {
        centerName: 'أكاديمية المعلمين الأولى',
        primaryColor: '#0F172A'
      }, superAdminToken);

      const theme = await getInstitutionBranding('inst_center_A', teacherAToken);
      assert.equal(theme.centerName, 'أكاديمية المعلمين الأولى');
      assert.equal(theme.colors.primary, '#0F172A');
    });

    it('I4. Parent App & Portal: Authenticated parent receives child institution branding', async () => {
      await updateInstitutionBranding('inst_center_A', {
        centerName: 'مجمع أولياء الأمور التعليمي',
        primaryColor: '#0F172A'
      }, superAdminToken);

      const theme = await getInstitutionBranding('inst_center_A', parentAToken);
      assert.equal(theme.centerName, 'مجمع أولياء الأمور التعليمي');
      assert.equal(theme.colors.primary, '#0F172A');
    });

    it('I5. Tenant Isolation Audit: Cross-tenant branding update attempt is rejected cleanly', async () => {
      await assert.rejects(
        async () => {
          await updateInstitutionBranding('inst_center_B', { centerName: 'اختراق هجرية' }, centerAOwnerToken);
        },
        (err) => err.message.includes('UNAUTHORIZED_TENANT') || err.message.includes('CROSS_TENANT_VIOLATION')
      );
    });

    it('I6. Client Audit: Verify zero R2 secret keys exist in client application source files', () => {
      const clientDirs = ['student_app', 'teacher_app', 'parent_app', 'parent-portal', 'center-desktop'];
      const secretKeywords = ['R2_SECRET', 'AWS_SECRET_ACCESS_KEY', 'R2_ACCESS_KEY_ID'];

      for (const dir of clientDirs) {
        const fullDir = path.resolve(__dirname, '..', dir);
        if (fs.existsSync(fullDir)) {
          function scan(dirPath) {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const f of files) {
              const p = path.join(dirPath, f.name);
              if (f.isDirectory() && f.name !== 'node_modules' && f.name !== '.git' && f.name !== 'dist' && f.name !== 'build') {
                scan(p);
              } else if (f.isFile() && (f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.dart') || f.name.endsWith('.tsx'))) {
                const content = fs.readFileSync(p, 'utf8');
                for (const kw of secretKeywords) {
                  assert.equal(content.includes(kw), false, `Forbidden secret keyword ${kw} found in client file ${p}`);
                }
              }
            }
          }
          scan(fullDir);
        }
      }
    });

    it('I7. Client Audit: Verify zero Firebase Admin SDK imports exist inside student/teacher/parent clients', () => {
      const clientDirs = ['student_app', 'teacher_app', 'parent_app', 'parent-portal'];

      for (const dir of clientDirs) {
        const fullDir = path.resolve(__dirname, '..', dir);
        if (fs.existsSync(fullDir)) {
          function scan(dirPath) {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const f of files) {
              const p = path.join(dirPath, f.name);
              if (f.isDirectory() && f.name !== 'node_modules' && f.name !== '.git' && f.name !== 'dist' && f.name !== 'build') {
                scan(p);
              } else if (f.isFile() && (f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.dart') || f.name.endsWith('.tsx'))) {
                const content = fs.readFileSync(p, 'utf8');
                assert.equal(content.includes("require('firebase-admin')") || content.includes('import * as admin from "firebase-admin"'), false, `Forbidden Firebase Admin SDK import found in client file ${p}`);
              }
            }
          }
          scan(fullDir);
        }
      }
    });
  });
});
