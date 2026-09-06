# Architectural Decision Records (ADR)

## ADR-014: Phase 14 Subscription Codes & Content Entitlements Architecture

### Context
Educational content access control requires subscription packages, high-entropy subscription codes, SHA-256 code hashing, atomic transactional redemption, request idempotency, server-owned duration calculations, scope evaluation, zero plaintext code persistence in Firestore, and integration with Phase 13 Cloudflare Worker.

### Decision
1. **100% Trusted Backend Authority**: Direct client writes to `/packages`, `/subscriptionCodes`, and `/entitlements` are strictly DENIED in Firestore security rules (`allow create, update, delete: if false`). All mutations run via `firebase/subscription_service.js`.
2. **SHA-256 Code Hashing**: Plaintext codes are generated server-side with high entropy and returned ONLY ONCE at creation time. Only `codeHash` is saved in Firestore.
3. **Atomic Code Redemption**: Code redemption is transactional, checks idempotency via `requestId`, sets code status `REDEEMED`, and creates an `Entitlement` document atomically.
4. **Scope Evaluation**: Content access is authorized if ANY active, unexpired entitlement covers the target scope (`SUBJECT`, `GROUP`, `LESSON`, `CONTENT`, `MULTI_SCOPE`).
5. **Worker Integration**: Cloudflare Worker verifies caller identity and entitlement scope before issuing short-lived R2 presigned URLs (~15 min expiry).

## ADR-018: Phase 18 Production Readiness & Deployment Foundation Architecture

### Context
Transitioning to production readiness requires strict environment separation (`DEV`, `STAGING`, `PRODUCTION`), zero secret leakage, environment configuration validation layer, production-safe audit logging, backup/recovery procedures, and CI/CD automation without claiming live cloud deployment without credentials.

### Decision
1. **Strict Environment Configuration Validator**: Created `firebase/config_validator.js` enforcing required keys for `PRODUCTION` and throwing standardized error codes (`MISSING_PRODUCTION_CONFIG`, `INVALID_ENVIRONMENT`, `MISSING_FIREBASE_CONFIG`, `MISSING_CLOUDFLARE_CONFIG`, `MISSING_R2_CONFIG`, `MISSING_FCM_CONFIG`).
2. **Zero Secret Leakage Policy**: Hardened `.gitignore` to block `.env.*`, `*.pem`, `*.key`, `service-account*.json`, `firebase-adminsdk*.json`. Environment templates use placeholders only (`.env.example`, `wrangler.toml.example`).
3. **Production-Safe Audit Logger**: Structured audit logger redacts sensitive values (passwords, JWTs, bearer tokens, private keys) before logging, tagging events with correlation IDs across 11 mandatory audit event types.
4. **Disaster Recovery Specification**: Documented RPO < 1 Hour and RTO < 4 Hours with Firestore PITR, GCS exports, and R2 cross-region replication (`docs/BACKUP_RECOVERY.md`).
5. **CI/CD Foundation**: GitHub Actions pipeline (`.github/workflows/ci.yml`) runs tests, static analysis, web builds, mobile app checks, and Gitleaks secret scans.
6. **Honest Deployment Status**: Operational deployment status explicitly declared as `PRODUCTION DEPLOYMENT: BLOCKED / USER ACTION REQUIRED` until operator supplies cloud credentials.
