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

async function createFirstCenter() {
  initAdminSDK();
  const db = getFirestore();

  const institutionId = 'inst_remas001';
  const nowISO = new Date().toISOString();

  const instData = {
    institutionId: institutionId,
    code: 'REMAS001',
    name: 'REMAS Test Center',
    type: 'center',
    status: 'ACTIVE',
    phone: '+201000000000',
    email: 'contact@remas001.edu',
    address: 'Cairo, Egypt',
    branding: {
      centerName: 'REMAS Test Center',
      primaryColor: '#1E293B',
      secondaryColor: '#38BDF8',
      logoUrl: ''
    },
    ownerId: 'PENDING_OWNER',
    ownerEmail: '',
    createdBy: 'superadmin_uid',
    createdAt: nowISO,
    updatedAt: nowISO,
    studentCount: 0,
    teacherCount: 0
  };

  await db.collection('institutions').doc(institutionId).set(instData, { merge: true });
  console.log(`PROVISIONED INSTITUTION: /institutions/${institutionId}`);
  console.log(JSON.stringify(instData, null, 2));
}

createFirstCenter().catch(err => {
  console.error('ERROR CREATING CENTER:', err);
  process.exit(1);
});
