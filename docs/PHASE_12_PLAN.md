# Phase 12: Educational Content Management — Implementation & Security Plan

---

## 1. Executive Summary & Scope

Phase 12 introduces the **Educational Content Management Foundation** for the multi-tenant SaaS application.

### Key Objectives:
1. **Hierarchy & Metadata Management**: Organize content hierarchically under `Subject` $\rightarrow$ `Lesson` $\rightarrow$ `Content`.
2. **Whitelisted Content Types**: `VIDEO`, `PDF`, `IMAGE`, `AUDIO`, `DOCUMENT`, `LESSON_NOTE`, `LINK`.
3. **Content Lifecycle State Machine**: `DRAFT` $\rightarrow$ `PUBLISHED` $\rightarrow$ `ARCHIVED`.
4. **Strict Tenant Isolation**: All `Lesson` and `Content` records are institution-scoped (`/institutions/{institutionId}/lessons` & `/institutions/{institutionId}/contents`).
5. **Trusted Backend Write Authority**: Direct client writes to lessons and contents are strictly `DENIED` in Firestore security rules (`allow create, update, delete: if false`). Mutations run through trusted backend Cloud Functions (`firebase/content_service.js`).
6. **Optimistic Versioning & Audit Logs**: Version counter increments on every update; audit fields (`createdBy`, `updatedBy`, `createdAt`, `updatedAt`) are server-owned.
7. **Admin Web Management UI**: Arabic RTL dashboard for lessons, content catalog, filtering, sorting, publishing, and archiving.
8. **Student App Domain Foundation**: Safe student DTO models for lesson and content metadata.

### Phase Boundaries (Deferred Items):
- **Phase 13 (Cloudflare R2 & Private Storage)**: Cloudflare R2 bucket integration, private object keys, signed URLs, Cloudflare Workers, secure video player streaming, protected media access.
- **Phase 14 (Subscriptions & Entitlements)**: Subscription codes, package entitlements, access authorization gates.

---

## 2. Firestore Data Model & Schema

### A. Lesson Collection
`Path: /institutions/{institutionId}/lessons/{lessonId}`

- `id`: `string` (`les_{institutionId}_{uuid}`)
- `institutionId`: `string` (Tenant boundary)
- `subjectId`: `string`
- `stageId`: `string | null`
- `title`: `string` (Trimmed, max 200 chars)
- `description`: `string | null` (Max 1000 chars)
- `lessonNumber`: `number` (Positive integer)
- `sortOrder`: `number`
- `status`: `'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`
- `version`: `number` (Server-owned version counter)
- `createdAt`: `Timestamp`
- `createdBy`: `string`
- `updatedAt`: `Timestamp`
- `updatedBy`: `string`
- `publishedAt`: `Timestamp | null`
- `archivedAt`: `Timestamp | null`

### B. Content Collection
`Path: /institutions/{institutionId}/contents/{contentId}`

- `id`: `string` (`cnt_{institutionId}_{uuid}`)
- `institutionId`: `string` (Tenant boundary)
- `lessonId`: `string`
- `subjectId`: `string`
- `stageId`: `string | null`
- `groupId`: `string | null`
- `title`: `string` (Trimmed, max 200 chars)
- `description`: `string | null` (Max 1000 chars)
- `contentType`: `'VIDEO' | 'PDF' | 'IMAGE' | 'AUDIO' | 'DOCUMENT' | 'LESSON_NOTE' | 'LINK'`
- `status`: `'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`
- `sortOrder`: `number`
- `tags`: `string[]`
- `durationSeconds`: `number | null` (For VIDEO/AUDIO)
- `fileSizeBytes`: `number | null` (For files)
- `mimeType`: `string | null`
- `externalReference`: `string | null` (For LINK or neutral placeholder)
- `version`: `number` (Server-owned version counter)
- `createdAt`: `Timestamp`
- `createdBy`: `string`
- `updatedAt`: `Timestamp`
- `updatedBy`: `string`
- `publishedAt`: `Timestamp | null`
- `archivedAt`: `Timestamp | null`

---

## 3. Firestore Security Rules Architecture

```custom
match /institutions/{institutionId}/lessons/{lessonId} {
  allow read: if isTenantAdmin(institutionId) || isSuperAdmin();
  allow create, update, delete: if false;
}

match /institutions/{institutionId}/contents/{contentId} {
  allow read: if isTenantAdmin(institutionId) || isSuperAdmin();
  allow create, update, delete: if false;
}
```

---

## 4. Test Matrix & Verification Strategy

1. **Model & Backend Validation**: Title trimming, whitelisted content types, non-negative numbers, version increments.
2. **Tenant Isolation & Cross-Tenant Rejection**: Cross-tenant subject/lesson references produce `CROSS_TENANT_VIOLATION`.
3. **Security Rules Tests**: Direct client create/update/delete $\rightarrow$ DENIED.
4. **Admin UI & Student Models**: Arabic RTL Admin Web dashboard and Flutter student models.
5. **Build & Regression Verification**:
   - `npm run test:all` (All 424 + new 40 assertions = 464 assertions)
   - `admin-web` production build (`npm run build`)
   - `parent-portal` production build (`npm run build`)
   - `student_app` static analysis (`flutter analyze`) & widget test (`flutter test`)
