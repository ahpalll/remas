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

async function bootstrapParent() {
  const args = parseArgs();
  const institutionId = (args.institutionId || process.env.INSTITUTION_ID || '').trim();
  const email = (args.email || process.env.PARENT_EMAIL || '').trim().toLowerCase();
  const name = (args.name || args.displayName || process.env.PARENT_NAME || 'Parent User').trim();
  const phone = (args.phone || process.env.PARENT_PHONE || '').trim();
  const password = args.password || process.env.PARENT_PASSWORD || `ParentPass_${Math.random().toString(36).substring(2, 8)}!`;
  const studentIds = (args.studentIds || '').split(',').map(s => s.trim()).filter(Boolean);

  if (!institutionId || !email) {
    console.error('ERROR: --institutionId and --email are required.');
    process.exit(1);
  }

  initAdminSDK();
  const auth = getAuth();
  const db = getFirestore();

  console.log('====================================================');
  console.log('TRUSTED BOOTSTRAP: PARENT PROVISIONING');
  console.log(`Target Institution ID: ${institutionId}`);
  console.log(`Target Email: ${email}`);
  console.log(`Linked Student IDs: ${JSON.stringify(studentIds)}`);
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

  // Set Custom Claims for Parent
  const parentClaims = {
    role: 'parent',
    institutionId: institutionId
  };
  await auth.setCustomUserClaims(userRecord.uid, parentClaims);
  console.log(`Set custom claims: ${JSON.stringify(parentClaims)}`);

  // Write/Update Guardian Profile Document
  const guardianId = `gdn_${userRecord.uid}`;
  const nowISO = new Date().toISOString();
  const guardianRef = db.collection('institutions').doc(institutionId).collection('guardians').doc(guardianId);

  await guardianRef.set({
    id: guardianId,
    guardianId: guardianId,
    authUid: userRecord.uid,
    institutionId: institutionId,
    fullName: name,
    email: email,
    phone: phone,
    status: 'ACTIVE',
    updatedAt: nowISO,
    createdAt: createdNew ? nowISO : (await guardianRef.get()).data()?.createdAt || nowISO
  }, { merge: true });

  // Create explicit child linkage records in /institutions/{institutionId}/studentGuardians/
  for (const studentId of studentIds) {
    const linkId = `sg_${guardianId}_${studentId}`;
    await db.collection('institutions').doc(institutionId).collection('studentGuardians').doc(linkId).set({
      id: linkId,
      institutionId: institutionId,
      studentId: studentId,
      guardianId: guardianId,
      guardianAuthUid: userRecord.uid,
      relationshipType: 'PARENT',
      isPrimary: true,
      createdAt: nowISO
    }, { merge: true });
    console.log(`Linked parent ${guardianId} to student ${studentId} via /studentGuardians/${linkId}`);
  }

  console.log('====================================================');
  console.log('PARENT PROVISIONING COMPLETE!');
  console.log(`UID: ${userRecord.uid}`);
  console.log(`Guardian ID: ${guardianId}`);
  console.log(`Institution ID: ${institutionId}`);
  console.log('====================================================\n');
}

bootstrapParent().catch(err => {
  console.error('PARENT BOOTSTRAP ERROR:', err.message);
  process.exit(1);
});
