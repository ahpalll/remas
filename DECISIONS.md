# Architectural Decision Records (ADR)

## ADR-028: Phase 28 Real Firebase Production Connection Architecture

### Context
Phase 28 establishes a verified, live connection between the REMAS trusted backend layer and the Firebase Production project `educenter-saas` (underlying GCP Project ID `educenter-saas-860c5`) via Service Account credentials (`F:\firebase-secrets\educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json`).

### Decision
1. **Secure Secret Runtime Resolution**: Service account credentials are stored strictly outside the repository workspace at `F:\firebase-secrets\...` or passed via environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`. No private key or credential content is stored in git or printed in logs.
2. **Empirical Live Write -> Read -> Read-Back Verification**: Performed live write -> read -> read-back verification against `systemHealth/phase28_live_verify` in `educenter-saas` Firestore with `readBackVerified: true`.
3. **Live Auth Admin SDK Verification**: Validated Firebase Auth Admin SDK connection (`AUTH_ADMIN_API: PASS`).
4. **Idempotent System & Tenant Bootstrap**: Written `systemMetadata` (`appConfig`, `systemRoles`, `subscriptionScopes`) and `institutions/inst_bootstrap_001` idempotently using read-before-write logic.
5. **Zero Synthetic Business Data Safeguard**: Enforced 0 fake user accounts, 0 fake students, 0 fake teachers, 0 fake parents, 0 fake subscription codes, and 0 mock financial transactions in production Firestore.
6. **Production Deployment Status**: System deployment status elevated to `CONNECTED — LIVE PRODUCTION FIREBASE`.

---

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

## ADR-023: Phase 23 Production Data Model & Tenant Bootstrap Architecture

### Context
Phase 23 defines the production data model taxonomy for REMAS Educational Center SaaS (22 standard Firestore collections), provisions the single primary tenant safely and idempotently, exposes a non-PII metrics service, and enforces strict tenant isolation and role hierarchy without creating synthetic user records or fake financial data.

### Decision
1. **22-Collection SaaS Taxonomy**: Documented full production Firestore collection schema in `docs/PRODUCTION_DATA_BOOTSTRAP.md` covering Identity, Institutions/Tenants, Profiles, Students, Guardians, Teachers, Subjects, Groups, Sessions, Attendance, Assignments, Grades, Exams, Online Exams, Educational Content, Subscriptions, Entitlements, Transactions, Notifications, Media Metadata, Audit Logs, and System Metadata.
2. **Single Primary Tenant Provisioning Engine (`firebase/production_data_bootstrap.js`)**: Implemented idempotent `bootstrapTenant` service and CLI (`--dry-run` flag support). Creates single primary tenant (`institutions/inst_bootstrap_001`) safely when production credentials are valid; halts safely with `BLOCKED — MISSING PRODUCTION CREDENTIALS` when keys are omitted.
3. **Non-PII Metrics Service (`getProductionDataCounts`)**: Added non-PII metrics query service exposing collection document counts without revealing personal identifiable information.
4. **Data Boundary & Zero Synthetic Data Safeguard**: Guaranteed zero fake user accounts, zero fake passwords, zero usable subscription codes, and zero mock financial transactions are written.
5. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.23` with 751/751 passing assertions (100% PASS). Marked Phase 24 as `NOT STARTED`.

## ADR-024: Phase 24 Real Admin Onboarding & First Tenant Architecture

### Context
Phase 24 establishes full operational institution management and initial Admin onboarding capabilities (`createInstitution`, `getInstitution`, `updateInstitution`, `listInstitutions`, `setInstitutionStatus`, `assignInitialAdmin`), supporting status lifecycles (`PENDING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`), strict SuperAdmin/Tenant Admin authorization, immutable audit keys, RTL admin web extensions, and audit event recording.

### Decision
1. **Institution Management Backend (`firebase/institution_service.js`)**: Developed trusted backend API for tenant provisioning and status transitions. Direct client Firestore creation is strictly DENIED in security rules.
2. **SuperAdmin & Tenant Admin Privilege Boundaries**: SuperAdmin possesses global institution lifecycle management authority; Tenant Admins (`institutionOwner`, `admin`) can view and update ONLY their own tenant profile. Unprivileged roles (`teacher`, `student`, `parent`) are strictly DENIED.
3. **Status Lifecycle Policy**: Defined formal status lifecycle (`PENDING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`). Status transitions to `SUSPENDED` disable protected business operations while preserving database immutability.
4. **Admin Web Extensions (`admin-web/src/components/SuperAdminInstitutions.tsx`)**: Created responsive, Arabic RTL console with creation forms, status toggles, and confirmation modal dialogs for sensitive operational actions.
5. **Auditable System Events**: Implemented structured audit logger emitting `INSTITUTION_CREATED`, `INSTITUTION_UPDATED`, `INSTITUTION_ACTIVATED`, `INSTITUTION_SUSPENDED`, and `ADMIN_ASSIGNED` without logging secrets or credentials.
6. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.24` with 761/761 passing assertions (100% PASS). Marked Phase 25 as `NOT STARTED`.

## ADR-025: Phase 25 Academic Structure & Institution Operations Architecture

### Context
Phase 25 establishes operational academic level/grade hierarchies, subjects catalog management, teacher profile management, and subject/level assignment engines (`firebase/academic_structure_service.js`), with strict multi-tenant isolation, role authorization, RTL admin web extensions, and audit event recording.

### Decision
1. **Academic Structure & Teachers Service (`firebase/academic_structure_service.js`)**: Implemented trusted backend API for academic levels (`createAcademicLevel`, `updateAcademicLevel`, `setAcademicLevelStatus`), subjects catalog (`createSubject`, `updateSubject`, `setSubjectStatus`), and teacher profiles (`createTeacherProfile`, `updateTeacherProfile`, `assignTeacherSubjectsAndLevels`).
2. **Multi-Tenant Privilege Boundaries**: SuperAdmin maintains cross-tenant management authority; Tenant Admins (`institutionOwner`, `admin`) are strictly isolated to their assigned `institutionId` claim. Teachers, students, and parents are strictly DENIED administrative operations (`UNAUTHORIZED_CALLER_ROLE`).
3. **Admin Web Extensions (`admin-web/src/components/AcademicCoreDashboard.tsx`)**: Extended responsive, Arabic RTL console with creation forms, status badges, level ordering, and subject/level assignment controls.
4. **Auditable System Events**: Structured audit logger records `ACADEMIC_LEVEL_CREATED`, `ACADEMIC_LEVEL_UPDATED`, `ACADEMIC_LEVEL_STATUS_CHANGED`, `SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_STATUS_CHANGED`, `TEACHER_CREATED`, `TEACHER_UPDATED`, `TEACHER_STATUS_CHANGED`, and `TEACHER_ASSIGNMENT_CHANGED` without logging secrets.
5. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.25` with 774/774 passing assertions (100% PASS). Marked Phase 26 as `NOT STARTED`.

## ADR-026: Phase 26 Student Enrollment & Group Operations Architecture

### Context
Phase 26 establishes complete operational student enrollment, class group management with capacity limit enforcement (`maxCapacity`), active/withdrawn enrollment tracking, and guardian profile linking (`firebase/student_enrollment_service.js`), with multi-tenant isolation, role authorization, RTL admin web extensions, and audit logging.

### Decision
1. **Student Enrollment & Group Service (`firebase/student_enrollment_service.js`)**: Developed trusted backend API for student profiles (`createStudent`, `getStudent`, `updateStudentProfile`, `changeStudentStatus`, `regenerateStudentQR`), class groups (`createGroup`, `getGroup`, `updateGroup`, `setGroupStatus`, `listGroups`), enrollments (`enrollStudentInGroup`, `withdrawStudentFromGroup`), and guardian linking (`linkGuardianToStudent`, `listGuardians`).
2. **Group Capacity Enforcement**: Group enrollments automatically check `enrolledCount < maxCapacity`. Attempting to enroll beyond capacity rejects with `GROUP_CAPACITY_EXCEEDED`. Active enrollments increment counter; withdrawals decrement counter.
3. **Multi-Tenant & Role Isolation**: SuperAdmin possesses cross-tenant authority specifying `targetInstitutionId`. Tenant Admins (`institutionOwner`, `admin`) are strictly isolated to `callerToken.institutionId`. Unprivileged roles (`teacher`, `student`, `parent`) are strictly DENIED (`UNAUTHORIZED_CALLER_ROLE`).
4. **Admin Web Extensions (`admin-web/src/components/student/StudentsManager.tsx`)**: Upgraded Arabic RTL console with creation forms for students, groups, enrollments, guardian linking, and real-time status badges.
5. **Auditable System Events**: Emits `STUDENT_ENROLLED`, `STUDENT_UPDATED`, `STUDENT_STATUS_CHANGED`, `STUDENT_QR_REGENERATED`, `GROUP_CREATED`, `GROUP_UPDATED`, `GROUP_STATUS_CHANGED`, `STUDENT_GROUP_ASSIGNED`, `STUDENT_GROUP_WITHDRAWN`, and `STUDENT_GUARDIAN_LINKED`.
6. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.26` with 789/789 passing assertions (100% PASS). Marked Phase 27 as `NOT STARTED`.

## ADR-027: Phase 27 Academic Operations & Teaching Workflow Architecture

### Context
Phase 27 connects Academic Structure, Teachers, Subjects, Groups, Students, and Guardians into an integrated teaching workflow (`firebase/academic_operations_service.js`), supporting qualified teacher-group assignments, class session scheduling, room & teacher schedule conflict prevention (`SESSION_SCHEDULE_CONFLICT`), session attendance recording, strict teacher role isolation, and audit logging.

### Decision
1. **Academic Operations Service (`firebase/academic_operations_service.js`)**: Implemented trusted backend API for teacher group assignment (`assignTeacherToGroup`), session lifecycle management (`createSession`, `getSession`, `updateSession`, `setSessionStatus`, `listSessions`), and session attendance (`recordSessionAttendance`, `listSessionAttendance`).
2. **Teacher Qualification Verification**: `assignTeacherToGroup` validates that the assigned teacher possesses matching subject (`assignedSubjects`) and stage/level (`assignedLevels`) qualifications and is in `ACTIVE` status before linking to a group (`TEACHER_NOT_QUALIFIED`, `INACTIVE_TEACHER`).
3. **Schedule Conflict Engine**: `createSession` checks overlapping time windows for the same room or teacher on a session date, throwing `SESSION_SCHEDULE_CONFLICT`.
4. **Teacher Role Isolation & Boundaries**: Teachers can view and record attendance ONLY for sessions and groups assigned directly to them (`TEACHER_NOT_ASSIGNED_TO_GROUP`). Cross-tenant operations reject with `CROSS_TENANT_VIOLATION`.
5. **Admin Web Extensions (`admin-web/src/components/academic/TeachingOperationsManager.tsx`)**: Responsive, Arabic RTL console for session scheduling, teacher-group qualification checking, and session attendance recording.
6. **Auditable System Events**: Emits `TEACHING_ASSIGNMENT_CHANGED`, `SESSION_CREATED`, `SESSION_UPDATED`, `SESSION_STATUS_CHANGED`, and `SESSION_ATTENDANCE_RECORDED`.
7. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.27` with 803/803 passing assertions (100% PASS). Marked Phase 28 as `NOT STARTED`.
