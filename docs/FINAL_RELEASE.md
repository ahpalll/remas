# REMAS Educational Center SaaS — Production Release & Operations Manual

**Phase**: 32 — Final Acceptance, End-to-End Verification & Delivery Release  
**Target Project**: `educenter-saas` (`educenter-saas-860c5`)  
**Monorepo Release Version**: `1.0.0-release.32`  
**Date**: September 9, 2026  

---

## 1. System Architecture Overview

REMAS SaaS is a production-grade multi-tenant educational management platform connecting Platform Owners (SuperAdmin), Center Directors (Center Admin), Faculty (Teachers), Students, and Guardians across a unified backend topology.

```
                  +-----------------------------------+
                  |         SuperAdmin Web            |
                  |     (Platform Control Console)    |
                  +-----------------+-----------------+
                                    |
                                    v
+-----------------------------------+-----------------------------------+
|                  Firebase Production Backend                          |
|             Project ID: educenter-saas (educenter-saas-860c5)         |
|  - Firestore Multi-Tenant Database                                    |
|  - Firebase Auth (RBAC Custom Claims)                                 |
|  - Trusted Backend Cloud Functions & Services                         |
+---------------+-------------------+-------------------+---------------+
                |                   |                   |
                v                   v                   v
+---------------+-------+   +-------+-------+   +-------+-------+
|  Center Windows App   |   |   Student     |   | Parent Mobile |
| (1 Authorized Device) |   |  Android App  |   | & Web Portal  |
+-----------------------+   +---------------+   +---------------+
```

---

## 2. Platform Owner & SuperAdmin Deployment

### 2.1 Web Dashboard Access
- URL: Production Domain hosting `admin-web/dist`
- Role Requirement: `superadmin` custom claim in Firebase Auth.
- Features:
  - Multi-Center Onboarding & Lifecycle Control (`Active`, `Suspended`, `Terminated`).
  - Licensing Console: Generate center activation keys, set expiration dates, configure grace periods.
  - Device Registry: Remote monitoring of center desktop hardware fingerprints, active sessions, and forced deactivation/unbinding controls.

### 2.2 Server Secret Management
- **Service Account Secret Location**: Strictly maintained outside the application source tree (`F:\firebase-secrets\...`).
- **Client Security Boundary**: ZERO Firebase Admin credentials or service account private keys are embedded in frontend bundles, Flutter APK assets, or Windows Electron binaries.

---

## 3. Educational Center Onboarding Workflow

1. **Center Registration**: SuperAdmin creates institution record via `admin-web` (`createInstitution`).
2. **License Issuance**: SuperAdmin issues an activation code (`createCenterLicense`) bound to `institutionId`.
3. **Admin Credential Provisioning**: SuperAdmin provisions initial `center_admin` credentials.
4. **Binary Delivery**: SuperAdmin provides the standalone Windows setup installer (`remas-center-desktop Setup 1.0.0-release.32.exe`).

---

## 4. Center Windows Desktop App Deployment

### 4.1 Installer Specifications
- **Installer Binary**: `remas-center-desktop Setup 1.0.0-release.32.exe`
- **Installer Package**: NSIS x64 Self-Extracting Installer (76.24 MB)
- **Runtime Target**: Windows 10 / Windows 11 (64-bit)

### 4.2 Initial Installation & Activation Flow
```
First Run on Center Computer
           ↓
Prompt: Enter Activation Code
           ↓
Generate Hardware Fingerprint Hash (CPU/Motherboard/OS GUID -> win_fp_...)
           ↓
Send Secure Activation Request to Backend (activateCenterLicense)
           ↓
Server Authoritative Check:
  - License valid & active?
  - Not expired or revoked?
  - First device binding OR authorized rebound device?
           ↓
Server Binds Hardware Hash to License Record
           ↓
Returns Signed Local License Token (JWT Signed by Backend)
           ↓
Desktop Launcher Access Granted -> Reception Kiosk & Operations Active
```

### 4.3 Runtime Single-Device Enforcement
- **Restart Check**: Subsequent launches compute local fingerprint and verify against server records. If hardware hash matches, access is granted seamlessly.
- **Unauthorized Second Machine**: Attempting to use the same activation key on a second computer returns `DEVICE_LIMIT_EXCEEDED` and locks client execution.
- **72-Hour Offline Grace Period**: In the event of network outages, the desktop app allows local caching for up to 72 hours. Beyond 72 hours without server heartbeat acknowledgement, the app locks out until internet connectivity is restored.
- **Remote Revocation**: When SuperAdmin revokes a license from `admin-web`, the background heartbeat instantly locks execution on the center machine.

### 4.4 Replacement of a Center Machine
1. SuperAdmin opens **Center Licenses & Devices** in `admin-web`.
2. Locates the center's device record and clicks **Unbind Device** (Audit log event: `DEVICE_UNBOUND`).
3. Center installs desktop application on the replacement computer and enters the activation code.
4. Server binds the new machine's hardware fingerprint hash (`win_fp_...`).

---

## 5. Student & Parent Applications Deployment

### 5.1 Student Android Application (`student_app`)
- Framework: Flutter 3.x
- Authentication: Student Code / Email login with `student` role.
- Features: View enrolled groups, schedule, attendance history, QR code scanner token, read-only grade reports.

### 5.2 Parent Mobile App (`parent_app`) & Web Portal (`parent-portal`)
- Mobile Framework: Flutter 3.x
- Web Framework: Vite + React + TypeScript (`parent-portal/dist`)
- Authentication: Guardian phone/email login with `parent` role.
- Features: View linked children profiles, attendance records, exam results, and center announcements.

---

## 6. Cloudflare R2 Media Infrastructure

- Ephemeral signed URL media gateway running on Cloudflare Workers (`cloudflare/worker`).
- Enforces 15-minute time-to-live (`900` seconds) signed access tokens for student/parent content downloads.
- Cross-tenant media isolation: Prevents students of Center A from accessing educational videos or exam assets belonging to Center B.

---

## 7. Operational Safety & Disaster Recovery

- **Automated Backup**: Automated Firestore JSON export and storage snapshot policies (`backup_recovery_backend.test.js`).
- **Disaster Recovery**: Automated baseline bootstrap restoration engine (`production_bootstrap_service.js`).
- **Tenant Isolation**: Server-authoritative cross-tenant rejection (`CROSS_TENANT_VIOLATION` HTTP 403 / Firestore Security Rules).

---

## 8. Strictly Prohibited Actions for Center Admins

1. **NEVER** attempt to install the center desktop software on multiple physical machines using a single license.
2. **NEVER** share admin credentials or activation codes outside authorized center personnel.
3. **NEVER** modify system configuration files or local license tokens on disk (tampering invalidates local signature).
