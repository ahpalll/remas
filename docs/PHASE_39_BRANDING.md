# Phase 39 — REMAS EDU Official Branding & White-Label Architecture

## 1. Overview & Monorepo Architecture
Phase 39 implements the official REMAS EDU branding and dynamic multi-tenant white-label system across all 6 monorepo client surfaces:
1. **Center Desktop App** (Windows Electron App)
2. **Student App** (Flutter Mobile App)
3. **Teacher App** (Flutter Mobile App)
4. **Parent App** (Flutter Mobile App)
5. **Parent Web Portal** (React / Vite Web App)
6. **SuperAdmin Web Console** (React / Vite Web App)

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
> - No subcollections (`institutions/{id}/branding/{doc}`) are created.
> - No local file JSON stores (`remas_desktop_store.json`), SharedPreferences, or localStorage memory stores serve as authoritative storage.
> - Deleting local UI preference files does not impact cloud branding persistence.

## 2. Multi-Client Dynamic Branding Pipeline
Across all client applications:

1. **Unauthenticated State**:
   Displays official REMAS EDU Platform branding:
   - English Name: `REMAS EDU`
   - Arabic Name: `رِماس للتقنية التعليمية`
   - English Description: `REMAS Educational Platform`
   - Official Tagline: `إدارة أذكى.. تعليم أفضل`
   - Primary Color: `#0F172A` (Deep Navy)
   - Secondary Color: `#0284C7` (Cyan)
   - Accent Color: `#D97706` (Gold)
   - Background Color: `#FFFFFF` / `#0A192F`

2. **Authenticated Context Resolution**:
   - User signs in with Firebase Client Auth.
   - Authorized context resolves user's custom claim `institutionId` (or for Parent App/Portal, resolves authorized child's `institutionId`).
   - Query `institutions/{institutionId}` from Cloud Firestore using Web / Flutter Client SDK.
   - Dynamically apply center colors, center name, and logo URL to UI.

3. **Fallback & Tenant Isolation**:
   - If network fails or institution document lacks `branding` object -> fall back cleanly to REMAS EDU platform defaults.
   - An arbitrary `institutionId` parameter supplied by UI query parameter or unauthenticated request is NEVER trusted.

## 3. Cloudflare R2 Media Asset Architecture
Branding binary image files (logos, watermarks) are uploaded and served exclusively through Cloudflare R2 via secure Worker presigned URLs.

- **Presigned Upload Flow**: Client calls `uploadBrandingAsset()` -> receives 15-minute expiring presigned upload URL -> uploads binary directly to Cloudflare R2 bucket.
- **Client Security Audit**: Zero R2 access keys, secret keys, or bucket credentials are exposed in client-side code, Electron main/renderer processes, Flutter apps, or React Web builds.

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

Cross-tenant write attempts directly via Firebase Web Client SDK bypass application guards and receive a hard `permission-denied` rejection from Cloud Firestore Rules Emulator.

## 5. Official Brand Asset Status
> [!WARNING]
> **OFFICIAL BINARY BRAND ASSETS**: `BLOCKED — REQUIRED BRAND ASSET FILES`
> 
> Official production logo PNG/JPG/SVG binaries are not present in the repository. Synthetic image files have NOT been fabricated. All code-level asset slots, fallbacks, preview components, presigned URL upload pipelines, and theme engines are 100% complete and verified.

## 6. Runtime Screenshot Evidence

| Screen Description | File Path | Size (Bytes) | SHA-256 |
| :--- | :--- | :--- | :--- |
| **Student REMAS Splash** | `C:\Users\hp\.gemini\antigravity-ide\brain\168caeb7-3700-43fb-9875-1b0b46eea9c5\phase39_01_student_remas_splash.png` | 24721 | `204a42786d65d6ba8214c2fc80d52fd26cd05590379673c819c0b769125745e3` |
| **Student Center Branded Screen** | `C:\Users\hp\.gemini\antigravity-ide\brain\168caeb7-3700-43fb-9875-1b0b46eea9c5\phase39_02_student_center_branded.png` | 24825 | `67e7e90a4c1f6630066d46ceb122d5f328b81970faa7634fa3bd430fba4cba67` |
| **Teacher REMAS Splash** | `C:\Users\hp\.gemini\antigravity-ide\brain\168caeb7-3700-43fb-9875-1b0b46eea9c5\phase39_03_teacher_remas_splash.png` | 24463 | `3dfb07b6e37df38ee81b637ef7248a26ae955405de89ce807d4899a263936a3d` |
| **Teacher Center Branded Screen** | `C:\Users\hp\.gemini\antigravity-ide\brain\168caeb7-3700-43fb-9875-1b0b46eea9c5\phase39_04_teacher_center_branded.png` | 26769 | `f70df9716314a256f6093d11cecf48179d552c0ab10bb822ca6d5fde36e34b7f` |
| **Parent REMAS Splash** | `C:\Users\hp\.gemini\antigravity-ide\brain\168caeb7-3700-43fb-9875-1b0b46eea9c5\phase39_05_parent_remas_splash.png` | 24716 | `9310e2ec2a74e638672ab6951c55675cc67095d43708d357382cae64ac194877` |
| **Parent Center Branded Screen** | `C:\Users\hp\.gemini\antigravity-ide\brain\168caeb7-3700-43fb-9875-1b0b46eea9c5\phase39_06_parent_center_branded.png` | 27003 | `eee1aab3effe3849b5fd071f27b94e02687ab839f7478294f450e3454c033eba` |
| **Parent Portal Branded Screen** | `C:\Users\hp\.gemini\antigravity-ide\brain\168caeb7-3700-43fb-9875-1b0b46eea9c5\phase39_07_parent_portal_center_branded.png` | 27072 | `5f3278bad0a893d34e54b81558e76548a8b977e4b50c36e3393720ef7744c990` |

## 7. Verification Summary
- **Firestore Security Rules**: 192 / 192 rules assertions PASSED (`npm run test:rules`).
- **Branding & Multi-Client Suite**: 23 / 23 branding unit & multi-client assertions PASSED (`node --test firebase/phase_39_branding.test.js`).
- **Packaged Executable E2E Suite**: 16 / 16 packaged E2E assertions PASSED (`node scratch/run_phase_39_full_e2e.js`).
- **Student App Flutter Tests**: 32 / 32 assertions PASSED (`flutter test` in `student_app`).
- **Teacher App Flutter Tests**: 16 / 16 assertions PASSED (`flutter test` in `teacher_app`).
- **Parent App Flutter Tests**: 16 / 16 assertions PASSED (`flutter test` in `parent_app`).
- **Client Secret & Admin SDK Scan Audit**: 0 secrets, 0 Firebase Admin SDK imports in client apps.

---
**Status Summary**:
- **PHASE 39**: `VERIFIED`
- **OFFICIAL BRAND ASSETS**: `BLOCKED — REQUIRED BRAND ASSET FILES`
