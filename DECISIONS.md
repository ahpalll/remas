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

## Phase 7 Decisions
1. **Deterministic Attendance Record ID (`records/{studentId}`)**: Path `/institutions/{institutionId}/attendanceSessions/{sessionId}/records/{studentId}`. Record ID is strictly `studentId`. Guarantees `Session + Student = 1 Record`.
2. **Batch Initialization & Session Roster (>500 Students)**: Session creation sets `status: 'INITIALIZING'`, freezes active group roster, and writes default `ABSENT` records using batched writes (`db.batch()`, 400 docs per chunk). Upon batch completion, session transitions to `status: 'OPEN'`. Check-in scans during `INITIALIZING` return `SESSION_INITIALIZING_TRY_AGAIN`.
3. **O(1) QR & StudentCode Lookups**: QR scans hash raw token (`SHA-256`) and fetch `/uniqueness/student_qr_{qrTokenHash}`. Returns `studentId` in 1 document read. Zero collection scanning.
4. **Timezone Snapshot**: `AttendanceSession.timezone` stores tenant timezone at creation (e.g. `"Africa/Cairo"`). `lateMinutes` is calculated against absolute UTC conversion of `date + startTime + timezone`.
5. **Cancellation Semantics**: `SessionStatus = 'CANCELLED'`. Student records are NEVER deleted or status-changed. Cancelled sessions are strictly EXCLUDED from attendance percentage calculations.
6. **Reopening Audit & Reconcile Engine**: Reopening a `CLOSED` session requires `superAdmin`/`institutionOwner` authority and mandatory `reason: string`. Writes `AttendanceSessionAudit` event and triggers aggregate reconciliation.
7. **Admin-Only Attendance Authority**: Phase 7 attendance management is Admin / institutionOwner / superAdmin ONLY. Teacher-specific workflows and Student/Parent reads remain explicitly DEFERRED.

## Phase 8 Decisions
1. **Immutable Single-Entry Transactional Ledger (`FinancialLedgerEntry`)**: Single-entry append-only financial ledger governed by an explicit accounting-sign convention table. Physical updates or deletions of committed ledger entries are forbidden (`allow create, update, delete: if false`).
2. **Strict Integer Minor Unit Validation**: Backend accepts ONLY validated positive safe integers (`Number.isInteger(amountMinor) && amountMinor > 0 && Number.isSafeInteger(amountMinor)`). Client-supplied decimals, floating-point numbers, negative values, NaN, or Infinity are strictly rejected with `INVALID_MONETARY_AMOUNT`.
3. **Discount & Waiver Unpaid Balance Lock**: Rejects discounts or waivers causing `netAmountMinor < paidAmountMinor` with `DISCOUNT_EXCEEDS_UNPAID_BALANCE`.
4. **Cashbox Cash Validation & Auto-Provisioning**: Cashbox sufficiency validation (`INSUFFICIENT_CASHBOX_BALANCE`) applies ONLY to CASH expenses (`method === 'CASH'`). Card, bank transfer, and cheque expenses bypass cashbox cash limits. If a cash transaction occurs when the current `CashboxPeriod` is `CLOSED`, trusted backend logic auto-opens the next period before allocating the cash movement.
5. **Extended Idempotency Shape & Crash Recovery**: Shape `/uniqueness/idempotency_{institutionId}_{key}` stores `status: 'PROCESSING' | 'COMPLETED' | 'FAILED'`, `requestHash` (SHA-256 of payload), and `createdAt`. Retries during `PROCESSING` return `IDEMPOTENCY_REQUEST_IN_PROGRESS` (or retry execution if server crashes >30s). Mismatched payloads return `IDEMPOTENCY_PAYLOAD_MISMATCH`.
6. **Immutable Payment Source Document**: `StudentPayment` source document is 100% IMMUTABLE (`amountMinor`, `studentId`, `chargeId`, `receiptId`, `receiptNumber`, `method`, `paidAt`, `createdBy`, `createdAt`). Refunds create separate immutable `FinancialRefund` records. Only `refundedAmountMinor` and `status` exist as derived metadata views.
7. **Institution-Scoped Receipt Numbers**: Receipt numbers follow format `REC-{institutionId}-{YYYY}-{000001}` generated atomically inside `db.runTransaction()` using counter doc `/uniqueness/receipt_counter_{institutionId}_{YYYY}`.
8. **Admin-Only Financial Authority**: Phase 8 financial management is Admin / institutionOwner / superAdmin ONLY. Teacher-specific workflows and Student/Parent financial reads remain explicitly DEFERRED.
