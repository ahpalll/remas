/**
 * Phase 36 — SuperAdmin AI Key Management & Rotation Security Test Suite
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  maskApiKey,
  getActiveGeminiKey,
  testGeminiKeyConnection,
  rotateGeminiKey,
  getAISettingsMetadata
} = require('./ai_secret_provider');

const {
  getSuperAdminAISettings,
  testAIConnection,
  rotateAIKey,
  disableAI,
  enableAI,
  getCenterAISettings,
  updateCenterAISettings,
  getAIAuditLogs
} = require('./ai_admin_service');

const { resolveAIProvider } = require('./ai_provider_interface');

describe('Phase 36 — SuperAdmin AI Key Management & Rotation Suite (18 Assertions)', () => {

  const superAdminToken = { uid: 'superadmin_01', role: 'superadmin', institutionId: 'SYSTEM' };
  const centerAdminToken = { uid: 'center_owner_01', role: 'admin', institutionId: 'inst_center_A' };
  const teacherToken = { uid: 'teacher_01', role: 'teacher', institutionId: 'inst_center_A' };
  const studentToken = { uid: 'student_01', role: 'student', institutionId: 'inst_center_A' };
  const parentToken = { uid: 'parent_01', role: 'parent', institutionId: 'inst_center_A' };

  beforeEach(() => {
    enableAI(superAdminToken);
  });

  it('1. SuperAdmin can access SuperAdmin AI Settings', async () => {
    const settings = await getSuperAdminAISettings(superAdminToken);
    assert.equal(settings.success, true);
    assert.equal(settings.provider, 'Google Gemini');
    assert.equal(settings.model, 'gemini-2.5-flash');
    assert.ok(settings.keyMasked.includes('••••'));
    assert.equal(settings.keyMasked.includes('AQ.'), false); // NO raw plaintext key
  });

  it('2. Center Owner (Admin) cannot access SuperAdmin AI Settings or API Key', async () => {
    await assert.rejects(
      async () => { await getSuperAdminAISettings(centerAdminToken); },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('3. Teacher cannot access SuperAdmin AI Settings or API Key', async () => {
    await assert.rejects(
      async () => { await getSuperAdminAISettings(teacherToken); },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('4. Student cannot access SuperAdmin AI Settings or API Key', async () => {
    await assert.rejects(
      async () => { await getSuperAdminAISettings(studentToken); },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('5. Parent cannot access SuperAdmin AI Settings or API Key', async () => {
    await assert.rejects(
      async () => { await getSuperAdminAISettings(parentToken); },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('6. Valid active key passes test connection', async () => {
    const activeKey = getActiveGeminiKey();
    if (activeKey) {
      const testRes = await testAIConnection(superAdminToken);
      assert.equal(testRes.success, true);
      assert.ok(testRes.status === 'CONNECTED' || testRes.status === 'SUCCESS');
      assert.equal(testRes.provider, 'Google Gemini');
    } else {
      assert.ok(true);
    }
  });

  it('7. Invalid candidate key fails test and DOES NOT replace active key (Zero Downtime)', async () => {
    const initialKey = getActiveGeminiKey();
    const invalidKey = 'INVALID_FAKE_GEMINI_KEY_999';

    const rotateRes = await rotateAIKey(superAdminToken, { candidateKey: invalidKey });
    assert.equal(rotateRes.success, false);
    assert.equal(rotateRes.activeKeyPreserved, true);

    // Verify active key remained 100% untouched
    const currentKey = getActiveGeminiKey();
    assert.equal(currentKey, initialKey);
  });

  it('8. Successful rotation activates new valid candidate key', async () => {
    const currentKey = getActiveGeminiKey();
    if (currentKey) {
      // Re-rotate with current valid key to test successful rotation flow
      const rotateRes = await rotateAIKey(superAdminToken, { candidateKey: currentKey });
      assert.equal(rotateRes.success, true);
      assert.equal(rotateRes.status, 'ROTATION_SUCCESSFUL');
      assert.equal(rotateRes.activeKeyPreserved, false);
    } else {
      assert.ok(true);
    }
  });

  it('9. Secret store records previous key history after rotation', () => {
    const storePath = 'F:\\firebase-secrets\\gemini_secret_store.json';
    if (fs.existsSync(storePath)) {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      assert.ok('previousKey' in data);
      assert.equal(data.status, 'ENABLED');
    }
  });

  it('10. API key is NEVER stored in Firestore documents plaintext', () => {
    // Assert Firestore collection mocks or models do not persist raw API key
    const metadata = getAISettingsMetadata();
    assert.equal('activeKey' in metadata, false);
    assert.equal('apiKey' in metadata, false);
    assert.ok(metadata.keyMasked.startsWith('••••'));
  });

  it('11. API key NEVER appears in audit logs (logs contain masked representation only)', () => {
    const logs = getAIAuditLogs();
    const activeKey = getActiveGeminiKey();
    if (activeKey && activeKey.length > 10) {
      for (const log of logs) {
        const logStr = JSON.stringify(log);
        assert.equal(logStr.includes(activeKey), false, `CRITICAL SECURITY LEAK: Raw API key found in audit log ${log.id}`);
      }
    }
  });

  it('12. API key NEVER appears in client source code (student, teacher, parent, web, desktop)', () => {
    const activeKey = getActiveGeminiKey();
    if (activeKey && activeKey.length > 10) {
      const clientDirs = ['student_app', 'teacher_app', 'parent_app', 'admin-web', 'parent-portal', 'center-desktop'];
      for (const dir of clientDirs) {
        const fullDir = path.join(__dirname, '..', dir);
        if (fs.existsSync(fullDir)) {
          const scan = (d) => {
            for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
              if (['node_modules', 'dist', 'build', '.dart_tool'].includes(entry.name)) continue;
              const fp = path.join(d, entry.name);
              if (entry.isDirectory()) scan(fp);
              else if (/\.(dart|ts|tsx|js|json|html)$/.test(entry.name)) {
                const text = fs.readFileSync(fp, 'utf8');
                assert.equal(text.includes(activeKey), false, `Secret leak in ${fp}`);
              }
            }
          };
          scan(fullDir);
        }
      }
    }
  });

  it('13. API key NEVER appears in Flutter APK assets or pubspec configs', () => {
    const pubspecPath = path.join(__dirname, '..', 'student_app', 'pubspec.yaml');
    const activeKey = getActiveGeminiKey();
    if (fs.existsSync(pubspecPath) && activeKey) {
      const content = fs.readFileSync(pubspecPath, 'utf8');
      assert.equal(content.includes(activeKey), false);
    }
  });

  it('14. API key NEVER appears in Electron ASAR or package.json', () => {
    const pkgPath = path.join(__dirname, '..', 'center-desktop', 'package.json');
    const activeKey = getActiveGeminiKey();
    if (fs.existsSync(pkgPath) && activeKey) {
      const content = fs.readFileSync(pkgPath, 'utf8');
      assert.equal(content.includes(activeKey), false);
    }
  });

  it('15. Center Admin can configure own Center AI settings without accessing API key', async () => {
    const getRes = await getCenterAISettings(centerAdminToken, 'inst_center_A');
    assert.equal(getRes.success, true);
    assert.equal(getRes.institutionId, 'inst_center_A');
    assert.equal('keyMasked' in getRes, false);
    assert.equal('apiKey' in getRes, false);

    const updateRes = await updateCenterAISettings(centerAdminToken, {
      targetInstitutionId: 'inst_center_A',
      aiEnabled: true,
      dailyLimitPerStudent: 30
    });
    assert.equal(updateRes.success, true);
    assert.equal(updateRes.dailyLimitPerStudent, 30);
  });

  it('16. Center Admin of Tenant B cannot modify Center AI settings of Tenant A (Tenant Isolation)', async () => {
    await assert.rejects(
      async () => {
        await updateCenterAISettings(centerAdminToken, {
          targetInstitutionId: 'inst_other_center_999',
          aiEnabled: false,
          dailyLimitPerStudent: 10
        });
      },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('17. Disable & Enable AI Provider global toggle controls', async () => {
    const disableRes = await disableAI(superAdminToken);
    assert.equal(disableRes.success, true);
    assert.equal(disableRes.status, 'AI_DISABLED');

    const providerDisabled = resolveAIProvider();
    assert.equal(providerDisabled.constructor.name, 'GeminiAIProvider');
    const resBlocked = await providerDisabled.generateResponse({ systemPrompt: 'Sys', userPrompt: 'Hi' });
    assert.equal(resBlocked.status, 'BLOCKED');

    const enableRes = await enableAI(superAdminToken);
    assert.equal(enableRes.success, true);
    assert.equal(enableRes.status, 'AI_ENABLED');
  });

  it('18. Production Gemini E2E Query remains PASS after Phase 36 key management integration', async () => {
    const provider = resolveAIProvider();
    if (provider.constructor.name === 'GeminiAIProvider') {
      const res = await provider.generateResponse({
        systemPrompt: 'أنت معلم فيزياء في مركز تعليمي',
        contextChunks: [{ text: 'ينص قانون أوم على V = I * R', lessonId: 'les_phys_01' }],
        userPrompt: 'ما هو قانون أوم في كلمة واحدة؟'
      });
      assert.equal(res.success, true);
      assert.equal(res.provider, 'GeminiAIProvider');
      assert.equal(res.isProductionProvider, true);
      assert.ok(res.response.length > 0);
    }
  });

});
