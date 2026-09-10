# AI Security & Threat Model Specifications

## 1. Zero Trust Client Security Model
Client applications (`student_app`, `teacher_app`, `parent_app`, `center-desktop`) DO NOT possess API keys, service account credentials, or direct connectivity to external AI providers (Google Gemini API).

All AI interactions execute strictly through the trusted Firebase Cloud Function / Node backend (`ai_tutor_service.js`).

## 2. Threat Vector Mitigations

| Threat Vector | Mitigation Strategy | Enforcement Layer |
|---|---|---|
| **Client Credential Theft** | Zero API keys stored in client apps. API keys exist only in secure server environment variables (`GEMINI_API_KEY`). | trusted_backend gateway |
| **Prompt Injection Attacks** | System prompts enforce strict context boundaries (`<STUDENT_INPUT>` delimiter shielding) and forbid role overrides or policy changes. | `ai_tutor_service.js` |
| **Cross-Tenant Data Leakage** | Pre-retrieval RAG filters all vectors by caller's `institutionId` BEFORE vector search or prompt construction. | `rag_retrieval_service.js` |
| **Unauthorized Material Access** | Entitlement checks verify active, unexpired subscription packages for the requested subject/lesson prior to context inclusion. | `subscription_service.js` |
| **Denial of Service / Cost Spikes** | Per-student daily quota enforced (`MAX_DAILY_AI_REQUESTS = 50`). Requests beyond limit return HTTP 429 / `DAILY_LIMIT_EXCEEDED`. | `ai_usage_service.js` |
| **Bypassing Paid Entitlements** | Pre-retrieval authorization rejects requests for subjects where student entitlement status is `EXPIRED` or `SUSPENDED`. | `rag_retrieval_service.js` |

## 3. Production Readiness Safeguard
- If `GEMINI_API_KEY` is not present in the production environment, the backend explicitly returns:
  `STATUS: BLOCKED / MISSING_PRODUCTION_CREDENTIALS`
- `MockLocalAIProvider` is restricted to unit tests, offline development, and CI environments, ensuring production deployment cannot falsely claim PASS without live AI keys.
