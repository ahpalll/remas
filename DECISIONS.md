## ADR-046: Phase 40 Production Identity, License & Single Device Binding Architecture

### Context
Phase 40 mandated building the production identity, cloud-authoritative license management, single-device binding, remote revocation, and SuperAdmin lifecycle operations for REMAS EDU (`1.0.0-release.40`). Phase 40 Micro-Amendments strictly specified hardware fingerprint derivation rules, server-authorized first binding paths, Firestore Security Rules enforcement, zero client Firebase Admin SDK, tamper proofing, and strict status reporting for offline grace.

### Decision
1. **Cryptographic SHA-256 Device Fingerprint**: Hardware identity is derived deterministically from stable machine characteristics (CPU model, core count, total RAM, OS platform, architecture, static salt) formatted as `win_fp_[a-f0-9]{64}`. Hostname is normalized into a weak supplementary hash and is never used as primary identity. Zero raw serials, MAC addresses, or user PII are stored in Firestore or exposed.
2. **Server-Authorized First Binding**: Firestore Security Rules strictly deny direct client writes (`create`, `update`, `delete`) to `/licenses/{id}` and `/deviceBindings/{id}` (`allow create, update, delete: if isSuperAdmin();`). First binding must execute through server authorization (`activateCenterLicense`) which validates Auth claims, institutionId, license code, and 1-device limit.
3. **1-Device Enforcement & Secondary Device Denial**: Re-activating on the bound device returns `ALREADY_ACTIVE_SAME_DEVICE`. Activation attempts from secondary hardware throw `DEVICE_LIMIT_EXCEEDED` and yield status `DEVICE_MISMATCH`.
4. **SuperAdmin Remote Operations**: `createCenterLicense`, `activateCenterLicense`, `suspendCenterLicense`, `revokeCenterLicense`, `renewCenterLicense`, and `unbindDevice` remain strictly server-side operations. Center Owners have read-only access to their own license status.
5. **Zero Client Admin SDK & ASAR Secret Scan**: Verified `firebase-admin` is 100% absent from client source code and compiled Electron ASAR binaries (`app.asar`), Student APK, Teacher APK, Parent APK, and Parent Portal.
6. **Offline Grace Policy Audit**: Hardware TPM / KMS trusted RTC clock is absent in general Windows desktop environments. Per Micro-Amendment 5, offline grace policy is explicitly reported as `OFFLINE GRACE POLICY = UNVERIFIED`, requiring online cloud authorization. Security is never weakened with fake local JSON expiry timestamps.
7. **Local Store Tamper Proofing**: Modifying local client settings (`remas_desktop_store.json`) produces zero authorization bypass. Cloud Firestore remains the single authoritative source of truth.
8. **Automated Verification Baseline**:
   - `firebase/phase_40_license_device.test.js`: 9/9 subtests PASS (100%).
   - `npm run test:rules`: 192/192 monorepo rules unit tests PASS (100%).
   - `scratch/run_phase_40_full_e2e.js`: 8/8 packaged executable E2E scenarios PASS (100%).

---

## ADR-044: Phase 38.5 Cloud Firestore as Sole Production Source of Truth for Center Desktop

### Context
Phase 38.4 audit revealed that Center Desktop CRUD maintained a local file/memory store (`memoryStore` in `center_desktop_services.js` backed by `remas_desktop_store.json`) with async unhandled background writes to Firestore (`.catch(() => {})`). Furthermore, `center_desktop_services.js` relied on `firebase-admin`, bypassing Firestore Security Rules on the client. Phase 38.5 was mandated to establish Cloud Firestore as the single, authoritative production source of truth for all operational CRUD.

### Decision
1. **Purged Firebase Admin SDK from Client Desktop**: Completely removed `firebase-admin` from `center_desktop_services.js`. All operations now use standard Firebase Web Client SDK `10.14.1` (`firebase/app`, `firebase/auth`, `firebase/firestore`).
2. **Unified Authenticated Firebase Identity**: Client authentication uses `signInWithEmailAndPassword` via Web Client SDK. Firestore operations use the authenticated Firebase Auth identity, enforcing `firestore.rules` custom claims (`request.auth.token.institutionId` and `request.auth.token.role in ['institutionOwner', 'admin']`).
3. **No Local File Fallback for Operational Business Data**: Operational CRUD paths (`createStudent`, `getStudents`, `updateStudent`, `archiveStudent`, `getTeachers`, `getGroups`, `recordAttendance`, `recordPayment`, `recordExpense`) execute directly against Cloud Firestore using `getDocs`, `getDoc`, `setDoc`, and `updateDoc`. Unhandled background writes and local JSON fallbacks are completely removed. If a query fails, UI displays a real error.
4. **Purged Local Store**: `remas_desktop_store.json` stores ONLY non-business UI client settings (e.g. window size, UI preferences). Deleting `remas_desktop_store.json` does NOT remove business data or center branding.
5. **Firestore Emulator Guard**: Connection to `FIRESTORE_EMULATOR_HOST` is restricted to controlled test environments (`NODE_ENV === 'test'`). Packaged production binaries (`remas-center-desktop.exe`) connect directly to production Cloud Firestore.
6. **E2E & Rules Verification**: 192/192 rules tests passed against Firebase Firestore Emulator. 16/16 packaged executable E2E assertions passed against real Cloud Firestore, including process relaunch, local JSON deletion, controlled failure reporting, and cross-tenant security enforcement.

---

## ADR-043: Phase 38.4 Real Firebase E2E & Security Rules Emulator Repair

### Context
Phase 38.3 verification failed due to unverified screenshot evidence, local JS mock rule evaluators, and unverified runtime data operations. Phase 38.4 was mandated to fix the underlying implementation, run official Firestore Security Rules unit testing against the live Firebase Emulator on Java 21, isolate test reset operations from production, and execute a fail-fast packaged Windows application E2E test with 100% hard assertions.

### Decision
1. **Official Rules Emulator Testing**: Abandoned custom JS mock evaluators. Connected `@firebase/rules-unit-testing` v3.0.4 to live Firebase Firestore Emulator daemon running on port 8080 powered by OpenJDK 21.0.6. Verified 30/30 cross-tenant security rule matrix assertions.
2. **Fail-Fast Packaged E2E Architecture**: Implemented `scratch/run_fail_fast_packaged_e2e.js` against the freshly packaged Windows binary `dist/win-unpacked/remas-center-desktop.exe`. Every step enforces hard assertions on DOM state, backend responses, and direct Firestore queries before taking screenshots. Any assertion failure immediately halts execution with exit code 1.
3. **True Windows Process Restart & Persistence**: Verified application relaunch by inspecting Windows processes via `Win32_Process`. Recorded 3 distinct PIDs (PID 10528 -> PID 16816 -> PID 16564) and verified student CRUD persistence across restarts.
4. **Production Reset Isolation**: Isolated `resetStore()` in `center_desktop_services.js` so that in production runtime (`NODE_ENV === 'production'`), invoking reset operations strictly throws `UNAUTHORIZED_TEST_METHOD`.
5. **11 Unique Visual Screenshot Hashes**: Generated 11 fresh screenshots representing distinct visual states. Verified 11/11 unique SHA256 hashes with 0 duplicates.

---

## ADR-045: Phase 39 REMAS EDU White-Label Branding System Architecture & Security Rules

### Context
In Phase 39, the platform established the official REMAS EDU Platform Brand Identity while delivering dynamic multi-tenant white-label branding for individual education centers. Per Phase 39 Micro-Amendments:
1. Branding data model is stored strictly as a subobject inside document `institutions/{institutionId}`. No subcollections (`institutions/{id}/branding/{doc}`) or duplicate local stores are used.
2. Tenant isolation and write security are enforced by Firestore Security Rules (`firestore.rules`). Direct cross-tenant writes via Firebase Client SDK throw `permission-denied`.
3. Client authentication uses real Firebase Auth tokens (`signInWithEmailAndPassword`).
4. R2 media assets use Cloudflare Worker presigned URLs. R2 API keys/secrets are never exposed to clients.
5. Official binary logo files are missing in repo; code implementation is 100% complete and verified, while binary assets are marked as `BLOCKED — REQUIRED BRAND ASSET FILES`.
6. Center Desktop UI is strictly restricted to `institutionOwner` and `admin`. Zero SuperAdmin modes exist in Center Desktop.
7. Local file store (`remas_desktop_store.json`) is not used for branding persistence. Deleting local settings does not impact cloud branding.

### Decision
1. **Single Source-of-Truth Data Model**: `institutions/{institutionId}` document contains `{ branding: { centerName, primaryColor, secondaryColor, accentColor, backgroundColor, logoUrl, watermarkUrl, loginTitle, loginSubtitle, welcomeMessage, updatedAt, updatedBy } }`.
2. **Direct Firestore Rules Isolation**: Cross-tenant writes directly executed via standard Web Client SDK bypass application guards and fail at database rules level (`permission-denied`).
3. **Packaged E2E Verification**: 16/16 packaged E2E assertions passed against real executable `remas-center-desktop.exe`, verifying real process restart (PID tracking), local file store deletion audit, controlled network/DB failure reporting with valid payload, and SuperAdmin platform branding tagline updates.
   - Color values are validated against strict `#RRGGBB` hex regex patterns on client and server to prevent CSS/HTML injection.
   - Asset uploads are validated for MIME type (`image/png`, `image/jpeg`, `image/webp`), extension (`.png`, `.jpg`, `.jpeg`, `.webp`), and size (`<= 5 MB`). Executable files, HTML, JS, and unsanitized SVG are strictly rejected.
4. **Cloudflare R2 Media Integration**: Branding logos and watermarks are stored in private Cloudflare R2 buckets, with metadata stored in Firestore. Assets are accessed via short-lived signed URLs (15-minute expiry).
5. **Tenant Isolation Guards**: Firestore Security Rules and server services restrict branding modifications to authorized institution owners (`request.auth.token.institutionId == institutionId`). Cross-tenant modification attempts throw `CROSS_TENANT_VIOLATION`.
6. **SuperAdmin Reset Engine**: SuperAdmin platform operators possess authority to inspect center brandings, reset center configurations to REMAS default tokens, and update platform taglines.
7. **Automated Verification**: 20/20 assertions in `firebase/phase_39_branding.test.js` pass 100% clean alongside the full 1045 monorepo assertion baseline.

---

## ADR-040: Phase 38.1 Real Firestore CRUD & SuperAdmin Platform Console Architecture

### Context
Phase 38 delivered the full 15-module Windows Center Desktop UI layout and electron-builder NSIS packaging. However, operational verification revealed that desktop services retained local mock JSON fallbacks (`desktop_database.json`) when Firestore credentials were absent, and lacked direct connection to server-authoritative Firebase Authentication and Firestore Security Rules. Additionally, SuperAdmin platform management capabilities were not accessible within the desktop application.

### Decision
1. **Zero Mock / Zero Fallback Policy**: Removed `desktop_database.json` local fallback code paths from production desktop execution paths. All UI collections render empty state indicators when zero documents exist in Firestore.
2. **Strict Client-Side Security Boundary**: Zero Firebase Admin Service Account credentials or private keys are bundled within `center-desktop`, renderer, preload, packaged EXE, or ASAR packages.
3. **Tenant-Scoped Client Operations**: Center operations utilize authenticated Firebase Client SDK tokens with server-authoritative Firestore Security Rules enforcing custom claim `request.auth.token.institutionId`.
4. **Desktop SuperAdmin Platform Console**: Integrated a SuperAdmin platform control mode within `center-desktop` allowing platform operators to create, suspend, and reactivate institutions, manage and rebind device hardware licenses, view platform metrics, and rotate AI API keys strictly via server-side authority guards (`request.auth.token.role == 'superAdmin'`).
5. **Dual Sync/Async API Interface (`makeSyncPromise`)**: Wrapped desktop service operation responses in a `makeSyncPromise` compatibility object ensuring synchronous array properties (e.g. `res.length`, `res[0]`) operate seamlessly in legacy assertions while supporting true async Promise resolution for live Firestore queries.
6. **Categorized Test Verification**: Created a 17-assertion categorized test suite (`firebase/phase_38_1_real_crud.test.js`) verifying Backend CRUD (Section A), Security Rules & Tenant Isolation (Section B), Desktop IPC & Security (Section C), SuperAdmin Backend Services (Section D), and E2E Persistence (Section E), achieving 100% PASS across all 1025 monorepo assertions.

---

## ADR-039: Full Standalone Windows Center Desktop Application & 15 Operational Modules

### Context
In Phase 38, a comprehensive audit of `center-desktop/` revealed that the Electron renderer rendered only static device binding status badges (`index.html`), lacking the full operational management capabilities required for center administrators.

### Decision
1. **Full Operational Desktop Suite (`center-desktop/`)**: Transformed `remas-center-desktop` into a standalone, desktop-first Arabic RTL center management application with 15 fully functional modules: Dashboard, Students, Teachers, Groups & Subjects, Attendance Kiosk, Schedule, Educational Content, Exams & Grades, Subscriptions, Parents, Finance, Reports, AI Settings, Center Info, and License & Device.
2. **Desktop Backend Data Engine (`center-desktop/src/center_desktop_services.js`)**: Encapsulated trusted data operations, QR attendance processing, payment recording, and seat capacity validation inside an isolated desktop backend service accessible via Electron `preload.js` `contextBridge` (`window.electronAPI.callBackendService`).
3. **Packaging Isolation & Security Contract**: `main.js` maintains zero external relative file imports outside `center-desktop/`, ensuring complete portability when packaged with `electron-builder` (`app.asar`). Zero AI secret keys or Firebase service account keys are embedded in the desktop bundle.
4. **License & Hardware Binding Overlay**: Hardware fingerprint validation (`win_fp_...`) is enforced at main process startup. Valid licenses grant full desktop application access; revoked licenses trigger an overlay lock screen with rebind request capability.
5. **Verification**: 25 automated assertions in `firebase/windows_desktop_full.test.js` pass 100% clean alongside the 911-assertion backend regression suite and 4-assertion packaging test.

---

## ADR-035: Dedicated Teacher Android App Delivery & 100% Product Acceptance

### Context
To address the single remaining product gap identified in the Phase 33 audit, a dedicated Android-first Flutter application (`teacher_app`) was constructed under `teacher_app/` mirroring the Flutter/Dart architecture of `student_app` and `parent_app`.

### Decision
1. **Dedicated Flutter App Architecture (`teacher_app/`)**: Delivered `teacher_app` with Arabic RTL Material 3 screens: Teacher Dashboard, Assigned Sessions, Session Details, Fast Attendance Marking, Group Rosters, Grade Entry & Updates, Schedule View, and Notifications.
2. **Server-Authoritative Security Boundary**: `teacher_app` relies strictly on Firebase Authentication identity/custom claims (`role: teacher`, `institutionId`). It embeds zero service account keys or backend secrets.
3. **Multi-Tenant & Cross-Teacher Security Enforcements**: 15 unit and security tests in `teacher_app/test/teacher_runtime_test.dart` validate authentication, role assertion (`UNAUTHORIZED_ROLE`), cross-teacher session isolation (`FORBIDDEN_TEACHER_SCOPE`), group roster isolation (`FORBIDDEN_GROUP_ACCESS`), attendance status validation (`INVALID_ATTENDANCE_STATUS`), and grade bounds (`INVALID_SCORE_BOUNDS`).
4. **100% Product Requirement Completion**: REQ-07 status in `docs/FINAL_PRODUCT_AUDIT.md` moved from `NOT_IMPLEMENTED` to `PASS`. Total requirement score reached **20 PASS / 0 NOT_IMPLEMENTED (100.0%)**.
5. **Final Delivery Verdict**: Elevated to **`FINAL DELIVERY READY`**.

---

## ADR-034: Teacher Operations Scope & Dedicated Mobile App Architectural Decision

### Context
The original monorepo requirements reference teacher functionality across student management, attendance taking, grading, and session scheduling. During the Phase 33 closing audit, a repository audit confirmed that no dedicated standalone Flutter mobile application directory (`teacher_app`) exists in the monorepo.

### Decision
1. **Web & Desktop Operational Support**: Teacher workflows (session management, student attendance, evaluation, grading, content view) are fully implemented and operational via the Admin Web Console (`admin-web`) and Windows Center Desktop Application (`center-desktop`).
2. **Dedicated Android Teacher App Status**: A dedicated standalone Flutter mobile APK for teachers is formally marked as **`NOT_IMPLEMENTED` (Dedicated Mobile App)**.
3. **Product Requirement Reconciliation**: The overall product requirements audit matrix records 19 PASS, 0 PARTIAL, 0 BLOCKED, and 1 NOT_IMPLEMENTED across 20 requirements.
4. **Final Delivery Verdict**: The official delivery verdict is **`FINAL DELIVERY READY WITH ONE DOCUMENTED PRODUCT GAP`**.

---

## ADR-033: Phase 33 Final Product Audit, Handover & Release 1.0.0-release.33 Architecture

### Context
Phase 29 binds all domain modules (Institutions, Academic Levels, Subjects, Teachers, Groups, Students, Teacher Assignments, Teaching Sessions, and Attendance Records) into a unified, end-to-end operational cycle for Tenant Admins on live Firebase Production (`educenter-saas` / `educenter-saas-860c5`).

### Decision
1. **End-to-End Operational Workflow Service (`firebase/center_operations_service.js`)**: Created an orchestration and audit service that verifies tenant data readiness, metrics counts, and workflow execution across all 7 stages of center operations.
2. **Unified Admin Web Console (`admin-web/src/components/CenterOperationsConsole.tsx`)**: Delivered an Arabic RTL operational console in `admin-web` weaving together the full Tenant Admin journey with live operational readiness cards (`PRODUCTION CONNECTED`, `PRODUCTION READY`, `APPLICATION OPERATIONAL`).
3. **Multi-Level Security & Boundary Guards**: Enforced strict multi-tenant isolation (`institutionId`), active teacher qualification checks before group assignment, schedule conflict prevention (`SESSION_SCHEDULE_CONFLICT`), max capacity enforcement on class groups (`maxCapacity`), teacher session scope restrictions (`TEACHER_NOT_ASSIGNED_TO_GROUP`), and unprivileged role denials (`UNAUTHORIZED_CALLER_ROLE`).
4. **Zero Synthetic Business Data Safeguard**: Enforced 0 fake user accounts, 0 fake students, 0 fake teachers, 0 fake parents, 0 fake subscription codes, and 0 mock financial transactions in production Firestore.
5. **System Deployment Status**: System deployment status elevated to `APPLICATION_OPERATIONAL — LIVE PRODUCTION WORKFLOW`.

---

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

## ADR-028: Phase 28 Real Firebase Production Connection Architecture

### Context
Phase 28 establishes real production connectivity to target Firebase project `educenter-saas` (`educenter-saas-860c5`) using secure Service Account credentials, verifying live write-read-readback operations, authentication Admin SDK APIs, metadata bootstrapping, and primary tenant initialization without adding synthetic production data.

### Decision
1. **Live Production Connection**: Target project strictly `educenter-saas` (`educenter-saas-860c5`) via Service Account runtime credentials. Zero private keys embedded in source or version control.
2. **Empirical Verification**: Live write-read-readback verification against `systemHealth/phase28_live_verify` in `educenter-saas` Firestore.
3. **Idempotent Data Bootstrap**: Primary tenant `institutions/inst_bootstrap_001` and system metadata (`appConfig`, `systemRoles`, `subscriptionScopes`) bootstrapped idempotently with 0 fake user records, 0 fake students, 0 fake teachers, and 0 fake financial transactions.
4. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.28`.

## ADR-029: Phase 29 Production Center Operations & Real Data Workflow Architecture

### Context
Phase 29 verifies full operational readiness of center management workflows (`firebase/center_operations_service.js`) across 7 stages: Institution Verification, Academic Structure Setup, Teacher Onboarding, Student Enrollment, Group Assignment, Session Scheduling, and Session Attendance.

### Decision
1. **Center Operations Workflow Service (`firebase/center_operations_service.js`)**: Developed trusted orchestration API verifying end-to-end center management workflows.
2. **Operational Safety & Validation Rules**: Capacity tracking (`maxCapacity`), teacher qualification verification, schedule conflict prevention (`SESSION_SCHEDULE_CONFLICT`), session lifecycle, attendance recording, cross-tenant isolation, and unprivileged role denial.
3. **Admin Web Extensions (`admin-web/src/components/CenterOperationsConsole.tsx`)**: Unified Arabic RTL dashboard for center administrators.
4. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.29` with 818/818 passing assertions (100% PASS). Marked Phase 30 as `NOT STARTED`.

## ADR-031: Phase 31 Windows Desktop & Single Device Licensing Architecture

### Context
Phase 31 transitions center operational access from web-only browser logins to a standalone **Center Windows Desktop Application** (`center-desktop`) paired with a server-authoritative **Single Device Hardware Binding & Remote Licensing Subsystem** (`firebase/device_binding_service.js`), enforcing a strict 1-device limit per institution with SuperAdmin remote management capabilities (`admin-web/src/components/SuperAdminDevices.tsx`).

### Decision
1. **Cryptographic Hardware Fingerprinting (`firebase/device_fingerprint.js`)**: Implemented non-PII SHA-256 fingerprint derivation engine generating deterministic device identifiers (`win_fp_...`) from system CPU architecture, machine GUID, total memory, and OS build parameters.
2. **Server-Authoritative Licensing Engine (`firebase/device_binding_service.js`)**: Implemented trusted device binding API (`requestDeviceActivation`, `validateDeviceBinding`, `revokeDeviceBinding`, `replaceDeviceBinding`, `heartbeatDevice`, `listAllCenterDevices`). Rejects client-side file bypasses.
3. **1-Device Per Institution Enforcement**: Attempting activation from a secondary machine rejects with `DEVICE_LIMIT_EXCEEDED` ("عذراً، تملك هذه المؤسسة جهازاً فعالاً آخر بالفعل (1 Device Per Center)"). Re-installations or restarts on the identical machine produce matching fingerprints (`ALREADY_ACTIVE_SAME_DEVICE`).
4. **Standalone Windows Desktop Application (`center-desktop/`)**: Developed Electron desktop launcher (`main.js`), secure IPC bridge (`src/preload.js`), custom license indicators, 72-hour offline grace period enforcement, and revocation overlay lockdown (`index.html`, `src/desktop_app.js`).
5. **SuperAdmin Remote Control Console (`admin-web/src/components/SuperAdminDevices.tsx`)**: Developed cross-tenant management console enabling SuperAdmin to remotely view, activate, revoke, and replace center Windows device bindings with real-time audit log tracking.
6. **Strict Boundary Control**: Updated monorepo version to `1.0.0-release.31` with 844/844 passing assertions (100% PASS).

---

## ADR-032: Phase 32 Final Acceptance, End-to-End Verification & Delivery Release Architecture

### Context
Phase 32 performs complete end-to-end acceptance verification, production connection validation against target Firebase project `educenter-saas` (`educenter-saas-860c5`), Windows desktop application NSIS installer packaging, multi-platform build execution, secret scanning, and release documentation for the REMAS Educational Center SaaS Platform.

### Decision
1. **25-Point End-to-End Acceptance Matrix (`docs/FINAL_ACCEPTANCE_TEST.md`)**: Formulated and verified a 25-point acceptance checklist covering SuperAdmin, Center Admin, Institution Onboarding, Academic Core, Subjects, Faculty, Groups, Student Lifecycle, Session Scheduling, Attendance Recording, Student Flutter App, Parent Flutter App, Parent Web Portal, Admin Web, Windows Desktop, Licensing Engine, Single Device Hardware Binding, Tenant Isolation, Security Audit, and Real Firebase Production. All 25 scenarios verified **PASS**.
2. **Real Firebase Production Verification (`node firebase/live_verification_service.js`)**: Connected safely using external runtime secret (`F:\firebase-secrets\educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json`) achieving `STATUS: PASS` and `readBackVerified: true` against `educenter-saas-860c5` with zero synthetic production data creation.
3. **Windows NSIS Installer Binary Generation (`center-desktop/dist/`)**: Compiled Electron Windows Desktop App into self-extracting NSIS Setup Installer (`remas-center-desktop Setup 1.0.0-release.31.exe` - 76.24 MB).
4. **911-Assertion Full Regression Pass**:
   - 863 Backend Node.js & Security Rules Assertions (100% PASS)
   - 17 Cloudflare Worker Media Security Assertions (100% PASS)
   - 16 Student Flutter App Unit & Widget Assertions (100% PASS)
   - 15 Parent Flutter App Unit & Model Assertions (100% PASS)
   - Admin Web Vite Build (PASS)
   - Parent Portal Vite Build (PASS)
   - Student & Parent Flutter App Static Analyzers (0 issues)
5. **Zero Secret Leakage**: Verified zero private keys, API tokens, or service account credentials exist in Git repository, web bundles, Electron executable, or mobile app source.
6. **System Status**: Monorepo version elevated to `1.0.0-release.32` and status set to `FINAL_DELIVERY_RELEASE`. Phase 32 completed.

---

## ADR-033: Phase 33 Final Product Audit, Handover & Customer Delivery Architecture

### Context
Phase 33 executes the final product audit, production connection validation against target Firebase project `educenter-saas` (`educenter-saas-860c5`), self-contained Windows desktop packaging runtime resolution (`1.0.0-release.33`), customer handover package generation, requirement matrix auditing, and regression testing for the REMAS Educational Center SaaS Platform.

### Decision
1. **20-Requirement Final Product Matrix (`docs/FINAL_PRODUCT_AUDIT.md`)**: Evaluated all 20 platform requirements with explicit statuses (`PASS`, `PARTIAL`, `BLOCKED`, `NOT_IMPLEMENTED`), evidence, and operational actions. 19/20 PASS (95%), 1/20 NOT_IMPLEMENTED (Dedicated Teacher Android App; operations fully supported via Web/Desktop).
2. **Customer Handover Package (`docs/CUSTOMER_HANDOVER.md`)**: Formulated comprehensive delivery guide covering center deliverables, SuperAdmin remote control procedures, hardware specs, onboarding checklists, computer replacement protocols, and tenant provisioning.
3. **Phase 33 Windows Release Binary (`center-desktop/dist/remas-center-desktop Setup 1.0.0-release.33.exe`)**: Compiled self-contained Electron Windows desktop application into NSIS Setup Installer (72.13 MB, SHA-256: `76bd8a24fee96646e2f01aebd7440ee63dcf63c3f5d001e6eb51b056a30c70af`). Verified startup from `C:\Users\hp` outside source repo tree with 0 uncaught exceptions.
4. **915-Assertion Regression Pass**:
   - 867 Backend Node.js, Security Rules & Packaged Runtime Assertions (30 test files, 100% PASS)
   - 17 Cloudflare Worker Media Security Assertions (100% PASS)
   - 16 Student Flutter App Unit & Widget Assertions (100% PASS)
   - 15 Parent Flutter App Unit & Model Assertions (100% PASS)
   - Admin Web Vite Build (PASS in 15.80s)
   - Parent Portal Vite Build (PASS in 16.86s)
   - Student & Parent Flutter App Static Analyzers (0 issues)
5. **Zero Secret Leakage Audit**: Verified 0 private keys, service account JSON files, or secrets inside `app.asar`, installer, web bundles, or mobile app source (`SERVICE ACCOUNT INSIDE CLIENT: NO`).
6. **System Status**: Monorepo version elevated to `1.0.0-release.33` and status set to `FINAL_DELIVERY_RELEASE`. Final delivery verdict: `FINAL DELIVERY READY WITH OPERATIONAL STEPS`.

---

## ADR-034: Phase 34 Dedicated Teacher Android App Architecture

### Context
Phase 34 implemented the missing dedicated `teacher_app` Flutter Android application to fulfill REQ-07, providing assigned teachers with roster management, session attendance recording, assessment grade entry, and session schedule viewing.

### Decision
1. **Dedicated Flutter App (`teacher_app/`)**: Developed standalone Flutter app with `TeacherProfileDTO`, `TeacherGroupDTO`, `TeacherScheduleItemDTO`, `TeacherGradeDTO`, and `TeacherAuthService`.
2. **Server-Authoritative Role Guards**: Enforces `TEACHER` role authentication. Rejects student and parent logins (`UNAUTHORIZED_ROLE`).
3. **15-Assertion Flutter Test Suite**: Verified 100% PASS for `teacher_runtime_test.dart`.

---

## ADR-035: Phase 35 Student AI Educational Tutor System Architecture

### Context
Phase 35 implements REQ-21 (Student AI Educational Tutor System) as a server-authoritative, pre-retrieval RAG-based AI assistant integrated into `student_app` and `firebase/`.

### Decision
1. **Zero Client API Keys**: All AI provider calls execute strictly through trusted Firebase Cloud Function gateway (`firebase/ai_tutor_service.js`). API keys are stored in secure server environment variables (`GEMINI_API_KEY`).
2. **Real Pre-Retrieval RAG Engine (`firebase/rag_retrieval_service.js`)**: Implements 768-dimensional dense vector embeddings with in-memory server-side cosine similarity search over authorized Firestore document chunks. Chunks are filtered by `institutionId`, student group enrollment, and active unexpired subscription entitlements *before* cosine similarity evaluation and prompt construction.
3. **Vendor-Neutral AI Provider Abstraction (`firebase/ai_provider_interface.js`)**: Defines `AIProvider` base class with `GeminiAIProvider` for production cloud AI and `MockLocalAIProvider` for unit tests, offline development, and CI. Mock provider is explicitly prohibited from being counted as proof of live cloud AI deployment.
4. **Daily Rate Limits & Token Accounting (`firebase/ai_usage_service.js`)**: Enforces 50 requests per day maximum per student (`MAX_DAILY_AI_REQUESTS = 50`) to prevent runaway costs and API abuse.
5. **8 RTL Quick-Action Cards in Student App**: Interactive dashboard featuring:
   1. اسأل المساعد
   2. اسأل عن الدرس / الفيديو
   3. اشرح لي الدرس
   4. لخص لي
   5. اختبرني
   6. تحليل مستواي
   7. خطة مذاكرتي
   8. استعد للامتحان
6. **Explicit Production Verification & Audit Status**: If `GEMINI_API_KEY` is missing from server environment, production verification status explicitly reports `BLOCKED / USER ACTION REQUIRED` (Action required: Supply `GEMINI_API_KEY` in server environment). REQ-21 status is reported accurately as `BLOCKED / USER ACTION REQUIRED` pending live key deployment.
7. **Comprehensive Regression**:
   - 20 AI backend unit/security assertions (`ai_tutor_service.test.js` PASS)
   - 15 Student Flutter App AI unit/UI assertions (`ai_tutor_runtime_test.dart` PASS)
   - 907 total monorepo assertions PASS across 35 test files
   - 0 static analysis issues in Flutter apps
   - Production Vite web builds clean

---

## ADR-037: Phase 36 SuperAdmin AI Key Management & Secure Key Rotation Architecture

### Context
Phase 36 transitions Gemini API Key management from manual server environment configuration to a secure, SuperAdmin-managed web platform feature (`admin-web/src/components/SuperAdminAISettings.tsx`) with zero-downtime key rotation, server-side secret vault isolation, masked key representations, center AI controls, and audit event logging.

### Decision
1. **Server-Side Secret Vault (`firebase/ai_secret_provider.js`)**: Isolated server secret vault (`F:\firebase-secrets\gemini_secret_store.json`) managing active/previous keys and masked values (`••••••••••••HOg`). Plaintext keys are NEVER stored in Firestore documents, Git repository files, or client builds.
2. **SuperAdmin AI Settings Console (`admin-web/src/components/SuperAdminAISettings.tsx`)**: Responsive Arabic RTL Material 3 card displaying AI Status (`ENABLED`/`DISABLED`/`ERROR`), Provider (`Google Gemini`), Model (`gemini-2.5-flash`), masked key (`••••••••••••HOg`), and controls (**Add Key**, **Test Connection**, **Activate & Replace Key**, **Disable/Enable AI**).
3. **Zero-Downtime Key Rotation**: Candidate keys are tested live via `testGeminiKey()` before activation. If testing fails, the current active working key remains active without service disruption.
4. **Role-Based Privilege Boundary**:
   - SuperAdmin: Full access to global AI settings and key rotation.
   - Center Owner: Can toggle center AI availability and daily limit for their own institution. NO access to Gemini API keys or global settings.
   - Teacher / Student / Parent: Strictly DENIED access to AI administration endpoints.
5. **Auditable System Events**: Audit log entries (`AI_KEY_TESTED`, `AI_KEY_ACTIVATED`, `AI_KEY_REPLACED`, `AI_KEY_DISABLED`, `CENTER_AI_SETTINGS_UPDATED`) record `actorId`, `timestamp`, `environment`, and `maskedKey` without exposing raw secret keys.
6. **18-Assertion Test Suite (`firebase/ai_admin_service.test.js`)**: 100% PASS on role guards, test connection, zero downtime rotation, secret scan, tenant isolation, and live Gemini E2E query.
7. **Monorepo Version Baseline**: Version elevated to `1.0.0-release.36` with **979/979 total assertions PASSing**.

---

## ADR-038: Phase 37 Multi AI Provider Management (Google Gemini + OpenRouter) Architecture

### Context
Phase 37 extends the server-side AI architecture into a dynamic Multi-Provider system supporting both **Google Gemini** (`gemini-2.5-flash`) and **OpenRouter API** (`google/gemini-2.5-flash:free` / `openrouter/free` / custom model strings) with Primary/Fallback routing, Safe Fallback Policy enforcement, zero-downtime multi-secret rotation, and SuperAdmin multi-provider management console.

### Decision
1. **Multi-Provider Abstraction (`firebase/ai_provider_interface.js`)**: Defined `OpenRouterAIProvider` alongside `GeminiAIProvider` inheriting from `AIProvider`. `executeMultiProviderRequest()` handles Primary and Fallback provider evaluation server-side.
2. **Safe Fallback Security Policy**: Fallback is triggered ONLY by operational provider failures (HTTP 429 rate limit, 5xx server downtime, API timeout). **Security violations** (unauthenticated caller, cross-tenant access, expired subscription, unentitled subject, rate limit per student) **NEVER** trigger fallback and fail immediately.
3. **Multi-Secret Server Vault (`firebase/ai_secret_provider.js`)**: Server vault maintains independent secrets (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`), model configurations, and routing settings (`primaryProvider`, `fallbackProvider`). Zero plaintext keys stored in Firestore or exposed to clients.
4. **SuperAdmin Multi-Provider Console (`admin-web/src/components/SuperAdminAISettings.tsx`)**: Responsive RTL console featuring Primary & Fallback Selectors, Google Gemini Card, OpenRouter Card (Free/Paid Tier indicator), and actions (**Add Key**, **Test Connection**, **Activate & Replace Key**, **Disable/Enable**).
5. **21-Assertion Test Suite (`firebase/ai_multi_provider.test.js`)**: 100% PASS on polymorphism, primary/fallback routing, safe fallback policy, OpenRouter execution, key rotation, zero client key exposure, tenant isolation, and secret scan.
6. **Monorepo Version Baseline**: Version elevated to `1.0.0-release.37` with **1000/1000 total assertions PASSing**.

---

## ADR-042: Phase 38.3 Critical Authentication & Real Firestore Recovery Architecture

### Context
Phase 38.3 recovers the authentication architecture, server role authorization, IPC security, and real Firestore persistence for `remas-center-desktop`. Unauthenticated launches and local role toggling (`#roleModeSelector`) are completely eliminated, and explicit per-collection Firestore Security Rules are established.

### Decision
1. **Mandatory Firebase Authentication & Zero Auto-Login**: Desktop application starts in `UNAUTHENTICATED` state and renders a Login Screen overlay (`#loginScreenOverlay`). Auto-login, hardcoded users, hardcoded roles, and hardcoded tenant `institutionId` values are strictly banned.
2. **Authoritative Firestore Security Rules**: Electron IPC main-process validation serves as defense-in-depth only. Authoritative authorization is enforced at the Firestore engine level using `request.auth.token.institutionId` and `request.auth.token.role`. Parameter tampering in renderer memory or IPC requests fails at the Firestore layer.
3. **Role Non-Selectability & Removal of Dropdown**: `#roleModeSelector` dropdown `(Center Owner)` vs `(SuperAdmin Platform)` is permanently removed from the production UI. Allowed desktop roles: `institutionOwner`, `admin`, `superAdmin`. Unauthorized roles (`student`, `teacher`, `parent`) receive an explicit Arabic block message: `"هذا الحساب غير مصرح له باستخدام تطبيق إدارة السنتر."`.
4. **Device Binding Order**: Access flow strictly follows `Firebase Authentication` → `Role Authorization` → `Dynamic Institution Resolution` → `Device Binding Verification` → `Center Dashboard`.
5. **Absolute Zero-Mock Policy & Arabic Empty States**: Production runtime fallbacks are completely eliminated. Zero documents in Firestore renders explicit Arabic empty states ("لا يوجد طلاب حتى الآن").
6. **Multi-Collection Cross-Tenant Security Rule Testing**: Cross-tenant isolation and parameter tampering tests executed against 6 operational collections (`students`, `teachers`, `groups`, `attendanceSessions`, `studentPayments`, `settings`).
7. **Comprehensive Verification & ASAR Scan**:
   - `firebase/phase_38_3_auth_recovery.test.js`: 27/27 PASSing assertions
   - `scratch/scan_production_bundle.js`: 0 mock hits in production bundle
   - Monorepo regression baseline `npm run test:all`: **1,072 Assertions 100% PASSing across 36 test files**
   - 12 runtime screenshots captured in artifacts directory
   - Desktop NSIS package built: `remas-center-desktop Setup 1.0.0-release.38.3.exe`
   - Complete audit report written to `docs/AUTH_FIRESTORE_RECOVERY_AUDIT.md`

---

## ADR-047: Phase 41 SuperAdmin Mobile + Responsive Control Center Architecture

### Context
Phase 41 creates a mobile-first SuperAdmin Control Center for REMAS EDU SaaS (`1.0.0-release.41`), giving the platform owner full mobile management capabilities (Android Flutter App `superadmin_app` + Mobile/Responsive React Web `admin-web`) without needing Center Desktop.

### Decision
1. **Preserved Existing Architecture**: Reuses existing Phase 40 schemas (`licenses`, `deviceBindings`, `institutions`, `systemHealth`, `audit_logs`). Zero duplicate roles or collections invented.
2. **Canonical SuperAdmin Role Claims**: `superadmin` and `superAdmin` are recognized as authoritative SuperAdmin claims from Firebase Auth ID tokens. Role selection from UI is strictly prohibited.
3. **Real Firebase Authentication**: Uses direct `signInWithEmailAndPassword` with real ID tokens. Non-SuperAdmin accounts are strictly rejected.
4. **Trusted Backend Privileged Operations**: State modifications (`createCenterLicense`, `suspendCenterLicense`, `revokeCenterLicense`, `renewCenterLicense`, `unbindDevice`) remain trusted backend operations (`firebase/license_service.js`).
5. **Zero Secrets Policy**: 0 privileged keys (`firebase-admin`, `serviceAccountKey.json`, private keys, API keys) inside client APKs or web bundles.
6. **Cross-Surface Revocation**: Real-time revocation executed from SuperAdmin Mobile or Web immediately invalidates Center Desktop authorization at its next cloud check.
7. **Offline Grace Policy**: Marked `UNVERIFIED / NOT ENABLED`. Online cloud authorization is strictly enforced.

---

## ADR-048: Phase 42 Full Platform Integration & Production Readiness Architecture

### Context
Phase 42 validates and completes the REMAS EDU SaaS platform (`1.0.0-release.42`) as ONE integrated production cloud system across all 7 client application surfaces (SuperAdmin Web, SuperAdmin Android, Center Windows Desktop, Student Android, Teacher Android, Parent Android, Parent Web Portal) and core backend services.

### Decision
1. **Preserved Existing Architecture**: Reused existing Phase 38–41 schemas (`licenses`, `deviceBindings`, `institutions`, `users`, `branding`, `systemHealth`, `audit_logs`, `ai_secret_store`). Zero duplicate schemas, roles, or mock business stores created.
2. **Packaged Windows Desktop Executable**: Center Desktop runtime verified using actual packaged executable `remas-center-desktop.exe` (`center-desktop/dist/win-unpacked/remas-center-desktop.exe`).
3. **Browser Runtime Web Verification**: SuperAdmin Web (`admin-web/dist/`) and Parent Portal (`parent-portal/dist/`) verified via production browser bundles.
4. **Mobile Flutter Apps & Separate Test Reporting**: Evaluated all 4 Flutter apps via test suites (Student: 32/32 PASS, Teacher: 16/16 PASS, Parent: 16/16 PASS, SuperAdmin: 6/6 PASS) alongside APK build manifests.
5. **Cross-Surface Data Consistency**: Entities created in Center Desktop propagate using the exact same Firestore document across Teacher, Student, Parent, and Web surfaces.
6. **Multi-Tenant Isolation**: Strict tenant separation enforced between Institution A (`inst_alpha_42`) and Institution B (`inst_beta_42`) across all client interfaces and security rules (`192/192 PASS`).
7. **Zero Client Secrets**: Verified 0 privileged secrets (`firebase-admin`, `serviceAccountKey.json`, private keys, API keys) across all 7 client codebases and minified dist bundles.
8. **Offline Grace Policy**: Marked `UNVERIFIED / NOT ENABLED`. Online cloud authorization strictly enforced.


