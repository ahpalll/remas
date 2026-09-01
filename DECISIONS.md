# Architectural Decisions Log

## Phase 4 Decisions
1. **Trusted Provisioning Saga**: Replaced client-side secondary Auth user creation with a server-managed Provisioning Saga (`provisionUser`) that executes compensating Auth deletions if token claims or Firestore write steps fail.
2. **Client Firestore Write Isolation**: Client direct document creation (`allow create: if false;`) and physical deletion (`allow delete: if false;`) are completely denied.
3. **Whitelisted Profile Updates**: Client updates are restricted strictly to `['fullName', 'phone', 'updatedAt', 'updatedBy']` requiring `updatedBy == request.auth.uid` and `updatedAt == request.time`.
4. **Token Revocation**: Suspend and Archive flows invoke `admin.auth().revokeRefreshTokens(uid)` alongside setting `disabled = true`.
