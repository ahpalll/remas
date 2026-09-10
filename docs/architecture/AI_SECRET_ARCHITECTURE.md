# AI Provider & Secret Abstraction Architecture

## Component Overview

```
[SuperAdmin Web UI]
       │
       ▼ (HTTPS REST / Function)
[ai_admin_service.js] ── (Role Guard: SuperAdmin Only)
       │
       ▼
[ai_secret_provider.js] ──► [Server Vault: F:\firebase-secrets\gemini_secret_store.json]
       │
       ▼
[ai_provider_interface.js] ──► [Google Gemini REST API (gemini-2.5-flash)]
```

## Layer Responsibilities

1. **`ai_secret_provider.js`**:
   - Manages active key, candidate key testing, key replacement, and historical keys.
   - Provides `getActiveGeminiKey()`, `setGeminiKey()`, `disableGeminiKey()`, and `testGeminiKey()`.
   - Generates masked representations (`••••••••••••HOg`).

2. **`ai_admin_service.js`**:
   - Handles SuperAdmin requests: `getAISettings()`, `testCandidateKey()`, `rotateKey()`, `setGlobalAIStatus()`.
   - Handles Center Admin requests: `getCenterAISettings()`, `updateCenterAISettings()`.
   - Logs audit events to Firestore `ai_audit_logs`.

3. **`ai_provider_interface.js`**:
   - `GeminiAIProvider`: Executes requests against Google Gemini API using active key retrieved from `ai_secret_provider.js`.
   - Redacts keys from log statements and error messages.
