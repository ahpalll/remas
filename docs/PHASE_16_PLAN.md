# Phase 16: Parent Portal Mobile App — Architecture & Security Plan

---

## 1. Executive Summary & Core Objectives

Phase 16 introduces the independent **Parent Portal Mobile Application** (`parent_app/`) in Flutter for parents and guardians.

### Key Objectives:
1. **Parent Authentication & Role Enforcement**: Enforce `role = parent` claim verification via Firebase Auth (`parent_auth_service.dart`). Rejects Student/Admin/Teacher roles.
2. **Trusted Parent Backend Gateway**: Create `firebase/parent_service.js` with trusted backend functions that validate the cryptographic `Parent -> Guardian/Student -> Student` relationship before returning any child data.
3. **Tenant & Child Isolation**: Parent A can ONLY access their own linked children (`Child A`). Cross-parent access (`Parent A -> Child B`) and cross-tenant access (`Tenant A Parent -> Tenant B Child`) strictly fail with `UNAUTHORIZED_PARENT_RELATIONSHIP` or `CROSS_TENANT_VIOLATION`.
4. **Read-Only Mobile Portal Screens**:
   - **Dashboard**: Arabic RTL summary of linked children & quick stats.
   - **Children List**: List of verified linked children (`ParentChildDTO`).
   - **Child Profile**: Read-only profile (`ChildProfileScreen`).
   - **Groups & Subjects**: Enrolled groups, subjects, and teachers.
   - **Schedule**: Session timetable (day/date, start/end time, room).
   - **Attendance**: Session attendance history & statistics adhering to Phase 7 calculation rules.
   - **Grades & Online Exams**: Exam results and percentages without exposing correct answer keys or question bank internals (Phase 10/11 compliance). Direct exam/grade mutations strictly **DENIED**.
   - **Content & Subscriptions**: View child content availability and active package entitlements. No signed media playback URLs issued to parent (Phase 13/14 compliance).

---

## 2. Architecture & Data Flow

```
[ Parent Flutter App (parent_app/) ]
       │
       ├─► 1. Authenticate via Firebase Auth (role: parent)
       │
       └─► 2. Call Trusted Parent Backend (firebase/parent_service.js)
                   │
                   ▼ Validates Parent UID & Guardian-Student Linking
                   ▼ Evaluates Tenant Boundaries (institutionId)
                   ▼ Returns Filtered Safe DTOs (No answer keys / No secrets)
```

---

## 3. Test Baseline Accounting Plan

- **Previous Baseline**: 585 Executed Assertions (100% Passing).
- **Phase 16 Additions**:
  - Security Rules Tests (`firebase/firestore_rules.test.js`): +10 assertions (Total 182 rules assertions).
  - Parent Backend Unit Tests (`firebase/parent_backend.test.js`): +35 assertions.
  - Parent App Flutter Unit Tests (`parent_app/test/parent_runtime_test.dart`): +15 assertions.
- **Expected Final Total**: **645 Executed Assertions**.
