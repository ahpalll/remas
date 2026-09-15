/**
 * Trusted Administrative Script: Bootstrap SuperAdmin Account
 * REMAS Educational Center SaaS
 * 
 * Usage:
 * node scripts/bootstrap_superadmin.js --email="admin@remas.edu" --password="SuperAdminPassword123!"
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

async function bootstrapSuperAdmin() {
  const args = process.argv.slice(2);
  let email = 'admin@remas.edu';
  let password = null;

  args.forEach(arg => {
    if (arg.startsWith('--email=')) email = arg.split('=')[1].trim().toLowerCase();
    if (arg.startsWith('--password=')) password = arg.split('=')[1].trim();
  });

  if (!email) {
    console.error('ERROR: --email is required.');
    process.exit(1);
  }

  initAdminSDK();
  const auth = getAuth();
  const db = getFirestore();

  console.log(`====================================================`);
  console.log(`TRUSTED BOOTSTRAP: SUPERADMIN ACCOUNT SETUP`);
  console.log(`Target Email: ${email}`);
  console.log(`====================================================`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Found existing Firebase Auth user: ${userRecord.uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const pwd = password || `RemasAdmin_${Math.random().toString(36).substring(2, 10)}!`;
      userRecord = await auth.createUser({
        email,
        password: pwd,
        displayName: 'REMAS SaaS SuperAdmin'
      });
      console.log(`Created new Firebase Auth user: ${userRecord.uid}`);
      console.log(`GENERATED PASSWORD: ${pwd}`);
    } else {
      throw err;
    }
  }

  // Set SuperAdmin Custom Claim
  await auth.setCustomUserClaims(userRecord.uid, { role: 'superAdmin' });
  console.log(`Set custom claim: { role: 'superAdmin' }`);

  // Create global user doc in Firestore /users/{uid}
  const userDoc = {
    uid: userRecord.uid,
    email: userRecord.email,
    role: 'superAdmin',
    displayName: 'REMAS SaaS SuperAdmin',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection('users').doc(userRecord.uid).set(userDoc, { merge: true });
  console.log(`Updated Firestore document: /users/${userRecord.uid}`);
  console.log(`====================================================`);
  console.log(`SUPERADMIN BOOTSTRAP COMPLETE!`);
  console.log(`====================================================\n`);
}

bootstrapSuperAdmin().catch(err => {
  console.error('SUPERADMIN BOOTSTRAP ERROR:', err);
  process.exit(1);
});
