# Entitlement Security & Cloudflare Worker Integration Specification

## 1. Scope Evaluation Determinism
Access is granted if **ANY** active, unexpired entitlement belonging to the student covers the target content scope:
- `SUBJECT`: `content.subjectId` in `entitlement.subjectIds`
- `GROUP`: `student.groupId` in `entitlement.groupIds`
- `LESSON`: `content.lessonId` in `entitlement.lessonIds`
- `CONTENT`: `content.id` in `entitlement.contentIds`
- `MULTI_SCOPE`: Union of matching scopes.

## 2. Cloudflare Worker Integration
The Cloudflare Worker's `authorizeEducationalContentAccess` function executes server-side validation:
1. Verifies Bearer JWT signature, issuer, audience, and expiration.
2. Extracts trusted `uid`, `role`, and `institutionId`.
3. Verifies student has an active, unexpired entitlement matching the requested `objectKey` before generating short-lived R2 presigned GET URLs (~15 min expiry).
4. Rejects untrusted client headers (e.g. `entitled=true`).
