# Phase 26 Plan — Student Enrollment & Group Operations

## Goal
Implement end-to-end Student Enrollment, Group Operations, Guardian Linking, and Capacity Limit Verification for REMAS Educational Center SaaS, maintaining strict Multi-Tenant boundaries, RBAC authorization, and auditable event tracking.

## Requirement Source & References
- Source: `متطلبات المشروع .md` (Sections 25-30: Students, Student Status, Student Profile, Groups, Group Capacity, Rooms & Schedule).
- Architectural Context: `docs/PRODUCTION_DATA_BOOTSTRAP.md`, `docs/ACADEMIC_STRUCTURE.md`, `docs/INSTITUTION_ONBOARDING.md`.

## Existing vs. Missing Analysis (Gap Analysis)

### Existing (Phases 1–25)
1. **Firestore Collections Baseline**: `/students`, `/groups`, `/enrollments`, `/guardians`, `/studentGuardians` exist in schema taxonomy.
2. **Security Rules Baseline**: Basic security rules exist in `firebase/firestore.rules`.
3. **Student Service Baseline (`firebase/student_service.js`)**: Basic helper functions and stubs created during Phase 6 foundation.
4. **Admin Web Shell**: Placeholder `StudentsManager.tsx` in `admin-web/src/components/student/`.

### Missing (To be implemented in Phase 26)
1. **Complete Trusted Backend API (`firebase/student_enrollment_service.js`)**:
   - `createStudent`: Validates full name, phone, stage, grade, status (`ACTIVE`), generates unique student code and SHA-256 hashed QR token.
   - `getStudent` & `listStudents`: Queries students filtered by institutionId and status.
   - `updateStudentProfile`: Updates editable details (phone, stage, grade, notes).
   - `changeStudentStatus`: Manages student status transitions (`ACTIVE`, `SUSPENDED`, `WITHDRAWN`, `GRADUATED`, `ARCHIVED`).
   - `createGroup`: Creates class groups with maximum capacity, subject, teacher, room, schedule, and fees.
   - `updateGroup` & `listGroups`: Updates group details and lists tenant groups.
   - `enrollStudentInGroup`: Transactionally enrolls student into a group, validating tenant boundaries and group capacity limits (`maxCapacity`).
   - `withdrawStudentFromGroup`: Changes enrollment status to `WITHDRAWN` and updates active capacity counter.
   - `linkGuardianToStudent`: Links guardian profile to student with primary flag and relationship type.
   - `regenerateStudentQR`: Issues new raw QR token and updates stored SHA-256 hash.
2. **Auditable System Events**:
   - Emits `STUDENT_ENROLLED`, `STUDENT_UPDATED`, `STUDENT_STATUS_CHANGED`, `GROUP_CREATED`, `GROUP_UPDATED`, `GROUP_STATUS_CHANGED`, `STUDENT_GROUP_ASSIGNED`, `STUDENT_GUARDIAN_LINKED`.
3. **Backend Unit Test Suite (`firebase/student_enrollment_backend.test.js`)**:
   - Automated tests asserting creation, capacity enforcement, cross-tenant rejection (`CROSS_TENANT_VIOLATION`), role hierarchy (`UNAUTHORIZED_CALLER_ROLE`), status transitions, and audit logging.
4. **Admin Web UI Extensions (`admin-web/src/components/student/StudentsManager.tsx`)**:
   - Complete interactive Arabic RTL UI for managing Students, Groups, Group Enrollment, Guardian Linking, and Status Toggles.
5. **Documentation & Release Artifacts**:
   - `docs/STUDENT_ENROLLMENT.md` specification document.
   - `docs/PHASE_26_REPORT.md` final report.
   - Updates to `version.json` (`1.0.0-release.26`), `CHANGELOG.md`, `PROJECT_STATE.md`, and `DECISIONS.md` (ADR-026).

## Files to Create / Modify
- `docs/PHASE_26_PLAN.md` [NEW]
- `firebase/student_enrollment_service.js` [NEW]
- `firebase/student_enrollment_backend.test.js` [NEW]
- `admin-web/src/components/student/StudentsManager.tsx` [MODIFY]
- `package.json` [MODIFY]
- `docs/STUDENT_ENROLLMENT.md` [NEW]
- `docs/PHASE_26_REPORT.md` [NEW]
- `version.json` [MODIFY]
- `CHANGELOG.md` [MODIFY]
- `PROJECT_STATE.md` [MODIFY]
- `DECISIONS.md` [MODIFY]

## Verification Plan

### Automated Test Commands
- `node --test firebase/student_enrollment_backend.test.js`
- `npm run test:all`
- `cd cloudflare/worker && npm test`
- `cd student_app && flutter analyze && flutter test`
- `cd parent_app && flutter analyze && flutter test`
- `cd admin-web && npm run build`
- `cd parent-portal && npm run build`

### Definition of Done
1. Complete Backend Service implemented with isolated unit tests passing 100%.
2. Multi-tenant isolation and RBAC rules strictly verified.
3. Interactive RTL Admin Web UI updated for Student & Group management.
4. Monorepo regression suite (`npm run test:all`) passes cleanly without breaking previous assertions.
5. Flutter apps (`student_app`, `parent_app`) pass `analyze` and `test`.
6. Web apps (`admin-web`, `parent-portal`) build with 0 TypeScript/bundler errors.
7. Zero secret leaks detected in repository scan.
8. Version bumped to `1.0.0-release.26` and single git commit executed.
