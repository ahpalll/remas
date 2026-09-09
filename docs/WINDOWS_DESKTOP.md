# Windows Desktop Application Architecture & Packaging Specification

## Overview
The **REMAS Center Windows Desktop Application** (`center-desktop`) provides educational centers with a standalone native Windows installation for daily management (Dashboard, Students, Groups, Teachers, Sessions, Attendance, Kiosk Scanner, Reports).

- **Location**: `center-desktop/`
- **Monorepo Version**: `1.0.0-release.31`
- **Target Platform**: Windows 10 / Windows 11 Desktop (64-bit)
- **Licensing Constraint**: **Strict 1-Device Hardware Binding** per institution.

---

## 1. Application Architecture

```
+-------------------------------------------------------------------+
|               Electron Windows Desktop Window (main.js)           |
+-------------------------------------------------------------------+
| Secure IPC Context Bridge (src/preload.js)                        |
|   ├── getDeviceFingerprint()                                      |
|   ├── validateDevice()                                            |
|   ├── activateDevice()                                            |
|   └── sendHeartbeat()                                             |
+-------------------------------------------------------------------+
| HTML5 / React Center Workspace & Lock Screen (index.html)         |
|   ├── Single Device License Badge                                 |
|   ├── Reception Kiosk QR Scanner                                  |
|   ├── Student & Group Management                                  |
|   └── Revocation Lock Overlay                                     |
+-------------------------------------------------------------------+
```

---

## 2. Windows Executable & Installer Packaging
- **Package Config**: Defined in `center-desktop/package.json` using `electron-builder`.
- **Target Format**: Standalone Windows Executable (`remas-center-setup.exe` / NSIS installer).
- **Executable Configuration**:
  - `name`: `remas-center-desktop`
  - `productName`: `REMAS Educational Center Desktop`
  - `appId`: `saas.remas.center.desktop`
  - `artifactName`: `REMAS-Center-Setup-${version}.exe`

---

## 3. Offline Grace Period & Re-validation Policy
1. **Online SaaS Requirement**: REMAS operates primarily as an online SaaS app connected to target project `educenter-saas`.
2. **72-Hour Offline Grace Period**:
   - When temporary internet outages occur, the app calculates elapsed hours since last successful server validation.
   - If `elapsedHours < 72`: The app remains operational in `ACTIVE_OFFLINE_GRACE` mode with an orange warning indicator.
   - If `elapsedHours >= 72`: Sensitive operations lock down until internet connection is restored and server re-validation succeeds.
3. **Immediate Revocation Check**: Upon internet reconnection, background heartbeat immediately invokes `validateDeviceBinding`. If status is `REVOKED`, the application locks out instantly regardless of offline grace state.
