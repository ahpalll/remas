# Phase 31 Implementation Plan — Windows Desktop & Single Device Licensing

## Executive Summary
Phase 31 transitions the REMAS Educational Center SaaS Monorepo from web-only center access to a production-ready **Windows Desktop Application** with **Single Device Hardware Binding & Remote Licensing Control**.

- **Target Firebase Project**: `educenter-saas` (`educenter-saas-860c5`)
- **Version Tag**: `1.0.0-release.31`
- **Monorepo Directory**: `F:\remas`

---

## 1. Current State vs. Target State Gap Analysis

| Operational Area | Current Phase 30 State | Phase 31 Target State |
| :--- | :--- | :--- |
| **Center App Runtime** | Web browser access only (`admin-web`). | Standalone Windows Desktop App (`center-desktop` / Electron Native Windows Package). |
| **Device Licensing** | Unlimited browser logins per institution. | **Strict 1-Device Binding** per institution (Single Device License). |
| **Hardware Fingerprint** | None. | Non-PII Cryptographic Hardware Fingerprint derived from Windows System & Processor UUIDs (`win_fp_...`). |
| **Server Authorization** | Role/User authentication only. | Dual Authorization: `User Role + Institution ID + Bound Hardware Fingerprint`. |
| **SuperAdmin Device Control**| No device management UI. | Full SuperAdmin Device Console (`SuperAdminDevices.tsx`) for Activate, Revoke, Replace, and Audit. |
| **Offline Policy** | Requires active connection. | 72-hour Grace Period for short outages; immediate lockdown on revocation or grace expiry. |

---

## 2. Desktop & Licensing Architecture

```
                                  +---------------------------------------+
                                  |         SuperAdmin Web Console        |
                                  |        (admin-web / SuperAdmin)       |
                                  +-------------------+-------------------+
                                                      | Remote Revoke/Replace
                                                      v
+-----------------------------+           +-------------------------------+
|    Windows Desktop App      |           |     Trusted Backend Service   |
|     (center-desktop)        |           |  (device_binding_service.js)   |
+-----------------------------+           +-------------------------------+
|  1. Generate Hardware FP    | --------> | 1. Validate institutionId     |
|  2. Send Activation Request |           | 2. Check active device binding|
|  3. Monitor Device Status   | <-------- | 3. Return ACTIVE / REVOKED    |
|  4. Enforce 72h Grace Period|           | 4. Log Audit Event            |
+-----------------------------+           +-------------------------------+
                                                      |
                                                      v
                                          +-------------------------------+
                                          |       educenter-saas          |
                                          |    Firestore Production       |
                                          +-------------------------------+
```

---

## 3. Data Schema: `/institutions/{tenantId}/deviceBindings/{bindingId}`

```typescript
interface DeviceBindingRecord {
  bindingId: string;                 // e.g. bind_inst_001_1725800000
  institutionId: string;             // e.g. inst_bootstrap_001
  deviceId: string;                  // Derived Hardware SHA-256 Fingerprint
  deviceName: string;                // e.g. WIN-CENTER-RECEPTION-01
  osVersion: string;                 // e.g. Windows 11 Enterprise (10.0.22631)
  appVersion: string;                // e.g. 1.0.0-release.31
  bindingStatus: 'ACTIVE' | 'REVOKED' | 'PENDING_ACTIVATION' | 'REPLACED';
  activatedAt: string;               // ISO 8601 Timestamp
  lastSeenAt: string;                // Updated via heartbeat
  revokedAt?: string | null;         // Timestamp when revoked
  revocationReason?: string | null;  // Human-readable reason
  activatedByUserId: string;         // User ID of initiating Admin
  updatedAt: string;
}
```

---

## 4. Hardware Fingerprinting & Security Model
- **Derivation Engine**: Derives SHA-256 cryptographic hash from non-PII hardware parameters: CPU Architecture + OS Machine GUID + Logical Processor Count + System Memory Size.
- **Server-Authoritative Enforcement**: Local JSON or Registry files CANNOT bypass activation. The server evaluates the raw calculated fingerprint against the stored active record on every session startup and heartbeat.
- **Reinstall & Restart Safety**: Same machine reinstall produces the identical derived fingerprint, maintaining active status (`PASS`).

---

## 5. Implementation Workflow
1. **Pillar 1 — Hardware Fingerprint Engine**: Implement `firebase/device_fingerprint.js` and `center-desktop/src/fingerprint.js`.
2. **Pillar 2 — Backend Service & APIs**: Develop `firebase/device_binding_service.js` with trusted activation, validation, revocation, replacement, and heartbeat methods.
3. **Pillar 3 — Backend Unit Test Suite**: Create `firebase/device_binding_backend.test.js` verifying all 15 required security scenarios.
4. **Pillar 4 — Windows Desktop Application**: Build `center-desktop` Electron / Desktop package integrating center operations UI with device binding lock screens.
5. **Pillar 5 — SuperAdmin Device Control Console**: Build `admin-web/src/components/SuperAdminDevices.tsx` allowing remote activation, revocation, and replacement.
6. **Pillar 6 — Monorepo Build & Verification**: Update `package.json`, `version.json` (`1.0.0-release.31`), `CHANGELOG.md`, `PROJECT_STATE.md`, and `DECISIONS.md`. Execute full test suites (`npm run test:all`, Flutter tests, Web builds).

---

## 6. Out-of-Scope Items
- Phase 32 / Final Release Packaging (automatic auto-updater deployment servers).
- Modifying core database schemas established in Phases 1–30.
