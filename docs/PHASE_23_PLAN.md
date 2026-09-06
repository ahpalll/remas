# PHASE 23 PLAN — PRODUCTION DATA MODEL & TENANT BOOTSTRAP

## Objective
Establish the Production Data Model, Single Tenant Provisioning Engine, Data Counting Service, and Cross-Tenant Security Audit framework for the REMAS Educational Center SaaS monorepo targeting Firebase Project `educenter-saas`. This phase defines the complete SaaS collection taxonomy, enables idempotent tenant bootstrapping with dry-run support, provides non-PII data count verifications, and enforces 100% cross-tenant data isolation.

## Scope & Core Pillars
1. **Production Data Model Taxonomy ([PRODUCTION_DATA_BOOTSTRAP.md](file:///F:/remas/docs/PRODUCTION_DATA_BOOTSTRAP.md))**:
   - Comprehensive mapping of all 22 monorepo Firestore collections across System, Tenant, Academic, Student, Guardian, Attendance, Finance, Exam, Content, Subscription, Notification, Media, and Audit domains.
2. **Tenant Provisioning Engine (`firebase/production_data_bootstrap.js`)**:
   - Single Tenant Bootstrap Module (`bootstrapTenant({ institutionId, name, type, adminEmail, dryRun })`).
   - Idempotent provisioning: Checks for existing tenant configuration before writing; skips duplicate creation.
   - Dry-Run Support (`--dry-run` flag): Displays planned document creations without writing data.
   - Production Safety Guards: Validates environment (`PRODUCTION` / `STAGING`), target project ID (`educenter-saas`), and release version. Safely halts with `BLOCKED — MISSING PRODUCTION CREDENTIALS` when cloud keys are omitted.
   - Zero synthetic student, guardian, financial, or subscription code data created.
3. **Non-PII Data Count Verification Engine**:
   - CLI command (`production:counts`) reporting collection document metrics without exposing personal identifiable information (PII).
4. **Cross-Tenant Security Boundary Verification**:
   - Security rule unit test assertions asserting strict Tenant isolation across all 10 domain collections (`students`, `teachers`, `guardians`, `attendance`, `grades`, `content`, `subscriptions`, `transactions`, `notifications`, `media`).
5. **Monorepo Versioning & System Regression**:
   - Update `version.json` to `1.0.0-release.23` and update `CHANGELOG.md`.
   - 100% pass rate across Node test runners, Cloudflare Worker tests, Flutter analyze & tests, and production Web builds.

## Target Files
- `docs/PHASE_23_PLAN.md`
- `docs/PHASE_23_REPORT.md`
- `docs/PRODUCTION_DATA_BOOTSTRAP.md`
- `firebase/production_data_bootstrap.js`
- `firebase/production_data_bootstrap.test.js`
- `package.json`
- `version.json`
- `CHANGELOG.md`
- `PROJECT_STATE.md`
- `DECISIONS.md`

## Security Boundaries & Rules
- **Target Project**: `educenter-saas`.
- **Zero Real Secrets**: No API keys, passwords, or service account JSONs committed.
- **Tenant Isolation**: Cross-tenant requests must be rejected (`DENIED`).
- **Phase 24 Boundary**: Phase 24 features remain strictly NOT STARTED.
