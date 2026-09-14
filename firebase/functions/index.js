const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Helper to normalize Egyptian phone numbers to canonical E.164 format (+201XXXXXXXXX)
 */
function normalizeEgyptianPhone(phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'INVALID_PHONE: Phone number is required');
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
  throw new functions.https.HttpsError('invalid-argument', `INVALID_PHONE_FORMAT: Phone '${phoneInput}' is not a valid Egyptian mobile number (+201XXXXXXXXX)`);
}

/**
 * Production HTTPS Callable Cloud Function (v1): provisionStudentAccount
 */
exports.provisionStudentAccount = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'UNAUTHENTICATED: Caller must be authenticated');
  }

  const callerUid = context.auth.uid;
  const callerRole = context.auth.token.role;
  const callerInstId = context.auth.token.institutionId;

  if (!['institutionOwner', 'admin', 'superAdmin'].includes(callerRole)) {
    throw new functions.https.HttpsError('permission-denied', `PERMISSION_DENIED: Role '${callerRole}' is not authorized to provision students`);
  }

  let resolvedInstId;
  if (callerRole === 'superAdmin') {
    if (!data.institutionId) {
      throw new functions.https.HttpsError('invalid-argument', 'MISSING_INSTITUTION_ID: superAdmin must specify target institutionId');
    }
    resolvedInstId = data.institutionId;
  } else {
    if (!callerInstId) {
      throw new functions.https.HttpsError('permission-denied', 'UNAUTHORIZED_TENANT: Caller token missing institutionId claim');
    }
    if (data.institutionId && data.institutionId !== callerInstId) {
      throw new functions.https.HttpsError('permission-denied', 'CROSS_TENANT_DENIED: Caller cannot provision students outside assigned institution');
    }
    resolvedInstId = callerInstId;
  }

  const studentName = (data.name || '').trim();
  if (!studentName) {
    throw new functions.https.HttpsError('invalid-argument', 'INVALID_STUDENT_NAME: Full student name is required');
  }

  const rawPhone = (data.phone || '').trim();
  const normalizedPhone = normalizeEgyptianPhone(rawPhone);

  const existingSameInstSnap = await db.collection('institutions')
    .doc(resolvedInstId)
    .collection('students')
    .where('normalizedPhone', '==', normalizedPhone)
    .get();

  const activeDuplicates = existingSameInstSnap.docs.filter(d => d.data().status !== 'ARCHIVED');
  if (activeDuplicates.length > 0) {
    throw new functions.https.HttpsError('already-exists', `DUPLICATE_STUDENT_IN_INSTITUTION: A student with phone '${rawPhone}' already exists in this institution`);
  }

  let authUid;
  try {
    const existingUser = await auth.getUserByPhoneNumber(normalizedPhone);
    authUid = existingUser.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        phoneNumber: normalizedPhone,
        displayName: studentName
      });
      authUid = newUser.uid;
    } else {
      throw new functions.https.HttpsError('internal', `AUTH_PROVISIONING_FAILED: ${err.message}`);
    }
  }

  const studentId = data.studentId || `STU_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const studentRef = db.collection('institutions').doc(resolvedInstId).collection('students').doc(studentId);

  const studentPayload = {
    id: studentId,
    studentCode: data.studentCode || `STU-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    institutionId: resolvedInstId,
    authUid: authUid,
    name: studentName,
    phone: rawPhone,
    normalizedPhone: normalizedPhone,
    guardianPhone: (data.guardianPhone || '').trim(),
    guardianName: (data.guardianName || '').trim(),
    grade: data.grade || 'الصف الثالث الثانوي',
    stage: data.stage || 'الثانوية',
    groupId: data.groupId || '',
    groupName: data.groupName || '',
    groupIds: data.groupIds || (data.groupId ? [data.groupId] : []),
    qrToken: `QR_${studentId}`,
    status: 'ACTIVE',
    notes: (data.notes || '').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await studentRef.set(studentPayload, { merge: true });

  return {
    success: true,
    studentId: studentId,
    authUid: authUid,
    phone: normalizedPhone,
    name: studentName,
    institutionId: resolvedInstId
  };
});

/**
 * Production HTTPS Callable Cloud Function (v1): migrateExistingStudentAccount
 */
exports.migrateExistingStudentAccount = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'UNAUTHENTICATED');
  }

  const callerRole = context.auth.token.role;
  const callerInstId = context.auth.token.institutionId;

  if (!['institutionOwner', 'admin', 'superAdmin'].includes(callerRole)) {
    throw new functions.https.HttpsError('permission-denied', 'PERMISSION_DENIED');
  }

  const { studentId } = data;
  if (!studentId) {
    throw new functions.https.HttpsError('invalid-argument', 'MISSING_STUDENT_ID');
  }

  let resolvedInstId = callerRole === 'superAdmin' ? data.institutionId : callerInstId;
  if (!resolvedInstId) {
    throw new functions.https.HttpsError('permission-denied', 'UNAUTHORIZED_TENANT');
  }

  const docRef = db.collection('institutions').doc(resolvedInstId).collection('students').doc(studentId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'STUDENT_NOT_FOUND');
  }

  const studentData = docSnap.data();

  if (studentData.authUid) {
    return {
      status: 'ALREADY_LINKED',
      studentId: studentId,
      authUid: studentData.authUid,
      institutionId: resolvedInstId
    };
  }

  const normalizedPhone = normalizeEgyptianPhone(studentData.phone);
  let authUid;

  try {
    const existingUser = await auth.getUserByPhoneNumber(normalizedPhone);
    authUid = existingUser.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        phoneNumber: normalizedPhone,
        displayName: studentData.name || 'Student'
      });
      authUid = newUser.uid;
    } else {
      throw new functions.https.HttpsError('internal', err.message);
    }
  }

  await docRef.update({
    authUid: authUid,
    normalizedPhone: normalizedPhone,
    updatedAt: new Date().toISOString()
  });

  return {
    status: 'LINKED_SUCCESSFULLY',
    studentId: studentId,
    authUid: authUid,
    institutionId: resolvedInstId
  };
});

/**
 * Production HTTPS Callable Cloud Function (v1): provisionCenterOwner
 * Must be called ONLY by authenticated SuperAdmin
 */
exports.provisionCenterOwner = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'UNAUTHENTICATED: Caller must be authenticated');
  }

  const callerRole = context.auth.token.role;
  if (callerRole !== 'superAdmin' && callerRole !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'PERMISSION_DENIED: Only SuperAdmin can provision Center Owners');
  }

  const institutionId = (data.institutionId || '').trim();
  const email = (data.email || '').trim().toLowerCase();
  const displayName = (data.displayName || data.name || '').trim();
  const password = data.temporaryPassword || data.password || '';

  if (!institutionId || !email || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'INVALID_ARGUMENTS: institutionId, email, and password are required');
  }

  if (password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'INVALID_PASSWORD: Password must be at least 6 characters long');
  }

  // Verify institution exists in Firestore
  const instDoc = await db.collection('institutions').doc(institutionId).get();
  if (!instDoc.exists) {
    throw new functions.https.HttpsError('not-found', `INSTITUTION_NOT_FOUND: Institution '${institutionId}' does not exist`);
  }

  let authUser;
  let createdNew = false;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      authUser = await auth.createUser({
        email: email,
        password: password,
        displayName: displayName || `Center Owner (${institutionId})`,
        emailVerified: true
      });
      createdNew = true;
    } else {
      throw new functions.https.HttpsError('internal', `AUTH_PROVISIONING_FAILED: ${err.message}`);
    }
  }

  // Set Custom Claims for Center Owner
  const ownerClaims = {
    role: 'institutionOwner',
    institutionId: institutionId
  };
  await auth.setCustomUserClaims(authUser.uid, ownerClaims);

  // Write/Update User Profile Document
  const userProfileRef = db.collection('institutions').doc(institutionId).collection('users').doc(authUser.uid);
  const nowISO = new Date().toISOString();
  await userProfileRef.set({
    uid: authUser.uid,
    email: email,
    displayName: displayName || authUser.displayName || 'Center Owner',
    role: 'institutionOwner',
    institutionId: institutionId,
    status: 'ACTIVE',
    updatedAt: nowISO,
    createdAt: createdNew ? nowISO : (await userProfileRef.get()).data()?.createdAt || nowISO
  }, { merge: true });

  // Update ownerId on Institution Document
  await db.collection('institutions').doc(institutionId).update({
    ownerId: authUser.uid,
    ownerEmail: email,
    updatedAt: nowISO
  });

  return {
    success: true,
    status: createdNew ? 'OWNER_CREATED' : 'OWNER_REUSED',
    uid: authUser.uid,
    email: email,
    institutionId: institutionId,
    role: 'institutionOwner'
  };
});

/**
 * Production HTTPS Callable Cloud Function (v1): provisionTeacher
 * Must be called by SuperAdmin or Institution Owner/Admin
 */
exports.provisionTeacher = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'UNAUTHENTICATED');
  }

  const callerRole = context.auth.token.role;
  const callerInstId = context.auth.token.institutionId;

  if (!['institutionOwner', 'admin', 'superAdmin', 'superadmin'].includes(callerRole)) {
    throw new functions.https.HttpsError('permission-denied', 'PERMISSION_DENIED');
  }

  let resolvedInstId;
  if (callerRole === 'superAdmin' || callerRole === 'superadmin') {
    if (!data.institutionId) {
      throw new functions.https.HttpsError('invalid-argument', 'MISSING_INSTITUTION_ID');
    }
    resolvedInstId = data.institutionId;
  } else {
    if (!callerInstId) {
      throw new functions.https.HttpsError('permission-denied', 'UNAUTHORIZED_TENANT');
    }
    if (data.institutionId && data.institutionId !== callerInstId) {
      throw new functions.https.HttpsError('permission-denied', 'CROSS_TENANT_DENIED');
    }
    resolvedInstId = callerInstId;
  }

  const email = (data.email || '').trim().toLowerCase();
  const fullName = (data.fullName || data.name || '').trim();
  const phone = (data.phone || '').trim();
  const password = data.temporaryPassword || data.password || '';

  if (!email || !fullName || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'INVALID_ARGUMENTS: email, fullName, and password are required');
  }

  let authUser;
  let createdNew = false;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      authUser = await auth.createUser({
        email: email,
        password: password,
        displayName: fullName,
        emailVerified: true
      });
      createdNew = true;
    } else {
      throw new functions.https.HttpsError('internal', err.message);
    }
  }

  // Set Custom Claims for Teacher
  const teacherClaims = {
    role: 'teacher',
    institutionId: resolvedInstId
  };
  await auth.setCustomUserClaims(authUser.uid, teacherClaims);

  // Write/Update Teacher Document preserving existing schema
  const teacherId = data.teacherId || `tch_${authUser.uid}`;
  const teacherRef = db.collection('institutions').doc(resolvedInstId).collection('teachers').doc(teacherId);

  const nowISO = new Date().toISOString();
  await teacherRef.set({
    id: teacherId,
    teacherId: teacherId,
    authUid: authUser.uid,
    institutionId: resolvedInstId,
    fullName: fullName,
    email: email,
    phone: phone,
    specialization: data.specialization || 'عام',
    subjectIds: data.subjectIds || [],
    status: 'ACTIVE',
    updatedAt: nowISO,
    createdAt: createdNew ? nowISO : (await teacherRef.get()).data()?.createdAt || nowISO
  }, { merge: true });

  return {
    success: true,
    teacherId: teacherId,
    authUid: authUser.uid,
    email: email,
    institutionId: resolvedInstId,
    role: 'teacher'
  };
});

/**
 * Production HTTPS Callable Cloud Function (v1): provisionParent
 * Must be called by SuperAdmin or Institution Owner/Admin
 */
exports.provisionParent = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'UNAUTHENTICATED');
  }

  const callerRole = context.auth.token.role;
  const callerInstId = context.auth.token.institutionId;

  if (!['institutionOwner', 'admin', 'superAdmin', 'superadmin'].includes(callerRole)) {
    throw new functions.https.HttpsError('permission-denied', 'PERMISSION_DENIED');
  }

  let resolvedInstId;
  if (callerRole === 'superAdmin' || callerRole === 'superadmin') {
    if (!data.institutionId) {
      throw new functions.https.HttpsError('invalid-argument', 'MISSING_INSTITUTION_ID');
    }
    resolvedInstId = data.institutionId;
  } else {
    if (!callerInstId) {
      throw new functions.https.HttpsError('permission-denied', 'UNAUTHORIZED_TENANT');
    }
    if (data.institutionId && data.institutionId !== callerInstId) {
      throw new functions.https.HttpsError('permission-denied', 'CROSS_TENANT_DENIED');
    }
    resolvedInstId = callerInstId;
  }

  const email = (data.email || '').trim().toLowerCase();
  const fullName = (data.fullName || data.name || '').trim();
  const phone = (data.phone || '').trim();
  const password = data.temporaryPassword || data.password || '';
  const studentIds = data.studentIds || [];

  if (!email || !fullName || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'INVALID_ARGUMENTS: email, fullName, and password are required');
  }

  let authUser;
  let createdNew = false;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      authUser = await auth.createUser({
        email: email,
        password: password,
        displayName: fullName,
        emailVerified: true
      });
      createdNew = true;
    } else {
      throw new functions.https.HttpsError('internal', err.message);
    }
  }

  // Set Custom Claims for Parent
  const parentClaims = {
    role: 'parent',
    institutionId: resolvedInstId
  };
  await auth.setCustomUserClaims(authUser.uid, parentClaims);

  // Write/Update Guardian Document preserving existing schema
  const guardianId = data.guardianId || `gdn_${authUser.uid}`;
  const guardianRef = db.collection('institutions').doc(resolvedInstId).collection('guardians').doc(guardianId);

  const nowISO = new Date().toISOString();
  await guardianRef.set({
    id: guardianId,
    guardianId: guardianId,
    authUid: authUser.uid,
    institutionId: resolvedInstId,
    fullName: fullName,
    email: email,
    phone: phone,
    status: 'ACTIVE',
    updatedAt: nowISO,
    createdAt: createdNew ? nowISO : (await guardianRef.get()).data()?.createdAt || nowISO
  }, { merge: true });

  // Link student relationships
  for (const studentId of studentIds) {
    const linkId = `sg_${guardianId}_${studentId}`;
    await db.collection('institutions').doc(resolvedInstId).collection('studentGuardians').doc(linkId).set({
      id: linkId,
      institutionId: resolvedInstId,
      studentId: studentId,
      guardianId: guardianId,
      guardianAuthUid: authUser.uid,
      relationshipType: 'PARENT',
      isPrimary: true,
      createdAt: nowISO
    }, { merge: true });
  }

  return {
    success: true,
    guardianId: guardianId,
    authUid: authUser.uid,
    email: email,
    institutionId: resolvedInstId,
    linkedStudents: studentIds,
    role: 'parent'
  };
});
