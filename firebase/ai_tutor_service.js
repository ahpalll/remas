/**
 * Student AI Educational Tutor Trusted Gateway Service
 * REMAS Educational Center SaaS Monorepo
 * Target Project: educenter-saas
 */

const { resolveAIProvider } = require('./ai_provider_interface');
const { retrieveAuthorizedChunks, buildGroundedPrompt } = require('./rag_retrieval_service');
const { checkRateLimit, logAIUsage } = require('./ai_usage_service');

const SYSTEM_EDUCATIONAL_INSTRUCTIONS = `
أنت المساعد التعليمي الذكي لمنصة ريماس التعليمية.
دورك: مساعدة الطالب في فهم دروسه وشرح المفاهيم بأسلوب مشجع ومنهجي.
القواعد الإجرائية:
1. اشرح الخطوات المفاهيمية بوضوح ولا تعطي إجابات الواجبات المباشرة دون شرح.
2. استخدم اللغة العربية السليمة والواضحة.
3. استند إلى المادة التعليمية المعتمدة المرفقة في طلب الطالب.
4. إذا كانت المادة المتاحة غير كافية، وضح بالطريقة التالية: "المادة التعليمية المتاحة حالياً لا تحتوي على تفاصيل كافية لهذا السؤال". لا تخترع مصادر غير موجودة.
`;

/**
 * Validates caller identity and tenant scoping for student AI requests
 */
function validateStudentAICaller(callerToken, targetInstitutionId) {
  if (!callerToken || !callerToken.uid || !callerToken.role) {
    throw new Error('UNAUTHENTICATED_CALLER: Authentication required for AI Tutor requests');
  }
  if (callerToken.role !== 'student') {
    throw new Error(`UNAUTHORIZED_ROLE: Role '${callerToken.role}' cannot access Student AI Tutor`);
  }

  const callerInstId = callerToken.institutionId;
  if (!callerInstId) {
    throw new Error('UNAUTHORIZED_CALLER_TENANT: Missing institutionId in token claim');
  }
  if (targetInstitutionId && targetInstitutionId !== callerInstId) {
    throw new Error('CROSS_TENANT_VIOLATION: Caller cannot access AI services outside assigned tenant');
  }

  return callerInstId;
}

/**
 * Interactive Q&A Engine (`askQuestion`)
 */
async function askQuestion(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  if (!payload.userPrompt || typeof payload.userPrompt !== 'string' || !payload.userPrompt.trim()) {
    throw new Error('INVALID_INPUT: userPrompt is required and must be non-empty');
  }

  // Check student rate limit
  const rateLimit = checkRateLimit(instId, callerToken.uid);
  if (!rateLimit.allowed) {
    return {
      status: 'BLOCKED',
      errorCode: rateLimit.errorCode,
      message: rateLimit.message
    };
  }

  // Pre-Retrieval Authorization RAG
  const authorizedChunks = await retrieveAuthorizedChunks({
    callerToken,
    subjectId: payload.subjectId,
    lessonId: payload.lessonId,
    queryText: payload.userPrompt,
    studentProfile: payload.studentProfile,
    activeEntitlements: payload.activeEntitlements || [],
    customChunkRepository: payload.customChunkRepository
  });

  const groundedPrompt = buildGroundedPrompt({
    systemInstructions: SYSTEM_EDUCATIONAL_INSTRUCTIONS,
    contextChunks: authorizedChunks,
    userPrompt: payload.userPrompt
  });

  const provider = resolveAIProvider(providerOverride);
  const result = await provider.generateResponse({
    systemPrompt: groundedPrompt.systemPrompt,
    contextChunks: authorizedChunks,
    userPrompt: groundedPrompt.sanitizedUserPrompt
  });

  // Log usage
  logAIUsage({
    institutionId: instId,
    studentId: callerToken.uid,
    feature: 'ASK_QUESTION',
    provider: result.provider,
    tokenUsage: result.tokenUsage,
    status: result.success ? 'SUCCESS' : 'FAILED'
  });

  return {
    status: result.success ? 'SUCCESS' : result.status || 'ERROR',
    provider: result.provider,
    isProductionProvider: result.isProductionProvider,
    response: result.response,
    sourcesUsed: result.sourcesUsed || [],
    reason: result.reason
  };
}

/**
 * Specific Lesson / Video Q&A Engine ("اسأل عن الدرس / الفيديو")
 */
async function askAboutLesson(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  if (!payload.lessonId || !payload.userPrompt) {
    throw new Error('MISSING_REQUIRED_FIELDS: lessonId and userPrompt are required');
  }

  return askQuestion(callerToken, { ...payload, targetInstitutionId: instId }, providerOverride);
}

/**
 * Lesson Explanation Engine ("اشرح لي الدرس")
 */
async function explainLesson(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  if (!payload.lessonId) {
    throw new Error('MISSING_REQUIRED_FIELDS: lessonId is required for lesson explanation');
  }

  const prompt = `اشرح لي درس (${payload.lessonTitle || payload.lessonId}) بطريقة ${payload.mode === 'SIMPLE' ? 'مبسطة وسهلة' : 'تفصيلية وشاملة'} مع أمثلة.`;
  return askQuestion(callerToken, { ...payload, userPrompt: prompt, targetInstitutionId: instId }, providerOverride);
}

/**
 * Content Summarization Engine ("لخص لي")
 */
async function summarizeLesson(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  if (!payload.lessonId && !payload.subjectId) {
    throw new Error('MISSING_REQUIRED_FIELDS: lessonId or subjectId is required for summary');
  }

  const prompt = `قدم تلخيصاً مركزاً يشمل أهم المفاهيم، التعاريف، والقوانين الأساسية.`;
  return askQuestion(callerToken, { ...payload, userPrompt: prompt, targetInstitutionId: instId }, providerOverride);
}

/**
 * Self-Test Generator Engine ("اختبرني")
 */
async function generateSelfTest(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  const topic = payload.topic || 'المادة الدراسية المعتمدة';
  const difficulty = payload.difficulty || 'MEDIUM';
  const count = payload.questionCount && payload.questionCount > 0 ? Math.min(payload.questionCount, 10) : 3;

  const rateLimit = checkRateLimit(instId, callerToken.uid);
  if (!rateLimit.allowed) {
    return { status: 'BLOCKED', errorCode: rateLimit.errorCode, message: rateLimit.message };
  }

  const authorizedChunks = await retrieveAuthorizedChunks({
    callerToken,
    subjectId: payload.subjectId,
    lessonId: payload.lessonId,
    queryText: topic,
    studentProfile: payload.studentProfile,
    activeEntitlements: payload.activeEntitlements || [],
    customChunkRepository: payload.customChunkRepository
  });

  const provider = resolveAIProvider(providerOverride);
  const result = await provider.generateStructuredQuiz({
    topic,
    difficulty,
    questionCount: count,
    contextChunks: authorizedChunks
  });

  logAIUsage({
    institutionId: instId,
    studentId: callerToken.uid,
    feature: 'SELF_TEST',
    provider: result.provider,
    tokenUsage: result.tokenUsage,
    status: 'SUCCESS'
  });

  return {
    status: 'SUCCESS',
    provider: result.provider,
    isProductionProvider: result.isProductionProvider,
    topic: result.topic,
    difficulty: result.difficulty,
    questions: result.questions
  };
}

/**
 * Weakness Analysis Engine ("تحليل مستواي")
 */
async function analyzeWeaknesses(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  const provider = resolveAIProvider(providerOverride);
  const result = await provider.analyzePerformance({
    gradeHistory: payload.gradeHistory || [],
    attendanceSummary: payload.attendanceSummary || {}
  });

  return {
    status: 'SUCCESS',
    provider: result.provider,
    isProductionProvider: result.isProductionProvider,
    overallPercentage: result.overallPercentage,
    strongTopics: result.strongTopics,
    weakTopics: result.weakTopics,
    recommendations: result.recommendations
  };
}

/**
 * Study Plan Timetable Engine ("خطة مذاكرتي")
 */
async function generateStudyPlan(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  const provider = resolveAIProvider(providerOverride);
  const result = await provider.generateStudyPlan({
    studentContext: payload.studentContext || {},
    targetDate: payload.targetDate,
    weakTopics: payload.weakTopics || []
  });

  return {
    status: 'SUCCESS',
    provider: result.provider,
    isProductionProvider: result.isProductionProvider,
    targetDate: result.targetDate,
    items: result.items
  };
}

/**
 * Exam Preparation Engine ("استعد للامتحان")
 */
async function prepareExam(callerToken, payload = {}, providerOverride = null) {
  const instId = validateStudentAICaller(callerToken, payload.targetInstitutionId);

  const prompt = `أنشئ لي خطة وقائمة مراجعة سريعة للاستعداد لاختبار ${payload.examTitle || 'المادة الدراسية'}.`;
  return askQuestion(callerToken, { ...payload, userPrompt: prompt, targetInstitutionId: instId }, providerOverride);
}

module.exports = {
  validateStudentAICaller,
  askQuestion,
  askAboutLesson,
  explainLesson,
  summarizeLesson,
  generateSelfTest,
  analyzeWeaknesses,
  generateStudyPlan,
  prepareExam
};
