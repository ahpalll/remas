# Phase 14: Subscription Codes & Content Entitlements — Architecture & Security Plan

---

## 1. Executive Summary & Core Objectives

Phase 14 introduces the **Subscription Codes and Content Entitlements System** for the multi-tenant SaaS application.

### Key Objectives:
1. **Subscription Package Management**: Define package products (`/institutions/{institutionId}/packages`) scoped by `SUBJECT`, `GROUP`, `LESSON`, `CONTENT`, or `MULTI_SCOPE`.
2. **Cryptographic Subscription Codes**: Generate high-entropy subscription codes (`/institutions/{institutionId}/subscriptionCodes`). Plaintext codes are **NEVER** stored in Firestore; only cryptographic SHA-256 hashes (`codeHash`) are persisted.
3. **Atomic Code Redemption**: Transactional code redemption (`redeemSubscriptionCode`) validates caller identity, checks code status, computes exact server-owned expiration (`expiresAt = redemptionTime + durationDays`), marks code `REDEEMED`, and creates an `Entitlement` atomically.
4. **Request Idempotency**: Identical `requestId` + payload replays previously recorded successful redemption result.
5. **Deterministic Scope Evaluation**: `evaluateStudentContentAccess` checks if ANY active, unexpired entitlement covers the requested content scope (`STUDENT` $\rightarrow$ `TENANT` $\rightarrow$ `ENTITLEMENT` $\rightarrow$ `CONTENT`).
6. **Integration with Phase 13 Cloudflare Worker**: The Worker's `authorizeEducationalContentAccess` function verifies entitlement validity before issuing short-lived R2 presigned URLs.
7. **Strict Phase Boundary Preservation**: Phase 14 provides entitlement management and code redemption. Complete Student App UX redesign or video player overhaul is deferred to Phase 15.

---

## 2. System Architecture & Access Chain

```
[ Student App ] 
       │
       ├─► 1. Redeem Code / Authenticate ──► Trusted Backend (subscription_service.js)
       │                                            │
       │                                            ▼ Validates Code Hash & Transaction
       │                                            ▼ Creates Active Entitlement Document
       │
       └─► 2. Request Media Playback ─────► Cloudflare Worker (src/index.js)
                                                    │
                                                    ▼ Cryptographically Verifies Token
                                                    ▼ Evaluates Entitlement Scope
                                                    ▼ Issues Ephemeral Presigned R2 URL (~15 min)
```

---

## 3. Data Models & Firestore Collections

### A. Subscription Package Collection
`Path: /institutions/{institutionId}/packages/{packageId}`
- `id`, `institutionId`, `name`, `description?`, `status` (`DRAFT` | `ACTIVE` | `SUSPENDED` | `ARCHIVED`), `durationDays`, `priceMinor`, `currency`, `scopeType` (`SUBJECT` | `GROUP` | `LESSON` | `CONTENT` | `MULTI_SCOPE`), `allowedSubjectIds`, `allowedGroupIds`, `allowedLessonIds`, `allowedContentIds`, `version`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.

### B. Subscription Code Collection
`Path: /institutions/{institutionId}/subscriptionCodes/{codeId}`
- `id`, `institutionId`, `packageId`, `codeHash`, `codePrefix`, `status` (`AVAILABLE` | `ASSIGNED` | `REDEEMED` | `EXPIRED` | `REVOKED` | `CANCELLED`), `redemptionMode` (`SINGLE_USE` | `ASSIGNED`), `assignedStudentId?`, `redeemedBy?`, `redeemedAt?`, `expiresAt?`, `version`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.

### C. Entitlement Collection
`Path: /institutions/{institutionId}/entitlements/{entitlementId}`
- `id`, `institutionId`, `studentId`, `packageId`, `sourceCodeId`, `scopeType`, `subjectIds`, `groupIds`, `lessonIds`, `contentIds`, `startsAt`, `expiresAt`, `status` (`ACTIVE` | `SUSPENDED` | `EXPIRED` | `REVOKED`), `revokedAt?`, `revokedBy?`, `suspendedAt?`, `suspendedBy?`, `createdAt`, `createdBy`, `version`.

---

## 4. Firestore Security Rules

Direct client writes to `packages`, `subscriptionCodes`, and `entitlements` are strictly `DENIED` (`allow create, update, delete: if false`). Read access is institution-scoped for admins, student-scoped for own entitlements, and linked-child scoped for parents.

---

## 5. Test Matrix & Verification Strategy

1. **Backend Unit Tests**: Code generation entropy, SHA-256 code hashing, atomic redemption, idempotency, expiration calculation, cross-tenant rejection, scope evaluation.
2. **Worker Security Tests**: Cryptographic token validation & entitlement scope verification.
3. **Admin Web & Student App UIs**: Admin subscription dashboard and Flutter code redemption service.
4. **Full Regression Verification**: All 513 baseline assertions + 47 new assertions = **560 total assertions**.
