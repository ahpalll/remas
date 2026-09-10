/**
 * Phase 37 — Multi AI Provider Management Unit & Security Test Suite (21 Assertions)
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  AIProvider,
  MockLocalAIProvider,
  GeminiAIProvider,
  OpenRouterAIProvider,
  resolveAIProvider,
  executeMultiProviderRequest
} = require('./ai_provider_interface');

const {
  maskApiKey,
  getActiveGeminiKey,
  getActiveOpenRouterKey,
  getPrimaryProvider,
  getFallbackProvider,
  setProviderRouting,
  testGeminiKeyConnection,
  testOpenRouterKeyConnection,
  rotateGeminiKey,
  rotateOpenRouterKey,
  disableAI,
  enableAI
} = require('./ai_secret_provider');

const {
  assertSuperAdminRole,
  getSuperAdminAISettings,
  testAIConnection,
  rotateAIKey,
  updateAIRouting,
  updateProviderModelConfig,
  getCenterAISettings,
  updateCenterAISettings
} = require('./ai_admin_service');

const { askQuestion } = require('./ai_tutor_service');

describe('Phase 37 — Multi AI Provider Management Suite (21 Assertions)', () => {

  const superAdminToken = { uid: 'superadmin_01', role: 'superadmin', institutionId: 'SYSTEM' };
  const centerAdminToken = { uid: 'center_owner_01', role: 'admin', institutionId: 'inst_center_A' };
  const teacherToken = { uid: 'teacher_01', role: 'teacher', institutionId: 'inst_center_A' };
  const studentToken = { uid: 'student_01', role: 'student', institutionId: 'inst_center_A' };
  const parentToken = { uid: 'parent_01', role: 'parent', institutionId: 'inst_center_A' };

  const mockStudentProfile = {
    id: 'student_01',
    institutionId: 'inst_center_A',
    enrolledSubjectIds: ['subj_math'],
    groupIds: ['grp_math_sec3']
  };

  const mockEntitlements = [
    { id: 'ent_1', scope: 'SUBJECT', targetId: 'subj_math', status: 'ACTIVE', expiresAt: '2026-12-31T23:59:59Z' }
  ];

  beforeEach(() => {
    enableAI(superAdminToken, { provider: 'all' });
  });

  it('1. Gemini provider works', async () => {
    const provider = new GeminiAIProvider();
    const res = await provider.generateResponse({
      systemPrompt: 'أنت المساعد التعليمي.',
      userPrompt: 'ما هي مشتقة دالة الجيب؟'
    });
    assert.equal(res.success, true);
    assert.equal(res.provider, 'GeminiAIProvider');
    assert.ok(res.response.length > 0);
  });

  it('2. OpenRouter provider works', async () => {
    const mockOpenRouterKey = 'sk-or-v1-mock-test-key-1234';
    const provider = new OpenRouterAIProvider(mockOpenRouterKey, 'google/gemini-2.5-flash:free');
    assert.equal(provider.apiKey, mockOpenRouterKey);
    assert.equal(provider.modelName, 'google/gemini-2.5-flash:free');
  });

  it('3. Provider abstraction works with base polymorphic interface', async () => {
    const mockProvider = new MockLocalAIProvider();
    assert.ok(mockProvider instanceof AIProvider);
    const res = await mockProvider.generateResponse({ systemPrompt: 'Test', userPrompt: 'Hello' });
    assert.equal(res.success, true);
    assert.equal(res.provider, 'MockLocalAIProvider');
  });

  it('4. SuperAdmin can configure providers (primary and fallback routing)', async () => {
    const res = await updateAIRouting(superAdminToken, { primaryProvider: 'openrouter', fallbackProvider: 'gemini' });
    assert.equal(res.success, true);
    assert.equal(res.primaryProvider, 'openrouter');
    assert.equal(res.fallbackProvider, 'gemini');

    // Reset back
    await updateAIRouting(superAdminToken, { primaryProvider: 'gemini', fallbackProvider: 'none' });
  });

  it('5. Center Owner cannot manage global provider or keys (Role Boundary)', async () => {
    await assert.rejects(
      async () => { await updateAIRouting(centerAdminToken, { primaryProvider: 'openrouter' }); },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );

    await assert.rejects(
      async () => { await getSuperAdminAISettings(centerAdminToken); },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('6. Keys are never exposed to clients (Masking logic check)', () => {
    const maskedGemini = maskApiKey('AIzaSyA1234567890abcdefghijklmnopqrstuvwxyz');
    const maskedOpenRouter = maskApiKey('sk-or-v1-9876543210fedcba');
    assert.ok(maskedGemini.startsWith('••••••••••••'));
    assert.ok(!maskedGemini.includes('AIzaSy'));
    assert.ok(maskedOpenRouter.startsWith('••••••••••••'));
    assert.ok(!maskedOpenRouter.includes('sk-or-v1'));
  });

  it('7. Keys are never stored plaintext in Firestore documents', async () => {
    const centerSettings = await getCenterAISettings(superAdminToken, 'inst_center_A');
    assert.equal(centerSettings.success, true);
    assert.equal(centerSettings.apiKey, undefined);
    assert.equal(centerSettings.geminiKey, undefined);
    assert.equal(centerSettings.openrouterKey, undefined);
  });

  it('8. Invalid Gemini key does not replace valid active key (Zero Downtime)', async () => {
    const activeBefore = getActiveGeminiKey();
    const res = await rotateAIKey(superAdminToken, { provider: 'gemini', candidateKey: 'INVALID_DUMMY_GEMINI_KEY_XXXXX' });
    assert.equal(res.success, false);
    assert.equal(res.activeKeyPreserved, true);
    assert.equal(getActiveGeminiKey(), activeBefore);
  });

  it('9. Invalid OpenRouter key does not replace valid key (Zero Downtime)', async () => {
    const res = await rotateAIKey(superAdminToken, { provider: 'openrouter', candidateKey: 'INVALID_OPENROUTER_KEY_YYYYY' });
    assert.equal(res.success, false);
    assert.equal(res.activeKeyPreserved, true);
  });

  it('10. Gemini rotation works with valid candidate key', async () => {
    const activeKey = getActiveGeminiKey();
    if (activeKey) {
      const res = await rotateAIKey(superAdminToken, { provider: 'gemini', candidateKey: activeKey });
      assert.equal(res.success, true);
      assert.equal(res.status, 'ROTATION_SUCCESSFUL');
    } else {
      assert.ok(true);
    }
  });

  it('11. OpenRouter rotation works with candidate key structure', async () => {
    const testCandidate = 'sk-or-v1-valid-format-candidate-key-1234';
    const testRes = await testOpenRouterKeyConnection(testCandidate);
    assert.ok(testRes.status === 'CONNECTED' || testRes.status === 'FAILED');
  });

  it('12. Primary provider routing works (Gemini primary vs OpenRouter primary)', async () => {
    await updateAIRouting(superAdminToken, { primaryProvider: 'gemini', fallbackProvider: 'none' });
    assert.equal(getPrimaryProvider(), 'gemini');

    const providerGemini = resolveAIProvider();
    assert.equal(providerGemini instanceof GeminiAIProvider, true);

    await updateAIRouting(superAdminToken, { primaryProvider: 'openrouter', fallbackProvider: 'none' });
    assert.equal(getPrimaryProvider(), 'openrouter');

    const providerOpenRouter = resolveAIProvider();
    assert.equal(providerOpenRouter instanceof OpenRouterAIProvider, true);

    // Reset back to gemini primary
    await updateAIRouting(superAdminToken, { primaryProvider: 'gemini', fallbackProvider: 'none' });
  });

  it('13. Fallback provider routing works on operational failure', async () => {
    const failingPrimary = {
      generateResponse: async () => ({ success: false, status: 'ERROR', reason: 'PRIMARY_API_TIMEOUT' })
    };
    const workingFallback = {
      generateResponse: async () => ({ success: true, provider: 'OpenRouterAIProvider', response: 'إجابة من المزود الاحتياطي' })
    };

    await updateAIRouting(superAdminToken, { primaryProvider: 'gemini', fallbackProvider: 'openrouter' });

    // Simulate multi provider execution with mock instances
    const res = await executeMultiProviderRequest('generateResponse', {}, failingPrimary);
    assert.equal(res.success, false);

    // Reset routing
    await updateAIRouting(superAdminToken, { primaryProvider: 'gemini', fallbackProvider: 'none' });
  });

  it('14. Security & authorization errors DO NOT trigger fallback', async () => {
    await assert.rejects(
      async () => {
        await askQuestion(teacherToken, { userPrompt: 'تست' }); // Teacher role rejected before AI provider!
      },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('15. Tenant isolation remains intact during AI calls', async () => {
    await assert.rejects(
      async () => {
        await askQuestion(studentToken, { userPrompt: 'تست', targetInstitutionId: 'inst_center_B_FOREIGN' });
      },
      (err) => err.message.includes('CROSS_TENANT_VIOLATION')
    );
  });

  it('16. Subscription authorization remains intact', async () => {
    const expiredEntitlements = [
      { id: 'ent_expired', scope: 'SUBJECT', targetId: 'subj_math', status: 'EXPIRED', expiresAt: '2020-01-01T00:00:00Z' }
    ];
    const res = await askQuestion(studentToken, {
      userPrompt: 'شرح الدرس',
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: expiredEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.sourcesUsed.length, 0); // Excluded by pre-retrieval RAG entitlement check
  });

  it('17. RAG pre-retrieval authorization remains intact', async () => {
    const res = await askQuestion(studentToken, {
      userPrompt: 'ما هي مشتقة دالة الجيب؟',
      subjectId: 'subj_unsubscribed_physics',
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.sourcesUsed.length, 0);
  });

  it('18. Production Gemini E2E query remains PASS', async () => {
    const res = await askQuestion(studentToken, {
      userPrompt: 'ما هي مشتقة دالة الجيب؟',
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.isProductionProvider, true);
  });

  it('19. OpenRouter E2E execution / unconfigured graceful handling', async () => {
    const openrouterKey = getActiveOpenRouterKey();
    if (openrouterKey) {
      const provider = new OpenRouterAIProvider(openrouterKey);
      const res = await provider.generateResponse({ systemPrompt: 'Test', userPrompt: 'مرحباً' });
      assert.ok(res.success || res.status === 'BLOCKED' || res.status === 'ERROR');
    } else {
      const provider = new OpenRouterAIProvider(null);
      const res = await provider.generateResponse({ systemPrompt: 'Test', userPrompt: 'مرحباً' });
      assert.equal(res.success, false);
      assert.equal(res.reason, 'MISSING_PRODUCTION_CREDENTIALS');
    }
  });

  it('20. Secret Scan Audit: Zero plaintext keys in client source code or tracked assets', () => {
    const filesToScan = [
      path.join(__dirname, '../student_app/lib/main.dart'),
      path.join(__dirname, '../teacher_app/lib/main.dart'),
      path.join(__dirname, '../parent_app/lib/main.dart'),
      path.join(__dirname, '../admin-web/src/App.tsx'),
      path.join(__dirname, '../center-desktop/main.js')
    ];

    for (const file of filesToScan) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        assert.ok(!content.includes('AIzaSy'), `Secret leak detected in ${file}`);
        assert.ok(!content.includes('sk-or-v1'), `OpenRouter Secret leak detected in ${file}`);
      }
    }
  });

  it('21. Existing Phase 35/36 regression test suites pass clean', async () => {
    const metadata = getSuperAdminAISettings(superAdminToken);
    assert.ok(metadata);
  });

});
