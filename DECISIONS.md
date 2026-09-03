# Architectural Decision Records (ADR)

## ADR-014: Phase 14 Subscription Codes & Content Entitlements Architecture

### Context
Educational content access control requires subscription packages, high-entropy subscription codes, SHA-256 code hashing, atomic transactional redemption, request idempotency, server-owned duration calculations, scope evaluation, zero plaintext code persistence in Firestore, and integration with Phase 13 Cloudflare Worker.

### Decision
1. **100% Trusted Backend Authority**: Direct client writes to `/packages`, `/subscriptionCodes`, and `/entitlements` are strictly DENIED in Firestore security rules (`allow create, update, delete: if false`). All mutations run via `firebase/subscription_service.js`.
2. **SHA-256 Code Hashing**: Plaintext codes are generated server-side with high entropy and returned ONLY ONCE at creation time. Only `codeHash` is saved in Firestore.
3. **Atomic Code Redemption**: Code redemption is transactional, checks idempotency via `requestId`, sets code status `REDEEMED`, and creates an `Entitlement` document atomically.
4. **Scope Evaluation**: Content access is authorized if ANY active, unexpired entitlement covers the target scope (`SUBJECT`, `GROUP`, `LESSON`, `CONTENT`, `MULTI_SCOPE`).
5. **Worker Integration**: Cloudflare Worker verifies caller identity and entitlement scope before issuing short-lived R2 presigned URLs (~15 min expiry).
