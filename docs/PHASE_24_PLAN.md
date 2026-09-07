# Phase 24 Plan — Real Admin Onboarding & First Tenant

## Goal
Transition REMAS Educational Center SaaS from "Tenant Bootstrap Ready" to active operational workflow:
Enabling SuperAdmin to provision, onboard, manage, activate/suspend institutions, and assign the first Institution Admin safely under strict Multi-Tenant RBAC, Auditability, and Security Boundaries.

## Scope & Architectural Components

1. **Institution Management Backend Service (`firebase/institution_service.js`)**
   - Trusted backend service for institution lifecycle: `createInstitution`, `getInstitution`, `updateInstitution`, `listInstitutions`, `setInstitutionStatus`, `assignInitialAdmin`.
   - SuperAdmin privileges for multi-tenant institution lifecycle management.
   - Strict tenant isolation enforcing `callerToken.institutionId` claims for tenant admins.
   - Lifecycle states: `PENDING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`.
   - Standard audit events: `INSTITUTION_CREATED`, `INSTITUTION_UPDATED`, `INSTITUTION_ACTIVATED`, `INSTITUTION_SUSPENDED`, `ADMIN_ASSIGNED`, `ADMIN_LOGIN`.

2. **Backend Unit Test Suite (`firebase/institution_backend.test.js`)**
   - Unit & integration tests for institution creation, duplicate prevention, updates, status transitions, role authorization, tenant isolation, IDOR protection, and audit logging.

3. **Admin Web Interface Extensions (`admin-web/`)**
   - Institutions management UI & Onboarding dashboard.
   - Support for Arabic RTL, responsive design, state handling (loading/empty/error), and confirmation dialogs for sensitive status operations.

4. **Documentation & Release Artifacts**
   - `docs/INSTITUTION_ONBOARDING.md`: Workflow guide for SuperAdmin & Tenant Admin onboarding.
   - `docs/PHASE_24_REPORT.md`: Comprehensive Phase 24 verification report.
   - Updates to `PROJECT_STATE.md`, `DECISIONS.md` (ADR-024), `CHANGELOG.md`, and `version.json` (`1.0.0-release.24`).

## Verification Strategy
- Executed Node backend unit test suite (`firebase/institution_backend.test.js`).
- Executed `npm run test:all` across all monorepo test modules.
- Executed Flutter analyze & test for `student_app` and `parent_app`.
- Executed web production builds for `admin-web` and `parent-portal`.
- Executed Cloudflare Worker test suite.
- Secret audit scanning for 0 leaked credentials.
