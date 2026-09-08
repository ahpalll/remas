# Phase 27 Plan — Academic Operations & Teaching Workflow

## Current State
- Monorepo Version: `1.0.0-release.26`
- Target Firebase Project: `educenter-saas`
- Git Baseline: `a20f6fe008533f3e10c2d77590eea7831ae54808` (`phase-26: student enrollment and group operations`)
- Current System Assertions: **789 Assertions** (100% Passing)

## Existing Capabilities (Phases 1–26)
- **Phase 24**: Admin Onboarding & Institution Management (`firebase/institution_service.js`).
- **Phase 25**: Academic Structure, Levels, Subjects, and Teacher Profiles (`firebase/academic_structure_service.js`).
- **Phase 26**: Student Registration, Class Groups (`maxCapacity`), Group Enrollments, and Guardian Linking (`firebase/student_enrollment_service.js`).

## Identified Gaps
1. **Teaching Assignment & Qualified Teacher-Group Linking**: No automated verification checking whether a teacher assigned to a group is qualified for the group's subject and stage/level.
2. **Session / Lesson Management Service (`firebase/academic_operations_service.js`)**: No trusted backend service for scheduling teaching sessions with date, start/end time, subject, teacher, room, and conflict detection (`SESSION_SCHEDULE_CONFLICT`).
3. **Session Attendance Integration**: Need integration connecting enrolled students of a group to a teaching session, allowing session attendance recording with statuses (`PRESENT`, `LATE`, `ABSENT`, `EXCUSED`).
4. **Strict Teacher Authorization & Isolation**: Security logic ensuring teachers can only access groups, sessions, and students assigned directly to them.
5. **Admin Web Console Extensions**: Admin UI needs interactive forms for scheduling teaching sessions, managing teacher-group assignments, and viewing/recording session attendance in Arabic RTL.

## Phase 27 Scope

1. **Academic Operations Trusted Backend Service (`firebase/academic_operations_service.js`)**:
   - `assignTeacherToGroup`: Assigns teacher to group after validating subject & level qualification.
   - `createSession`: Creates scheduled teaching session with conflict check for room and teacher.
   - `getSession` & `listSessions`: Lists sessions filtered by institution, group, teacher, or status.
   - `updateSession` & `setSessionStatus`: Updates session topic, room, time, or status (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
   - `recordSessionAttendance`: Records attendance for all students enrolled in the group for a given session.
   - `listSessionAttendance`: Fetches attendance records for a session.
   - Audit event logging: `TEACHING_ASSIGNMENT_CHANGED`, `SESSION_CREATED`, `SESSION_UPDATED`, `SESSION_STATUS_CHANGED`, `SESSION_ATTENDANCE_RECORDED`.
2. **Security & Boundary Enforcement**:
   - Strict tenant boundary checking (`institutionId`).
   - Teacher role scope validation: Teachers can only view/record for groups assigned to them.
   - Cross-tenant and unauthorized operation rejection (`CROSS_TENANT_VIOLATION`, `UNAUTHORIZED_CALLER_ROLE`, `TEACHER_NOT_ASSIGNED_TO_GROUP`).
3. **Backend Unit Test Suite (`firebase/academic_operations_backend.test.js`)**:
   - 15+ automated test assertions covering teacher group assignment, session creation, schedule conflict prevention, unauthorized teacher access rejection, session status lifecycle, attendance recording, and audit logging.
4. **Admin Web Console Extensions (`admin-web/src/components/academic/TeachingOperationsManager.tsx`)**:
   - Arabic RTL interface for managing teaching assignments, scheduling class sessions, and recording session attendance.
5. **Documentation & Release Artifacts**:
   - `docs/TEACHING_OPERATIONS.md`: Architectural specification for teaching workflow.
   - `docs/PHASE_27_REPORT.md`: Comprehensive Phase 27 verification report.
   - Updates to `version.json` (`1.0.0-release.27`), `CHANGELOG.md`, `PROJECT_STATE.md`, and `DECISIONS.md` (ADR-027).

## Files to Modify / Create
- `docs/PHASE_27_PLAN.md` [NEW]
- `firebase/academic_operations_service.js` [NEW]
- `firebase/academic_operations_backend.test.js` [NEW]
- `admin-web/src/components/academic/TeachingOperationsManager.tsx` [NEW]
- `admin-web/src/components/AcademicCoreDashboard.tsx` [MODIFY]
- `package.json` [MODIFY]
- `docs/TEACHING_OPERATIONS.md` [NEW]
- `docs/PHASE_27_REPORT.md` [NEW]
- `version.json` [MODIFY]
- `CHANGELOG.md` [MODIFY]
- `PROJECT_STATE.md` [MODIFY]
- `DECISIONS.md` [MODIFY]

## Test Plan
- Run `node --test firebase/academic_operations_backend.test.js`.
- Run `npm run test:all`.
- Run `cd cloudflare/worker && npm test`.
- Run `cd student_app && flutter analyze && flutter test`.
- Run `cd parent_app && flutter analyze && flutter test`.
- Run `cd admin-web && npm run build`.
- Run `cd parent-portal && npm run build`.
- Execute secret scan and `git diff --check`.

## Acceptance Criteria
1. Complete trusted backend service implemented with isolated unit tests passing 100%.
2. Group teacher assignment enforces subject & academic level qualifications.
3. Teaching sessions support scheduling, status transitions (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), and conflict detection.
4. Session attendance recording validates enrolled group roster and teacher assignment.
5. Multi-tenant and teacher role boundaries strictly enforced.
6. Admin Web UI console updated in Arabic RTL for teaching operations.
7. Total system assertions increase from 789 to 804+.
8. Monorepo version updated to `1.0.0-release.27`.
