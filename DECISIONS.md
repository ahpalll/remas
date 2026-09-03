# Architectural Decision Records (ADR)

## ADR-012: Phase 12 Educational Content Management Architecture & Security Model

### Context
Managing educational content metadata requires strict tenant isolation, whitelisted content types, hierarchical organization (`Subject` $\rightarrow$ `Lesson` $\rightarrow$ `Content`), optimistic versioning, and clean separation from Cloudflare R2 object storage (Phase 13) and subscription authorization (Phase 14).

### Decision
1. **100% Trusted Backend Authority**: Direct client writes to `/lessons` and `/contents` are strictly DENIED in Firestore security rules (`allow create, update, delete: if false`). All mutations run via `firebase/content_service.js`.
2. **Whitelisted Content Types**: Supported content types are restricted to `VIDEO`, `PDF`, `IMAGE`, `AUDIO`, `DOCUMENT`, `LESSON_NOTE`, and `LINK`.
3. **Content Lifecycle State Machine**: `DRAFT` $\rightarrow$ `PUBLISHED` $\rightarrow$ `ARCHIVED`. Updating archived items is prohibited.
4. **Optimistic Versioning**: Updates automatically increment a server-owned `version` counter (`version = previousVersion + 1`).
5. **Phase Boundary Preservation**: Cloudflare R2 credentials, signed URLs, Cloudflare Workers, secure video playback, and subscription entitlements are deferred to Phases 13 & 14.
