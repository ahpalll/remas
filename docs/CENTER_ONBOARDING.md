# CENTER ONBOARDING PROTOCOL & WORKFLOW

## 1. Executive Summary

Phase 46 transforms the REMAS Educational Center SaaS platform into a fully functional operational control center. Center onboarding is managed via the **SuperAdmin Mobile Control Panel** (`superadmin_app`) backed directly by Cloud Firestore (`educenter-saas-860c5`) without any Cloud Functions runtime dependency.

---

## 2. Complete Onboarding Flow Architecture

```
SUPERADMIN LOGIN
       ↓
SUPERADMIN MOBILE APP
       ↓
ONBOARDING WIZARD (5 STEPS)
       ↓
1. Institution Doc Created in Firestore (/institutions/{institutionId})
2. Pending Owner Invitation Doc Created (/institutions/{institutionId}/invitations/{invitationId})
3. Active License Doc Created (/licenses/{licenseId})
       ↓
OPERATOR EXECUTATION OF TRUSTED BOOTSTRAP (node scripts/bootstrap_center_owner.js)
       ↓
Owner Auth Identity Created + Custom Claims Assigned ({ role: 'institutionOwner', institutionId })
       ↓
CENTER OWNER LOGIN ON WINDOWS DESKTOP
       ↓
AUTOMATIC IDENTITY & DEVICE RESOLUTION
       ↓
CENTER DATA CRUD & TENANT ISOLATION
```

---

## 3. SuperAdmin 5-Step Onboarding Wizard

The SuperAdmin app provides a guided wizard (`OnboardingWizardScreen`):

- **STEP 1 — Center Information**: Center Name, Type (center/school/academy), Phone, Email, Address, Default Branding.
- **STEP 2 — Owner Information**: Owner Email, Owner Phone, Display Name. Creates a pending invitation record (`status: PENDING`).
- **STEP 3 — License Selection**: Plan (Standard / Pro / Enterprise), Duration (30 / 90 / 365 days).
- **STEP 4 — Review**: Final verification of institution, owner, and license parameters.
- **STEP 5 — Complete Summary**: Generates real Firestore records and displays exact CLI activation instructions for the platform operator.

---

## 4. Operational Boundaries & Security Safeguards

1. **No Embedded Service Account Credentials**: Client APKs and Center Desktop EXEs do NOT contain Admin SDK keys.
2. **No Unsafe Auth Self-Provisioning**: Firebase Client SDK cannot issue custom claims or create arbitrary accounts without administrative authorization. Account provisioning uses trusted backend script execution.
3. **Multi-Tenant Isolation**: Security rules strictly restrict access to `/institutions/{institutionId}/*` based on custom claim `request.auth.token.institutionId`.
