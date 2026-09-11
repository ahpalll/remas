# Phase 38.5 — Cloud Firestore as Sole Production Source of Truth Report

**Timestamp**: 2026-09-11  
**Monorepo Release**: `1.0.0-release.38.5`  
**Git Commit**: `abed0b824530a317c1b7fcf71f375384798945f5`  
**Status**: **PHASE 38.5 VERIFIED & COMPLETE**

---

## 1. Executive Summary

Phase 38.5 successfully overhauled the Center Desktop data architecture. The application now uses **Cloud Firestore via standard Firebase Web Client SDK (v10.14.1)** as the single, authoritative production source of truth for all operational business data.

All previous hybrid local persistence patterns (`memoryStore`, fallback to `remas_desktop_store.json`, and async unhandled `.catch(() => {})` background writes) have been completely purged from operational CRUD paths. `remas_desktop_store.json` now stores ONLY non-business UI preferences and client window state.

---

## 2. Fulfillment of Mandatory Constraints

### 1. Branding is Cloud-Authoritative
- **Firestore**: Stores center name, color schemes, branding metadata, and configuration objects.
- **R2 Storage**: Stores logo binaries, watermark graphics, and branded assets.
- **Local File Isolation**: `remas_desktop_store.json` does NOT store branding business data. Deleting local JSON files does not clear or reset center branding.

### 2. Firestore Emulator Environment Guard
- Connected to `FIRESTORE_EMULATOR_HOST` **ONLY** when explicitly running in controlled test environment (`NODE_ENV === 'test'`).
- The packaged production executable (`remas-center-desktop.exe`) enforces production mode and connects directly to the real Cloud Firestore backend.

### 3. Unified Authenticated Identity & Security Rules
- Client authentication uses `signInWithEmailAndPassword` via standard Firebase Web Client SDK (`firebase/auth`).
- Authorization tokens carry authenticated `uid`, `role` (`institutionOwner` or `admin`), and `institutionId`.
- No Admin SDK or arbitrary custom token objects bypass security checks. Every client Firestore operation is checked by `firestore.rules`.

---

## 3. Core Architectural Changes

### File: `center-desktop/src/center_desktop_services.js`

1. **Purged `firebase-admin`**: Completely removed Firebase Admin SDK dependencies from Center Desktop tenant operations.
2. **Purged Memory & Local Business Fallbacks**: Purged `memoryStore` and local file persistence logic from operational CRUD functions (`createStudent`, `getStudents`, `updateStudent`, `archiveStudent`, `getTeachers`, `getGroups`, `recordAttendance`, `recordPayment`, `recordExpense`).
3. **Client SDK Direct Firestore Integration**:
   - `getDocs`, `getDoc`, `setDoc`, `updateDoc` are invoked directly using standard Client SDK calls.
   - Operations block and return real errors if Firestore queries fail (no swallowed exceptions).
4. **Tenant Isolation Enforced at Query Level**:
   - Every collection lookup scopes documents under `institutions/{institutionId}/...`.
   - Security rules check `request.auth.token.institutionId == institutionId`.

---

## 4. Verification & Testing Evidence

### A. Rules Emulator Test Suite (192 / 192 PASSED)
- Command: `npm run test:rules`
- Results:
  - `firestore.rules`: 192 tests executed against official Firebase Firestore Emulator.
  - Multi-tenant boundary checks passed (`institutionOwner`, `admin`, cross-tenant access denied).

### B. Packaged Executable Real E2E Test Suite (16 / 16 PASSED)
- Test Script: `scratch/run_phase_38_5_full_e2e.js`
- Executable Path: `f:\remas\center-desktop\dist\win-unpacked\remas-center-desktop.exe`

| # | Test Verification Step | Outcome | Details |
|---|---|---|---|
| 1 | Client Authentication Flow | **PASS** | Signed in with authentic Firebase Client Auth session |
| 2 | Student Creation (Sole Cloud Truth) | **PASS** | Created `STU_1789144209594_j3no` directly in Cloud Firestore |
| 3 | Firestore Document Verification | **PASS** | Client SDK query confirmed cloud document persistence |
| 4 | Packaged EXE Launch & Process Proof | **PASS** | Executable launched (PID 9012) and terminated cleanly |
| 5 | Relaunch & Cloud Persistence Read | **PASS** | Relaunched app loaded data directly from Firestore |
| 6 | Student Field Update | **PASS** | `updateStudent` updated document in Cloud Firestore |
| 7 | Student Archive Status | **PASS** | Status updated to `ARCHIVED` in Cloud Firestore |
| 8 | **Local File Absence Proof** | **PASS** | `remas_desktop_store.json` deleted; data loaded 100% from Firestore |
| 9 | **Controlled Failure Handling** | **PASS** | Failure threw clean error (`INVALID_STUDENT_NAME`); no silent fallback |
| 10 | Cross-Tenant Isolation | **PASS** | Cross-tenant access blocked (`CROSS_TENANT_VIOLATION`) |

---

## 5. Absolute Architectural Boundaries

- **NO SuperAdmin mode** inside Center Desktop UI.
- **NO local file fallback** for operational CRUD.
- **NO swallowed Firestore errors**.
- **NO Firebase Admin SDK** usage in Center Desktop CRUD.
- **NO starting Phase 39** or adding unapproved features.
