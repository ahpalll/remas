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

async function createSecondCenter() {
  initAdminSDK();
  const db = getFirestore();

  const institutionId = 'inst_remas002';
  const nowISO = new Date().toISOString();

  const instData = {
    institutionId: institutionId,
    code: 'REMAS002',
    name: 'REMAS Test Center 002',
    type: 'center',
    status: 'ACTIVE',
    phone: '+201000000002',
    email: 'contact@remas002.edu',
    address: 'Alexandria, Egypt',
    branding: {
      centerName: 'REMAS Test Center 002',
      primaryColor: '#0F172A',
      secondaryColor: '#0284C7',
      logoUrl: ''
    },
    ownerId: 'PENDING_OWNER',
    ownerEmail: 'owner2@remas.edu',
    createdBy: 'QJeEADbpMwP1xBXZzL9zYql4IYR2',
    createdAt: nowISO,
    updatedAt: nowISO
  };

  await db.collection('institutions').doc(institutionId).set(instData, { merge: true });

  console.log('====================================================');
  console.log('TRUSTED PROVISIONING: REAL INSTITUTION 002 CREATED');
  console.log('Institution ID:', institutionId);
  console.log('Name:', instData.name);
  console.log('Code:', instData.code);
  console.log('Status:', instData.status);
  console.log('====================================================');
}

createSecondCenter().catch(err => {
  console.error('FAILED TO CREATE CENTER 002:', err);
  process.exit(1);
});
