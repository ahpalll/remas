# REMAS Educational Center SaaS — Student AI Educational Tutor Architecture

**Monorepo Version**: `1.0.0-release.35`  
**Target Firebase Project**: `educenter-saas` (`educenter-saas-860c5`)  
**Security Boundary**: Server-Authoritative Gateway with Pre-Retrieval Authorization & Zero Client Keys  

---

## 1. System Overview & Data Flow

The **Student AI Educational Tutor System (REQ-21)** is a multi-tier, tenant-isolated educational AI assistant designed for students within the REMAS SaaS Platform. It provides context-grounded lesson Q&A, lesson explanations, content-driven summaries, self-testing, non-diagnostic weakness analysis, interactive study plan generation, and exam preparation.

```
+-----------------------------------------------------------------------------------+
|                              STUDENT FLUTTER APP                                  |
|   (Arabic RTL UI: AI Dashboard with 8 Quick-Action Cards, Chat, Quiz, Study Plan)  |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Authenticated Request (Bearer ID Token)
                                          v
+-----------------------------------------------------------------------------------+
|                        SECURE TRUSTED BACKEND AI GATEWAY                          |
|   (firebase/ai_tutor_service.js + firebase/rag_retrieval_service.js)              |
|                                                                                   |
|  1. Authenticate Caller & Extract Identity (uid, role=student)                    |
|  2. Validate Tenant Scoping (callerToken.institutionId == targetInstitutionId)   |
|  3. Evaluate Subscription Scope & Content Entitlement (unexpired code/scope)    |
|  4. Enforce Rate Limiting & Usage Quotas (firebase/ai_usage_service.js)           |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Authorized Filters (institutionId, subjectId, lessonId)
                                          v
+-----------------------------------------------------------------------------------+
|                         PRE-RETRIEVAL AUTHORIZATION RAG                           |
|   (Filters indexed educational content chunks BEFORE supplying to LLM prompt)     |
|                                                                                   |
|  - Chunks filtered by tenant, stage, subject, group enrollment, and entitlement  |
|  - Cosine Similarity Dense Embeddings / Vector Search on Authorized Subset        |
|  - System Prompt / Grounding Context / User Prompt Injection Barrier              |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Grounded System Prompt & Sanitized Context
                                          v
+-----------------------------------------------------------------------------------+
|                          VENDOR-NEUTRAL AI PROVIDER INTERFACE                     |
|   (AIProvider: GeminiAIProvider / MockLocalAIProvider for Unit Testing ONLY)     |
|   (Server-Side Credentials ONLY — Zero Keys in Client Binaries or ASAR)           |
+-----------------------------------------------------------------------------------+
```

---

## 2. RAG Pipeline, Embedding Strategy & Pre-Retrieval Authorization

### A. Vector Embedding & Indexing Specification
- **Embedding Generation**: 768-dimensional dense vector embeddings generated via `text-embedding-004` (Google Gemini API) or server-side dense feature extraction vectors.
- **Index Storage**: Chunks are stored in Firestore under `/institutions/{institutionId}/educationalContentChunks/{chunkId}`.
- **Chunking Parameters**: Text content is split into 500-token chunks with 50-token overlap.
- **Metadata Attributes**: Each chunk contains: `chunkId`, `institutionId`, `subjectId`, `stageId`, `groupId`, `lessonId`, `contentId`, `entitlementScope`, `embedding` (vector array), `text`, `createdAt`.
- **Infrastructure Cost & Rationale**: Uses Firestore document collections + in-memory server-side cosine similarity vector search. Zero external paid vector database is required ($0 additional infrastructure cost, fully compatible with GCP free-tier limits).

### B. Pre-Retrieval Authorization Filtering Algorithm
1. **Step 1 (Tenant Isolation)**: Filter chunks matching `chunk.institutionId == callerToken.institutionId`.
2. **Step 2 (Group & Subject Permission)**: Filter chunks matching `chunk.subjectId` in `student.enrolledSubjectIds` and `chunk.groupId` in `student.groupIds`.
3. **Step 3 (Entitlement Verification)**: For restricted content, verify active unexpired `Entitlement` document covering the target scope (`LESSON` or `SUBJECT`).
4. **Step 4 (Vector Distance Evaluation)**: Calculate cosine similarity strictly on the *authorized candidate subset* resulting from Steps 1–3.
5. **Security Guarantee**: Unpermitted chunks from other tenants or unentitled courses are NEVER retrieved, evaluated, or passed to the LLM prompt.

### C. Provider Abstraction & Production Verification Policy
- **Interface (`AIProvider`)**:
  - `generateResponse({ systemPrompt, contextChunks, userPrompt, temperature })`
  - `generateStructuredQuiz({ topic, difficulty, questionCount, contextChunks })`
  - `generateStudyPlan({ studentContext, targetDate, weakTopics })`
  - `analyzePerformance({ gradeHistory, attendanceSummary })`
- **`MockLocalAIProvider` Scope**: Used STRICTLY for unit tests, offline development, and CI/CD pipelines. It is NEVER treated as proof of production AI operation.
- **Production Status Rule**: If `GEMINI_API_KEY` is not present in the secure server environment, live production status is reported as `BLOCKED / USER ACTION REQUIRED` specifying environment variable `GEMINI_API_KEY`.

---

## 3. Student AI Educational Features (8 UI Quick-Action Cards)

1. **اسأل المساعد (Interactive Educational Chat)**:
   - Step-by-step guidance in Arabic/English without giving direct homework answers.
2. **اسأل عن الدرس / الفيديو (Lesson / Video Specific Q&A)**:
   - Target Q&A scoped directly to a specific authorized lesson or video content chunk.
3. **اشرح لي الدرس (Lesson Explainer)**:
   - Simple and detailed explanation modes tied to authorized lesson content.
4. **لخص لي (Content Summarizer)**:
   - Key concepts, formulas, definitions, and bulleted summaries.
5. **اختبرني (Self-Test Generator)**:
   - MCQ and short-answer question generator with difficulty levels (Easy, Medium, Hard).
6. **تحليل مستواي (Weakness Analysis)**:
   - Non-diagnostic performance analytics evaluating exam grades and attendance.
7. **خطة مذاكرتي (Study Plan Timetable)**:
   - Interactive daily study timetable generator based on weak topics and target dates.
8. **استعد للامتحان (Exam Preparation)**:
   - Revision checklist and strategy builder.

---

## 4. Security, Privacy & Safety Controls

1. **Zero Client Keys**: Mobile APKs, web bundles, and desktop installers contain zero AI API keys.
2. **Prompt Injection Barrier**: System prompts, retrieved context, and user inputs are strictly demarcated using `<STUDENT_INPUT>` delimiters.
3. **Rate Limiting**: Configurable daily rate limit per student (`MAX_DAILY_AI_REQUESTS`).

