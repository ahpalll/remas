# BACKUP & DISASTER RECOVERY STRATEGY

## 1. Executive Summary
This document establishes the Backup & Recovery Strategy for the REMAS Educational Center SaaS monorepo. It outlines backup schedules, recovery objectives, restoration procedures, and disaster recovery runbooks.

## 2. Recovery Objectives

| Metric | Target | Description |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 1 Hour** | Maximum acceptable data loss window during disaster. |
| **RTO (Recovery Time Objective)** | **< 4 Hours** | Maximum acceptable downtime for full system restoration. |

## 3. Storage Layer Backup Specifications

### 3.1 Firestore Multi-Tenant Database
- **Automated Export**: Daily export to Google Cloud Storage (GCS) cold-line bucket using Cloud Scheduler + Cloud Functions.
- **Continuous Backups / Point-in-Time Recovery (PITR)**: Enabled on Firestore Production instances allowing recovery to any microsecond in the past 7 days.
- **Export Bucket Policy**: Lifecycle rule moving backups older than 30 days to Archive storage class, deleted after 365 days.

### 3.2 Cloudflare R2 Object Storage
- **Media Assets Replication**: Event-driven or scheduled cross-region R2 bucket replication (`remas-media-prod` -> `remas-media-backup`).
- **Object Versioning**: Enabled to prevent accidental deletion or ransomware overwrites.

### 3.3 Configuration & Secrets
- Infrastructure as Code (IaC) configuration and rules version-controlled in Git repo (`dc41a051...`).
- Environment variables and keys stored in primary & secondary encrypted Secret Managers.

## 4. Disaster Recovery & Restoration Runbook

### Scenario A: Firestore Data Corruption / Accidental Deletion
1. **Identify Corruption Timestamp**: Determine exact UTC time of failure.
2. **Execute PITR Recovery**:
   ```bash
   gcloud firestore databases restore \
     --source-database='projects/remas-prod/databases/(default)' \
     --destination-database='projects/remas-prod/databases/restored-db' \
     --snapshot-time='2026-09-06T20:00:00Z'
   ```
3. **Validate Restored Tenant Data**: Verify tenant integrity using `config_validator.js` and system audit logs.
4. **Switch Database Alias**: Re-point application backend connections to restored database.

### Scenario B: Cloudflare R2 Storage Loss
1. **Activate Secondary R2 Bucket**: Update Worker environment binding `R2_BUCKET_NAME` to `remas-media-backup`.
2. **Redeploy Worker Edge Layer**:
   ```bash
   cd cloudflare/worker
   wrangler deploy --env production
   ```
3. **Initiate Asynchronous Backfill**: Sync lost objects from backup storage bucket to primary bucket.

### Scenario C: Complete Regional Outage
1. **Redeploy Web Frontends**: Deploy `admin-web` and `parent-portal` build artifacts to secondary Cloudflare CDN region.
2. **Redeploy Cloudflare Worker**: Deploy edge router to active data center.
3. **Restore Firestore to Secondary Region**: Restore Firestore database snapshot to secondary region GCP cluster.

## 5. Verification & DR Exercises
- **Quarterly Restoration Test**: Restore last night's Firestore export to staging environment and execute full test regression suite (`npm run test:all`).
- **Audit Verification**: Log DR test completion and duration to compliance audit log.
