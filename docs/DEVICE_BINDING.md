# Single Device Binding & Hardware Fingerprint Security Specification

## Technical Goal
To prevent unauthorized distribution and un-licensed sharing of the REMAS Center Windows Desktop application by enforcing a strict **1-Device Binding** rule per institution.

---

## 1. Hardware Fingerprint Derivation Algorithm
- **Engine**: `firebase/device_fingerprint.js`
- **Derivation Inputs** (Non-PII):
  - CPU Processor Model & Core Count (`os.cpus()`)
  - Operating System Platform & Architecture (`os.platform()`, `os.arch()`)
  - Total Installed Memory (`os.totalmem()`)
  - System Machine GUID & Hostname SHA-256 Digest
- **Crypto Formula**:
  `hash = SHA-256(platform | arch | cpuModel | cpuCores | totalMem | hostnameHash | machineGuid)`
- **Format**: `win_fp_[a-f0-9]{64}` (e.g. `win_fp_8f3a9e01b2c3d4e5f678901234567890abcdef1234567890abcdef12345678`)

---

## 2. Server-Authoritative Anti-Tamper Policy
1. **Zero Client Authority**: Local `.json` settings, `.txt` license keys, or Windows registry flags can NEVER authorize a device.
2. **Runtime Verification**: The server calculates and compares the live hardware fingerprint against the stored binding record in `/institutions/{tenantId}/deviceBindings` on session start and heartbeat.
3. **Reinstall & Restart Consistency**: Re-installing the software or restarting Windows produces the identical hardware fingerprint, matching the existing active record (`PASS`).
4. **Second Device Prevention**: Attempting to run the same institution account on a second physical machine generates a different fingerprint (`fp2 !== fp1`), triggering immediate rejection (`DEVICE_LIMIT_EXCEEDED`).

---

## 3. Data Schema: `/institutions/{tenantId}/deviceBindings/{bindingId}`

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `bindingId` | string | Unique document ID (`bind_inst_001_1725800000`) |
| `institutionId` | string | Target tenant institution ID (`inst_bootstrap_001`) |
| `deviceId` | string | Derived SHA-256 Hardware Fingerprint (`win_fp_...`) |
| `deviceName` | string | Hostname / Machine name |
| `osVersion` | string | Windows build & version string |
| `appVersion` | string | App release version (`1.0.0-release.31`) |
| `bindingStatus` | string | Status: `ACTIVE`, `REVOKED`, `PENDING_ACTIVATION`, `REPLACED` |
| `activatedAt` | string | ISO 8601 Timestamp of initial activation |
| `lastSeenAt` | string | ISO 8601 Timestamp of last heartbeat |
| `revokedAt` | string | Timestamp when revoked by SuperAdmin |
| `revocationReason` | string | Human-readable explanation of revocation |
