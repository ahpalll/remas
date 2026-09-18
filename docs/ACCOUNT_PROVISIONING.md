# PRODUCTION ACCOUNT PROVISIONING GUIDELINES

## Architecture Decision & Principle

**NO CLOUD FUNCTIONS.**
**NO HTTP BACKEND APIS.**
**NO ADMIN SDK IN CLIENT APPLICATIONS.**

The platform follows a strict 2-tier client + trusted CLI administration architecture:

```
CLIENT APPS (SuperAdmin, Center Desktop, Student, Teacher, Parent)
    ↓
Firebase Client SDK
    ↓
Cloud Firestore + Firestore Security Rules

PRIVILEGED AUTH CREATION / CUSTOM CLAIMS ASSIGNMENT
Trusted Administrative Environment (CI/CD Server or Admin Workstation)
    ↓
Trusted CLI Scripts (Node.js + Firebase Admin SDK)
    ↓
Firebase Authentication + Cloud Firestore
```

---

## Account Provisioning Matrix by Role

| Role | Profile / Record Creation | Firebase Auth Identity & Custom Claims | Auth Mechanism | Client Application |
|---|---|---|---|---|
| **SuperAdmin** | Single bootstrap script | Trusted CLI + Admin SDK (`superAdmin: true`) | Email + Password | SuperAdmin Control Center APK |
| **Center Owner** | SuperAdmin UI / CLI | Trusted CLI + Admin SDK (`role: "institutionOwner"`, `institutionId`) | Email + Password | REMAS Center Desktop App (Windows) |
| **Teacher** | Center UI / CLI | Trusted CLI + Admin SDK (`role: "teacher"`, `institutionId`) | Email + Password | Teacher Mobile App (Android) |
| **Student** | Center UI / CLI | Trusted CLI + Admin SDK (Phone identity + `authUid` linking) | Phone + SMS OTP | Student Mobile App (Android) |
| **Parent** | Center UI / CLI | Trusted CLI + Admin SDK (`role: "parent"`, `institutionId` + linkage) | Email + Password | Parent Portal Mobile App (Android) |

---

## Operational Provisioning Workflows

### 1. SuperAdmin Bootstrap

Bootstrap the primary SuperAdmin account once per Firebase environment using the administrative CLI.

```bash
# Environment Variables required:
export FIREBASE_SERVICE_ACCOUNT_JSON="/secure/path/to/service-account.json"
export SUPERADMIN_EMAIL="admin@remas.edu"
export SUPERADMIN_PASSWORD="<SECURE_PASSWORD>"

# Run CLI Bootstrap Script:
node scripts/bootstrap_superadmin.js --email="$SUPERADMIN_EMAIL" --password="$SUPERADMIN_PASSWORD"
```

* **Custom Claims Assigned**: `{ "role": "superAdmin", "superAdmin": true }`
* **Verification Command**:
  ```bash
  node -e "
  const { getAuth } = require('firebase-admin/auth');
  const { initializeApp, cert } = require('firebase-admin/app');
  initializeApp({ credential: cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  getAuth().getUserByEmail('admin@remas.edu').then(u => console.log(u.customClaims));
  "
  ```

---

### 2. Center & Center Owner Provisioning

1. SuperAdmin creates Institution record from SuperAdmin Control Center or CLI:
   ```bash
   node scripts/create_first_center.js
   ```
2. Provision Center Owner identity and assign institution claims:
   ```bash
   node scripts/bootstrap_center_owner.js \
     --institutionId="inst_phase48" \
     --email="owner.phase48@remas.edu" \
     --name="Phase 48 Owner" \
     --phone="+201048000001"
   ```
* **Custom Claims Assigned**: `{ "role": "institutionOwner", "institutionId": "inst_phase48" }`

---

### 3. Teacher Provisioning

Provision teacher account linked to a target institution:

```bash
node scripts/bootstrap_teacher.js \
  --institutionId="inst_phase48" \
  --email="teacher.phase48@remas.edu" \
  --name="Phase 48 Teacher" \
  --phone="+201048000002"
```

* **Custom Claims Assigned**: `{ "role": "teacher", "institutionId": "inst_phase48" }`
* **Firestore Document Created**: `/institutions/inst_phase48/teachers/tch_<UID>`

---

### 4. Student Provisioning (Phone + OTP Identity)

Student accounts use **Firebase Phone Authentication**.

```bash
node scripts/bootstrap_student.js \
  --institutionId="inst_phase48" \
  --name="Phase 48 Student" \
  --phone="01048484848"
```

* **Phone Normalization**: Input phone `01048484848` is normalized to E.164 canonical format `+201048484848`.
* **Auth Identity**: Reuses existing Phone Auth UID if already registered, otherwise creates a new Auth phone user.
* **Firestore Document Created**: `/institutions/inst_phase48/students/<studentId>` containing `authUid`, `normalizedPhone`, `institutionId`, `status: "ACTIVE"`.
* **Duplicate Prevention**: Same-institution duplicate membership for the same phone number is strictly rejected. Multi-institution membership across different institutions for the same phone UID is permitted.

---

### 5. Parent Provisioning & Child Linkage

Provision parent identity and link to student document(s):

```bash
node scripts/bootstrap_parent.js \
  --institutionId="inst_phase48" \
  --email="parent.phase48@remas.edu" \
  --name="Phase 48 Parent" \
  --phone="+201048000003" \
  --studentIds="student_1789739262686_4hif"
```

* **Custom Claims Assigned**: `{ "role": "parent", "institutionId": "inst_phase48" }`
* **Guardian Record Created**: `/institutions/inst_phase48/guardians/gdn_<UID>`
* **Linkage Document Created**: `/institutions/inst_phase48/studentGuardians/sg_gdn_<UID>_<studentId>`

---

## Security & Credential Safety Guidelines

1. **Service Account Keys**:
   - MUST NEVER be committed to Git or embedded in Flutter/Electron client bundles.
   - MUST be stored in secure environment variables or external protected key stores (`FIREBASE_SERVICE_ACCOUNT_JSON`).
2. **Passwords**:
   - NEVER hardcode passwords in source code, documentation, or commit history.
   - Passwords for administrative bootstrap scripts must be passed via environment variables or generated securely during script execution.
3. **Client SDK Enforcement**:
   - All client applications communicate strictly via Firebase Client SDK.
   - Access controls are enforced strictly by **Firestore Security Rules** evaluated in real-time.
