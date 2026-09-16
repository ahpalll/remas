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

async function createSecondLicense() {
  initAdminSDK();
  const db = getFirestore();

  const institutionId = 'inst_remas002';
  const licenseId = 'lic_remas002';
  const now = new Date();
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const licenseData = {
    licenseId: licenseId,
    institutionId: institutionId,
    licenseCode: 'REMAS-REMA-2026-X002002',
    plan: 'PRO',
    status: 'ACTIVE',
    startAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    deviceBindingStatus: 'UNBOUND',
    deviceBindingId: '',
    createdBy: 'QJeEADbpMwP1xBXZzL9zYql4IYR2',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  await db.collection('licenses').doc(licenseId).set(licenseData, { merge: true });

  console.log('====================================================');
  console.log('TRUSTED PROVISIONING: REAL LICENSE 002 CREATED');
  console.log('License ID:', licenseId);
  console.log('Code:', licenseData.licenseCode);
  console.log('Institution ID:', institutionId);
  console.log('Status:', licenseData.status);
  console.log('====================================================');
}

createSecondLicense().catch(err => {
  console.error('FAILED TO CREATE LICENSE 002:', err);
  process.exit(1);
});
