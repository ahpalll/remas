# PHASE 44 — ONE ONLINE SAAS PLATFORM ARCHITECTURE AUDIT

## 1. Executive Summary & Core Architectural Principle

The REMAS Educational Center SaaS platform is designed as **ONE unified, multi-tenant online SaaS platform**:

- **ONE Firebase Project**: `educenter-saas` (Project ID: `educenter-saas-860c5`).
- **ONE Central Cloud Firestore Database**: All educational centers, users, students, teachers, parents, and platform operators connect over the Internet to the same Cloud Firestore database.
- **ONE Shared Application Binary per Platform**:
  - **Center Desktop**: Single compiled Windows NSIS installer (`remas-center-desktop Setup 1.0.0-release.43.3.exe`) used by all center owners and administrators.
  - **Student App**: Single compiled Flutter Android APK (`student_app`) used by all students across all institutions.
  - **Teacher App**: Single compiled Flutter Android APK (`teacher_app`) used by all teachers.
  - **Parent App & Portal**: Single compiled Flutter Android APK (`parent_app`) & Web Portal (`parent-portal`).
  - **SuperAdmin Panel**: Single platform management console (`admin-web` / desktop platform mode).
- **ZERO Per-Center Build Customization**: Binary executables and APKs contain NO hardcoded `institutionId`, center credentials, or client-side Admin SDK keys. Center identity, branding, and permissions are determined strictly at runtime based on the authenticated user's Firebase Auth UID and Firestore institution membership.

---

## 2. Cloud Functions Dependency Elimination Strategy

### Decision
The platform operates **WITHOUT requiring Firebase Cloud Functions** as a mandatory runtime dependency for core SaaS operations (zero requirement for Firebase Blaze pay-as-you-go plan upgrade).

### Architecture Implementation
1. **Client-SDK Direct Operations**: Client applications (Desktop, Mobile, Web) use standard Firebase Web / Flutter Client SDKs to perform Authentication (`signInWithEmailAndPassword`, `signInWithPhoneNumber`) and Firestore CRUD operations directly against Cloud Firestore.
2. **Security Enforced by Cloud Firestore Rules**: Multi-tenant data isolation, role-based authorization, immutable audit keys, and field validation are enforced by server-side Cloud Firestore Security Rules (`firebase/firestore.rules`).
3. **Trusted Administrative Bootstrap**: Privileged platform actions that cannot be safely performed via Client SDK (such as initial SuperAdmin creation or initial Center Owner Firebase Auth user creation) are classified as **Trusted Administrative Bootstrap Operations**. These operations are executed securely by platform administrators via node scripts using external service account keys outside client applications. Zero Admin SDK keys are embedded inside any client EXE, APK, or web bundle.

---

## 3. Canonical User & Membership Data Model

### A. Global Identity Document (`users/{uid}`)
```json
{
  "uid": "USER_FIREBASE_AUTH_UID",
  "displayName": "Ahmed Mahmoud",
  "email": "owner@center-a.com",
  "phone": "+201000000001",
  "role": "institutionOwner",
  "status": "ACTIVE",
  "institutionIds": ["inst_A"],
  "createdAt": "2026-09-15T00:00:00.000Z",
  "updatedAt": "2026-09-15T00:00:00.000Z"
}
```

### B. Tenant-Scoped User Profile (`institutions/{institutionId}/users/{userId}`)
Stores center-specific staff/admin user details. Enforces immutable audit keys (`createdBy`, `createdAt`, `ownerId`).

### C. Student Membership Profile (`institutions/{institutionId}/students/{studentId}`)
Stores student enrollment data, linked parent (`parentUid`), and authentication UID (`authUid`). Supports multi-tenant phone identity via rule-safe `collectionGroup('students')` lookup.

---

## 4. Normalized Role Hierarchy

The platform normalizes all user roles into six canonical representations:

1. `superAdmin`: Platform owner with global cross-tenant visibility, institution management, licensing control, and AI provider key rotation.
2. `institutionOwner`: Center owner possessing administrative authority over their assigned `institutionId`.
3. `admin`: Center manager/staff member possessing operational authority over assigned `institutionId`.
4. `teacher`: Instructor assigned to specific subjects, groups, and academic sessions within an institution.
5. `student`: Enrolled student accessing authorized sessions, grades, and content entitlements.
6. `parent`: Guardian accessing explicitly linked student profiles.

*Note on Migration*: All legacy string variations (e.g. `superadmin`) are mapped to the canonical `superAdmin` in security rules and application code.

---

## 5. Tenant Isolation & Security Rules Enforcements

Tenant boundaries are enforced strictly by Cloud Firestore Security Rules (`firebase/firestore.rules`). Security Rules evaluate `request.auth.uid`, `request.auth.token.role`, and `request.auth.token.institutionId`:

- **Tenant Isolation**: A user belonging to `inst_A` attempting to read or write `/institutions/inst_B/...` is DENIED immediately (`PERMISSION_DENIED`).
- **Role Escalation Protection**: Users cannot modify their own `role` or `institutionId` fields.
- **Client Document Protection**: Direct client writes to `/licenses` and `/deviceBindings` are DENIED (`allow create, update, delete: if isSuperAdmin()`).

---

## 6. Emulator Security Rules Test Matrix (15/15 PASS)

The security rules architecture was empirically verified against the live Firebase Firestore Emulator daemon using JDK 21.0.6 (`tests/run_phase_44_emulator_matrix.js`). All 15 mandatory test cases passed 100%:

| Case | Test Description | Expected Result | Actual Result |
|---|---|---|---|
| **A** | SuperAdmin reads Institution A | ALLOWED | **PASS** |
| **B** | SuperAdmin reads Institution B | ALLOWED | **PASS** |
| **C** | Owner A reads Institution A | ALLOWED | **PASS** |
| **D** | Owner A reads Institution B | DENIED | **PASS** |
| **E** | Owner B reads Institution A | DENIED | **PASS** |
| **F** | Teacher A reads own teacher profile in Inst A | ALLOWED | **PASS** |
| **G** | Teacher A reads Inst B teacher profile | DENIED | **PASS** |
| **H** | Student A reads own student profile in Inst A | ALLOWED | **PASS** |
| **I** | Student A reads Student B private data | DENIED | **PASS** |
| **J** | Parent A reads linked child student record | ALLOWED | **PASS** |
| **K** | Parent A reads unrelated child student record | DENIED | **PASS** |
| **L** | Owner A tries role escalation on user doc | DENIED | **PASS** |
| **M** | Owner A tries institutionId change on institution doc | DENIED | **PASS** |
| **N** | Student A tries admin write (create student) | DENIED | **PASS** |
| **O** | Teacher A tries SuperAdmin operation (create license) | DENIED | **PASS** |

---

## 7. Account Creation Architecture & Trusted Bootstrap

| Account Type | Auth Creation Method | Profile Creation Method | Security Guard |
|---|---|---|---|
| **SuperAdmin** | Administrative CLI / Firebase Auth | `systemMetadata/appConfig` / Firestore | Pre-seeded / `isSuperAdmin()` |
| **Center Owner** | Administrative Script or Client Auth | `institutions/{instId}/users/{uid}` | `isSuperAdmin()` / `isTenantAdmin()` |
| **Teacher** | Client Auth / Email / Phone | `institutions/{instId}/teachers/{tId}` | `isTenantAdmin()` |
| **Student** | Phone OTP / Client Auth | `institutions/{instId}/students/{sId}` | `isTenantAdmin()` / Self-OTP |
| **Parent** | Client Auth / Email / Phone | `institutions/{instId}/guardians/{gId}` | `isTenantAdmin()` / Linked Child |

---

## 8. License & Device Hardware Binding Architecture

- Single Device Limit: 1 active Windows Desktop machine per center license.
- Cryptographic Fingerprint: Derived deterministically as `win_fp_[a-f0-9]{64}` from CPU, RAM, and OS metadata.
- Cloud Authoritative: License status (`licenses/{licId}`) and device binding (`deviceBindings/{bindId}`) are stored in Cloud Firestore and checked at main process startup.

---

## 9. Dynamic Center White-Label Branding System

- **REMAS Platform Identity**: Global header branding ("REMAS EDU | رِماس للتقنية التعليمية").
- **Center White-Labeling**: Center logo, primary/secondary/accent colors, login title, and welcome messages are stored in document `institutions/{institutionId}.branding`.
- **Dynamic Loading**: After successful user login, the application fetches `institutions/{institutionId}` and injects custom brand tokens into the UI.

---

## 10. Audit Findings & Secret Exposure Baseline

- **Client ASAR & Source Secret Audit**: Ripgrep scan confirmed ZERO occurrences of `firebase-admin`, service account JSON keys, or private keys inside `center-desktop/src`, compiled `app.asar`, `student_app`, `teacher_app`, `parent_app`, or web builds.
- **Local Data Audit**: Operational CRUD in `center-desktop` executes directly against Cloud Firestore. Local file (`remas_desktop_store.json`) stores ONLY UI preferences (e.g. window dimensions).
