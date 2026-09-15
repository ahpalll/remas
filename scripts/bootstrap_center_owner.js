/**
 * Trusted Administrative Script: Provision Center Owner Account
 * REMAS Educational Center SaaS
 * 
 * Usage:
 * node scripts/bootstrap_center_owner.js --institutionId="inst_cairo_001" --email="owner@cairo-center.com" --name="Ahmed Mahmoud" --phone="+201000000001"
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const secPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 'F:\\firebase-secrets\\educenter-saas-860c5-firebase-adminsdk-fbsvc-843025940d.json';

function initAdminSDK() {
  if (getApps().length > 0) return;

  if (fs.existsSync(secPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(secPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || 'educenter-saas-860c5'
    });
  } else {
    initializeApp({
      projectId: process.env.GCP_PROJECT || 'educenter-saas-860c5'
    });
  }
}

async function bootstrapCenterOwner() {
  const args = process.argv.slice(2);
  let institutionId = null;
  let email = null;
  let name = 'Center Owner';
  let phone = '+201000000000';
  let password = null;

  args.forEach(arg => {
    if (arg.startsWith('--institutionId=')) institutionId = arg.split('=')[1].trim();
    if (arg.startsWith('--email=')) email = arg.split('=')[1].trim().toLowerCase();
    if (arg.startsWith('--name=')) name = arg.split('=')[1].trim();
    if (arg.startsWith('--phone=')) phone = arg.split('=')[1].trim();
    if (arg.startsWith('--password=')) password = arg.split('=')[1].trim();
  });

  if (!institutionId || !email) {
    console.error('ERROR: --institutionId and --email are required.');
    console.error('Example: node scripts/bootstrap_center_owner.js --institutionId="inst_cairo_001" --email="owner@cairo-center.com"');
    process.exit(1);
  }

  initAdminSDK();
  const auth = getAuth();
  const db = getFirestore();

  console.log(`====================================================`);
  console.log(`TRUSTED BOOTSTRAP: CENTER OWNER PROVISIONING`);
  console.log(`Target Institution ID: ${institutionId}`);
  console.log(`Target Email: ${email}`);
  console.log(`====================================================`);

  // Verify institution exists
  const instRef = db.collection('institutions').doc(institutionId);
  const instSnap = await instRef.get();
  if (!instSnap.exists) {
    console.error(`ERROR: Institution '${institutionId}' does not exist in Firestore.`);
    process.exit(1);
  }

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Found existing Auth user: ${userRecord.uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const pwd = password || `Owner_${Math.random().toString(36).substring(2, 10)}!`;
      userRecord = await auth.createUser({
        email,
        password: pwd,
        displayName: name
      });
      console.log(`Created new Auth user: ${userRecord.uid}`);
      console.log(`GENERATED OWNER PASSWORD: ${pwd}`);
    } else {
      throw err;
    }
  }

  // Set Custom Claims
  await auth.setCustomUserClaims(userRecord.uid, {
    role: 'institutionOwner',
    institutionId
  });
  console.log(`Set custom claims: { role: 'institutionOwner', institutionId: '${institutionId}' }`);

  const nowISO = new Date().toISOString();

  // Update Institution doc with ownerId and ownerEmail
  await instRef.update({
    ownerId: userRecord.uid,
    ownerEmail: email,
    updatedAt: nowISO
  });
  console.log(`Updated institution document owner reference.`);

  // Create global user record in /users/{uid}
  const globalUserDoc = {
    uid: userRecord.uid,
    email: email,
    phone: phone,
    displayName: name,
    role: 'institutionOwner',
    status: 'ACTIVE',
    institutionId: institutionId,
    institutionIds: [institutionId],
    createdAt: nowISO,
    updatedAt: nowISO
  };
  await db.collection('users').doc(userRecord.uid).set(globalUserDoc, { merge: true });

  // Create tenant user record in /institutions/{institutionId}/users/{uid}
  const tenantUserDoc = {
    uid: userRecord.uid,
    email: email,
    phone: phone,
    fullName: name,
    role: 'institutionOwner',
    institutionId: institutionId,
    status: 'ACTIVE',
    createdAt: nowISO,
    updatedAt: nowISO
  };
  await db.collection('institutions').doc(institutionId).collection('users').doc(userRecord.uid).set(tenantUserDoc, { merge: true });

  console.log(`====================================================`);
  console.log(`CENTER OWNER PROVISIONING COMPLETE!`);
  console.log(`UID: ${userRecord.uid}`);
  console.log(`Institution ID: ${institutionId}`);
  console.log(`====================================================\n`);
}

bootstrapCenterOwner().catch(err => {
  console.error('CENTER OWNER PROVISIONING ERROR:', err);
  process.exit(1);
});
