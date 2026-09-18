# TEACHER MANAGEMENT SPECIFICATION (PHASE 49)

## Overview
This document specifies teacher profile management, specialization cataloging, security claim protection, and assigned group/subject scoping in REMAS Educational Center SaaS.

---

## 1. Teacher Document Schema
- **Firestore Path**: `/institutions/{institutionId}/teachers/{teacherId}`
- **Fields**:
  - `id` / `teacherId`: String (`tch_<UID>` or `TCH_<timestamp>_<rand>`)
  - `institutionId`: String
  - `name`: String
  - `phone`: String
  - `email`: String
  - `nationalId`: String (Optional & protected)
  - `address`: String (Optional)
  - `subject`: String (Primary subject)
  - `subjects`: Array of Strings
  - `stages`: Array of Strings
  - `authUid`: String (Linked Firebase Auth Email UID)
  - `status`: String (`ACTIVE` | `SUSPENDED` | `ARCHIVED`)
  - `createdAt`: String (ISO Timestamp)
  - `updatedAt`: String (ISO Timestamp)

---

## 2. Provisioning & Security Principles

1. **Profile vs Identity**:
   - Center UI creates/edits teacher profiles.
   - Auth identity creation and custom claim assignment (`{ role: "teacher", institutionId }`) execute via `scripts/bootstrap_teacher.js`.
   - UI displays `AUTH PROVISIONED` when `authUid` is linked, or `PROFILE DRAFT`.
2. **Tamper Protection**:
   - Security Rules prevent client-side mutation of `authUid`, `institutionId`, and `role`.
3. **Tenant Scoping**:
   - Teachers have read-only access to their own institution's assigned groups and subjects.
   - Teachers CANNOT access unrelated institutions or superadmin functionality.
