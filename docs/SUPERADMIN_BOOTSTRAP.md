# SUPERADMIN & PLATFORM ACCOUNT BOOTSTRAP GUIDE

## 1. Overview

This document outlines the **Trusted Administrative Bootstrap Procedure** for initializing the first SuperAdmin platform account and provisioning Center Owner user identities in REMAS Educational Center SaaS.

Per Phase 44/45/46 Security Architecture Rules:
- Zero Firebase Admin SDK credentials, service account JSON files, or private keys are bundled inside client applications (Center Desktop EXE, SuperAdmin APK, Student APK, Teacher APK, Parent APK, or Web Portal).
- Authentication for client users is performed directly via Firebase Auth Client SDK (`signInWithEmailAndPassword`, `signInWithPhoneNumber`).
- Privileged user creation and custom claim assignments (`role: superAdmin`, `role: institutionOwner`, `institutionId`) are executed securely outside client artifacts via trusted administrative CLI scripts.

---

## 2. Trusted Bootstrap Environment Requirements

Administrative bootstrap scripts require:
1. Node.js runtime environment (v18 or above).
2. Service Account JSON key located outside git workspace (default: `F:\firebase-secrets\educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json` or passed via `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable).
3. Firebase Admin SDK dependency (`firebase-admin`).

---

## 3. First SuperAdmin Account Creation Procedure

### Command Execution
```bash
node scripts/bootstrap_superadmin.js --email="admin@remas.edu" --password="SECURE_ADMIN_PASSWORD"
```

### Script Execution Logic (`scripts/bootstrap_superadmin.js`)
1. Checks for existing Firebase Auth user by email address.
2. Creates new Firebase Auth user if non-existent.
3. Sets custom claims:
   ```json
   {
     "role": "superAdmin"
   }
   ```
4. Creates global user document in Firestore `/users/{uid}`:
   ```json
   {
     "uid": "<FIREBASE_AUTH_UID>",
     "email": "admin@remas.edu",
     "role": "superAdmin",
     "status": "ACTIVE",
     "displayName": "REMAS SaaS SuperAdmin",
     "createdAt": "<TIMESTAMP>",
     "updatedAt": "<TIMESTAMP>"
   }
   ```

---

## 4. Center Owner Provisioning & Activation Procedure

### Operator Command Execution
```bash
node scripts/bootstrap_center_owner.js --institutionId="inst_cairo_001" --email="owner@cairo-center.com" --name="Ahmed Mahmoud" --phone="+201000000001"
```

### Script Execution Logic (`scripts/bootstrap_center_owner.js`)
1. Verifies that the target `institutionId` exists in Firestore `/institutions/{institutionId}`.
2. Creates or fetches Firebase Auth identity for the center owner.
3. Assigns tenant-scoped custom claims:
   ```json
   {
     "role": "institutionOwner",
     "institutionId": "inst_cairo_001"
   }
   ```
4. Updates institution document `/institutions/inst_cairo_001` with `ownerId` and `ownerEmail`.
5. Creates tenant user profile in `/institutions/inst_cairo_001/users/{uid}` and `/users/{uid}`.

---

## 5. Security & Access Recovery Policy

- **Password Rules**: Initial passwords are generated using high-entropy random generation and output strictly to the secure administrative console terminal. Passwords are NEVER written to Firestore, git, or application logs.
- **Access Reset**: Operators can reset access or update claims using `bootstrap_center_owner.js --reset`.
- **Revocation**: Setting user status to `SUSPENDED` or `ARCHIVED` disables access across all platform client apps.
