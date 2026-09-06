# PHASE 21 PLAN — PRODUCTION DATA BOOTSTRAP & LIVE CONNECTIVITY

## Objective
Establish a production connectivity layer and idempotent system data bootstrap module for the REMAS Educational Center SaaS monorepo. This phase enables live health verification against Firebase and Cloudflare infrastructure when credentials exist, enforces strict production safety guards, supports dry-run mode, and provides system metadata bootstrapping without mutating tenant or user data.

## Scope & Core Pillars
1. **Production Connectivity Layer (`firebase/production_connectivity_service.js`)**:
   - Structured infrastructure health verification across Firebase Project, Auth, Firestore, Functions, Cloudflare Worker, R2, and FCM.
   - Isolated health-check namespace (`systemHealth/{checkId}`) for safe read/write verification when credentials exist.
   - Zero secret exposure in structured health reports.
2. **Safe System Data Bootstrap (`firebase/production_bootstrap.js`)**:
   - Idempotent bootstrap of system metadata (`systemMetadata/appConfig`, `systemMetadata/systemRoles`, `systemMetadata/subscriptionScopes`).
   - Command-line `--dry-run` flag support displaying planned changes without writing data.
   - Production Safety Guards ensuring bootstrap fails fast if environment, project ID, credentials, or release version are invalid.
   - Zero synthetic user records, zero fake passwords, zero usable subscription codes, and zero mock financial transactions.
3. **Firestore Security Rules Hardening (`firebase/firestore.rules` & `firestore_rules.test.js`)**:
   - Strict rule enforcement for `systemHealth` and `systemMetadata` collections. Direct client writes DENIED (`allow write: if false`). Client reads restricted to authenticated tenant users.
4. **Command Automation Scripts (`package.json`)**:
   - `production:check`, `production:bootstrap`, `production:verify` scripts safely handling missing credentials with standardized blocking errors (`PRODUCTION_CONNECTIVITY_BLOCKED`, `MISSING_PRODUCTION_CREDENTIALS`).
5. **Unit Test Suites**:
   - `firebase/production_connectivity.test.js`: Infrastructure health, health-check namespace, secret redaction, and missing credential handling.
   - `firebase/production_bootstrap.test.js`: Dry-run execution, idempotency, production guards, system metadata schema, and data boundary safety.
6. **Documentation & Release Metadata**:
   - `docs/PHASE_21_PLAN.md`, `docs/PHASE_21_REPORT.md`, `version.json`, `CHANGELOG.md`, `PROJECT_STATE.md`, `DECISIONS.md`.

## Target Files to Create / Modify
- `docs/PHASE_21_PLAN.md`
- `docs/PHASE_21_REPORT.md`
- `firebase/production_connectivity_service.js`
- `firebase/production_bootstrap.js`
- `firebase/production_connectivity.test.js`
- `firebase/production_bootstrap.test.js`
- `firebase/firestore.rules`
- `firebase/firestore_rules.test.js`
- `package.json` (new production scripts and test suite integration)
- `version.json`
- `CHANGELOG.md`
- `PROJECT_STATE.md`
- `DECISIONS.md`

## Security Boundaries & Rules
- **Direct Client Writes**: DENIED for `systemHealth` and `systemMetadata`.
- **Tenant Isolation**: Non-system collections (`students`, `parents`, `finance`, `grades`, `attendance`, `subscriptions`) remain 100% untouched.
- **Zero Secrets in Git**: No private keys, service account JSONs, or API tokens committed.
- **Phase 22 Boundary**: Phase 22 features remain strictly NOT STARTED.
