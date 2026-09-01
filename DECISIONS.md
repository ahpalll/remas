# Architectural Decisions Log

## Phase 4 Decisions
1. **Trusted Provisioning Saga**: Replaced client-side secondary Auth user creation with a server-managed Provisioning Saga (`provisionUser`) that executes compensating Auth deletions if token claims or Firestore write steps fail.
2. **Client Firestore Write Isolation**: Client direct document creation (`allow create: if false;`) and physical deletion (`allow delete: if false;`) are completely denied.
3. **Whitelisted Profile Updates**: Client updates are restricted strictly to `['fullName', 'phone', 'updatedAt', 'updatedBy']` requiring `updatedBy == request.auth.uid` and `updatedAt == request.time`.
4. **Token Revocation**: Suspend and Archive flows invoke `admin.auth().revokeRefreshTokens(uid)` alongside setting `disabled = true`.

## Phase 5 Decisions
1. **Resource-Day Schedule Locking Engine**: Implemented `db.runTransaction()` with Resource-Day Lock documents (`/scheduleLocks/lock_{resource}_{id}_{dayOfWeek}`) for atomic serialization of concurrent schedule creation and update requests targeting the same teacher, room, or group.
2. **Student & Parent Read Restriction**: Broad collection reads on Academic Core collections (`subjects`, `teachers`, `stages`, `groups`, `rooms`, `schedules`, `academicYears`, `terms`) are strictly denied to `student` and `parent` roles in `firestore.rules`.
3. **Server-Only Mutation Matrix**: `schedules`, `groups`, `academicYears`, `terms`, `uniqueness`, `scheduleLocks` are strictly `allow create, update, delete: if false;` for clients.
4. **Teacher ↔ Subject Authority**: `Teacher.subjectIds: string[]` is the authoritative source of truth. Backend validates `teacher.subjectIds.includes(group.subjectId)` during group creation.
