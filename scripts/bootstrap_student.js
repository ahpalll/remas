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

function normalizeEgyptianPhone(phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') {
    throw new Error('INVALID_PHONE: Phone number is required');
  }
  let cleaned = phoneInput.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+20')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('01')) {
    cleaned = '2' + cleaned;
  }
  if (cleaned.startsWith('201') && cleaned.length === 12) {
    const canonical = '+' + cleaned;
    if (/^\+201[0125]\d{8}$/.test(canonical)) {
      return canonical;
    }
  }
  throw new Error(`INVALID_PHONE_FORMAT: Phone '${phoneInput}' is not a valid Egyptian mobile number (+201XXXXXXXXX)`);
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

async function bootstrapStudent() {
  const args = parseArgs();
  const institutionId = (args.institutionId || process.env.INSTITUTION_ID || '').trim();
  const name = (args.name || process.env.STUDENT_NAME || 'Student User').trim();
  const rawPhone = (args.phone || process.env.STUDENT_PHONE || '').trim();
  const grade = args.grade || 'Grade 10';

  if (!institutionId || !rawPhone) {
    console.error('ERROR: --institutionId and --phone are required.');
    process.exit(1);
  }

  const normalizedPhone = normalizeEgyptianPhone(rawPhone);

  initAdminSDK();
  const auth = getAuth();
  const db = getFirestore();

  console.log('====================================================');
  console.log('TRUSTED BOOTSTRAP: STUDENT PROVISIONING');
  console.log(`Target Institution ID: ${institutionId}`);
  console.log(`Student Name: ${name}`);
  console.log(`Normalized Phone (E.164): ${normalizedPhone}`);
  console.log('====================================================');

  // 1. Verify institution exists
  const instDoc = await db.collection('institutions').doc(institutionId).get();
  if (!instDoc.exists) {
    throw new Error(`INSTITUTION_NOT_FOUND: Institution '${institutionId}' does not exist.`);
  }

  // 2. Check for duplicate active membership in SAME institution
  const sameInstStudents = await db.collection('institutions')
    .doc(institutionId)
    .collection('students')
    .where('normalizedPhone', '==', normalizedPhone)
    .get();

  const activeDuplicates = sameInstStudents.docs.filter(d => d.data().status !== 'ARCHIVED');
  if (activeDuplicates.length > 0) {
    throw new Error(`DUPLICATE_STUDENT_IN_INSTITUTION: Active student membership with phone '${normalizedPhone}' already exists in ${institutionId}.`);
  }

  // 3. Locate or create Firebase Auth Identity by phone number
  let authUser;
  let createdAuthNew = false;
  try {
    authUser = await auth.getUserByPhoneNumber(normalizedPhone);
    console.log(`Found existing Firebase Auth phone identity: ${authUser.uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      authUser = await auth.createUser({
        phoneNumber: normalizedPhone,
        displayName: name
      });
      createdAuthNew = true;
      console.log(`Created new Auth phone identity: ${authUser.uid}`);
    } else {
      throw err;
    }
  }

  // 4. Create Student Document in /institutions/{institutionId}/students/{studentId}
  const studentId = args.studentId || `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowISO = new Date().toISOString();
  const studentRef = db.collection('institutions').doc(institutionId).collection('students').doc(studentId);

  const studentData = {
    id: studentId,
    studentId: studentId,
    studentCode: `STU-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    institutionId: institutionId,
    authUid: authUser.uid,
    name: name,
    phone: rawPhone,
    normalizedPhone: normalizedPhone,
    grade: grade,
    status: 'ACTIVE',
    createdAt: nowISO,
    updatedAt: nowISO
  };

  await studentRef.set(studentData, { merge: true });

  console.log(`Updated Firestore document: /institutions/${institutionId}/students/${studentId}`);
  console.log('====================================================');
  console.log('STUDENT PROVISIONING COMPLETE!');
  console.log(`Auth UID: ${authUser.uid}`);
  console.log(`Student ID: ${studentId}`);
  console.log(`Institution ID: ${institutionId}`);
  console.log('====================================================\n');
}

bootstrapStudent().catch(err => {
  console.error('STUDENT BOOTSTRAP ERROR:', err.message);
  process.exit(1);
});
