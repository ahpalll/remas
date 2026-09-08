# Backup & Disaster Recovery Architecture Specification

## Overview

The Backup & Disaster Recovery module (`firebase/backup_disaster_recovery_service.js`) provides automated verification of Point-in-Time Recovery (PITR), cloud backup export schedules, and disaster recovery procedures for REMAS Educational Center SaaS on live Firebase Production (`educenter-saas` / `educenter-saas-860c5`).

---

## Service Level Agreements (SLA Targets)

| SLA Parameter | Target Metric | Architectural Enforcement Mechanism |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **RPO < 1 Hour** | Firestore Point-in-Time Recovery (PITR) continuous transaction logging (7-day retention). |
| **Recovery Time Objective (RTO)** | **RTO < 4 Hours** | Automated `gcloud firestore databases restore` workflow to target staging/prod database. |
| **Backup Frequency** | **Daily Automated Exports** | Scheduled GCS bucket exports (`gs://educenter-saas-860c5-firestore-backups`). |

---

## Backup & Recovery Configuration Details

1. **Continuous PITR Logging**:
   - GCP Firestore PITR continuous logging preserves data history down to the microsecond for the preceding 7 days.
   - Allows non-destructive query of historic database state without restoring the full database.

2. **Scheduled Database Exports**:
   - Daily automated GCP Cloud Scheduler job triggers complete Firestore metadata and collection exports to Google Cloud Storage (`gs://educenter-saas-860c5-firestore-backups`).
   - Exports include cross-region replication for geo-redundant storage.

3. **Production Safety & Non-Destructive Guard**:
   - **Destructive Restores on Production**: Strictly **PROHIBITED** (`destructiveRestoreOnProd: PROHIBITED`).
   - Restores execute into an isolated database instance (`restored-db`) for verification prior to production traffic switchover.
   - Zero synthetic business records are created during backup audits.

---

## Disaster Recovery Runbook Procedures

### Step 1: Emergency Incident Declaration & Quarantine
Safely halt active administrative mutations via trusted backend feature flags.

### Step 2: Timestamp & Restore Point Identification
Identify target recovery timestamp $T$ (within past 7 days) prior to the data corruption incident.

### Step 3: Firestore Database PITR Restore Command
Execute gcloud restore command to isolated destination database:
```bash
gcloud firestore databases restore \
  --source-database=projects/educenter-saas-860c5/databases/(default) \
  --destination-database=projects/educenter-saas-860c5/databases/restored-db \
  --restore-time="2026-09-08T20:00:00Z"
```

### Step 4: Data Integrity & Multi-Tenant Audit
Execute tenant isolation and data count audit scripts against the restored database instance.

### Step 5: Service Traffic Switchover & Verification
Re-bind trusted backend Firestore database references to the restored database instance and execute live verification (`npm run live:verify`).
