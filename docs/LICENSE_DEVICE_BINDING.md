# License Model & Single Device Binding Security Architecture

## Overview
This document specifies the complete data model, cryptographic hardware fingerprint derivation, server-authoritative verification logic, and security rules for **Single Device Licensing** across REMAS Educational Center SaaS.

---

## 1. Complete License Data Schema (`/institutions/{tenantId}/licenses/{licenseId}`)

```typescript
interface CenterLicenseDocument {
  licenseId: string;                 // e.g. lic_inst_001_1725800000
  institutionId: string;             // e.g. inst_bootstrap_001
  licenseCode: string;               // e.g. REMAS-INST001-2026-X9Y8Z7
  status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  issuedAt: string;                  // ISO 8601 Timestamp
  activatedAt?: string | null;       // ISO 8601 Timestamp of first device activation
  expiresAt: string;                 // ISO 8601 Expiration Timestamp
  deviceBindingStatus: 'UNBOUND' | 'BOUND' | 'REVOKED' | 'SUSPENDED';
  deviceInstallationId?: string | null; // Random secure installation GUID
  deviceFingerprintHash?: string | null; // Cryptographic SHA-256 Hardware Fingerprint
  deviceName?: string | null;        // System Hostname
  osVersion?: string | null;         // Windows OS Build String
  appVersion?: string | null;        // REMAS App Version (1.0.0-release.31)
  lastSeenAt?: string | null;        // Updated via heartbeat every 60s
  revokedAt?: string | null;         // Timestamp when revoked by SuperAdmin
  revocationReason?: string | null;  // Documented audit explanation
  createdBy: string;                 // User ID of creating SuperAdmin
  updatedAt: string;                 // Last modified timestamp
}
```

---

## 2. Cryptographic Fingerprint Derivation Formula
- **Engine**: `firebase/device_fingerprint.js`
- **Formula**:
  $$\text{Hash} = \text{SHA-256}(\text{platform} \parallel \text{arch} \parallel \text{cpuModel} \parallel \text{cpuCores} \parallel \text{totalMemoryGb} \parallel \text{hostnameHash} \parallel \text{machineGuid})$$
- **Output Format**: `win_fp_[a-f0-9]{64}`

---

## 3. Server-Authoritative Anti-Bypass Protections

1. **Zero Client Override**: Deleting local `.json` configuration files, clearing application cache, or modifying Windows registry keys CANNOT bypass license enforcement.
2. **Server-Side Validation**: The backend evaluates the raw calculated hardware fingerprint hash against the stored `deviceFingerprintHash` record on Firestore.
3. **1-Device Enforcement**: Attempting activation from a second physical machine is rejected with `DEVICE_LIMIT_EXCEEDED` ("License already bound to another physical device").
4. **Tenant Isolation**: Institution IDs are verified against token custom claims. Cross-tenant activation attempts trigger `CROSS_TENANT_VIOLATION`.
5. **No Embedded Secrets**: Neither the Windows Desktop binary nor client bundles contain `FIREBASE_SERVICE_ACCOUNT_JSON` or Firebase Admin private keys.
