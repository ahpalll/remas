# Windows Desktop Application Build & Deployment Protocol

## Overview
This document specifies the official production build, packaging, installation, and initial activation workflow for the **REMAS Center Windows Desktop Application** (`center-desktop`).

- **Target Project**: `educenter-saas` (`educenter-saas-860c5`)
- **Version**: `1.0.0-release.31`
- **Binary Directory**: `center-desktop/`

---

## 1. Build Pipeline & Commands

### Prerequisites
- Node.js `v20.x` or `v22.x`
- Electron `^30.0.0`
- `electron-builder`

### Step 1: Install Dependencies
```bash
cd center-desktop
npm install
```

### Step 2: Test Desktop Pre-Flight Launch
```bash
npm start
```

### Step 3: Package Production Executable & Installer
```bash
npm run build:win
```
This generates the NSIS Windows installer package in `center-desktop/dist/REMAS-Center-Setup-1.0.0-release.31.exe`.

---

## 2. Installation & First Activation Journey

```
           +-------------------------------------------------------+
           | 1. Download & Run REMAS-Center-Setup-1.0.0-release.31 |
           +-------------------------------------------------------+
                                       |
                                       v
           +-------------------------------------------------------+
           | 2. Launch App -> Generate Hardware Fingerprint Hash   |
           |    (win_fp_8f3a9e01b2c3d4e5f678901234567890abcdef...)  |
           +-------------------------------------------------------+
                                       |
                                       v
           +-------------------------------------------------------+
           | 3. Login with Center Admin Credentials & Enter        |
           |    License Code (e.g. REMAS-INST-001-2026-X9Y8Z7)      |
           +-------------------------------------------------------+
                                       |
                                       v
           +-------------------------------------------------------+
           | 4. Invoke Trusted API: activateCenterLicense()        |
           |    - Verifies license validity                        |
           |    - Binds license to single physical machine hash    |
           +-------------------------------------------------------+
                                       |
                                       v
           +-------------------------------------------------------+
           | 5. Workspace Unlocked -> Active Session & Kiosk Scan |
           +-------------------------------------------------------+
```

---

## 3. Remote Revocation & Replacement Procedure

### Scenario A: Remote Revocation (SuperAdmin Control)
1. SuperAdmin accesses `admin-web` -> **Center Licenses & Devices Console** (`SuperAdminLicenses.tsx`).
2. Locates target center institution (e.g., `inst_alex_center`).
3. Clicks 🔴 **Revoke License** and inputs documented revocation reason.
4. On the center's Windows terminal, the next periodic background heartbeat (or app restart) receives `status: REVOKED`.
5. The application instantly locks out the UI with a full-screen revocation overlay.

### Scenario B: Authorized Hardware Replacement (SuperAdmin Control)
1. Center contacts SuperAdmin requesting device transfer due to new hardware purchase.
2. SuperAdmin clicks 🔄 **Rebind / Unbind Device** on `SuperAdminLicenses.tsx`.
3. The previous machine binding transitions to `UNBOUND`.
4. Center launches the app on the new Windows machine, enters the license code, and activates successfully (`LICENSE_ACTIVATED_SUCCESSFULLY`).
