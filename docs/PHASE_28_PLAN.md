# Phase 28 — Real Firebase Production Connection Plan

## Overview
Phase 28 establishes a verified, live connection between the REMAS Educational Center SaaS Monorepo and the live Firebase Production environment (`educenter-saas` / `educenter-saas-860c5`) using secure Service Account credentials (`F:\firebase-secrets\educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json`).

## Technical Plan & Workflow

1. **Pre-Execution Baseline & Security Audit**:
   - Inspect git status, HEAD commit (`954c9541cbebce4ec2349a64be511f996fc6b897`), and configuration files (`.firebaserc`, `firebase.json`, `package.json`, `.env.example`).
   - Validate Service Account credential file at `F:\firebase-secrets\educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json` ensuring project ID `educenter-saas-860c5` and required private key fields exist without copying or logging secrets.

2. **Live Firebase Admin SDK Connectivity**:
   - Update `firebase/live_verification_service.js`, `firebase/production_connectivity_service.js`, `firebase/production_bootstrap.js`, and `firebase/production_data_bootstrap.js` to resolve service account credentials dynamically from runtime path or environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - Ensure credentials remain outside the workspace and are never committed to git.

3. **Empirical Write -> Read -> Read-Back Verification**:
   - Execute live write, read, and read-back verification against `systemHealth/phase28_live_verify` in `educenter-saas` Firestore.
   - Confirm document payload matches and `readBackVerified: true`.

4. **Firebase Auth Admin SDK Verification**:
   - Verify connection to Firebase Auth Admin SDK on live production project (`AUTH_ADMIN_API: PASS`).
   - Enforce 0 synthetic user accounts are created.

5. **Safe System & Tenant Bootstrap**:
   - Execute `production_bootstrap.js` to idempotently write `systemMetadata` (`appConfig`, `systemRoles`, `subscriptionScopes`).
   - Execute `production_data_bootstrap.js` to idempotently provision primary institution `institutions/inst_bootstrap_001`.
   - Maintain 0 synthetic students, 0 synthetic teachers, 0 synthetic parents, 0 mock subscription codes, and 0 mock financial records.

6. **Monorepo Suite & Build Verification**:
   - Run Node test suites (`npm run test:all`).
   - Run Cloudflare worker tests (`cd cloudflare/worker && npm test`).
   - Run Student App Flutter tests (`cd student_app && flutter analyze && flutter test`).
   - Run Parent App Flutter tests (`cd parent_app && flutter analyze && flutter test`).
   - Build Admin Web app (`cd admin-web && npm run build`).
   - Build Parent Portal web app (`cd parent-portal && npm run build`).

7. **Security Scan & Release Documentation**:
   - Perform `git diff --check` and secret key scan.
   - Update `version.json` (`1.0.0-release.28`), `CHANGELOG.md`, `PROJECT_STATE.md`, `DECISIONS.md` (ADR-028).
   - Generate `docs/PHASE_28_REPORT.md` with empirical proof of production connectivity.

8. **Git Commit**:
   - Stage files and commit with message `"phase-28: real firebase production connection"`.
