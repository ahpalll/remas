# STUDENT MANAGEMENT SPECIFICATION (PHASE 49)

## Overview
This document specifies the student entity management, phone number E.164 normalization, Firebase Auth phone identity linkage, multi-tenant duplicate protection, and student group assignment engine in REMAS Educational Center SaaS.

---

## 1. Student Document Schema
- **Firestore Path**: `/institutions/{institutionId}/students/{studentId}`
- **Fields**:
  - `id` / `studentId`: String (`student_<timestamp>_<rand>`)
  - `studentCode`: String (e.g., `STU-2026-100201`)
  - `institutionId`: String
  - `authUid`: String (Linked Firebase Auth Phone UID)
  - `name`: String
  - `phone`: String (Raw input phone)
  - `normalizedPhone`: String (Canonical E.164 format `+201XXXXXXXXX`)
  - `guardianName`: String
  - `guardianPhone`: String
  - `stage`: String
  - `stageId`: String
  - `academicYearId`: String
  - `groupIds`: Array of Strings
  - `qrToken`: String (`QR_<studentId>`)
  - `status`: String (`ACTIVE` | `SUSPENDED` | `ARCHIVED` | `WITHDRAWN` | `GRADUATED`)
  - `createdAt`: String (ISO Timestamp)
  - `updatedAt`: String (ISO Timestamp)

---

## 2. Phone Normalization & Identity Provisioning

1. **Egyptian E.164 Normalization**:
   - `01012345678` -> `+201012345678`
   - `201012345678` -> `+201012345678`
2. **Duplicate Protection**:
   - Query `normalizedPhone` inside the target institution before creation.
   - If an `ACTIVE` student document exists with the same phone in the same institution -> REJECT with `DUPLICATE_STUDENT_IN_INSTITUTION`.
   - Multi-institution membership across different institutions for the same phone UID is PERMITTED.
3. **Auth Identity Provisioning**:
   - Client applications generate/update the student profile draft.
   - Identity creation and custom claims assignment are performed via `scripts/bootstrap_student.js`.
   - UI clearly presents: `AUTH PROVISIONED` (if `authUid` present) vs `PROFILE DRAFT`.
4. **Tamper Protection**:
   - Security Rules strictly block client-side mutation of `authUid`, `institutionId`, and `role`.
