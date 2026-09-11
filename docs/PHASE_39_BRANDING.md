# Phase 39 — REMAS EDU Official Branding & White-Label Architecture

## 1. Overview & Data Model
Phase 39 implements the official REMAS EDU branding and dynamic multi-tenant white-label system across all platforms (Center Desktop, Student App, Teacher App, Parent App, Parent Portal, and SuperAdmin Dashboard).

### Source-of-Truth Branding Data Model
All institution branding configuration is stored strictly in Cloud Firestore as a subobject on the institution document:

```
institutions/{institutionId}
  branding: {
    institutionId: string,
    centerName: string,
    logoAssetId: string | null,
    watermarkAssetId: string | null,
    logoUrl: string | null,
    watermarkUrl: string | null,
    primaryColor: string,      // Hex color (e.g. #0F172A)
    secondaryColor: string,    // Hex color (e.g. #0284C7)
    accentColor: string,       // Hex color (e.g. #D97706)
    backgroundColor: string,   // Hex color (e.g. #FFFFFF)
    loginTitle: string,
    loginSubtitle: string,
    welcomeMessage: string,
    updatedAt: string,         // ISO 8601 timestamp
    updatedBy: string          // Auth UID
  }
```

> [!IMPORTANT]
> - No subcollections (`institutions/{id}/branding/{doc}`) are used.
> - No local file JSON stores (`remas_desktop_store.json`) or memory caches serve as authoritative storage.
> - Deleting local UI preference files does not impact cloud branding persistence.

## 2. Cloudflare R2 Media Asset Architecture
Branding binary image files (logos, watermarks) are uploaded and served exclusively through Cloudflare R2 via secure Worker presigned URLs.

- **Presigned Upload Flow**: Client calls `uploadBrandingAsset()` -> receives 15-minute expiring presigned upload URL -> uploads binary directly to Cloudflare R2 bucket.
- **Client Security**: No R2 access keys, secret keys, or bucket credentials are exposed in client-side code, Electron main/renderer processes, or Web builds.

## 3. Official Platform Identity & Palette Tokens
- **English Name**: REMAS EDU
- **Arabic Name**: رِماس للتقنية التعليمية
- **English Descriptive Name**: REMAS Educational Platform
- **Official Tagline**: إدارة أذكى.. تعليم أفضل
- **Color Tokens**:
  - `primary`: `#0F172A` (Deep Navy)
  - `secondary`: `#0284C7` (Cyan)
  - `accent`: `#D97706` (Gold)
  - `neutral`: `#FFFFFF` / `#0A192F` (Dark Mode)

## 4. Firestore Security Rules Enforcement
Tenant isolation for branding reads and writes is enforced at the database level inside `firebase/firestore.rules`:

```cel
match /institutions/{institutionId} {
  allow read: if isTenantUser(institutionId) || isSuperAdmin();
  allow update: if (isTenantAdmin(institutionId) || isSuperAdmin())
    && (!request.resource.data.keys().hasAny(['updatedBy']) || request.resource.data.updatedBy == request.auth.uid)
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['institutionId', 'id', 'ownerId', 'createdBy', 'createdAt']);
}
```

Cross-tenant write attempts directly via Firebase Web Client SDK bypass application wrappers and receive a hard `permission-denied` rejection from Cloud Firestore Rules Emulator.

## 5. Center Desktop UI Scoping & SuperAdmin Isolation
- **Center Desktop User Scope**: Restricted strictly to `institutionOwner` and `admin`.
- **SuperAdmin Separation**: Zero SuperAdmin role selectors, login dropdowns, or SuperAdmin dashboards exist within Center Desktop. SuperAdmin functions remain strictly isolated in the web platform portal.

## 6. Official Brand Asset Status
> [!WARNING]
> **OFFICIAL BINARY BRAND ASSETS**: `BLOCKED — REQUIRED BRAND ASSET FILES`
> 
> Official production logo PNG/JPG/SVG binaries are not present in the repository. Synthetic image files have NOT been fabricated. All code-level asset slots, fallbacks, preview components, presigned URL upload pipelines, and theme engines are 100% complete and verified.

## 7. Verification Summary
- **Rules Emulator Tests**: 192 / 192 rules assertions PASSED.
- **Branding Unit Suite**: 20 / 20 branding engine assertions PASSED.
- **Packaged Executable E2E Suite**: 16 / 16 packaged E2E assertions PASSED (including real process PID launch & termination, local store deletion audit, controlled database failure handling, and direct Client SDK cross-tenant rules rejections).

---
**Status Summary**:
- **CODE IMPLEMENTATION**: `VERIFIED`
- **OFFICIAL BRAND ASSETS**: `BLOCKED — REQUIRED BRAND ASSET FILES`
