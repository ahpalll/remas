# Phase 13: Cloudflare R2 + Secure Media Delivery — Architecture & Security Plan

---

## 1. Executive Summary & Core Objectives

Phase 13 establishes the **Secure Media Storage and Delivery Foundation** for the Educational Center SaaS monorepo.

While Phase 12 owns educational content metadata (`Lesson` & `EducationalContent`), Phase 13 introduces private binary object storage via **Cloudflare R2** and a **Cloudflare Worker access layer** for generating short-lived signed URLs (~15 minutes) for authorized media upload and playback.

### Core Objectives:
1. **Private Cloudflare R2 Storage**: All video, PDF, audio, document, and image files are stored in private R2 buckets. Public access to the R2 bucket is **STRICTLY DENIED**.
2. **Canonical Object Key Format**:  
   `institutions/{institutionId}/contents/{contentId}/v{version}/{objectId}`  
   Ensures deterministic tenant isolation, versioning, and zero PII or original filename exposure.
3. **Cloudflare Worker Access Layer**: Intercepts media requests, cryptographically verifies caller identity and tenant claims, verifies content status is `READY`, and issues short-lived presigned URLs.
4. **Media Object Lifecycle**:  
   `UPLOAD_PENDING` $\rightarrow$ `UPLOADED` $\rightarrow$ `PROCESSING` $\rightarrow$ `READY` $\rightarrow$ `FAILED` $\rightarrow$ `ARCHIVED`.
5. **Zero Secret Exposure**: R2 access keys, secret keys, and Worker secrets are NEVER stored in Firestore, NEVER bundled into frontend React/Flutter apps, and NEVER committed to Git.
6. **Strict Phase Boundary Preservation**: Phase 13 provides an extensible authorization extension point (`authorizeEducationalContentAccess`), but **DOES NOT** implement Phase 14 subscription codes or package entitlements.

---

## 2. System Architecture & Data Flow

```
[ Admin Web / Student App ] 
           │
           ├─► 1. Request Upload/Media Access ──► Trusted Backend / Worker
           │                                             │
           │                                             ▼ Authenticates Firebase Token & Claims
           │                                             ▼ Validates Tenant & Content Status
           │                                             ▼ Generates Ephemeral Signed URL (~15 min)
           │
           ├─► 2. Direct Upload/Stream ──────────► Private Cloudflare R2 Bucket
```

---

## 3. Data Model & Firestore Schema Extensions

### Media Metadata Extension (Attached to Content):
`Path: /institutions/{institutionId}/contents/{contentId}`

- `storageProvider`: `'R2'`
- `objectKey`: `string` (`institutions/{institutionId}/contents/{contentId}/v{version}/{objectId}`)
- `mediaVersion`: `number`
- `mediaStatus`: `'UPLOAD_PENDING' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED'`
- `mimeType`: `string`
- `fileSizeBytes`: `number`
- `durationSeconds`: `number | null`
- `checksum`: `string | null` (SHA-256)
- `uploadedAt`: `Timestamp | null`
- `uploadedBy`: `string | null`

---

## 4. Security Rules & Worker Authentication

### Worker Auth Verification:
1. Client sends Bearer JWT token in `Authorization` header.
2. Worker verifies Firebase JWT signature using JWKS public keys (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`).
3. Extracts trusted `uid`, `role`, `institutionId`.
4. Rejects request if tenant does not match `objectKey` institution parameter (`CROSS_TENANT_VIOLATION`).

---

## 5. Test Matrix & Verification Strategy

1. **Worker Tests**: Signature validation, path traversal rejection (`../`), cross-tenant rejection, short expiration (~15 min).
2. **Backend Service Tests**: `requestUploadUrl`, `finalizeMediaUpload`, `requestPlaybackUrl`.
3. **Secret Scan**: Verify `R2_ACCESS_KEY` & `R2_SECRET` zero exposure in frontend assets or repository tracking.
4. **Build & Suite Verification**:
   - `npm run test:all` (Full regression suite across all 13 phases)
   - `admin-web` & `parent-portal` builds
   - `student_app` static analysis & test
