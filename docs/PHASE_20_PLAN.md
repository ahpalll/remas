# PHASE 20 PLAN — PRODUCTION CLOUD DEPLOYMENT & GO-LIVE VERIFICATION

## Objective
Execute complete Production Cloud Deployment pre-flight checks, security audits, build artifact inspections, post-deployment smoke test contract verifications, and go-live readiness validation for the REMAS Educational Center SaaS monorepo.

## Core Scope & Milestones
1. **Production Configuration Inventory**: Machine-readable checklist for Firebase, Cloudflare Workers, R2 Storage, FCM Gateway, Web Apps, and Mobile Apps.
2. **Credential Safety Audit**: Repository and build artifact secret scan to ensure zero leaked private keys, API tokens, or service account JSONs.
3. **Complete Test & Build Verification Gates**:
   - Backend & Rules tests (`npm run test:all`, `npm run test:release`, `npm run test:readiness`).
   - Cloudflare Worker tests (`npm test` in `cloudflare/worker`).
   - Mobile Flutter Apps (`student_app` and `parent_app` analyze & test).
   - Web Applications (`admin-web` and `parent-portal` production builds).
4. **Firebase & Cloudflare Pre-Flight Audits**:
   - `FIREBASE_PREFLIGHT`: Project ID, Firestore rules, indexes, Functions, Auth, and environment safety.
   - Cloudflare Worker pre-flight: Signed URL TTL (~15 min), private R2 binding, path traversal protection, cross-tenant rejection.
5. **Database & Schema Safety**: Verification of additive migration rules, pre-deployment database backup procedures, and rules-first deployment order.
6. **Web & Mobile Release Artifact Inspection**: Verification that minified static bundles contain no bundle-time secret leaks.
7. **Post-Deployment Synthetic Smoke Test Contracts**: Verification of synthetic user smoke testing scenarios across Auth, Multi-Tenancy, Student, Parent, Subscriptions, Media, and Notifications.
8. **Rollback Readiness & Versioning**: Re-verification of rollback runbook across all 5 tiers and monorepo version update (`1.0.0-release.20`).
9. **Final Go-Live Report & State Reconciliation**: Clear documentation of local/emulator/staging/production verification levels and honest deployment status reporting.

## Target Files
- `docs/PHASE_20_PLAN.md`
- `docs/PHASE_20_REPORT.md`
- `version.json`
- `CHANGELOG.md`
- `PROJECT_STATE.md`
- `DECISIONS.md`

## Phase Boundaries
- **In Scope**: Phase 20 pre-flight checks, credential safety scans, test gate execution, artifact inspection, smoke test contract validation, versioning, documentation, and commit.
- **Out of Scope**: Phase 21 features, committing real secrets, or falsely claiming live cloud deployment without credentials.
