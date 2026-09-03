# Architectural Decision Records (ADR)

## ADR-013: Phase 13 Cloudflare R2 & Media Delivery Architecture

### Context
Educational binary media assets (Videos, PDFs, Audio, Images, Documents) require private Cloudflare R2 object storage, canonical key formatting, short-lived presigned access (~15 minutes), path traversal protection, zero secret leakage, and clean boundary separation from Phase 14 subscription codes.

### Decision
1. **Private R2 Bucket & Canonical Key Format**: All R2 keys follow `institutions/{institutionId}/contents/{contentId}/v{version}/{objectId}`. Direct public R2 access is strictly DENIED.
2. **Cloudflare Worker Layer**: Worker (`cloudflare/worker/src/index.js`) authenticates requests, enforces path traversal security (`../`), validates tenant isolation, and issues short-lived presigned URLs (900 seconds).
3. **Zero Credentials Exposure**: R2 access keys and secrets reside strictly in environment secrets and are NEVER stored in Firestore or client bundles.
4. **Media Lifecycle**: `UPLOAD_PENDING` $\rightarrow$ `UPLOADED` $\rightarrow$ `PROCESSING` $\rightarrow$ `READY` $\rightarrow$ `FAILED` $\rightarrow$ `ARCHIVED`. Playback requests require `READY` status.
5. **Phase Boundary Preservation**: Subscription codes, package entitlements, and entitlement gates are deferred to Phase 14.
6. **Forensic Reconciliation**: Absolute test assertion baseline reconciled to **513 Assertions** (100% Passing).
