# Real Admin Onboarding & First Tenant Provisioning Specification

## Overview
This document specifies the official onboarding lifecycle and operational workflow for establishing the primary educational institution (Tenant) and assigning its first Institution Admin in REMAS Educational Center SaaS.

---

## Onboarding Architecture & Lifecycle Flow

```
SuperAdmin Session
       │
       ▼
1. Create Institution (createInstitution)
   ├── Name: REMAS Educational Center
   ├── Type: CENTER | SCHOOL | ACADEMY
   └── Status: ACTIVE | PENDING
       │
       ▼
2. Assign Initial Admin (assignInitialAdmin)
   ├── Email: admin@remas.com
   ├── Target Role: institutionOwner / admin
   └── Custom Claims: { role: 'institutionOwner', institutionId: 'inst_remas_01' }
       │
       ▼
3. Institution Admin Authentication
   ├── Login via Admin Web Console
   └── Resolved Tenant ID & Role Claims Verified
       │
       ▼
4. Tenant Administrative Operations
   ├── Manage Institution Profile
   ├── Provision Teachers & Staff
   ├── Enroll Students & Guardians
   └── Setup Groups & Academic Subjects
```

---

## Authorization & Role Hierarchy Matrix

| Role | Create Institution | Read Institution | Edit Institution | Change Status | Manage Tenant Users |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **SuperAdmin** | ALLOWED | ALL | ALL | ALLOWED (ACTIVE/SUSPENDED) | ALL |
| **institutionOwner** | DENIED | OWN TENANT ONLY | OWN TENANT ONLY | DENIED | OWN TENANT ONLY |
| **admin** | DENIED | OWN TENANT ONLY | OWN TENANT ONLY | DENIED | STUDENTS/PARENTS ONLY |
| **teacher** | DENIED | OWN TENANT ONLY | DENIED | DENIED | DENIED |
| **student** | DENIED | DENIED | DENIED | DENIED | DENIED |
| **parent** | DENIED | DENIED | DENIED | DENIED | DENIED |

---

## Security & IDOR Protections

1. **Backend-Only Institution Creation**: Direct client write access to `/institutions/{institutionId}` for creating new institutions is strictly DENIED in Firestore Security Rules. Creation must run through verified backend service (`firebase/institution_service.js`).
2. **Tenant Claim Verification**: Tenant Admins cannot access or update institutions outside their token claim (`callerToken.institutionId`).
3. **Immutable Fields Protection**: Primary key fields (`institutionId`, `createdBy`, `createdAt`, `targetProjectId`) are immutable post-creation.
4. **Non-Plaintext Credential Policy**: Operator credentials and initial Admin auth tokens are managed via Firebase Auth custom claims and environment secrets—never saved as plaintext in Git or Firestore.

---

## Audit Logging Events

All onboarding operations emit immutable audit log records:
- `INSTITUTION_CREATED`: Emitted when SuperAdmin creates a new tenant.
- `INSTITUTION_UPDATED`: Emitted when institution profile or metadata is modified.
- `INSTITUTION_ACTIVATED`: Emitted when an institution status transitions to `ACTIVE`.
- `INSTITUTION_SUSPENDED`: Emitted when SuperAdmin suspends an institution.
- `ADMIN_ASSIGNED`: Emitted when SuperAdmin assigns initial admin credentials.
