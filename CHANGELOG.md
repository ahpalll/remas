# REMAS Educational Center SaaS Monorepo — CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-release.21] - 2026-09-06 (Phase 21: Production Data Bootstrap & Live Connectivity)

### Added
- **Production Connectivity Layer (`firebase/production_connectivity_service.js`)**: Structured infrastructure health verification across Firebase Project `educenter-saas`, Firestore, Auth, Functions, Worker, R2, and FCM with zero secret exposure.
- **Safe System Data Bootstrap Module (`firebase/production_bootstrap.js`)**: Idempotent bootstrap creating ONLY system metadata (`systemMetadata/appConfig`, `systemMetadata/systemRoles`, `systemMetadata/subscriptionScopes`) with CLI `--dry-run` support and production safety guards.
- **Health Check & Metadata Security Rules (`firebase/firestore.rules`)**: Direct client writes DENIED (`allow write: if false`) for `systemHealth` and `systemMetadata` collections.
- **CLI Connectivity & Bootstrap Scripts**: Added `production:check`, `production:bootstrap`, `production:verify`, `test:connectivity`, `test:bootstrap` scripts to `package.json`.
- **Target Firebase Project Target**: Linked project alias mapping to `educenter-saas`.

---

## [1.0.0-release.20] - 2026-09-06 (Phase 20: Production Cloud Deployment & Go-Live Verification)

### Added
- **Production Pre-Flight & Go-Live Audit Matrix (`docs/PHASE_20_REPORT.md`)**: Full pre-flight verification across Firebase, Cloudflare Edge Worker, Cloudflare R2 Storage, FCM Push Gateway, Web App builds, and Flutter Mobile Apps.
- **Machine-Readable Production Configuration Inventory**: Category audit covering Auth, Firestore, Worker, R2, FCM, Web, and Mobile configurations.
- **Production Credential & Secret Leak Scan**: Verified 0 hardcoded secrets, private keys, or API tokens exist in Git tracking or minified production web bundles (`admin-web/dist`, `parent-portal/dist`).
- **Pre-Flight Deployment Safety Check**: Executed `deploy_runner.js` verifying safe halting (`PRODUCTION_DEPLOYMENT_BLOCKED`) when cloud keys are omitted.

---

## [1.0.0-release.19] - 2026-09-06 (Phase 19: Production Deployment & Release Engineering)

### Added
- **Release Verification Gate Suite (`firebase/release_engineering.test.js`)**: 7 automated release gates asserting unit test integrity, configuration validation, deployment blocking, secret scanning, database safety, smoke test contracts, and rollback readiness.
- **Deployment Runner Script (`firebase/deploy_runner.js`)**: Automated release scripts (`verify:release`, `verify:production`, `deploy:staging`, `deploy:production`).
- **Production Deployment Safe Halt**: `deploy:production` safely blocks with `PRODUCTION_DEPLOYMENT_BLOCKED` and `MISSING_PRODUCTION_CREDENTIALS` when cloud credentials are not supplied.
- **Release Architecture & Engineering Documentation**:
  - `docs/RELEASE_ARCHITECTURE.md`: Multi-stage pipeline definition.
  - `docs/RELEASE_CHECKLIST.md`: Comprehensive deployment checklist.
  - `docs/DATABASE_RELEASE_SAFETY.md`: Zero-downtime database deployment guide.
  - `docs/POST_DEPLOYMENT_SMOKE_TESTS.md`: Synthetic smoke test specifications.
  - `docs/ROLLBACK_RUNBOOK.md`: Component rollback runbooks.
- **CI/CD Hardening**: Updated `.github/workflows/ci.yml` with release gate jobs.

---

## [1.0.0-release.18] - 2026-09-06 (Phase 18: Production Readiness & Deployment Foundation)

### Added
- Multi-tier environment architecture documentation (`docs/PRODUCTION_ENVIRONMENT.md`, `docs/PRODUCTION_DEPLOYMENT.md`).
- Environment configuration validator (`firebase/config_validator.js`).
- Structured audit logger sanitizing passwords, tokens, and keys.
- Disaster recovery runbook (`docs/BACKUP_RECOVERY.md`).
- Automated production readiness test suite (`firebase/production_readiness_backend.test.js`).

---

## [1.0.0-release.17] - 2026-09-06 (Phase 17: Advanced Notifications & Push Notification System)

### Added
- Multi-tenant notification gateway backend (`firebase/notification_service.js`).
- Notification history, preference management, device token registration, and deduplication.

---

## [1.0.0-release.16] - 2026-09-06 (Phase 16: Parent Portal Mobile App)

### Added
- Standalone Flutter Parent Portal application (`parent_app`).

---

## [1.0.0-release.15] - 2026-09-06 (Phase 15: Student Flutter App Runtime)

### Added
- Mobile Flutter runtime application for students (`student_app`).
