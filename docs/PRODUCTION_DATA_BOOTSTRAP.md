# PRODUCTION DATA MODEL & TENANT BOOTSTRAP SPECIFICATION

## 1. Complete SaaS Firestore Collection Taxonomy

The REMAS Educational Center SaaS monorepo structures data into 22 dedicated collection domains:

```text
[FIRESTORE ROOT]
│
├── systemMetadata/                     (Global System Metadata & Config)
│   ├── appConfig                       (Release version, app name, supported roles)
│   ├── systemRoles                     (System role definitions & hierarchy)
│   └── subscriptionScopes              (Entitlement scope taxonomy)
│
├── systemHealth/                       (Infrastructure Health & Verification)
│   └── {checkId}                       (Ephemeral health check records)
│
└── institutions/                       (Multi-Tenant Institution Boundary)
    └── {institutionId}                 (Tenant Configuration & Status)
        ├── profiles/                   (User Profiles & Role Mapping)
        ├── students/                   (Student Core Domain Records)
        ├── guardians/                  (Parent / Guardian Relationships)
        ├── teachers/                   (Academic Instructors)
        ├── subjects/                   (Academic Curricula & Subjects)
        ├── groups/                     (Student Class / Group Divisions)
        ├── sessions/                   (Scheduled Teaching Sessions)
        ├── attendanceSessions/         (Session Attendance Masters)
        ├── attendanceRecords/          (Individual Attendance Logs)
        ├── assignments/                (Student Homework & Tasks)
        ├── exams/                      (Assessment Templates & Answer Keys)
        ├── grades/                     (Student Exam & Assessment Scores)
        ├── onlineExams/                (Online Exam Runtime Sessions)
        ├── examAttempts/               (Student Online Exam Submissions)
        ├── lessons/                    (Educational Course Units)
        ├── contents/                   (Protected Video & Document Metadata)
        ├── packages/                   (Subscription Package Offerings)
        ├── subscriptionCodes/          (SHA-256 Encrypted Activation Codes)
        ├── entitlements/               (Active Content Entitlement Passports)
        ├── transactions/               (Financial Payment Logs)
        ├── notifications/              (Targeted Push & In-App Messages)
        ├── devices/                    (Registered FCM Device Tokens)
        ├── mediaMetadata/              (R2 Object Storage Metadata)
        └── auditLogs/                  (System Security & Audit Trail)
```

## 2. Single Tenant Provisioning Specification

The Tenant Data Bootstrap Engine (`firebase/production_data_bootstrap.js`) initializes a new educational center with strict safety contracts:

```json
{
  "institutionId": "inst_bootstrap_001",
  "name": "REMAS Primary Educational Center",
  "type": "CENTER",
  "status": "ACTIVE",
  "environment": "PRODUCTION",
  "createdBy": "system_bootstrap",
  "createdAt": "2026-09-06T22:07:00.000Z",
  "updatedAt": "2026-09-06T22:07:00.000Z"
}
```

### Bootstrap Safety Principles
1. **Idempotency**: Before creating `institutions/{institutionId}`, the bootstrapper queries for document existence. If present, creation is skipped cleanly (`STATUS: ALREADY_EXISTS`).
2. **Dry-Run Mode (`--dry-run`)**: Pre-validates configuration and displays planned collection writes without executing database mutations.
3. **Zero Business Data**: Boots ONLY tenant configuration and initial admin role mapping metadata. Does NOT create fake students, fake guardians, usable subscription codes, or mock financial transactions.
4. **Structured Audit Trail**: Every tenant bootstrap operation emits a structured audit record into `auditLogs`.

## 3. Non-PII Data Count Verification Engine
The `production:counts` command aggregates system collection metrics for monitoring without exposing PII:

```text
====================================================
REMAS PRODUCTION DATA COUNTS METRICS (NON-PII)
====================================================
Institutions: 1
Profiles: 1
Students: 0
Teachers: 0
Guardians: 0
Groups: 0
Subscriptions: 0
Entitlements: 0
Notifications: 0
====================================================
```
