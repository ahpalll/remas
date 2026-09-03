# Subscription System Architecture & Code Redemption Lifecycle

## 1. Overview
The Subscription System controls student access to educational content through packages, hashed subscription codes, and active entitlement states.

## 2. Code Generation & Security
- **Entropy**: Cryptographically generated 16-character alphanumeric codes with zero ambiguous characters (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
- **Hashing**: Codes are normalized (uppercase, trimmed) and hashed with SHA-256 (`codeHash`).
- **Zero Plaintext Persistence**: Plaintext codes are returned **ONLY ONCE** at generation time to the admin and are **NEVER** stored in Firestore or logged.

## 3. Redemption Lifecycle & Transaction
1. **Request**: Student submits plaintext code + `requestId`.
2. **Hash & Match**: Backend normalizes, hashes code, and searches `/subscriptionCodes` under caller's `institutionId`.
3. **Validation**: Verifies code status (`AVAILABLE` or `ASSIGNED`), assigned student match (if `ASSIGNED`), and package status (`ACTIVE`).
4. **Atomic Action**:
   - Computes `expiresAt = currentTime + package.durationDays * 86400 * 1000`.
   - Marks code status `REDEEMED`, `redeemedBy = studentId`, `redeemedAt = currentTime`.
   - Creates `Entitlement` document with status `ACTIVE`.
5. **Idempotency**: Replaying request with same `requestId` returns original result without double redemption.
