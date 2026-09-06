# PRODUCTION RELEASE CHECKLIST & VERIFICATION GATES

## Pre-Release Phase (CI/CD Automated)
- [ ] **Code Freeze**: All pull requests merged into `master` branch.
- [ ] **Working Tree Clean**: `git status` reports `nothing to commit, working tree clean`.
- [ ] **Backend Unit Tests**: `npm run test:all` executes with 100% pass rate.
- [ ] **Cloudflare Worker Tests**: `cd cloudflare/worker && npm test` passes (17/17 subtests).
- [ ] **Student Flutter App**: `flutter analyze` passes with 0 issues; `flutter test` passes (16/16).
- [ ] **Parent Flutter App**: `flutter analyze` passes with 0 issues; `flutter test` passes (15/15).
- [ ] **Admin Web Build**: `npm run build` in `admin-web` succeeds without TypeScript or Vite errors.
- [ ] **Parent Portal Build**: `npm run build` in `parent-portal` succeeds without TypeScript or Vite errors.
- [ ] **Secret Leak Scan**: Gitleaks and repository grep report 0 secrets in source code or `dist/` build artifacts.

## Release Deployment Phase (Manual Operator Gate)
- [ ] **Production Credentials Injected**: Service Account JSON, Cloudflare API Token, R2 Credentials, and FCM Server Key provided via environment variables.
- [ ] **Firebase Rules Pre-Deployment**: `firebase deploy --only firestore:rules` executed.
- [ ] **Firestore Indexes Pre-Deployment**: `firebase deploy --only firestore:indexes` executed.
- [ ] **Cloudflare Worker Secrets & Routing**: `wrangler secret put` executed for R2 & Firebase keys. Worker deployed to edge (`wrangler deploy --env production`).
- [ ] **Web Frontends Deployment**: Admin Web and Parent Portal static bundles deployed to production CDN.
- [ ] **Mobile App Release Bundle**: Release APK / App Bundle signed with production keystore (`flutter build apk --release`).

## Post-Deployment Phase
- [ ] **Worker Health Check**: Ping `/health` endpoint on Cloudflare Worker domain.
- [ ] **Authentication Verification**: Verify login across Admin Web, Student App, and Parent App.
- [ ] **Tenant Isolation Verification**: Verify cross-tenant access rejection (HTTP 403 / Firestore rule rejection).
- [ ] **Signed URL Verification**: Verify Cloudflare R2 short-lived signed URL generation and expiration.
- [ ] **Push Notification Smoke Test**: Trigger test notification and verify receipt.
- [ ] **Audit Logging Verification**: Verify structured audit event emission to production log stream.
