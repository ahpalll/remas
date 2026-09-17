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

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value ? value.trim() : true;
    }
  });
  return args;
}

async function bootstrapTeacher() {
  const args = parseArgs();
  const institutionId = (args.institutionId || process.env.INSTITUTION_ID || '').trim();
  const email = (args.email || process.env.TEACHER_EMAIL || '').trim().toLowerCase();
  const name = (args.name || args.displayName || process.env.TEACHER_NAME || 'Teacher User').trim();
  const phone = (args.phone || process.env.TEACHER_PHONE || '').trim();
  const password = args.password || process.env.TEACHER_PASSWORD || `TeacherPass_${Math.random().toString(36).substring(2, 8)}!`;

  if (!institutionId || !email) {
    console.error('ERROR: --institutionId and --email are required.');
    process.exit(1);
  }

  initAdminSDK();
  const auth = getAuth();
  const db = getFirestore();

  console.log('====================================================');
  console.log('TRUSTED BOOTSTRAP: TEACHER PROVISIONING');
  console.log(`Target Institution ID: ${institutionId}`);
  console.log(`Target Email: ${email}`);
  console.log('====================================================');

  // Verify institution exists
  const instDoc = await db.collection('institutions').doc(institutionId).get();
  if (!instDoc.exists) {
    throw new Error(`INSTITUTION_NOT_FOUND: Institution '${institutionId}' does not exist.`);
  }

  let userRecord;
  let createdNew = false;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Found existing Firebase Auth user: ${userRecord.uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: true
      });
      createdNew = true;
      console.log(`Created new Auth user: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  // Set Custom Claims for Teacher
  const teacherClaims = {
    role: 'teacher',
    institutionId: institutionId
  };
  await auth.setCustomUserClaims(userRecord.uid, teacherClaims);
  console.log(`Set custom claims: ${JSON.stringify(teacherClaims)}`);

  // Write/Update Teacher Profile Document
  const teacherId = `tch_${userRecord.uid}`;
  const nowISO = new Date().toISOString();
  const teacherRef = db.collection('institutions').doc(institutionId).collection('teachers').doc(teacherId);

  await teacherRef.set({
    id: teacherId,
    teacherId: teacherId,
    authUid: userRecord.uid,
    institutionId: institutionId,
    fullName: name,
    email: email,
    phone: phone,
    specialization: 'عام',
    subjectIds: [],
    status: 'ACTIVE',
    updatedAt: nowISO,
    createdAt: createdNew ? nowISO : (await teacherRef.get()).data()?.createdAt || nowISO
  }, { merge: true });

  console.log(`Updated Firestore document: /institutions/${institutionId}/teachers/${teacherId}`);
  console.log('====================================================');
  console.log('TEACHER PROVISIONING COMPLETE!');
  console.log(`UID: ${userRecord.uid}`);
  console.log(`Institution ID: ${institutionId}`);
  console.log('====================================================\n');
}

bootstrapTeacher().catch(err => {
  console.error('TEACHER BOOTSTRAP ERROR:', err.message);
  process.exit(1);
});
