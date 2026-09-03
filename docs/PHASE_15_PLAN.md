# Phase 15: Student Flutter App Runtime — Architecture & Security Plan

---

## 1. Executive Summary & Core Objectives

Phase 15 builds the production-oriented foundation and runtime UX of the independent **Student Flutter Application** (`student_app/`).

### Key Objectives:
1. **Student Authentication & Session Restoration**: Handle login, loading, network errors, session restoration, and authenticated/unauthenticated routing using existing Firebase Auth architecture.
2. **Student Identity & Profile Resolution**: Display student profile (`studentCode`, `fullName`, `stage`, `groups`, `subjects`) derived strictly from authenticated user claims and student document.
3. **Tenant & Student Isolation**: Enforce `institutionId` and `studentId` boundary checks across all screens and services. Student A cannot read Student B data or cross-tenant institution data.
4. **Student Academic Runtime Services & Displays**:
   - **My Profile**: Read-only student profile details.
   - **My Groups & Subjects**: Enrolled academic groups, subjects, and assigned teachers.
   - **Schedule**: Session timetable (day/date, subject, teacher, room, start/end time).
   - **Attendance**: Session attendance history and statistics (Present/Absent/Late/Excused matching Phase 7 calculation rules).
   - **Grades & Results**: Exam scores, percentages, and status without exposing answer keys or internal grading rules (Phase 10/11 compliance).
   - **Educational Content Browsing**: Browsing Subject $\rightarrow$ Lesson $\rightarrow$ Content hierarchy. Shows published content authorized via Phase 14 entitlements and Phase 13 secure media worker delivery.
   - **Subscriptions & Code Redemption**: Viewing active entitlements (package name, scope, expiration) + secure code redemption (input normalization, SHA-256 backend hashing, `requestId` idempotency, zero plaintext code local storage).

---

## 2. Navigation Architecture & Screen Flow

```
[ Login Screen ] 
       │ (Authenticate via Firebase Auth)
       ▼
[ Student App Dashboard (HomeScreen) ]
       ├─► My Profile (ProfileScreen)
       ├─► My Groups & Subjects (GroupsScreen)
       ├─► Schedule (ScheduleScreen)
       ├─► Attendance (AttendanceScreen)
       ├─► Grades & Results (GradesScreen)
       ├─► Online Exams (OnlineExamsListScreen)
       ├─► Educational Content (EducationalContentScreen)
       └─► Subscriptions & Codes (SubscriptionScreen)
```

---

## 3. Test Matrix & Baseline Accounting

- **Previous Baseline**: 560 Executed Assertions (100% Passing).
- **Phase 15 Additions**:
  - Security Rules Tests (`firebase/firestore_rules.test.js`): +10 assertions (Total 172 rules assertions).
  - Flutter Runtime Unit/Widget Tests (`student_app/test/student_runtime_test.dart`): +15 assertions.
- **Expected Final Total**: **585 Executed Assertions**.
