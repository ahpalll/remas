# ROLLBACK RUNBOOK & RECOVERY SPECIFICATION

## 1. Rollback Triggers
Initiate immediate rollback if any of the following conditions occur post-deployment:
- Post-deployment smoke test suite failure.
- Elevation of error rates (> 1% HTTP 5xx responses) on Cloudflare Worker or Backend Functions.
- Unhandled security rule failures or tenant boundary leaks.
- Database latency spikes or transaction lock exhaustion.

## 2. Component Rollback Runbooks

### 2.1 Cloudflare Worker Edge Layer Rollback
To instantly revert Cloudflare Worker to the previous stable release:
```bash
cd cloudflare/worker
# Rollback worker deployment to previous version
wrangler rollback
```

### 2.2 Firestore Security Rules & Indexes Rollback
To revert Firestore rules to the baseline commit:
```bash
# Checkout rules from baseline commit
git checkout 58004280857a0394941b111dd987aae6edf0e387 firebase/firestore.rules

# Redeploy rules to production
firebase deploy --only firestore:rules
```

### 2.3 Web Application Rollback (Admin Web & Parent Portal)
Revert CDN routing pointer or redeploy build artifacts from previous release commit:
```bash
# Checkout previous web build
git checkout 58004280857a0394941b111dd987aae6edf0e387 admin-web parent-portal

# Rebuild and upload to hosting
cd admin-web && npm ci && npm run build
# Deploy dist/ artifact
```

### 2.4 Mobile Applications Rollback
Mobile app store releases cannot be forcibly uninstalled from client devices:
1. **API Fallback**: Ensure backend remains backward compatible with previous mobile client version.
2. **Force Update Flag**: Increment `minimumRequiredAppVersion` in Remote Config to prompt users to update if critical security fix is deployed.

## 3. Rollback Verification Protocol
After executing component rollback:
1. Re-run post-deployment smoke tests (`POST_DEPLOYMENT_SMOKE_TESTS.md`).
2. Confirm error rates return to zero baseline.
3. Log rollback incident in `CHANGELOG.md` and audit log.
