# Architectural Decisions Log

## Phase 5 Decisions
1. **Resource-Day Schedule Locking Engine**: Implemented `db.runTransaction()` with Resource-Day Lock documents (`/scheduleLocks/lock_{resource}_{id}_{dayOfWeek}`) for atomic serialization of concurrent schedule creation and update requests.
2. **Student & Parent Read Restriction**: Broad collection reads on Academic Core collections are strictly denied to `student` and `parent` roles.

## Phase 6 Decisions
1. **SHA-256 QR Hashing**: QR bearer tokens (`rawToken`) are generated as cryptographically secure random UUIDv4 strings. Firestore stores ONLY `qrTokenHash = SHA-256(rawToken)`. Raw tokens are NEVER stored in database.
2. **Active Enrollment Lock & Re-Enrollment**: Historical `Enrollment` records are preserved permanently. Active enrollment uniqueness is managed via temporary lock `/uniqueness/activeEnrollment_{studentId}_{groupId}_{academicYearId}_{termId}`, deleted/released upon withdrawal to allow re-enrollment post-withdrawal.
3. **Group Capacity Concurrency Engine**: Group enrollment uses an atomic counter document (`/groupCounters/{groupId}`) inside `db.runTransaction()`. Ensures `0 <= enrolledCount <= maxCapacity`.
4. **Primary Guardian Concurrency**: `linkGuardian` transactionally enforces max 1 `isPrimary: true` per student. Phone deduplication returns candidate warnings without silent entity merging.
5. **Admin-Only Read Access**: Phase 6 enforces Admin-Only Read (`allow read: if isTenantAdmin(institutionId) || isSuperAdmin();`). Student self-read and Parent linked-child read are explicitly DEFERRED to future app phases.
