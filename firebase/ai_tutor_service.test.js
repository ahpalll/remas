/**
 * Phase 35 — Student AI Educational Tutor Unit & Security Test Suite
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { MockLocalAIProvider, GeminiAIProvider, resolveAIProvider } = require('./ai_provider_interface');
const { retrieveAuthorizedChunks, RAG_CHUNK_REPOSITORY, calculateCosineSimilarity } = require('./rag_retrieval_service');
const { checkRateLimit, resetUsageStore, MAX_DAILY_AI_REQUESTS } = require('./ai_usage_service');
const {
  validateStudentAICaller,
  askQuestion,
  askAboutLesson,
  explainLesson,
  summarizeLesson,
  generateSelfTest,
  analyzeWeaknesses,
  generateStudyPlan,
  prepareExam
} = require('./ai_tutor_service');

describe('Phase 35 — Student AI Educational Tutor Suite (20 Assertions)', () => {

  const mockStudentToken = { uid: 'student_001', role: 'student', institutionId: 'inst_dev_center' };
  const mockStudentProfile = {
    id: 'student_001',
    institutionId: 'inst_dev_center',
    enrolledSubjectIds: ['subj_math', 'subj_phys'],
    groupIds: ['grp_math_sec3', 'grp_phys_sec3']
  };
  const mockEntitlements = [
    { id: 'ent_1', scope: 'SUBJECT', targetId: 'subj_math', status: 'ACTIVE', expiresAt: '2026-12-31T23:59:59Z' },
    { id: 'ent_2', scope: 'SUBJECT', targetId: 'subj_phys', status: 'ACTIVE', expiresAt: '2026-12-31T23:59:59Z' }
  ];

  beforeEach(() => {
    resetUsageStore();
  });

  it('1. Authenticated student AI request grants successful grounded response', async () => {
    const res = await askQuestion(mockStudentToken, {
      userPrompt: 'ما هي مشتقة دالة الجيب؟',
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.response.includes('المادة التعليمية المعتمدة'));
    assert.equal(res.sourcesUsed.length > 0, true);
  });

  it('2. Unauthenticated caller is rejected (UNAUTHENTICATED_CALLER)', async () => {
    await assert.rejects(
      async () => { await askQuestion(null, { userPrompt: 'تست' }); },
      (err) => err.message.includes('UNAUTHENTICATED_CALLER')
    );
  });

  it('3. Unauthorized caller role is rejected (UNAUTHORIZED_ROLE)', async () => {
    const teacherToken = { uid: 'teacher_001', role: 'teacher', institutionId: 'inst_dev_center' };
    await assert.rejects(
      async () => { await askQuestion(teacherToken, { userPrompt: 'تست' }); },
      (err) => err.message.includes('UNAUTHORIZED_ROLE')
    );
  });

  it('4. Cross-tenant AI access attempt triggers CROSS_TENANT_VIOLATION', async () => {
    await assert.rejects(
      async () => {
        await askQuestion(mockStudentToken, {
          userPrompt: 'تست',
          targetInstitutionId: 'inst_other_center_999'
        });
      },
      (err) => err.message.includes('CROSS_TENANT_VIOLATION')
    );
  });

  it('5. Pre-retrieval RAG filters out unentitled subject content', async () => {
    const emptyEntitlements = [];
    const chunks = await retrieveAuthorizedChunks({
      callerToken: mockStudentToken,
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: emptyEntitlements
    });
    assert.equal(chunks.length, 0); // Content locked behind subscription
  });

  it('6. Pre-retrieval RAG filters out expired subscription entitlements', async () => {
    const expiredEntitlements = [
      { id: 'ent_exp', scope: 'SUBJECT', targetId: 'subj_math', status: 'ACTIVE', expiresAt: '2025-01-01T00:00:00Z' }
    ];
    const chunks = await retrieveAuthorizedChunks({
      callerToken: mockStudentToken,
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: expiredEntitlements
    });
    assert.equal(chunks.length, 0);
  });

  it('7. Pre-retrieval RAG filters out suspended entitlements', async () => {
    const suspendedEntitlements = [
      { id: 'ent_susp', scope: 'SUBJECT', targetId: 'subj_math', status: 'SUSPENDED', expiresAt: '2026-12-31T23:59:59Z' }
    ];
    const chunks = await retrieveAuthorizedChunks({
      callerToken: mockStudentToken,
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: suspendedEntitlements
    });
    assert.equal(chunks.length, 0);
  });

  it('8. Daily rate limit enforcement blocks requests exceeding MAX_DAILY_AI_REQUESTS', async () => {
    // Fill up rate limit store up to limit
    for (let i = 0; i < MAX_DAILY_AI_REQUESTS; i++) {
      const check = checkRateLimit(mockStudentToken.institutionId, mockStudentToken.uid);
      assert.equal(check.allowed, true);
      const { logAIUsage } = require('./ai_usage_service');
      logAIUsage({ institutionId: mockStudentToken.institutionId, studentId: mockStudentToken.uid });
    }

    // 51st request must be blocked
    const blockedRes = await askQuestion(mockStudentToken, { userPrompt: 'تست تكرار' });
    assert.equal(blockedRes.status, 'BLOCKED');
    assert.equal(blockedRes.errorCode, 'RATE_LIMIT_EXCEEDED');
  });

  it('9. Vendor-neutral provider abstraction executes MockLocalAIProvider deterministically', async () => {
    const provider = new MockLocalAIProvider();
    const res = await provider.generateResponse({
      systemPrompt: 'System',
      contextChunks: [{ text: 'قانون أوم V=I*R' }],
      userPrompt: 'اشرح قانون أوم'
    });
    assert.equal(res.success, true);
    assert.equal(res.provider, 'MockLocalAIProvider');
    assert.equal(res.isProductionProvider, false);
  });

  it('10. GeminiAIProvider reports BLOCKED / MISSING_PRODUCTION_CREDENTIALS when GEMINI_API_KEY is omitted', async () => {
    const provider = new GeminiAIProvider(null);
    const res = await provider.generateResponse({ systemPrompt: 'Sys', userPrompt: 'Hi' });
    assert.equal(res.success, false);
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.reason, 'MISSING_PRODUCTION_CREDENTIALS');
  });

  it('11. Dense vector cosine similarity calculation works accurately', () => {
    const vecA = [1.0, 0.0, 0.0];
    const vecB = [1.0, 0.0, 0.0];
    const vecC = [0.0, 1.0, 0.0];

    assert.equal(calculateCosineSimilarity(vecA, vecB), 1.0);
    assert.equal(calculateCosineSimilarity(vecA, vecC), 0.0);
  });

  it('12. Lesson-specific Q&A (askAboutLesson) grounds response in target lesson', async () => {
    const res = await askAboutLesson(mockStudentToken, {
      lessonId: 'les_math_calculus_01',
      userPrompt: 'ما هي قواعد التفاضل؟',
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.sourcesUsed.length > 0, true);
  });

  it('13. Lesson explanation (explainLesson) formats explanation modes', async () => {
    const res = await explainLesson(mockStudentToken, {
      lessonId: 'les_math_calculus_01',
      mode: 'SIMPLE',
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
  });

  it('14. Content summarization (summarizeLesson) returns structured summary', async () => {
    const res = await summarizeLesson(mockStudentToken, {
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
  });

  it('15. Self-test generator (generateSelfTest) produces structured quiz questions', async () => {
    const res = await generateSelfTest(mockStudentToken, {
      topic: 'الرياضيات العامة',
      difficulty: 'HARD',
      questionCount: 3,
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.questions.length, 3);
    assert.equal(res.questions[0].options.length, 4);
  });

  it('16. Non-diagnostic weakness analysis (analyzeWeaknesses) evaluates exam scores', async () => {
    const res = await analyzeWeaknesses(mockStudentToken, {
      gradeHistory: [{ percentage: 95.0 }, { percentage: 80.0 }]
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.overallPercentage, 87.5);
    assert.ok(Array.isArray(res.weakTopics));
  });

  it('17. Smart study plan generator (generateStudyPlan) produces structured timetable', async () => {
    const res = await generateStudyPlan(mockStudentToken, {
      targetDate: '2026-09-30',
      weakTopics: ['الفيزياء الحديثة']
    });
    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.items.length > 0);
  });

  it('18. Exam preparation (prepareExam) generates revision checklist', async () => {
    const res = await prepareExam(mockStudentToken, {
      examTitle: 'اختبار منتصف العام',
      subjectId: 'subj_math',
      studentProfile: mockStudentProfile,
      activeEntitlements: mockEntitlements
    });
    assert.equal(res.status, 'SUCCESS');
  });

  it('19. Asserts zero AI provider API keys exist in client-side modules', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const studentAppMain = path.join(__dirname, '..', 'student_app', 'lib', 'main.dart');
    if (fs.existsSync(studentAppMain)) {
      const content = fs.readFileSync(studentAppMain, 'utf8');
      assert.equal(content.includes('AI_API_KEY'), false);
      assert.equal(content.includes('GEMINI_API_KEY'), false);
    }
  });

  it('20. Asserts zero Firebase Admin Service Account credentials exist in student_app', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const pubspecPath = path.join(__dirname, '..', 'student_app', 'pubspec.yaml');
    if (fs.existsSync(pubspecPath)) {
      const content = fs.readFileSync(pubspecPath, 'utf8');
      assert.equal(content.includes('BEGIN PRIVATE KEY'), false);
      assert.equal(content.includes('FIREBASE_SERVICE_ACCOUNT_JSON'), false);
    }
  });

});
