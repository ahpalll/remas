# Trusted Device Activation API & SuperAdmin Control Specification

## Overview
The **Device Activation API** exposes trusted server-authoritative methods for activating, validating, revoking, and replacing center Windows terminal bindings, paired with the SuperAdmin Console (`admin-web/src/components/SuperAdminDevices.tsx`).

- **Service Module**: `firebase/device_binding_service.js`
- **Target Project**: `educenter-saas` (`educenter-saas-860c5`)

---

## 1. Trusted API Contracts

### `requestDeviceActivation({ institutionId, deviceFingerprint, deviceMeta, callerToken })`
- **Caller**: Tenant Admin or SuperAdmin.
- **Rules**:
  - Enforces `role === 'admin' || role === 'superadmin' || role === 'institutionOwner'`.
  - Enforces tenant boundary matching `callerToken.institutionId`.
  - Rejects if an active binding exists for a *different* device ID (`DEVICE_LIMIT_EXCEEDED`).
  - Returns `DEVICE_BOUND_SUCCESSFULLY` or `ALREADY_ACTIVE_SAME_DEVICE`.

### `validateDeviceBinding({ institutionId, deviceFingerprint, callerToken })`
- **Caller**: Windows Desktop App runtime.
- **Rules**:
  - Verifies tenant active status (`INSTITUTION_SUSPENDED` if suspended).
  - Verifies subscription state (`SUBSCRIPTION_EXPIRED` if expired).
  - Checks if device status is `REVOKED` or `DEVICE_MISMATCH`.
  - Returns `{ valid: true, status: 'ACTIVE' }` on match.

### `revokeDeviceBinding({ institutionId, bindingId, reason, callerToken })`
- **Caller**: SuperAdmin ONLY (`role === 'superadmin'`).
- **Rules**:
  - Updates binding status to `REVOKED` and sets `revokedAt` timestamp.
  - Emits immutable audit log `DEVICE_BINDING_REVOKED`.

### `replaceDeviceBinding({ institutionId, newDeviceFingerprint, reason, callerToken })`
- **Caller**: SuperAdmin ONLY (`role === 'superadmin'`).
- **Rules**:
  - Marks previous active binding as `REPLACED`.
  - Provisions new active binding for `newDeviceFingerprint`.
  - Emits immutable audit log `DEVICE_BINDING_REPLACED`.

### `heartbeatDevice({ institutionId, deviceFingerprint, appVersion, callerToken })`
- **Caller**: Active Windows Desktop App.
- **Rules**:
  - Refreshes `lastSeenAt` timestamp every 60 seconds.
  - Detects server revocation immediately and signals app lockdown.

---

## 2. SuperAdmin Management Console Capabilities
Located at `admin-web/src/components/SuperAdminDevices.tsx`:
- Cross-tenant table of registered center terminals across all institutions.
- Search & filter by Institution ID or Fingerprint ID.
- Actions:
  - 🟢 **Activate**: Re-authorize terminal access.
  - 🔴 **Revoke**: Instantly revoke active binding with documented reason.
  - 🔄 **Replace**: Revoke previous binding and register a new hardware fingerprint hash.
