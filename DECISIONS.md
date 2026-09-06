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

## ADR-019: Phase 19 Production Deployment & Release Engineering Architecture

### Context
Moving from production-ready foundation to complete release engineering requires automated release verification gates, semantic versioning, safe deployment runner automation, zero-downtime database release procedures, post-deployment smoke test specifications, and component rollback runbooks.

### Decision
1. **7 Automated Release Verification Gates**: Implemented `firebase/release_engineering.test.js` validating unit tests, security rules, environment validation, build artifact secret scanning, additive database migration compatibility, smoke test contracts, and rollback readiness.
2. **Safe Deployment Runner (`firebase/deploy_runner.js`)**: Configured `verify:release`, `verify:production`, `deploy:staging`, and `deploy:production` scripts in `package.json`. `deploy:production` safely halts with code `PRODUCTION_DEPLOYMENT_BLOCKED` and reason `MISSING_PRODUCTION_CREDENTIALS` when cloud infrastructure keys are not supplied.
3. **Monorepo Semantic Versioning**: Established `1.0.0-release.19` semantic version in `version.json` and documented release history in `CHANGELOG.md`.
4. **Database Migration Safety**: Enforced rules-first deployment sequence (Snapshot -> Indexes -> Security Rules -> Additive Schema Migration -> Backend -> Frontends) in `docs/DATABASE_RELEASE_SAFETY.md`.
5. **Component Rollback & Post-Deployment Smoke Test Specifications**: Created `docs/POST_DEPLOYMENT_SMOKE_TESTS.md` and `docs/ROLLBACK_RUNBOOK.md` covering Worker edge, Firebase rules, Web, R2, and Mobile app rollback protocols.

## ADR-020: Phase 20 Production Cloud Deployment & Go-Live Verification Architecture

### Context
Finalizing Phase 20 requires complete pre-flight verification across Firebase, Cloudflare Worker, Cloudflare R2, FCM Gateway, Web application builds, and Flutter Mobile apps, validating post-deployment synthetic smoke test contracts, performing secret audits, and accurately stating deployment status without committing secrets or inventing live cloud deployments.

### Decision
1. **Pre-Flight Verification Matrix**: Established machine-readable production configuration inventory and executed full pre-flight audit (`FIREBASE_PREFLIGHT`, `CLOUDFLARE_WORKER_PREFLIGHT`) achieving 100% pass across local/emulator verification levels.
2. **Build Artifact & Repository Credential Audit**: Confirmed zero secrets, private keys, or API tokens exist in Git tracking or minified web bundles (`admin-web/dist`, `parent-portal/dist`).
3. **Honest Operational Status**: Overall phase status marked `PASS WITH NON-BLOCKING LIMITATIONS` and deployment status marked `PRODUCTION DEPLOYMENT: BLOCKED — MISSING PRODUCTION CREDENTIALS` until live cloud keys are injected by the system operator.
4. **Post-Deployment Smoke Test Contract Validation**: Verified synthetic user smoke test specifications across Auth, Multi-Tenancy, Student, Parent, Subscriptions, Media signed URLs, and Notifications.
5. **Strict Boundary Control**: Preserved complete historical commit trajectory (728 assertions 100% PASS). Marked Phase 21 as `NOT STARTED`.

## ADR-021: Phase 21 Production Data Bootstrap & Live Connectivity Architecture

### Context
Phase 21 establishes a production infrastructure connectivity layer targeting Firebase Production Project `educenter-saas` and an idempotent system data bootstrap module with dry-run support, production guards, and zero secret leakage.

### Decision
1. **Target Firebase Project Alignment**: Configured `.firebaserc`, `firebase.json`, and `.env.example` mapping primary production project alias to `educenter-saas`.
2. **Production Connectivity Layer (`firebase/production_connectivity_service.js`)**: Structured infrastructure health checking across Firebase Project `educenter-saas`, Firestore, Auth, Functions, Cloudflare Worker, R2, and FCM. Performs live verification when credentials exist using isolated `systemHealth/{checkId}` collection; safely halts with `BLOCKED — MISSING PRODUCTION CREDENTIALS` when keys are omitted.
3. **Safe System Data Bootstrap Module (`firebase/production_bootstrap.js`)**: Idempotent system bootstrap creating ONLY system metadata (`systemMetadata/appConfig`, `systemRoles`, `subscriptionScopes`). Includes `--dry-run` flag support and production safety guards. Zero student/parent/finance documents created.
4. **Health Check & System Metadata Security Rules**: Hardened `firebase/firestore.rules` denying direct client writes (`allow write: if false`) for `systemHealth` and `systemMetadata` collections.
5. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.21` with 739/739 passing assertions (100% PASS). Marked Phase 22 as `NOT STARTED`.

## ADR-022: Phase 22 Live Firebase Integration & Safe Production Bootstrap Architecture

### Context
Phase 22 implements live health verification and read/write/read-back validation targeting Firebase Production Project `educenter-saas` in an isolated health-check namespace, audits multi-tier application environment pointers, and enforces data boundary protections without creating fake user records or leaking secrets.

### Decision
1. **Live Firebase Verification Engine (`firebase/live_verification_service.js`)**: Implemented live verification targeting `educenter-saas`. Executes controlled write -> read-back verification against `systemHealth/phase22` when credentials are supplied; safely returns `BLOCKED — MISSING PRODUCTION CREDENTIALS` when cloud keys are omitted.
2. **App Environment Pointer Audit**: Verified that `admin-web`, `parent-portal`, `student_app`, and `parent_app` production configurations target `educenter-saas` without embedding `127.0.0.1` or `localhost` in production definitions.
3. **Data Boundary Safety**: Enforced strict safety rules ensuring 0 user records, 0 fake students, 0 fake parents, 0 usable subscription codes, and 0 mock financial transactions are created during live verification.
4. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.22` with 744/744 passing assertions (100% PASS). Marked Phase 23 as `NOT STARTED`.
