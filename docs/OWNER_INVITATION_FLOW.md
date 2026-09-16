# OWNER INVITATION & SECURE PROVISIONING FLOW

## 1. Context & Security Requirement

In REMAS Educational Center SaaS, Center Owner accounts hold administrative authority over institution data (`role: institutionOwner`, `institutionId: inst_...`).

To maintain strict zero-trust security:
1. No Firebase Admin SDK keys or service account credentials are place inside any client application (Mobile APKs, Windows Desktop EXE, or Web Portal).
2. Firebase Auth Client SDK cannot grant custom claims or assign arbitrary `institutionId` parameters without server-side validation.
3. Client-side self-registration with arbitrary `institutionId` selection is strictly DENIED by security rules.

---

## 2. Invitation Lifecycle & Data Schema

### Firestore Location
`institutions/{institutionId}/invitations/{invitationId}` (mirrored to `/invitations/{invitationId}`)

### Data Schema
```json
{
  "invitationId": "inv_9876543210",
  "institutionId": "inst_cairo_001",
  "email": "owner@cairo-center.com",
  "phone": "+201000000001",
  "role": "institutionOwner",
  "status": "PENDING",
  "createdAt": "2026-09-16T18:00:00.000Z",
  "expiresAt": "2026-09-23T18:00:00.000Z"
}
```

### Invitation Status States
- `PENDING`: Initial state created by SuperAdmin during Center Onboarding.
- `ACCEPTED` / `COMPLETED`: Account created and identity linked by trusted operator script.
- `EXPIRED`: Timestamp `request.time >= expiresAt`. Access DENIED.
- `REVOKED`: Manually cancelled by SuperAdmin. Access DENIED.

---

## 3. Practical Onboarding Flow Steps

1. **Step 1 (SuperAdmin Panel)**: SuperAdmin completes the 5-step Onboarding Wizard in `superadmin_app`. The invitation record is written to Firestore.
2. **Step 2 (Pending State)**: SuperAdmin sees status `PENDING_OWNER` and the exact CLI activation command.
3. **Step 3 (Operator Execution)**: Operator executes:
   ```bash
   node scripts/bootstrap_center_owner.js --institutionId="inst_cairo_001" --email="owner@cairo-center.com"
   ```
4. **Step 4 (Identity Provisioning)**: The trusted script creates/fetches the Firebase Auth user, assigns custom claims `{ role: 'institutionOwner', institutionId: 'inst_cairo_001' }`, updates Firestore user documents, and updates invitation status to `ACCEPTED`.
5. **Step 5 (First Login)**: Owner logs into Center Desktop app on Windows. The app resolves UID -> profile -> custom claim -> institutionId -> license -> device binding -> Center Dashboard.
