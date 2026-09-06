# RELEASE ARCHITECTURE & PIPELINE SPECIFICATION

## 1. End-to-End Release Pipeline Flow

The REMAS Educational Center SaaS monorepo enforces a strict multi-tier release lifecycle:

```text
  [SOURCE CODE (Git)]
          │
          ▼
   [STAGE 1: CI GATE] ────────► (Static Analysis & Dependency Audit)
          │
          ▼
  [STAGE 2: AUTOMATED TESTS] ─► (100% Pass: Rules, Backend, Worker, Mobile)
          │
          ▼
 [STAGE 3: SECURITY SCAN] ───► (Gitleaks, Secret Redaction, DTO Audit)
          │
          ▼
   [STAGE 4: BUILD] ──────────► (admin-web, parent-portal, Flutter release)
          │
          ▼
 [STAGE 5: STAGING DEPLOY] ──► (Automated deploy to Staging project)
          │
          ▼
[STAGE 6: STAGING SMOKE TEST]► (Automated verification on Staging env)
          │
          ▼
[STAGE 7: PROD APPROVAL GATE]► (Manual operator sign-off & credentials injection)
          │
          ▼
[STAGE 8: PROD DEPLOYMENT] ──► (Atomic deploy: Rules -> Worker -> Backend -> Web)
          │
          ▼
[STAGE 9: POST-DEPLOYMENT] ──► (Synthetic smoke test & health metrics check)
```

## 2. Environment Configurations Matrix

| Component | Development (`DEV`) | Staging (`STAGING`) | Production (`PRODUCTION`) |
| :--- | :--- | :--- | :--- |
| **Firebase Project** | Emulator Local | `remas-staging` | `remas-prod` |
| **Firestore Rules** | Local Rules Test | Deployed Staging Rules | Deployed Production Rules |
| **Cloud Functions** | Emulator Local | Staging Endpoint | High-Availability Cloud Region |
| **Cloudflare Worker** | Local Mock Worker | `remas-media-worker-staging` | `remas-media-worker-prod` |
| **Cloudflare R2** | Local Directory Mock | `remas-media-staging` | `remas-media-prod` (Private) |
| **FCM Gateway** | Local Push Simulator | Staging FCM Account | Production FCM V1 Gateway |
| **Web Apps Hosting** | `localhost:3000` / `5173` | Staging CDN Domain | Production CDN / Custom Domain |
| **Flutter Apps** | `--dart-define=ENV=dev` | `--dart-define=ENV=staging` | `--dart-define=ENV=production` |

## 3. Release Gates Overview

- **Gate 1: Unit & Integration Test Integrity**: All Node tests, Cloudflare worker tests, and Flutter unit tests must achieve 100% pass rate.
- **Gate 2: Security & Privacy Compliance**: Zero plaintext secrets in code or build outputs. All DTOs sanitize sensitive identity fields.
- **Gate 3: Environment Configuration Sanity**: `config_validator.js` validates target production keys (`projectId`, `clientEmail`, `privateKey`, `accountId`, `bucketName`, `serverKey`).
- **Gate 4: Database Migration Compatibility**: Non-destructive schema updates only. Security rules deployed prior to database schema migrations.
- **Gate 5: Build Artifact Integrity**: Production web builds (`dist/`) generated without bundling source maps or secret keys.
- **Gate 6: Post-Deployment Verification**: Verification contract checks endpoint health and tenant boundary isolation.
- **Gate 7: Rollback Preparedness**: Rollback runbook verified before production promotion.
