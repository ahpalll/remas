# Production AI Deployment & Operations Runbook

## Deployment Prerequisites
- Server environment variable `GEMINI_SECRET_STORE_PATH` pointing to secure server directory (default: `F:\firebase-secrets\gemini_secret_store.json`).
- Initial production key placed in `F:\firebase-secrets\gemini_api_key.txt` or initialized via SuperAdmin UI.

## Post-Deployment Verification
1. Login to SuperAdmin Web Dashboard (`/superadmin/ai-settings`).
2. Verify AI Status displays `ENABLED` and Model displays `gemini-2.5-flash`.
3. Click **Test Connection** to execute live API verification.
4. Verify response: `SUCCESS`.

## Key Rotation Runbook
1. Obtain new Gemini API key from Google AI Studio / GCP Console.
2. In SuperAdmin UI, enter new key into **Candidate Key** field.
3. Click **Test Connection**.
4. Confirm test returns `SUCCESS`.
5. Click **Activate & Replace Key**.
6. Confirm status updates with new masked key (`••••••••••••xxxx`).
7. Execute test query from Student Android App to confirm end-to-end functionality.

## Emergency Disable Procedure
1. In SuperAdmin UI, click **Disable AI Provider**.
2. Confirm AI Status changes to `DISABLED`.
3. All student AI requests will immediately fail gracefully with `AI_PROVIDER_DISABLED`.
