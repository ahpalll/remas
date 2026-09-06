# LIVE FIREBASE VERIFICATION & ARCHITECTURE SPECIFICATION

## 1. Target Firebase Production Project Identity
- **Project Name**: `educenter-saas`
- **Project ID**: `educenter-saas`
- **Configured Alias**: `production` in `.firebaserc` and `firebase.json`

## 2. Live Verification Sequence Protocol

```text
 [CREDENTIAL DISCOVERY (Environment / IAM)]
                   │
                   ▼
  [STAGE 1: PROJECT ID CHECK] ──────► Target ID == 'educenter-saas'
                   │
                   ▼
  [STAGE 2: AUTH SERVICE CHECK] ────► Verify Auth API Availability
                   │
                   ▼
  [STAGE 3: FIRESTORE LIVE READ] ───► Read 'systemHealth/phase22'
                   │
                   ▼
  [STAGE 4: FIRESTORE LIVE WRITE] ──► Write metadata to 'systemHealth/phase22'
                   │
                   ▼
  [STAGE 5: READ-BACK VERIFY] ──────► Verify Written Document Matches
                   │
                   ▼
 [STAGE 6: FUNCTIONS & RULES TARGET]► Verify Firestore Rules & Function Targets
```

## 3. Isolated Health-Check Data Contract (`systemHealth/phase22`)

Live verification MUST only write to the isolated health-check collection `systemHealth`.

```json
{
  "checkId": "phase22_health_check",
  "phase": "22",
  "releaseVersion": "1.0.0-release.22",
  "environment": "PRODUCTION",
  "targetProjectId": "educenter-saas",
  "commitSha": "76d30409b8109f5cf2b6016ea2030b5bda609a6f",
  "verificationStatus": "HEALTHY",
  "verifiedAt": "2026-09-06T21:45:00.000Z"
}
```

> **SAFETY CONTRACT**: Never write to, mutate, or read user collections (`students`, `parents`, `finance`, `grades`, `attendance`, `subscriptions`, `content`, `media`) during live health verification.

## 4. Application Environment Configuration Matrix

| Application | Development (`DEV`) | Staging (`STAGING`) | Production (`PRODUCTION`) |
| :--- | :--- | :--- | :--- |
| **Admin Web (`admin-web`)** | `http://localhost:8080` | `https://staging-admin.remas.edu` | `https://admin.remas.edu` (Firebase Project `educenter-saas`) |
| **Parent Portal (`parent-portal`)** | `http://localhost:8080` | `https://staging-parent.remas.edu` | `https://parent.remas.edu` (Firebase Project `educenter-saas`) |
| **Student App (`student_app`)** | `--dart-define=ENV=dev` | `--dart-define=ENV=staging` | `--dart-define=ENV=production` |
| **Parent App (`parent_app`)** | `--dart-define=ENV=dev` | `--dart-define=ENV=staging` | `--dart-define=ENV=production` |

## 5. Live Verification Status Reporting Rules
- **LIVE VERIFIED**: Real Google Cloud / Firebase service account credentials present and write/read-back verification succeeded against `educenter-saas`.
- **BLOCKED — MISSING PRODUCTION CREDENTIALS**: Credentials or project IAM access permissions not detected in environment.
