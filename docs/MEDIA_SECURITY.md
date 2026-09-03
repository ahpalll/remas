# Media Security & Cloudflare Worker Security Specification

## 1. Security Principles
- **Private Bucket**: Cloudflare R2 bucket is strictly private (`public_access = false`).
- **Zero Credentials Exposure**: S3/R2 credentials reside in Cloudflare Worker environment secrets.
- **Short-Lived Ephemeral Signed URLs**: Presigned URLs expire after 15 minutes.
- **Path Traversal Prevention**: Worker rejects input containing `../`, `%2e%2e`, or mismatched institution prefixes.
- **Security Headers**: All Worker responses set `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and restricted `Access-Control-Allow-Origin`.

## 2. Worker Extension Point
Phase 13 establishes the `authorizeEducationalContentAccess` function within the Cloudflare Worker. In Phase 13, it validates caller identity and tenant matching. Phase 14 will later extend this function to enforce subscription codes and package entitlements.
