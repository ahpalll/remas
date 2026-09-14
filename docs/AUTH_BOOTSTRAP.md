# REMAS Educational SaaS — Auth Bootstrap Procedure

> [!IMPORTANT]
> The default mock credentials previously present in the application are no longer valid for production authentication.

## First SuperAdmin Account Creation Procedure

1. Configure your target Firebase project environment (e.g. `educenter-saas`).
2. Provide trusted Admin SDK service account credentials via `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable or place service account credentials in a secure environment.
3. Execute the offline SuperAdmin bootstrap script:
   ```bash
   node firebase/scripts/bootstrap_superadmin.js --email=superadmin@remas.edu --password=<SUPERADMIN_SECURE_PASSWORD> --name="Global SuperAdmin"
   ```
4. Obtain the generated UID and confirm assigned custom claims:
   ```json
   {
     "role": "superAdmin"
   }
   ```
5. Launch `superadmin_app` APK or desktop suite.
6. Log in using the provisioned SuperAdmin email and password.
7. Confirm access to SuperAdmin Control Center dashboard.

## Safe SuperAdmin Reset / Disable Procedure
- To disable a SuperAdmin account:
  ```bash
  node -e "require('firebase-admin/auth').getAuth().updateUser('<SUPERADMIN_UID>', { disabled: true })"
  ```
- To revoke active tokens:
  ```bash
  node -e "require('firebase-admin/auth').getAuth().revokeRefreshTokens('<SUPERADMIN_UID>')"
  ```
