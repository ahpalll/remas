# REMAS Educational Center SaaS — Customer Delivery & Operations Handover Package

**Monorepo Version**: `1.0.0-release.33`  
**Target Firebase Project**: `educenter-saas` (`educenter-saas-860c5`)  
**Date**: September 10, 2026  

---

## 1. Distribution Boundaries

### 1.1 What the Educational Center Receives
1. **Windows Desktop Setup Installer**:
   - Binary Name: `remas-center-desktop Setup 1.0.0-release.33.exe`
   - Executable Size: **72.13 MB**
   - SHA-256 Checksum: `76bd8a24fee96646e2f01aebd7440ee63dcf63c3f5d001e6eb51b056a30c70af`
2. **Center Admin Web Credentials**: Provisioned initial `center_admin` username/email.
3. **Center License Activation Code**: High-entropy license activation key (e.g. `ACT-CENTER-XXXX-YYYY`).
4. **Student & Parent Applications**: Mobile APKs and Parent Web Portal URL (`parent-portal`).

### 1.2 What Remains Exclusively Under Platform Owner (SuperAdmin) Control
- **Firebase Admin Service Account & Secrets**: Maintained strictly server-side on trusted backend infrastructure (`F:\firebase-secrets\...`). Zero service accounts or private keys are handed to centers.
- **Center Tenant Lifecycle Control**: Ability to activate, suspend, or archive center accounts globally (`admin-web/src/components/SuperAdminInstitutions.tsx`).
- **License Remote Management**: Ability to set license expiration dates, generate new codes, suspend licenses, or revoke access (`SuperAdminLicenses.tsx`).
- **Single-Device Binding Governance**: Ability to view center terminal hardware fingerprints (`win_fp_...`), unbind computers, or authorize hardware replacements (`SuperAdminDevices.tsx`).

---

## 2. Infrastructure & System Requirements

### 2.1 Center Hardware & Operating System Requirements
- **Operating System**: Windows 10 or Windows 11 (64-bit).
- **CPU**: Dual-core 2.0 GHz processor or higher.
- **RAM**: 4 GB minimum (8 GB recommended).
- **Disk Space**: 500 MB free space.
- **Network**: Active broadband Internet connection (72-hour offline grace period supported).
- **Peripherals (Optional)**: Standard USB Barcode / QR Code scanner for Fast Reception Kiosk mode.

### 2.2 Student & Faculty Requirements
- **Student Mobile App**: Android 8.0 (Oreo) or higher.
- **Parent Portal**: Any modern web browser (Chrome, Edge, Safari, Firefox).
- **Faculty Access**: Accessible via Center Windows Desktop app or Admin Web console.

---

## 3. First-Day Center Onboarding Checklist

1. **SuperAdmin Tenant Provisioning**:
   - SuperAdmin logs into `admin-web` (`/superadmin/institutions`).
   - Clicks **Create Institution**, enters center name, domain slug, and contact info.
   - Generates activation code under **Center Licenses**.

2. **Center Windows Application Installation**:
   - Run `remas-center-desktop Setup 1.0.0-release.33.exe` on the designated center reception computer.
   - Complete standard NSIS installation wizard.
   - Launch application from Desktop shortcut.

3. **First-Time Device Activation & Hardware Binding**:
   - Enter Center Admin credentials and Activation Code.
   - System computes unique hardware fingerprint (`win_fp_...`) and registers binding server-side.
   - Status badge turns green: `STATUS: BINDING ACTIVE 🟢`.

4. **Academic Structure Setup**:
   - Define Academic Levels (e.g., Grade 10, Grade 11, Grade 12).
   - Create Subjects catalog (e.g., Mathematics, Physics, Chemistry).
   - Register Faculty profiles and assign qualified subjects/levels.

5. **Class Groups & Student Admission**:
   - Create class groups setting `maxCapacity` limits.
   - Register students, assign student codes, and generate QR tokens.
   - Link parents/guardians to student profiles.

---

## 4. Operational Procedures & Protocols

### 4.1 How to Replace a Center Computer
When a center replaces its hardware:
1. SuperAdmin opens `admin-web` -> **Center Licenses & Devices**.
2. Locates the center's active terminal binding.
3. Clicks **Unbind Device** (Audit log event: `DEVICE_UNBOUND`).
4. Center installs software on the new PC and enters the activation code.
5. Server binds the new machine's hardware fingerprint (`DEVICE_BOUND_SUCCESSFULLY`).

### 4.2 How to Revoke a Stolen / Compromised Computer
If a center computer is lost or compromised:
1. SuperAdmin opens `admin-web` -> **Center Licenses & Devices**.
2. Clicks **Revoke Access** on the target device.
3. Background heartbeat instantly locks client execution on the target computer (`STATUS: REVOKED 🔴`).

### 4.3 Handling Network Outages (72-Hour Grace Period)
- If internet connectivity drops, the desktop application enters `ACTIVE_OFFLINE_GRACE` mode.
- Operations continue locally for up to 72 hours.
- Upon reconnecting to internet, the client sends a background heartbeat (`heartbeatDevice`) to sync logs and validate binding status.

---

## 5. Troubleshooting Guide

| Issue / Error | Root Cause | Resolution |
|---|---|---|
| `DEVICE_LIMIT_EXCEEDED` | Attempting to activate license on a 2nd computer | SuperAdmin must unbind original PC before new device can bind. |
| `INSTITUTION_SUSPENDED` | Account suspended by Platform Owner | Contact SuperAdmin to restore center status. |
| `CONNECTION_REQUIRED` | Offline grace period expired (> 72 hours) | Connect computer to internet to refresh license token. |
| `INVALID_FINGERPRINT_FORMAT` | Tampered local hardware identifier | Re-install desktop app from official setup installer. |
