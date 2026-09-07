# Phase 25 Plan — Academic Structure & Institution Operations

## Goal
Establish the operational academic structure, subjects catalog, teacher profiles management, and teacher assignment engine for REMAS Educational Center SaaS post-onboarding, strictly preserving Multi-Tenant boundaries, RBAC authorization, and auditable event tracking.

## Scope & Architectural Components

1. **Academic Structure Backend Service (`firebase/academic_structure_service.js`)**
   - **Academic Levels / Grades**: `createAcademicLevel`, `updateAcademicLevel`, `getAcademicLevel`, `listAcademicLevels`, `setAcademicLevelStatus`.
   - **Subjects Catalog**: `createSubject`, `updateSubject`, `getSubject`, `listSubjects`, `setSubjectStatus`.
   - **Teacher Management & Assignment**: `createTeacherProfile`, `updateTeacherProfile`, `getTeacherProfile`, `listTeachers`, `setTeacherStatus`, `assignTeacherSubjectsAndLevels`.
   - **Tenant & Role Authorization**: Multi-Tenant verification via `callerToken.institutionId` and caller role evaluation (`superAdmin`, `institutionOwner`, `admin`, `teacher`, `student`, `parent`).
   - **Audit Events**: `ACADEMIC_LEVEL_CREATED`, `ACADEMIC_LEVEL_UPDATED`, `ACADEMIC_LEVEL_STATUS_CHANGED`, `SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_STATUS_CHANGED`, `TEACHER_CREATED`, `TEACHER_UPDATED`, `TEACHER_STATUS_CHANGED`, `TEACHER_ASSIGNMENT_CHANGED`.

2. **Backend Unit Test Suite (`firebase/academic_structure_backend.test.js`)**
   - 16+ automated test scenarios validating levels, subjects, teacher profiles, subject/level assignments, duplicate prevention, cross-tenant rejection, role hierarchy, and audit logging.

3. **Admin Web UI Extensions (`admin-web/src/components/`)**
   - `AcademicStructureManager.tsx`: Interactive console for Academic Levels/Grades & Subjects with Arabic RTL, status toggles, and assignment selectors.
   - `TeacherManager.tsx`: Comprehensive console for Teacher Profiles, subject/level assignments, and status management.

4. **Documentation & Release Artifacts**
   - `docs/ACADEMIC_STRUCTURE.md`: Architectural specification for academic hierarchy and teacher assignment workflows.
   - `docs/PHASE_25_REPORT.md`: Comprehensive Phase 25 verification report.
   - Updates to `PROJECT_STATE.md`, `DECISIONS.md` (ADR-025), `CHANGELOG.md`, and `version.json` (`1.0.0-release.25`).

## Verification Strategy
- Executed Node test suite (`firebase/academic_structure_backend.test.js`).
- Executed `npm run test:all` across all monorepo test suites.
- Executed Flutter analyze & tests for `student_app` and `parent_app`.
- Executed web production builds for `admin-web` and `parent-portal`.
- Executed Cloudflare Worker test suite.
- Secret audit scanning for 0 leaked credentials.
