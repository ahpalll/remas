# POST-DEPLOYMENT SMOKE TESTS SPECIFICATION

## 1. Objective
Post-deployment smoke tests validate system integrity immediately following a staging or production release. Smoke tests verify critical pathways across all layers without mutating production operational data or violating tenant boundaries.

## 2. Automated Post-Deployment Verification Matrix

| Area | Verification Test | Target Endpoint / Layer | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **Worker Edge Layer** | Ping Health Endpoint | `https://media.remas.edu/health` | `HTTP 200 OK` + `{"status":"ok"}` |
| **Worker Auth Layer** | Request without Bearer Token | `https://media.remas.edu/v1/media/stream` | `HTTP 401 Unauthorized` |
| **Worker Security** | Request Path Traversal (`../`) | `https://media.remas.edu/v1/media/..%2fprivate` | `HTTP 400 Bad Request` |
| **Auth Boundary** | Invalid Login Attempt | Admin Web / Firebase Auth API | `LOGIN_FAILURE` audit event + `HTTP 401` |
| **Tenant Isolation** | Cross-Tenant Read Attempt | Firestore Rules / Trusted Backend | `HTTP 403 Forbidden` / Rule Denied |
| **Parent-Child Isolation** | Unlinked Child Grade Fetch | Parent Portal Backend Service | `UNAUTHORIZED_PARENT_RELATIONSHIP` |
| **Subscription Gateway** | Redeem Invalid Code | Subscription Service API | `INVALID_SUBSCRIPTION_CODE` |
| **Media Delivery** | Access Expired Signed URL | Cloudflare Worker Edge | `HTTP 403 Forbidden` (Token Expired) |
| **Notifications System** | Mandatory System Push | Notification Gateway API | Delivered regardless of opt-out flags |

## 3. Synthetic Verification Payload Specification

Smoke tests must use dedicated synthetic test tenant identifiers (e.g. `tenant_smoke_test_001`) and MUST NOT mutate or query real user records.

```javascript
const SMOKE_TEST_CONFIG = {
  smokeTenantId: 'tenant_smoke_test_001',
  smokeStudentId: 'student_smoke_1',
  smokeParentId: 'parent_smoke_1',
  timeoutMs: 5000
};
```

## 4. Execution Protocol
1. Execute `npm run verify:production` pre-flight check.
2. Deploy release candidate to target environment.
3. Run automated post-deployment smoke test runner.
4. If ALL smoke tests pass -> Mark release **VERIFIED & OPERATIONAL**.
5. If ANY smoke test fails -> Immediately initiate [ROLLBACK RUNBOOK](file:///F:/remas/docs/ROLLBACK_RUNBOOK.md).
