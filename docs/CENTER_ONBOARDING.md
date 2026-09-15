# EDUCATIONAL CENTER ONBOARDING & REAL ONLINE WORKFLOW GUIDE

## 1. Onboarding Journey Flowchart

```
┌─────────────────────────────────────────────────────────┐
│ 1. SuperAdmin Platform Console                          │
│    - Log into SuperAdmin App / Console                  │
│    - Create Institution (e.g. Center A, Center B)       │
│    - Generates Real Institution Document ID             │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Trusted Owner Provisioning                            │
│    - Provision Owner Auth & Tenant User Profile         │
│    - Assign role: institutionOwner & institutionId claim │
│    - Issue License & Device Hardware Binding Code       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Center Desktop Application (Shared Binary)            │
│    - Center Owner launches Center Desktop 45.0          │
│    - Enforces Single Device Hardware Binding            │
│    - Authenticates via Firebase Auth (Email + Password) │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Dynamic Identity & Tenant Resolution                 │
│    - Application reads Auth UID & Claims/Firestore      │
│    - Resolves role = institutionOwner, institutionId    │
│    - Loads Center A Branding & Tenant-Scoped Dashboard  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Operational Student CRUD (Cloud Firestore)            │
│    - Center Owner creates Student A                     │
│    - Writes directly to Cloud Firestore via Client SDK  │
│    - Security Rules enforce strict tenant isolation     │
│    - Center B users cannot access Center A data         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Onboarding Steps Detail

### Step 1: Create Institution
SuperAdmin creates the educational center document in Firestore `/institutions/{institutionId}`:
- `institutionId`: `inst_cairo_001`
- `name`: `مركز الرواد التعليمي بالقاهرة`
- `status`: `ACTIVE`
- `branding`: Dynamic colors, logo, and title subtitle.

### Step 2: Provision Center Owner
Platform administrator provisions owner credentials:
- `uid`: `usr_owner_cairo_01`
- `email`: `owner@cairo-center.com`
- `role`: `institutionOwner`
- `institutionId`: `inst_cairo_001`

### Step 3: Launch Center Desktop Application
Owner opens the single shared Windows installer `remas-center-desktop Setup 1.0.0-release.45.0.exe`:
- Enforces single-device binding hardware fingerprint (`win_fp_...`).
- Authenticates using `owner@cairo-center.com`.

### Step 4: Tenant Data & Student Operations
- Dashboard automatically loads `institutions/inst_cairo_001` statistics.
- Adding Student A writes `/institutions/inst_cairo_001/students/STU_1001`.
- Tenant isolation is enforced by Firestore Security Rules (`isTenantAdmin(institutionId)`). Cross-tenant queries are blocked.

---

## 3. Data Boundaries & Relationships

| Entity | Path | Key Fields | Access Control |
|---|---|---|---|
| **Institution** | `/institutions/{institutionId}` | `institutionId`, `name`, `status`, `branding` | SuperAdmin (Write) / Tenant Admin (Read/Update) |
| **Center User** | `/institutions/{instId}/users/{uid}` | `uid`, `email`, `role`, `institutionId` | Tenant Admin / Self Read |
| **Student** | `/institutions/{instId}/students/{sId}` | `id`, `name`, `phone`, `parentUid`, `status` | Tenant Admin / Student (Self) / Parent (Linked) |
| **License** | `/licenses/{licenseId}` | `institutionId`, `status`, `licenseCode` | SuperAdmin (Write) / Tenant Owner (Read) |
| **Device Binding** | `/deviceBindings/{bindingId}` | `institutionId`, `deviceFingerprintHash` | SuperAdmin (Write) / Center Desktop (Read) |
