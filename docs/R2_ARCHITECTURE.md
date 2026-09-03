# Cloudflare R2 Architecture & Integration Specification

## 1. Overview
Cloudflare R2 provides S3-compatible private object storage for educational media assets (Videos, PDFs, Images, Audio, Documents).

## 2. Object Key Specification
All R2 object keys strictly follow the canonical format:
`institutions/{institutionId}/contents/{contentId}/v{version}/{objectId}`

### Properties:
- **Tenant Isolation**: Key prefix enforces institution boundary.
- **Content Scoping**: Directly links media to Phase 12 `EducationalContent`.
- **Version Aware**: Increments upon file replacement.
- **Zero PII / Filename Exposure**: `objectId` is a cryptographically secure random UUID.

## 3. Upload & Delivery Flow
1. **Upload Session Request**: Admin requests upload session from trusted backend.
2. **Short-Lived Upload URL**: Backend generates temporary upload authorization (~15 min expiry).
3. **Direct Upload**: Admin uploads payload directly to R2 bucket.
4. **Finalization**: Trusted backend verifies object presence and updates status to `READY`.
5. **Playback Access**: Client requests playback from Cloudflare Worker; Worker validates token & tenant, then issues temporary signed GET URL (~15 min expiry).
