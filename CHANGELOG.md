# REMAS Educational Center SaaS Monorepo — CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-release.38] - 2026-09-10 (Phase 38: Full Windows Center Desktop Audit & Implementation)

### Added / Delivered
- **Full Standalone Center Desktop Application (`center-desktop/`)**: Upgraded `remas-center-desktop` from a static license status display into a desktop-first Arabic RTL center management suite containing 15 operational modules.
- **15 Operational Modules**: Dashboard, Students, Teachers, Groups & Subjects, Attendance Kiosk, Schedule, Educational Content, Exams & Grades, Subscriptions, Parents, Finance, Reports, AI Settings, Center Info, and License & Device.
- **Desktop Backend Data Engine (`center-desktop/src/center_desktop_services.js`)**: Isolated, server-authoritative desktop backend engine handling CRUD operations, seat capacity limits (`maxCapacity`), barcode QR attendance scanning, student payment entry, and payment receipt generation.
- **Packaging Isolation Contract**: Electron main process (`main.js`) maintains zero external directory file requires outside `center-desktop/`, ensuring seamless packaging with `electron-builder` (`app.asar`).
- **Hardware Fingerprint Overlay & Security Boundary**: Main process enforces hardware fingerprint (`win_fp_...`) binding. Valid fingerprint unlocks full desktop suite; revoked or unbound status displays interactive overlay lock screen with rebind request capability. Zero AI keys or Firebase service account keys embedded in client package.
- **25-Assertion Automated Desktop Test Suite (`firebase/windows_desktop_full.test.js`)**: 100% PASS on app init, fingerprint binding, center admin auth, student/teacher/group CRUD, attendance scanning, finance receipts, R2 media access, subscription activation, license lock screen, and zero key exposure.
- **New Windows Production Artifact**: Built `remas-center-desktop Setup 1.0.0-release.38.exe`.

---

## [1.0.0-release.37] - 2026-09-10 (Phase 37: Multi AI Provider Management - Google Gemini + OpenRouter)

### Added / Delivered
- **Multi AI Provider Architecture (`firebase/ai_provider_interface.js`)**: Implemented `OpenRouterAIProvider` alongside `GeminiAIProvider` inheriting from vendor-neutral `AIProvider` base class. Added `executeMultiProviderRequest()` for Primary and Fallback provider evaluation server-side.
- **Safe Fallback Policy**: Operational failures (HTTP 429 rate limit, 5xx server downtime, API timeout) trigger fallback to secondary provider; security & authorization errors (unauthenticated caller, cross-tenant violation, expired subscription, unentitled subject) NEVER trigger fallback.
- **SuperAdmin Multi-Provider Console (`admin-web/src/components/SuperAdminAISettings.tsx`)**: Upgraded React RTL Material 3 console featuring Primary Provider Selector (`Google Gemini` / `OpenRouter`), Fallback Provider Selector (`None` / `Google Gemini` / `OpenRouter`), Google Gemini Card, OpenRouter Card (Free/Paid Tier indicator, custom model selection), masked keys (`••••••••••••xxxx`), and action buttons (**Add Key**, **Test Connection**, **Activate & Replace Key**, **Disable/Enable**).
- **Multi-Secret Server Vault (`firebase/ai_secret_provider.js`)**: Isolated server secret vault (`F:\firebase-secrets\gemini_secret_store.json`) managing independent secrets (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`), model configurations, and routing settings. Provides zero-downtime key rotation for both providers.
- **Usage Statistics & Tracking Engine (`firebase/ai_admin_service.js`)**: Logs request metrics, successes, failures, latency, and token consumption per provider, model, institution, and date.
- **21-Assertion Automated Test Suite (`firebase/ai_multi_provider.test.js`)**: 100% PASS on provider polymorphism, primary/fallback routing, safe fallback policy, OpenRouter execution, key rotation, zero client key exposure, tenant isolation, and secret scan.
- **Monorepo Test Regression Baseline**: **1000/1000 total assertions PASSing** across 37 test files (939 Backend + 4 Packaging + 61 Mobile).

---

## [1.0.0-release.36] - 2026-09-10 (Phase 36: SuperAdmin AI Key Management & Secure Key Rotation)

### Added / Delivered
- **SuperAdmin AI Key Management UI (`admin-web/src/components/SuperAdminAISettings.tsx`)**: Material 3 Arabic RTL React console displaying AI Status (`ENABLED`/`DISABLED`/`ERROR`), Provider (`Google Gemini`), Model (`gemini-2.5-flash`), masked key (`••••••••••••HOg`), and key management action buttons (**Add Key**, **Test Connection**, **Activate & Replace Key**, **Disable/Enable AI**).
- **Server-Side Secret Vault (`firebase/ai_secret_provider.js`)**: Isolated server secret vault (`F:\firebase-secrets\gemini_secret_store.json`) providing zero-downtime key rotation, live key testing against Google Gemini API, masked representation generation, and key history retention. Plaintext keys are NEVER saved to Firestore documents or git repository.
- **SuperAdmin & Center Admin AI Gateway API (`firebase/ai_admin_service.js`)**: SuperAdmin-only administrative backend API for global key management and key rotation, plus isolated Center Admin controls allowing center owners to configure institution AI limits without seeing or accessing Gemini API keys.
- **Zero-Downtime Safe Key Rotation**: Candidate keys are tested live via Gemini API before activation. If testing fails, the current active working key remains active without service interruption.
- **Auditable System Events**: Audit log entries (`AI_KEY_TESTED`, `AI_KEY_ACTIVATED`, `AI_KEY_REPLACED`, `AI_KEY_DISABLED`, `CENTER_AI_SETTINGS_UPDATED`) record `actorId`, `timestamp`, `environment`, and `maskedKey` without exposing raw secret keys.
- **18-Assertion Security & Admin Test Suite (`firebase/ai_admin_service.test.js`)**: 100% PASS on role guards, test connection, zero downtime rotation, secret scan, tenant isolation, and live Gemini E2E query.
- **Comprehensive Monorepo Test Regression Baseline**: **979/979 total assertions PASSing** across 36 test files (918 Backend + 4 Packaging + 61 Mobile).

---

## [1.0.0-release.35] - 2026-09-10 (Phase 35: Student AI Educational Tutor System & Final Acceptance)

### Added / Delivered
- **Student AI Educational Tutor System (REQ-21)**: Delivered server-authoritative AI assistant integrated into `student_app` and `firebase/` featuring grounded Q&A, lesson/video specific Q&A, explanations, summaries, self-tests, non-diagnostic weakness analysis, interactive study plans, and exam prep.
- **Real Retrieval-Augmented Generation (RAG) Engine (`firebase/rag_retrieval_service.js`)**: Implemented 768-dimensional dense vector embeddings with in-memory server-side cosine similarity search over Firestore document chunks. Pre-retrieval authorization filters chunks by `institutionId`, student group enrollment, and active unexpired subscription entitlements *before* cosine similarity ranking and LLM prompt context construction.
- **Vendor-Neutral AI Provider Layer (`firebase/ai_provider_interface.js`)**: Created vendor-neutral `AIProvider` base class with `GeminiAIProvider` for production cloud AI and `MockLocalAIProvider` for unit tests, offline development, and CI/CD.
- **Daily Rate Limiting & Usage Accounting (`firebase/ai_usage_service.js`)**: Enforced 50 requests per day maximum per student (`MAX_DAILY_AI_REQUESTS = 50`) to prevent API abuse and control operational costs.
- **8 RTL Quick-Action Cards in Student App UI**: Interactive dashboard containing 8 educational quick-action cards, including "اسأل عن الدرس / الفيديو" for targeted lesson/video Q&A.
- **Explicit Production Provider Verification Engine**: Added explicit production verification test (`Student -> authenticated backend -> authorization -> authorized RAG retrieval -> real Gemini provider -> response -> Student App`). If `GEMINI_API_KEY` is missing from server environment, status explicitly reports `BLOCKED / USER ACTION REQUIRED` (Action required: Supply `GEMINI_API_KEY` in server environment).
- **20 AI Backend & 15 Student Flutter Tests**: Created `firebase/ai_tutor_service.test.js` (20/20 PASS) and `student_app/test/ai_tutor_runtime_test.dart` (15/15 PASS).
- **Multi-Platform Regression Baseline**: 907 total monorepo test assertions passing across 35 test files (825 Backend + 17 Cloudflare + 4 Packaging + 61 Mobile) with zero static analyzer warnings and clean Vite web builds.
- **AI System Documentation**: Published `docs/AI_ARCHITECTURE.md`, `docs/AI_PRIVACY.md`, `docs/AI_SECURITY.md`, `docs/AI_RAG.md`, `docs/AI_USAGE_COST.md`, `docs/AI_OPERATIONS.md`, `docs/FINAL_RELEASE.md`, and updated `docs/FINAL_PRODUCT_AUDIT.md`.

---

## [1.0.0-release.34] - 2026-09-10 (Phase 34: Dedicated Teacher Android App & Final Production Acceptance)

### Added / Delivered
- **Dedicated Teacher Android Mobile Application (`teacher_app/`)**: Delivered standalone Flutter mobile app for teachers featuring Arabic RTL Material 3 UI, Teacher Dashboard, Today's Sessions, Session Details, Fast Attendance Marking (`PRESENT`, `LATE`, `ABSENT`, `EXCUSED`), Group Rosters (view-only), Assessment Grade Entry & Updates, Weekly Schedule, and Administrative Notifications.
- **Server-Authoritative Mobile Security Boundary**: Enforced Firebase Auth custom claims (`role: teacher`, `institutionId`) with 0 service account keys or secrets embedded in the client.
- **Teacher Security & Unit Test Suite (`teacher_app/test/teacher_runtime_test.dart`)**: 15 unit and security assertions validating authentication, role assertion (`UNAUTHORIZED_ROLE`), cross-teacher session isolation (`FORBIDDEN_TEACHER_SCOPE`), group roster isolation (`FORBIDDEN_GROUP_ACCESS`), attendance status validation (`INVALID_ATTENDANCE_STATUS`), and grade bounds (`INVALID_SCORE_BOUNDS`).
- **100% Product Requirement Audit Matrix (`docs/FINAL_PRODUCT_AUDIT.md`)**: Elevated REQ-07 status from `NOT_IMPLEMENTED` to `PASS`, bringing the monorepo score to **20 PASS / 0 NOT_IMPLEMENTED (100.0%)**.
- **872-Assertion Multi-Platform Reconciled Regression**: 29 Node.js backend files (805 assertions), Cloudflare Worker (17 assertions), Windows Packaging Runtime (4 assertions), Student Flutter App (16 assertions), Parent Flutter App (15 assertions), and Dedicated Teacher Flutter App (15 assertions) — 100% PASS across 35 test files.
- **Final Release Documentation & Verdict**: Created `docs/TEACHER_APP.md`, `docs/FINAL_RELEASE.md`, recorded ADR-035 in `DECISIONS.md`, and elevated final verdict to **`FINAL DELIVERY READY`**.

---

## [1.0.0-release.33] - 2026-09-10 (Phase 33: Final Product Audit, Handover & Customer Delivery)

### Added / Verified
- **20-Requirement Final Product Audit Matrix (`docs/FINAL_PRODUCT_AUDIT.md`)**: Full audit matrix evaluating 20 core platform requirements with explicit statuses (19 PASS, 1 NOT_IMPLEMENTED for dedicated teacher mobile app, operations supported via Web/Desktop).
- **Customer Handover Package (`docs/CUSTOMER_HANDOVER.md`)**: Complete delivery package outlining center deliverables, SuperAdmin remote governance controls, computer replacement procedures, hardware requirements, and tenant provisioning checklists.
- **Phase 33 Self-Contained Windows Release Installer (`center-desktop/dist/`)**: Rebuilt self-contained Electron Windows desktop application into NSIS Setup Installer (`remas-center-desktop Setup 1.0.0-release.33.exe` - 72.13 MB, SHA-256: `76bd8a24...`). Verified startup outside source tree with 0 uncaught exceptions.
- **915-Assertion Automated Multi-Platform Regression Suite**: 30 backend Node.js test files (867 assertions PASS), Cloudflare Worker (17 assertions PASS), Student Flutter App (16 assertions PASS), Parent Flutter App (15 assertions PASS), Admin Web build (PASS), and Parent Portal build (PASS).
- **Phase 33 Final Report & Architecture Record**: Created `docs/PHASE_33_REPORT.md` and recorded ADR-033 in `DECISIONS.md`.

---

## [1.0.0-release.32] - 2026-09-09 (Phase 32: Final Acceptance, End-to-End Verification & Delivery Release)


### Added / Verified
- **25-Point End-to-End Acceptance Matrix (`docs/FINAL_ACCEPTANCE_TEST.md`)**: Complete end-to-end acceptance verification covering SuperAdmin, Center Admin, Institution Onboarding, Academic Structure, Subjects, Teachers, Groups, Student Lifecycle, Session Scheduling, Attendance, Mobile Apps, Desktop Installer, Licensing, Device Binding, Security, and Real Firebase Production.
- **Real Firebase Production Connection Verification**: Safe read-only connectivity test against `educenter-saas` (`educenter-saas-860c5`) via external runtime secret (`F:\firebase-secrets\...`), achieving `STATUS: PASS` and `readBackVerified: true` with 0 fake production data records created.
- **Center Windows Desktop Executable NSIS Setup Installer (`center-desktop/dist/`)**: Compiled Electron Windows Desktop App into self-extracting NSIS Setup Installer (`remas-center-desktop Setup 1.0.0-release.31.exe` - 76.24 MB).
- **Comprehensive Multi-Platform Regression Suite**: 911 total assertions passing across 29 Node.js backend suites (863 assertions), Cloudflare Worker (17 assertions), Student Flutter App (16 assertions), Parent Flutter App (15 assertions), Admin Web Vite Build (PASS), and Parent Portal Vite Build (PASS).
- **Production Operations & Release Manual (`docs/FINAL_RELEASE.md`)**: Comprehensive production operations guide covering deployment, license activation, single-device binding, troubleshooting, and disaster recovery.
- **Phase 32 Final Report & Architecture Record**: Created `docs/PHASE_32_REPORT.md` and recorded ADR-032 in `DECISIONS.md`.

---

## [1.0.0-release.31] - 2026-09-09 (Phase 31: Windows Desktop + Single Device Licensing)


### Added / Verified
- **Hardware Fingerprint Engine (`firebase/device_fingerprint.js`)**: Cryptographic SHA-256 derivation engine generating non-PII hardware fingerprints (`win_fp_...`) from system CPU architecture, machine GUID, total memory, and OS build parameters.
- **Trusted Device Binding Backend Service (`firebase/device_binding_service.js`)**: Server-authoritative device licensing API supporting `requestDeviceActivation`, `validateDeviceBinding`, `revokeDeviceBinding`, `replaceDeviceBinding`, `heartbeatDevice`, and `listAllCenterDevices`.
- **Device Binding Backend Test Suite (`firebase/device_binding_backend.test.js`)**: 15 automated test scenarios asserting 1-device-per-center limits (`DEVICE_LIMIT_EXCEEDED`), same-device restart/reinstall safety, SuperAdmin revocation lockdown (`REVOKED`), device replacement workflow, cross-tenant isolation, unprivileged role denial, suspended/expired tenant protection, and audit event logs.
- **Standalone Center Windows Desktop Application (`center-desktop/`)**: Native Windows desktop runtime featuring Electron main process (`main.js`), secure IPC bridge (`src/preload.js`), custom single-device license badge, 72-hour offline grace period enforcement, and revocation overlay lockdown (`index.html`, `src/desktop_app.js`).
- **SuperAdmin Center Devices Console (`admin-web/src/components/SuperAdminDevices.tsx`)**: Responsive Arabic RTL console providing SuperAdmin full remote control over all center Windows terminals with 🟢 Activate, 🔴 Revoke, 🔄 Replace Device dialogs and audit trail inspection.
- **Phase 31 Architecture & Specifications**: Created `docs/PHASE_31_PLAN.md`, `docs/WINDOWS_DESKTOP.md`, `docs/DEVICE_BINDING.md`, `docs/DEVICE_ACTIVATION.md`, `docs/PHASE_31_REPORT.md`, and ADR-031 decision record in `DECISIONS.md`.

---

## [1.0.0-release.30] - 2026-09-08 (Phase 30: Real Production Go-Live Readiness & End-to-End Customer Acceptance)

### Added / Verified
- **Automated Backup & Disaster Recovery Engine (`firebase/backup_disaster_recovery_service.js`)**: Backup verification service for Firestore Point-in-Time Recovery (PITR) & GCS scheduled export verification with non-destructive production safeguards and RPO (< 1 hr) / RTO (< 4 hrs) runbook generation.
- **Backup & Recovery Backend Test Suite (`firebase/backup_recovery_backend.test.js`)**: 5 automated test scenarios asserting target project alignment (`educenter-saas`), backup parameters, prohibited destructive production restore guard, missing credentials handling, and runbook generation.
- **End-to-End Load & Concurrency Benchmark Engine (`firebase/load_concurrency_benchmarks.js`)**: Isolated mock stress engine simulating 200 concurrent roster attendance writes, same-student duplicate write race conditions, group capacity limits (`maxCapacity`), and cross-tenant isolation protections.
- **Load & Concurrency Backend Test Suite (`firebase/load_concurrency_backend.test.js`)**: 6 automated test scenarios asserting 100% pass rate under concurrent pressure with bottleneck analysis (`DEFEATED`).
- **Fast Reception Kiosk QR Attendance Scanner (`admin-web/src/components/attendance/ReceptionKioskQRScanner.tsx`)**: Reception kiosk mode in `admin-web` for instant barcode scanner stream input, student token verification, active session check, duplicate prevention, tenant isolation verification, and high-contrast visual badges (`SUCCESS`, `ALREADY_RECORDED`, `INVALID_QR`, `STUDENT_NOT_FOUND`, `SESSION_NOT_FOUND`, `UNAUTHORIZED`).
- **22-Point End-to-End Customer Acceptance Checklist (`docs/CUSTOMER_ACCEPTANCE.md`)**: Comprehensive operational journey sign-off covering all 22 domain pillars.
- **Product Delivery Architecture Review (`docs/CUSTOMER_ACCEPTANCE.md`)**: Detailed gap analysis reviewing SuperAdmin platform, Center Windows desktop app, Student Android app, Parent Android app, and Windows device hardware binding.
- **Phase 30 Architecture & Documentation**: Created `docs/PHASE_30_PLAN.md`, `docs/PHASE_30_REPORT.md`, `docs/BACKUP_DISASTER_RECOVERY.md`, `docs/LOAD_CONCURRENCY_TESTING.md`, `docs/RECEPTION_KIOSK_QR.md`, `docs/CUSTOMER_ACCEPTANCE.md`, and ADR-030 decision record in `DECISIONS.md`.

---

## [1.0.0-release.29] - 2026-09-08 (Phase 29: Production Center Operations & Real Data Workflow)

### Added / Verified
- **Center Operations Workflow Service (`firebase/center_operations_service.js`)**: Orchestration and readiness service for verifying end-to-end educational center operations (Institution ➔ Academic Levels ➔ Subjects ➔ Teachers ➔ Groups ➔ Student Enrollments ➔ Teacher Qualification Assignments ➔ Teaching Sessions ➔ Session Roster Attendance).
- **Center Operations Unit Test Suite (`firebase/center_operations_backend.test.js`)**: 15 automated test scenarios asserting the complete operational lifecycle, capacity tracking, teacher qualification checks, schedule conflict prevention (`SESSION_SCHEDULE_CONFLICT`), session lifecycle, attendance recording, cross-tenant isolation, unprivileged role denial, and audit event logs.
- **Admin Web Center Operations Console (`admin-web/src/components/CenterOperationsConsole.tsx`)**: Responsive, Arabic RTL console providing Tenant Admins a unified operational journey across all 7 stages of center operations with live status cards (`PRODUCTION CONNECTED`, `PRODUCTION READY`, `APPLICATION OPERATIONAL`).
- **Phase 29 Architecture & Specification Documents**: Created `docs/PHASE_29_PLAN.md`, `docs/PHASE_29_REPORT.md`, `docs/PRODUCTION_CENTER_OPERATIONS.md`, and ADR-029 decision record in `DECISIONS.md`.

---

## [1.0.0-release.28] - 2026-09-08 (Phase 28: Real Firebase Production Connection)

### Added / Verified
- **Real Production Connection (`firebase/live_verification_service.js`)**: Verified live Firebase Production connection to project `educenter-saas` (`educenter-saas-860c5`) using secure Service Account credentials (`F:\firebase-secrets\educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json`).
- **Live Write -> Read -> Read-Back Verification**: Executed live verification against `systemHealth/phase28_live_verify` in `educenter-saas` Firestore (Write PASS, Read PASS, Read-back PASS, HealthDoc PASS).
- **Firebase Auth Admin SDK Verification**: Verified live Authentication Admin SDK connection (`AUTH_ADMIN_API: PASS`, 0 synthetic users created).
- **Idempotent Production Metadata Bootstrap (`firebase/production_bootstrap.js`)**: Written `systemMetadata/appConfig`, `systemMetadata/systemRoles`, and `systemMetadata/subscriptionScopes` idempotently to live production Firestore.
- **Idempotent Primary Tenant Bootstrap (`firebase/production_data_bootstrap.js`)**: Provisioned `institutions/inst_bootstrap_001` idempotently to live production Firestore with 0 fake user accounts, 0 fake students, 0 fake teachers, 0 fake financial transactions.
- **Phase 28 Architecture Documents**: Created `docs/PHASE_28_PLAN.md` and `docs/PHASE_28_REPORT.md` documenting live verification empirical proof, ADR-028 decision records, and security audit results.

---

## [1.0.0-release.27] - 2026-09-08 (Phase 27: Academic Operations & Teaching Workflow)

### Added
- **Academic Operations & Teaching Workflow Service (`firebase/academic_operations_service.js`)**: Trusted backend API for qualified teacher-group assignments (`assignTeacherToGroup`), session lifecycle management (`createSession`, `getSession`, `updateSession`, `setSessionStatus`, `listSessions`), and session attendance recording (`recordSessionAttendance`, `listSessionAttendance`).
- **Academic Operations Unit Test Suite (`firebase/academic_operations_backend.test.js`)**: 14 automated test scenarios asserting qualified teacher assignment, schedule conflict prevention (`SESSION_SCHEDULE_CONFLICT`), session status transitions, session attendance recording, teacher role isolation (`TEACHER_NOT_ASSIGNED_TO_GROUP`), cross-tenant rejection (`CROSS_TENANT_VIOLATION`), and audit logging.
- **Admin Web Console Extensions (`admin-web/src/components/academic/TeachingOperationsManager.tsx`)**: Responsive, Arabic RTL console for session scheduling, teacher-group qualification checking, and session attendance recording.
- **Academic Operations Specification (`docs/TEACHING_OPERATIONS.md`)**: Architectural guide for teaching session scheduling, schedule conflict checks, and session attendance recording workflows.

---

## [1.0.0-release.26] - 2026-09-08 (Phase 26: Student Enrollment & Group Operations)

### Added
- **Student Enrollment & Group Operations Service (`firebase/student_enrollment_service.js`)**: Trusted backend API for Student Profiles, Group management, Capacity tracking (`maxCapacity`), Group enrollments/withdrawals, and Guardian profile linking with strict tenant isolation and role authorization.
- **Student Enrollment Unit Test Suite (`firebase/student_enrollment_backend.test.js`)**: 15 automated test scenarios asserting student creation, capacity limits (`GROUP_CAPACITY_EXCEEDED`), status transitions, duplicate prevention (`DUPLICATE_ENROLLMENT`), guardian linking, cross-tenant rejection (`CROSS_TENANT_VIOLATION`), and audit logging.
- **Admin Web Console Extensions (`admin-web/src/components/student/StudentsManager.tsx`)**: Responsive, Arabic RTL console for Student registration, Group definition, Group enrollment, Guardian linking, and status badge indicators.
- **Student Enrollment Specification (`docs/STUDENT_ENROLLMENT.md`)**: Architectural guide for student enrollment, group capacity management, and guardian linking workflows.

---

## [1.0.0-release.25] - 2026-09-08 (Phase 25: Academic Structure & Institution Operations)

### Added
- **Academic Structure & Teachers Service (`firebase/academic_structure_service.js`)**: Trusted backend API for Academic Levels/Grades, Subjects catalog, Teacher Profiles, and Subject/Level assignments with strict tenant isolation and role authorization.
- **Academic Structure Unit Test Suite (`firebase/academic_structure_backend.test.js`)**: 13 automated test scenarios verifying level/subject creation, duplicate prevention, status transitions, teacher assignments, cross-tenant rejection, and audit logging.
- **Admin Web Console Extensions (`admin-web/src/components/AcademicCoreDashboard.tsx`)**: Responsive, RTL-compliant console for Academic Levels/Grades, Subjects catalog, and Teacher profile management with status toggles and assignment selectors.
- **Academic Structure Specification (`docs/ACADEMIC_STRUCTURE.md`)**: Complete architectural specification for academic hierarchy and teacher operations.

---

## [1.0.0-release.24] - 2026-09-07 (Phase 24: Real Admin Onboarding & First Tenant)

### Added
- **Institution Management Backend Service (`firebase/institution_service.js`)**: SuperAdmin institution lifecycle API (`createInstitution`, `getInstitution`, `updateInstitution`, `listInstitutions`, `setInstitutionStatus`, `assignInitialAdmin`) enforcing tenant claims, role hierarchy, and immutable audit keys.
- **Institution Onboarding Unit Test Suite (`firebase/institution_backend.test.js`)**: 10 automated test cases asserting SuperAdmin authorization, tenant isolation, IDOR protection, status lifecycle, and audit logging.
- **Admin Web Console Extensions (`admin-web/src/components/SuperAdminInstitutions.tsx`)**: Responsive, RTL-compliant institution management console with creation forms, status badges, and confirmation dialogs.
- **Institution Onboarding Specification (`docs/INSTITUTION_ONBOARDING.md`)**: Comprehensive architectural guide for tenant provisioning and Initial Admin onboarding workflows.

---

## [1.0.0-release.23] - 2026-09-07 (Phase 23: Production Data Model & Tenant Bootstrap)

### Added
- **Production Data Model Specification (`docs/PRODUCTION_DATA_BOOTSTRAP.md`)**: Full architectural specification of 22 standard SaaS Firestore collection domains, RBAC matrix, and non-PII metrics documentation.
- **Single Tenant Bootstrap Engine (`firebase/production_data_bootstrap.js`)**: Idempotent provisioning service (`bootstrapTenant` & `getProductionDataCounts`) with `--dry-run` flag support and production safety guards.
- **Tenant Bootstrap Unit Test Suite (`firebase/production_data_bootstrap.test.js`)**: 7 automated tests verifying tenant isolation, idempotency, dry-run mode, and zero-PII data boundaries.
- **CLI Commands**: Added `tenant:bootstrap`, `production:counts`, and `test:tenant_bootstrap` scripts to `package.json`.

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
