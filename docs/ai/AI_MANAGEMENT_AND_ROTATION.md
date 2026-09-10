# SuperAdmin AI Key Management & Zero-Downtime Key Rotation Architecture

## Overview
Phase 36 introduces server-side, zero-downtime key rotation and SuperAdmin management for Google Gemini AI (`gemini-2.5-flash`).

## Security Principles & Boundaries
1. **Zero Client Exposure**: The Gemini API key is never exposed to Flutter apps (Student, Teacher, Parent), React frontends (Admin Web, Parent Portal), Electron desktop packages, or plaintext Firestore documents.
2. **Server-Side Gateway**: All Gemini API calls are mediated server-side (`firebase/ai_admin_service.js` & `firebase/ai_secret_provider.js`).
3. **Role-Based Access Control**:
   - **SuperAdmin**: Full control to view key status (masked `••••••••••••HOg`), test candidate keys, activate, replace, and disable/enable AI globally.
   - **Center Owner**: Can toggle center AI availability and daily limit for their institution only. NO access to Gemini API keys or global provider settings.
   - **Teacher / Student / Parent**: Zero access to AI management endpoints or raw secrets.

## Key Storage Mechanism
- Keys are stored in an encrypted/isolated server secret store (`F:\firebase-secrets\gemini_secret_store.json`).
- If no secret store file exists, the system automatically migrates from `F:\firebase-secrets\gemini_api_key.txt`.
- Plaintext keys are NEVER stored in Firestore documents or logged to stdout/stderr.

## Zero-Downtime Key Rotation Flow
```
SuperAdmin enters Candidate Key
          │
          ▼
   Test Connection (Live Gemini API Call)
          │
    ┌─────┴─────┐
    │           │
 SUCCESS      FAILED
    │           │
    ▼           ▼
Activate Key  Reject Key (Active Working Key Remains Unchanged)
```
- If a candidate key fails validation, the current active key remains uninterrupted.
- Upon activation, the previous key is archived in secret history for auditing.

## Audit Event Logging
All actions produce audit log entries in Firestore `ai_audit_logs` without recording raw keys:
- `AI_KEY_TESTED`
- `AI_KEY_ACTIVATED`
- `AI_KEY_REPLACED`
- `AI_KEY_DISABLED`
- `AI_PROVIDER_CHANGED`
- `AI_MODEL_CHANGED`
- `CENTER_AI_SETTINGS_UPDATED`

Every log records: `actorId`, `timestamp`, `environment`, `result`, and `maskedKey`.
