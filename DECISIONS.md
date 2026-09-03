# Architectural Decision Records (ADR)

## ADR-011: Phase 11 Online Exams Runtime Architecture & Security Model

### Context
Executing online exams requires strict backend write authority, network timeout idempotency, server-authoritative time limits, optimistic answer versioning, and single-transaction submission atomicity with Phase 10 grades.

### Decision
1. **100% Trusted Backend Authority**: Direct client writes to `/examAttempts` and `/examAttempts/{attemptId}/...` are strictly DENIED in Firestore security rules (`allow create, update, delete: if false`). All mutations run via `firebase/online_exam_service.js`.
2. **Attempt Policy (`maxAttempts = 1`)**: Restricted to 1 attempt per student per online exam using deterministic ID `attempt_{examId}_{studentId}_1` mapped 1-to-1 with Phase 10 `grade_{examId}_{studentId}`.
3. **Save Answer Idempotency & Server Versioning**: Answers require `requestId` + `payloadHash` + `serverVersion` inside a Firestore transaction. Same `requestId` + same payload returns cached responses without triggering `ANSWER_VERSION_CONFLICT`.
4. **Strict Answer Deadline (`expiresAt`)**: Zero grace period for accepting answers past `expiresAt`. Network 30s grace period applies ONLY to submission finalization packet receipt.
5. **Subcollection Frozen Question Snapshots**: Attempt questions are copied into `/examAttempts/{attemptId}/questions/{questionId}` from Phase 10 snapshots. Correct answers are strictly stripped. Max 100 questions per exam.
6. **Single-Transaction Submission**: Attempt finalization, objective score calculation, and Phase 10 `Grade` document creation run in a single, side-effect-free Firestore transaction.
