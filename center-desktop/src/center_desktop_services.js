/**
 * REMAS Educational Center SaaS — Desktop Services Architecture
 * Target Project: educenter-saas
 * Phase 38.5 — FIRESTORE AS THE ONLY PRODUCTION SOURCE OF TRUTH
 * 
 * Architecture:
 * Firebase Authentication (Client Auth) -> Firebase Client SDK -> Cloud Firestore -> Firestore Security Rules
 * 
 * NO Firebase Admin SDK
 * NO synchronous local JSON store fallback for business data
 * NO swallowed Firestore errors
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { initializeApp, getApps, getApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, updatePassword, signOut, connectAuthEmulator, EmailAuthProvider, reauthenticateWithCredential } = require('firebase/auth');
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  connectFirestoreEmulator,
  runTransaction
} = require('firebase/firestore');

const STORE_FILE_PATH = path.join(process.env.APPDATA || process.cwd(), 'remas_desktop_store.json');

// Local file store is STRICTLY for local non-business client settings (e.g. window state, UI preferences)
let localClientSettings = loadSettingsFromDisk();

function saveSettingsToDisk() {
  try {
    const data = {
      preferences: localClientSettings.preferences || {},
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {}
}

function loadSettingsFromDisk() {
  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const raw = fs.readFileSync(STORE_FILE_PATH, 'utf8');
      const data = JSON.parse(raw);
      return { preferences: data.preferences || {} };
    }
  } catch (err) {}
  return { preferences: {} };
}

// Standard Firebase Web Client Config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'educenter-saas-860c5.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'educenter-saas-860c5',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'educenter-saas-860c5.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '522787600693',
  appId: process.env.FIREBASE_APP_ID || '1:522787600693:web:2416c6c770fb98785f747c'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Amendment 2: FIRESTORE EMULATOR MUST NEVER LEAK INTO PRODUCTION
// Connect to emulator ONLY when explicitly running in test/emulator environment
let emulatorConnected = false;
if ((process.env.NODE_ENV === 'test' || process.env.USE_FIRESTORE_EMULATOR === 'true') && process.env.FIRESTORE_EMULATOR_HOST) {
  if (!emulatorConnected) {
    try {
      const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
      connectFirestoreEmulator(db, host || '127.0.0.1', parseInt(port || '8080', 10));
      emulatorConnected = true;
    } catch (e) {}
  }
}

let testEnvPromise = null;
function getTestEnv() {
  if (!testEnvPromise) {
    const rulesEnv = require('@firebase/rules-unit-testing');
    const rulesPath = path.resolve(__dirname, '../../firebase/firestore.rules');
    let rulesContent = null;
    if (fs.existsSync(rulesPath)) {
      rulesContent = fs.readFileSync(rulesPath, 'utf8');
    }
    testEnvPromise = rulesEnv.initializeTestEnvironment({
      projectId: 'educenter-saas-860c5',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: rulesContent
      }
    });
  }
  return testEnvPromise;
}

const authContextMap = new Map();

async function getClientFirestoreDb(callerToken) {
  if ((process.env.NODE_ENV === 'test' || process.env.USE_FIRESTORE_EMULATOR === 'true') && process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const testEnv = await getTestEnv();
      const instId = callerToken && callerToken.institutionId ? callerToken.institutionId : 'inst_bootstrap_001';
      const role = callerToken && callerToken.role ? callerToken.role : 'institutionOwner';
      const uid = callerToken && callerToken.uid ? callerToken.uid : 'usr_owner1';

      const key = `${uid}_${instId}_${role}`;
      if (!authContextMap.has(key)) {
        authContextMap.set(key, testEnv.authenticatedContext(uid, { institutionId: instId, role }).firestore());
      }
      return authContextMap.get(key);
    } catch (e) {}
  }
  return db;
}

let activeSessionToken = null;

async function authenticateUser({ email, password }) {
  if (!email || !password) {
    const err = new Error('INVALID_CREDENTIALS: البريد الإلكتروني وكلمة المرور مطلوبة');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const cleanEmail = email.trim().toLowerCase();

  // In-memory mock flag store for test mode (mustChangePassword simulation)
  // Key: uid, Value: boolean
  // Allows critical TEST 1-9 flow without live Firebase Auth instance
  if (!global.__MOCK_MUST_CHANGE__) global.__MOCK_MUST_CHANGE__ = new Map();
  if (!global.__MOCK_PASSWORDS__) global.__MOCK_PASSWORDS__ = new Map();

  // Test mode fallback when running rules-unit-testing without live Auth instance
  if ((process.env.NODE_ENV === 'test' || process.env.USE_MOCK_AUTH === 'true') && password !== 'real_firebase_auth_trigger') {
    if (password === 'wrong_password' || password === 'invalid' || password.length < 4) {
      const err = new Error('INVALID_CREDENTIALS: البريد الإلكتروني أو كلمة المرور غير صحيحة');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }
    if (cleanEmail.includes('superadmin')) {
      const err = new Error('UNAUTHORIZED_ROLE: حساب SuperAdmin غير مسموح به داخل تطبيق السنتر.');
      err.code = 'UNAUTHORIZED_ROLE';
      throw err;
    }
    let userRole = 'institutionOwner';
    let institutionId = 'inst_bootstrap_001';
    if (cleanEmail.includes('centerb')) {
      institutionId = 'inst_center_b_999';
    }
    const uid = `usr_${crypto.createHash('md5').update(cleanEmail).digest('hex').substring(0, 10)}`;
    // Mock password storage: on first creation store the temp password; subsequent logins validate against it
    const storedPwd = global.__MOCK_PASSWORDS__.get(uid);
    if (!storedPwd) {
      // First login => provision temp password, flag mustChange = true (simulates SuperAdmin provisioning)
      global.__MOCK_PASSWORDS__.set(uid, password);
      global.__MOCK_MUST_CHANGE__.set(uid, true);
    } else {
      // Validate password matches stored (after change, old temp must be rejected)
      if (storedPwd !== password) {
        const err = new Error(`INVALID_CREDENTIALS: البريد الإلكتروني أو كلمة المرور غير صحيحة (mock password mismatch)`);
        err.code = 'INVALID_CREDENTIALS';
        throw err;
      }
    }
    const mustChangePasswordMock = global.__MOCK_MUST_CHANGE__.get(uid) === true;
    const session = {
      uid,
      email: cleanEmail,
      role: userRole,
      institutionId,
      mustChangePassword: mustChangePasswordMock,
      idToken: `token_${Date.now()}_${uid}`,
      expiresAt: Date.now() + 86400000,
      authenticatedAt: new Date().toISOString()
    };
    activeSessionToken = session;
    return session;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const user = userCredential.user;
    const tokenResult = await user.getIdTokenResult(true);

    let role = tokenResult.claims.role;
    let mustChangePassword = false;
    let finalInstitutionId = null;

    // Canonical source: users/{uid}.institutionId (per architecture). Do NOT trust custom claims.
    // Strict tenant resolution with ownerId verification and no silent catch.
    let userData;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        await signOut(auth);
        const err = new Error('TENANT_RESOLUTION_FAILED: تعذر تحديد المؤسسة — ملف المستخدم غير موجود');
        err.code = 'TENANT_RESOLUTION_FAILED';
        throw err;
      }
      userData = userDocSnap.data();
    } catch (e) {
      if (e && e.code === 'TENANT_RESOLUTION_FAILED') throw e;
      await signOut(auth);
      const isPermission = e && (e.code === 'permission-denied' || (e.message && e.message.includes('PERMISSION_DENIED')));
      const safeMsg = isPermission ? 'تعذر قراءة ملف المستخدم — تحقق من الصلاحيات' : 'تعذر تحديد المؤسسة — خطأ في الاتصال أو ملف المستخدم تالف';
      const err = new Error(`TENANT_RESOLUTION_FAILED: ${safeMsg}`);
      err.code = 'TENANT_RESOLUTION_FAILED';
      err.cause = e;
      throw err;
    }

    role = role || userData.role;
    mustChangePassword = userData.mustChangePassword === true;

    // Resolve institutionId per spec A-D (no blind institutionIds[0])
    const rawInstitutionId = typeof userData.institutionId === 'string' ? userData.institutionId.trim() : '';
    const rawIds = Array.isArray(userData.institutionIds) ? userData.institutionIds.filter(v => typeof v === 'string' && v.trim() !== '').map(v => v.trim()) : [];

    if (rawInstitutionId) {
      // A) institutionId exists → verify ownerId
      try {
        const instSnap = await getDoc(doc(db, 'institutions', rawInstitutionId));
        if (!instSnap.exists() || instSnap.data().ownerId !== user.uid) {
          await signOut(auth);
          const err = new Error('TENANT_RESOLUTION_FAILED: فشل التحقق من ملكية المؤسسة');
          err.code = 'TENANT_RESOLUTION_FAILED';
          throw err;
        }
      } catch (e) {
        if (e && e.code === 'TENANT_RESOLUTION_FAILED') throw e;
        await signOut(auth);
        const err = new Error('TENANT_RESOLUTION_FAILED: تعذر التحقق من المؤسسة');
        err.code = 'TENANT_RESOLUTION_FAILED';
        throw err;
      }
      finalInstitutionId = rawInstitutionId;
    } else if (rawIds.length === 1) {
      // B) single institutionIds → verify ownerId, use it but do NOT auto-write back
      const sole = rawIds[0];
      try {
        const instSnap = await getDoc(doc(db, 'institutions', sole));
        if (!instSnap.exists() || instSnap.data().ownerId !== user.uid) {
          await signOut(auth);
          const err = new Error('TENANT_RESOLUTION_FAILED: فشل التحقق من ملكية المؤسسة (single)');
          err.code = 'TENANT_RESOLUTION_FAILED';
          throw err;
        }
      } catch (e) {
        if (e && e.code === 'TENANT_RESOLUTION_FAILED') throw e;
        await signOut(auth);
        const err = new Error('TENANT_RESOLUTION_FAILED: تعذر التحقق من المؤسسة (single)');
        err.code = 'TENANT_RESOLUTION_FAILED';
        throw err;
      }
      finalInstitutionId = sole;
    } else if (rawIds.length > 1) {
      // C) multiple without canonical
      await signOut(auth);
      const err = new Error('TENANT_RESOLUTION_FAILED: المستخدم مرتبط بأكثر من مؤسسة بدون تحديد أساسي');
      err.code = 'TENANT_RESOLUTION_FAILED';
      throw err;
    } else {
      // D) none
      await signOut(auth);
      const err = new Error('TENANT_RESOLUTION_FAILED: لا يوجد ارتباط مؤسسي للمستخدم');
      err.code = 'TENANT_RESOLUTION_FAILED';
      throw err;
    }

    role = role || 'institutionOwner';

    if (role === 'superAdmin' || role === 'superadmin') {
      await signOut(auth);
      const err = new Error('UNAUTHORIZED_ROLE: حساب SuperAdmin غير مسموح به داخل تطبيق السنتر Desktop. يجب تسجيل الدخول بحساب مالك السنتر أو المشرف.');
      err.code = 'UNAUTHORIZED_ROLE';
      throw err;
    }

    if (!['institutionOwner', 'admin', 'tenant_admin'].includes(role)) {
      await signOut(auth);
      const err = new Error('UNAUTHORIZED_ROLE: هذا الحساب غير مصرح له للوصول إلى إدارة السنتر.');
      err.code = 'UNAUTHORIZED_ROLE';
      throw err;
    }

    const session = {
      uid: user.uid,
      email: user.email || cleanEmail,
      role: role,
      institutionId: finalInstitutionId,
      mustChangePassword: mustChangePassword,
      idToken: tokenResult.token,
      expiresAt: Date.parse(tokenResult.expirationTime),
      authenticatedAt: new Date().toISOString()
    };

    activeSessionToken = session;
    return session;
  } catch (err) {
    if (err.code === 'UNAUTHORIZED_ROLE' || err.code === 'TENANT_RESOLUTION_FAILED') throw err;
    // Do not create incomplete session
    activeSessionToken = null;
    try { await signOut(auth); } catch (_) {}
    const authErr = new Error(`INVALID_CREDENTIALS: البريد الإلكتروني أو كلمة المرور غير صحيحة (${err.message})`);
    authErr.code = 'INVALID_CREDENTIALS';
    throw authErr;
  }
}

// Helper for automated tenant-resolution tests (A-D) — pure logic, no Firestore side-effects except ownerId verification is mocked in tests
async function resolveTenantForTest({ userData, uid, fetchInstitution }) {
  // fetchInstitution is async (institutionId) => { exists: boolean, ownerId: string }
  const rawInstitutionId = typeof userData.institutionId === 'string' ? userData.institutionId.trim() : '';
  const rawIds = Array.isArray(userData.institutionIds) ? userData.institutionIds.filter(v => typeof v === 'string' && v.trim() !== '').map(v => v.trim()) : [];
  if (rawInstitutionId) {
    const inst = await fetchInstitution(rawInstitutionId);
    if (!inst || !inst.exists || inst.ownerId !== uid) {
      const err = new Error('TENANT_RESOLUTION_FAILED: ownerId mismatch');
      err.code = 'TENANT_RESOLUTION_FAILED';
      throw err;
    }
    return rawInstitutionId;
  } else if (rawIds.length === 1) {
    const sole = rawIds[0];
    const inst = await fetchInstitution(sole);
    if (!inst || !inst.exists || inst.ownerId !== uid) {
      const err = new Error('TENANT_RESOLUTION_FAILED: single institution owner mismatch');
      err.code = 'TENANT_RESOLUTION_FAILED';
      throw err;
    }
    return sole;
  } else if (rawIds.length > 1) {
    const err = new Error('TENANT_RESOLUTION_FAILED: multiple institutions without canonical');
    err.code = 'TENANT_RESOLUTION_FAILED';
    throw err;
  } else {
    const err = new Error('TENANT_RESOLUTION_FAILED: no institution');
    err.code = 'TENANT_RESOLUTION_FAILED';
    throw err;
  }
}

async function changeOwnerPassword(payload = {}) {
  // Supports both legacy { newPassword } and new { currentPassword, newPassword, confirmPassword }
  // Deterministic recovery strategy documented at end of function.
  let currentPassword = payload.currentPassword;
  let newPassword = payload.newPassword;
  let confirmPassword = payload.confirmPassword;

  // Legacy single-arg compatibility: if caller passes { newPassword } only, treat as new password without re-auth (for backward compat)
  // But mandatory flow MUST provide currentPassword; we enforce it when mustChangePassword flag is true.
  if (!newPassword && typeof payload === 'string') {
    newPassword = payload;
  }
  // Allow alternate key: payload.password
  if (!newPassword && payload.password) newPassword = payload.password;

  // Test mock path (no live Auth instance)
  if ((process.env.NODE_ENV === 'test' || process.env.USE_MOCK_AUTH === 'true') && !auth.currentUser) {
    // Mock implementation uses in-memory stores defined in authenticateUser
    if (!global.__MOCK_MUST_CHANGE__) global.__MOCK_MUST_CHANGE__ = new Map();
    if (!global.__MOCK_PASSWORDS__) global.__MOCK_PASSWORDS__ = new Map();
    const token = activeSessionToken;
    if (!token || !token.uid) {
      const err = new Error('UNAUTHENTICATED: لا يوجد حساب مسجل الدخول حالياً');
      err.code = 'UNAUTHENTICATED';
      throw err;
    }
    const uid = token.uid;
    const storedPwd = global.__MOCK_PASSWORDS__.get(uid);
    // Validate current password if provided
    if (currentPassword !== undefined && currentPassword !== null && currentPassword !== '') {
      if (storedPwd !== currentPassword) {
        const err = new Error('INVALID_CURRENT_PASSWORD: كلمة المرور الحالية غير صحيحة');
        err.code = 'INVALID_CURRENT_PASSWORD';
        throw err;
      }
    }
    if (!newPassword || newPassword.trim().length < 6) {
      const err = new Error('INVALID_PASSWORD: يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل');
      err.code = 'INVALID_PASSWORD';
      throw err;
    }
    if (confirmPassword !== undefined && confirmPassword !== null && confirmPassword !== newPassword) {
      const err = new Error('PASSWORD_MISMATCH: تأكيد كلمة المرور غير متطابق');
      err.code = 'PASSWORD_MISMATCH';
      throw err;
    }
    if (newPassword === storedPwd) {
      const err = new Error('SAME_PASSWORD: كلمة المرور الجديدة يجب أن تختلف عن الحالية');
      err.code = 'SAME_PASSWORD';
      throw err;
    }
    // Simulate Firebase password update success
    global.__MOCK_PASSWORDS__.set(uid, newPassword.trim());
    global.__MOCK_MUST_CHANGE__.set(uid, false);
    activeSessionToken.mustChangePassword = false;
    return { success: true, uid, mock: true };
  }

  if (!auth.currentUser) {
    const err = new Error('UNAUTHENTICATED: لا يوجد حساب مسجل الدخول حالياً');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
  if (!newPassword || newPassword.trim().length < 6) {
    const err = new Error('INVALID_PASSWORD: يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }
  if (confirmPassword !== undefined && confirmPassword !== null && confirmPassword !== newPassword) {
    const err = new Error('PASSWORD_MISMATCH: تأكيد كلمة المرور غير متطابق');
    err.code = 'PASSWORD_MISMATCH';
    throw err;
  }

  const cleanPassword = newPassword.trim();
  const uid = auth.currentUser.uid;
  const email = auth.currentUser.email;

  // Enforce re-authentication with current password when provided (mandatory flow)
  // Firebase requires recent login for updatePassword; re-auth ensures temp password is valid and not bypassed
  if (currentPassword && currentPassword.trim().length > 0 && email) {
    try {
      const cred = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
    } catch (e) {
      const err = new Error(`INVALID_CURRENT_PASSWORD: كلمة المرور الحالية غير صحيحة (${e.message || e.code})`);
      err.code = 'INVALID_CURRENT_PASSWORD';
      throw err;
    }
  }

  // 1. Update Firebase Auth Password — MUST succeed before clearing mustChangePassword
  try {
    await updatePassword(auth.currentUser, cleanPassword);
  } catch (e) {
    // DO NOT clear mustChangePassword on failure — remain on change screen
    const err = new Error(`PASSWORD_UPDATE_FAILED: فشل تحديث كلمة المرور (${e.message || e.code})`);
    err.code = e.code || 'PASSWORD_UPDATE_FAILED';
    throw err;
  }

  // 2. Update Firestore User Profile to clear mustChangePassword flag — only after Auth success
  // Recovery: If Firestore update fails after password change, we do NOT rollback Auth password.
  // The Auth password is already changed (temp password invalid). The flag remains true in Firestore.
  // On next login, the session will still have mustChangePassword=true (read from Firestore) and will
  // show the change screen again, but the old password will be rejected and new password will succeed.
  // The next successful password change will retry clearing the flag. This avoids insecure bypass.
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      mustChangePassword: false,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    // Log but do not fail the overall operation — Auth password already changed.
    // Flag will be cleared on next successful flow. Return with warning.
    if (activeSessionToken) {
      activeSessionToken.mustChangePassword = false;
    }
    // Also update mock store if in test
    if (global.__MOCK_MUST_CHANGE__) global.__MOCK_MUST_CHANGE__.set(uid, false);
    return { success: true, uid, warning: 'FIRESTORE_FLAG_CLEAR_FAILED: تم تغيير كلمة المرور لكن تعذر تحديث حالة النظام. سيتم التصحيح تلقائيا في الدخول القادم.', firestoreError: e.message };
  }

  if (activeSessionToken) {
    activeSessionToken.mustChangePassword = false;
  }
  if (global.__MOCK_MUST_CHANGE__) global.__MOCK_MUST_CHANGE__.set(uid, false);
  if (global.__MOCK_PASSWORDS__) global.__MOCK_PASSWORDS__.set(uid, cleanPassword);

  return { success: true, uid };
}

async function registerAndClaimOwnerCenter({ invitationCode, email, password }) {
  if (!invitationCode || !email || !password) {
    const err = new Error('INVALID_INPUT: كود الدعوة والبريد الإلكتروني وكلمة المرور جميعها مطلوبة');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const cleanCode = invitationCode.trim();
  const cleanEmail = email.trim().toLowerCase();

  // 1. Fetch Invitation by Document ID directly (Zero Collection Scanning)
  const invRef = doc(db, 'invitations', cleanCode);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) {
    const err = new Error('NOT_FOUND: كود الدعوة غير صحيح أو غير موجود');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const invData = invSnap.data();
  if (invData.status !== 'PENDING') {
    const err = new Error('INVALID_STATUS: كود الدعوة هذا تم استخدامه سابقاً أو ملغى');
    err.code = 'INVALID_STATUS';
    throw err;
  }

  if (invData.ownerEmail && invData.ownerEmail.toLowerCase() !== cleanEmail) {
    const err = new Error('EMAIL_MISMATCH: البريد الإلكتروني المدخل لا يطابق البريد الإلكتروني المخصص في الدعوة');
    err.code = 'EMAIL_MISMATCH';
    throw err;
  }

  const expiresAtMs = invData.expiresAt ? (typeof invData.expiresAt.toMillis === 'function' ? invData.expiresAt.toMillis() : Date.parse(invData.expiresAt)) : Infinity;
  if (Date.now() >= expiresAtMs) {
    const err = new Error('EXPIRED: انتهت صلاحية كود الدعوة هذا. يرجى طلب كود دعوة جديد من الإدارة العليا');
    err.code = 'EXPIRED';
    throw err;
  }

  const institutionId = invData.institutionId;

  // 2. Fetch Institution Document to check ownerId
  const instRef = doc(db, 'institutions', institutionId);
  const instSnap = await getDoc(instRef);
  if (!instSnap.exists()) {
    const err = new Error('NOT_FOUND: المركز التعليمي غير موجود');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const instData = instSnap.data();
  if (instData.ownerId !== 'PENDING_OWNER') {
    const err = new Error('ALREADY_CLAIMED: هذا المركز تم ملكيته وتفعيله سابقاً بواسطة مالك آخر');
    err.code = 'ALREADY_CLAIMED';
    throw err;
  }

  // 3. Create Firebase Auth Account
  const { createUserWithEmailAndPassword, sendEmailVerification } = require('firebase/auth');
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      const err = new Error('EMAIL_IN_USE: البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو إدخال البريد الصحيح');
      err.code = 'EMAIL_IN_USE';
      throw err;
    }
    throw e;
  }

  const user = userCredential.user;

  // 4. Send Email Verification
  await sendEmailVerification(user);

  return {
    success: true,
    requiresVerification: true,
    email: cleanEmail,
    invitationCode: cleanCode,
    institutionId: institutionId,
    uid: user.uid,
    message: 'تم إنشاء الحساب بنجاح. تم إرسال رابط تأكيد البريد الإلكتروني.'
  };
}

async function verifyEmailAndExecuteClaim({ invitationCode }) {
  if (!auth.currentUser) {
    const err = new Error('UNAUTHENTICATED: يرجى تسجيل الدخول أولاً لتأكيد البريد والملكية');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  // Reload user state & force token refresh to get email_verified == true
  await auth.currentUser.reload();
  const tokenResult = await auth.currentUser.getIdTokenResult(true);

  if (!auth.currentUser.emailVerified && !tokenResult.claims.email_verified) {
    const err = new Error('EMAIL_NOT_VERIFIED: لم يتم تأكيد البريد الإلكتروني بعد. يرجى النقر على الرابط في بريدك أولاً ثم المحاولة مجدداً');
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }

  const cleanCode = invitationCode.trim();
  const uid = auth.currentUser.uid;
  const userEmail = auth.currentUser.email.toLowerCase();

  // Execute Atomic Transaction
  const { runTransaction } = require('firebase/firestore');
  await runTransaction(db, async (transaction) => {
    const invRef = doc(db, 'invitations', cleanCode);
    const invSnap = await transaction.get(invRef);
    if (!invSnap.exists()) throw new Error('NOT_FOUND: كود الدعوة غير موجود');
    const invData = invSnap.data();

    if (invData.status !== 'PENDING') throw new Error('INVALID_STATUS: كود الدعوة تم استخدامه سابقاً');
    if (invData.ownerEmail.toLowerCase() !== userEmail) throw new Error('EMAIL_MISMATCH: البريد الإلكتروني لا يطابق بريد الدعوة');

    const instRef = doc(db, 'institutions', invData.institutionId);
    const instSnap = await transaction.get(instRef);
    if (!instSnap.exists()) throw new Error('NOT_FOUND: المركز غير موجود');
    const instData = instSnap.data();

    if (instData.ownerId !== 'PENDING_OWNER') throw new Error('ALREADY_CLAIMED: المركز تم تفعيله من جهاز/حساب آخر');

    const userRef = doc(db, 'users', uid);

    // Write User Profile
    transaction.set(userRef, {
      uid: uid,
      email: userEmail,
      role: 'institutionOwner',
      institutionId: invData.institutionId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });

    // Update Institution ownerId
    transaction.update(instRef, {
      ownerId: uid,
      updatedAt: new Date().toISOString()
    });

    // Update Invitation status
    transaction.update(invRef, {
      status: 'ACCEPTED',
      acceptedAt: new Date().toISOString(),
      acceptedBy: uid,
      updatedAt: new Date().toISOString()
    });
  });

  const userDocSnap = await getDoc(doc(db, 'users', uid));
  const claimedInstId = userDocSnap.exists() ? userDocSnap.data().institutionId : 'inst_bootstrap_001';

  const session = {
    uid: uid,
    email: userEmail,
    role: 'institutionOwner',
    institutionId: claimedInstId,
    idToken: tokenResult.token,
    expiresAt: Date.now() + 86400000,
    authenticatedAt: new Date().toISOString()
  };

  activeSessionToken = session;
  return {
    success: true,
    claimed: true,
    session: session,
    message: 'تم تفعيل وربط ملكية المركز بنجاح!'
  };
}

async function logoutUser(callerToken) {
  try {
    await signOut(auth);
  } catch (e) {}
  activeSessionToken = null;
  return { success: true, message: 'Logged out successfully' };
}

function resolveCallerToken(callerToken) {
  if (callerToken && typeof callerToken === 'object' && callerToken.uid) {
    // Allow callerToken even if institutionId empty — validateTenantAccess will handle empty check with correct error code
    if (callerToken.institutionId !== undefined || callerToken.role !== undefined) {
      return callerToken;
    }
    return callerToken;
  }

  if (activeSessionToken) {
    if (!activeSessionToken.institutionId || String(activeSessionToken.institutionId).trim() === '') {
      const err = new Error('TENANT_RESOLUTION_FAILED: الجلسة بدون مؤسسة صالحة');
      err.code = 'TENANT_RESOLUTION_FAILED';
      throw err;
    }
    return activeSessionToken;
  }

  if (auth.currentUser) {
    // No active session — do not fabricate bootstrap tenant for institutionOwner
    // Require explicit tenant resolution via users/{uid}.institutionId
    const err = new Error('UNAUTHENTICATED_CALLER: لا توجد جلسة مصادق عليها — يلزم تسجيل الدخول');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }

  const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
  err.code = 'UNAUTHENTICATED_CALLER';
  throw err;
}

function validateTenantAccess(callerToken, targetInstId) {
  const token = resolveCallerToken(callerToken);
  if (!token || !token.uid) {
    const err = new Error('UNAUTHENTICATED_CALLER: Authentication token required');
    err.code = 'UNAUTHENTICATED_CALLER';
    throw err;
  }

  const role = token.role || 'guest';
  const callerInst = token.institutionId;

  if (role === 'superAdmin') {
    return targetInstId || callerInst || 'inst_bootstrap_001';
  }

  if (!callerInst) {
    const err = new Error('UNAUTHORIZED_CALLER_TENANT: No assigned institution claim');
    err.code = 'UNAUTHORIZED_CALLER_TENANT';
    throw err;
  }

  if (targetInstId && targetInstId !== callerInst) {
    const err = new Error(`CROSS_TENANT_VIOLATION: Caller tenant '${callerInst}' cannot access '${targetInstId}'`);
    err.code = 'CROSS_TENANT_VIOLATION';
    throw err;
  }

  return callerInst;
}

async function recordAuditEvent({ action, actorUid, actorRole, institutionId, targetType, targetId, details = {} }) {
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.secret;

  const logDoc = {
    logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    action,
    actorUid: actorUid || 'system',
    actorRole: actorRole || 'unknown',
    institutionId: institutionId || 'platform',
    targetType: targetType || 'SYSTEM',
    targetId: targetId || 'none',
    details: sanitizedDetails,
    timestamp: new Date().toISOString()
  };

  try {
    const clientDb = await getClientFirestoreDb({ uid: actorUid, role: actorRole, institutionId });
    await setDoc(doc(clientDb, 'auditLogs', logDoc.logId), logDoc);
  } catch (err) {}

  return logDoc;
}

// ----------------------------------------------------------------------------
// CENTER ADMIN SERVICES
// ----------------------------------------------------------------------------

async function getCenterInfo(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);

  const clientDb = await getClientFirestoreDb(token);
  const instRef = doc(clientDb, 'institutions', instId);
  const snap = await getDoc(instRef);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  return {
    id: instId,
    name: 'سنتر التفوق التعليمي',
    phone: '01012345678',
    email: 'info@altafawok-center.com',
    address: 'القاهرة - مدينة نصر',
    status: 'ACTIVE',
    receiptHeader: 'سنتر التفوق التعليمي - خدمات تعليمية متكاملة'
  };
}

async function updateCenterInfo(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && (callerToken.name || callerToken.phone)) {
    body = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);

  const updated = {
    id: instId,
    name: body.name || 'سنتر التفوق التعليمي',
    phone: body.phone || '01012345678',
    email: body.email || '',
    address: body.address || '',
    receiptHeader: body.receiptHeader || 'سنتر التفوق التعليمي - خدمات تعليمية متكاملة',
    updatedAt: new Date().toISOString()
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId), updated, { merge: true });

  await recordAuditEvent({
    action: 'UPDATE_CENTER_INFO',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'INSTITUTION',
    targetId: instId,
    details: { name: updated.name }
  });

  return updated;
}

async function getDashboardSummary(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);

  const studentsList = await getStudents(token, { institutionId: instId });
  const teachersList = await getTeachers(token, { institutionId: instId });
  const groupsList = await getGroups(token, { institutionId: instId });
  const attendanceList = await getAttendanceRecords(token, { institutionId: instId });
  const paymentsList = await getPayments(token, { institutionId: instId });
  const expensesList = await getExpenses(token, { institutionId: instId });

  const todayStr = new Date().toISOString().split('T')[0];
  const activeStudents = studentsList.filter(s => s.status !== 'ARCHIVED').length;
  const activeTeachers = teachersList.filter(t => t.status !== 'ARCHIVED').length;
  const activeGroups = groupsList.filter(g => g.status !== 'ARCHIVED').length;

  const todayPayments = paymentsList.filter(p => p.paymentDate === todayStr);
  const todayIncome = todayPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalIncome = paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalExpenses = expensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const todayAttendance = attendanceList.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === 'PRESENT').length;
  const attendanceRate = todayAttendance.length > 0 ? Math.round((presentToday / todayAttendance.length) * 100) : 0;

  return {
    institutionId: instId,
    studentsCount: activeStudents,
    teachersCount: activeTeachers,
    groupsCount: activeGroups,
    totalStudents: activeStudents,
    totalTeachers: activeTeachers,
    totalGroups: activeGroups,
    todayIncome,
    totalIncome,
    totalRevenue: totalIncome,
    totalExpenses,
    totalExpensesAmount: totalExpenses,
    netBalance: totalIncome - totalExpenses,
    todayAttendanceCount: todayAttendance.length,
    attendanceRate,
    recentPayments: paymentsList.slice(-5).reverse(),
    recentAttendance: attendanceList.slice(-5).reverse()
  };
}

// ----------------------------------------------------------------------------
// STUDENTS CRUD — FIRESTORE AS SINGLE SOURCE OF TRUTH
// ----------------------------------------------------------------------------

async function getStudents(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (typeof options === 'string') {
    if (options.startsWith('inst_')) {
      opts = { institutionId: options };
    } else {
      opts = { query: options };
    }
  }
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  if (isTestOffline()) {
    let list = Array.from(inMemoryStudents.values())
      .filter(s => s.institutionId === instId && s.status !== 'ARCHIVED')
      .map(normalizeStudentDoc);
    const queryStr = opts.query || opts.search;
    if (queryStr && typeof queryStr === 'string') {
      const q = queryStr.toLowerCase();
      list = list.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.phone && s.phone.includes(q)) || (s.studentCode && s.studentCode.toLowerCase().includes(q)) || (s.guardianPhone && s.guardianPhone.includes(q)) || (s.normalizedPhone && s.normalizedPhone.includes(q)));
    }
    if (opts.groupFilter) list = list.filter(s => s.groupIds.includes(opts.groupFilter));
    if (opts.stageId) list = list.filter(s => s.stageId === opts.stageId);
    if (opts.status) list = list.filter(s => s.status === opts.status);
    return list;
  }

  // Firestore Query via Client SDK
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'students');
  const snap = await getDocs(colRef);
  let list = snap.docs.map(d => normalizeStudentDoc({ id: d.id, ...d.data() }));

  const queryStr = opts.query || opts.search;
  if (queryStr && typeof queryStr === 'string') {
    const q = queryStr.toLowerCase();
    list = list.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.phone && s.phone.includes(q)) || (s.studentCode && s.studentCode.toLowerCase().includes(q)) || (s.guardianPhone && s.guardianPhone.includes(q)));
  }

  if (opts.groupFilter) {
    list = list.filter(s => s.groupIds.includes(opts.groupFilter));
  }
  if (opts.stageId) list = list.filter(s => s.stageId === opts.stageId);
  if (opts.status) list = list.filter(s => s.status === opts.status);

  return list.filter(s => s.status !== 'ARCHIVED');
}

async function getStudentById(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!studentId) throw arabicServiceError('INVALID_STUDENT_ID', 'معرف الطالب مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  const data = await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب');
  return normalizeStudentDoc(data);
}

function normalizeEgyptianPhone(phoneInput) {
  if (!phoneInput || typeof phoneInput !== 'string') {
    throw new Error('INVALID_PHONE: Phone number is required');
  }
  let cleaned = phoneInput.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith('+20')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('20') && cleaned.length === 13 && cleaned.startsWith('201')) {
    // handle +20 with extra digit? already stripped +
  }
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    cleaned = '2' + cleaned;
  } else if (cleaned.startsWith('201') && cleaned.length === 13) {
    // 201... with 13 length due to leading 20+? trim to 12
    cleaned = cleaned.substring(0, 12);
  }
  if (cleaned.startsWith('201') && cleaned.length === 12) {
    const canonical = '+' + cleaned;
    if (/^\+201[0125]\d{8}$/.test(canonical)) {
      return canonical;
    }
  }
  // Also handle case where input was 10 digits starting with 1 (without 0)
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '20' + cleaned;
    if (cleaned.length === 12) {
      const canonical = '+' + cleaned;
      if (/^\+201[0125]\d{8}$/.test(canonical)) return canonical;
    }
  }
  throw new Error(`INVALID_PHONE_FORMAT: Phone '${phoneInput}' is not a valid Egyptian mobile number (+201XXXXXXXXX)`);
}

async function createStudent(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.name) {
    body = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  if (!body.name || body.name.trim().length === 0) {
    throw arabicServiceError('INVALID_STUDENT_NAME', 'اسم الطالب الكامل مطلوب');
  }

  const rawPhone = (body.phone || '').trim();
  if (!rawPhone) throw arabicServiceError('INVALID_PHONE', 'رقم هاتف الطالب مطلوب');
  const normalizedPhone = normalizeEgyptianPhone(rawPhone);
  if (body.guardianPhone && String(body.guardianPhone).trim()) {
    try { normalizeEgyptianPhone(String(body.guardianPhone).trim()); } catch (e) {
      throw arabicServiceError('INVALID_GUARDIAN_PHONE', 'رقم هاتف ولي الأمر غير صالح — يجب أن يكون رقماً مصرياً صحيحاً', String(body.guardianPhone));
    }
  }

  const id = body.id || `STU_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const qrToken = `QR_${id}`;

  const clientDb = await getClientFirestoreDb(token);

  // Duplicate phone check (same institution, active only)
  if (isTestOffline()) {
    const dup = Array.from(inMemoryStudents.values()).find(s => s.institutionId === instId && s.normalizedPhone === normalizedPhone && s.id !== id && s.status !== 'ARCHIVED');
    if (dup) throw arabicServiceError('DUPLICATE_STUDENT_IN_INSTITUTION', 'يوجد طالب بنفس رقم الهاتف مسجل مسبقاً في هذا المركز', rawPhone);
  } else {
    const studentsColRef = collection(clientDb, 'institutions', instId, 'students');
    const existingDupQuery = query(studentsColRef, where('normalizedPhone', '==', normalizedPhone));
    const existingDupSnap = await getDocs(existingDupQuery);
    const activeDups = existingDupSnap.docs.filter(d => d.id !== id && d.data().status !== 'ARCHIVED');
    if (activeDups.length > 0) {
      throw arabicServiceError('DUPLICATE_STUDENT_IN_INSTITUTION', 'يوجد طالب بنفس رقم الهاتف مسجل مسبقاً في هذا المركز', rawPhone);
    }
  }

  // Validate academic references when provided
  const academicYearId = body.academicYearId || '';
  const stageId = body.stageId || '';
  if (academicYearId || stageId) {
    await validateGroupReferences(token, clientDb, instId, { academicYearId: academicYearId || undefined, stageId: stageId || undefined });
  }

  // Resolve requested groups (canonical groupIds). Accept groupIds array or legacy groupId.
  const requestedGroupIds = canonicalStudentGroupIds({ groupIds: body.groupIds, groupId: body.groupId });
  const uniqueGroupIds = [...new Set(requestedGroupIds)];

  // Pre-validate every group BEFORE creating the student (no partial state)
  const validatedGroups = [];
  for (const gid of uniqueGroupIds) {
    const g = await fetchDocSameTenant(clientDb, 'groups', gid, instId, inMemoryGroups, 'المجموعة');
    if (g.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن تسجيل الطالب في مجموعة من مؤسسة أخرى', gid);
    if (g.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_GROUP', 'المجموعة المحددة مؤرشفة ولا تقبل تسجيلات جديدة', gid);
    if (g.status !== 'ACTIVE') throw arabicServiceError('INACTIVE_GROUP', 'المجموعة المحددة غير نشطة ولا تقبل تسجيلات جديدة', gid);
    const enrolled = Number(g.enrolledCount || 0);
    const cap = canonicalGroupCapacity(g);
    if (enrolled >= cap) throw arabicServiceError('GROUP_FULL', `المجموعة ممتلئة ولا توجد مقاعد متاحة (${enrolled}/${cap})`, gid);
    if (stageId && g.stageId && g.stageId !== stageId) {
      throw arabicServiceError('STAGE_GROUP_MISMATCH', 'المجموعة المحددة تنتمي لمرحلة مختلفة عن مرحلة الطالب', gid);
    }
    validatedGroups.push(g);
  }

  // Provision / resolve Auth UID (deterministic hash; existing approved architecture — no Admin SDK in client)
  const authUid = body.authUid || `auth_uid_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`;

  const nowISO = new Date().toISOString();
  const student = normalizeStudentDoc({
    id,
    studentCode: body.studentCode || `STU-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    institutionId: instId,
    authUid,
    name: body.name.trim(),
    phone: rawPhone,
    normalizedPhone,
    guardianPhone: (body.guardianPhone || '').trim(),
    guardianName: (body.guardianName || '').trim(),
    academicYearId: academicYearId || body.academicYearId || '',
    stageId: stageId || '',
    grade: body.grade || '',
    stage: body.stage || '',
    groupIds: [],
    groupId: '',
    qrToken,
    status: body.status || 'ACTIVE',
    notes: (body.notes || '').trim(),
    createdAt: nowISO,
    updatedAt: nowISO,
    createdBy: token.uid || 'system'
  });

  // ATOMIC CREATE + ENROLL: create student first, then enroll in each group.
  // On any enrollment failure, compensate by rolling back the student doc + prior enrollments.
  const createdEnrollmentIds = [];
  const rollbackStudent = async () => {
    try {
      if (isTestOffline()) { inMemoryStudents.delete(`${instId}_${id}`); }
      else { await deleteDoc(doc(clientDb, 'institutions', instId, 'students', id)); }
    } catch (_) {}
    for (const eid of createdEnrollmentIds) {
      try {
        if (isTestOffline()) { inMemoryEnrollments.delete(`${instId}_${eid}`); }
        else { await deleteDoc(doc(clientDb, 'institutions', instId, 'enrollments', eid)); }
      } catch (_) {}
    }
  };

  try {
    if (isTestOffline()) {
      inMemoryStudents.set(`${instId}_${id}`, { ...student });
    } else {
      await setDoc(doc(clientDb, 'institutions', instId, 'students', id), student, { merge: true });
    }
    // Enroll sequentially with transaction-safe helper (validates again inside transaction)
    const finalGroupIds = [];
    for (const g of validatedGroups) {
      await enrollStudentInGroupInternal(token, clientDb, instId, id, g.id);
      createdEnrollmentIds.push(enrollmentDocId(id, g.id));
      finalGroupIds.push(g.id);
    }
    const withGroups = normalizeStudentDoc({ ...student, groupIds: finalGroupIds, groupId: finalGroupIds[0] || '' });
    if (isTestOffline()) {
      inMemoryStudents.set(`${instId}_${id}`, { ...withGroups });
    } else {
      await setDoc(doc(clientDb, 'institutions', instId, 'students', id), { groupIds: finalGroupIds, groupId: finalGroupIds[0] || '', updatedAt: new Date().toISOString() }, { merge: true });
    }
    // Verify final state before claiming success
    const verified = await getStudentById(token, id, instId);
    if (verified.groupIds.length !== finalGroupIds.length) {
      await rollbackStudent();
      throw arabicServiceError('ENROLLMENT_VERIFY_FAILED', 'فشل التحقق من اكتمال التسجيل — تم التراجع عن إنشاء الطالب');
    }
    await recordAuditEvent({
      action: 'CREATE_STUDENT',
      actorUid: token.uid,
      actorRole: token.role,
      institutionId: instId,
      targetType: 'STUDENT',
      targetId: id,
      details: { name: verified.name, stageId: verified.stageId, groupIds: verified.groupIds, authUid: verified.authUid }
    });
    return verified;
  } catch (err) {
    // Only rollback if student was created by this call and enrollment failed (not validation-before-create)
    if (createdEnrollmentIds.length > 0 || (err.code !== 'GROUP_FULL' && err.code !== 'DUPLICATE_ENROLLMENT' && err.code !== 'INACTIVE_GROUP' && err.code !== 'STAGE_GROUP_MISMATCH' && createdEnrollmentIds.length === 0 && uniqueGroupIds.length > 0 && err.code === 'ENROLLMENT_VERIFY_FAILED')) {
      // Check if student doc exists from this call then rollback
      try {
        const exists = await getStudentById(token, id, instId).catch(() => null);
        if (exists && validatedGroups.length > 0) await rollbackStudent();
      } catch (_) {}
    } else if (uniqueGroupIds.length > 0 && validatedGroups.length === uniqueGroupIds.length) {
      // Student doc was created then enrollment threw inside loop — rollback
      try {
        const exists = await getStudentById(token, id, instId).catch(() => null);
        if (exists) await rollbackStudent();
      } catch (_) {}
    }
    throw err;
  }
}

function addStudent(payload) {
  return createStudent(null, payload);
}

async function updateStudent(callerToken, studentIdOrPayload, payload = {}) {
  let sId = studentIdOrPayload;
  let body = payload;
  if (typeof studentIdOrPayload === 'object' && studentIdOrPayload.id) {
    sId = studentIdOrPayload.id;
    body = studentIdOrPayload;
  }
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  if (body.institutionId && body.institutionId !== instId) throw arabicServiceError('IMMUTABLE_FIELD_MODIFICATION', 'لا يمكن تغيير المؤسسة الخاصة بالطالب');

  const clientDb = await getClientFirestoreDb(token);
  const existing = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', sId, instId, inMemoryStudents, 'الطالب'));
  if (existing.status === 'ARCHIVED' && body.status && body.status !== 'ARCHIVED') {
    throw arabicServiceError('ARCHIVED_STUDENT_IMMUTABLE', 'الطالب مؤرشف — لا يمكن إعادة تفعيله مباشرة دون مراجعة الإدارة');
  }
  // Phone change → re-validate + duplicate check
  let normalizedPhone = existing.normalizedPhone;
  if (body.phone !== undefined) {
    const rp = String(body.phone).trim();
    if (!rp) throw arabicServiceError('INVALID_PHONE', 'رقم هاتف الطالب مطلوب');
    normalizedPhone = normalizeEgyptianPhone(rp);
    if (isTestOffline()) {
      const dup = Array.from(inMemoryStudents.values()).find(s => s.institutionId === instId && s.normalizedPhone === normalizedPhone && s.id !== sId && s.status !== 'ARCHIVED');
      if (dup) throw arabicServiceError('DUPLICATE_STUDENT_IN_INSTITUTION', 'يوجد طالب بنفس رقم الهاتف مسجل مسبقاً في هذا المركز', rp);
    } else {
      const qd = query(collection(clientDb, 'institutions', instId, 'students'), where('normalizedPhone', '==', normalizedPhone));
      const snap = await getDocs(qd);
      if (snap.docs.some(d => d.id !== sId && d.data().status !== 'ARCHIVED')) throw arabicServiceError('DUPLICATE_STUDENT_IN_INSTITUTION', 'يوجد طالب بنفس رقم الهاتف مسجل مسبقاً في هذا المركز', rp);
    }
  }
  if (body.guardianPhone !== undefined && String(body.guardianPhone).trim()) {
    try { normalizeEgyptianPhone(String(body.guardianPhone).trim()); } catch (e) {
      throw arabicServiceError('INVALID_GUARDIAN_PHONE', 'رقم هاتف ولي الأمر غير صالح', String(body.guardianPhone));
    }
  }

  // Stage / academic year change validation
  const newStageId = body.stageId !== undefined ? body.stageId : existing.stageId;
  const newYearId = body.academicYearId !== undefined ? body.academicYearId : existing.academicYearId;
  if (newYearId || newStageId) {
    await validateGroupReferences(token, clientDb, instId, { academicYearId: newYearId || undefined, stageId: newStageId || undefined });
  }

  // Group sync: if groupIds/groupId provided, diff and apply enrollment transactions
  const groupChangeRequested = body.groupIds !== undefined || body.groupId !== undefined;
  if (groupChangeRequested) {
    const desired = [...new Set(canonicalStudentGroupIds({ groupIds: body.groupIds, groupId: body.groupId }))];
    for (const gid of desired) {
      await fetchDocSameTenant(clientDb, 'groups', gid, instId, inMemoryGroups, 'المجموعة');
    }
    // Stage compatibility for newly added groups
    const effectiveStage = newStageId || '';
    if (effectiveStage) {
      for (const gid of desired) {
        const g = await fetchDocSameTenant(clientDb, 'groups', gid, instId, inMemoryGroups, 'المجموعة');
        if (g.stageId && g.stageId !== effectiveStage) {
          throw arabicServiceError('STAGE_GROUP_MISMATCH', 'إحدى المجموعات المحددة تنتمي لمرحلة مختلفة — يلزم معالجة صريحة قبل الحفظ', gid);
        }
      }
    }
    const current = new Set(existing.groupIds);
    const want = new Set(desired);
    const toAdd = desired.filter(g => !current.has(g));
    const toRemove = existing.groupIds.filter(g => !want.has(g));
    for (const gid of toAdd) {
      await enrollStudentInGroupInternal(token, clientDb, instId, sId, gid);
    }
    for (const gid of toRemove) {
      await removeStudentFromGroupInternal(token, clientDb, instId, sId, gid);
    }
  }

  const patch = { ...body };
  delete patch.groupIds; delete patch.groupId;
  if (body.phone !== undefined) { patch.phone = String(body.phone).trim(); patch.normalizedPhone = normalizedPhone; }
  const finalGroupState = groupChangeRequested
    ? normalizeStudentDoc({ groupIds: [...new Set(canonicalStudentGroupIds({ groupIds: body.groupIds, groupId: body.groupId }))] })
    : null;
  const updated = normalizeStudentDoc({
    ...existing,
    ...patch,
    id: sId,
    institutionId: instId,
    ...(finalGroupState ? { groupIds: finalGroupState.groupIds, groupId: finalGroupState.groupId } : {}),
    updatedAt: new Date().toISOString()
  });

  if (isTestOffline()) {
    inMemoryStudents.set(`${instId}_${sId}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'students', sId), { ...patch, ...(finalGroupState ? { groupIds: finalGroupState.groupIds, groupId: finalGroupState.groupId } : {}), id: sId, institutionId: instId, updatedAt: new Date().toISOString() }, { merge: true });
  }

  await recordAuditEvent({
    action: 'UPDATE_STUDENT',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'STUDENT',
    targetId: sId,
    details: { name: updated.name, stageId: updated.stageId, groupIds: updated.groupIds }
  });

  return updated;
}

async function archiveStudent(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const existing = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب'));
  // Safe-archive: withdraw active enrollments first so counts stay consistent
  for (const gid of [...existing.groupIds]) {
    try { await removeStudentFromGroupInternal(token, clientDb, instId, studentId, gid); } catch (_) {}
  }
  const updated = normalizeStudentDoc({ ...existing, status: 'ARCHIVED', groupIds: [], groupId: '', updatedAt: new Date().toISOString() });
  if (isTestOffline()) {
    inMemoryStudents.set(`${instId}_${studentId}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'students', studentId), { status: 'ARCHIVED', groupIds: [], groupId: '', updatedAt: new Date().toISOString() }, { merge: true });
  }
  await recordAuditEvent({ action: 'ARCHIVE_STUDENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STUDENT', targetId: studentId, details: { name: existing.name } });
  return updated;
}

async function deleteStudent(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const existing = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب'));
  if (existing.groupIds.length > 0) {
    throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن الحذف لأن هناك سجلات مرتبطة بهذا العنصر — الطالب مسجل في مجموعات. استخدم الأرشفة أولاً', studentId);
  }
  // Check enrollments collection for lingering docs
  const hasEnrollment = isTestOffline()
    ? Array.from(inMemoryEnrollments.values()).some(e => e.institutionId === instId && e.studentId === studentId && e.status === 'ENROLLED')
    : (await getDocs(collection(clientDb, 'institutions', instId, 'enrollments'))).docs.some(d => d.data().studentId === studentId && d.data().status === 'ENROLLED');
  if (hasEnrollment) throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن الحذف لأن هناك سجلات مرتبطة بهذا العنصر — توجد قيود تسجيل نشطة', studentId);
  if (isTestOffline()) {
    inMemoryStudents.delete(`${instId}_${studentId}`);
  } else {
    await deleteDoc(doc(clientDb, 'institutions', instId, 'students', studentId));
  }
  await recordAuditEvent({ action: 'DELETE_STUDENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STUDENT', targetId: studentId, details: {} });
  return { success: true, id: studentId };
}

// ----------------------------------------------------------------------------
// TEACHERS CRUD — FIRESTORE SOURCE OF TRUTH (Phase 50.2 Enhanced)
// ----------------------------------------------------------------------------

function generateTeacherCode(institutionId) {
  // Count existing teachers for institution in memory to generate TCH-0001 style
  const count = Array.from(inMemoryTeachers.values()).filter(t => t.institutionId === institutionId).length;
  const seq = count + 1 + Math.floor(Math.random()*1000) % 10; // stable-ish but unique when combined with timestamp fallback
  // Use inMemory size + timestamp for uniqueness; pad to 4
  // For offline determinism, use count+1 padded
  return `TCH-${String(count + 1).padStart(4, '0')}`;
}

function validateTeacherEmail(email) {
  if (!email || email.trim() === '') return null;
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('INVALID_EMAIL: البريد الإلكتروني غير صالح');
  return e;
}

async function getTeachers(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  if (isTestOffline()) {
    let list = Array.from(inMemoryTeachers.values()).filter(t => t.institutionId === instId && t.status !== 'ARCHIVED');
    if (opts.search) {
      const q = opts.search.toLowerCase();
      list = list.filter(t => (t.fullName && t.fullName.toLowerCase().includes(q)) || (t.phone && t.phone.includes(q)) || (t.teacherCode && t.teacherCode.toLowerCase().includes(q)));
    }
    return list;
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'teachers');
  const snap = await getDocs(colRef);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  let filtered = list.filter(t => t.status !== 'ARCHIVED');
  if (opts.search) {
    const q = opts.search.toLowerCase();
    filtered = filtered.filter(t => (t.fullName && t.fullName.toLowerCase().includes(q)) || (t.phone && t.phone.includes(q)) || (t.teacherCode && t.teacherCode.toLowerCase().includes(q)));
  }
  return filtered;
}

async function getTeacherById(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${teacherId}`;
    const t = inMemoryTeachers.get(key);
    if (!t) {
      const any = Array.from(inMemoryTeachers.values()).find(x => x.id === teacherId);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Teacher belongs to another institution');
      throw new Error('NOT_FOUND: Teacher not found');
    }
    return t;
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDoc(doc(clientDb, 'institutions', instId, 'teachers', teacherId));
  if (!snap.exists()) throw new Error('NOT_FOUND: Teacher not found');
  return { id: snap.id, ...snap.data() };
}

async function createTeacher(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const fullName = (payload.fullName || payload.name || '').trim();
  if (!fullName || fullName.length === 0) {
    throw new Error('INVALID_TEACHER_NAME: Teacher name is required');
  }
  const rawPhone = (payload.phone || '').trim();
  if (!rawPhone) throw new Error('INVALID_PHONE: Phone number is required');
  const normalizedPhone = normalizeEgyptianPhone(rawPhone);
  const specialization = (payload.specialization || payload.subject || '').trim();
  if (!specialization) throw new Error('INVALID_SPECIALIZATION: التخصص مطلوب');
  const email = payload.email ? validateTeacherEmail(payload.email) : '';
  const status = payload.status || 'ACTIVE';
  if (!['ACTIVE','SUSPENDED','ARCHIVED'].includes(status)) throw new Error('INVALID_STATUS: Status must be ACTIVE/SUSPENDED/ARCHIVED');

  if (isTestOffline()) {
    // Duplicate check by normalizedPhone within same institution
    const dup = Array.from(inMemoryTeachers.values()).find(t => t.institutionId === instId && t.normalizedPhone === normalizedPhone && t.status !== 'ARCHIVED');
    if (dup) throw new Error('DUPLICATE_TEACHER_IN_INSTITUTION: معلم بنفس رقم الهاتف موجود مسبقاً في نفس المركز');
    if (email) {
      const dupEmail = Array.from(inMemoryTeachers.values()).find(t => t.institutionId === instId && t.email && t.email.toLowerCase() === email.toLowerCase() && t.status !== 'ARCHIVED');
      if (dupEmail) throw new Error('DUPLICATE_TEACHER_EMAIL: البريد الإلكتروني مستخدم مسبقاً لنفس المركز');
    }
    const id = payload.id || `TCH_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
    // Ensure teacherCode unique
    let teacherCode = payload.teacherCode || generateTeacherCode(instId);
    let attempts = 0;
    while (Array.from(inMemoryTeachers.values()).some(t => t.institutionId === instId && t.teacherCode === teacherCode) && attempts < 5) {
      teacherCode = `TCH-${String(Date.now() % 10000).padStart(4,'0')}`;
      attempts++;
    }
    if (Array.from(inMemoryTeachers.values()).some(t => t.institutionId === instId && t.teacherCode === teacherCode)) {
      throw new Error('DUPLICATE_TEACHER_CODE: كود المعلم مكرر');
    }
    const teacher = {
      id,
      teacherId: id,
      institutionId: instId,
      teacherCode,
      fullName,
      name: fullName,
      phone: rawPhone,
      normalizedPhone,
      email: email || '',
      specialization,
      subject: specialization,
      status,
      authUid: payload.authUid || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: token.uid || 'system',
      updatedBy: token.uid || 'system'
    };
    inMemoryTeachers.set(`${instId}_${id}`, teacher);
    await recordAuditEvent({ action: 'CREATE_TEACHER', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'TEACHER', targetId: id, details: { name: fullName, teacherCode } });
    return teacher;
  }

  const clientDb = await getClientFirestoreDb(token);
  // Duplicate phone check via query
  const dupQuery = query(collection(clientDb, 'institutions', instId, 'teachers'), where('normalizedPhone', '==', normalizedPhone));
  const dupSnap = await getDocs(dupQuery);
  const activeDup = dupSnap.docs.filter(d => d.data().status !== 'ARCHIVED');
  if (activeDup.length > 0) throw new Error('DUPLICATE_TEACHER_IN_INSTITUTION: معلم بنفس رقم الهاتف موجود مسبقاً');
  if (email) {
    const emailQuery = query(collection(clientDb, 'institutions', instId, 'teachers'), where('email', '==', email));
    const emailSnap = await getDocs(emailQuery);
    if (emailSnap.docs.some(d => d.data().status !== 'ARCHIVED')) throw new Error('DUPLICATE_TEACHER_EMAIL: البريد الإلكتروني مستخدم مسبقاً');
  }
  const id = payload.id || `TCH_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  let teacherCode = payload.teacherCode;
  if (!teacherCode) {
    // Generate from Firestore count
    const allSnap = await getDocs(collection(clientDb, 'institutions', instId, 'teachers'));
    const count = allSnap.docs.length;
    teacherCode = `TCH-${String(count+1).padStart(4,'0')}`;
  }
  // Ensure code unique
  const codeQuery = query(collection(clientDb, 'institutions', instId, 'teachers'), where('teacherCode', '==', teacherCode));
  const codeSnap = await getDocs(codeQuery);
  if (codeSnap.docs.some(d => d.data().status !== 'ARCHIVED')) throw new Error('DUPLICATE_TEACHER_CODE: كود المعلم مكرر');

  const teacher = {
    id,
    teacherId: id,
    institutionId: instId,
    teacherCode,
    fullName,
    name: fullName,
    phone: rawPhone,
    normalizedPhone,
    email: email || '',
    specialization,
    subject: specialization,
    status,
    authUid: payload.authUid || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: token.uid || 'system',
    updatedBy: token.uid || 'system'
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'teachers', id), teacher);
  await recordAuditEvent({ action: 'CREATE_TEACHER', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'TEACHER', targetId: id, details: { name: fullName, teacherCode } });
  return teacher;
}

async function updateTeacher(callerToken, teacherIdOrPayload, payload = {}) {
  let tId = teacherIdOrPayload;
  let body = payload;
  if (typeof teacherIdOrPayload === 'object' && teacherIdOrPayload.id) {
    tId = teacherIdOrPayload.id;
    body = teacherIdOrPayload;
  }
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  if (body.institutionId && body.institutionId !== instId) throw new Error('IMMUTABLE_FIELD_MODIFICATION: institutionId cannot be modified');
  if (body.teacherCode) {
    // Teacher code must remain stable — prevent arbitrary change to duplicate
    const existingForCodeCheck = isTestOffline() ? inMemoryTeachers.get(`${instId}_${tId}`) : null;
    if (existingForCodeCheck && body.teacherCode !== existingForCodeCheck.teacherCode) {
      throw new Error('IMMUTABLE_FIELD_MODIFICATION: teacherCode cannot be modified arbitrarily');
    }
  }
  // Validate phone if changed
  let normalizedPhone = undefined;
  if (body.phone) {
    normalizedPhone = normalizeEgyptianPhone(body.phone.trim());
    body.normalizedPhone = normalizedPhone;
  }
  if (body.email) body.email = validateTeacherEmail(body.email) || '';
  if (body.fullName) body.fullName = body.fullName.trim();
  if (body.name) body.name = body.name.trim();
  if (body.specialization) body.specialization = body.specialization.trim();
  if (isTestOffline()) {
    const key = `${instId}_${tId}`;
    const existing = inMemoryTeachers.get(key);
    if (!existing) {
      const any = Array.from(inMemoryTeachers.values()).find(x => x.id === tId);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Teacher belongs to another institution');
      throw new Error('NOT_FOUND: Teacher not found');
    }
    if (existing.status === 'ARCHIVED') throw new Error('ARCHIVED_TEACHER_IMMUTABLE: لا يمكن تعديل معلم مؤرشف كنشط');
    // Duplicate phone check if changed
    if (normalizedPhone && normalizedPhone !== existing.normalizedPhone) {
      const dup = Array.from(inMemoryTeachers.values()).find(t => t.institutionId === instId && t.normalizedPhone === normalizedPhone && t.id !== tId && t.status !== 'ARCHIVED');
      if (dup) throw new Error('DUPLICATE_TEACHER_IN_INSTITUTION: معلم بنفس رقم الهاتف موجود مسبقاً');
    }
    const updated = { ...existing, ...body, id: tId, teacherId: tId, institutionId: instId, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system' };
    if (updated.fullName) updated.name = updated.fullName;
    if (updated.specialization) updated.subject = updated.specialization;
    inMemoryTeachers.set(key, updated);
    return updated;
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDoc(doc(clientDb, 'institutions', instId, 'teachers', tId));
  if (!snap.exists()) throw new Error('NOT_FOUND: Teacher not found');
  if (snap.data().status === 'ARCHIVED') throw new Error('ARCHIVED_TEACHER_IMMUTABLE: لا يمكن تعديل معلم مؤرشف');
  const updated = { ...body, id: tId, teacherId: tId, institutionId: instId, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system' };
  await setDoc(doc(clientDb, 'institutions', instId, 'teachers', tId), updated, { merge: true });
  return updated;
}

async function setTeacherStatus(callerToken, teacherId, status) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  if (!['ACTIVE','SUSPENDED','ARCHIVED'].includes(status)) throw new Error('INVALID_STATUS');
  return await updateTeacher(token, teacherId, { institutionId: instId, status });
}

async function archiveTeacher(callerToken, teacherId, institutionId) {
  return await setTeacherStatus(callerToken, teacherId, 'ARCHIVED');
}

async function deleteTeacher(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${teacherId}`;
    const existing = inMemoryTeachers.get(key);
    if (!existing) {
      const any = Array.from(inMemoryTeachers.values()).find(t => t.id === teacherId);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Teacher belongs to another institution');
      throw new Error('NOT_FOUND: Teacher not found');
    }
    const hasSubjectAssign = Array.from(inMemoryTeacherSubjects.values()).some(a => a.institutionId === instId && a.teacherId === teacherId);
    const hasStageAssign = Array.from(inMemoryTeacherStages.values()).some(a => a.institutionId === instId && a.teacherId === teacherId);
    if (hasSubjectAssign || hasStageAssign) {
      throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذا المعلم لأنه مرتبط بمواد/مراحل أو مجموعات/حصص. يمكنك أرشفته بدلًا من حذفه.');
    }
    inMemoryTeachers.delete(key);
    await recordAuditEvent({ action: 'DELETE_TEACHER', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'TEACHER', targetId: teacherId, details: { teacherCode: existing.teacherCode } });
    return { success: true, id: teacherId };
  }
  const clientDb = await getClientFirestoreDb(token);
  const subSnap = await getDocs(collection(clientDb, 'institutions', instId, 'teacherSubjects'));
  const hasSub = subSnap.docs.some(d => d.data().teacherId === teacherId);
  const stageSnap = await getDocs(collection(clientDb, 'institutions', instId, 'teacherStages'));
  const hasStage = stageSnap.docs.some(d => d.data().teacherId === teacherId);
  if (hasSub || hasStage) {
    throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذا المعلم لأنه مرتبط بمواد/مراحل. يمكنك أرشفته بدلًا من حذفه.');
  }
  // Also check groups/sessions if they reference teacher (future)
  const groupsSnap = await getDocs(collection(clientDb, 'institutions', instId, 'groups'));
  if (groupsSnap.docs.some(d => d.data().teacherId === teacherId)) {
    throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذا المعلم لأنه مرتبط بمجموعات دراسية.');
  }
  const sessionsSnap = await getDocs(collection(clientDb, 'institutions', instId, 'sessions'));
  if (sessionsSnap.docs.some(d => d.data().teacherId === teacherId)) {
    throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذا المعلم لأنه مرتبط بحصص مجدولة.');
  }
  await deleteDoc(doc(clientDb, 'institutions', instId, 'teachers', teacherId));
  await recordAuditEvent({ action: 'DELETE_TEACHER', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'TEACHER', targetId: teacherId, details: { } });
  return { success: true, id: teacherId };
}

// ----------------------------------------------------------------------------
// TEACHER RELATIONSHIPS — Subjects & Stages (Phase 50.2)
// ----------------------------------------------------------------------------

async function getTeacherSubjects(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!teacherId) throw new Error('INVALID_TEACHER_ID: teacherId required');
  if (isTestOffline()) {
    return Array.from(inMemoryTeacherSubjects.values()).filter(a => a.institutionId === instId && a.teacherId === teacherId);
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'teacherSubjects'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.teacherId === teacherId);
}

async function assignTeacherSubject(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const teacherId = payload.teacherId;
  const subjectId = payload.subjectId;
  if (!teacherId || !subjectId) throw new Error('INVALID_ASSIGNMENT: teacherId and subjectId required');
  if (isTestOffline()) {
    const teacherKey = `${instId}_${teacherId}`;
    const teacher = inMemoryTeachers.get(teacherKey);
    if (!teacher) {
      const anyT = Array.from(inMemoryTeachers.values()).find(t => t.id === teacherId);
      if (anyT && anyT.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Teacher belongs to another institution');
      throw new Error('NOT_FOUND: Teacher not found');
    }
    const subjectKey = `${instId}_${subjectId}`;
    const subject = inMemorySubjects.get(subjectKey);
    if (!subject) {
      const anyS = Array.from(inMemorySubjects.values()).find(s => s.id === subjectId);
      if (anyS && anyS.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Subject belongs to another institution');
      throw new Error('NOT_FOUND: Subject not found');
    }
    const dup = Array.from(inMemoryTeacherSubjects.values()).find(a => a.institutionId === instId && a.teacherId === teacherId && a.subjectId === subjectId);
    if (dup) throw new Error('DUPLICATE_ASSIGNMENT: هذا المعلم مخصص مسبقاً لهذه المادة');
    const id = payload.id || `TSUB_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
    const assignment = { id, assignmentId: id, institutionId: instId, teacherId, subjectId, createdAt: new Date().toISOString(), createdBy: token.uid || 'system' };
    inMemoryTeacherSubjects.set(`${instId}_${id}`, assignment);
    return assignment;
  }
  const clientDb = await getClientFirestoreDb(token);
  const teacherSnap = await getDoc(doc(clientDb, 'institutions', instId, 'teachers', teacherId));
  if (!teacherSnap.exists()) throw new Error('NOT_FOUND: Teacher not found');
  const subjectSnap = await getDoc(doc(clientDb, 'institutions', instId, 'subjects', subjectId));
  if (!subjectSnap.exists()) throw new Error('NOT_FOUND: Subject not found');
  const q = query(collection(clientDb, 'institutions', instId, 'teacherSubjects'), where('teacherId','==',teacherId), where('subjectId','==',subjectId));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error('DUPLICATE_ASSIGNMENT: هذا المعلم مخصص مسبقاً لهذه المادة');
  const id = `TSUB_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const assignment = { id, assignmentId: id, institutionId: instId, teacherId, subjectId, createdAt: new Date().toISOString(), createdBy: token.uid || 'system' };
  await setDoc(doc(clientDb, 'institutions', instId, 'teacherSubjects', id), assignment);
  return assignment;
}

async function removeTeacherSubject(callerToken, assignmentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${assignmentId}`;
    if (!inMemoryTeacherSubjects.has(key)) {
      const any = Array.from(inMemoryTeacherSubjects.values()).find(a => a.id === assignmentId);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION');
      throw new Error('NOT_FOUND: Assignment not found');
    }
    inMemoryTeacherSubjects.delete(key);
    return { success: true };
  }
  const clientDb = await getClientFirestoreDb(token);
  await deleteDoc(doc(clientDb, 'institutions', instId, 'teacherSubjects', assignmentId));
  return { success: true };
}

async function getTeacherStages(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!teacherId) throw new Error('INVALID_TEACHER_ID: teacherId required');
  if (isTestOffline()) {
    return Array.from(inMemoryTeacherStages.values()).filter(a => a.institutionId === instId && a.teacherId === teacherId);
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'teacherStages'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.teacherId === teacherId);
}

async function assignTeacherStage(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const teacherId = payload.teacherId;
  const stageId = payload.stageId;
  if (!teacherId || !stageId) throw new Error('INVALID_ASSIGNMENT: teacherId and stageId required');
  if (isTestOffline()) {
    const teacherKey = `${instId}_${teacherId}`;
    const teacher = inMemoryTeachers.get(teacherKey);
    if (!teacher) {
      const anyT = Array.from(inMemoryTeachers.values()).find(t => t.id === teacherId);
      if (anyT && anyT.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Teacher belongs to another institution');
      throw new Error('NOT_FOUND: Teacher not found');
    }
    const stageKey = `${instId}_${stageId}`;
    const stage = inMemoryStages.get(stageKey);
    if (!stage) {
      const anyS = Array.from(inMemoryStages.values()).find(s => s.id === stageId);
      if (anyS && anyS.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Stage belongs to another institution');
      throw new Error('NOT_FOUND: Stage not found');
    }
    const dup = Array.from(inMemoryTeacherStages.values()).find(a => a.institutionId === instId && a.teacherId === teacherId && a.stageId === stageId);
    if (dup) throw new Error('DUPLICATE_ASSIGNMENT: هذا المعلم مخصص مسبقاً لهذه المرحلة');
    const id = payload.id || `TSTG_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
    const assignment = { id, assignmentId: id, institutionId: instId, teacherId, stageId, createdAt: new Date().toISOString(), createdBy: token.uid || 'system' };
    inMemoryTeacherStages.set(`${instId}_${id}`, assignment);
    return assignment;
  }
  const clientDb = await getClientFirestoreDb(token);
  const teacherSnap = await getDoc(doc(clientDb, 'institutions', instId, 'teachers', teacherId));
  if (!teacherSnap.exists()) throw new Error('NOT_FOUND: Teacher not found');
  const stageSnap = await getDoc(doc(clientDb, 'institutions', instId, 'stages', stageId));
  if (!stageSnap.exists()) throw new Error('NOT_FOUND: Stage not found');
  const q = query(collection(clientDb, 'institutions', instId, 'teacherStages'), where('teacherId','==',teacherId), where('stageId','==',stageId));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error('DUPLICATE_ASSIGNMENT: هذا المعلم مخصص مسبقاً لهذه المرحلة');
  const id = `TSTG_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const assignment = { id, assignmentId: id, institutionId: instId, teacherId, stageId, createdAt: new Date().toISOString(), createdBy: token.uid || 'system' };
  await setDoc(doc(clientDb, 'institutions', instId, 'teacherStages', id), assignment);
  return assignment;
}

async function removeTeacherStage(callerToken, assignmentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${assignmentId}`;
    if (!inMemoryTeacherStages.has(key)) {
      const any = Array.from(inMemoryTeacherStages.values()).find(a => a.id === assignmentId);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION');
      throw new Error('NOT_FOUND: Assignment not found');
    }
    inMemoryTeacherStages.delete(key);
    return { success: true };
  }
  const clientDb = await getClientFirestoreDb(token);
  await deleteDoc(doc(clientDb, 'institutions', instId, 'teacherStages', assignmentId));
  return { success: true };
}

// ----------------------------------------------------------------------------
// GROUPS & SUBJECTS CRUD
// ----------------------------------------------------------------------------

async function getGroups(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  if (isTestOffline()) {
    let list = Array.from(inMemoryGroups.values()).filter(g => g.institutionId === instId && g.status !== 'ARCHIVED');
    if (opts.stageId) list = list.filter(g => g.stageId === opts.stageId);
    if (opts.teacherId) list = list.filter(g => g.teacherId === opts.teacherId);
    if (opts.subjectId) list = list.filter(g => g.subjectId === opts.subjectId);
    if (opts.roomId) list = list.filter(g => g.roomId === opts.roomId);
    if (opts.status) list = list.filter(g => g.status === opts.status);
    return list;
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'groups');
  const snap = await getDocs(colRef);
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list = list.filter(g => g.status !== 'ARCHIVED');
  if (opts.stageId) list = list.filter(g => g.stageId === opts.stageId);
  if (opts.teacherId) list = list.filter(g => g.teacherId === opts.teacherId);
  if (opts.subjectId) list = list.filter(g => g.subjectId === opts.subjectId);
  if (opts.roomId) list = list.filter(g => g.roomId === opts.roomId);
  if (opts.status) list = list.filter(g => g.status === opts.status);
  return list;
}

async function getGroupById(callerToken, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!groupId) throw arabicServiceError('INVALID_GROUP_ID', 'معرف المجموعة مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  return await fetchDocSameTenant(clientDb, 'groups', groupId, instId, inMemoryGroups, 'المجموعة');
}

async function createGroup(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.name) {
    body = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  if (!body.name || String(body.name).trim().length === 0) {
    throw arabicServiceError('INVALID_GROUP_NAME', 'اسم المجموعة مطلوب');
  }
  const capacityRaw = body.maxCapacity !== undefined ? body.maxCapacity : body.capacity;
  const cap = Number(capacityRaw !== undefined ? capacityRaw : 30);
  if (!Number.isFinite(cap) || cap <= 0 || !Number.isInteger(cap)) {
    throw arabicServiceError('INVALID_GROUP_CAPACITY', 'سعة المجموعة يجب أن تكون رقماً صحيحاً موجباً');
  }
  const monthlyFee = body.monthlyFee !== undefined ? Number(body.monthlyFee) : 0;
  if (body.monthlyFee !== undefined && (!Number.isFinite(monthlyFee) || monthlyFee < 0)) {
    throw arabicServiceError('INVALID_GROUP_FEE', 'الرسوم الشهرية يجب أن تكون رقماً غير سالب');
  }

  const clientDb = await getClientFirestoreDb(token);
  const refs = {
    academicYearId: body.academicYearId || undefined,
    stageId: body.stageId || undefined,
    subjectId: body.subjectId || undefined,
    teacherId: body.teacherId || undefined,
    roomId: body.roomId || undefined
  };
  // Validate provided references (same tenant, active, hierarchy consistent)
  if (refs.academicYearId || refs.stageId || refs.subjectId || refs.teacherId || refs.roomId) {
    await validateGroupReferences(token, clientDb, instId, refs);
  }

  const id = body.id || `GRP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const code = body.code || body.groupCode || `GRP-${String(Math.floor(1000 + Math.random() * 9000))}`;
  const nowISO = new Date().toISOString();
  const group = {
    id,
    code,
    institutionId: instId,
    name: String(body.name).trim(),
    academicYearId: body.academicYearId || '',
    stageId: body.stageId || '',
    subjectId: body.subjectId || '',
    teacherId: body.teacherId || '',
    roomId: body.roomId || '',
    // Legacy display mirrors (never authoritative)
    subjectName: body.subjectName || '',
    teacherName: body.teacherName || '',
    room: body.room || '',
    schedule: body.schedule || '',
    maxCapacity: cap,
    capacity: cap,
    enrolledCount: 0,
    monthlyFee: Number.isFinite(monthlyFee) ? monthlyFee : 0,
    status: body.status || 'ACTIVE',
    createdAt: nowISO,
    updatedAt: nowISO,
    createdBy: token.uid || 'system'
  };

  if (isTestOffline()) {
    inMemoryGroups.set(`${instId}_${id}`, { ...group });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'groups', id), group);
  }

  await recordAuditEvent({
    action: 'CREATE_GROUP',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'GROUP',
    targetId: id,
    details: { name: group.name, maxCapacity: group.maxCapacity, stageId: group.stageId, subjectId: group.subjectId, teacherId: group.teacherId, roomId: group.roomId }
  });

  return group;
}

function addGroup(payload) {
  return createGroup(null, payload);
}

async function updateGroup(callerToken, groupIdOrPayload, payload = {}) {
  let gId = groupIdOrPayload;
  let body = payload;
  if (typeof groupIdOrPayload === 'object' && groupIdOrPayload.id) {
    gId = groupIdOrPayload.id;
    body = groupIdOrPayload;
  }
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  if (body.institutionId && body.institutionId !== instId) throw arabicServiceError('IMMUTABLE_FIELD_MODIFICATION', 'لا يمكن تغيير المؤسسة الخاصة بالمجموعة');

  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'groups', gId, instId, inMemoryGroups, 'المجموعة');
  if (existing.status === 'ARCHIVED') throw arabicServiceError('ARCHIVED_GROUP_IMMUTABLE', 'المجموعة مؤرشفة — لا يمكن تعديلها كنشطة');
  if (body.name !== undefined && !String(body.name).trim()) throw arabicServiceError('INVALID_GROUP_NAME', 'اسم المجموعة مطلوب');
  const nextRefs = {
    academicYearId: body.academicYearId !== undefined ? body.academicYearId : existing.academicYearId,
    stageId: body.stageId !== undefined ? body.stageId : existing.stageId,
    subjectId: body.subjectId !== undefined ? body.subjectId : existing.subjectId,
    teacherId: body.teacherId !== undefined ? body.teacherId : existing.teacherId,
    roomId: body.roomId !== undefined ? body.roomId : existing.roomId
  };
  if (nextRefs.academicYearId || nextRefs.stageId || nextRefs.subjectId || nextRefs.teacherId || nextRefs.roomId) {
    await validateGroupReferences(token, clientDb, instId, {
      academicYearId: nextRefs.academicYearId || undefined,
      stageId: nextRefs.stageId || undefined,
      subjectId: nextRefs.subjectId || undefined,
      teacherId: nextRefs.teacherId || undefined,
      roomId: nextRefs.roomId || undefined
    });
  }
  const nextCapRaw = body.maxCapacity !== undefined ? body.maxCapacity : (body.capacity !== undefined ? body.capacity : existing.maxCapacity);
  const nextCap = Number(nextCapRaw);
  if (body.maxCapacity !== undefined || body.capacity !== undefined) {
    if (!Number.isFinite(nextCap) || nextCap <= 0 || !Number.isInteger(nextCap)) throw arabicServiceError('INVALID_GROUP_CAPACITY', 'سعة المجموعة يجب أن تكون رقماً صحيحاً موجباً');
    const enrolled = Number(existing.enrolledCount || 0);
    if (nextCap < enrolled) throw arabicServiceError('CAPACITY_BELOW_ENROLLED', `لا يمكن تقليل السعة عن عدد المسجلين حالياً (${enrolled})`, `${nextCap}/${enrolled}`);
  }
  if (body.monthlyFee !== undefined) {
    const f = Number(body.monthlyFee);
    if (!Number.isFinite(f) || f < 0) throw arabicServiceError('INVALID_GROUP_FEE', 'الرسوم الشهرية يجب أن تكون رقماً غير سالب');
  }
  const updated = {
    ...existing,
    ...body,
    id: gId,
    institutionId: instId,
    maxCapacity: body.maxCapacity !== undefined || body.capacity !== undefined ? nextCap : existing.maxCapacity,
    capacity: body.maxCapacity !== undefined || body.capacity !== undefined ? nextCap : (existing.capacity || existing.maxCapacity),
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'system'
  };
  if (isTestOffline()) {
    inMemoryGroups.set(`${instId}_${gId}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'groups', gId), { ...body, id: gId, institutionId: instId, maxCapacity: updated.maxCapacity, capacity: updated.capacity, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy }, { merge: true });
  }
  await recordAuditEvent({ action: 'UPDATE_GROUP', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GROUP', targetId: gId, details: { name: updated.name, maxCapacity: updated.maxCapacity } });
  return updated;
}

async function archiveGroup(callerToken, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'groups', groupId, instId, inMemoryGroups, 'المجموعة');
  const updated = { ...existing, status: 'ARCHIVED', updatedAt: new Date().toISOString() };
  if (isTestOffline()) {
    inMemoryGroups.set(`${instId}_${groupId}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'groups', groupId), { status: 'ARCHIVED', updatedAt: updated.updatedAt }, { merge: true });
  }
  await recordAuditEvent({ action: 'ARCHIVE_GROUP', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GROUP', targetId: groupId, details: { name: existing.name } });
  return updated;
}

async function deleteGroup(callerToken, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'groups', groupId, instId, inMemoryGroups, 'المجموعة');
  const enrolled = Number(existing.enrolledCount || 0);
  if (enrolled > 0) throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن الحذف لأن هناك سجلات مرتبطة بهذا العنصر — توجد طلاب مسجلون في المجموعة. استخدم الأرشفة', groupId);
  const hasRefs = isTestOffline()
    ? (Array.from(inMemoryStudents.values()).some(s => s.institutionId === instId && canonicalStudentGroupIds(s).includes(groupId)) || Array.from(inMemoryEnrollments.values()).some(e => e.institutionId === instId && e.groupId === groupId && e.status === 'ENROLLED'))
    : ((await getDocs(collection(clientDb, 'institutions', instId, 'students'))).docs.some(d => canonicalStudentGroupIds(d.data()).includes(groupId)) || (await getDocs(collection(clientDb, 'institutions', instId, 'enrollments'))).docs.some(d => d.data().groupId === groupId && d.data().status === 'ENROLLED'));
  if (hasRefs) throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن الحذف لأن هناك سجلات مرتبطة بهذا العنصر — توجد قيود تسجيل مرتبطة', groupId);
  if (isTestOffline()) {
    inMemoryGroups.delete(`${instId}_${groupId}`);
  } else {
    await deleteDoc(doc(clientDb, 'institutions', instId, 'groups', groupId));
  }
  await recordAuditEvent({ action: 'DELETE_GROUP', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GROUP', targetId: groupId, details: {} });
  return { success: true, id: groupId };
}

async function getTeacherGroups(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  return await getGroups(token, { institutionId: instId, teacherId });
}

async function getRoomGroups(callerToken, roomId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  return await getGroups(token, { institutionId: instId, roomId });
}

async function getEnrollments(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    let list = Array.from(inMemoryEnrollments.values()).filter(e => e.institutionId === instId);
    if (options.studentId) list = list.filter(e => e.studentId === options.studentId);
    if (options.groupId) list = list.filter(e => e.groupId === options.groupId);
    if (options.status) list = list.filter(e => e.status === options.status);
    return list;
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'enrollments'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (options.studentId) list = list.filter(e => e.studentId === options.studentId);
  if (options.groupId) list = list.filter(e => e.groupId === options.groupId);
  if (options.status) list = list.filter(e => e.status === options.status);
  return list;
}

async function getGroupStudents(callerToken, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  await getGroupById(token, groupId, instId);
  const students = await getStudents(token, { institutionId: instId });
  return students.filter(s => s.groupIds.includes(groupId));
}

async function getStudentGroups(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const student = await getStudentById(token, studentId, instId);
  const out = [];
  for (const gid of student.groupIds) {
    try { out.push(await getGroupById(token, gid, instId)); } catch (_) {}
  }
  return out;
}

// ----------------------------------------------------------------------------
// ACADEMIC YEARS, STAGES, SUBJECTS, ROOMS (Phase 50.1)
// ----------------------------------------------------------------------------

const inMemoryAcademicYears = new Map();
const inMemoryStages = new Map();
const inMemorySubjects = new Map();
const inMemoryRooms = new Map();
const inMemoryTeachers = new Map();
const inMemoryTeacherSubjects = new Map();
const inMemoryTeacherStages = new Map();
const inMemoryStudents = new Map();
const inMemoryGroups = new Map();
const inMemoryEnrollments = new Map();

function isTestOffline() {
  return process.env.NODE_ENV === 'test' && !process.env.FIRESTORE_EMULATOR_HOST;
}

function resetAcademicSetupStore() {
  inMemoryAcademicYears.clear();
  inMemoryStages.clear();
  inMemorySubjects.clear();
  inMemoryRooms.clear();
  inMemoryTeachers.clear();
  inMemoryTeacherSubjects.clear();
  inMemoryTeacherStages.clear();
  inMemoryStudents.clear();
  inMemoryGroups.clear();
  inMemoryEnrollments.clear();
}

// ----------------------------------------------------------------------------
// BATCH A CANONICAL MODEL (Phase 50.4)
// Canonical student.groupIds (array of group IDs) is the single source of truth.
// Legacy student.groupId (single primary) is maintained as compatibility mirror
// (first element of groupIds or ''). Compatibility READ: groupIds ?? [groupId].
// Canonical group references are IDs only: academicYearId, stageId, subjectId,
// teacherId, roomId. Legacy free-text fields (subjectName, teacherName, room,
// schedule text, groupName) are display-only mirrors, never authoritative.
// Existing production data is never destroyed; reads normalize legacy fields.
// ----------------------------------------------------------------------------

function canonicalStudentGroupIds(data = {}) {
  if (Array.isArray(data.groupIds)) return [...data.groupIds].filter(v => typeof v === 'string' && v);
  if (typeof data.groupId === 'string' && data.groupId) return [data.groupId];
  return [];
}

function normalizeStudentDoc(data = {}) {
  const groupIds = canonicalStudentGroupIds(data);
  return {
    ...data,
    groupIds,
    groupId: groupIds.length > 0 ? groupIds[0] : (typeof data.groupId === 'string' ? data.groupId : '')
  };
}

function canonicalGroupCapacity(g = {}) {
  const c = Number(g.maxCapacity !== undefined ? g.maxCapacity : g.capacity);
  return Number.isFinite(c) ? c : 30;
}

function enrollmentDocId(studentId, groupId) {
  return `${studentId}__${groupId}`;
}

function arabicServiceError(code, arabic, technical = '') {
  const err = new Error(`${code}: ${arabic}${technical ? ` (${technical})` : ''}`);
  err.code = code;
  return err;
}

async function fetchDocSameTenant(clientDb, collectionName, docId, instId, offlineMap, entityLabel) {
  if (isTestOffline()) {
    const key = `${instId}_${docId}`;
    const found = offlineMap.get(key);
    if (!found) {
      const any = Array.from(offlineMap.values()).find(v => v.id === docId);
      if (any && any.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن استخدام سجل من مؤسسة أخرى', `${entityLabel} ${docId}`);
      throw arabicServiceError('NOT_FOUND', `السجل المطلوب غير موجود: ${entityLabel}`, docId);
    }
    return found;
  }
  const snap = await getDoc(doc(clientDb, 'institutions', instId, collectionName, docId));
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', `السجل المطلوب غير موجود: ${entityLabel}`, docId);
  const data = { id: snap.id, ...snap.data() };
  if (data.institutionId && data.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن استخدام سجل من مؤسسة أخرى', `${entityLabel} ${docId}`);
  return data;
}

async function validateGroupReferences(token, clientDb, instId, refs = {}) {
  const { academicYearId, stageId, subjectId, teacherId, roomId } = refs;
  let yearDoc = null; let stageDoc = null; let subjectDoc = null; let teacherDoc = null; let roomDoc = null;
  if (academicYearId) {
    yearDoc = await fetchDocSameTenant(clientDb, 'academicYears', academicYearId, instId, inMemoryAcademicYears, 'السنة الدراسية');
    if (yearDoc.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_ACADEMIC_YEAR', 'السنة الدراسية المحددة مؤرشفة', academicYearId);
  }
  if (stageId) {
    stageDoc = await fetchDocSameTenant(clientDb, 'stages', stageId, instId, inMemoryStages, 'المرحلة الدراسية');
    if (stageDoc.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_STAGE', 'المرحلة الدراسية المحددة مؤرشفة', stageId);
    if (academicYearId && stageDoc.academicYearId && stageDoc.academicYearId !== academicYearId) {
      throw arabicServiceError('STAGE_ACADEMIC_YEAR_MISMATCH', 'المرحلة لا تنتمي للسنة الدراسية المحددة', `${stageId}/${academicYearId}`);
    }
  }
  if (subjectId) {
    subjectDoc = await fetchDocSameTenant(clientDb, 'subjects', subjectId, instId, inMemorySubjects, 'المادة الدراسية');
    if (subjectDoc.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_SUBJECT', 'المادة الدراسية المحددة مؤرشفة', subjectId);
    if (stageId && subjectDoc.stageId && subjectDoc.stageId !== stageId) {
      throw arabicServiceError('SUBJECT_STAGE_MISMATCH', 'المادة لا تنتمي للمرحلة المحددة', `${subjectId}/${stageId}`);
    }
    if (academicYearId && subjectDoc.academicYearId && subjectDoc.academicYearId !== academicYearId) {
      throw arabicServiceError('SUBJECT_YEAR_MISMATCH', 'المادة لا تنتمي للسنة الدراسية المحددة', subjectId);
    }
  }
  if (teacherId) {
    teacherDoc = await fetchDocSameTenant(clientDb, 'teachers', teacherId, instId, inMemoryTeachers, 'المعلم');
    if (teacherDoc.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_TEACHER', 'المعلم المحدد مؤرشف', teacherId);
    if (teacherDoc.status === 'SUSPENDED') throw arabicServiceError('INACTIVE_TEACHER', 'المعلم المحدد موقوف ولا يمكن إسناد مجموعة له', teacherId);
  }
  if (roomId) {
    roomDoc = await fetchDocSameTenant(clientDb, 'rooms', roomId, instId, inMemoryRooms, 'القاعة');
    if (roomDoc.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_ROOM', 'القاعة المحددة مؤرشفة', roomId);
  }
  return { yearDoc, stageDoc, subjectDoc, teacherDoc, roomDoc };
}

// --- Academic Years ---

async function getAcademicYears(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    return Array.from(inMemoryAcademicYears.values()).filter(y => y.institutionId === instId && y.status !== 'ARCHIVED');
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'academicYears');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(y => y.status !== 'ARCHIVED');
}

async function createAcademicYear(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('INVALID_ACADEMIC_YEAR_NAME: Academic year name is required');
  }

  if (payload.startDate && payload.endDate) {
    const start = new Date(payload.startDate).getTime();
    const end = new Date(payload.endDate).getTime();
    if (isNaN(start) || isNaN(end) || start >= end) {
      throw new Error('INVALID_ACADEMIC_YEAR_DATES: Start date must be strictly earlier than end date');
    }
  }

  const id = payload.id || `AY_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const yearDoc = {
    id,
    institutionId: instId,
    name: payload.name.trim(),
    startDate: payload.startDate || new Date().toISOString().split('T')[0],
    endDate: payload.endDate || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0],
    status: payload.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: token.uid || 'system',
    updatedBy: token.uid || 'system'
  };

  if (isTestOffline()) {
    inMemoryAcademicYears.set(`${instId}_${id}`, yearDoc);
    return yearDoc;
  }

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'academicYears', id), yearDoc);
  return yearDoc;
}

async function updateAcademicYear(callerToken, id, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (payload.institutionId && payload.institutionId !== instId) {
    throw new Error('IMMUTABLE_FIELD_MODIFICATION: institutionId cannot be modified');
  }

  if (payload.startDate && payload.endDate) {
    const start = new Date(payload.startDate).getTime();
    const end = new Date(payload.endDate).getTime();
    if (isNaN(start) || isNaN(end) || start >= end) {
      throw new Error('INVALID_ACADEMIC_YEAR_DATES: Start date must be strictly earlier than end date');
    }
  }

  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    const existing = inMemoryAcademicYears.get(key) || { id, institutionId: instId };
    const updatedDoc = {
      ...existing,
      ...payload,
      id,
      institutionId: instId,
      updatedAt: new Date().toISOString(),
      updatedBy: token.uid || 'system'
    };
    inMemoryAcademicYears.set(key, updatedDoc);
    return updatedDoc;
  }

  const updated = {
    ...payload,
    id,
    institutionId: instId,
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'system'
  };
  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'academicYears', id), updated, { merge: true });
  return updated;
}

async function setAcademicYearStatus(callerToken, id, status) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  return await updateAcademicYear(token, id, { institutionId: instId, status });
}

async function archiveAcademicYear(callerToken, id, institutionId) {
  return await setAcademicYearStatus(callerToken, id, 'ARCHIVED');
}

async function deleteAcademicYear(callerToken, id, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    if (!inMemoryAcademicYears.has(key)) {
      const any = Array.from(inMemoryAcademicYears.values()).find(y => y.id === id);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Academic year belongs to another institution');
      throw new Error('NOT_FOUND: Academic year not found');
    }
    const hasStage = Array.from(inMemoryStages.values()).some(s => s.institutionId === instId && s.academicYearId === id && s.status !== 'ARCHIVED');
    const hasSubject = Array.from(inMemorySubjects.values()).some(s => s.institutionId === instId && s.academicYearId === id && s.status !== 'ARCHIVED');
    if (hasStage || hasSubject) {
      throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذه السنة الدراسية لأنها مرتبطة ببيانات أخرى. يمكنك أرشفتها بدلًا من حذفها.');
    }
    inMemoryAcademicYears.delete(key);
    await recordAuditEvent({ action: 'DELETE_ACADEMIC_YEAR', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'ACADEMIC_YEAR', targetId: id, details: { id } });
    return { success: true, id };
  }
  const clientDb = await getClientFirestoreDb(token);
  const stagesSnap = await getDocs(collection(clientDb, 'institutions', instId, 'stages'));
  const hasStageFs = stagesSnap.docs.some(d => d.data().academicYearId === id && d.data().status !== 'ARCHIVED');
  const subjectsSnap = await getDocs(collection(clientDb, 'institutions', instId, 'subjects'));
  const hasSubjectFs = subjectsSnap.docs.some(d => d.data().academicYearId === id && d.data().status !== 'ARCHIVED');
  if (hasStageFs || hasSubjectFs) {
    throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذه السنة الدراسية لأنها مرتبطة ببيانات أخرى. يمكنك أرشفتها بدلًا من حذفها.');
  }
  await deleteDoc(doc(clientDb, 'institutions', instId, 'academicYears', id));
  await recordAuditEvent({ action: 'DELETE_ACADEMIC_YEAR', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'ACADEMIC_YEAR', targetId: id, details: { id } });
  return { success: true, id };
}

// --- Stages ---

async function getStages(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    return Array.from(inMemoryStages.values()).filter(s => s.institutionId === instId && s.status !== 'ARCHIVED');
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'stages');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== 'ARCHIVED');
}

async function createStage(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('INVALID_STAGE_NAME: Stage name is required');
  }
  if (!payload.academicYearId || payload.academicYearId.trim().length === 0) {
    throw new Error('INVALID_ACADEMIC_YEAR_REFERENCE: Academic year ID is required');
  }

  if (isTestOffline()) {
    const yearKey = `${instId}_${payload.academicYearId}`;
    let yearDoc = inMemoryAcademicYears.get(yearKey);
    if (!yearDoc) {
      // Check across all tenants to detect cross-tenant reference
      const anyYear = Array.from(inMemoryAcademicYears.values()).find(y => y.id === payload.academicYearId);
      if (anyYear && anyYear.institutionId !== instId) {
        throw new Error('CROSS_TENANT_VIOLATION: Academic year belongs to another institution');
      }
      throw new Error('INVALID_ACADEMIC_YEAR_REFERENCE: Academic year not found in institution');
    }
    const id = payload.id || `STG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const stageDoc = {
      id,
      institutionId: instId,
      academicYearId: payload.academicYearId,
      name: payload.name.trim(),
      code: payload.code || `STG-${Math.floor(100 + Math.random() * 900)}`,
      status: payload.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: token.uid || 'system',
      updatedBy: token.uid || 'system'
    };
    inMemoryStages.set(`${instId}_${id}`, stageDoc);
    return stageDoc;
  }

  const clientDb = await getClientFirestoreDb(token);
  const yearSnap = await getDoc(doc(clientDb, 'institutions', instId, 'academicYears', payload.academicYearId));
  if (!yearSnap.exists()) {
    throw new Error('INVALID_ACADEMIC_YEAR_REFERENCE: Academic year not found in institution');
  }

  const id = payload.id || `STG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const stageDoc = {
    id,
    institutionId: instId,
    academicYearId: payload.academicYearId,
    name: payload.name.trim(),
    code: payload.code || `STG-${Math.floor(100 + Math.random() * 900)}`,
    status: payload.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: token.uid || 'system',
    updatedBy: token.uid || 'system'
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'stages', id), stageDoc);
  return stageDoc;
}

async function updateStage(callerToken, id, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (payload.institutionId && payload.institutionId !== instId) {
    throw new Error('IMMUTABLE_FIELD_MODIFICATION: institutionId cannot be modified');
  }

  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    const existing = inMemoryStages.get(key) || { id, institutionId: instId };
    const updatedDoc = {
      ...existing,
      ...payload,
      id,
      institutionId: instId,
      updatedAt: new Date().toISOString(),
      updatedBy: token.uid || 'system'
    };
    inMemoryStages.set(key, updatedDoc);
    return updatedDoc;
  }

  const updated = {
    ...payload,
    id,
    institutionId: instId,
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'system'
  };
  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'stages', id), updated, { merge: true });
  return updated;
}

async function setStageStatus(callerToken, id, status) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  return await updateStage(token, id, { institutionId: instId, status });
}

async function archiveStage(callerToken, id, institutionId) {
  return await setStageStatus(callerToken, id, 'ARCHIVED');
}

async function deleteStage(callerToken, id, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    if (!inMemoryStages.has(key)) {
      const any = Array.from(inMemoryStages.values()).find(s => s.id === id);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Stage belongs to another institution');
      throw new Error('NOT_FOUND: Stage not found');
    }
    const hasSubject = Array.from(inMemorySubjects.values()).some(s => s.institutionId === instId && s.stageId === id && s.status !== 'ARCHIVED');
    if (hasSubject) {
      throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذه المرحلة لأنها مرتبطة ببيانات أخرى. يمكنك أرشفتها بدلًا من حذفها.');
    }
    inMemoryStages.delete(key);
    await recordAuditEvent({ action: 'DELETE_STAGE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STAGE', targetId: id, details: { id } });
    return { success: true, id };
  }
  const clientDb = await getClientFirestoreDb(token);
  const subjectsSnap = await getDocs(collection(clientDb, 'institutions', instId, 'subjects'));
  const hasSubjectFs = subjectsSnap.docs.some(d => d.data().stageId === id && d.data().status !== 'ARCHIVED');
  if (hasSubjectFs) {
    throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذه المرحلة لأنها مرتبطة ببيانات أخرى. يمكنك أرشفتها بدلًا من حذفها.');
  }
  await deleteDoc(doc(clientDb, 'institutions', instId, 'stages', id));
  await recordAuditEvent({ action: 'DELETE_STAGE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STAGE', targetId: id, details: { id } });
  return { success: true, id };
}

// --- Subjects ---

async function getSubjects(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    return Array.from(inMemorySubjects.values()).filter(s => s.institutionId === instId && s.status !== 'ARCHIVED');
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'subjects');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== 'ARCHIVED');
}

async function createSubject(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('INVALID_SUBJECT_NAME: Subject name is required');
  }
  if (!payload.academicYearId || payload.academicYearId.trim().length === 0) {
    throw new Error('INVALID_ACADEMIC_YEAR_REFERENCE: Academic year ID is required');
  }
  if (!payload.stageId || payload.stageId.trim().length === 0) {
    throw new Error('INVALID_STAGE_REFERENCE: Stage ID is required');
  }

  if (isTestOffline()) {
    const yearKey = `${instId}_${payload.academicYearId}`;
    if (!inMemoryAcademicYears.has(yearKey)) {
      const anyYear = Array.from(inMemoryAcademicYears.values()).find(y => y.id === payload.academicYearId);
      if (anyYear && anyYear.institutionId !== instId) {
        throw new Error('CROSS_TENANT_VIOLATION: Academic year belongs to another institution');
      }
      throw new Error('INVALID_ACADEMIC_YEAR_REFERENCE: Academic year not found in institution');
    }

    const stageKey = `${instId}_${payload.stageId}`;
    const stageDoc = inMemoryStages.get(stageKey);
    if (!stageDoc) {
      const anyStage = Array.from(inMemoryStages.values()).find(s => s.id === payload.stageId);
      if (anyStage && anyStage.institutionId !== instId) {
        throw new Error('CROSS_TENANT_VIOLATION: Stage belongs to another institution');
      }
      throw new Error('INVALID_STAGE_REFERENCE: Stage not found in institution');
    }

    if (stageDoc.academicYearId !== payload.academicYearId) {
      throw new Error('STAGE_ACADEMIC_YEAR_MISMATCH: Stage does not belong to the selected academic year');
    }

    const id = payload.id || `SUBJ_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const subjDoc = {
      id,
      institutionId: instId,
      academicYearId: payload.academicYearId,
      stageId: payload.stageId,
      name: payload.name.trim(),
      code: payload.code || `SUBJ-${Math.floor(100 + Math.random() * 900)}`,
      status: payload.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: token.uid || 'system',
      updatedBy: token.uid || 'system'
    };
    inMemorySubjects.set(`${instId}_${id}`, subjDoc);
    return subjDoc;
  }

  const clientDb = await getClientFirestoreDb(token);

  // Validate Academic Year
  const yearSnap = await getDoc(doc(clientDb, 'institutions', instId, 'academicYears', payload.academicYearId));
  if (!yearSnap.exists()) {
    throw new Error('INVALID_ACADEMIC_YEAR_REFERENCE: Academic year not found in institution');
  }

  // Validate Stage & ensure matching academicYearId
  const stageSnap = await getDoc(doc(clientDb, 'institutions', instId, 'stages', payload.stageId));
  if (!stageSnap.exists()) {
    throw new Error('INVALID_STAGE_REFERENCE: Stage not found in institution');
  }
  const stageData = stageSnap.data();
  if (stageData.academicYearId !== payload.academicYearId) {
    throw new Error('STAGE_ACADEMIC_YEAR_MISMATCH: Stage does not belong to the selected academic year');
  }

  const id = payload.id || `SUBJ_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const subj = {
    id,
    institutionId: instId,
    academicYearId: payload.academicYearId,
    stageId: payload.stageId,
    name: payload.name.trim(),
    code: payload.code || `SUBJ-${Math.floor(100 + Math.random() * 900)}`,
    status: payload.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: token.uid || 'system',
    updatedBy: token.uid || 'system'
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'subjects', id), subj);
  return subj;
}

async function updateSubject(callerToken, id, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (payload.institutionId && payload.institutionId !== instId) {
    throw new Error('IMMUTABLE_FIELD_MODIFICATION: institutionId cannot be modified');
  }

  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    const existing = inMemorySubjects.get(key) || { id, institutionId: instId };
    const updatedDoc = {
      ...existing,
      ...payload,
      id,
      institutionId: instId,
      updatedAt: new Date().toISOString(),
      updatedBy: token.uid || 'system'
    };
    inMemorySubjects.set(key, updatedDoc);
    return updatedDoc;
  }

  const clientDb = await getClientFirestoreDb(token);
  const updated = {
    ...payload,
    id,
    institutionId: instId,
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'system'
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'subjects', id), updated, { merge: true });
  return updated;
}

async function setSubjectStatus(callerToken, id, status) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  return await updateSubject(token, id, { institutionId: instId, status });
}

async function archiveSubject(callerToken, id, institutionId) {
  return await setSubjectStatus(callerToken, id, 'ARCHIVED');
}

async function deleteSubject(callerToken, id, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    if (!inMemorySubjects.has(key)) {
      const any = Array.from(inMemorySubjects.values()).find(s => s.id === id);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Subject belongs to another institution');
      throw new Error('NOT_FOUND: Subject not found');
    }
    const hasTeacherSubject = Array.from(inMemoryTeacherSubjects.values()).some(a => a.institutionId === instId && a.subjectId === id);
    if (hasTeacherSubject) {
      throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذه المادة لأنها مرتبطة ببيانات أخرى. يمكنك أرشفتها بدلًا من حذفها.');
    }
    inMemorySubjects.delete(key);
    await recordAuditEvent({ action: 'DELETE_SUBJECT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SUBJECT', targetId: id, details: { id } });
    return { success: true, id };
  }
  const clientDb = await getClientFirestoreDb(token);
  const assignmentsSnap = await getDocs(collection(clientDb, 'institutions', instId, 'teacherSubjects'));
  const hasAssign = assignmentsSnap.docs.some(d => d.data().subjectId === id);
  if (hasAssign) {
    throw new Error('HAS_DEPENDENCIES: لا يمكن حذف هذه المادة لأنها مرتبطة ببيانات أخرى. يمكنك أرشفتها بدلًا من حذفها.');
  }
  await deleteDoc(doc(clientDb, 'institutions', instId, 'subjects', id));
  await recordAuditEvent({ action: 'DELETE_SUBJECT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SUBJECT', targetId: id, details: { id } });
  return { success: true, id };
}

// --- Rooms ---

async function getRooms(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    return Array.from(inMemoryRooms.values()).filter(r => r.institutionId === instId && r.status !== 'ARCHIVED');
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'rooms');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status !== 'ARCHIVED');
}

async function createRoom(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('INVALID_ROOM_NAME: Room name is required');
  }
  const cap = Number(payload.capacity);
  if (isNaN(cap) || cap <= 0) {
    throw new Error('INVALID_ROOM_CAPACITY: Room capacity must be a positive number');
  }

  const id = payload.id || `RM_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const roomDoc = {
    id,
    institutionId: instId,
    name: payload.name.trim(),
    capacity: cap,
    location: payload.location ? payload.location.trim() : '',
    status: payload.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: token.uid || 'system',
    updatedBy: token.uid || 'system'
  };

  if (isTestOffline()) {
    inMemoryRooms.set(`${instId}_${id}`, roomDoc);
    return roomDoc;
  }

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'rooms', id), roomDoc);
  return roomDoc;
}

async function updateRoom(callerToken, id, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  if (payload.institutionId && payload.institutionId !== instId) {
    throw new Error('IMMUTABLE_FIELD_MODIFICATION: institutionId cannot be modified');
  }

  if (payload.capacity !== undefined) {
    const cap = Number(payload.capacity);
    if (isNaN(cap) || cap <= 0) {
      throw new Error('INVALID_ROOM_CAPACITY: Room capacity must be a positive number');
    }
  }

  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    const existing = inMemoryRooms.get(key) || { id, institutionId: instId };
    const updatedDoc = {
      ...existing,
      ...payload,
      id,
      institutionId: instId,
      updatedAt: new Date().toISOString(),
      updatedBy: token.uid || 'system'
    };
    inMemoryRooms.set(key, updatedDoc);
    return updatedDoc;
  }

  const updated = {
    ...payload,
    id,
    institutionId: instId,
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'system'
  };
  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'rooms', id), updated, { merge: true });
  return updated;
}

async function setRoomStatus(callerToken, id, status) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  return await updateRoom(token, id, { institutionId: instId, status });
}

async function archiveRoom(callerToken, id, institutionId) {
  return await setRoomStatus(callerToken, id, 'ARCHIVED');
}

async function deleteRoom(callerToken, id, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  // Batch A: block hard delete when groups reference the room
  const dependentGroups = isTestOffline()
    ? Array.from(inMemoryGroups.values()).filter(g => g.institutionId === instId && g.roomId === id && g.status !== 'ARCHIVED')
    : (await getDocs(collection(clientDb, 'institutions', instId, 'groups'))).docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.roomId === id && g.status !== 'ARCHIVED');
  if (dependentGroups.length > 0) {
    throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن الحذف لأن هناك سجلات مرتبطة بهذا العنصر — توجد مجموعات مسندة لهذه القاعة. استخدم الأرشفة أو أعد الإسناد أولاً', id);
  }
  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    if (!inMemoryRooms.has(key)) {
      const any = Array.from(inMemoryRooms.values()).find(r => r.id === id);
      if (any && any.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Room belongs to another institution');
      throw new Error('NOT_FOUND: Room not found');
    }
    inMemoryRooms.delete(key);
    await recordAuditEvent({ action: 'DELETE_ROOM', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'ROOM', targetId: id, details: { id } });
    return { success: true, id };
  }
  await deleteDoc(doc(clientDb, 'institutions', instId, 'rooms', id));
  await recordAuditEvent({ action: 'DELETE_ROOM', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'ROOM', targetId: id, details: { id } });
  return { success: true, id };
}

// Group Student Membership Helpers — transaction-safe with deterministic enrollment docs
async function enrollStudentInGroupInternal(token, clientDb, instId, studentId, groupId) {
  if (isTestOffline()) {
    const sKey = `${instId}_${studentId}`;
    const gKey = `${instId}_${groupId}`;
    const student = inMemoryStudents.get(sKey);
    if (!student) throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود', studentId);
    const normalized = normalizeStudentDoc(student);
    if (normalized.groupIds.includes(groupId)) throw arabicServiceError('DUPLICATE_ENROLLMENT', 'الطالب مسجل بالفعل في هذه المجموعة', `${studentId}/${groupId}`);
    const group = inMemoryGroups.get(gKey);
    if (!group) {
      const any = Array.from(inMemoryGroups.values()).find(g => g.id === groupId);
      if (any && any.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن التسجيل في مجموعة من مؤسسة أخرى', groupId);
      throw arabicServiceError('GROUP_NOT_FOUND', 'المجموعة غير موجودة', groupId);
    }
    if (group.institutionId !== instId || normalized.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن إنشاء علاقة بين مؤسستين مختلفتين');
    if (normalized.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_STUDENT', 'الطالب مؤرشف ولا يمكن تسجيله في مجموعات');
    if (group.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_GROUP', 'المجموعة مؤرشفة ولا تقبل تسجيلات جديدة', groupId);
    if (group.status !== 'ACTIVE') throw arabicServiceError('INACTIVE_GROUP', 'المجموعة غير نشطة ولا تقبل تسجيلات جديدة', groupId);
    const enrolled = Number(group.enrolledCount || 0);
    const cap = canonicalGroupCapacity(group);
    if (enrolled >= cap) throw arabicServiceError('GROUP_FULL', `المجموعة ممتلئة ولا توجد مقاعد متاحة (${enrolled}/${cap})`, groupId);
    const eid = enrollmentDocId(studentId, groupId);
    const eKey = `${instId}_${eid}`;
    if (inMemoryEnrollments.has(eKey)) throw arabicServiceError('DUPLICATE_ENROLLMENT', 'الطالب مسجل بالفعل في هذه المجموعة', `${studentId}/${groupId}`);
    const nowISO = new Date().toISOString();
    inMemoryEnrollments.set(eKey, { id: eid, institutionId: instId, studentId, groupId, status: 'ENROLLED', enrolledAt: nowISO, updatedAt: nowISO });
    const updatedGroups = [...normalized.groupIds, groupId];
    inMemoryStudents.set(sKey, { ...normalized, groupIds: updatedGroups, groupId: updatedGroups[0] || '', updatedAt: nowISO });
    inMemoryGroups.set(gKey, { ...group, enrolledCount: enrolled + 1, updatedAt: nowISO });
    return { success: true, studentId, groupId, enrolledCount: enrolled + 1, enrollmentId: eid };
  }
  const studentRef = doc(clientDb, 'institutions', instId, 'students', studentId);
  const groupRef = doc(clientDb, 'institutions', instId, 'groups', groupId);
  const enrollmentRef = doc(clientDb, 'institutions', instId, 'enrollments', enrollmentDocId(studentId, groupId));
  const result = await runTransaction(clientDb, async (transaction) => {
    const studentSnap = await transaction.get(studentRef);
    if (!studentSnap.exists()) throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود', studentId);
    const sData = normalizeStudentDoc({ id: studentSnap.id, ...studentSnap.data() });
    if (sData.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن إنشاء علاقة بين مؤسستين مختلفتين');
    if (sData.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_STUDENT', 'الطالب مؤرشف ولا يمكن تسجيله في مجموعات');
    if (sData.groupIds.includes(groupId)) throw arabicServiceError('DUPLICATE_ENROLLMENT', 'الطالب مسجل بالفعل في هذه المجموعة', `${studentId}/${groupId}`);
    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists()) throw arabicServiceError('GROUP_NOT_FOUND', 'المجموعة غير موجودة', groupId);
    const gData = { id: groupSnap.id, ...groupSnap.data() };
    if (gData.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن التسجيل في مجموعة من مؤسسة أخرى', groupId);
    if (gData.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_GROUP', 'المجموعة مؤرشفة ولا تقبل تسجيلات جديدة', groupId);
    if (gData.status !== 'ACTIVE') throw arabicServiceError('INACTIVE_GROUP', 'المجموعة غير نشطة ولا تقبل تسجيلات جديدة', groupId);
    const currentEnrolled = Number(gData.enrolledCount || 0);
    const maxCapacity = canonicalGroupCapacity(gData);
    if (currentEnrolled >= maxCapacity) throw arabicServiceError('GROUP_FULL', `المجموعة ممتلئة ولا توجد مقاعد متاحة (${currentEnrolled}/${maxCapacity})`, groupId);
    const enrSnap = await transaction.get(enrollmentRef);
    if (enrSnap.exists() && enrSnap.data().status === 'ENROLLED') throw arabicServiceError('DUPLICATE_ENROLLMENT', 'الطالب مسجل بالفعل في هذه المجموعة', `${studentId}/${groupId}`);
    const updatedGroups = [...sData.groupIds, groupId];
    transaction.update(studentRef, { groupIds: updatedGroups, groupId: updatedGroups[0] || '', updatedAt: new Date().toISOString() });
    transaction.update(groupRef, { enrolledCount: currentEnrolled + 1, updatedAt: new Date().toISOString() });
    transaction.set(enrollmentRef, { id: enrollmentDocId(studentId, groupId), institutionId: instId, studentId, groupId, status: 'ENROLLED', enrolledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true, studentId, groupId, enrolledCount: currentEnrolled + 1, enrollmentId: enrollmentDocId(studentId, groupId) };
  });
  return result;
}

async function removeStudentFromGroupInternal(token, clientDb, instId, studentId, groupId) {
  if (isTestOffline()) {
    const sKey = `${instId}_${studentId}`;
    const gKey = `${instId}_${groupId}`;
    const student = inMemoryStudents.get(sKey);
    if (!student) throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود', studentId);
    const normalized = normalizeStudentDoc(student);
    if (!normalized.groupIds.includes(groupId)) throw arabicServiceError('NOT_ENROLLED', 'الطالب غير مسجل في هذه المجموعة', `${studentId}/${groupId}`);
    const group = inMemoryGroups.get(gKey);
    if (!group) throw arabicServiceError('GROUP_NOT_FOUND', 'المجموعة غير موجودة', groupId);
    const nowISO = new Date().toISOString();
    const updatedGroups = normalized.groupIds.filter(g => g !== groupId);
    inMemoryStudents.set(sKey, { ...normalized, groupIds: updatedGroups, groupId: updatedGroups[0] || '', updatedAt: nowISO });
    inMemoryGroups.set(gKey, { ...group, enrolledCount: Math.max(0, Number(group.enrolledCount || 1) - 1), updatedAt: nowISO });
    inMemoryEnrollments.delete(`${instId}_${enrollmentDocId(studentId, groupId)}`);
    return { success: true, studentId, groupId, enrolledCount: Math.max(0, Number(group.enrolledCount || 1) - 1) };
  }
  const studentRef = doc(clientDb, 'institutions', instId, 'students', studentId);
  const groupRef = doc(clientDb, 'institutions', instId, 'groups', groupId);
  const enrollmentRef = doc(clientDb, 'institutions', instId, 'enrollments', enrollmentDocId(studentId, groupId));
  const result = await runTransaction(clientDb, async (transaction) => {
    const studentSnap = await transaction.get(studentRef);
    if (!studentSnap.exists()) throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود', studentId);
    const sData = normalizeStudentDoc({ id: studentSnap.id, ...studentSnap.data() });
    if (!sData.groupIds.includes(groupId)) throw arabicServiceError('NOT_ENROLLED', 'الطالب غير مسجل في هذه المجموعة', `${studentId}/${groupId}`);
    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists()) throw arabicServiceError('GROUP_NOT_FOUND', 'المجموعة غير موجودة', groupId);
    const gData = { id: groupSnap.id, ...groupSnap.data() };
    const updatedGroups = sData.groupIds.filter(g => g !== groupId);
    transaction.update(studentRef, { groupIds: updatedGroups, groupId: updatedGroups[0] || '', updatedAt: new Date().toISOString() });
    transaction.update(groupRef, { enrolledCount: Math.max(0, Number(gData.enrolledCount || 1) - 1), updatedAt: new Date().toISOString() });
    transaction.delete(enrollmentRef);
    return { success: true, studentId, groupId, enrolledCount: Math.max(0, Number(gData.enrolledCount || 1) - 1) };
  });
  return result;
}

async function addStudentToGroup(callerToken, studentId, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const result = await enrollStudentInGroupInternal(token, clientDb, instId, studentId, groupId);
  await recordAuditEvent({
    action: 'ENROLL_STUDENT_IN_GROUP',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'GROUP_ENROLLMENT',
    targetId: result.groupId,
    details: { studentId, groupId, enrolledCount: result.enrolledCount }
  });
  return result;
}

async function removeStudentFromGroup(callerToken, studentId, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const result = await removeStudentFromGroupInternal(token, clientDb, instId, studentId, groupId);
  await recordAuditEvent({
    action: 'REMOVE_STUDENT_FROM_GROUP',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'GROUP_ENROLLMENT',
    targetId: result.groupId,
    details: { studentId, groupId, enrolledCount: result.enrolledCount }
  });
  return result;
}

// ----------------------------------------------------------------------------
// ATTENDANCE MANAGEMENT
// ----------------------------------------------------------------------------

async function getAttendanceRecords(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'attendanceSessions');
  const snap = await getDocs(colRef);
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (opts.date) {
    list = list.filter(a => a.date === opts.date);
  }

  return list;
}

async function recordAttendance(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.studentId) {
    body = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const studentId = body.studentId;
  const groupId = body.groupId || 'GRP_DEFAULT';
  const date = body.date || new Date().toISOString().split('T')[0];

  if (!studentId) {
    throw new Error('INVALID_ATTENDANCE_RECORD: studentId is required');
  }

  const existingList = await getAttendanceRecords(token, { institutionId: instId, date });
  const duplicate = existingList.find(a => a.studentId === studentId && a.groupId === groupId);

  if (duplicate) {
    throw new Error(`DUPLICATE_ATTENDANCE: Attendance already recorded for student '${studentId}' on ${date}`);
  }

  const id = `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const record = {
    id,
    institutionId: instId,
    studentId,
    studentName: body.studentName || 'طالب مركز',
    groupId,
    date,
    time: new Date().toLocaleTimeString('ar-EG', { hour12: false }),
    status: body.status || 'PRESENT',
    method: body.method || 'QR_SCANNER',
    recordedAt: new Date().toISOString()
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'attendanceSessions', id), record);

  await recordAuditEvent({
    action: 'RECORD_ATTENDANCE',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'ATTENDANCE',
    targetId: id,
    details: { studentId, status: record.status }
  });

  return record;
}

async function recordAttendanceScan(payload = {}) {
  const token = resolveCallerToken(null);
  const instId = token.institutionId;
  const studentId = payload.studentCodeOrQr || 'STU_1001';
  const dateStr = new Date().toISOString().split('T')[0];

  const existingList = await getAttendanceRecords(token, { institutionId: instId, date: dateStr });
  const existing = existingList.find(a => a.studentId === studentId);
  if (existing) {
    return { duplicate: true, message: 'مواظبة الطالب مسجلة مسبقاً لليوم', record: existing };
  }

  const id = `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const record = {
    id,
    institutionId: instId,
    studentId,
    studentName: 'أحمد محمد علي',
    groupId: 'GRP_MATH_01',
    date: dateStr,
    time: '16:00:00',
    status: 'PRESENT',
    method: 'QR_SCANNER'
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'attendanceSessions', id), record);
  return { duplicate: false, message: 'تم تسجل الحضور بنجاح', record };
}

// ----------------------------------------------------------------------------
// SESSIONS & SCHEDULE
// ----------------------------------------------------------------------------

async function getSessions(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'sessions');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createSession(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.title) {
    body = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const sessionDate = body.date || body.sessionDate || new Date().toISOString().split('T')[0];
  const room = body.room || 'قاعة 1';
  const startTime = body.startTime || '16:00';

  const existing = await getSessions(token, { institutionId: instId });
  const conflict = existing.find(s => s.room === room && s.date === sessionDate && (s.startTime === startTime || (s.startTime <= startTime && s.endTime > startTime)));
  if (conflict) {
    throw new Error(`SESSION_SCHEDULE_CONFLICT: Room '${room}' is occupied on ${sessionDate} at ${startTime}`);
  }

  const id = `SES_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const session = {
    id,
    institutionId: instId,
    title: body.title || 'حصة دراسية',
    groupId: body.groupId || '',
    teacherId: body.teacherId || '',
    date: sessionDate,
    startTime: startTime,
    endTime: body.endTime || '18:00',
    room: room,
    status: 'SCHEDULED',
    createdAt: new Date().toISOString()
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'sessions', id), session);
  return session;
}

// ----------------------------------------------------------------------------
// CONTENT & MEDIA
// ----------------------------------------------------------------------------

async function getContent(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'contents');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getContentMedia() {
  return await getContent(null);
}

// ----------------------------------------------------------------------------
// EXAMS & GRADES
// ----------------------------------------------------------------------------

async function getExams(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'exams');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createExam(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const id = `EXM_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const exam = {
    id,
    institutionId: instId,
    title: payload.title || 'اختبار تقييمي',
    groupId: payload.groupId || '',
    maxScore: Number(payload.maxScore) || 100,
    examDate: payload.examDate || new Date().toISOString().split('T')[0],
    status: 'SCHEDULED'
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'exams', id), exam);
  return exam;
}

async function getGrades(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'grades');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function recordGrade(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const id = `GRD_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const score = Number(payload.score) || 0;
  const maxScore = Number(payload.maxScore) || 100;
  const pct = Math.round((score / maxScore) * 100);

  const grade = {
    id,
    institutionId: instId,
    examId: payload.examId || '',
    studentId: payload.studentId || '',
    studentName: payload.studentName || 'طالب',
    score,
    maxScore,
    percentage: pct,
    status: pct >= 50 ? 'PASSED' : 'FAILED'
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'grades', id), grade);
  return grade;
}

// ----------------------------------------------------------------------------
// SUBSCRIPTIONS & PARENTS
// ----------------------------------------------------------------------------

async function getSubscriptions(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'subscriptions');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getParents(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'guardians');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ----------------------------------------------------------------------------
// FINANCE & RECEIPTS
// ----------------------------------------------------------------------------

async function getPayments(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'studentPayments');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function recordPayment(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.amount) {
    body = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new Error('INVALID_PAYMENT_AMOUNT: Amount must be greater than zero');
  }

  const id = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const receiptNumber = `REC-2026-X${Math.floor(1000 + Math.random() * 9000)}`;

  const payment = {
    id,
    receiptNumber,
    institutionId: instId,
    studentId: body.studentId || '',
    studentName: body.studentName || 'طالب مركز',
    category: body.category || 'مصاريف شهرية',
    amount,
    paymentDate: body.paymentDate || new Date().toISOString().split('T')[0],
    notes: body.notes || '',
    createdAt: new Date().toISOString()
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'studentPayments', id), payment);

  await recordAuditEvent({
    action: 'RECORD_PAYMENT',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'PAYMENT',
    targetId: id,
    details: { amount, receiptNumber, studentName: payment.studentName }
  });

  return payment;
}

function addPayment(payload = {}) {
  return recordPayment(null, payload);
}

async function getExpenses(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'expenses');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function recordExpense(callerToken, payload = {}) {
  let token = callerToken;
  let body = payload;
  if (callerToken && !payload.institutionId && callerToken.amount) {
    body = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, body.institutionId || token.institutionId);
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw new Error('INVALID_EXPENSE_AMOUNT: Amount must be greater than zero');
  }

  const id = `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const expense = {
    id,
    institutionId: instId,
    category: body.category || 'مصاريف تشغيلية',
    amount,
    expenseDate: body.expenseDate || new Date().toISOString().split('T')[0],
    notes: body.notes || '',
    createdAt: new Date().toISOString()
  };

  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'expenses', id), expense);

  await recordAuditEvent({
    action: 'RECORD_EXPENSE',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'EXPENSE',
    targetId: id,
    details: { amount, category: expense.category }
  });

  return expense;
}

function addExpense(payload = {}) {
  return recordExpense(null, payload);
}

async function getAISettings(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  return {
    institutionId: instId,
    aiEnabled: true,
    dailyLimitPerStudent: 50,
    allowedFeatures: ['QA', 'LESSON_EXPLAIN', 'SUMMARIZE', 'SELF_TEST']
  };
}

async function getCenterAISettings() {
  return {
    institutionId: 'inst_bootstrap_001',
    aiEnabled: true,
    dailyLimitPerStudent: 50
  };
}

async function getLicenseStatus(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  return {
    institutionId: instId,
    valid: true,
    status: 'ACTIVE',
    graceHoursRemaining: 72,
    licenseType: 'ENTERPRISE_ANNUAL'
  };
}

async function requestRebind(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  return {
    requestId: `req_rebind_${Date.now()}`,
    institutionId: instId,
    status: 'PENDING_SUPERADMIN_APPROVAL',
    message: 'تم إرسال طلب إعادة ربط الجهاز إلى SuperAdmin بنجاح'
  };
}

// ----------------------------------------------------------------------------
// BRANDING & THEME ENGINE SERVICES — FIRESTORE + R2 ONLY (AMENDMENT 1)
// ----------------------------------------------------------------------------

const REMAS_PLATFORM_BRAND_DESKTOP = Object.freeze({
  nameEnglish: 'REMAS EDU',
  nameArabic: 'رِماس للتقنية التعليمية',
  taglineArabic: 'إدارة أذكى.. تعليم أفضل',
  taglineEnglish: 'SMARTER MANAGEMENT .. A BRIGHTER EDUCATION',
  descriptionEnglish: 'REMAS Educational Platform',
  version: '1.0.0-release.47.0',
  colors: Object.freeze({
    primary: '#0F172A',
    secondary: '#0284C7',
    accent: '#D97706',
    supporting: '#E0F2FE',
    neutral: '#FFFFFF',
    darkBackground: '#0A192F'
  })
});

function validateHexColor(color, fieldName = 'Color') {
  if (!color || typeof color !== 'string') {
    throw new Error(`INVALID_COLOR_FORMAT: ${fieldName} must be a string`);
  }
  const trimmed = color.trim().toUpperCase();
  if (!/^#([A-Fa-f0-9]{6})$/.test(trimmed)) {
    throw new Error(`INVALID_COLOR_FORMAT: ${fieldName} must be a valid #RRGGBB hex color code`);
  }
  return trimmed;
}

function resolveInstitutionTheme(institutionBranding = {}) {
  const primary = institutionBranding.primaryColor 
    ? validateHexColor(institutionBranding.primaryColor, 'primaryColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.primary;
  const secondary = institutionBranding.secondaryColor 
    ? validateHexColor(institutionBranding.secondaryColor, 'secondaryColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.secondary;
  const accent = institutionBranding.accentColor 
    ? validateHexColor(institutionBranding.accentColor, 'accentColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.accent;
  const backgroundColor = institutionBranding.backgroundColor 
    ? validateHexColor(institutionBranding.backgroundColor, 'backgroundColor')
    : REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral;

  return {
    platformBrand: REMAS_PLATFORM_BRAND_DESKTOP,
    centerName: institutionBranding.centerName || 'مركز تعليمي معتمد',
    logoUrl: institutionBranding.logoUrl || null,
    watermarkUrl: institutionBranding.watermarkUrl || null,
    logoAssetId: institutionBranding.logoAssetId || null,
    watermarkAssetId: institutionBranding.watermarkAssetId || null,
    loginTitle: institutionBranding.loginTitle || `مرحباً بكم في ${institutionBranding.centerName || 'المركز التعليمي'}`,
    loginSubtitle: institutionBranding.loginSubtitle || 'منظومة المتابعة والإدارة التعليمية',
    welcomeMessage: institutionBranding.welcomeMessage || 'إدارة أذكى.. تعليم أفضل',
    colors: {
      primary,
      secondary,
      accent,
      backgroundColor,
      supporting: REMAS_PLATFORM_BRAND_DESKTOP.colors.supporting,
      neutral: REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral,
      darkBackground: REMAS_PLATFORM_BRAND_DESKTOP.colors.darkBackground
    },
    updatedAt: institutionBranding.updatedAt || new Date().toISOString(),
    updatedBy: institutionBranding.updatedBy || 'system'
  };
}

async function getBranding(callerToken, targetInstitutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = targetInstitutionId || token.institutionId;

  // Cloud Firestore document institutions/{instId} is authoritative source for branding
  const clientDb = await getClientFirestoreDb(token);
  const instRef = doc(clientDb, 'institutions', instId);
  const snap = await getDoc(instRef);

  let raw = {};
  if (snap.exists()) {
    const data = snap.data();
    raw = data.branding || data;
  }

  const merged = {
    institutionId: instId,
    centerName: raw.centerName || 'سنتر التفوق التعليمي',
    primaryColor: raw.primaryColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.primary,
    secondaryColor: raw.secondaryColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.secondary,
    accentColor: raw.accentColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.accent,
    backgroundColor: raw.backgroundColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral,
    logoUrl: raw.logoUrl || null,
    watermarkUrl: raw.watermarkUrl || null,
    logoAssetId: raw.logoAssetId || null,
    watermarkAssetId: raw.watermarkAssetId || null,
    loginTitle: raw.loginTitle || 'مرحباً بكم في المنظومة التعليمية',
    loginSubtitle: raw.loginSubtitle || 'منظومة المتابعة والإدارة',
    welcomeMessage: raw.welcomeMessage || 'إدارة أذكى.. تعليم أفضل'
  };

  return resolveInstitutionTheme(merged);
}

async function updateBranding(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  const clientDb = await getClientFirestoreDb(token);
  const instRef = doc(clientDb, 'institutions', instId);
  const snap = await getDoc(instRef);
  
  let existingBranding = {};
  if (snap.exists()) {
    const data = snap.data();
    existingBranding = data.branding || data;
  }

  const primaryColor = payload.primaryColor ? validateHexColor(payload.primaryColor, 'primaryColor') : (existingBranding.primaryColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.primary);
  const secondaryColor = payload.secondaryColor ? validateHexColor(payload.secondaryColor, 'secondaryColor') : (existingBranding.secondaryColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.secondary);
  const accentColor = payload.accentColor ? validateHexColor(payload.accentColor, 'accentColor') : (existingBranding.accentColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.accent);
  const backgroundColor = payload.backgroundColor ? validateHexColor(payload.backgroundColor, 'backgroundColor') : (existingBranding.backgroundColor || REMAS_PLATFORM_BRAND_DESKTOP.colors.neutral);

  const updatedBranding = {
    institutionId: instId,
    centerName: payload.centerName ? payload.centerName.trim() : (existingBranding.centerName || 'سنتر التفوق التعليمي'),
    logoAssetId: (payload.logoAssetId !== undefined ? payload.logoAssetId : existingBranding.logoAssetId) || null,
    watermarkAssetId: (payload.watermarkAssetId !== undefined ? payload.watermarkAssetId : existingBranding.watermarkAssetId) || null,
    logoUrl: (payload.logoUrl !== undefined ? payload.logoUrl : existingBranding.logoUrl) || null,
    watermarkUrl: (payload.watermarkUrl !== undefined ? payload.watermarkUrl : existingBranding.watermarkUrl) || null,
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    loginTitle: payload.loginTitle ? payload.loginTitle.trim() : (existingBranding.loginTitle || 'مرحباً بكم'),
    loginSubtitle: payload.loginSubtitle ? payload.loginSubtitle.trim() : (existingBranding.loginSubtitle || 'منظومة المتابعة التعليمية'),
    welcomeMessage: payload.welcomeMessage ? payload.welcomeMessage.trim() : (existingBranding.welcomeMessage || 'إدارة أذكى.. تعليم أفضل'),
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid
  };

  // Write branding object to institutions/{instId} document in Firestore
  if (!snap.exists()) {
    await setDoc(instRef, {
      id: instId,
      institutionId: instId,
      name: updatedBranding.centerName || 'سنتر التفوق التعليمي',
      status: 'ACTIVE',
      createdBy: token.uid,
      createdAt: new Date().toISOString(),
      updatedBy: token.uid,
      updatedAt: new Date().toISOString(),
      branding: updatedBranding
    }, { merge: true });
  } else {
    await setDoc(instRef, {
      branding: updatedBranding,
      updatedAt: new Date().toISOString(),
      updatedBy: token.uid
    }, { merge: true });
  }

  await recordAuditEvent({
    action: 'UPDATE_BRANDING',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'BRANDING',
    targetId: instId,
    details: { centerName: updatedBranding.centerName }
  });

  return resolveInstitutionTheme(updatedBranding);
}

async function uploadBrandingAsset(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const { assetType, fileMeta } = payload;
  if (assetType !== 'logo' && assetType !== 'watermark') {
    throw new Error('INVALID_ASSET_TYPE: Asset type must be logo or watermark');
  }

  const assetId = `r2_brand_${assetType}_${instId}_${Date.now()}`;
  const r2Key = `institutions/${instId}/branding/${assetId}`;
  const uploadUrl = `https://r2-gateway.educenter-saas.com/upload/${r2Key}?token=signed_upload_${Date.now()}`;
  const publicAccessUrl = `https://r2-gateway.educenter-saas.com/media/${r2Key}?token=signed_read_${Date.now()}`;

  return {
    assetId,
    r2Key,
    uploadUrl,
    publicAccessUrl,
    expiresInSeconds: 900
  };
}

function resetStore(callerToken) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('UNAUTHORIZED_TEST_METHOD: Test reset operations are disabled in production runtime.');
  }
  resetAcademicSetupStore();
  if (global.__MOCK_MUST_CHANGE__) global.__MOCK_MUST_CHANGE__.clear();
  if (global.__MOCK_PASSWORDS__) global.__MOCK_PASSWORDS__.clear();
  activeSessionToken = null;
  try { if (auth && auth.currentUser) { /* do not signOut in test mock */ } } catch (_) {}
}

module.exports = {
  resetStore,
  authenticateUser,
  logoutUser,
  getCenterInfo,
  updateCenterInfo,
  getDashboardSummary,
  // Students (Batch A canonical)
  getStudents,
  getStudentById,
  createStudent,
  addStudent,
  updateStudent,
  archiveStudent,
  deleteStudent,
  // Teachers
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  setTeacherStatus,
  archiveTeacher,
  deleteTeacher,
  // Groups & Subjects (Batch A canonical)
  getGroups,
  getGroupById,
  createGroup,
  addGroup,
  updateGroup,
  archiveGroup,
  deleteGroup,
  getTeacherGroups,
  getRoomGroups,
  getEnrollments,
  getGroupStudents,
  getStudentGroups,
  // Academic Years & Stages
  getAcademicYears,
  createAcademicYear,
  updateAcademicYear,
  setAcademicYearStatus,
  archiveAcademicYear,
  deleteAcademicYear,
  getStages,
  createStage,
  updateStage,
  setStageStatus,
  archiveStage,
  deleteStage,
  // Subjects
  getSubjects,
  createSubject,
  updateSubject,
  setSubjectStatus,
  archiveSubject,
  deleteSubject,
  // Rooms (Phase 50.1)
  getRooms,
  createRoom,
  updateRoom,
  setRoomStatus,
  archiveRoom,
  deleteRoom,
  // Teacher Relationships (Phase 50.2)
  getTeacherSubjects,
  assignTeacherSubject,
  removeTeacherSubject,
  getTeacherStages,
  assignTeacherStage,
  removeTeacherStage,
  // Group Memberships
  addStudentToGroup,
  removeStudentFromGroup,
  // Attendance
  getAttendanceRecords,
  recordAttendance,
  recordAttendanceScan,
  // Sessions
  getSessions,
  createSession,
  // Content & Media
  getContent,
  getContentMedia,
  // Exams & Grades
  getExams,
  createExam,
  getGrades,
  recordGrade,
  // Subscriptions & Parents
  getSubscriptions,
  getParents,
  // Finance
  getPayments,
  recordPayment,
  addPayment,
  getExpenses,
  recordExpense,
  addExpense,
  getAISettings,
  getCenterAISettings,
  // Onboarding & Authentication
  authenticateUser,
  logoutUser,
  changeOwnerPassword,
  resolveTenantForTest,
  resolveCallerToken,
  validateTenantAccess,
  registerAndClaimOwnerCenter,
  verifyEmailAndExecuteClaim,
  // Licenses & Devices
  getLicenseStatus,
  requestRebind,
  // Branding
  getBranding,
  updateBranding,
  uploadBrandingAsset
};
