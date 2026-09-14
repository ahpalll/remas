# REMAS Educational SaaS — Authentication Architecture Specification

## Canonical Identity Relationship Model

```
Firebase Auth Identity (UID)
        │
        ├── Custom Token Claims (role, institutionId)
        │     ├── superAdmin        (Global SaaS Administrator)
        │     ├── institutionOwner  (Center Admin)
        │     ├── teacher           (Academic Instructor)
        │     ├── parent            (Guardian)
        │     └── student           (Enrolled Student)
        │
        ├── Profile / User Record
        │     └── institutions/{institutionId}/users/{uid}
        │
        └── Domain Collections
              ├── institutions/{institutionId}/students/{studentId} (authUid linked)
              ├── institutions/{institutionId}/teachers/{teacherId} (authUid linked)
              └── institutions/{institutionId}/guardians/{guardianId} (authUid linked)
```

## Role & Claims Hierarchy

| Role | Custom Claims Schema | Scope / Boundary | Provisioner |
| :--- | :--- | :--- | :--- |
| **SuperAdmin** | `{ "role": "superAdmin" }` | Global SaaS (All Tenants) | `bootstrap_superadmin.js` |
| **Institution Owner** | `{ "role": "institutionOwner", "institutionId": "<instId>" }` | Tenant Boundary (`instId`) | `provisionCenterOwner` (v1 Callable) |
| **Teacher** | `{ "role": "teacher", "institutionId": "<instId>" }` | Tenant Boundary (`instId`) | `provisionTeacher` (v1 Callable) |
| **Parent** | `{ "role": "parent", "institutionId": "<instId>" }` | Tenant Boundary (`instId`) | `provisionParent` (v1 Callable) |
| **Student** | Phone Auth UID / E.164 Identity | Tenant Record (`authUid`) | `provisionStudentAccount` (v1 Callable) |

## Client Authorization Rules
- **No Client Admin SDK**: Clients use Firebase Auth Client SDK (`signInWithEmailAndPassword` / Phone Auth OTP).
- **ID Token Verification**: Applications inspect `IdTokenResult.claims` on sign-in and force token refresh on login.
- **Strict Role Enforcement**: If a user logs into an unapproved app (e.g. Student entering Teacher app), the app executes `signOut()` and denies access.
