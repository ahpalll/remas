# AI Security Boundaries & Secret Leak Prevention

## Threat Model & Controls

### 1. Plaintext Key Leakage Prevention
- **Client Binaries**: Automated build gates verify zero `GEMINI_API_KEY` strings exist in Flutter APK assets (`student_app`, `teacher_app`, `parent_app`) or Electron ASAR bundles (`center-desktop`).
- **Web Bundles**: Admin Web and Parent Portal bundles are compiled via Vite with strict environment isolation. Zero raw keys are embedded in frontend source or artifacts.
- **Git History**: Security test `ai_admin_service.test.js` (Assertion 12-14) and `release_engineering.test.js` perform regex scans on Git commit history and tracked files.

### 2. Multi-Tenant AI Isolation
- RAG content indexation enforces `institutionId`, student `groupIds`, and active subject entitlements before context assembly.
- Center Admins can only configure Center AI limits for their own institution. Attempting to modify another tenant's AI settings returns `CROSS_TENANT_VIOLATION`.

### 3. Prompt Injection Defense
- User prompts are wrapped in structural delimiters (`<<<USER_INPUT>>> ... <<<END_USER_INPUT>>>`) before sending to Gemini.
- Pre-prompt instructions instruct the LLM to process user input as text queries only, ignoring embedded system instructions.

### 4. Emergency Kill Switch
- SuperAdmin can disable AI globally with one click (`disableAIProvider()`).
- When disabled, all student AI endpoints return `AI_PROVIDER_DISABLED` with HTTP 503 status without hitting external APIs.
