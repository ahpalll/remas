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

async function createFirstStudent() {
  initAdminSDK();
  const db = getFirestore();

  const institutionId = 'inst_remas001';
  const studentId = 'student_test_001';
  const nowISO = new Date().toISOString();

  const studentData = {
    studentId: studentId,
    institutionId: institutionId,
    name: 'Test Student 001',
    phone: '+201000000002',
    parentPhone: '+201000000003',
    grade: 'Grade 10',
    status: 'ACTIVE',
    createdAt: nowISO,
    updatedAt: nowISO,
    createdBy: 'zUoHhVzGskh04r7b6M7m0f5V8a63' // Real Center Owner UID
  };

  const studentRef = db.collection('institutions').doc(institutionId).collection('students').doc(studentId);
  await studentRef.set(studentData, { merge: true });

  console.log('====================================================');
  console.log('TRUSTED PROVISIONING: FIRST STUDENT CREATED');
  console.log('Path: /institutions/' + institutionId + '/students/' + studentId);
  console.log('Student Name: ' + studentData.name);
  console.log('Status: ' + studentData.status);
  console.log('====================================================');
}

createFirstStudent().catch(err => {
  console.error('FAILED TO CREATE STUDENT:', err);
  process.exit(1);
});
