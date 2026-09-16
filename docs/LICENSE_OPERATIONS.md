# LICENSE & DEVICE BINDING OPERATIONS GUIDE

## 1. Overview

REMAS Educational Center SaaS uses centralized operational license and single-device binding management controlled exclusively by SuperAdmin.

- **Storage Location**: `licenses/{licenseId}` and `deviceBindings/{bindingId}`
- **Security Rule Enforcement**: SuperAdmin has full read/write access (`allow create, update, delete: if isSuperAdmin()`). Center Owners have read-only access to their own institution's active license (`allow read: if isTenantUser(resource.data.institutionId)`). Direct modifications by non-SuperAdmin users are DENIED.

---

## 2. License Record Specification (`licenses/{licenseId}`)

| Field | Type | Description |
|---|---|---|
| `licenseId` | String | Unique Firestore Document ID |
| `institutionId` | String | Target Institution ID |
| `licenseCode` | String | Human-readable activation code (e.g. `REMAS-INST-2026-X9Y8Z7`) |
| `plan` | String | Subscription tier (`STANDARD`, `PRO`, `ENTERPRISE`) |
| `status` | String | Lifecycle state (`ACTIVE`, `SUSPENDED`, `REVOKED`, `PENDING_ACTIVATION`, `EXPIRED`) |
| `startAt` | String (ISO) | Issuance / activation timestamp |
| `expiresAt` | String (ISO) | Subscription expiration timestamp |
| `deviceBindingId` | String | ID of active Windows device binding document (or empty) |
| `deviceBindingStatus` | String | State (`UNBOUND`, `BOUND`, `SUSPENDED`, `REVOKED`) |
| `deviceFingerprintHash` | String | Hardware SHA256 fingerprint hash |
| `deviceName` | String | Hostname / OS identifier of bound Windows machine |

---

## 3. SuperAdmin License Control Operations

Via `SuperAdminService` in `superadmin_app`:

1. **Create License**: Creates document in `/licenses/{licenseId}` with status `ACTIVE` and expiration date (default 365 days).
2. **Activate License**: Sets status to `ACTIVE`.
3. **Suspend License**: Sets status to `SUSPENDED` with audit reason. Blocks Center Desktop login.
4. **Revoke License**: Sets status to `REVOKED`. Permanently disables Center Desktop operation for that institution.
5. **Extend License**: Adds days (e.g. 30, 90, 365) to `expiresAt`.
6. **Release Device / Unbind**: Sets `deviceBindings/{bindingId}` status to `UNBOUND` and clears `deviceBindingId` in license, allowing owner to bind a new Windows PC.
7. **Rebind Device**: Binds a new machine fingerprint hash to the active license.
