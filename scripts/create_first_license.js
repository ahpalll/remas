const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
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

async function createFirstLicense() {
  initAdminSDK();
  const db = getFirestore();

  const institutionId = 'inst_remas001';
  const licenseId = 'lic_remas001';
  const now = new Date();
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const licRef = db.collection('licenses').doc(licenseId);

  // 1. Create License
  const licenseData = {
    licenseId: licenseId,
    institutionId: institutionId,
    licenseCode: 'REMAS-REMA-2026-X7Y8Z9',
    plan: 'PRO',
    status: 'ACTIVE',
    startAt: now.toISOString(),
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    deviceBindingId: '',
    deviceBindingStatus: 'UNBOUND',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  await licRef.set(licenseData);
  console.log(`LICENSE CREATED: /licenses/${licenseId}`);

  // 2. Test status transitions: SUSPENDED -> REVOKED -> ACTIVE
  await licRef.update({ status: 'SUSPENDED', updatedAt: new Date().toISOString() });
  console.log(`Tested SUSPENDED state.`);

  await licRef.update({ status: 'REVOKED', updatedAt: new Date().toISOString() });
  console.log(`Tested REVOKED state.`);

  await licRef.update({ status: 'ACTIVE', updatedAt: new Date().toISOString() });
  console.log(`Restored FINAL state: ACTIVE.`);

  const finalSnap = await licRef.get();
  console.log(`FINAL LICENSE STATE:`, JSON.stringify(finalSnap.data(), null, 2));
}

createFirstLicense().catch(err => {
  console.error('ERROR CREATING LICENSE:', err);
  process.exit(1);
});
