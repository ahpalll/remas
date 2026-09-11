# PHASE 40 — PRODUCTION IDENTITY, LICENSE & SINGLE DEVICE BINDING

## Executive Summary
Phase 40 establishes the production identity, cloud-authoritative licensing, single-device binding, remote revocation, and SuperAdmin lifecycle management for REMAS EDU (`1.0.0-release.40`).

All 15 mandatory security micro-amendments have been strictly enforced and verified against live Cloud Firestore Security Rules on the Firebase Emulator (port 8080) and against the compiled packaged Windows binary (`remas-center-desktop.exe`).

---

## Technical Architecture & Security Model

### 1. Cryptographic Device Fingerprint
- **Derivation Algorithm**: One-way SHA-256 cryptographic derivation combining static platform salt with normalized system characteristics:
  $$\text{Fingerprint} = \text{SHA256}(\text{SALT} : \text{platform} \mid \text{arch} \mid \text{cpuModel} \mid \text{cores} \mid \text{memoryGb} \mid \text{systemUuid} \mid \text{hostnameHash})$$
- **Prefix**: `win_fp_[a-f0-9]{64}` (71 characters total).
- **Hostname Policy**: Hostname is truncated to a 16-character SHA-256 supplementary hash signal and is **never** used as a primary identity component or exposed in raw form.
- **PII & Serial Protection**: Zero raw serial numbers, MAC addresses, or user PII are stored in Firestore or exposed via client APIs.

### 2. Server-Authorized First Device Binding
- **Firestore Security Rules**: Direct client writes (`create`, `update`, `delete`) to `/licenses/{id}` and `/deviceBindings/{id}` are strictly **DENIED** (`allow create, update, delete: if isSuperAdmin();`).
- **Authorization Flow**: Center Desktop authenticates via Firebase Auth Client SDK $\rightarrow$ server-side license validation (`activateCenterLicense`) validates UID, `institutionId`, license code, expiry, and existing binding count $\rightarrow$ server writes `deviceBindings`.
- **1-Device Policy**: Re-activating on the same device returns `ALREADY_ACTIVE_SAME_DEVICE`. Attempting activation on a secondary device throws `DEVICE_LIMIT_EXCEEDED` and sets status `DEVICE_MISMATCH`.

### 3. SuperAdmin Remote Operations
- All authoritative operations are server-side only:
  - `createCenterLicense`
  - `activateCenterLicense`
  - `suspendCenterLicense`
  - `revokeCenterLicense`
  - `renewCenterLicense`
  - `unbindDevice`
- Center Owners/Admins have **read-only** permission to view their own institution's license status.

### 4. Client Admin SDK & Secret Audit
- `firebase-admin`, `serviceAccountKey.json`, and cloud private keys are **100% absent** from:
  - Center Desktop main & renderer bundles
  - Electron ASAR compiled package (`app.asar`)
  - Student, Teacher, and Parent Flutter APKs
  - Parent Portal web application

### 5. Offline Grace Policy
- **Audit Result**: Hardware TPM / KMS trusted RTC clock is absent on general Windows runtime environments.
- **Policy Declaration**: `OFFLINE GRACE POLICY = UNVERIFIED`. Security is NOT weakened with fake local JSON timestamps; online cloud authorization is strictly required.

---

## Verification Results

| Scenario | Test Suite | Result | Evidence |
| :--- | :--- | :---: | :--- |
| **1. Cryptographic Fingerprint** | `node --test firebase/phase_40_license_device.test.js` | **PASS** | Stable SHA-256 hash derived, zero PII |
| **2. Firestore Rules Isolation** | `@firebase/rules-unit-testing` (192/192 Rules) | **PASS** | Owner write DENIED, Cross-tenant DENIED, SuperAdmin ALLOWED |
| **3. Server Binding Path** | `license_service.js` | **PASS** | First binding creates record, secondary device DENIED |
| **4. License Lifecycle** | `license_service.js` | **PASS** | Suspend, Revoke, Extend, Unbind fully state-driven |
| **5. Packaged Binary E2E** | `remas-center-desktop.exe` | **PASS** | PID 9716 runtime verified, 8 scenarios pass |
| **6. Reinstall Durability** | `scratch/run_phase_40_full_e2e.js` | **PASS** | Deleting local store leaves cloud binding authoritative |
| **7. Local Tamper Proofing** | `scratch/run_phase_40_full_e2e.js` | **PASS** | Local JSON editing produces ZERO authorization bypass |
| **8. Remote Revocation** | `scratch/run_phase_40_full_e2e.js` | **PASS** | Immediate `LICENSE_REVOKED` status enforced |

---

## Monorepo Status Summary
- **Target Version**: `1.0.0-release.40`
- **Phase Status**: **VERIFIED**
- **Offline Grace Policy**: **UNVERIFIED** (Requires online cloud authorization)
- **Hard Stop**: Phase 41 is NOT started. Stopping for review.
