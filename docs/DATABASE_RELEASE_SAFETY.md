# DATABASE RELEASE & MIGRATION SAFETY SPECIFICATION

## 1. Core Migration Principles
1. **Zero Destructive Updates**: Schema changes must be additive (adding optional new fields or collections). Field deletions or restructuring must follow a 2-phase migration strategy.
2. **Rules First Deployment**: Security rules and indexes MUST be deployed to production before any database schema migration or application deployment.
3. **Backward Compatibility**: Backend functions and client applications must gracefully parse legacy data formats without throwing runtime exceptions.
4. **Pre-Deployment Snapshots**: A mandatory database snapshot MUST be created before executing schema migrations.

## 2. Deployment Sequence & Order of Operations

```text
[1. CREATE DATABASE SNAPSHOT (gcloud firestore export)]
                         │
                         ▼
[2. DEPLOY FIRESTORE INDEXES (firebase deploy --only firestore:indexes)]
                         │
                         ▼
[3. DEPLOY FIRESTORE SECURITY RULES (firebase deploy --only firestore:rules)]
                         │
                         ▼
[4. RUN ADDITIVE SCHEMA MIGRATION SCRIPTS]
                         │
                         ▼
[5. DEPLOY TRUSTED BACKEND & CLOUDFLARE WORKER]
                         │
                         ▼
[6. DEPLOY WEB & MOBILE APPLICATIONS]
```

## 3. Schema Versioning & Additive Upgrades

### Standard Field Addition (Phase 19 Pattern)
When adding a new field to a Firestore document (e.g. `notificationPreferences.systemMandatory`):
- Assign a default fallback value in DTO deserialization logic (`doc['systemMandatory'] ?? true`).
- Ensure Firestore rules permit the new field without breaking existing validation schemas.
- Do NOT make newly added fields mandatory in historical documents until all records are backfilled.

### Data Restructuring / Renaming (2-Phase Migration)
If a field `oldName` must be replaced by `newName`:
- **Phase A (Dual Write)**: Write to both `oldName` and `newName`. Read from `newName` if present, falling back to `oldName`.
- **Phase B (Backfill & Cleanup)**: Run background migration script backfilling `newName` across all documents. Drop `oldName` support in a subsequent release.

## 4. Rollback & Recovery Strategy
If a database issue occurs post-release:
1. **Revert Security Rules**: Re-apply previous Firestore security rules commit (`git checkout HEAD~1 firebase/firestore.rules && firebase deploy --only firestore:rules`).
2. **Point-in-Time Recovery (PITR)**: Restore database state to timestamp immediately preceding migration using GCP Firestore PITR.
3. **Verify Data Integrity**: Run `npm run test:rules` and `npm run test:readiness` against restored database instance.
