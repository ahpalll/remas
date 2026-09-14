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
  // 1. Verify caller authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'UNAUTHENTICATED: Caller must be authenticated');
  }

  const callerUid = context.auth.uid;
  const callerRole = context.auth.token.role;
  const callerInstId = context.auth.token.institutionId;

  // 2. Validate caller role hierarchy
  if (!['institutionOwner', 'admin', 'superAdmin'].includes(callerRole)) {
    throw new functions.https.HttpsError('permission-denied', `PERMISSION_DENIED: Role '${callerRole}' is not authorized to provision students`);
  }

  // 3. Resolve & enforce tenant authorization (Never trust client-supplied institutionId)
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

  // 4. Validate Student Name
  const studentName = (data.name || '').trim();
  if (!studentName) {
    throw new functions.https.HttpsError('invalid-argument', 'INVALID_STUDENT_NAME: Full student name is required');
  }

  // 5. Normalize E.164 Phone
  const rawPhone = (data.phone || '').trim();
  const normalizedPhone = normalizeEgyptianPhone(rawPhone);

  // 6. Check for duplicate student record within same institution
  const existingSameInstSnap = await db.collection('institutions')
    .doc(resolvedInstId)
    .collection('students')
    .where('normalizedPhone', '==', normalizedPhone)
    .get();

  const activeDuplicates = existingSameInstSnap.docs.filter(d => d.data().status !== 'ARCHIVED');
  if (activeDuplicates.length > 0) {
    throw new functions.https.HttpsError('already-exists', `DUPLICATE_STUDENT_IN_INSTITUTION: A student with phone '${rawPhone}' already exists in this institution`);
  }

  // 7. Obtain or Create Firebase Auth Identity (Multi-tenant phone identity reuse)
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

  // 8. Create Firestore Student Document (Preserving existing studentId schema)
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

  // 9. Return Sanitized Result (No privileged credentials)
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

  // Idempotency check: Already linked
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
        displayName: studentData.name
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
    status: 'MIGRATED',
    studentId: studentId,
    authUid: authUid,
    institutionId: resolvedInstId
  };
});
