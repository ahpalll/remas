# PRODUCTION DEPLOYMENT GUIDE & CHECKLIST

## 1. Current Deployment Status

```text
====================================================================
PRODUCTION DEPLOYMENT: BLOCKED / USER ACTION REQUIRED
====================================================================
Reason: Cloud infrastructure credentials (Firebase Service Account,
Cloudflare API Tokens, R2 Credentials) are not injected into git or
local workspace environment.

The codebase is fully verified as PRODUCTION-READY FOUNDATION.
Real cloud deployment requires manual credentials provisioning.
====================================================================
```

## 2. Pre-Deployment Prerequisites Checklist

Before initiating production deployment, ensure the following infrastructure is provisioned:

- [ ] **Google Cloud / Firebase Production Project**: Created with billing enabled.
- [ ] **Service Account Key**: Generated with minimum required IAM roles (Firestore Admin, Auth Admin).
- [ ] **Firestore Production Database**: Created in standard location. Firestore indexes deployed (`firebase deploy --only firestore:indexes`).
- [ ] **Firestore Rules**: Deployed (`firebase deploy --only firestore:rules`).
- [ ] **Cloudflare Account & R2 Bucket**: Private R2 Bucket created with CORS configuration allowing frontend origin.
- [ ] **Cloudflare Worker Secrets**: Configured via `wrangler secret put`.
- [ ] **FCM Configuration**: FCM V1 API enabled and credentials linked to backend.
- [ ] **Domain & SSL**: Valid SSL certificate and custom domain routing configured for Admin Web, Parent Web, and Cloudflare Worker.

## 3. Step-by-Step Deployment Runbook

### Step 1: Backend & Firebase Rules Deployment
```bash
# Set target project
firebase use production

# Deploy security rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### Step 2: Cloudflare Worker Deployment
```bash
cd cloudflare/worker

# Set production worker secrets
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY

# Deploy worker to production
wrangler deploy --env production
```

### Step 3: Frontend Web Applications Deployment
```bash
# Admin Web
cd admin-web
npm ci
npm run build
# Upload dist/ to hosting target (Cloudflare Pages / Firebase Hosting)

# Parent Web Portal
cd parent-portal
npm ci
npm run build
# Upload dist/ to hosting target
```

### Step 4: Flutter Mobile Apps Release Build
```bash
# Student App Release APK / Bundle
cd student_app
flutter build apk --release --dart-define=ENVIRONMENT=production --dart-define=FIREBASE_PROJECT_ID=remas-prod

# Parent App Release APK / Bundle
cd parent_app
flutter build apk --release --dart-define=ENVIRONMENT=production --dart-define=FIREBASE_PROJECT_ID=remas-prod
```

## 4. Post-Deployment Verification Protocol
1. **Health Check**: Ping Cloudflare Worker health endpoint (`/health`).
2. **Auth Verification**: Login test account across Admin Web, Student App, Parent App.
3. **Tenant Boundary Test**: Verify Cross-tenant data isolation rejects unauthorized access.
4. **Media Signed URL Test**: Upload test attachment and verify signed URL expiry and access control.
5. **Notification Delivery Test**: Trigger system push notification and verify receipt on mobile apps.
