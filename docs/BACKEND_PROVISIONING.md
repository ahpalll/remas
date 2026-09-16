# TRUSTED BACKEND PROVISIONING SPECIFICATION

## 1. Overview
This document specifies the **Trusted Backend Provisioning Architecture** for REMAS Educational Center SaaS.

Per Security Rules & Identity Architecture:
- Client applications (SuperAdmin App, Center Desktop EXE, Mobile Apps) MUST NOT contain Firebase Admin SDK credentials, service account JSON files, or private keys.
- Client applications operate directly with Cloud Firestore and Firebase Auth Client SDK.
- Creating Firebase Auth User identities and setting Custom User Claims (`{ role, institutionId }`) requires trusted backend execution (Firebase Admin SDK).

---

## 2. Cloud Functions Endpoint Inventory (`firebase/functions/index.js`)

| Function Name | Trigger Type | Required Caller Permission | Primary Output / Claims Assigned |
| :--- | :--- | :--- | :--- |
| `provisionCenterOwner` | HTTPS Callable (`v1`) | `superAdmin` / `superadmin` | Auth User + Custom Claim `{ role: 'institutionOwner', institutionId }` |
| `provisionTeacher` | HTTPS Callable (`v1`) | `superAdmin` / `institutionOwner` / `admin` | Auth User + Custom Claim `{ role: 'teacher', institutionId }` |
| `provisionStudentAccount` | HTTPS Callable (`v1`) | `superAdmin` / `institutionOwner` / `admin` | Auth User + E.164 Phone Normalization + Student Document |
| `provisionParent` | HTTPS Callable (`v1`) | `superAdmin` / `institutionOwner` / `admin` | Auth User + Custom Claim `{ role: 'parent', institutionId }` |

---

## 3. Deployment & Billing Requirements

- **Target Firebase Project**: `educenter-saas-860c5`
- **Region**: `us-central1`
- **Node.js Runtime**: `node18`
- **Google Cloud Requirement**: Deploying Cloud Functions v1/v2 requires enabling the Google Cloud Build API (`cloudbuild.googleapis.com`) and Artifact Registry API (`artifactregistry.googleapis.com`), which require the Firebase project to be on the **Blaze (Pay-as-you-go) Plan**.
- **CLI Maintenance Fallback**: When Cloud Functions deployment is pending Blaze plan upgrade, privileged user creation is executed securely by platform operators using trusted administrative Node CLI scripts (`scripts/bootstrap_center_owner.js`).
