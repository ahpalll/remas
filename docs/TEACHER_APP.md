# REMAS Educational Center SaaS — Dedicated Teacher Mobile Application (`teacher_app`)

**App Component**: `teacher_app` (Android-first Flutter Mobile Application)  
**Monorepo Version**: `1.0.0-release.34`  
**Target Firebase Project**: `educenter-saas` (`educenter-saas-860c5`)  
**Security Model**: Firebase Auth Identity + Trusted Custom Claims (`role: teacher`, `institutionId`)  

---

## 1. Executive Overview

`teacher_app` is the dedicated mobile application built for educators operating within educational centers managed by the REMAS SaaS Platform. It empowers teachers to manage daily teaching sessions, conduct fast student attendance marking, enter/update assessment grades, view assigned group rosters, and receive administrative notifications on their Android mobile devices.

---

## 2. Security Architecture & Identity Boundary

1. **Zero Secret Exposure**:
   - Zero Firebase Admin Service Account JSON files, private keys, or backend secrets exist inside `teacher_app`.
   - All operations are gated by client-side Firebase Auth tokens containing trusted claims issued by the REMAS backend (`role: teacher`).
2. **Server-Authoritative Authorization**:
   - `teacher_app` NEVER sends self-asserted identity or institution IDs as authorization credentials.
   - All backend queries enforce security guards: `FORBIDDEN_TEACHER_SCOPE`, `FORBIDDEN_GROUP_ACCESS`, and `UNAUTHORIZED_ROLE`.
3. **Multi-Tenant & Teacher Isolation**:
   - A teacher can access ONLY data belonging to their assigned institution, assigned groups, assigned subjects, and assigned sessions.
   - Cross-teacher access (Teacher A accessing Teacher B's sessions or students) is strictly REJECTED.

---

## 3. Core Modules & Feature Workflow

### A. Authentication & Session Management (`TeacherAuthService`)
- Validates teacher email credentials against Firebase Auth.
- Rejects unauthorized student or parent roles attempting teacher sign-in (`UNAUTHORIZED_ROLE`).
- Manages authenticated session state and provides clean logout reset.

### B. Teacher Home Dashboard (`TeacherDashboardScreen`)
- Arabic RTL Material 3 interface displaying teacher profile, subjects, quick-action shortcuts (Today's Attendance, Grade Entry), and today's session preview.

### C. Today's Sessions & Lifecycle (`TeacherSessionsScreen`, `SessionDetailsScreen`)
- Lists sessions assigned strictly to the logged-in teacher.
- Displays group name, subject, date, time slot, room, and session status (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`).

### D. Attendance Marking Engine (`TeacherAttendanceScreen`, `TeacherAttendanceService`)
- Roster view supporting `PRESENT`, `LATE`, `ABSENT`, and `EXCUSED` statuses.
- Supports student QR code scanning, barcode lookup, and manual student search.
- Submits attendance records via trusted server-authoritative service endpoints.

### E. Assessment Grading Engine (`TeacherGradesScreen`, `TeacherGradingService`)
- Grade entry and updates for authorized assessments (`score`, `maxScore`, `percentage`).
- Enforces strict score bounds validation (`0 <= score <= maxScore`).

### F. Group Roster & Schedule View (`TeacherGroupsScreen`, `TeacherScheduleScreen`)
- View-only group details (enrolled count, max capacity, room, level).
- Weekly schedule view.

---

## 4. Test Verification Suite (`teacher_app/test/teacher_runtime_test.dart`)

The test suite validates 15 core assertions:
1. Valid teacher login grants authenticated session (`PASS`).
2. Student email sign-in attempt is rejected (`UNAUTHORIZED_ROLE`).
3. Parent email sign-in attempt is rejected (`UNAUTHORIZED_ROLE`).
4. TeacherProfileDTO JSON mapping & defaults (`PASS`).
5. Assigned groups fetching (`PASS`).
6. Security Guard: Unauthorized group roster fetching is rejected (`FORBIDDEN_GROUP_ACCESS`).
7. Assigned sessions fetching (`PASS`).
8. Security Guard: Cross-teacher session access is rejected (`FORBIDDEN_TEACHER_SCOPE`).
9. Valid attendance submission succeeds (`PASS`).
10. Security Guard: Marking attendance for another teacher's session is rejected (`FORBIDDEN_TEACHER_SCOPE`).
11. Invalid attendance status is rejected (`INVALID_ATTENDANCE_STATUS`).
12. Assessment grades fetching for assigned teacher (`PASS`).
13. Security Guard: Unauthorized assessment group grade fetching is rejected (`FORBIDDEN_EXAM_ACCESS`).
14. Invalid score bounds are rejected (`INVALID_SCORE_BOUNDS`).
15. Logout resets session state completely (`PASS`).

---

## 5. Build & Installation Instructions

```bash
# Navigate to teacher_app directory
cd teacher_app

# Run static analysis
flutter analyze

# Run unit tests
flutter test

# Build production Android APK
flutter build apk --release
```
