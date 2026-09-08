# Phase 29 — Production Center Operations & Real Data Workflow Plan

## Executive Summary & Scope

Phase 29 completes the first end-to-end operational cycle for educational centers in REMAS Educational Center SaaS Monorepo. Building upon the live production Firebase connection established in Phase 28 (`educenter-saas` / `educenter-saas-860c5`), Phase 29 connects all underlying operational domains into a seamless, unified workflow for Tenant Admins:

```
Institution
   │
   ▼
Academic Levels / Grades
   │
   ▼
Subjects
   │
   ▼
Teachers
   │
   ▼
Groups
   │
   ▼
Students & Group Enrollment
   │
   ▼
Teacher Qualification & Group Assignment
   │
   ▼
Teaching Sessions (SCHEDULED ➔ IN_PROGRESS ➔ COMPLETED)
   │
   ▼
Session Roster Attendance (PRESENT / LATE / ABSENT / EXCUSED)
```

---

## 1. Current Implementation Analysis

- **Phase 24 (Institution Management)**: `firebase/institution_service.js` provides tenant provisioning (`createInstitution`) and tenant admin assignment (`assignInitialAdmin`).
- **Phase 25 (Academic Structure)**: `firebase/academic_structure_service.js` handles Academic Levels (`createAcademicLevel`), Subjects (`createSubject`), Teacher Profiles (`createTeacherProfile`), and Teacher Qualifications (`assignTeacherQualifications`).
- **Phase 26 (Student Enrollment)**: `firebase/student_enrollment_service.js` handles Student Profiles (`createStudent`), Groups (`createGroup`), Group Enrollments (`enrollStudentInGroup`), capacity tracking (`maxCapacity`), and Guardian Linking (`linkGuardianToStudent`).
- **Phase 27 (Academic Operations)**: `firebase/academic_operations_service.js` manages Qualified Teacher Group Assignment (`assignTeacherToGroup`), Teaching Sessions (`createSession`, `setSessionStatus`), and Session Attendance (`recordSessionAttendance`).
- **Phase 28 (Real Production Connection)**: `firebase/live_verification_service.js` verified live Admin SDK connectivity against `educenter-saas` with idempotent metadata and tenant bootstrap.

---

## 2. Requirements Already Implemented vs. Missing Pieces (Gaps)

### Already Implemented
1. Backend trusted APIs for each operational entity (`institutions`, `levels`, `subjects`, `teachers`, `groups`, `students`, `assignments`, `sessions`, `attendanceRecords`).
2. Strict tenant isolation (`institutionId`) across all collections and queries.
3. Teacher qualification checks (subject and level) before group assignment.
4. Schedule conflict detection (`SESSION_SCHEDULE_CONFLICT`) for room/time overlaps.
5. Idempotent session attendance recording and status lifecycle (`SCHEDULED` -> `IN_PROGRESS` -> `COMPLETED`).
6. Arabic RTL UI components in `admin-web` (`AcademicCoreDashboard.tsx`, `StudentsManager.tsx`, `TeachingOperationsManager.tsx`, `SuperAdminInstitutions.tsx`).

### Missing Pieces (Phase 29 Scope)
1. **End-to-End Center Operations Workflow Service (`firebase/center_operations_service.js`)**: An overarching operational verification and workflow engine that audits the complete lifecycle for a tenant (from institution metadata down to attendance records) and returns structured status (`PRODUCTION CONNECTED`, `PRODUCTION DATA READY`, `APPLICATION OPERATIONAL`).
2. **Unified Admin Web Navigation & Workflow Integration**: Ensure `admin-web` provides a single, cohesive Tenant Admin journey connecting Levels -> Subjects -> Teachers -> Groups -> Students -> Assignments -> Sessions -> Attendance with seamless tab state and live error handling.
3. **Comprehensive Operational Integration Test Suite (`firebase/center_operations_backend.test.js`)**: 15+ automated test scenarios asserting the entire end-to-end operational flow, cross-tenant denials, role authorization boundaries, capacity enforcement, schedule conflict prevention, and audit event logs.
4. **Documentation & Release Artifacts**: `docs/PHASE_29_PLAN.md`, `docs/PHASE_29_REPORT.md`, `docs/PRODUCTION_CENTER_OPERATIONS.md`, updated `version.json` (`1.0.0-release.29`), `CHANGELOG.md`, `PROJECT_STATE.md`, and `DECISIONS.md` (ADR-029).

---

## 3. Out of Scope

- Creating synthetic or fake student/teacher records in Production Firestore.
- Redesigning UI styling or removing Arabic RTL layouts.
- Unrequested third-party payment gateway integrations or SMS gateways.
- Modifying Firestore security rules to permissive `allow read, write: if true`.

---

## 4. Security Considerations & RBAC

1. **Multi-Tenant Isolation**: All read/write calls enforce `institutionId === callerToken.institutionId` (or SuperAdmin override with `targetInstitutionId`).
2. **Role Authorization Matrix**:
   - `superAdmin`: Full global access.
   - `institutionOwner` / `admin`: Full administrative access within own institution.
   - `teacher`: Scoped strictly to assigned groups and sessions. Rejects unassigned operations (`TEACHER_NOT_ASSIGNED_TO_GROUP`).
   - `student` / `parent`: Read-only access to own profile/child data. Administrative writes strictly DENIED (`UNAUTHORIZED_CALLER_ROLE`).
3. **Zero Secret Leakage**: Service account credentials resolved from `F:\firebase-secrets\...` outside workspace. Zero private key strings committed to Git or printed in console logs.

---

## 5. Production Safety Rules

1. **Read-Before-Write Idempotency**: All production mutations check existing document state prior to set/update.
2. **Zero Synthetic Data in Production**: Production writes are restricted to system metadata or real tenant configurations. Tests run against Firebase Emulator / mock fixtures.
3. **Safe Credentials Handling**: `FIREBASE_SERVICE_ACCOUNT_JSON` used as runtime environment variable or secret path.
4. **No Destructive Operations**: `firebase firestore:delete` or bulk collection wipes are strictly PROHIBITED.

---

## 6. Verification Plan

1. **Backend Integration Suite**:
   - Execute `npm run test:center_operations` (`firebase/center_operations_backend.test.js`).
   - Execute `npm run test:all` across all monorepo backend suites.
2. **Edge Worker Verification**:
   - Execute `cd cloudflare/worker && npm test`.
3. **Mobile App Verification**:
   - Execute `cd student_app && flutter analyze && flutter test`.
   - Execute `cd parent_app && flutter analyze && flutter test`.
4. **Web Bundle Build Verification**:
   - Execute `cd admin-web && npm run build`.
   - Execute `cd parent-portal && npm run build`.
5. **Security & Git Verification**:
   - Run secret scanner and `git diff --check`.
   - Verify `git status` clean after commit.
