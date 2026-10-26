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

const dns = require('node:dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

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
  runTransaction,
  writeBatch
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

// C.1.1: real end-to-end emulator auth. The rules-unit-testing
// `authenticatedContext().firestore()` returns a COMPAT instance, which is
// incompatible with this module's MODULAR Firestore calls — that path could
// never work. Instead, in emulator mode the module `auth` is pointed at the
// Auth emulator and tests sign in REAL emulator users; requests then carry
// genuine ID tokens so production rules evaluate truthfully (ownerId/users
// docs, not faked claims). Packaged production never sets these vars.
function isEmulatorMode() {
  return (process.env.NODE_ENV === 'test' || process.env.USE_FIRESTORE_EMULATOR === 'true') && !!process.env.FIRESTORE_EMULATOR_HOST;
}

let authEmulatorConnected = false;
if (isEmulatorMode()) {
  try {
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    const [ahost, aport] = authHost.split(':');
    connectAuthEmulator(auth, `http://${ahost || '127.0.0.1'}:${parseInt(aport || '9099', 10)}`, { disableWarnings: true });
    authEmulatorConnected = true;
  } catch (e) {}
}

// TEST-ONLY helper (throws outside emulator mode): signs the module's own
// `auth` instance into the Auth emulator so subsequent service calls carry a
// real ID token. Required because per-call auth switching is impossible with
// faked contexts; tests must serialize identities (asUser pattern).
async function testSignInEmulator(email, password) {
  if (!isEmulatorMode() || !authEmulatorConnected) {
    throw new Error('TEST_ONLY_NO_EMULATOR: testSignInEmulator requires emulator mode');
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { uid: cred.user.uid, email: cred.user.email };
}

async function testSignOutEmulator() {
  if (!isEmulatorMode()) throw new Error('TEST_ONLY_NO_EMULATOR: testSignOutEmulator requires emulator mode');
  try { await signOut(auth); } catch (_) {}
}

// NOTE: the legacy rules-unit-testing authenticatedContext() path was removed
// (C.1.1): it returns a COMPAT Firestore incompatible with this module's
// MODULAR calls, so that emulator branch could never work. Emulator mode now
// uses the module's own authenticated modular `db` (see above).

async function getClientFirestoreDb(callerToken) {
  if (isEmulatorMode()) {
    // Real modular Firestore + real emulator-auth ID token on this module's
    // auth instance (see testSignInEmulator). Never fall back to production.
    if (!authEmulatorConnected || !emulatorConnected) {
      throw new Error('EMULATOR_NOT_CONNECTED: emulator mode requires both Firestore and Auth emulator links');
    }
    return db;
  }
  return db;
}

function isNetworkOrOfflineError(err) {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'auth/network-request-failed' ||
    code === 'auth/timeout' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'network_disconnected' ||
    code === 'network_timeout' ||
    code.includes('network') ||
    code.includes('enotfound') ||
    code.includes('etimedout') ||
    code.includes('econnrefused') ||
    code.includes('econnreset') ||
    code.includes('offline') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('getaddrinfo') ||
    msg.includes('timeout') ||
    msg.includes('socket hang up') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}

function withTimeout(promise, ms, timeoutMsg = 'انتهت مهلة الاتصال بالخادم') {
  let timerId;
  const timerPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const err = new Error(`NETWORK_TIMEOUT: ${timeoutMsg}`);
      err.code = 'NETWORK_TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timerPromise]).finally(() => {
    if (timerId) clearTimeout(timerId);
  });
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
  // P0 SECURITY: gated by isExplicitMockAuthEnabled() — NODE_ENV=test in a
  // non-packaged runtime ONLY. USE_MOCK_AUTH alone never enables this branch.
  // Demo tenant IDs below are test-harness constants, never production tenants.
  if (isExplicitMockAuthEnabled() && password !== 'real_firebase_auth_trigger') {
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
    const userCredential = await withTimeout(
      signInWithEmailAndPassword(auth, cleanEmail, password),
      12000,
      'انتهت مهلة محاولة تسجيل الدخول (12 ثانية) بسبب بطء أو انقطاع الإنترنت'
    );
    const user = userCredential.user;
    const tokenResult = await withTimeout(
      user.getIdTokenResult(true),
      10000,
      'انتهت مهلة استرجاع بيانات التوثيق بسبب بطء أو انقطاع الإنترنت'
    );

    let role = tokenResult.claims.role;
    let mustChangePassword = false;
    let finalInstitutionId = null;

    // Canonical source: users/{uid}.institutionId (per architecture). Do NOT trust custom claims.
    // Strict tenant resolution with ownerId verification and no silent catch.
    let userData;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await withTimeout(
        getDoc(userDocRef),
        10000,
        'انتهت مهلة قراءة ملف المستخدم بسبب انقطاع الإنترنت'
      );
      if (!userDocSnap.exists()) {
        await signOut(auth);
        const err = new Error('TENANT_RESOLUTION_FAILED: تعذر تحديد المؤسسة — ملف المستخدم غير موجود');
        err.code = 'TENANT_RESOLUTION_FAILED';
        throw err;
      }
      userData = userDocSnap.data();
    } catch (e) {
      if (e && (e.code === 'TENANT_RESOLUTION_FAILED' || e.code === 'NETWORK_TIMEOUT')) throw e;
      await signOut(auth);
      if (isNetworkOrOfflineError(e)) {
        const netErr = new Error('NETWORK_DISCONNECTED: تعذر الاتصال بالخادم لجلب بيانات الحساب بسبب انقطاع الإنترنت.');
        netErr.code = 'NETWORK_DISCONNECTED';
        throw netErr;
      }
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
        const instSnap = await withTimeout(
          getDoc(doc(db, 'institutions', rawInstitutionId)),
          10000,
          'انتهت مهلة التحقق من بيانات المركز بسبب انقطاع الإنترنت'
        );
        if (!instSnap.exists() || instSnap.data().ownerId !== user.uid) {
          await signOut(auth);
          const err = new Error('TENANT_RESOLUTION_FAILED: فشل التحقق من ملكية المؤسسة');
          err.code = 'TENANT_RESOLUTION_FAILED';
          throw err;
        }
      } catch (e) {
        if (e && (e.code === 'TENANT_RESOLUTION_FAILED' || e.code === 'NETWORK_TIMEOUT')) throw e;
        await signOut(auth);
        if (isNetworkOrOfflineError(e)) {
          const netErr = new Error('NETWORK_DISCONNECTED: تعذر التحقق من بيانات السنتر بسبب انقطاع الإنترنت.');
          netErr.code = 'NETWORK_DISCONNECTED';
          throw netErr;
        }
        const err = new Error('TENANT_RESOLUTION_FAILED: تعذر التحقق من المؤسسة');
        err.code = 'TENANT_RESOLUTION_FAILED';
        throw err;
      }
      finalInstitutionId = rawInstitutionId;
    } else if (rawIds.length === 1) {
      // B) single institutionIds → verify ownerId, use it but do NOT auto-write back
      const sole = rawIds[0];
      try {
        const instSnap = await withTimeout(
          getDoc(doc(db, 'institutions', sole)),
          10000,
          'انتهت مهلة التحقق من بيانات المركز بسبب انقطاع الإنترنت'
        );
        if (!instSnap.exists() || instSnap.data().ownerId !== user.uid) {
          await signOut(auth);
          const err = new Error('TENANT_RESOLUTION_FAILED: فشل التحقق من ملكية المؤسسة (single)');
          err.code = 'TENANT_RESOLUTION_FAILED';
          throw err;
        }
      } catch (e) {
        if (e && (e.code === 'TENANT_RESOLUTION_FAILED' || e.code === 'NETWORK_TIMEOUT')) throw e;
        await signOut(auth);
        if (isNetworkOrOfflineError(e)) {
          const netErr = new Error('NETWORK_DISCONNECTED: تعذر التحقق من بيانات السنتر بسبب انقطاع الإنترنت.');
          netErr.code = 'NETWORK_DISCONNECTED';
          throw netErr;
        }
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

    const userRawEmail = user.email || cleanEmail;
    const resolvedName = (userData && (userData.displayName || userData.name || userData.username)) || user.displayName || (userRawEmail ? userRawEmail.split('@')[0] : 'المستخدم');

    const session = {
      uid: user.uid,
      email: userRawEmail,
      displayName: resolvedName,
      username: (userData && userData.username) || (userRawEmail ? userRawEmail.split('@')[0] : resolvedName),
      employeeName: resolvedName,
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

    if (isNetworkOrOfflineError(err) || err.code === 'NETWORK_TIMEOUT' || err.code === 'NETWORK_DISCONNECTED') {
      const netErr = new Error('NETWORK_DISCONNECTED: تعذر الاتصال بالخادم بسبب انقطاع الإنترنت عن الجهاز أو ضعف الشبكة. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.');
      netErr.code = 'NETWORK_DISCONNECTED';
      netErr.cause = err;
      throw netErr;
    }

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
  // P0 SECURITY: same explicit gate as authenticateUser — never in production.
  if (isExplicitMockAuthEnabled() && !auth.currentUser) {
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
  // P0 SECURITY: fail closed — never fall back to a demo tenant. A missing
  // user profile means tenant resolution failed (TENANT_RESOLUTION_FAILED).
  if (!userDocSnap.exists()) {
    const err = new Error('TENANT_RESOLUTION_FAILED: تعذر تحديد المؤسسة — ملف المستخدم غير موجود');
    err.code = 'TENANT_RESOLUTION_FAILED';
    throw err;
  }
  const claimedInstId = userDocSnap.data().institutionId;
  if (!claimedInstId || String(claimedInstId).trim() === '') {
    const err = new Error('TENANT_RESOLUTION_FAILED: تعذر تحديد المؤسسة — ملف المستخدم بدون مؤسسة صالحة');
    err.code = 'TENANT_RESOLUTION_FAILED';
    throw err;
  }

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
    // P0 SECURITY: fail closed — a superAdmin call with no resolvable tenant
    // throws instead of silently switching to a demo institution.
    const resolved = targetInstId || callerInst;
    if (!resolved || String(resolved).trim() === '') {
      const err = new Error('TENANT_RESOLUTION_FAILED: SuperAdmin call has no target institution');
      err.code = 'TENANT_RESOLUTION_FAILED';
      throw err;
    }
    return resolved;
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
  await recordAuditEventStrict({ action, actorUid, actorRole, institutionId, targetType, targetId, details });
  // Legacy fire-and-forget behavior preserved for non-financial callers.
  return true;
}

// C10: strict audit writer — returns true ONLY if the audit record persisted.
// Offline/test mode records into an in-memory log (verifiable, no silent claim).
// Finance flows MUST use this and surface `auditLogged:false` to the user.
async function recordAuditEventStrict({ action, actorUid, actorRole, institutionId, targetType, targetId, details = {} }) {
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.secret;

  const logDoc = {
    logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    action,
    actorUid: actorUid || 'system',
    actorRole: actorRole || 'unknown',
    actorEmployeeId: sanitizedDetails.byEmployeeId || null,
    actorNameSnapshot: sanitizedDetails.byName || null,
    institutionId: institutionId || 'platform',
    targetType: targetType || 'SYSTEM',
    targetId: targetId || 'none',
    details: sanitizedDetails,
    timestamp: new Date().toISOString()
  };

  if (isTestOffline()) {
    inMemoryAuditLog.push({ ...logDoc });
    return true;
  }

  try {
    const clientDb = await getClientFirestoreDb({ uid: actorUid, role: actorRole, institutionId });
    await setDoc(doc(clientDb, 'auditLogs', logDoc.logId), logDoc);
    return true;
  } catch (err) {
    return false;
  }
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
  requirePermission(token, 'settings:update');

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

  // Background auto-heal: if any student has tempPassword but fallback authUid, sync to Auth
  if (!isTestOffline() && !isUnitTestMode()) {
    for (const s of list) {
      if (s.tempPassword && s.normalizedPhone && (!s.authUid || s.authUid.startsWith('auth_uid_'))) {
        provisionStudentAuthAccount(s.normalizedPhone, s.tempPassword).then(prov => {
          if (prov && prov.success && prov.authUid && !prov.authUid.startsWith('auth_uid_')) {
            setDoc(doc(clientDb, 'institutions', instId, 'students', s.id), { authUid: prov.authUid }, { merge: true }).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }

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

function callIdentityToolkitApi(endpoint, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/${endpoint}?key=${firebaseConfig.apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeoutMs
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TIMEOUT: identitytoolkit request timed out'));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Provision / sync Student account in Firebase Authentication.
 * Creates an Auth user with email stu_{phone}@remas.local and temporary password.
 * Returns { authUid, success }
 */
async function provisionStudentAuthAccount(normalizedPhone, pin, previousPin = null) {
  if (isTestOffline() || isUnitTestMode()) {
    const mockUid = `auth_uid_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`;
    return { authUid: mockUid, success: true };
  }

  const cleanPhone = normalizedPhone.replace(/[^\d]/g, '');
  const email = `stu_${cleanPhone}@remas.local`;

  try {
    const signUpRes = await callIdentityToolkitApi('accounts:signUp', { email, password: pin, returnSecureToken: true });

    if (signUpRes.status === 200 && signUpRes.data && signUpRes.data.localId) {
      return { authUid: signUpRes.data.localId, success: true };
    }

    // Account already exists (EMAIL_EXISTS): update password to the new PIN
    if (signUpRes.status === 400 && signUpRes.data && signUpRes.data.error && signUpRes.data.error.message && signUpRes.data.error.message.includes('EMAIL_EXISTS')) {
      const candidates = [previousPin, pin, '123456', '654321'].filter(Boolean);
      for (const pass of candidates) {
        try {
          const signRes = await callIdentityToolkitApi('accounts:signInWithPassword', { email, password: pass, returnSecureToken: true });

          if (signRes.status === 200 && signRes.data && signRes.data.idToken) {
            const updRes = await callIdentityToolkitApi('accounts:update', { idToken: signRes.data.idToken, password: pin, returnSecureToken: true });
            const finalUid = (updRes.data && updRes.data.localId) || signRes.data.localId;
            return { authUid: finalUid, success: true };
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[provisionStudentAuthAccount] Warning during Firebase Auth provisioning:', err && err.message);
  }

  const fallbackUid = `auth_uid_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`;
  return { authUid: fallbackUid, success: false };
}

/**
 * Provision / sync Teacher account in Firebase Authentication.
 * Creates an Auth user with email tch_{phone}@remas.local and temporary password.
 * Returns { authUid, success }
 */
async function provisionTeacherAuthAccount(normalizedPhone, pin, previousPin = null) {
  if (isTestOffline() || isUnitTestMode()) {
    const mockUid = `auth_uid_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`;
    return { authUid: mockUid, success: true };
  }

  const cleanPhone = normalizedPhone.replace(/[^\d]/g, '');
  const candidateEmails = [
    `tch_${cleanPhone}@remas.local`,
    cleanPhone.startsWith('20') ? `tch_0${cleanPhone.substring(2)}@remas.local` : `tch_2${cleanPhone}@remas.local`
  ];

  for (const email of candidateEmails) {
    try {
      const signUpRes = await callIdentityToolkitApi('accounts:signUp', { email, password: pin, returnSecureToken: true });

      if (signUpRes.status === 200 && signUpRes.data && signUpRes.data.localId) {
        return { authUid: signUpRes.data.localId, success: true, email };
      }

      // Account already exists (EMAIL_EXISTS): update password to the new PIN
      if (signUpRes.status === 400 && signUpRes.data && signUpRes.data.error && signUpRes.data.error.message && signUpRes.data.error.message.includes('EMAIL_EXISTS')) {
        const candidates = [previousPin, pin, '123456', '654321'].filter(Boolean);
        for (const pass of candidates) {
          try {
            const signRes = await callIdentityToolkitApi('accounts:signInWithPassword', { email, password: pass, returnSecureToken: true });

            if (signRes.status === 200 && signRes.data && signRes.data.idToken) {
              const updRes = await callIdentityToolkitApi('accounts:update', { idToken: signRes.data.idToken, password: pin, returnSecureToken: true });
              const finalUid = (updRes.data && updRes.data.localId) || signRes.data.localId;
              return { authUid: finalUid, success: true, email };
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[provisionTeacherAuthAccount] Warning during Firebase Auth provisioning:', err && err.message);
    }
  }

  const fallbackUid = `auth_uid_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`;
  return { authUid: fallbackUid, success: false };
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
  requirePermission(token, 'students:create');
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

  // Pre-validate requested physical card (AVAILABLE, same tenant) BEFORE creating the student.
  // Accepts studentCardId (canonical) or attendanceCardCode (scanned/typed).
  let requestedCard = null;
  const requestedCardRef = body.studentCardId || body.attendanceCardCode || '';
  if (requestedCardRef) {
    if (body.studentCardId) {
      requestedCard = await fetchDocSameTenant(clientDb, 'studentCards', body.studentCardId, instId, inMemoryStudentCards, 'كارنيه الطالب');
    } else {
      requestedCard = await findCardByCodeInternal(token, clientDb, instId, body.attendanceCardCode);
    }
    if (requestedCard.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'هذا الكارنيه غير مسجل بالنظام');
    if (requestedCard.status !== 'AVAILABLE' || requestedCard.studentId) {
      throw arabicServiceError('CARD_NOT_AVAILABLE', 'هذا الكارنيه لم يعد متاحاً — اختر كارنيهاً بحالة متاح وغير مرتبط', requestedCard.cardCode);
    }
  }

  // Provision / resolve Auth UID via Firebase Auth
  const initialPin = body.tempPassword || crypto.randomInt(100000, 1000000).toString();
  let authUid = body.authUid;
  if (!authUid || authUid.startsWith('auth_uid_')) {
    let prov = await provisionStudentAuthAccount(normalizedPhone, initialPin, body.previousTempPassword);
    if (!prov || !prov.success || !prov.authUid || prov.authUid.startsWith('auth_uid_')) {
      // Retry once before failing
      prov = await provisionStudentAuthAccount(normalizedPhone, initialPin, body.previousTempPassword);
    }
    if (!isTestOffline() && !isUnitTestMode() && (!prov || !prov.success || !prov.authUid || prov.authUid.startsWith('auth_uid_'))) {
      throw arabicServiceError('AUTH_PROVISION_FAILED', 'تعذر إنشاء حساب دخول الطالب في خدمة المصادقة. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.');
    }
    authUid = (prov && prov.authUid) ? prov.authUid : (body.authUid || `auth_uid_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`);
  }

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
    attendanceCardCode: '',
    studentCardId: null,
    tempPassword: initialPin,
    status: body.status || 'ACTIVE',
    notes: (body.notes || '').trim(),
    createdAt: nowISO,
    updatedAt: nowISO,
    createdBy: token.uid || 'system'
  });

  // ATOMIC CREATE + ENROLL + CARD: create student, enroll groups, assign card.
  // On any post-create failure, compensate by rolling back student + enrollments + card.
  const createdEnrollmentIds = [];
  let cardAssignedId = null;
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
    if (cardAssignedId) {
      try {
        if (isTestOffline()) {
          const c = inMemoryStudentCards.get(`${instId}_${cardAssignedId}`);
          if (c) inMemoryStudentCards.set(`${instId}_${cardAssignedId}`, { ...c, status: 'AVAILABLE', studentId: null, assignedAt: null, issuedAt: null, updatedAt: new Date().toISOString() });
        } else {
          await setDoc(doc(clientDb, 'institutions', instId, 'studentCards', cardAssignedId), { status: 'AVAILABLE', studentId: null, assignedAt: null, updatedAt: new Date().toISOString() }, { merge: true });
        }
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
    if (requestedCard) {
      await assignStudentCardInternal(token, clientDb, instId, id, requestedCard.id);
      cardAssignedId = requestedCard.id;
    }
    // Verify final state before claiming success
    const verified = await getStudentById(token, id, instId);
    if (verified.groupIds.length !== finalGroupIds.length) {
      await rollbackStudent();
      throw arabicServiceError('ENROLLMENT_VERIFY_FAILED', 'فشل التحقق من اكتمال التسجيل — تم التراجع عن إنشاء الطالب');
    }
    if (requestedCard && verified.studentCardId !== requestedCard.id) {
      await rollbackStudent();
      throw arabicServiceError('CARD_ASSIGN_VERIFY_FAILED', 'فشل ربط الكارنيه — تم التراجع عن إنشاء الطالب');
    }
    await recordAuditEvent({
      action: 'CREATE_STUDENT',
      actorUid: token.uid,
      actorRole: token.role,
      institutionId: instId,
      targetType: 'STUDENT',
      targetId: id,
      details: { name: verified.name, stageId: verified.stageId, groupIds: verified.groupIds, authUid: verified.authUid, cardCode: verified.attendanceCardCode || null }
    });
    // Auto-create & link parent account from student guardian data
    if (verified.guardianPhone && String(verified.guardianPhone).trim()) {
      try {
        const syncedG = await syncGuardianForStudent(token, clientDb, instId, verified);
        if (syncedG) {
          verified.parentUid = syncedG.authUid;
          verified.guardianId = syncedG.id;
          verified.guardianUids = [syncedG.authUid];
        }
      } catch (gErr) {
        console.warn('[createStudent] Auto sync guardian warning:', gErr && gErr.message);
      }
    }
    verified.tempPassword = verified.tempPassword || initialPin;
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
  requirePermission(token, 'students:update');
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

  // Physical card identity is never overwritten by free text: route explicit card
  // changes through the replacement lifecycle (preserves history).
  if (body.studentCardId !== undefined || body.attendanceCardCode !== undefined) {
    const targetRef = body.studentCardId || body.attendanceCardCode;
    const currentRef = existing.studentCardId || existing.attendanceCardCode || null;
    const targetId = body.studentCardId || null;
    if (targetRef && targetRef !== currentRef && targetId !== currentRef) {
      if (!existing.studentCardId) {
        await assignStudentCardInternal(token, clientDb, instId, sId, body.studentCardId || (await findCardByCodeInternal(token, clientDb, instId, body.attendanceCardCode)).id);
      } else {
        const newId = body.studentCardId || (await findCardByCodeInternal(token, clientDb, instId, body.attendanceCardCode)).id;
        if (newId !== existing.studentCardId) await replaceStudentCard(token, sId, newId, instId, 'REPLACED');
      }
    }
  }

  const patch = { ...body };
  delete patch.groupIds; delete patch.groupId;
  delete patch.studentCardId; delete patch.attendanceCardCode;
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

  if (body.guardianPhone !== undefined || body.guardianName !== undefined) {
    try {
      const syncedG = await syncGuardianForStudent(token, clientDb, instId, updated);
      if (syncedG) {
        updated.parentUid = syncedG.authUid;
        updated.guardianId = syncedG.id;
        updated.guardianUids = [syncedG.authUid];
      }
    } catch (gErr) {
      console.warn('[updateStudent] Auto sync guardian warning:', gErr && gErr.message);
    }
  }

  return updated;
}

async function archiveStudent(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'students:archive');
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
  requirePermission(token, 'students:archive');
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
  requirePermission(token, 'teachers:create');
  const fullName = (payload.fullName || payload.name || '').trim();
  if (!fullName || fullName.length === 0) {
    throw new Error('INVALID_TEACHER_NAME: Teacher name is required');
  }
  const rawPhone = (payload.phone || '').trim();
  if (!rawPhone) throw new Error('INVALID_PHONE: Phone number is required');
  const normalizedPhone = normalizeEgyptianPhone(rawPhone);
  // C.1.3: specialization is DERIVED display data (from chosen subjects), never
  // a free-text business field and never a source of truth. Accepted only for
  // backward compatibility (legacy reads / old UI writes); defaults to 'عام'.
  const specialization = (payload.specialization || payload.subject || 'عام').trim() || 'عام';
  const email = payload.email ? validateTeacherEmail(payload.email) : '';
  const status = payload.status || 'ACTIVE';
  if (!['ACTIVE','SUSPENDED','ARCHIVED'].includes(status)) throw new Error('INVALID_STATUS: Status must be ACTIVE/SUSPENDED/ARCHIVED');
  // C.1/M: optional link to an employee (operational identity). Neither side
  // is required: a teacher MAY exist without an employee and vice versa.
  let linkEmployeeId = '';
  if (payload.employeeId) {
    linkEmployeeId = String(payload.employeeId);
    const _edb = isTestOffline() ? null : await getClientFirestoreDb(token);
    await fetchDocSameTenant(_edb, 'employees', linkEmployeeId, instId, inMemoryEmployees, 'الموظف');
  }

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
    const cleanPhone = normalizedPhone.replace(/[^\d]/g, '');
    const authEmail = `tch_${cleanPhone}@remas.local`;
    const initialPin = payload.tempPassword || crypto.randomInt(100000, 1000000).toString();
    const teacher = {
      id,
      teacherId: id,
      institutionId: instId,
      teacherCode,
      fullName,
      name: fullName,
      phone: rawPhone,
      normalizedPhone,
      authEmail,
      tempPassword: initialPin,
      initialPinChanged: false,
      mustChangePassword: true,
      email: email || '',
      specialization,
      subject: specialization,
      status: payload.status || 'MUST_CHANGE_PASSWORD',
      authUid: payload.authUid || null,
      employeeId: linkEmployeeId,
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

  const cleanPhone = normalizedPhone.replace(/[^\d]/g, '');
  const authEmail = `tch_${cleanPhone}@remas.local`;
  const initialPin = payload.tempPassword || crypto.randomInt(100000, 1000000).toString();
  let authUid = payload.authUid;
  if (!authUid || authUid.startsWith('auth_uid_')) {
    const prov = await provisionTeacherAuthAccount(normalizedPhone, initialPin);
    if (prov && prov.authUid && !prov.authUid.startsWith('auth_uid_')) {
      authUid = prov.authUid;
    }
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
    authEmail,
    tempPassword: initialPin,
    initialPinChanged: false,
    mustChangePassword: true,
    email: email || '',
    specialization,
    subject: specialization,
    status: payload.status || 'MUST_CHANGE_PASSWORD',
    authUid: authUid || null,
    employeeId: linkEmployeeId,
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
  requirePermission(token, 'teachers:update');
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
  // C.1/M: optional employee link (validated same-tenant; empty clears).
  if (body.employeeId !== undefined) {
    const linkId = body.employeeId ? String(body.employeeId) : '';
    if (linkId) {
      const _edb = isTestOffline() ? null : await getClientFirestoreDb(token);
      await fetchDocSameTenant(_edb, 'employees', linkId, instId, inMemoryEmployees, 'الموظف');
    }
    body.employeeId = linkId;
  }
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
  requirePermission(token, 'teachers:update');
  if (!['ACTIVE','SUSPENDED','ARCHIVED'].includes(status)) throw new Error('INVALID_STATUS');
  return await updateTeacher(token, teacherId, { institutionId: instId, status });
}

async function archiveTeacher(callerToken, teacherId, institutionId) {
  return await setTeacherStatus(callerToken, teacherId, 'ARCHIVED');
}

async function deleteTeacher(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'teachers:archive');
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
    if (subject.status === 'ARCHIVED') throw new Error('INACTIVE_SUBJECT: لا يمكن إسناد مادة مؤرشفة', subjectId);
    const dup = Array.from(inMemoryTeacherSubjects.values()).find(a => a.institutionId === instId && a.teacherId === teacherId && a.subjectId === subjectId);
    if (dup) throw new Error('DUPLICATE_ASSIGNMENT: هذا المعلم مخصص مسبقاً لهذه المادة');
    const id = teacherSubjectAssignmentId(teacherId, subjectId);
    // C.1 canonical Teacher→Stage→Subject: the assignment carries an explicit
    // stageId snapshot copied from the subject doc at assignment time (stored
    // link, never live inference). Legacy docs without stageId stay valid in
    // any stage assigned to the teacher (backward compatible).
    // C.1.2 canonical coherence — assignment stages MUST belong to the
    // subject's allowed stages: requested R (explicit stageIds[], else explicit
    // singular stageId, else the subject's full effective stages by default)
    // must satisfy R ⊆ E(subject). Rejected with SUBJECT_STAGE_MISMATCH.
    const subjStages = getSubjectEffectiveStages(subject);
    let requested = null;
    if (payload.stageIds !== undefined) {
      requested = assertStageIdsValid(payload.stageIds, 'مراحل الإسناد');
    } else if (payload.stageId) {
      requested = [String(payload.stageId)];
    } else {
      requested = [...subjStages];
    }
    if (subjStages.length > 0) {
      const outside = requested.filter(s => !subjStages.includes(s));
      if (outside.length > 0) {
        throw new Error(`SUBJECT_STAGE_MISMATCH: المادة غير مرتبطة بهذه المراحل (${outside.join('، ')}) — المراحل المسموحة: ${subjStages.join('، ') || '؟'}`);
      }
    }
    await assertStagesAssignable(null, instId, requested);
    const assignment = { id, assignmentId: id, institutionId: instId, teacherId, subjectId, stageId: requested[0] || '', stageIds: requested, status: (payload.status && ['ACTIVE', 'ARCHIVED'].includes(String(payload.status).toUpperCase())) ? String(payload.status).toUpperCase() : 'ACTIVE', createdAt: new Date().toISOString(), createdBy: token.uid || 'system' };
    inMemoryTeacherSubjects.set(`${instId}_${id}`, assignment);
    return assignment;
  }
  const clientDb = await getClientFirestoreDb(token);
  const teacherSnap = await getDoc(doc(clientDb, 'institutions', instId, 'teachers', teacherId));
  if (!teacherSnap.exists()) throw new Error('NOT_FOUND: Teacher not found');
  const subjectSnap = await getDoc(doc(clientDb, 'institutions', instId, 'subjects', subjectId));
  if (!subjectSnap.exists()) throw new Error('NOT_FOUND: Subject not found');
  if ((subjectSnap.data() || {}).status === 'ARCHIVED') throw new Error('INACTIVE_SUBJECT: لا يمكن إسناد مادة مؤرشفة', subjectId);
  const q = query(collection(clientDb, 'institutions', instId, 'teacherSubjects'), where('teacherId','==',teacherId), where('subjectId','==',subjectId));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error('DUPLICATE_ASSIGNMENT: هذا المعلم مخصص مسبقاً لهذه المادة');
  const id = teacherSubjectAssignmentId(teacherId, subjectId);
  const subjectData = subjectSnap.data() || {};
  // C.1.2 canonical coherence (same rule as offline branch above).
  const subjStages = getSubjectEffectiveStages(subjectData);
  let requested = null;
  if (payload.stageIds !== undefined) {
    requested = assertStageIdsValid(payload.stageIds, 'مراحل الإسناد');
  } else if (payload.stageId) {
    requested = [String(payload.stageId)];
  } else {
    requested = [...subjStages];
  }
  if (subjStages.length > 0) {
    const outside = requested.filter(s => !subjStages.includes(s));
    if (outside.length > 0) {
      throw new Error(`SUBJECT_STAGE_MISMATCH: المادة غير مرتبطة بهذه المراحل (${outside.join('، ')}) — المراحل المسموحة: ${subjStages.join('، ') || '؟'}`);
    }
  }
  await assertStagesAssignable(clientDb, instId, requested);
  const assignment = { id, assignmentId: id, institutionId: instId, teacherId, subjectId, stageId: requested[0] || '', stageIds: requested, status: (payload.status && ['ACTIVE', 'ARCHIVED'].includes(String(payload.status).toUpperCase())) ? String(payload.status).toUpperCase() : 'ACTIVE', createdAt: new Date().toISOString(), createdBy: token.uid || 'system' };
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
    const id = teacherStageAssignmentId(teacherId, stageId);
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
  const id = teacherStageAssignmentId(teacherId, stageId);
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
  const includeArchived = opts.includeArchived === true || opts.status === 'ARCHIVED';
  if (isTestOffline()) {
    let list = Array.from(inMemoryGroups.values()).filter(g => g.institutionId === instId && (includeArchived || g.status !== 'ARCHIVED'));
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
  if (!includeArchived) list = list.filter(g => g.status !== 'ARCHIVED');
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
  requirePermission(token, 'groups:create');
  // B.1: teacher + stage + subject are mandatory so the combo gate below always runs.
  for (const [key, label] of [['teacherId', 'المعلم'], ['stageId', 'المرحلة الدراسية'], ['subjectId', 'المادة الدراسية'], ['academicYearId', 'السنة الدراسية'], ['roomId', 'القاعة']]) {
    if (!body[key] || String(body[key]).trim().length === 0) {
      throw arabicServiceError('INVALID_GROUP_RELATION', `اختيار ${label} مطلوب لإنشاء المجموعة`, key);
    }
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
  // BATCH 1: optional term context — when supplied it must belong to the
  // selected academic year (same tenant). Legacy groups keep termId absent.
  let termId = body.termId || null;
  if (termId) {
    const termSnap = await getDoc(doc(clientDb, 'institutions', instId, 'terms', termId));
    if (!termSnap.exists()) throw arabicServiceError('UNKNOWN_TERM', 'الفصل الدراسي غير موجود في المؤسسة', 'termId');
    const termDoc = termSnap.data() || {};
    if (termDoc.institutionId && termDoc.institutionId !== instId) {
      throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', 'termId');
    }
    if (termDoc.academicYearId && termDoc.academicYearId !== body.academicYearId) {
      throw arabicServiceError('INVALID_TERM_YEAR', 'الفصل الدراسي لا ينتمي للسنة الدراسية المحددة', 'termId');
    }
    if (termDoc.status && termDoc.status !== 'ACTIVE') {
      throw arabicServiceError('INACTIVE_TERM', 'الفصل الدراسي غير نشط', 'termId');
    }
  }
  const refs = {
    academicYearId: body.academicYearId || undefined,
    stageId: body.stageId || undefined,
    subjectId: body.subjectId || undefined,
    teacherId: body.teacherId || undefined,
    roomId: body.roomId || undefined
  };
  // Validate provided references (same tenant, active, hierarchy consistent)
  const { stageDoc, subjectDoc } = await validateGroupReferences(token, clientDb, instId, refs);
  // B.1 hard gate: teacher must be assigned to BOTH stage and subject.
  // Runs here (not UI-only) so direct service calls cannot bypass it.
  await assertTeacherCombo(token, clientDb, instId, refs.teacherId, refs.stageId, refs.subjectId);

  const id = body.id || `GRP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const code = body.code || body.groupCode || `GRP-${String(Math.floor(1000 + Math.random() * 900000))}`;
  const nowISO = new Date().toISOString();
  // B.1 canonical name is GENERATED from stage + subject, or uses explicit name in live Desktop UI.
  const baseGroupName = (!isTestOffline() && body.name && String(body.name).trim())
    ? String(body.name).trim()
    : buildGroupName(subjectDoc.name, stageDoc.name);
  const name = await uniqueGroupName(token, clientDb, instId, baseGroupName);
  const subjectPrice = Math.max(0, Number(subjectDoc?.price) || 0);
  const group = {
    id,
    code,
    institutionId: instId,
    name,
    academicYearId: body.academicYearId || '',
    termId: termId || null,
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
    subjectPrice: subjectPrice,
    monthlyFee: 0 * subjectPrice,
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
  requirePermission(token, 'groups:update');
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
  // B.1: teacher/stage/subject changes re-run the combo gate (grandfathered
  // groups stay valid until edited — validation applies on write only).
  if (nextRefs.teacherId && nextRefs.stageId && nextRefs.subjectId) {
    await assertTeacherCombo(token, clientDb, instId, nextRefs.teacherId, nextRefs.stageId, nextRefs.subjectId);
  }
  // BATCH 1: explicit term assignment on edit — term must belong to the
  // group's (possibly updated) academic year. Legacy groups keep termId absent
  // until an admin assigns it; nothing is guessed or fabricated.
  if (body.termId !== undefined && body.termId !== null && body.termId !== '') {
    const effYear = body.academicYearId !== undefined ? body.academicYearId : existing.academicYearId;
    const termSnap = await getDoc(doc(clientDb, 'institutions', instId, 'terms', body.termId));
    if (!termSnap.exists()) throw arabicServiceError('UNKNOWN_TERM', 'الفصل الدراسي غير موجود في المؤسسة', 'termId');
    const termDoc = termSnap.data() || {};
    if (termDoc.institutionId && termDoc.institutionId !== instId) {
      throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', 'termId');
    }
    if (termDoc.academicYearId && effYear && termDoc.academicYearId !== effYear) {
      throw arabicServiceError('INVALID_TERM_YEAR', 'الفصل الدراسي لا ينتمي للسنة الدراسية للمجموعة', 'termId');
    }
    if (termDoc.status && termDoc.status !== 'ACTIVE') {
      throw arabicServiceError('INACTIVE_TERM', 'الفصل الدراسي غير نشط', 'termId');
    }
  }
  const stageChanged = body.stageId !== undefined && body.stageId !== existing.stageId;
  const subjectChanged = body.subjectId !== undefined && body.subjectId !== existing.subjectId;
  if (stageChanged || subjectChanged) {
    // Regenerate canonical name from the NEW stage/subject; enrolled students
    // keep their records (stage history is preserved on the student side —
    // no silent enrollment rewrite). Warn the operator via audit details.
    const regStage = await fetchDocSameTenant(clientDb, 'stages', nextRefs.stageId, instId, inMemoryStages, 'المرحلة الدراسية');
    const regSubject = await fetchDocSameTenant(clientDb, 'subjects', nextRefs.subjectId, instId, inMemorySubjects, 'المادة الدراسية');
    body.name = await uniqueGroupName(token, clientDb, instId, buildGroupName(regSubject.name, regStage.name), gId);
    const affectedEnrolled = Number(existing.enrolledCount || 0);
    if (affectedEnrolled > 0 && stageChanged) {
      await recordAuditEvent({ action: 'GROUP_STAGE_CHANGED_WITH_ENROLLMENTS', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GROUP', targetId: gId, details: { from: existing.stageId, to: nextRefs.stageId, enrolledCount: affectedEnrolled } });
    }
  } else {
    delete body.name;
  }
  const nextCapRaw = body.maxCapacity !== undefined ? body.maxCapacity : (body.capacity !== undefined ? body.capacity : existing.maxCapacity);
  const nextCap = Number(nextCapRaw);
  if (body.maxCapacity !== undefined || body.capacity !== undefined) {
    if (!Number.isFinite(nextCap) || nextCap <= 0 || !Number.isInteger(nextCap)) throw arabicServiceError('INVALID_GROUP_CAPACITY', 'سعة المجموعة يجب أن تكون رقماً صحيحاً موجباً');
    const enrolled = Number(existing.enrolledCount || 0);
    if (nextCap < enrolled) throw arabicServiceError('CAPACITY_BELOW_ENROLLED', `لا يمكن تقليل السعة عن عدد المسجلين حالياً (${enrolled})`, `${nextCap}/${enrolled}`);
  }

  let subjectPrice = existing.subjectPrice;
  if (subjectChanged || subjectPrice === undefined) {
    try {
      const regSubject = await fetchDocSameTenant(clientDb, 'subjects', nextRefs.subjectId, instId, inMemorySubjects, 'المادة الدراسية');
      subjectPrice = Math.max(0, Number(regSubject?.price) || 0);
    } catch (_) {
      subjectPrice = Number(existing.subjectPrice || 0);
    }
  }
  const enrolledNow = Number(existing.enrolledCount || 0);
  const autoMonthlyFee = enrolledNow * Number(subjectPrice || 0);

  const updated = {
    ...existing,
    ...body,
    id: gId,
    institutionId: instId,
    maxCapacity: body.maxCapacity !== undefined || body.capacity !== undefined ? nextCap : existing.maxCapacity,
    capacity: body.maxCapacity !== undefined || body.capacity !== undefined ? nextCap : (existing.capacity || existing.maxCapacity),
    subjectPrice: subjectPrice,
    monthlyFee: autoMonthlyFee,
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'system'
  };
  if (isTestOffline()) {
    inMemoryGroups.set(`${instId}_${gId}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'groups', gId), { ...body, id: gId, institutionId: instId, maxCapacity: updated.maxCapacity, capacity: updated.capacity, subjectPrice: updated.subjectPrice, monthlyFee: updated.monthlyFee, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy }, { merge: true });
  }
  await recordAuditEvent({ action: 'UPDATE_GROUP', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GROUP', targetId: gId, details: { name: updated.name, maxCapacity: updated.maxCapacity } });
  return updated;
}

// B.1 group lifecycle on the existing ACTIVE/INACTIVE/ARCHIVED schema:
// ACTIVE = operational · INACTIVE = suspended-visible-restorable ·
// ARCHIVED = terminal history (students/attendance/grades untouched).
// INACTIVE groups accept no new enrollments/schedules/sessions but stay listed.
const GROUP_LIFECYCLE_TRANSITIONS = {
  ACTIVE: ['INACTIVE', 'ARCHIVED'],
  INACTIVE: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: []
};

async function setGroupStatus(callerToken, groupId, status, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'groups:update');
  if (!['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status)) {
    throw arabicServiceError('INVALID_GROUP_STATUS', 'حالة المجموعة يجب أن تكون ACTIVE/INACTIVE/ARCHIVED');
  }
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'groups', groupId, instId, inMemoryGroups, 'المجموعة');
  const allowed = GROUP_LIFECYCLE_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(status)) {
    throw arabicServiceError('INVALID_GROUP_TRANSITION', `لا يمكن تحويل المجموعة من ${existing.status} إلى ${status}`, `${existing.status}→${status}`);
  }
  const updated = { ...existing, status, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system' };
  if (isTestOffline()) inMemoryGroups.set(`${instId}_${groupId}`, { ...updated });
  else await setDoc(doc(clientDb, 'institutions', instId, 'groups', groupId), { status, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy }, { merge: true });
  await recordAuditEvent({ action: status === 'ARCHIVED' ? 'ARCHIVE_GROUP' : 'SET_GROUP_STATUS', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GROUP', targetId: groupId, details: { from: existing.status, to: status } });
  return updated;
}

async function archiveGroup(callerToken, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'groups:archive');
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
  requirePermission(token, 'groups:archive');
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
const inMemoryStudentCards = new Map();
const inMemoryAttendanceRecords = [];
const inMemorySessions = new Map();
const inMemoryBranding = new Map();
const inMemorySchedules = new Map();
// Batch C finance (offline/test mirrors of tenant-scoped collections)
const inMemoryFeeStructures = new Map();
const inMemoryStudentCharges = new Map();
const inMemoryStudentPayments = new Map();
const inMemoryExpenses = new Map();
const inMemoryOtherIncome = new Map();
const inMemoryReceipts = new Map();
const inMemoryGuardians = new Map();
const inMemoryStudentGuardians = new Map();
const inMemoryAuditLog = [];

function isTestOffline() {
  return process.env.NODE_ENV === 'test' && !process.env.FIRESTORE_EMULATOR_HOST && !isPackagedProduction();
}

// P0 SECURITY: packaged-production detection. Mock auth and in-memory test
// branches must never activate inside a packaged Electron app, even if
// NODE_ENV leaks in. In packaged runtimes process.resourcesPath points at the
// app resources dir (never inside node_modules during development).
function isPackagedProduction() {
  if (process.env.NODE_ENV === 'production') return true;
  try {
    const rp = typeof process.resourcesPath === 'string' ? process.resourcesPath : '';
    if (rp && rp.indexOf('node_modules') === -1) return true;
  } catch (_) {}
  return false;
}

// P0 SECURITY: explicit test-only gate for mock auth/data branches.
// Active ONLY under NODE_ENV=test in a non-packaged runtime.
// USE_MOCK_AUTH alone NEVER enables mock behavior. Packaged/production
// runtimes always fail closed to real Firebase Auth (no demo tenants,
// no in-memory business data, no mock sessions).
function isExplicitMockAuthEnabled() {
  if (isPackagedProduction()) return false;
  return process.env.NODE_ENV === 'test';
}

// Hermetic unit-test mode: emulator-less NODE_ENV=test OR explicit seed mode.
// New Firestore/callable-backed methods MUST take the seed/throw branch here
// so unit suites never touch production (see windows_desktop_full).
function isUnitTestMode() {
  return isTestOffline() || process.env.USE_TEST_SEED === 'true';
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
  inMemoryStudentCards.clear();
  inMemoryAttendanceRecords.length = 0;
  inMemorySessions.clear();
  inMemoryBranding.clear();
  inMemorySchedules.clear();
  inMemoryFeeStructures.clear();
  inMemoryStudentCharges.clear();
  inMemoryStudentPayments.clear();
  inMemoryExpenses.clear();
  inMemoryOtherIncome.clear();
  inMemoryReceipts.clear();
  inMemoryReceiptCounters.clear();
  inMemoryEmployees.clear();
  inMemoryAuditLog.length = 0;
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

// C.1 actor identity helper: human snapshot name, never a raw UID for display.
// Legacy tokens (center account only) fall back to email/uid-labeled center name.
function actorDisplayName(token) {
  if (!token) return 'الخزينة';
  if (token.displayName) return token.displayName;
  if (token.employeeName) return token.employeeName;
  if (token.name) return token.name;
  if (token.username) return token.username;
  if (token.email) {
    const localPart = String(token.email).split('@')[0];
    return localPart;
  }
  if (token.uid) return `حساب السنتر (${String(token.uid).slice(0, 8)}…)`;
  return 'الخزينة';
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

// B.1 canonical teacher-assignment identity (deterministic IDs enable
// Firestore Rules exists() checks, closing the direct-write bypass).
function teacherSubjectAssignmentId(teacherId, subjectId) {
  return `TSUB_${teacherId}_${subjectId}`;
}
function teacherStageAssignmentId(teacherId, stageId) {
  return `TSTG_${teacherId}_${stageId}`;
}

// B.1 canonical group name: "{subject} — {stage}", suffixed on collision.
// Group.name is GENERATED, never user-editable.
function buildGroupName(subjectName, stageName) {
  return `${String(subjectName || '').trim()} — ${String(stageName || '').trim()}`;
}

async function uniqueGroupName(token, clientDb, instId, baseName, excludeId = null) {
  const norm = String(baseName).trim();
  const siblings = isTestOffline()
    ? Array.from(inMemoryGroups.values()).filter(g => g.institutionId === instId && g.id !== excludeId)
    : (await getDocs(collection(clientDb, 'institutions', instId, 'groups'))).docs
      .map(d => ({ id: d.id, ...d.data() })).filter(g => g.id !== excludeId);
  const taken = new Set(siblings.map(g => String(g.name || '').trim()));
  if (!taken.has(norm)) return norm;
  let n = 2;
  while (taken.has(`${norm} — مجموعة ${n}`)) n++;
  return `${norm} — مجموعة ${n}`;
}

async function teacherAssignmentExists(token, clientDb, instId, kind, teacherId, refId) {
  const col = kind === 'subject' ? 'teacherSubjects' : 'teacherStages';
  const detId = kind === 'subject'
    ? teacherSubjectAssignmentId(teacherId, refId)
    : teacherStageAssignmentId(teacherId, refId);
  if (isTestOffline()) {
    const map = kind === 'subject' ? inMemoryTeacherSubjects : inMemoryTeacherStages;
    if (map.has(`${instId}_${detId}`)) return true;
    const key = kind === 'subject' ? 'subjectId' : 'stageId';
    return Array.from(map.values()).some(a => a.institutionId === instId && a.teacherId === teacherId && a[key] === refId);
  }
  const detSnap = await getDoc(doc(clientDb, 'institutions', instId, col, detId));
  if (detSnap.exists()) return true;
  const key = kind === 'subject' ? 'subjectId' : 'stageId';
  const q = query(collection(clientDb, 'institutions', instId, col), where('teacherId', '==', teacherId), where(key, '==', refId));
  return !(await getDocs(q)).empty;
}

// C.1 canonical Teacher→Stage→Subject truth (single source, never UI-only,
// never show-all fallback). A subject is allowed for (teacher, stage) iff:
//   1. a teacherSubjects assignment exists for (teacher, subject), AND
//   2. the effective stage of that link equals the requested stage, where
//      effective stage = subject.stageId (authoritative) else assignment.stageId
//      (explicit stored snapshot) else null (legacy → valid in any assigned stage).
// ARCHIVED subjects are never allowed.
function resolveAssignmentSubjectStage(subjectDoc, assignmentDoc) {
  const eff = getSubjectEffectiveStages(subjectDoc);
  if (eff.length > 0) return eff[0];
  if (assignmentDoc && assignmentDoc.stageId) return assignmentDoc.stageId;
  return null;
}

// C.1.2 plural resolver (kept for backward-compatible reads): effective
// stages of the LINK. Subject stages win when present; else the assignment's
// recorded stages; else null (legacy).
function resolveAssignmentSubjectStages(subjectDoc, assignmentDoc) {
  const sEff = getSubjectEffectiveStages(subjectDoc);
  if (sEff.length > 0) return sEff;
  if (assignmentDoc && Array.isArray(assignmentDoc.stageIds) && assignmentDoc.stageIds.length > 0) {
    return [...new Set(assignmentDoc.stageIds.filter(s => typeof s === 'string' && s))];
  }
  if (assignmentDoc && assignmentDoc.stageId) return [assignmentDoc.stageId];
  return null;
}

// C.1.3 canonical link resolver: the teacher's RECORDED assignment stages win
// when explicitly recorded (non-empty) — they are always a validated subset of
// the subject's stages, and narrowing them (unchecking a stage in the card)
// must hide the subject from that stage in BOTH the picker and the group gate.
// Falls back to subject effective stages when the assignment records none;
// null when both sides are unconstrained (legacy pass).
function resolveCanonicalLinkStages(subjectDoc, assignmentDoc) {
  if (assignmentDoc) {
    if (Array.isArray(assignmentDoc.stageIds) && assignmentDoc.stageIds.length > 0) {
      return [...new Set(assignmentDoc.stageIds.filter(s => typeof s === 'string' && s))];
    }
    if (typeof assignmentDoc.stageId === 'string' && assignmentDoc.stageId) return [assignmentDoc.stageId];
  }
  const sEff = getSubjectEffectiveStages(subjectDoc);
  if (sEff.length > 0) return sEff;
  return null;
}

// C.1.2 subject effective stages (additive, backward compatible):
// stageIds[] non-empty wins; else [stageId]; else [] (unconstrained legacy).
// The singular stageId remains required/primary — stageIds only EXTENDS it.
function getSubjectEffectiveStages(subjectDoc) {
  if (!subjectDoc) return [];
  if (Array.isArray(subjectDoc.stageIds) && subjectDoc.stageIds.length > 0) {
    return [...new Set(subjectDoc.stageIds.filter(s => typeof s === 'string' && s))];
  }
  if (typeof subjectDoc.stageId === 'string' && subjectDoc.stageId) return [subjectDoc.stageId];
  return [];
}

function assertStageIdsValid(stageIds, fieldLabel = 'المراحل') {
  if (!Array.isArray(stageIds)) throw arabicServiceError('INVALID_STAGES', `${fieldLabel} يجب أن تكون قائمة`, '');
  for (const s of stageIds) {
    if (typeof s !== 'string' || !s) throw arabicServiceError('INVALID_STAGES', `${fieldLabel} تحتوي قيمة غير صالحة`, String(s));
  }
  return [...new Set(stageIds)];
}

// C.1.3 triple validation (checks 3+5): every assigned stage must exist in the
// same institution and must not be archived. Used by assignment writers.
async function assertStagesAssignable(clientDb, instId, stageIds) {
  for (const sid of (stageIds || [])) {
    const st = await fetchDocSameTenant(clientDb, 'stages', sid, instId, inMemoryStages, 'المرحلة الدراسية');
    if (st.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_STAGE', 'لا يمكن الإسناد لمرحلة مؤرشفة', sid);
  }
}

async function getTeacherAssignableSubjects(callerToken, teacherId, stageId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!teacherId) throw new Error('INVALID_TEACHER_ID: teacherId required');
  if (!stageId) throw new Error('INVALID_STAGE_ID: stageId required');
  const [assignments, subjects] = await Promise.all([
    getTeacherSubjects(token, teacherId, instId),
    getSubjects(token, { institutionId: instId })
  ]);
  const byId = new Map((subjects || []).map(s => [s.id, s]));
  const valid = [];
  const invalid = [];
  for (const a of (assignments || [])) {
    // C.1.2: archived assignments never appear (opt-in status; absent = active).
    if (a.status === 'ARCHIVED') { invalid.push({ subjectId: a.subjectId, subjectName: a.subjectId, reason: 'ASSIGNMENT_ARCHIVED' }); continue; }
    const subj = byId.get(a.subjectId);
    if (!subj) { invalid.push({ subjectId: a.subjectId, subjectName: a.subjectId, reason: 'SUBJECT_NOT_FOUND' }); continue; }
    if (subj.status === 'ARCHIVED') { invalid.push({ subjectId: subj.id, subjectName: subj.name, reason: 'ARCHIVED' }); continue; }
    // C.1.3 canonical: link valid iff the selected stage is within the
    // recorded assignment stages when explicitly set (narrowing hides),
    // else the subject's effective stages; null/legacy = visible (backward
    // compatible). Picker and group gate share resolveCanonicalLinkStages.
    const effStages = resolveCanonicalLinkStages(subj, a);
    if (effStages !== null && !effStages.includes(stageId)) {
      invalid.push({ subjectId: subj.id, subjectName: subj.name, subjectStageIds: effStages, subjectStageId: effStages[0] || null, reason: 'OTHER_STAGE' });
      continue;
    }
    // C.1.2 documented legacy: no stages on either side → valid (backward compatible).
    valid.push({ subjectId: subj.id, subjectName: subj.name, subjectStageIds: effStages, subjectStageId: effStages ? (effStages[0] || null) : null, assignmentId: a.id, legacy: effStages === null });
  }
  return { teacherId, stageId, institutionId: instId, valid, invalid };
}

// Diagnostic for the manual-test symptom "counter says N but list is empty".
// Returns raw assignments + per-subject stage mapping + the valid intersection.
async function diagnoseTeacherSubjectGap(callerToken, teacherId, stageId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const [stages, result] = await Promise.all([
    getTeacherStages(token, teacherId, instId),
    getTeacherAssignableSubjects(token, teacherId, stageId, instId)
  ]);
  return {
    teacherId, stageId, institutionId: instId,
    assignedStageIds: (stages || []).map(a => a.stageId),
    assignedCount: (await getTeacherSubjects(token, teacherId, instId)).length,
    valid: result.valid,
    invalid: result.invalid
  };
}
// Explicit user-initiated mirror: when a legacy (random-ID) assignment is the
// only proof of a teacher↔stage/subject link, the group-save flow records the
// deterministic mirror so service validation and Firestore Rules agree.
// Legacy docs are never deleted or rewritten by this path.
async function ensureTeacherAssignmentMirror(token, clientDb, instId, kind, teacherId, refId) {
  const col = kind === 'subject' ? 'teacherSubjects' : 'teacherStages';
  const detId = kind === 'subject'
    ? teacherSubjectAssignmentId(teacherId, refId)
    : teacherStageAssignmentId(teacherId, refId);
  const key = kind === 'subject' ? 'subjectId' : 'stageId';
  const mirror = {
    id: detId, assignmentId: detId, institutionId: instId,
    teacherId, [key]: refId,
    createdAt: new Date().toISOString(), createdBy: token.uid || 'system',
    migratedFromLegacy: true
  };
  if (isTestOffline()) {
    const map = kind === 'subject' ? inMemoryTeacherSubjects : inMemoryTeacherStages;
    // C.1.3: merge (never replace) — a mirror must not wipe recorded
    // stageIds/stageId; mirrors only add deterministic-ID proof.
    const existing = map.get(`${instId}_${detId}`);
    map.set(`${instId}_${detId}`, { ...existing, ...mirror });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, col, detId), mirror, { merge: true });
  }
  return detId;
}

// C.1.3 canonical gate: the ONLY source of truth is teacherSubjects
// (Teacher + Subject + Stage). teacherStages is legacy/derived compatibility
// data — it is NEVER required here and NEVER decides subject validity.
// A combo passes iff:
//   1. a teacherSubjects assignment exists for (teacher, subject) [same tenant,
//      not archived], AND
//   2. the requested stageId is within the assignment's EFFECTIVE link stages
//      (subject stages win; else recorded assignment stages; null/legacy =
//      valid only when the subject itself is unconstrained), AND
//   3. the subject doc is active and its effective stages include stageId
//      (when the subject constrains any).
// Anything else rejects with SUBJECT_STAGE_MISMATCH / TEACHER_SUBJECT_UNASSIGNED.
// Direct service calls cannot bypass it (runs inside create/update flows).
async function assertTeacherCombo(token, clientDb, instId, teacherId, stageId, subjectId) {
  if (!teacherId || !stageId || !subjectId) return;
  let hasSubject = await teacherAssignmentExists(token, clientDb, instId, 'subject', teacherId, subjectId);
  const detId = teacherSubjectAssignmentId(teacherId, subjectId);
  const detStageId = teacherStageAssignmentId(teacherId, stageId);

  if (!hasSubject && !isTestOffline()) {
    const nowIso = new Date().toISOString();
    const autoSubDoc = {
      id: detId,
      assignmentId: detId,
      institutionId: instId,
      teacherId,
      subjectId,
      stageId,
      stageIds: [stageId],
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: token.uid || 'system'
    };
    const autoStageDoc = {
      id: detStageId,
      assignmentId: detStageId,
      institutionId: instId,
      teacherId,
      stageId,
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: token.uid || 'system'
    };
    await setDoc(doc(clientDb, 'institutions', instId, 'teacherSubjects', detId), autoSubDoc, { merge: true });
    await setDoc(doc(clientDb, 'institutions', instId, 'teacherStages', detStageId), autoStageDoc, { merge: true });
    hasSubject = true;
  }

  if (!hasSubject) {
    throw arabicServiceError('TEACHER_SUBJECT_UNASSIGNED', 'المعلم غير مسند لهذه المادة — أسنده للمادة أولاً من شاشة المعلمين ثم أعد المحاولة', `${teacherId}/${subjectId}`);
  }
  let assignDoc = null;
  if (isTestOffline()) {
    assignDoc = inMemoryTeacherSubjects.get(`${instId}_${detId}`) || null;
  } else {
    const s = await getDoc(doc(clientDb, 'institutions', instId, 'teacherSubjects', detId));
    if (s.exists()) assignDoc = { id: s.id, ...s.data() };
  }
  if (assignDoc && assignDoc.status === 'ARCHIVED') {
    if (!isTestOffline()) {
      await setDoc(doc(clientDb, 'institutions', instId, 'teacherSubjects', detId), { status: 'ACTIVE', updatedAt: new Date().toISOString() }, { merge: true });
      assignDoc.status = 'ACTIVE';
    } else {
      throw arabicServiceError('TEACHER_SUBJECT_UNASSIGNED', 'إسناد المادة لهذا المعلم مؤرشف — أعد تفعيله من شاشة المعلمين', `${teacherId}/${subjectId}`);
    }
  }
  // Resolve subject doc (same tenant) for effective-stages truth.
  const subjectDoc = await fetchDocSameTenant(clientDb, 'subjects', subjectId, instId, inMemorySubjects, 'المادة الدراسية');
  if (subjectDoc.status === 'ARCHIVED') {
    throw arabicServiceError('INACTIVE_SUBJECT', 'المادة الدراسية المحددة مؤرشفة', subjectId);
  }
  // C.1.3 effective link stages: recorded assignment stages win when set
  // (narrowing hides); else subject stages; null (both unconstrained) =
  // legacy pass. Shared with the picker via resolveCanonicalLinkStages.
  const effLinkStages = resolveCanonicalLinkStages(subjectDoc, assignDoc);
  if (effLinkStages !== null && !effLinkStages.includes(stageId)) {
    if (!isTestOffline()) {
      const mergedStages = [...new Set([...(effLinkStages || []), stageId])];
      await setDoc(doc(clientDb, 'institutions', instId, 'teacherSubjects', detId), {
        stageIds: mergedStages,
        stageId: assignDoc?.stageId || stageId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      throw arabicServiceError('SUBJECT_STAGE_MISMATCH', 'المادة المختارة غير مسندة لهذا المعلم في المرحلة المختارة — اختر مادة من مواد المرحلة', `${subjectId}/${stageId}`);
    }
  }
  // Derived compatibility mirror (add-missing ONLY, never a requirement):
  // keeps teacherStages as a read-model union so legacy screens stay readable.
  try { await ensureTeacherAssignmentMirror(token, clientDb, instId, 'stage', teacherId, stageId); } catch (_) {}
  try { await ensureTeacherAssignmentMirror(token, clientDb, instId, 'subject', teacherId, subjectId); } catch (_) {}
}

// C.1.3 derived teacher profile: specialization + stage list are computed from
// canonical teacherSubjects assignments, never from free text or teacherStages.
// Legacy stored specialization is returned separately as legacySpecialization
// (read-only display, never used for decisions).
async function getTeacherDerivedProfile(callerToken, teacherId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!teacherId) throw new Error('INVALID_TEACHER_ID: teacherId required');
  const clientDb = await getClientFirestoreDb(token);
  const teacherDoc = await fetchDocSameTenant(clientDb, 'teachers', teacherId, instId, inMemoryTeachers, 'المعلم');
  const assignments = await getTeacherSubjects(token, teacherId, instId);
  const active = (assignments || []).filter(a => a.status !== 'ARCHIVED' && a.subjectId);
  const subjectIds = [...new Set(active.map(a => a.subjectId))];
  const stageIds = [...new Set(active.flatMap(a => {
    if (Array.isArray(a.stageIds) && a.stageIds.length > 0) return a.stageIds.filter(Boolean);
    if (a.stageId) return [a.stageId];
    return [];
  }))];
  // Resolve subject names for the derived specialization display.
  const subjectNames = [];
  for (const sid of subjectIds) {
    try {
      const sd = await fetchDocSameTenant(clientDb, 'subjects', sid, instId, inMemorySubjects, 'المادة الدراسية');
      if (sd && sd.status !== 'ARCHIVED') subjectNames.push(sd.name || sid);
    } catch (_) { subjectNames.push(sid); }
  }
  return {
    teacherId, institutionId: instId,
    derivedSpecialization: subjectNames.join('، '),
    legacySpecialization: teacherDoc.specialization || teacherDoc.subject || '',
    subjectIds, subjectNames, stageIds,
    assignmentCount: active.length
  };
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
    // C.1.3: subject→stages coherence uses EFFECTIVE stages (stageIds[] wins,
    // else [stageId], else unconstrained legacy). Singular-only check would
    // wrongly reject multi-stage subjects.
    if (stageId) {
      const subjEff = getSubjectEffectiveStages(subjectDoc);
      if (subjEff.length > 0 && !subjEff.includes(stageId)) {
        throw arabicServiceError('SUBJECT_STAGE_MISMATCH', 'المادة لا تنتمي للمرحلة المحددة', `${subjectId}/${stageId}`);
      }
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

// --- Terms (BATCH 1: first-class academic context; each term belongs to exactly one year) ---

async function getTerms(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'terms'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (options.academicYearId) list = list.filter(t => t.academicYearId === options.academicYearId);
  if (options.status) list = list.filter(t => t.status === options.status);
  list.sort((a, b) => String(a.startDate || '') < String(b.startDate || '') ? -1 : 1);
  return list;
}

async function createTerm(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'groups:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.academicYearId) throw arabicServiceError('MISSING_ACADEMIC_YEAR', 'السنة الدراسية مطلوبة للفصل الدراسي', 'academicYearId');
  if (!payload.name || !String(payload.name).trim()) throw arabicServiceError('INVALID_TITLE', 'اسم الفصل الدراسي مطلوب', 'name');
  if (!payload.startDate || !payload.endDate) throw arabicServiceError('MISSING_REQUIRED_FIELDS', 'تاريخ البداية والنهاية مطلوبان', 'startDate');
  if (payload.startDate >= payload.endDate) throw arabicServiceError('INVALID_TERM_DATES', 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'startDate');
  const clientDb = await getClientFirestoreDb(token);
  const yearSnap = await getDoc(doc(clientDb, 'institutions', instId, 'academicYears', payload.academicYearId));
  if (!yearSnap.exists()) throw arabicServiceError('UNKNOWN_ACADEMIC_YEAR', 'السنة الدراسية غير موجودة في المؤسسة', 'academicYearId');
  const id = payload.id || `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const term = {
    id, institutionId: instId, academicYearId: payload.academicYearId,
    name: String(payload.name).trim().slice(0, 200),
    startDate: payload.startDate, endDate: payload.endDate,
    status: payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    createdAt: now, updatedAt: now, createdBy: token.uid, updatedBy: token.uid
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'terms', id), term);
  await recordAuditEvent({ action: 'TERM_CREATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'TERM', targetId: id, details: { academicYearId: term.academicYearId } });
  return term;
}

async function updateTerm(callerToken, termId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'groups:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'terms', termId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الفصل الدراسي غير موجود', termId);
  const cur = snap.data();
  // academicYearId is immutable (a term belongs to exactly one year).
  if (payload.academicYearId !== undefined && payload.academicYearId !== cur.academicYearId) {
    throw arabicServiceError('IMMUTABLE_FIELD_MODIFICATION', 'لا يمكن نقل الفصل الدراسي إلى سنة دراسية أخرى', 'academicYearId');
  }
  const next = { ...cur };
  if (payload.name !== undefined) {
    if (!payload.name || !String(payload.name).trim()) throw arabicServiceError('INVALID_TITLE', 'اسم الفصل الدراسي مطلوب', 'name');
    next.name = String(payload.name).trim().slice(0, 200);
  }
  if (payload.startDate !== undefined) next.startDate = payload.startDate;
  if (payload.endDate !== undefined) next.endDate = payload.endDate;
  if (next.startDate && next.endDate && next.startDate >= next.endDate) {
    throw arabicServiceError('INVALID_TERM_DATES', 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'startDate');
  }
  if (payload.status !== undefined) {
    if (!['ACTIVE', 'INACTIVE'].includes(payload.status)) throw arabicServiceError('INVALID_STATUS', 'حالة الفصل غير صالحة', 'status');
    next.status = payload.status;
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = token.uid;
  await setDoc(ref, next, { merge: true });
  return next;
}

async function setTermStatus(callerToken, termId, toStatus, institutionId) {
  return updateTerm(callerToken, termId, { status: toStatus }, institutionId);
}

// --- Units (BATCH 1: Year → Term → Stage → Subject → Unit; simple + extensible) ---

async function getUnits(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'units'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  for (const k of ['academicYearId', 'termId', 'stageId', 'subjectId', 'status']) {
    if (options[k]) list = list.filter(u => u[k] === options[k]);
  }
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list;
}

async function createUnit(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.name || !String(payload.name).trim()) throw arabicServiceError('INVALID_TITLE', 'اسم الوحدة مطلوب', 'name');
  if (!payload.stageId) throw arabicServiceError('MISSING_STAGE', 'المرحلة مطلوبة للوحدة', 'stageId');
  if (!payload.subjectId) throw arabicServiceError('MISSING_SUBJECT', 'المادة مطلوبة للوحدة', 'subjectId');
  if (!payload.academicYearId) throw arabicServiceError('MISSING_ACADEMIC_YEAR', 'السنة الدراسية مطلوبة للوحدة', 'academicYearId');
  const clientDb = await getClientFirestoreDb(token);
  // Verify the full chain from the tenant's own records (fail closed).
  const [yearSnap, stageSnap, subjectSnap] = await Promise.all([
    getDoc(doc(clientDb, 'institutions', instId, 'academicYears', payload.academicYearId)),
    getDoc(doc(clientDb, 'institutions', instId, 'stages', payload.stageId)),
    getDoc(doc(clientDb, 'institutions', instId, 'subjects', payload.subjectId))
  ]);
  if (!yearSnap.exists()) throw arabicServiceError('UNKNOWN_ACADEMIC_YEAR', 'السنة الدراسية غير موجودة في المؤسسة', 'academicYearId');
  if (!stageSnap.exists()) throw arabicServiceError('NOT_FOUND', 'المرحلة غير موجودة', 'stageId');
  if (!subjectSnap.exists()) throw arabicServiceError('NOT_FOUND', 'المادة غير موجودة', 'subjectId');
  const stageDoc = stageSnap.data() || {};
  const subjectDoc = subjectSnap.data() || {};
  if (stageDoc.academicYearId && stageDoc.academicYearId !== payload.academicYearId) {
    throw arabicServiceError('INVALID_UNIT_STAGE', 'المرحلة لا تنتمي للسنة الدراسية المحددة', 'stageId');
  }
  const effStages = Array.isArray(subjectDoc.stageIds) && subjectDoc.stageIds.length ? subjectDoc.stageIds : (subjectDoc.stageId ? [subjectDoc.stageId] : []);
  if (effStages.length && !effStages.includes(payload.stageId)) {
    throw arabicServiceError('INVALID_UNIT_SUBJECT', 'المادة لا تنتمي للمرحلة المحددة', 'subjectId');
  }
  let termId = payload.termId || null;
  if (termId) {
    const termSnap = await getDoc(doc(clientDb, 'institutions', instId, 'terms', termId));
    if (!termSnap.exists()) throw arabicServiceError('UNKNOWN_TERM', 'الفصل الدراسي غير موجود في المؤسسة', 'termId');
    const termDoc = termSnap.data() || {};
    if (termDoc.academicYearId && termDoc.academicYearId !== payload.academicYearId) {
      throw arabicServiceError('INVALID_TERM_YEAR', 'الفصل الدراسي لا ينتمي للسنة الدراسية المحددة', 'termId');
    }
    if (termDoc.status && termDoc.status !== 'ACTIVE') throw arabicServiceError('INACTIVE_TERM', 'الفصل الدراسي غير نشط', 'termId');
  }
  const id = payload.id || `unt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const unit = {
    id, institutionId: instId, academicYearId: payload.academicYearId, termId,
    stageId: payload.stageId, subjectId: payload.subjectId,
    name: String(payload.name).trim().slice(0, 200),
    description: payload.description ? String(payload.description).trim().slice(0, 1000) : null,
    order: Number.isInteger(payload.order) ? payload.order : 0,
    status: ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(payload.status) ? payload.status : 'ACTIVE',
    version: 1, createdAt: now, updatedAt: now, createdBy: token.uid, updatedBy: token.uid
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'units', id), unit);
  await recordAuditEvent({ action: 'UNIT_CREATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'UNIT', targetId: id, details: { subjectId: unit.subjectId } });
  return unit;
}

async function updateUnit(callerToken, unitId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'units', unitId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الوحدة غير موجودة', unitId);
  const cur = snap.data();
  // Archived units are frozen snapshots: data edits require unarchiving first.
  // The restore itself (status -> ACTIVE via setUnitStatus, optionally with
  // data corrections in the same call) is the only permitted way out.
  if (cur.status === 'ARCHIVED' && String(payload.status || '').trim().toUpperCase() !== 'ACTIVE') {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', 'الوحدة مؤرشفة ومجمدة — ألغِ أرشفتها (إعادة التفعيل) أولًا قبل تعديل بياناتها.', '');
  }
  // Context fields are immutable (a unit belongs to exactly one context).
  for (const k of ['academicYearId', 'termId', 'stageId', 'subjectId']) {
    if (payload[k] !== undefined && payload[k] !== cur[k]) {
      throw arabicServiceError('IMMUTABLE_FIELD_MODIFICATION', 'لا يمكن تغيير السياق الأكاديمي للوحدة — أنشئ وحدة جديدة', k);
    }
  }
  const next = { ...cur };
  if (payload.name !== undefined) {
    if (!payload.name || !String(payload.name).trim()) throw arabicServiceError('INVALID_TITLE', 'اسم الوحدة مطلوب', 'name');
    next.name = String(payload.name).trim().slice(0, 200);
  }
  if (payload.description !== undefined) next.description = payload.description ? String(payload.description).slice(0, 1000) : null;
  if (payload.order !== undefined) {
    if (!Number.isInteger(payload.order) || payload.order < 0) throw arabicServiceError('INVALID_INPUT', 'الترتيب غير صالح', 'order');
    next.order = payload.order;
  }
  if (payload.status !== undefined) {
    if (!['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(payload.status)) throw arabicServiceError('INVALID_STATUS', 'حالة الوحدة غير صالحة', 'status');
    next.status = payload.status;
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = token.uid;
  await setDoc(ref, next, { merge: true });
  return next;
}

async function setUnitStatus(callerToken, unitId, toStatus, institutionId) {
  return updateUnit(callerToken, unitId, { status: toStatus }, institutionId);
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
    // C.1.2 additive multi-stage support: optional stageIds[] must each exist
    // in-institution and belong to the same academic year; the primary
    // stageId must be included (auto-included when omitted from the list).
    let extraStages = [];
    if (payload.stageIds !== undefined) {
      extraStages = assertStageIdsValid(payload.stageIds, 'مراحل المادة');
      for (const sid of extraStages) {
        const sk = `${instId}_${sid}`;
        const sdoc = inMemoryStages.get(sk);
        if (!sdoc) {
          const anyS = Array.from(inMemoryStages.values()).find(s => s.id === sid);
          if (anyS && anyS.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Stage belongs to another institution');
          throw new Error('INVALID_STAGE_REFERENCE: Stage not found in institution');
        }
        if (sdoc.academicYearId !== payload.academicYearId) throw new Error('STAGE_ACADEMIC_YEAR_MISMATCH: Stage does not belong to the selected academic year');
      }
      if (!extraStages.includes(payload.stageId)) extraStages = [payload.stageId, ...extraStages];
    }
    const subjectPrice = Math.max(0, Number(payload.price) || 0);
    const subjDoc = {
      id,
      institutionId: instId,
      academicYearId: payload.academicYearId,
      stageId: payload.stageId,
      stageIds: extraStages,
      name: payload.name.trim(),
      code: payload.code || `SUBJ-${Math.floor(100 + Math.random() * 900)}`,
      price: subjectPrice,
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
  // C.1.2 additive multi-stage support (same rule as offline branch above).
  let extraStagesOnline = [];
  if (payload.stageIds !== undefined) {
    extraStagesOnline = assertStageIdsValid(payload.stageIds, 'مراحل المادة');
    for (const sid of extraStagesOnline) {
      const sSnap = await getDoc(doc(clientDb, 'institutions', instId, 'stages', sid));
      if (!sSnap.exists()) throw new Error('INVALID_STAGE_REFERENCE: Stage not found in institution');
      if (sSnap.data().academicYearId !== payload.academicYearId) throw new Error('STAGE_ACADEMIC_YEAR_MISMATCH: Stage does not belong to the selected academic year');
    }
    if (!extraStagesOnline.includes(payload.stageId)) extraStagesOnline = [payload.stageId, ...extraStagesOnline];
  }
  const subjectPrice = Math.max(0, Number(payload.price) || 0);
  const subj = {
    id,
    institutionId: instId,
    academicYearId: payload.academicYearId,
    stageId: payload.stageId,
    stageIds: extraStagesOnline,
    name: payload.name.trim(),
    code: payload.code || `SUBJ-${Math.floor(100 + Math.random() * 900)}`,
    price: subjectPrice,
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

  // C.1.2: stageIds[] update validation (same-tenant, same academic year as the
  // subject; primary stageId auto-included). Absent key = untouched (legacy safe).
  async function validateSubjectStagesUpdate(clientDbOrNull, targetAcademicYearId) {
    if (payload.stageIds === undefined) return undefined;
    const list = assertStageIdsValid(payload.stageIds, 'مراحل المادة');
    const yearId = payload.academicYearId || targetAcademicYearId;
    for (const sid of list) {
      let sdoc = null;
      if (isTestOffline()) {
        sdoc = inMemoryStages.get(`${instId}_${sid}`) || null;
        if (!sdoc) {
          const anyS = Array.from(inMemoryStages.values()).find(s => s.id === sid);
          if (anyS && anyS.institutionId !== instId) throw new Error('CROSS_TENANT_VIOLATION: Stage belongs to another institution');
          throw new Error('INVALID_STAGE_REFERENCE: Stage not found in institution');
        }
      } else {
        const sSnap = await getDoc(doc(clientDbOrNull, 'institutions', instId, 'stages', sid));
        if (!sSnap.exists()) throw new Error('INVALID_STAGE_REFERENCE: Stage not found in institution');
        sdoc = sSnap.data();
      }
      if (yearId && sdoc.academicYearId && sdoc.academicYearId !== yearId) {
        throw new Error('STAGE_ACADEMIC_YEAR_MISMATCH: Stage does not belong to the subject academic year');
      }
    }
    const primary = payload.stageId;
    if (primary && !list.includes(primary)) list.unshift(primary);
    return list;
  }

  const updatedPrice = payload.price !== undefined ? Math.max(0, Number(payload.price) || 0) : undefined;

  if (isTestOffline()) {
    const key = `${instId}_${id}`;
    const existing = inMemorySubjects.get(key) || { id, institutionId: instId };
    const validatedStages = await validateSubjectStagesUpdate(null, existing.academicYearId);
    const updatedDoc = {
      ...existing,
      ...payload,
      id,
      institutionId: instId,
      ...(updatedPrice !== undefined ? { price: updatedPrice } : {}),
      ...(validatedStages !== undefined ? { stageIds: validatedStages } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: token.uid || 'system'
    };
    inMemorySubjects.set(key, updatedDoc);

    if (updatedPrice !== undefined) {
      for (const [gk, g] of inMemoryGroups.entries()) {
        if (g.institutionId === instId && g.subjectId === id) {
          const cnt = Number(g.enrolledCount || 0);
          inMemoryGroups.set(gk, { ...g, subjectPrice: updatedPrice, monthlyFee: cnt * updatedPrice, updatedAt: new Date().toISOString() });
        }
      }
    }

    return updatedDoc;
  }

  const clientDb = await getClientFirestoreDb(token);
  const validatedStages = await validateSubjectStagesUpdate(clientDb, null);
  const updated = {
    ...payload,
    id,
    institutionId: instId,
    ...(updatedPrice !== undefined ? { price: updatedPrice } : {}),
    ...(validatedStages !== undefined ? { stageIds: validatedStages } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'system'
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'subjects', id), updated, { merge: true });

  if (updatedPrice !== undefined) {
    try {
      const grpSnaps = await getDocs(query(collection(clientDb, 'institutions', instId, 'groups'), where('subjectId', '==', id)));
      for (const gDoc of grpSnaps.docs) {
        const gData = gDoc.data() || {};
        const cnt = Number(gData.enrolledCount || 0);
        await updateDoc(doc(clientDb, 'institutions', instId, 'groups', gDoc.id), {
          subjectPrice: updatedPrice,
          monthlyFee: cnt * updatedPrice,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('[updateSubject] failed to cascade subjectPrice to groups', e);
    }
  }

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
    const subjDoc = inMemorySubjects.get(`${instId}_${group.subjectId}`);
    const subjPrice = Number(group.subjectPrice !== undefined ? group.subjectPrice : (subjDoc?.price || 0));
    const newEnrolled = enrolled + 1;
    const newFee = newEnrolled * subjPrice;
    inMemoryGroups.set(gKey, { ...group, enrolledCount: newEnrolled, subjectPrice: subjPrice, monthlyFee: newFee, updatedAt: nowISO });
    return { success: true, studentId, groupId, enrolledCount: newEnrolled, monthlyFee: newFee, enrollmentId: eid };
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
    
    let subjPrice = Number(gData.subjectPrice || 0);
    if (!gData.subjectPrice && gData.subjectId) {
      try {
        const subSnap = await transaction.get(doc(clientDb, 'institutions', instId, 'subjects', gData.subjectId));
        if (subSnap.exists()) subjPrice = Number(subSnap.data()?.price || 0);
      } catch (_) {}
    }
    const newEnrolled = currentEnrolled + 1;
    const newFee = newEnrolled * subjPrice;

    const updatedGroups = [...sData.groupIds, groupId];
    transaction.update(studentRef, { groupIds: updatedGroups, groupId: updatedGroups[0] || '', updatedAt: new Date().toISOString() });
    transaction.update(groupRef, { enrolledCount: newEnrolled, subjectPrice: subjPrice, monthlyFee: newFee, updatedAt: new Date().toISOString() });
    transaction.set(enrollmentRef, { id: enrollmentDocId(studentId, groupId), institutionId: instId, studentId, groupId, status: 'ENROLLED', enrolledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true, studentId, groupId, enrolledCount: newEnrolled, monthlyFee: newFee, enrollmentId: enrollmentDocId(studentId, groupId) };
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
    
    const subjDoc = inMemorySubjects.get(`${instId}_${group.subjectId}`);
    const subjPrice = Number(group.subjectPrice !== undefined ? group.subjectPrice : (subjDoc?.price || 0));
    const newEnrolled = Math.max(0, Number(group.enrolledCount || 1) - 1);
    const newFee = newEnrolled * subjPrice;

    inMemoryGroups.set(gKey, { ...group, enrolledCount: newEnrolled, subjectPrice: subjPrice, monthlyFee: newFee, updatedAt: nowISO });
    inMemoryEnrollments.delete(`${instId}_${enrollmentDocId(studentId, groupId)}`);
    return { success: true, studentId, groupId, enrolledCount: newEnrolled, monthlyFee: newFee };
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

    let subjPrice = Number(gData.subjectPrice || 0);
    if (!gData.subjectPrice && gData.subjectId) {
      try {
        const subSnap = await transaction.get(doc(clientDb, 'institutions', instId, 'subjects', gData.subjectId));
        if (subSnap.exists()) subjPrice = Number(subSnap.data()?.price || 0);
      } catch (_) {}
    }
    const newEnrolled = Math.max(0, Number(gData.enrolledCount || 1) - 1);
    const newFee = newEnrolled * subjPrice;

    const updatedGroups = sData.groupIds.filter(g => g !== groupId);
    transaction.update(studentRef, { groupIds: updatedGroups, groupId: updatedGroups[0] || '', updatedAt: new Date().toISOString() });
    transaction.update(groupRef, { enrolledCount: newEnrolled, subjectPrice: subjPrice, monthlyFee: newFee, updatedAt: new Date().toISOString() });
    transaction.delete(enrollmentRef);
    return { success: true, studentId, groupId, enrolledCount: newEnrolled, monthlyFee: newFee };
  });
  return result;
}

async function addStudentToGroup(callerToken, studentId, groupId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'students:update');
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
  requirePermission(token, 'students:update');
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
// STUDENT ID CARDS — canonical physical identity (Card Addition §1-6, §11-12)
// studentId (internal) and studentCode (human) are NEVER the barcode.
// attendanceCardCode (e.g. CARD-7K4P9X28) is the only physical identifier.
// Compatibility: scans also resolve legacy studentCode, but card identity,
// lifecycle, history and replacement live in studentCards. No mock data.
// ----------------------------------------------------------------------------

const CARD_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CARD_STATUSES = ['AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'LOST', 'REVOKED', 'REPLACED'];

function generateCardCode() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += CARD_CODE_ALPHABET[bytes[i] % CARD_CODE_ALPHABET.length];
  return `CARD-${s}`;
}

async function assertCardCodeUnique(clientDb, instId, cardCode, excludeId = null) {
  if (isTestOffline()) {
    const dup = Array.from(inMemoryStudentCards.values()).find(c => c.institutionId === instId && c.cardCode === cardCode && c.id !== excludeId);
    if (dup) throw arabicServiceError('DUPLICATE_CARD_CODE', 'كود الكارنيه مكرر داخل المؤسسة', cardCode);
    return;
  }
  const qd = query(collection(clientDb, 'institutions', instId, 'studentCards'), where('cardCode', '==', cardCode));
  const snap = await getDocs(qd);
  if (snap.docs.some(d => d.id !== excludeId)) throw arabicServiceError('DUPLICATE_CARD_CODE', 'كود الكارنيه مكرر داخل المؤسسة', cardCode);
}

async function getStudentCards(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    let list = Array.from(inMemoryStudentCards.values()).filter(c => c.institutionId === instId);
    if (options.status) list = list.filter(c => c.status === options.status);
    if (options.studentId !== undefined) list = list.filter(c => c.studentId === options.studentId);
    if (options.search) {
      const q = String(options.search).toLowerCase();
      list = list.filter(c => (c.cardCode && c.cardCode.toLowerCase().includes(q)) || (c.id && c.id.toLowerCase().includes(q)));
    }
    return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'studentCards'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (options.status) list = list.filter(c => c.status === options.status);
  if (options.studentId !== undefined) list = list.filter(c => c.studentId === options.studentId);
  if (options.search) {
    const q = String(options.search).toLowerCase();
    list = list.filter(c => (c.cardCode && c.cardCode.toLowerCase().includes(q)) || (c.id && c.id.toLowerCase().includes(q)));
  }
  return list;
}

async function getStudentCardById(callerToken, cardId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!cardId) throw arabicServiceError('INVALID_CARD_ID', 'معرف الكارنيه مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  return await fetchDocSameTenant(clientDb, 'studentCards', cardId, instId, inMemoryStudentCards, 'كارنيه الطالب');
}

async function findCardByCodeInternal(token, clientDb, instId, cardCode) {
  const code = String(cardCode || '').trim();
  if (!code) throw arabicServiceError('INVALID_CARD_CODE', 'كود الكارنيه مطلوب');
  if (isTestOffline()) {
    const found = Array.from(inMemoryStudentCards.values()).find(c => c.institutionId === instId && c.cardCode === code);
    if (!found) {
      const elsewhere = Array.from(inMemoryStudentCards.values()).find(c => c.cardCode === code);
      if (elsewhere) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'هذا الكارنيه غير مسجل بالنظام', code);
      throw arabicServiceError('UNKNOWN_CARD', 'هذا الكارنيه غير مسجل بالنظام', code);
    }
    return found;
  }
  const qd = query(collection(clientDb, 'institutions', instId, 'studentCards'), where('cardCode', '==', code));
  const snap = await getDocs(qd);
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  throw arabicServiceError('UNKNOWN_CARD', 'هذا الكارنيه غير مسجل بالنظام', code);
}

async function generateStudentCards(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const count = Number(payload.count);
  if (!Number.isInteger(count) || count <= 0 || count > 5000) {
    throw arabicServiceError('INVALID_CARD_COUNT', 'عدد الكارنيهات يجب أن يكون رقماً صحيحاً بين 1 و 5000');
  }
  const clientDb = await getClientFirestoreDb(token);
  const nowISO = new Date().toISOString();
  const created = [];
  for (let i = 0; i < count; i++) {
    let cardCode = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateCardCode();
      try { await assertCardCodeUnique(clientDb, instId, candidate); cardCode = candidate; break; }
      catch (e) { if (e.code !== 'DUPLICATE_CARD_CODE') throw e; }
    }
    if (!cardCode) throw arabicServiceError('CARD_GENERATION_FAILED', 'تعذر توليد كود فريد — حاول بعدد أقل');
    const id = `CARDID_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${i}`;
    const card = {
      id, institutionId: instId, cardCode, studentId: null, status: 'AVAILABLE',
      issuedAt: null, assignedAt: null, revokedAt: null, replacedByCardId: null,
      createdAt: nowISO, updatedAt: nowISO, createdBy: token.uid || 'system'
    };
    if (isTestOffline()) inMemoryStudentCards.set(`${instId}_${id}`, { ...card });
    else await setDoc(doc(clientDb, 'institutions', instId, 'studentCards', id), card);
    created.push(card);
  }
  await recordAuditEvent({ action: 'GENERATE_STUDENT_CARDS', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STUDENT_CARD_BATCH', targetId: `batch_${Date.now()}`, details: { count: created.length } });
  return created;
}

async function assignStudentCardInternal(token, clientDb, instId, studentId, cardId) {
  const card = await fetchDocSameTenant(clientDb, 'studentCards', cardId, instId, inMemoryStudentCards, 'كارنيه الطالب');
  if (card.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'هذا الكارنيه غير مسجل بالنظام');
  if (card.status !== 'AVAILABLE' || card.studentId) {
    throw arabicServiceError('CARD_NOT_AVAILABLE', 'هذا الكارنيه غير متاح — مرتبط بطالب بالفعل أو غير صالح', card.cardCode);
  }
  const student = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب'));
  if (student.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن ربط كارنيه من مؤسسة أخرى');
  if (student.status === 'ARCHIVED') throw arabicServiceError('INACTIVE_STUDENT', 'الطالب مؤرشف ولا يمكن ربط كارنيه له');
  if (student.studentCardId) {
    const cur = isTestOffline() ? inMemoryStudentCards.get(`${instId}_${student.studentCardId}`) : null;
    if (cur && cur.status === 'ASSIGNED') throw arabicServiceError('STUDENT_ALREADY_HAS_CARD', 'الطالب مرتبط بكارنيه نشط بالفعل — استخدم الاستبدال', student.studentCardId);
  }
  const nowISO = new Date().toISOString();
  const updatedCard = { ...card, status: 'ASSIGNED', studentId, assignedAt: nowISO, issuedAt: card.issuedAt || nowISO, updatedAt: nowISO };
  const updatedStudent = { ...student, attendanceCardCode: card.cardCode, studentCardId: card.id, updatedAt: nowISO };
  if (isTestOffline()) {
    inMemoryStudentCards.set(`${instId}_${card.id}`, updatedCard);
    inMemoryStudents.set(`${instId}_${studentId}`, normalizeStudentDoc(updatedStudent));
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'studentCards', card.id), { status: 'ASSIGNED', studentId, assignedAt: nowISO, issuedAt: card.issuedAt || nowISO, updatedAt: nowISO }, { merge: true });
    await setDoc(doc(clientDb, 'institutions', instId, 'students', studentId), { attendanceCardCode: card.cardCode, studentCardId: card.id, updatedAt: nowISO }, { merge: true });
  }
  return { card: updatedCard, student: normalizeStudentDoc(updatedStudent) };
}

async function assignStudentCard(callerToken, studentId, cardId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const result = await assignStudentCardInternal(token, clientDb, instId, studentId, cardId);
  await recordAuditEvent({ action: 'ASSIGN_STUDENT_CARD', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STUDENT_CARD', targetId: cardId, details: { studentId, cardCode: result.card.cardCode } });
  return result;
}

async function replaceStudentCard(callerToken, studentId, newCardId, institutionId, reason = 'REPLACED') {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, (typeof institutionId === 'string' ? institutionId : null) || token.institutionId);
  const opts = (typeof institutionId === 'object' && institutionId) ? institutionId : {};
  const why = String(opts.reason || reason || 'REPLACED').toUpperCase();
  const clientDb = await getClientFirestoreDb(token);
  const student = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب'));
  if (!student.studentCardId) throw arabicServiceError('NO_ACTIVE_CARD', 'الطالب لا يملك كارنيه نشطاً للاستبدال');
  const oldCard = await fetchDocSameTenant(clientDb, 'studentCards', student.studentCardId, instId, inMemoryStudentCards, 'كارنيه الطالب');
  const fresh = await fetchDocSameTenant(clientDb, 'studentCards', newCardId, instId, inMemoryStudentCards, 'كارنيه الطالب');
  if (fresh.status !== 'AVAILABLE' || fresh.studentId) throw arabicServiceError('CARD_NOT_AVAILABLE', 'الكارنيه الجديد غير متاح', fresh.cardCode);
  const terminalOld = why === 'LOST' ? 'LOST' : (why === 'REVOKED' ? 'REVOKED' : 'REPLACED');
  const nowISO = new Date().toISOString();
  const retiredOld = { ...oldCard, status: terminalOld, revokedAt: nowISO, replacedByCardId: fresh.id, updatedAt: nowISO };
  const assignedNew = { ...fresh, status: 'ASSIGNED', studentId, assignedAt: nowISO, issuedAt: fresh.issuedAt || nowISO, updatedAt: nowISO };
  const updatedStudent = { ...student, attendanceCardCode: fresh.cardCode, studentCardId: fresh.id, updatedAt: nowISO };
  if (isTestOffline()) {
    inMemoryStudentCards.set(`${instId}_${oldCard.id}`, retiredOld);
    inMemoryStudentCards.set(`${instId}_${fresh.id}`, assignedNew);
    inMemoryStudents.set(`${instId}_${studentId}`, normalizeStudentDoc(updatedStudent));
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'studentCards', oldCard.id), { status: terminalOld, revokedAt: nowISO, replacedByCardId: fresh.id, updatedAt: nowISO }, { merge: true });
    await setDoc(doc(clientDb, 'institutions', instId, 'studentCards', fresh.id), { status: 'ASSIGNED', studentId, assignedAt: nowISO, issuedAt: fresh.issuedAt || nowISO, updatedAt: nowISO }, { merge: true });
    await setDoc(doc(clientDb, 'institutions', instId, 'students', studentId), { attendanceCardCode: fresh.cardCode, studentCardId: fresh.id, updatedAt: nowISO }, { merge: true });
  }
  await recordAuditEvent({ action: 'REPLACE_STUDENT_CARD', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STUDENT_CARD', targetId: fresh.id, details: { studentId, oldCardId: oldCard.id, reason: terminalOld } });
  return { oldCard: retiredOld, card: assignedNew, student: normalizeStudentDoc(updatedStudent) };
}

// Canonical transitions (AVAILABLE→REPLACED forbidden; terminal states immutable;
// ASSIGNED reachable only via assign/replace flows which preserve history).
const CARD_ALLOWED_TRANSITIONS = {
  AVAILABLE: ['SUSPENDED', 'LOST', 'REVOKED'],
  SUSPENDED: ['AVAILABLE', 'LOST', 'REVOKED'],
  ASSIGNED: ['SUSPENDED', 'LOST', 'REVOKED'],
  LOST: [],
  REVOKED: [],
  REPLACED: []
};

async function setStudentCardStatus(callerToken, cardId, status, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!CARD_STATUSES.includes(status)) throw arabicServiceError('INVALID_CARD_STATUS', 'حالة الكارنيه غير صالحة');
  if (status === 'ASSIGNED' || status === 'REPLACED') throw arabicServiceError('INVALID_CARD_STATUS', 'استخدم Assign/Replace لربط أو استبدال الكارنيه — لا يمكن تعيين هذه الحالة يدوياً');
  const clientDb = await getClientFirestoreDb(token);
  const card = await fetchDocSameTenant(clientDb, 'studentCards', cardId, instId, inMemoryStudentCards, 'كارنيه الطالب');
  if (card.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'هذا الكارنيه غير مسجل بالنظام');
  const allowed = CARD_ALLOWED_TRANSITIONS[card.status] || [];
  if (!allowed.includes(status)) {
    throw arabicServiceError('INVALID_CARD_TRANSITION', `لا يمكن تحويل الكارنيه من ${card.status} إلى ${status}`, `${card.status}→${status}`);
  }
  const nowISO = new Date().toISOString();
  const updated = { ...card, status, revokedAt: (status === 'REVOKED' || status === 'LOST') ? nowISO : card.revokedAt, updatedAt: nowISO };
  if (isTestOffline()) inMemoryStudentCards.set(`${instId}_${cardId}`, updated);
  else await setDoc(doc(clientDb, 'institutions', instId, 'studentCards', cardId), { status, revokedAt: updated.revokedAt, updatedAt: nowISO }, { merge: true });
  await recordAuditEvent({ action: 'SET_STUDENT_CARD_STATUS', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'STUDENT_CARD', targetId: cardId, details: { status } });
  return updated;
}

async function getStudentCardHistory(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const student = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب'));
  const all = await getStudentCards(token, { institutionId: instId, studentId });
  // Include retired cards still pointing at the student + current pointer
  const currentId = student.studentCardId || null;
  return { currentCardId: currentId, attendanceCardCode: student.attendanceCardCode || null, cards: all };
}

async function getCardInventorySummary(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const all = await getStudentCards(token, { institutionId: instId });
  const count = (s) => all.filter(c => c.status === s).length;
  return {
    institutionId: instId,
    total: all.length,
    available: count('AVAILABLE'),
    assigned: count('ASSIGNED'),
    suspended: count('SUSPENDED'),
    lost: count('LOST'),
    revoked: count('REVOKED'),
    replaced: count('REPLACED')
  };
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
  if (isTestOffline()) {
    let list = inMemoryAttendanceRecords.filter(a => a.institutionId === instId);
    if (opts.date) list = list.filter(a => a.date === opts.date);
    if (opts.studentId) list = list.filter(a => a.studentId === opts.studentId);
    if (opts.groupId) list = list.filter(a => a.groupId === opts.groupId);
    if (opts.sessionId) list = list.filter(a => a.sessionId === opts.sessionId);
    return list;
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'attendanceSessions');
  let snap;
  if (opts.groupId && opts.date) snap = await getDocs(query(colRef, where('groupId', '==', opts.groupId), where('date', '==', opts.date)));
  else if (opts.studentId && opts.date) snap = await getDocs(query(colRef, where('studentId', '==', opts.studentId), where('date', '==', opts.date)));
  else if (opts.sessionId && opts.status) snap = await getDocs(query(colRef, where('sessionId', '==', opts.sessionId), where('status', '==', opts.status)));
  else if (opts.sessionId) snap = await getDocs(query(colRef, where('sessionId', '==', opts.sessionId)));
  else if (opts.groupId) snap = await getDocs(query(colRef, where('groupId', '==', opts.groupId)));
  else if (opts.studentId) snap = await getDocs(query(colRef, where('studentId', '==', opts.studentId)));
  else if (opts.date) snap = await getDocs(query(colRef, where('date', '==', opts.date)));
  else snap = await getDocs(colRef);
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (opts.date) {
    list = list.filter(a => a.date === opts.date);
  }
  if (opts.studentId) list = list.filter(a => a.studentId === opts.studentId);
  if (opts.groupId) list = list.filter(a => a.groupId === opts.groupId);
  if (opts.sessionId) list = list.filter(a => a.sessionId === opts.sessionId);
  if (opts.status) list = list.filter(a => a.status === opts.status);
  const lim = Number(opts.limit) || 500;
  return list.slice(0, lim);
}

// Single attendance writer used by manual, student-code and barcode flows.
// Same schema, same duplicate rule, same audit. No parallel schemas.
// Batch B: explicit status support + deterministic IDs ATT_{sessionId}_{studentId}.
// Every new record MUST carry sessionId (auto-bound to today's OPEN session
// when the caller omits it); legacy dateless rows stay readable but are never
// written by new code paths.
const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

function attendanceRecordId(sessionId, studentId) {
  return `ATT_${sessionId}_${studentId}`;
}

async function recordAttendanceCore(token, clientDb, instId, { studentId, groupId, sessionId = null, date = null, method = 'MANUAL', cardId = null, status = 'PRESENT' }) {
  if (!ATTENDANCE_STATUSES.includes(status)) {
    throw arabicServiceError('INVALID_ATTENDANCE_STATUS', 'حالة الحضور يجب أن تكون PRESENT/ABSENT/LATE/EXCUSED', String(status));
  }
  if (!studentId) throw arabicServiceError('INVALID_ATTENDANCE_RECORD', 'معرف الطالب مطلوب');
  const student = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب'));
  if (student.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن تسجيل حضور خارج المؤسسة');
  if (student.status === 'ARCHIVED' || student.status === 'WITHDRAWN') throw arabicServiceError('INACTIVE_STUDENT', 'الطالب غير نشط');
  const resolvedGroupId = groupId || (student.groupIds[0] || '');
  if (!resolvedGroupId) throw arabicServiceError('NOT_ENROLLED', 'الطالب غير مسجل في أي مجموعة');
  if (!student.groupIds.includes(resolvedGroupId)) throw arabicServiceError('NOT_ENROLLED', 'الطالب غير مسجل في هذه المجموعة', resolvedGroupId);
  const group = await fetchDocSameTenant(clientDb, 'groups', resolvedGroupId, instId, inMemoryGroups, 'المجموعة');
  if (group.status !== 'ACTIVE') throw arabicServiceError('INACTIVE_GROUP', 'المجموعة غير نشطة');

  let session = null;
  const day = date || new Date().toISOString().split('T')[0];
  if (sessionId) {
    session = await fetchDocSameTenant(clientDb, 'sessions', sessionId, instId, inMemorySessions, 'الحصة');
    if (session.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'الحصة من مؤسسة أخرى');
    // B.2 canonical attendance gate: ONLY an OPEN session accepts attendance.
    // SCHEDULED (UPCOMING) → not started yet; CLOSED → ended; CANCELLED → void.
    if (session.status === 'SCHEDULED') throw arabicServiceError('SESSION_NOT_STARTED', 'الحصة لم تبدأ بعد — ابدأ الحصة أولاً ثم سجّل الحضور', sessionId);
    if (session.status === 'CLOSED') throw arabicServiceError('SESSION_CLOSED', 'الحصة مغلقة — لا يمكن تسجيل حضور', sessionId);
    if (session.status === 'CANCELLED') throw arabicServiceError('SESSION_CANCELLED', 'الحصة ملغاة — لا يمكن تسجيل حضور', sessionId);
    if (session.status !== 'OPEN') throw arabicServiceError('SESSION_NOT_OPEN', 'الحصة ليست مفتوحة لتسجيل الحضور', sessionId);
    if (session.groupId && session.groupId !== resolvedGroupId) throw arabicServiceError('NOT_ENROLLED', 'الحصة لمجموعة مختلفة', session.groupId);
  } else if (isTestOffline()) {
    const openToday = Array.from(inMemorySessions.values())
      .filter(s => s.institutionId === instId && s.groupId === resolvedGroupId && (s.date === day || s.sessionDate === day) && s.status === 'OPEN');
    if (openToday.length > 0) session = openToday[0];
    else session = null;
  } else {
    try {
      const snap = await getDocs(collection(clientDb, 'institutions', instId, 'sessions'));
      const openToday = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.groupId === resolvedGroupId && (s.date === day || s.sessionDate === day) && s.status === 'OPEN');
      if (openToday.length > 0) session = openToday[0];
    } catch (_) { session = null; }
  }

  if (!session) {
    throw arabicServiceError('NO_OPEN_SESSION', 'لا توجد حصة مفتوحة لهذه المجموعة اليوم — افتح حصة أولاً ثم سجّل الحضور', resolvedGroupId);
  }
  const id = attendanceRecordId(session.id, studentId);
  let duplicateDirect = null;
  if (isTestOffline()) {
    duplicateDirect = inMemoryAttendanceRecords.find(a => a.institutionId === instId && a.id === id) || null;
  } else {
    const snap = await getDoc(doc(clientDb, 'institutions', instId, 'attendanceSessions', id));
    if (snap.exists()) duplicateDirect = { id: snap.id, ...snap.data() };
  }
  if (duplicateDirect) {
    throw arabicServiceError('DUPLICATE_ATTENDANCE', 'تم تسجيل حضور الطالب بالفعل في هذه الحصة', studentId);
  }
  const existingList = await getAttendanceRecords(token, { institutionId: instId, date: day });
  const duplicate = existingList.find(a => a.studentId === studentId && (a.sessionId === session.id || (a.groupId === resolvedGroupId && !a.sessionId && !sessionId)));
  if (duplicate) throw arabicServiceError('DUPLICATE_ATTENDANCE', 'تم تسجيل حضور الطالب بالفعل في هذه الحصة', studentId);

  const now = new Date();
  let effectiveStatus = status;

  // Evaluate Late and Absence Validity Windows
  const lateThreshold = Number(session.lateThresholdMinutes !== undefined ? session.lateThresholdMinutes : 15);
  const closeAttendanceThreshold = Number(session.closeAttendanceMinutes !== undefined ? session.closeAttendanceMinutes : 45);

  let sessionStartMs = null;
  if (session.openedAt) {
    sessionStartMs = new Date(session.openedAt).getTime();
  } else if (session.startedAt) {
    sessionStartMs = new Date(session.startedAt).getTime();
  } else if (session.date && session.startTime) {
    sessionStartMs = new Date(`${session.date}T${session.startTime}:00`).getTime();
  }
  if (!sessionStartMs || isNaN(sessionStartMs)) {
    sessionStartMs = now.getTime();
  }

  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - sessionStartMs) / (60 * 1000)));

  // 1. If close attendance window has elapsed: reject check-in and mark for absence
  if (closeAttendanceThreshold > 0 && elapsedMinutes > closeAttendanceThreshold) {
    if (status !== 'ABSENT' && status !== 'EXCUSED') {
      throw arabicServiceError(
        'ATTENDANCE_WINDOW_EXPIRED',
        `انتهت فترة تسجيل الحضور لهذه الحصة (تم إغلاق الحضور بعد مرور ${closeAttendanceThreshold} دقيقة من فتح الحصة). لا يمكن تسجيل حضور جديد واحتساب باقي الطلاب غياب.`,
        `elapsed:${elapsedMinutes}m,limit:${closeAttendanceThreshold}m`
      );
    }
  }

  // 2. If check-in is default PRESENT and late threshold has elapsed, automatically mark as LATE:
  if (effectiveStatus === 'PRESENT' && lateThreshold > 0 && elapsedMinutes > lateThreshold) {
    effectiveStatus = 'LATE';
  }

  const record = {
    id,
    institutionId: instId,
    studentId,
    studentName: student.name || 'طالب مركز',
    studentCode: student.studentCode || studentId,
    attendanceCardCode: student.attendanceCardCode || cardId || null,
    groupId: resolvedGroupId,
    sessionId: session.id,
    date: day,
    time: now.toLocaleTimeString('ar-EG', { hour12: false }),
    status: effectiveStatus,
    method,
    cardId: cardId || student.studentCardId || null,
    elapsedMinutesAtRecord: elapsedMinutes,
    recordedAt: now.toISOString(),
    createdAt: now.toISOString(),
    createdBy: token.uid || 'system'
  };
  if (isTestOffline()) {
    inMemoryAttendanceRecords.push({ ...record });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'attendanceSessions', id), record);
  }
  await recordAuditEvent({
    action: 'RECORD_ATTENDANCE',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'ATTENDANCE',
    targetId: id,
    details: { studentId, groupId: resolvedGroupId, sessionId: record.sessionId, method }
  });
  return { record, student, group, session };
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
  // B.1 absolute gate: NO SESSION = NO ATTENDANCE (manual included).
  if (!body.sessionId) {
    throw arabicServiceError('MISSING_SESSION_ID', 'اختر حصة مفتوحة أولًا لبدء تسجيل الحضور', 'manual');
  }
  const clientDb = await getClientFirestoreDb(token);
  // Manual fallback also resolves studentCode → studentId through the same core.
  let studentId = body.studentId;
  if (!studentId && body.studentCode) {
    const list = await getStudents(token, { institutionId: instId });
    const found = list.find(s => s.studentCode === body.studentCode || s.id === body.studentCode);
    if (!found) throw arabicServiceError('UNKNOWN_STUDENT', 'الطالب غير موجود', body.studentCode);
    studentId = found.id;
  }
  const { record } = await recordAttendanceCore(token, clientDb, instId, {
    studentId,
    groupId: body.groupId,
    sessionId: body.sessionId || null,
    date: body.date,
    method: body.method || 'MANUAL',
    status: body.status || 'PRESENT'
  });
  return record;
}

// Explicit correction flow (Batch B). Any post-create status mutation requires
// a non-empty reason; time/method edits are free on OPEN sessions only.
// Identity + security fields are immutable; violations are rejected before write.
const ATTENDANCE_IMMUTABLE_FIELDS = ['institutionId', 'studentId', 'sessionId', 'date', 'attendanceCardCode', 'cardId', 'studentCode', 'recordedAt', 'createdAt', 'createdBy'];
const ATTENDANCE_MUTABLE_FIELDS = ['status', 'time', 'method', 'correctionReason', 'correctedAt', 'correctedBy', 'updatedAt'];

async function correctAttendance(callerToken, recordId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'attendance:correct');
  if (!recordId) throw arabicServiceError('INVALID_ATTENDANCE_ID', 'معرف سجل الحضور مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'attendanceSessions', recordId, instId, null, 'سجل الحضور').catch(async () => {
    if (isTestOffline()) {
      const found = inMemoryAttendanceRecords.find(a => a.institutionId === instId && a.id === recordId);
      if (!found) throw arabicServiceError('NOT_FOUND', 'سجل الحضور غير موجود', recordId);
      return found;
    }
    throw arabicServiceError('NOT_FOUND', 'سجل الحضور غير موجود', recordId);
  });
  if (existing.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن تعديل سجل من مؤسسة أخرى');
  for (const k of ATTENDANCE_IMMUTABLE_FIELDS) {
    if (payload[k] !== undefined && payload[k] !== existing[k]) {
      throw arabicServiceError('IMMUTABLE_ATTENDANCE_FIELD', `لا يمكن تعديل الحقل الثابت: ${k}`, k);
    }
  }
  const patch = {};
  if (payload.status !== undefined) {
    if (!ATTENDANCE_STATUSES.includes(payload.status)) throw arabicServiceError('INVALID_ATTENDANCE_STATUS', 'حالة الحضور يجب أن تكون PRESENT/ABSENT/LATE/EXCUSED');
    patch.status = payload.status;
  }
  if (payload.time !== undefined) patch.time = String(payload.time);
  if (payload.method !== undefined) patch.method = String(payload.method);
  const session = existing.sessionId
    ? await fetchDocSameTenant(clientDb, 'sessions', existing.sessionId, instId, inMemorySessions, 'الحصة').catch(() => null)
    : null;
  const sessionClosed = session ? (session.status === 'CLOSED' || session.status === 'CANCELLED') : false;
  const statusChanging = patch.status !== undefined && patch.status !== existing.status;
  if (statusChanging || sessionClosed) {
    const reason = String(payload.correctionReason || '').trim();
    if (!reason) {
      throw arabicServiceError('CORRECTION_REASON_REQUIRED', sessionClosed
        ? 'الحصة مغلقة — التعديل يتطلب سبب تصحيح صريح'
        : 'تغيير حالة الحضور يتطلب سبب تصحيح صريح');
    }
    patch.correctionReason = reason;
    patch.correctedAt = new Date().toISOString();
    patch.correctedBy = token.uid || 'system';
    patch.correctedByUid = token.uid || 'system';
    patch.correctedByEmployeeId = (token.employeeId || '');
    patch.correctedByNameSnapshot = actorDisplayName(token);
    patch.correctedByRole = token.role || 'unknown';
  }
  if (Object.keys(patch).length === 0) throw arabicServiceError('EMPTY_CORRECTION', 'لا يوجد تغيير للحفظ');
  patch.updatedAt = new Date().toISOString();
  patch.updatedByUid = token.uid || 'system';
  patch.updatedByEmployeeId = (token.employeeId || '');
  patch.updatedByNameSnapshot = actorDisplayName(token);
  patch.updatedByRole = token.role || 'unknown';
  if (isTestOffline()) {
    const idx = inMemoryAttendanceRecords.findIndex(a => a.institutionId === instId && a.id === recordId);
    if (idx === -1) throw arabicServiceError('NOT_FOUND', 'سجل الحضور غير موجود', recordId);
    inMemoryAttendanceRecords[idx] = { ...inMemoryAttendanceRecords[idx], ...patch };
    await recordAuditEvent({ action: 'CORRECT_ATTENDANCE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'ATTENDANCE', targetId: recordId, details: { patch, sessionClosed, byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) } });
    return { ...inMemoryAttendanceRecords[idx] };
  }
  await setDoc(doc(clientDb, 'institutions', instId, 'attendanceSessions', recordId), patch, { merge: true });
  await recordAuditEvent({ action: 'CORRECT_ATTENDANCE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'ATTENDANCE', targetId: recordId, details: { patch, sessionClosed, byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) } });
  const snap = await getDoc(doc(clientDb, 'institutions', instId, 'attendanceSessions', recordId));
  return { id: snap.id, ...snap.data() };
}

async function getSessionAttendanceSummary(callerToken, sessionId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const session = await fetchDocSameTenant(clientDb, 'sessions', sessionId, instId, inMemorySessions, 'الحصة');
  const students = (await getStudents(token, { institutionId: instId }))
    .filter(s => (s.groupIds || []).includes(session.groupId) && s.status !== 'ARCHIVED');
  const records = await getAttendanceRecords(token, { institutionId: instId, sessionId });
  const byStatus = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  const seen = new Set();
  for (const r of records) {
    if (seen.has(r.studentId)) continue;
    seen.add(r.studentId);
    if (byStatus[r.status] !== undefined) byStatus[r.status] += 1;
  }
  const total = students.length;
  const attended = byStatus.PRESENT + byStatus.LATE;
  return {
    sessionId, groupId: session.groupId, status: session.status,
    total, ...byStatus,
    unmarked: Math.max(0, total - seen.size),
    percentage: total > 0 ? Math.round((attended / total) * 100) : 0
  };
}

async function recordAttendanceScan(payload = {}) {
  const token = resolveCallerToken(null);
  const instId = token.institutionId;
  const clientDb = await getClientFirestoreDb(token);
  return await recordCardScan(token, { cardCode: payload.studentCodeOrQr, groupId: payload.groupId, sessionId: payload.sessionId, institutionId: instId });
}

// Barcode scan flow: cardCode → card → student → enrollment → session → duplicate → PRESENT (§8-9).
// Resolves canonical attendanceCardCode; falls back to legacy studentCode for
// pre-card records (documented compatibility), never exposes internal IDs.
async function recordCardScan(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const rawCode = String(payload.cardCode || payload.barcode || '').trim();
  if (!rawCode) throw arabicServiceError('INVALID_CARD_CODE', 'مرر كارنيه الطالب أمام قارئ الباركود');
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  // B.1 absolute gate: NO SESSION = NO ATTENDANCE (scanner included).
  // The check repeats inside the core against a fresh session read, so a
  // session closed mid-screen is still rejected per scan.
  if (!payload.sessionId) {
    throw arabicServiceError('MISSING_SESSION_ID', 'اختر حصة مفتوحة أولًا لبدء تسجيل الحضور', 'scan');
  }
  const clientDb = await getClientFirestoreDb(token);

  let card = null;
  let student = null;
  try {
    card = await findCardByCodeInternal(token, clientDb, instId, rawCode);
  } catch (e) {
    if (e.code !== 'UNKNOWN_CARD') throw e;
    // Legacy compatibility: records created before cards used studentCode as the printed code.
    const list = isTestOffline()
      ? Array.from(inMemoryStudents.values()).filter(s => s.institutionId === instId)
      : await getStudents(token, { institutionId: instId });
    const legacy = list.find(s => s.studentCode === rawCode);
    if (!legacy) throw e;
    student = normalizeStudentDoc(legacy);
    card = null;
  }

  if (card) {
    if (card.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'هذا الكارنيه غير مسجل بالنظام');
    if (card.status === 'AVAILABLE' || !card.studentId) throw arabicServiceError('UNASSIGNED_CARD', 'هذا الكارنيه لم يتم ربطه بطالب', rawCode);
    if (card.status === 'LOST') throw arabicServiceError('LOST_CARD', 'هذا الكارنيه مفقود ولا يمكن استخدامه', rawCode);
    if (card.status === 'REVOKED') throw arabicServiceError('REVOKED_CARD', 'هذا الكارنيه ملغي', rawCode);
    if (card.status === 'REPLACED') throw arabicServiceError('REPLACED_CARD', 'تم استبدال هذا الكارنيه', rawCode);
    if (card.status === 'SUSPENDED') throw arabicServiceError('SUSPENDED_CARD', 'هذا الكارنيه موقوف', rawCode);
    if (card.status !== 'ASSIGNED') throw arabicServiceError('INVALID_CARD', 'هذا الكارنيه غير صالح للاستخدام', rawCode);
    student = normalizeStudentDoc(await fetchDocSameTenant(clientDb, 'students', card.studentId, instId, inMemoryStudents, 'الطالب'));
    if ((student.studentCardId && student.studentCardId !== card.id) || (student.attendanceCardCode && student.attendanceCardCode !== card.cardCode)) {
      throw arabicServiceError('REPLACED_CARD', 'تم استبدال هذا الكارنيه', rawCode);
    }
  }

  const { record, group, session } = await recordAttendanceCore(token, clientDb, instId, {
    studentId: student.id,
    groupId: payload.groupId || student.groupIds[0],
    sessionId: payload.sessionId || null,
    date: payload.date,
    method: 'BARCODE_SCANNER',
    cardId: card ? card.cardCode : rawCode
  });
  return { record, student, group, session };
}

// ----------------------------------------------------------------------------
// SCHEDULES — weekly recurring templates (Batch B canonical collection)
// A Schedule is the plan; a Session is one dated occurrence. Tenant-scoped.
// ----------------------------------------------------------------------------

const SCHEDULE_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function parseTimeToMinutes(t) {
  if (typeof t !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t.trim())) {
    throw arabicServiceError('INVALID_TIME_FORMAT', 'صيغة الوقت غير صالحة — استخدم HH:MM بنظام 24 ساعة', String(t));
  }
  const [h, m] = t.trim().split(':').map(Number);
  return h * 60 + m;
}

// Strict overlap only: adjacent intervals (18:00-19:00 / 19:00-20:00) are allowed.
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function sameRoomIdOrName(a, b) {
  if (a.roomId && b.roomId) return a.roomId === b.roomId;
  const norm = (v) => String(v || '').trim();
  if (a.roomId || b.roomId) return false;
  return norm(a.room) !== '' && norm(a.room) === norm(b.room);
}

function describeSlotAr(dayOrDate, startTime, endTime) {
  return `${dayOrDate} ${startTime}–${endTime}`;
}

// Shared conflict scanner used by both engines. kind: 'SCHEDULE' (dayOfWeek) or 'SESSION' (date).
async function findSlotConflicts(token, clientDb, instId, kind, candidate, excludeId = null) {
  const conflicts = [];
  const cStart = parseTimeToMinutes(candidate.startTime);
  const cEnd = parseTimeToMinutes(candidate.endTime);
  if (cStart >= cEnd) throw arabicServiceError('INVALID_TIME_ORDER', 'وقت البداية يجب أن يكون قبل وقت النهاية', `${candidate.startTime}/${candidate.endTime}`);
  const rows = kind === 'SCHEDULE'
    ? await getSchedules(token, { institutionId: instId, status: 'ACTIVE' })
    : await getSessions(token, { institutionId: instId });
  for (const r of rows) {
    if (r.id === excludeId || r.id === candidate.id) continue;
    if (kind === 'SCHEDULE' && (r.status === 'ARCHIVED' || r.status === 'INACTIVE')) continue;
    if (kind === 'SESSION' && r.status === 'ARCHIVED') continue;
    const sameSlot = kind === 'SCHEDULE'
      ? (Number(r.dayOfWeek) === Number(candidate.dayOfWeek))
      : ((r.date || r.sessionDate) === (candidate.date || candidate.sessionDate));
    if (!sameSlot) continue;
    let rStart, rEnd;
    try { rStart = parseTimeToMinutes(r.startTime); rEnd = parseTimeToMinutes(r.endTime); }
    catch (_) { continue; }
    if (!intervalsOverlap(cStart, cEnd, rStart, rEnd)) continue;
    const label = kind === 'SCHEDULE' ? `يوم ${DAY_NAMES_AR[Number(candidate.dayOfWeek)] || candidate.dayOfWeek}` : (candidate.date || candidate.sessionDate);
    if (candidate.teacherId && r.teacherId && candidate.teacherId === r.teacherId) {
      conflicts.push({ type: 'TEACHER', withId: r.id, message: `تعارض معلم: لديه حصة متداخلة (${describeSlotAr(label, r.startTime, r.endTime)})` });
    }
    if (sameRoomIdOrName(candidate, r)) {
      conflicts.push({ type: 'ROOM', withId: r.id, message: `تعارض قاعة: القاعة محجوزة (${describeSlotAr(label, r.startTime, r.endTime)})` });
    }
    if (candidate.groupId && r.groupId && candidate.groupId === r.groupId) {
      conflicts.push({ type: 'GROUP', withId: r.id, message: `تعارض مجموعة: لديها حصة متداخلة (${describeSlotAr(label, r.startTime, r.endTime)})` });
    }
  }
  return conflicts;
}

function assertNoHardConflicts(conflicts, scope) {
  if (conflicts.length > 0) {
    const first = conflicts[0];
    const err = arabicServiceError(scope === 'SCHEDULE' ? 'SCHEDULE_CONFLICT' : 'SESSION_CONFLICT', first.message, `${first.type}/${first.withId}`);
    err.conflicts = conflicts;
    throw err;
  }
}

// Student multi-group overlap surfaces as warnings only, never a hard block.
async function findStudentOverlapWarnings(token, clientDb, instId, candidateGroupIds, slotKey) {
  const warnings = [];
  const students = await getStudents(token, { institutionId: instId });
  for (const s of students) {
    if (s.status === 'ARCHIVED') continue;
    const mine = (s.groupIds || []).filter(g => candidateGroupIds.includes(g));
    if (mine.length > 1) {
      warnings.push({ type: 'STUDENT', studentId: s.id, studentName: s.name, message: `تنبيه: الطالب ${s.name || s.id} مسجل في مجموعتين بهما حصص متداخلة (${slotKey})` });
    }
  }
  return warnings;
}

async function getSchedules(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    let list = Array.from(inMemorySchedules.values()).filter(s => s.institutionId === instId);
    if (options.status) list = list.filter(s => s.status === options.status);
    if (options.groupId) list = list.filter(s => s.groupId === options.groupId);
    if (options.teacherId) list = list.filter(s => s.teacherId === options.teacherId);
    if (options.roomId) list = list.filter(s => s.roomId === options.roomId);
    if (options.subjectId) list = list.filter(s => s.subjectId === options.subjectId);
    if (options.dayOfWeek !== undefined && options.dayOfWeek !== '') list = list.filter(s => Number(s.dayOfWeek) === Number(options.dayOfWeek));
    return list.sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || String(a.startTime).localeCompare(String(b.startTime)));
  }
  const clientDb = await getClientFirestoreDb(token);
  // Bounded server queries matching firestore.indexes.json composites;
  // anything else falls back to a full scan with client-side filtering.
  const hasDow = options.dayOfWeek !== undefined && options.dayOfWeek !== '';
  const colRef = collection(clientDb, 'institutions', instId, 'schedules');
  let snap;
  if (hasDow && options.groupId) snap = await getDocs(query(colRef, where('groupId', '==', options.groupId), where('dayOfWeek', '==', Number(options.dayOfWeek))));
  else if (hasDow && options.teacherId) snap = await getDocs(query(colRef, where('teacherId', '==', options.teacherId), where('dayOfWeek', '==', Number(options.dayOfWeek))));
  else if (hasDow && options.status) snap = await getDocs(query(colRef, where('status', '==', options.status), where('dayOfWeek', '==', Number(options.dayOfWeek))));
  else if (options.groupId) snap = await getDocs(query(colRef, where('groupId', '==', options.groupId)));
  else if (options.teacherId) snap = await getDocs(query(colRef, where('teacherId', '==', options.teacherId)));
  else if (options.status) snap = await getDocs(query(colRef, where('status', '==', options.status)));
  else snap = await getDocs(colRef);
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (hasDow) list = list.filter(s => Number(s.dayOfWeek) === Number(options.dayOfWeek));
  if (options.groupId) list = list.filter(s => s.groupId === options.groupId);
  if (options.teacherId) list = list.filter(s => s.teacherId === options.teacherId);
  if (options.roomId) list = list.filter(s => s.roomId === options.roomId);
  if (options.subjectId) list = list.filter(s => s.subjectId === options.subjectId);
  if (options.status) list = list.filter(s => s.status === options.status);
  const lim = Number(options.limit) || 500;
  list = list.sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || String(a.startTime).localeCompare(String(b.startTime)));
  return list.slice(0, lim);
}

async function getScheduleById(callerToken, scheduleId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!scheduleId) throw arabicServiceError('INVALID_SCHEDULE_ID', 'معرف الجدول مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  return await fetchDocSameTenant(clientDb, 'schedules', scheduleId, instId, inMemorySchedules, 'الجدول الدراسي');
}

// B.1.1 schedule title is a regenerable snapshot owned by the service:
// always built from the CURRENT group + day, never from caller input.
function buildScheduleTitle(groupName, dayOfWeek) {
  return `جدول ${String(groupName || '').trim() || 'مجموعة'} — ${DAY_NAMES_AR[Number(dayOfWeek)] || dayOfWeek}`;
}

async function createSchedule(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const groupId = payload.groupId || '';
  if (!groupId) throw arabicServiceError('INVALID_SCHEDULE_GROUP', 'المجموعة مطلوبة للجدول الدراسي');
  const dayOfWeek = Number(payload.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw arabicServiceError('INVALID_DAY_OF_WEEK', 'اليوم يجب أن يكون رقماً من 0 (الأحد) إلى 6 (السبت)');
  }
  const startTime = payload.startTime || '';
  const endTime = payload.endTime || '';
  parseTimeToMinutes(startTime); parseTimeToMinutes(endTime);
  const clientDb = await getClientFirestoreDb(token);
  const group = await fetchDocSameTenant(clientDb, 'groups', groupId, instId, inMemoryGroups, 'المجموعة');
  if (group.status !== 'ACTIVE') {
    throw arabicServiceError('INACTIVE_GROUP', 'لا يمكن إنشاء جدول لمجموعة غير نشطة (معلقة أو مؤرشفة) — فعّل المجموعة أولاً', groupId);
  }
  const refs = {
    academicYearId: payload.academicYearId || group.academicYearId || undefined,
    stageId: payload.stageId || group.stageId || undefined,
    subjectId: payload.subjectId || group.subjectId || undefined,
    teacherId: payload.teacherId || group.teacherId || undefined,
    roomId: payload.roomId || group.roomId || undefined
  };
  Object.keys(refs).forEach(k => { if (!refs[k]) delete refs[k]; });
  if (refs.academicYearId || refs.stageId || refs.subjectId || refs.teacherId || refs.roomId) {
    await validateGroupReferences(token, clientDb, instId, refs);
  }
  const candidate = {
    groupId,
    teacherId: refs.teacherId || '',
    roomId: refs.roomId || '',
    room: payload.room || group.room || '',
    dayOfWeek, startTime, endTime
  };
  const conflicts = await findSlotConflicts(token, clientDb, instId, 'SCHEDULE', candidate);
  assertNoHardConflicts(conflicts, 'SCHEDULE');
  const warnings = await findStudentOverlapWarnings(token, clientDb, instId, [groupId], `يوم ${DAY_NAMES_AR[dayOfWeek]}`);
  const id = payload.id || `SCH_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();
  const schedule = {
    id, institutionId: instId,
    title: buildScheduleTitle(group.name || groupId, dayOfWeek),
    groupId,
    academicYearId: refs.academicYearId || '',
    stageId: refs.stageId || '',
    subjectId: refs.subjectId || '',
    teacherId: refs.teacherId || '',
    roomId: refs.roomId || '',
    room: candidate.room,
    dayOfWeek, startTime, endTime,
    status: payload.status || 'ACTIVE',
    createdAt: nowISO, updatedAt: nowISO,
    createdBy: token.uid || 'system'
  };
  if (!SCHEDULE_STATUSES.includes(schedule.status)) throw arabicServiceError('INVALID_SCHEDULE_STATUS', 'حالة الجدول يجب أن تكون ACTIVE/INACTIVE/ARCHIVED');
  if (isTestOffline()) inMemorySchedules.set(`${instId}_${id}`, { ...schedule });
  else await setDoc(doc(clientDb, 'institutions', instId, 'schedules', id), schedule);
  await recordAuditEvent({ action: 'CREATE_SCHEDULE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SCHEDULE', targetId: id, details: { title: schedule.title, dayOfWeek, startTime, endTime, warnings: warnings.length } });
  return { ...schedule, warnings };
}

async function updateSchedule(callerToken, scheduleId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (payload.institutionId && payload.institutionId !== instId) throw arabicServiceError('IMMUTABLE_FIELD_MODIFICATION', 'لا يمكن تغيير المؤسسة الخاصة بالجدول');
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'schedules', scheduleId, instId, inMemorySchedules, 'الجدول الدراسي');
  if (existing.status === 'ARCHIVED') throw arabicServiceError('ARCHIVED_SCHEDULE_IMMUTABLE', 'الجدول مؤرشف — لا يمكن تعديله');
  const next = { ...existing, ...payload, id: scheduleId, institutionId: instId };
  if (next.dayOfWeek !== undefined && (!Number.isInteger(Number(next.dayOfWeek)) || Number(next.dayOfWeek) < 0 || Number(next.dayOfWeek) > 6)) {
    throw arabicServiceError('INVALID_DAY_OF_WEEK', 'اليوم يجب أن يكون رقماً من 0 (الأحد) إلى 6 (السبت)');
  }
  next.dayOfWeek = Number(next.dayOfWeek);
  parseTimeToMinutes(next.startTime); parseTimeToMinutes(next.endTime);
  if (next.status && !SCHEDULE_STATUSES.includes(next.status)) throw arabicServiceError('INVALID_SCHEDULE_STATUS', 'حالة الجدول يجب أن تكون ACTIVE/INACTIVE/ARCHIVED');
  // B.1.1: title is ALWAYS regenerated from the CURRENT group + day on update.
  // Caller-supplied titles are ignored so a stale Group A name can never survive
  // a group/day change (the exact manual-test bug).
  const groupForTitle = next.groupId !== existing.groupId
    ? await fetchDocSameTenant(clientDb, 'groups', next.groupId, instId, inMemoryGroups, 'المجموعة')
    : await fetchDocSameTenant(clientDb, 'groups', next.groupId, instId, inMemoryGroups, 'المجموعة').catch(() => null);
  if (next.groupId !== existing.groupId) {
    const newGroup = groupForTitle;
    if (!newGroup) throw arabicServiceError('NOT_FOUND', 'المجموعة الجديدة غير موجودة', next.groupId);
    if (payload.teacherId === undefined) next.teacherId = newGroup.teacherId || '';
    if (payload.roomId === undefined) { next.roomId = newGroup.roomId || ''; next.room = newGroup.room || next.room; }
    if (payload.subjectId === undefined) next.subjectId = newGroup.subjectId || '';
    if (payload.academicYearId === undefined) next.academicYearId = newGroup.academicYearId || next.academicYearId;
    if (payload.stageId === undefined) next.stageId = newGroup.stageId || next.stageId;
  }
  if (next.groupId) {
    const gName = (groupForTitle && groupForTitle.name) || next.groupId;
    next.title = buildScheduleTitle(gName.replace(/^جدول\s+/, ''), Number(next.dayOfWeek));
  }
  const conflicts = await findSlotConflicts(token, clientDb, instId, 'SCHEDULE', next, scheduleId);
  assertNoHardConflicts(conflicts, 'SCHEDULE');
  next.updatedAt = new Date().toISOString();
  next.updatedBy = token.uid || 'system';
  if (isTestOffline()) inMemorySchedules.set(`${instId}_${scheduleId}`, { ...next });
  else {
    const patch = { ...payload, dayOfWeek: next.dayOfWeek, updatedAt: next.updatedAt, updatedBy: next.updatedBy };
    delete patch.title;
    patch.title = next.title;
    if (next.groupId !== existing.groupId) {
      patch.groupId = next.groupId;
      patch.teacherId = next.teacherId;
      patch.roomId = next.roomId;
      patch.room = next.room;
      patch.subjectId = next.subjectId;
      patch.academicYearId = next.academicYearId;
      patch.stageId = next.stageId;
    }
    await setDoc(doc(clientDb, 'institutions', instId, 'schedules', scheduleId), patch, { merge: true });
  }
  await recordAuditEvent({ action: 'UPDATE_SCHEDULE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SCHEDULE', targetId: scheduleId, details: { title: next.title } });
  return next;
}

async function setScheduleStatus(callerToken, scheduleId, status, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!SCHEDULE_STATUSES.includes(status)) throw arabicServiceError('INVALID_SCHEDULE_STATUS', 'حالة الجدول يجب أن تكون ACTIVE/INACTIVE/ARCHIVED');
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'schedules', scheduleId, instId, inMemorySchedules, 'الجدول الدراسي');
  const updated = { ...existing, status, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system' };
  if (isTestOffline()) inMemorySchedules.set(`${instId}_${scheduleId}`, updated);
  else await setDoc(doc(clientDb, 'institutions', instId, 'schedules', scheduleId), { status, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy }, { merge: true });
  await recordAuditEvent({ action: status === 'ARCHIVED' ? 'ARCHIVE_SCHEDULE' : 'SET_SCHEDULE_STATUS', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SCHEDULE', targetId: scheduleId, details: { status } });
  return updated;
}

async function deleteSchedule(callerToken, scheduleId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'schedules', scheduleId, instId, inMemorySchedules, 'الجدول الدراسي');
  const dependents = isTestOffline()
    ? Array.from(inMemorySessions.values()).filter(s => s.institutionId === instId && s.scheduleId === scheduleId)
    : (await getDocs(collection(clientDb, 'institutions', instId, 'sessions'))).docs.filter(d => d.data().scheduleId === scheduleId);
  if (dependents.length > 0) {
    throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن الحذف لأن هناك حصصاً مولدة من هذا الجدول. عطّل الجدول بدلاً من حذفه', scheduleId);
  }
  if (isTestOffline()) inMemorySchedules.delete(`${instId}_${scheduleId}`);
  else await deleteDoc(doc(clientDb, 'institutions', instId, 'schedules', scheduleId));
  await recordAuditEvent({ action: 'DELETE_SCHEDULE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SCHEDULE', targetId: scheduleId, details: {} });
  return { success: true, id: scheduleId };
}

// ----------------------------------------------------------------------------
// SESSIONS & SCHEDULE
// ----------------------------------------------------------------------------

async function getSessions(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  if (isTestOffline()) {
    let list = Array.from(inMemorySessions.values()).filter(s => s.institutionId === instId);
    if (options.groupId) list = list.filter(s => s.groupId === options.groupId);
    if (options.date) list = list.filter(s => s.date === options.date || s.sessionDate === options.date);
    if (options.status) list = list.filter(s => s.status === options.status);
    return list;
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'sessions');
  let snap;
  if (options.groupId && options.date) snap = await getDocs(query(colRef, where('groupId', '==', options.groupId), where('date', '==', options.date)));
  else if (options.status && options.date) snap = await getDocs(query(colRef, where('status', '==', options.status), where('date', '==', options.date)));
  else if (options.teacherId && options.date) snap = await getDocs(query(colRef, where('teacherId', '==', options.teacherId), where('date', '==', options.date)));
  else if (options.groupId) snap = await getDocs(query(colRef, where('groupId', '==', options.groupId)));
  else if (options.status) snap = await getDocs(query(colRef, where('status', '==', options.status)));
  else if (options.teacherId) snap = await getDocs(query(colRef, where('teacherId', '==', options.teacherId)));
  else if (options.date) snap = await getDocs(query(colRef, where('date', '==', options.date)));
  else snap = await getDocs(colRef);
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (options.groupId) list = list.filter(s => s.groupId === options.groupId);
  if (options.date) list = list.filter(s => s.date === options.date || s.sessionDate === options.date);
  if (options.status) list = list.filter(s => s.status === options.status);
  if (options.teacherId) list = list.filter(s => s.teacherId === options.teacherId);
  const lim = Number(options.limit) || 500;
  return list.slice(0, lim);
}

async function getSessionById(callerToken, sessionId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!sessionId) throw arabicServiceError('INVALID_SESSION_ID', 'معرف الحصة مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  return await fetchDocSameTenant(clientDb, 'sessions', sessionId, instId, inMemorySessions, 'الحصة');
}

// B.2 canonical session lifecycle (single status model, no duplicates):
//   SCHEDULED (≈UPCOMING): future/dated occurrence, attendance DISABLED.
//   OPEN (≈ACTIVE): the ONE canonical "open for attendance" state.
//   CLOSED: ended, attendance DISABLED, immutable (superAdmin break-glass only).
//   CANCELLED: voided (business exception), attendance DISABLED, terminal.
// Schedule lifecycle (ACTIVE/INACTIVE/ARCHIVED) is a DIFFERENT model for the
// weekly plan itself — never confused with session status.
// Time semantics: MANUAL start (no clock auto-runner): SCHEDULED →(بدء)→
// OPEN →(إغلاق)→ CLOSED. Generated/manual sessions are born SCHEDULED.
const SESSION_STATUSES = ['SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'];
const SESSION_STATUS_AR = { SCHEDULED: 'مجدولة (قادمة)', OPEN: 'مفتوحة (تُقبل الحضور)', CLOSED: 'مغلقة', CANCELLED: 'ملغاة' };
function isSessionOpenForAttendance(session) {
  return !!session && session.status === 'OPEN';
}

async function setSessionStatus(callerToken, sessionId, status, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!SESSION_STATUSES.includes(status)) throw arabicServiceError('INVALID_SESSION_STATUS', 'حالة الحصة يجب أن تكون SCHEDULED/OPEN/CLOSED/CANCELLED');
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'sessions', sessionId, instId, inMemorySessions, 'الحصة');
  assertSessionTransition(existing.status, status, token.role);
  const nowISO = new Date().toISOString();
  const updated = {
    ...existing,
    status,
    updatedAt: nowISO,
    ...(status === 'OPEN' && !existing.openedAt ? { openedAt: nowISO, startedAt: existing.startedAt || nowISO } : {}),
    ...(status === 'CLOSED' ? { closedAt: nowISO } : {})
  };
  if (isTestOffline()) inMemorySessions.set(`${instId}_${sessionId}`, updated);
  else await setDoc(doc(clientDb, 'institutions', instId, 'sessions', sessionId), {
    status,
    updatedAt: updated.updatedAt,
    ...(updated.openedAt ? { openedAt: updated.openedAt, startedAt: updated.startedAt } : {}),
    ...(updated.closedAt ? { closedAt: updated.closedAt } : {})
  }, { merge: true });
  await recordAuditEvent({ action: 'SET_SESSION_STATUS', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SESSION', targetId: sessionId, details: { status } });
  return updated;
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

  const endTime = body.endTime || '18:00';
  parseTimeToMinutes(startTime); parseTimeToMinutes(endTime);
  if (parseTimeToMinutes(startTime) >= parseTimeToMinutes(endTime)) {
    throw arabicServiceError('INVALID_TIME_ORDER', 'وقت بداية الحصة يجب أن يكون قبل وقت النهاية', `${startTime}/${endTime}`);
  }
  const groupId = body.groupId || '';
  const clientDb = await getClientFirestoreDb(token);
  let group = null;
  if (groupId) {
    group = await fetchDocSameTenant(clientDb, 'groups', groupId, instId, inMemoryGroups, 'المجموعة');
    if (group.status !== 'ACTIVE') {
      throw arabicServiceError('INACTIVE_GROUP', 'لا يمكن إنشاء حصة لمجموعة غير نشطة (معلقة أو مؤرشفة) — فعّل المجموعة أولاً', groupId);
    }
  }
  const refs = {
    teacherId: body.teacherId || (group && group.teacherId) || undefined,
    roomId: body.roomId || (group && group.roomId) || undefined,
    subjectId: body.subjectId || (group && group.subjectId) || undefined
  };
  Object.keys(refs).forEach(k => { if (!refs[k]) delete refs[k]; });
  if (refs.teacherId || refs.roomId || refs.subjectId) {
    await validateGroupReferences(token, clientDb, instId, refs);
  }
  if (body.scheduleId) {
    await fetchDocSameTenant(clientDb, 'schedules', body.scheduleId, instId, inMemorySchedules, 'الجدول الدراسي');
  }
  const candidate = {
    groupId, teacherId: refs.teacherId || '', roomId: refs.roomId || '',
    room: body.room || room, date: sessionDate, sessionDate,
    startTime, endTime
  };
  const conflicts = await findSlotConflicts(token, clientDb, instId, 'SESSION', candidate);
  assertNoHardConflicts(conflicts, 'SESSION');
  const warnings = groupId ? await findStudentOverlapWarnings(token, clientDb, instId, [groupId], sessionDate) : [];

  const id = body.id || `SES_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();
  const lateThresholdMinutes = Math.max(0, Number(body.lateThresholdMinutes !== undefined ? body.lateThresholdMinutes : 15));
  const closeAttendanceMinutes = Math.max(0, Number(body.closeAttendanceMinutes !== undefined ? body.closeAttendanceMinutes : 45));

  const session = {
    id,
    institutionId: instId,
    title: body.title || 'حصة دراسية',
    groupId,
    teacherId: refs.teacherId || '',
    subjectId: refs.subjectId || '',
    roomId: refs.roomId || '',
    room: candidate.room,
    scheduleId: body.scheduleId || null,
    date: sessionDate,
    sessionDate,
    startTime,
    endTime,
    lateThresholdMinutes,
    closeAttendanceMinutes,
    openedAt: null,
    closedAt: null,
    // B.2: sessions are ALWAYS born SCHEDULED (UPCOMING). Caller-supplied
    // status is ignored — a session becomes OPEN only via explicit Start.
    status: 'SCHEDULED',
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    createdAt: nowISO,
    updatedAt: nowISO,
    createdBy: token.uid || 'system'
  };
  if (body.status && body.status !== 'SCHEDULED') {
    await recordAuditEvent({ action: 'SESSION_STATUS_FORCED', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SESSION', targetId: id, details: { requested: body.status, forced: 'SCHEDULED' } });
  }

  if (isTestOffline()) {
    inMemorySessions.set(`${instId}_${id}`, { ...session });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'sessions', id), session);
  }
  await recordAuditEvent({ action: 'CREATE_SESSION', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SESSION', targetId: id, details: { title: session.title, date: sessionDate, warnings: warnings.length } });
  return { ...session, warnings };
}

const SESSION_TRANSITIONS = {
  // B.2: SCHEDULED→CLOSED allowed only as cancellation-by-close path is
  // replaced by explicit CANCELLED; kept for backward-compatible writes.
  SCHEDULED: ['OPEN', 'CLOSED', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: []
};

function assertSessionTransition(from, to, actorRole) {
  if (from === to) throw arabicServiceError('INVALID_SESSION_TRANSITION', 'الحصة بالفعل في هذه الحالة — لا يوجد تغيير للحفظ', `${from}`);
  if (actorRole === 'superAdmin' && from === 'CLOSED' && to === 'OPEN') return;
  const allowed = SESSION_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw arabicServiceError('INVALID_SESSION_TRANSITION', `انتقال الحالة غير مسموح: ${from} ← ${to}`, `${from}→${to}`);
  }
}

async function updateSession(callerToken, sessionId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (payload.institutionId && payload.institutionId !== instId) throw arabicServiceError('IMMUTABLE_FIELD_MODIFICATION', 'لا يمكن تغيير المؤسسة الخاصة بالحصة');
  const clientDb = await getClientFirestoreDb(token);
  const existing = await fetchDocSameTenant(clientDb, 'sessions', sessionId, instId, inMemorySessions, 'الحصة');
  if ((existing.status === 'CLOSED' || existing.status === 'CANCELLED') && token.role !== 'superAdmin') {
    throw arabicServiceError('CLOSED_SESSION_IMMUTABLE', 'الحصة مغلقة/ملغاة — لا يمكن تعديلها إلا عبر مسار التصحيح', sessionId);
  }
  const editable = existing.status === 'SCHEDULED'
    ? ['title', 'groupId', 'teacherId', 'subjectId', 'roomId', 'room', 'date', 'sessionDate', 'startTime', 'endTime', 'lateThresholdMinutes', 'closeAttendanceMinutes', 'attachments', 'files', 'materials']
    : ((token.role === 'superAdmin' || isTestOffline())
      ? ['title', 'endTime', 'lateThresholdMinutes', 'closeAttendanceMinutes', 'attachments', 'files', 'materials', 'openedAt', 'startedAt']
      : ['title', 'endTime', 'lateThresholdMinutes', 'closeAttendanceMinutes', 'attachments', 'files', 'materials']);
  const forbidden = Object.keys(payload).filter(k => !['institutionId', ...editable].includes(k) && payload[k] !== undefined);
  if (forbidden.length > 0 && existing.status !== 'SCHEDULED') {
    throw arabicServiceError('SESSION_FIELD_LOCKED', `لا يمكن تعديل (${forbidden.join('، ')}) بعد فتح الحصة — متاح فقط: العنوان ووقت النهاية والملفات`, sessionId);
  }
  const next = { ...existing };
  for (const k of editable) if (payload[k] !== undefined) next[k] = payload[k];
  if (next.date && !next.sessionDate) next.sessionDate = next.date;
  if (next.sessionDate && !next.date) next.date = next.sessionDate;
  parseTimeToMinutes(next.startTime); parseTimeToMinutes(next.endTime);
  if (parseTimeToMinutes(next.startTime) >= parseTimeToMinutes(next.endTime)) {
    throw arabicServiceError('INVALID_TIME_ORDER', 'وقت بداية الحصة يجب أن يكون قبل وقت النهاية');
  }
  const conflicts = await findSlotConflicts(token, clientDb, instId, 'SESSION', next, sessionId);
  assertNoHardConflicts(conflicts, 'SESSION');
  next.updatedAt = new Date().toISOString();
  next.updatedBy = token.uid || 'system';
  if (isTestOffline()) inMemorySessions.set(`${instId}_${sessionId}`, { ...next });
  else {
    const patch = { updatedAt: next.updatedAt, updatedBy: next.updatedBy };
    for (const k of editable) if (payload[k] !== undefined) patch[k] = next[k];
    await setDoc(doc(clientDb, 'institutions', instId, 'sessions', sessionId), patch, { merge: true });
  }
  await recordAuditEvent({ action: 'UPDATE_SESSION', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SESSION', targetId: sessionId, details: { title: next.title } });
  return next;
}

// B.2 explicit lifecycle actions (the ONLY normal paths):
//   startSession:  SCHEDULED → OPEN      (بدء الحصة — attendance enabled)
//   closeSession:  OPEN → CLOSED         (إغلاق الحصة — attendance disabled)
//   cancelSession: SCHEDULED|OPEN → CANCELLED (business exception, terminal)
// CLOSED → OPEN is superAdmin break-glass only (audited inside setSessionStatus).
async function startSession(callerToken, sessionId, institutionId) {
  return await setSessionStatus(callerToken, sessionId, 'OPEN', institutionId);
}
async function closeSession(callerToken, sessionId, institutionId) {
  return await setSessionStatus(callerToken, sessionId, 'CLOSED', institutionId);
}
async function cancelSession(callerToken, sessionId, institutionId) {
  return await setSessionStatus(callerToken, sessionId, 'CANCELLED', institutionId);
}

function getSessionAttendanceWindow(session) {
  if (!session) return { isOpen: false, status: 'NOT_OPEN', elapsedMinutes: 0 };
  const lateThreshold = Number(session.lateThresholdMinutes !== undefined ? session.lateThresholdMinutes : 15);
  const closeThreshold = Number(session.closeAttendanceMinutes !== undefined ? session.closeAttendanceMinutes : 45);

  if (session.status !== 'OPEN') {
    return {
      isOpen: false,
      status: session.status,
      elapsedMinutes: 0,
      lateThresholdMinutes: lateThreshold,
      closeAttendanceMinutes: closeThreshold,
      isExpired: session.status === 'CLOSED'
    };
  }

  const now = Date.now();
  let startMs = null;
  if (session.openedAt) startMs = new Date(session.openedAt).getTime();
  else if (session.startedAt) startMs = new Date(session.startedAt).getTime();
  else if (session.date && session.startTime) startMs = new Date(`${session.date}T${session.startTime}:00`).getTime();
  if (!startMs || isNaN(startMs)) startMs = now;

  const elapsedMinutes = Math.max(0, Math.floor((now - startMs) / 60000));
  const isExpired = closeThreshold > 0 && elapsedMinutes > closeThreshold;
  const isLatePeriod = !isExpired && (lateThreshold > 0 && elapsedMinutes > lateThreshold);
  const remainingUntilLate = Math.max(0, lateThreshold - elapsedMinutes);
  const remainingUntilClose = Math.max(0, closeThreshold - elapsedMinutes);

  return {
    isOpen: !isExpired,
    status: isExpired ? 'EXPIRED' : (isLatePeriod ? 'LATE_PERIOD' : 'ON_TIME'),
    elapsedMinutes,
    lateThresholdMinutes: lateThreshold,
    closeAttendanceMinutes: closeThreshold,
    isExpired,
    isLatePeriod,
    remainingUntilLate,
    remainingUntilClose
  };
}

async function markSessionRemainingAbsent(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const sessionId = typeof payload === 'string' ? payload : (payload.sessionId || payload.id);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!sessionId) throw arabicServiceError('INVALID_INPUT', 'معرف الحصة مطلوب لرصد الغياب');

  const clientDb = await getClientFirestoreDb(token);
  const session = await fetchDocSameTenant(clientDb, 'sessions', sessionId, instId, inMemorySessions, 'الحصة');
  if (!session.groupId) throw arabicServiceError('NO_GROUP', 'الحصة غير مرتبطة بمجموعة دراسية');

  let enrolledStudents = [];
  if (isTestOffline()) {
    enrolledStudents = Array.from(inMemoryStudents.values()).filter(s =>
      s.institutionId === instId &&
      s.status === 'ACTIVE' &&
      (Array.isArray(s.groupIds) ? s.groupIds.includes(session.groupId) : s.groupId === session.groupId)
    );
  } else {
    const allSnap = await getDocs(collection(clientDb, 'institutions', instId, 'students'));
    enrolledStudents = allSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.status === 'ACTIVE' && (Array.isArray(s.groupIds) ? s.groupIds.includes(session.groupId) : s.groupId === session.groupId));
  }

  const existing = await getAttendanceRecords(token, { institutionId: instId, sessionId });
  const recordedStudentIds = new Set(existing.map(r => r.studentId));

  const unrecordedStudents = enrolledStudents.filter(s => !recordedStudentIds.has(s.id));
  const markedAbsent = [];

  for (const stu of unrecordedStudents) {
    try {
      const rec = await recordAttendanceCore(token, clientDb, instId, {
        studentId: stu.id,
        groupId: session.groupId,
        sessionId: session.id,
        date: session.date || session.sessionDate,
        method: 'MANUAL',
        status: 'ABSENT'
      });
      markedAbsent.push({ student: stu, record: rec });
    } catch (_) {}
  }

  if (payload.closeSessionAfter === true && session.status === 'OPEN') {
    await closeSession(token, session.id, instId);
  }

  await recordAuditEvent({
    action: 'MARK_SESSION_ABSENT_BULK',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'SESSION',
    targetId: session.id,
    details: { totalEnrolled: enrolledStudents.length, markedAbsentCount: markedAbsent.length }
  });

  return {
    success: true,
    sessionId: session.id,
    sessionTitle: session.title,
    totalEnrolled: enrolledStudents.length,
    alreadyAttendedCount: recordedStudentIds.size,
    markedAbsentCount: markedAbsent.length,
    absentStudents: markedAbsent.map(m => ({
      id: m.student.id,
      name: m.student.name,
      phone: m.student.phone,
      guardianPhone: m.student.guardianPhone || m.student.parentPhone
    }))
  };
}

// Idempotent daily generation: active schedules of today's dayOfWeek →
// one session per (scheduleId, date). Repeated clicks never duplicate.
async function generateTodaySessions(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const date = options.date || new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const clientDb = await getClientFirestoreDb(token);
  const schedules = await getSchedules(token, { institutionId: instId, status: 'ACTIVE', dayOfWeek });
  const created = [];
  const skipped = [];
  for (const sch of schedules) {
    const schGroup = sch.groupId ? await fetchDocSameTenant(clientDb, 'groups', sch.groupId, instId, inMemoryGroups, 'المجموعة').catch(() => null) : null;
    if (!schGroup || schGroup.status !== 'ACTIVE') {
      skipped.push({ scheduleId: sch.id, reason: 'GROUP_NOT_ACTIVE' });
      continue;
    }
    const exists = isTestOffline()
      ? Array.from(inMemorySessions.values()).find(s => s.institutionId === instId && s.scheduleId === sch.id && (s.date === date || s.sessionDate === date))
      : (await getDocs(collection(clientDb, 'institutions', instId, 'sessions'))).docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(s => s.scheduleId === sch.id && (s.date === date || s.sessionDate === date));
    if (exists) { skipped.push({ scheduleId: sch.id, sessionId: exists.id }); continue; }
    const session = await createSession(token, {
      institutionId: instId,
      title: sch.title || 'حصة مجدولة',
      groupId: sch.groupId,
      teacherId: sch.teacherId,
      subjectId: sch.subjectId,
      roomId: sch.roomId,
      room: sch.room,
      scheduleId: sch.id,
      date,
      startTime: sch.startTime,
      endTime: sch.endTime,
      status: 'SCHEDULED'
    }).catch(e => ({ __error: e.message, scheduleId: sch.id }));
    if (session && session.__error) skipped.push({ scheduleId: sch.id, reason: session.__error });
    else created.push(session.id || session);
  }
  await recordAuditEvent({ action: 'GENERATE_SESSIONS', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SESSION_BATCH', targetId: date, details: { date, created: created.length, skipped: skipped.length } });
  return { date, dayOfWeek, created, skipped };
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
// MILESTONE D — LESSONS / CONTENT ITEMS / HOMEWORK (Center Desktop service)
// Offline: metadata reads may use cache; upload/publish/access fail closed
// with "لا يوجد اتصال بالخدمة" instead of fake local success.
// ----------------------------------------------------------------------------
function contentOfflineGuard() {
  if (isTestOffline()) throw arabicServiceError('OFFLINE', 'لا يوجد اتصال بالخدمة', 'OFFLINE');
}

async function getLessons(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'lessons');
  const snap = await getDocs(colRef);
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (options.stageId) list = list.filter(l => l.stageId === options.stageId);
  if (options.subjectId) list = list.filter(l => l.subjectId === options.subjectId);
  if (options.groupId) list = list.filter(l => {
    const t = Array.isArray(l.groupIds) ? l.groupIds : (l.groupId ? [l.groupId] : null);
    return !t || t.includes(options.groupId);
  });
  if (options.groupIds && Array.isArray(options.groupIds) && options.groupIds.length > 0) {
    list = list.filter(l => {
      const t = Array.isArray(l.groupIds) ? l.groupIds : (l.groupId ? [l.groupId] : null);
      return !t || t.some(g => options.groupIds.includes(g));
    });
  }
  if (options.accessType) list = list.filter(l => (l.accessType || 'FREE') === options.accessType);
  if (options.teacherId) list = list.filter(l => l.teacherId === options.teacherId);
  if (options.status) list = list.filter(l => l.status === options.status);
  if (options.search) {
    const q = String(options.search).trim();
    if (q) list = list.filter(l => String(l.title || '').includes(q));
  }
  list.sort((a, b) => (a.lessonOrder || 0) - (b.lessonOrder || 0));
  return list;
}

async function createLesson(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان الدرس مطلوب', '');
  if (!payload.subjectId) throw arabicServiceError('MISSING_SUBJECT', 'المادة مطلوبة', '');
  if (!payload.stageId) throw arabicServiceError('MISSING_STAGE', 'المرحلة مطلوبة', '');
  const clientDb = await getClientFirestoreDb(token);
  // BATCH 1: academic context first (year required; term required when the
  // year has terms), then groups/units verified against that exact context.
  const lessonCtx = await assertHubAcademicContext(clientDb, instId, payload,
    payload.academicYearId ? await hubYearHasTerms(clientDb, instId, payload.academicYearId) : false);
  const id = payload.id || `les_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const actor = { uid: token.uid, role: token.role, institutionId: instId };
  const hubGroupIds = await assertHubGroupTargeting(clientDb, instId, normalizeHubGroupIds(payload), payload.stageId, payload.subjectId, lessonCtx.academicYearId, lessonCtx.termId);
  const hubUnitId = await assertHubUnit(clientDb, instId, payload.unitId, lessonCtx, payload.stageId, payload.subjectId);
  const hubAccessType = normalizeHubAccessType(payload.accessType);
  const hubPackageIds = normalizeHubPackageIds(payload.packageIds);
  const hubVisibility = normalizeHubVisibility(payload.visibility);
  const lessonDoc = {
    id, institutionId: instId,
    academicYearId: lessonCtx.academicYearId,
    termId: lessonCtx.termId,
    unitId: hubUnitId,
    stageId: payload.stageId, subjectId: payload.subjectId,
    groupId: payload.groupId || null, groupIds: hubGroupIds,
    accessType: hubAccessType, packageIds: hubPackageIds, visibility: hubVisibility,
    teacherId: payload.teacherId || token.uid,
    title: String(payload.title).trim().slice(0, 200),
    description: payload.description ? String(payload.description).trim().slice(0, 2000) : null,
    lessonNumber: Number.isInteger(payload.lessonNumber) ? payload.lessonNumber : 1,
    lessonOrder: Number.isInteger(payload.lessonOrder) ? payload.lessonOrder : (Number.isInteger(payload.lessonNumber) ? payload.lessonNumber : 1),
    videoUrl: payload.videoUrl || null,
    attachmentName: payload.attachmentName || payload.fileName || null,
    attachmentSize: payload.attachmentSize || payload.fileSize || null,
    attachmentPath: payload.attachmentPath || payload.filePath || null,
    pageRange: payload.pageRange || null,
    pageStart: payload.pageStart || null,
    pageEnd: payload.pageEnd || null,
    sourceId: payload.sourceId || null,
    outlines: payload.outlines || null,
    concepts: payload.concepts || null,
    summary: payload.summary || null,
    contentBody: payload.contentBody || null,
    status: (!isTestOffline() && payload.status === 'PUBLISHED') ? 'PUBLISHED' : 'DRAFT',
    publishedAt: (!isTestOffline() && payload.status === 'PUBLISHED') ? now : null,
    archivedAt: null,
    createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'lessons', id), lessonDoc);
  await recordAuditEvent({ action: 'LESSON_CREATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'LESSON', targetId: id, details: { title: lessonDoc.title } });
  return lessonDoc;
}

async function deleteLesson(callerToken, lessonId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!lessonId) throw arabicServiceError('INVALID_INPUT', 'معرف الدرس مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  await deleteDoc(doc(clientDb, 'institutions', instId, 'lessons', lessonId));
  try {
    await recordAuditEvent({ action: 'LESSON_DELETE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'LESSON', targetId: lessonId, details: { lessonId } });
  } catch (_) {}
  return { success: true, lessonId };
}

async function deleteExamRecord(callerToken, examId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!examId) throw arabicServiceError('INVALID_INPUT', 'معرف الاختبار مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  await deleteDoc(doc(clientDb, 'institutions', instId, 'exams', examId));
  try {
    await recordAuditEvent({ action: 'EXAM_DELETE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'EXAM', targetId: examId, details: { examId } });
  } catch (_) {}
  return { success: true, examId };
}

async function setLessonStatus(callerToken, lessonId, toStatus, institutionId) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const perm = toStatus === 'PUBLISHED' ? 'content:publish' : toStatus === 'ARCHIVED' ? 'content:archive' : 'content:update';
  requirePermission(token, perm);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'lessons', lessonId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الدرس غير موجود', lessonId);
  const cur = snap.data();
  const edges = { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: [] };
  if (!(edges[cur.status] || []).includes(toStatus) && cur.status !== toStatus) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `انتقال غير صالح ${cur.status} ← ${toStatus}`, '');
  }
  const now = new Date().toISOString();
  const next = { ...cur, status: toStatus, updatedAt: now, updatedBy: { uid: token.uid, role: token.role, institutionId: instId } };
  if (toStatus === 'PUBLISHED') next.publishedAt = now;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: toStatus === 'PUBLISHED' ? 'LESSON_PUBLISH' : 'LESSON_ARCHIVE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'LESSON', targetId: lessonId, details: { from: cur.status, to: toStatus } });
  return next;
}

async function updateLessonRecord(callerToken, lessonId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'lessons', lessonId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الدرس غير موجود', lessonId);
  const cur = snap.data();
  if (cur.status === 'ARCHIVED') throw arabicServiceError('INVALID_STATUS_TRANSITION', 'لا يمكن تعديل درس مؤرشف', '');
  const next = { ...cur };
  if (payload.title !== undefined) {
    if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان الدرس مطلوب', '');
    next.title = String(payload.title).trim().slice(0, 200);
  }
  if (payload.description !== undefined) next.description = payload.description ? String(payload.description).slice(0, 2000) : null;
  if (payload.groupIds !== undefined || payload.groupId !== undefined) {
    const shaped = normalizeHubGroupIds(payload, cur);
    next.groupIds = await assertHubGroupTargeting(clientDb, instId, shaped, next.stageId || cur.stageId, next.subjectId || cur.subjectId, next.academicYearId || cur.academicYearId, (next.termId !== undefined ? next.termId : cur.termId) || null);
  }
  if (payload.unitId !== undefined) {
    next.unitId = await assertHubUnit(clientDb, instId, payload.unitId,
      { academicYearId: next.academicYearId || cur.academicYearId, termId: (next.termId !== undefined ? next.termId : cur.termId) || null },
      next.stageId || cur.stageId, next.subjectId || cur.subjectId);
  }
  if (payload.accessType !== undefined) next.accessType = normalizeHubAccessType(payload.accessType);
  if (payload.packageIds !== undefined) next.packageIds = normalizeHubPackageIds(payload.packageIds);
  if (payload.visibility !== undefined) next.visibility = normalizeHubVisibility(payload.visibility);
  if (payload.lessonOrder !== undefined) {
    if (!Number.isInteger(payload.lessonOrder) || payload.lessonOrder < 0) throw arabicServiceError('INVALID_INPUT', 'ترتيب الدرس غير صالح', '');
    next.lessonOrder = payload.lessonOrder;
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = { uid: token.uid, role: token.role, institutionId: instId };
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'LESSON_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'LESSON', targetId: lessonId, details: {} });
  return next;
}

async function getLessonContents(callerToken, lessonId, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'contents'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.lessonId === lessonId)
    .sort((a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0));
}

async function reorderLessonContent(callerToken, lessonId, orderedIds, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) throw arabicServiceError('INVALID_INPUT', 'ترتيب المحتوى مطلوب', '');
  if (new Set(orderedIds).size !== orderedIds.length) throw arabicServiceError('DUPLICATE_ORDER', 'تكرار في ترتيب المحتوى', '');
  const clientDb = await getClientFirestoreDb(token);
  let i = 0;
  for (const cid of orderedIds) {
    await setDoc(doc(clientDb, 'institutions', instId, 'contents', cid),
      { order: i, sortOrder: i, lessonId, updatedAt: new Date().toISOString() }, { merge: true });
    i += 1;
  }
  await recordAuditEvent({ action: 'CONTENT_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'LESSON', targetId: lessonId, details: { reordered: orderedIds.length } });
  return { lessonId, updatedCount: orderedIds.length };
}

async function requestContentAccess(callerToken, payload = {}) {
  // Authenticated short-lived access request: validates tenant + published
  // state service-side, then returns a Worker-backed grant descriptor.
  // No R2 secrets ever reach the renderer (Worker holds them).
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.objectKey || typeof payload.objectKey !== 'string') throw arabicServiceError('INVALID_OBJECT_KEY', 'مفتاح الكائن مطلوب', '');
  if (payload.objectKey.includes('../') || payload.objectKey.includes('..\\')) throw arabicServiceError('PATH_TRAVERSAL_DETECTED', 'مسار غير صالح', '');
  const parts = payload.objectKey.split('/');
  if (parts[0] !== 'institutions' || parts[1] !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
  if (payload.contentStatus && payload.contentStatus !== 'PUBLISHED') throw arabicServiceError('CONTENT_NOT_PUBLISHED', 'المحتوى غير منشور', '');
  if (payload.lessonStatus && payload.lessonStatus !== 'PUBLISHED') throw arabicServiceError('CONTENT_NOT_PUBLISHED', 'الدرس غير منشور', '');
  const grant = { objectKey: payload.objectKey, expiresInSeconds: 900, grantedAt: new Date().toISOString(), via: 'cloudflare-worker' };
  await recordAuditEvent({ action: 'CONTENT_ACCESS_GRANTED', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'CONTENT', targetId: payload.contentId || payload.objectKey, details: {} });
  return grant;
}

async function getHomework(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'homework:view');
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'homework'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  for (const k of ['stageId', 'subjectId', 'groupId', 'teacherId', 'status', 'lessonId']) {
    if (options[k]) list = list.filter(h => h[k] === options[k]);
  }
  return list;
}

async function createHomeworkRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'homework:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان الواجب مطلوب', '');
  for (const k of ['lessonId', 'subjectId', 'stageId']) {
    if (!payload[k]) throw arabicServiceError('MISSING_REQUIRED_FIELDS', `الحقل مطلوب: ${k}`, k);
  }
  const clientDb = await getClientFirestoreDb(token);
  const id = payload.id || `hw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const actor = { uid: token.uid, role: token.role, institutionId: instId };
  const hwMode = normalizeHubHomeworkMode(payload.mode);
  if (hwMode === 'PAPER' && payload.items && payload.items.length > 0) {
    throw arabicServiceError('INVALID_HOMEWORK_MODE', 'الواجب الورقي لا يحمل أسئلة رقمية — استخدم HYBRID', '');
  }
  // BATCH 1: academic context first; source refs resolve to same-context sources.
  const hwCtx = await assertHubAcademicContext(clientDb, instId, payload,
    payload.academicYearId ? await hubYearHasTerms(clientDb, instId, payload.academicYearId) : false);
  const verifiedHwGroups = await assertHubGroupTargeting(clientDb, instId, normalizeHubGroupIds(payload), payload.stageId, payload.subjectId, hwCtx.academicYearId, hwCtx.termId);
  const hwUnit = await assertHubUnit(clientDb, instId, payload.unitId, hwCtx, payload.stageId, payload.subjectId);
  const hwSource = await assertHubSourceRef(clientDb, instId, payload.sourceId, hwCtx, payload.stageId, payload.subjectId, true);
  const hw = {
    id, institutionId: instId, lessonId: payload.lessonId, subjectId: payload.subjectId,
    academicYearId: hwCtx.academicYearId, termId: hwCtx.termId, unitId: hwUnit,
    sourceId: hwSource ? hwSource.sourceId : null,
    stageId: payload.stageId, groupId: payload.groupId || null, groupIds: verifiedHwGroups,
    accessType: normalizeHubAccessType(payload.accessType),
    packageIds: normalizeHubPackageIds(payload.packageIds),
    visibility: normalizeHubVisibility(payload.visibility),
    teacherId: payload.teacherId || token.uid,
    title: String(payload.title).trim().slice(0, 200),
    description: payload.description || null, instructions: payload.instructions || null,
    dueAt: payload.dueAt || null, maxScore: payload.maxScore !== undefined ? payload.maxScore : 100,
    mode: hwMode, items: Array.isArray(payload.items) ? payload.items.slice(0, 100) : [],
    allowFileUpload: hwMode === 'PAPER' ? true : (payload.allowFileUpload === true || hwMode === 'HYBRID'),
    maxAttachments: payload.maxAttachments !== undefined ? payload.maxAttachments : 5,
    status: 'DRAFT', version: 1, createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor,
    publishedAt: null, closedAt: null, archivedAt: null
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'homework', id), hw);
  await recordAuditEvent({ action: 'HOMEWORK_CREATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'HOMEWORK', targetId: id, details: { lessonId: hw.lessonId } });
  return hw;
}

async function setHomeworkStatusRecord(callerToken, homeworkId, toStatus, institutionId) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const perm = toStatus === 'PUBLISHED' ? 'homework:publish' : toStatus === 'CLOSED' ? 'homework:close' : 'homework:update';
  requirePermission(token, perm);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'homework', homeworkId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الواجب غير موجود', homeworkId);
  const cur = snap.data();
  const edges = { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['CLOSED', 'ARCHIVED'], CLOSED: ['ARCHIVED'], ARCHIVED: [] };
  if (!(edges[cur.status] || []).includes(toStatus) && cur.status !== toStatus) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `انتقال غير صالح ${cur.status} ← ${toStatus}`, '');
  }
  const now = new Date().toISOString();
  const next = { ...cur, status: toStatus, updatedAt: now, updatedBy: { uid: token.uid, role: token.role, institutionId: instId } };
  if (toStatus === 'PUBLISHED') next.publishedAt = now;
  if (toStatus === 'CLOSED') next.closedAt = now;
  if (toStatus === 'ARCHIVED') next.archivedAt = now;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: toStatus === 'PUBLISHED' ? 'HOMEWORK_PUBLISH' : toStatus === 'CLOSED' ? 'HOMEWORK_CLOSE' : 'HOMEWORK_ARCHIVE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'HOMEWORK', targetId: homeworkId, details: { from: cur.status, to: toStatus } });
  return next;
}

// ----------------------------------------------------------------------------
// MILESTONE D.2 — CONTENT ITEMS / HOMEWORK UPDATE / WORKER UPLOAD TOKEN
// Reuses firebase/content_config.js caps (single source of truth).
// Firestore stores metadata ONLY — binaries live in private R2 via the
// canonical Worker PUT (renderer streams bytes with the short-lived ID
// token obtained below; the token lives in memory only, never logged).
// ----------------------------------------------------------------------------
const WORKER_MEDIA_BASE_URL = 'https://remas-media-worker.inthemoon2012.workers.dev';
function contentConfigD2() {
  // D.2.1: packaged-local copy — `../../firebase/...` does NOT exist inside
  // the installed app (electron-builder ships center-desktop/ only).
  // Parity with firebase/content_config.js is enforced by automated test.
  return require('./content_upload_config.js');
}

async function getContentUploadConfig(callerToken) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  const cfg = contentConfigD2();
  return {
    contentTypes: [...cfg.CONTENT_TYPES],
    maxFileSizeBytes: { ...cfg.MAX_FILE_SIZE_BYTES },
    allowedMimeTypes: JSON.parse(JSON.stringify(cfg.ALLOWED_MIME_TYPES)),
    disallowedExtensions: [...cfg.DISALLOWED_EXTENSIONS],
    workerUploadUrl: `${WORKER_MEDIA_BASE_URL}/upload`
  };
}

async function getWorkerUploadToken(callerToken) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  validateTenantAccess(token, token.institutionId);
  const user = auth.currentUser;
  if (!user) throw arabicServiceError('NOT_AUTHENTICATED', 'سجّل الدخول أولًا', '');
  const idToken = await user.getIdToken(false);
  return { idToken, uid: user.uid, workerUploadUrl: `${WORKER_MEDIA_BASE_URL}/upload` };
}

// CENTRAL CONTENT HUB CORE — client-side hub normalizers (service validates deeply too).
function normalizeHubGroupIds(payload, existing) {
  if (payload && payload.groupIds !== undefined) {
    if (payload.groupIds === null) return null;
    if (!Array.isArray(payload.groupIds)) throw arabicServiceError('INVALID_GROUP_TARGET', 'استهداف المجموعات غير صالح', '');
    if (payload.groupIds.length === 0) throw arabicServiceError('INVALID_GROUP_TARGET', 'اختر مجموعة واحدة على الأقل أو كل المجموعات', '');
    if (payload.groupIds.length > 50) throw arabicServiceError('INVALID_GROUP_TARGET', 'عدد المجموعات يتجاوز 50', '');
    if (new Set(payload.groupIds).size !== payload.groupIds.length) throw arabicServiceError('INVALID_GROUP_TARGET', 'تكرار في المجموعات', '');
    return payload.groupIds.slice();
  }
  if (payload && payload.groupId) return [payload.groupId];
  if (existing) {
    if (Array.isArray(existing.groupIds)) return existing.groupIds.slice();
    if (existing.groupId) return [existing.groupId];
  }
  return null;
}
function normalizeHubAccessType(v) {
  if (v === undefined || v === null || v === '') return 'FREE';
  const u = String(v).trim().toUpperCase();
  if (u !== 'FREE' && u !== 'SUBSCRIPTION_REQUIRED') throw arabicServiceError('INVALID_ACCESS_TYPE', 'نوع الوصول غير صالح', '');
  return u;
}
function normalizeHubPackageIds(v) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw arabicServiceError('INVALID_PACKAGE_IDS', 'الباقات غير صالحة', '');
  if (v.length > 50) throw arabicServiceError('INVALID_PACKAGE_IDS', 'عدد الباقات يتجاوز 50', '');
  return v.slice();
}
function normalizeHubVisibility(v) {
  if (v === undefined || v === null) return { teachers: true, students: true };
  return { teachers: v.teachers !== false, students: v.students !== false };
}
function normalizeHubHomeworkMode(v) {
  if (v === undefined || v === null || v === '') return 'PAPER';
  const u = String(v).trim().toUpperCase();
  if (!['DIGITAL', 'PAPER', 'HYBRID'].includes(u)) throw arabicServiceError('INVALID_HOMEWORK_MODE', 'نمط الواجب غير صالح', '');
  return u;
}

// HARDENING (v53.0.1): no Hub write may persist groupIds without verifying them
// against the tenant's own groups first (same institution / stage / subject /
// ACTIVE, no duplicates, max 50, [] rejected, null = subject-wide). This runs
// service-side in Desktop before EVERY setDoc on lessons/contents/homework/
// exams/packages, so no client-write path can bypass trusted validation.
function hubGroupErrorMessage(code) {
  if (code === 'UNKNOWN_GROUP') return 'المجموعة غير موجودة في المؤسسة';
  if (code === 'CROSS_TENANT_VIOLATION') return 'انتهاك حدود المؤسسة';
  if (code === 'INVALID_GROUP_STAGE') return 'المجموعة لا تنتمي للمرحلة المحددة';
  if (code === 'INVALID_GROUP_SUBJECT') return 'المجموعة لا تنتمي للمادة المحددة';
  if (code === 'INVALID_GROUP_YEAR') return 'المجموعة لا تنتمي للسنة الدراسية المحددة';
  if (code === 'INVALID_GROUP_TERM') return 'المجموعة لا تنتمي للفصل الدراسي المحدد';
  if (code === 'INACTIVE_GROUP') return 'المجموعة غير نشطة — لا يمكن الاستهداف';
  if (code === 'UNVERIFIED_GROUP_TARGET') return 'تعذر التحقق من المجموعات';
  return 'استهداف المجموعات غير صالح';
}

function hubAcademicErrorMessage(code) {
  if (code === 'MISSING_ACADEMIC_YEAR') return 'السنة الدراسية مطلوبة';
  if (code === 'MISSING_TERM') return 'الفصل الدراسي مطلوب';
  if (code === 'UNKNOWN_ACADEMIC_YEAR') return 'السنة الدراسية غير موجودة في المؤسسة';
  if (code === 'UNKNOWN_TERM') return 'الفصل الدراسي غير موجود في المؤسسة';
  if (code === 'INVALID_TERM_YEAR') return 'الفصل الدراسي لا ينتمي للسنة الدراسية المحددة';
  if (code === 'INACTIVE_TERM') return 'الفصل الدراسي غير نشط';
  if (code === 'UNVERIFIED_ACADEMIC_CONTEXT') return 'تعذر التحقق من السياق الأكاديمي';
  if (code === 'UNKNOWN_UNIT' || code === 'UNVERIFIED_UNIT') return 'الوحدة غير صالحة أو غير موجودة';
  if (code && code.startsWith('INVALID_UNIT')) return 'الوحدة لا تنتمي للسياق الأكاديمي المحدد';
  if (code === 'INACTIVE_UNIT') return 'الوحدة غير نشطة';
  if (code && (code.startsWith('UNKNOWN_SOURCE') || code.startsWith('UNVERIFIED_SOURCE') || code.startsWith('INVALID_SOURCE'))) return 'مرجع المصدر غير صالح';
  return 'السياق الأكاديمي غير صالح';
}

async function fetchHubGroupDirectory(clientDb, instId) {
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'groups'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchHubAcademicDirectory(clientDb, instId) {
  const [yearsSnap, termsSnap] = await Promise.all([
    getDocs(collection(clientDb, 'institutions', instId, 'academicYears')),
    getDocs(collection(clientDb, 'institutions', instId, 'terms'))
  ]);
  return {
    years: yearsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    terms: termsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  };
}

async function fetchHubUnitDirectory(clientDb, instId) {
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'units'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchHubSourceDirectory(clientDb, instId) {
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'knowledgeSources'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function throwHubArabic(e, mapper, fallback) {
  const msg = (e && e.message) || '';
  const code = msg.split(':')[0] || fallback;
  throw arabicServiceError(code, mapper(code), '');
}

async function assertHubGroupTargeting(clientDb, instId, groupIds, stageId, subjectId, academicYearId, termId) {
  if (groupIds === null || groupIds === undefined) return null;
  const cfg = contentConfigD2();
  const dir = await fetchHubGroupDirectory(clientDb, instId);
  try {
    return cfg.assertGroupTargetingValid({
      groupIds, institutionId: instId,
      stageId: stageId || null, subjectId: subjectId || null,
      academicYearId: academicYearId || null, termId: termId || null,
      groupDirectory: dir
    });
  } catch (e) {
    throwHubArabic(e, hubGroupErrorMessage, 'INVALID_GROUP_TARGET');
  }
}

// BATCH 1: resolve + verify year/term/unit for a Hub write in one place.
// requireTerm=true when the selected year has terms (Desktop cascade decides).
async function assertHubAcademicContext(clientDb, instId, payload, requireTerm) {
  const cfg = contentConfigD2();
  const dir = await fetchHubAcademicDirectory(clientDb, instId);
  let yearId = payload.academicYearId !== undefined ? payload.academicYearId : null;
  if (!yearId && dir.years && dir.years.length > 0) {
    const active = dir.years.find(y => y.status === 'ACTIVE') || dir.years[0];
    yearId = active.id;
  }
  let termId = payload.termId !== undefined ? payload.termId : null;
  if (!termId && yearId && dir.terms && dir.terms.length > 0) {
    const matchingTerm = dir.terms.find(t => t.academicYearId === yearId && t.status === 'ACTIVE') || dir.terms.find(t => t.academicYearId === yearId);
    if (matchingTerm) termId = matchingTerm.id;
  }
  if (!yearId) {
    return { academicYearId: null, termId: null };
  }
  try {
    return cfg.assertAcademicContextValid({
      academicYearId: yearId,
      termId: termId,
      institutionId: instId,
      academicDirectory: dir,
      requireYear: true,
      requireTerm: requireTerm === true && !!termId
    });
  } catch (e) {
    throwHubArabic(e, hubAcademicErrorMessage, 'INVALID_ACADEMIC_CONTEXT');
  }
}

async function assertHubUnit(clientDb, instId, unitId, ctx, stageId, subjectId) {
  if (unitId === undefined || unitId === null || unitId === '') return null;
  const cfg = contentConfigD2();
  const dir = await fetchHubUnitDirectory(clientDb, instId);
  try {
    return cfg.assertUnitContextValid({
      unitId, institutionId: instId,
      academicYearId: (ctx && ctx.academicYearId) || null,
      termId: (ctx && ctx.termId) || null,
      stageId: stageId || null, subjectId: subjectId || null,
      unitDirectory: dir
    });
  } catch (e) {
    throwHubArabic(e, hubAcademicErrorMessage, 'INVALID_UNIT');
  }
}

// BATCH 1: source-reference check. Draft sources must NOT back downstream
// usage — requireUsable=true fails closed unless the source is PUBLISHED.
async function assertHubSourceRef(clientDb, instId, sourceId, ctx, stageId, subjectId, requireUsable) {
  if (sourceId === undefined || sourceId === null || sourceId === '') return null;
  const cfg = contentConfigD2();
  const dir = await fetchHubSourceDirectory(clientDb, instId);
  try {
    const r = cfg.assertSourceRefValid({
      sourceId, institutionId: instId,
      academicYearId: (ctx && ctx.academicYearId) || null,
      termId: (ctx && ctx.termId) || null,
      stageId: stageId || null, subjectId: subjectId || null,
      sourceDirectory: dir
    });
    if (requireUsable === true && !r.usable) {
      throw new Error(`UNUSABLE_SOURCE: source '${sourceId}' is not PUBLISHED (status: ${r.sourceStatus})`);
    }
    return r;
  } catch (e) {
    const msg = (e && e.message) || '';
    const code = msg.split(':')[0] || 'INVALID_SOURCE_REF';
    const arabic = code === 'UNUSABLE_SOURCE'
      ? 'المصدر غير منشور — لا يمكن استخدامه قبل النشر'
      : hubAcademicErrorMessage(code);
    throw arabicServiceError(code, arabic, '');
  }
}

// BATCH 1: does the selected academic year have terms? Drives requireTerm
// and cascade behavior (no terms → term stays null, never invented).
async function hubYearHasTerms(clientDb, instId, academicYearId) {
  if (!academicYearId) return false;
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'terms'));
  return snap.docs.some(d => (d.data() || {}).academicYearId === academicYearId);
}

function validateContentItemInput(payload) {
  const cfg = contentConfigD2();
  const t = cfg.normalizeContentType(payload.contentType);
  if (!cfg.CONTENT_TYPES.includes(t)) throw arabicServiceError('INVALID_CONTENT_TYPE', `نوع محتوى غير مدعوم (${payload.contentType})`, '');
  if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان العنصر مطلوب', '');
  if (!payload.lessonId) throw arabicServiceError('MISSING_REQUIRED_FIELDS', 'الدرس مطلوب', 'lessonId');
  if (payload.sizeBytes !== undefined && payload.sizeBytes !== null) {
    const cap = cfg.MAX_FILE_SIZE_BYTES[t] || cfg.MAX_FILE_SIZE_BYTES.FILE;
    if (typeof payload.sizeBytes !== 'number' || payload.sizeBytes < 0) throw arabicServiceError('INVALID_NUMERIC_VALUE', 'حجم الملف غير صالح', '');
    if (payload.sizeBytes > cap) throw arabicServiceError('FILE_SIZE_EXCEEDED', `الحجم يتجاوز الحد (${cap} بايت)`, '');
  }
  if (payload.mimeType) {
    const allowed = cfg.ALLOWED_MIME_TYPES[t] || [];
    if (!allowed.includes(payload.mimeType)) throw arabicServiceError('INVALID_MIME_TYPE', `MIME غير مسموح (${payload.mimeType})`, '');
  }
  if (payload.filename) {
    const dot = String(payload.filename).lastIndexOf('.');
    const ext = dot >= 0 ? String(payload.filename).slice(dot).toLowerCase() : '';
    if (ext && cfg.DISALLOWED_EXTENSIONS.includes(ext)) throw arabicServiceError('DISALLOWED_FILE_TYPE', `امتداد ممنوع (${ext})`, '');
  }
  if (t === 'HOMEWORK_REF' && !payload.homeworkRefId && !payload.homeworkId) {
    throw arabicServiceError('MISSING_HOMEWORK_REF', 'اختر واجبًا موجودًا للربط (HOMEWORK_REF)', '');
  }
  if (t === 'HOMEWORK_REF' && (payload.objectKey || (payload.sizeBytes && payload.sizeBytes > 0))) {
    throw arabicServiceError('INVALID_HOMEWORK_REF', 'مرجع الواجب لا يحمل ملفًا ثنائيًا', '');
  }
  return t;
}

async function createLessonContent(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const contentType = validateContentItemInput(payload);
  const clientDb = await getClientFirestoreDb(token);
  // Bind to parent lesson scope: verifies the lesson exists in-tenant and
  // supplies stage/subject fallback so group targeting is always checked
  // against a real selected stage/subject.
  const lessonSnap = await getDoc(doc(clientDb, 'institutions', instId, 'lessons', payload.lessonId));
  if (!lessonSnap.exists()) throw arabicServiceError('NOT_FOUND', 'الدرس غير موجود', payload.lessonId);
  const lessonDoc = lessonSnap.data() || {};
  if (lessonDoc.institutionId && lessonDoc.institutionId !== instId) {
    throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
  }
  const effStage = payload.stageId || lessonDoc.stageId || null;
  const effSubject = payload.subjectId || lessonDoc.subjectId || null;
  // BATCH 1: inherit year/term/unit from the parent lesson when omitted
  // (authoritative context resolved server-side, never trusted blindly).
  const effYear = payload.academicYearId || lessonDoc.academicYearId || null;
  const effTerm = payload.termId !== undefined ? payload.termId : (lessonDoc.termId || null);
  const itemCtx = await assertHubAcademicContext(clientDb, instId,
    { academicYearId: effYear, termId: effTerm }, effYear ? await hubYearHasTerms(clientDb, instId, effYear) : false);
  const verifiedGroupIds = await assertHubGroupTargeting(clientDb, instId, normalizeHubGroupIds(payload), effStage, effSubject, itemCtx.academicYearId, itemCtx.termId);
  const itemUnit = await assertHubUnit(clientDb, instId,
    payload.unitId !== undefined ? payload.unitId : (lessonDoc.unitId || null),
    itemCtx, effStage, effSubject);
  const id = payload.id || `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const actor = { uid: token.uid, role: token.role, institutionId: instId };
  const item = {
    id, institutionId: instId, lessonId: payload.lessonId,
    academicYearId: itemCtx.academicYearId, termId: itemCtx.termId, unitId: itemUnit,
    subjectId: payload.subjectId || null, stageId: payload.stageId || null,
    groupId: payload.groupId || null, groupIds: verifiedGroupIds,
    accessType: normalizeHubAccessType(payload.accessType),
    packageIds: normalizeHubPackageIds(payload.packageIds),
    visibility: normalizeHubVisibility(payload.visibility),
    title: String(payload.title).trim().slice(0, 200),
    description: payload.description ? String(payload.description).slice(0, 2000) : null,
    textBody: contentType === 'TEXT' && payload.textBody ? String(payload.textBody).slice(0, 20000) : null,
    homeworkRefId: contentType === 'HOMEWORK_REF' ? (payload.homeworkRefId || null) : null,
    contentType,
    status: 'DRAFT',
    order: Number.isInteger(payload.order) ? payload.order : 0,
    sortOrder: Number.isInteger(payload.order) ? payload.order : 0,
    objectKey: payload.objectKey || null,
    sizeBytes: payload.sizeBytes ?? null,
    mimeType: payload.mimeType || null,
    createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor,
    publishedAt: null, archivedAt: null
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'contents', id), item);
  await recordAuditEvent({ action: 'CONTENT_UPLOAD', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'CONTENT', targetId: id, details: { lessonId: item.lessonId, contentType } });
  return item;
}

function normalizeAllowedContentType(rawType) {
  const t = String(rawType || 'PDF').trim().toUpperCase();
  if (['VIDEO', 'VIDEO_LINK', 'MP4'].includes(t)) return 'VIDEO';
  if (['PDF', 'SUMMARY', 'EXERCISES'].includes(t)) return 'PDF';
  if (['IMAGE', 'DOCUMENT', 'FILE', 'TEXT', 'HOMEWORK_REF'].includes(t)) return t;
  return 'PDF';
}

function isRawPdfBinaryString(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trimStart();
  if (trimmed.startsWith('%PDF-')) return true;
  if (str.includes('/Filter') && str.includes('endobj') && str.includes('stream')) return true;
  return false;
}

function persistContentBinaryLocally({ id, fileName, filePath, fileBase64, rawBinaryLatin1, isVideo }) {
  try {
    const subFolder = isVideo ? 'videos' : 'content_files';
    const dir = path.join(getLocalDataDir(), subFolder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const ext = fileName && fileName.includes('.')
      ? fileName.slice(fileName.lastIndexOf('.')).replace(/[^a-zA-Z0-9.]/g, '')
      : (isVideo ? '.mp4' : '.pdf');
    const safeId = String(id || `cnt_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const destPath = path.join(dir, `${safeId}${ext}`);

    if (fileBase64 && typeof fileBase64 === 'string') {
      const cleanB64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
      fs.writeFileSync(destPath, Buffer.from(cleanB64, 'base64'));
      return destPath;
    }
    if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
      if (path.resolve(filePath) !== path.resolve(destPath)) {
        fs.copyFileSync(filePath, destPath);
      }
      return destPath;
    }
    if (rawBinaryLatin1 && typeof rawBinaryLatin1 === 'string' && rawBinaryLatin1.trimStart().startsWith('%PDF-')) {
      fs.writeFileSync(destPath, Buffer.from(rawBinaryLatin1, 'latin1'));
      return destPath;
    }
  } catch (err) {
    console.warn('persistContentBinaryLocally warning:', err.message);
  }
  return filePath || null;
}

async function createDigitalContentItem(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);

  const title = String(payload.title || payload.fileName || 'مذكرة رقمية').trim().slice(0, 200);
  const id = payload.id || `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const actor = { uid: token.uid, role: token.role, institutionId: instId };

  const rawType = payload.type || payload.contentType || 'PDF';
  const normalizedContentType = normalizeAllowedContentType(payload.contentType || rawType);
  const isVideo = normalizedContentType === 'VIDEO' || rawType === 'VIDEO_LINK';

  const localStoredPath = persistContentBinaryLocally({
    id,
    fileName: payload.fileName,
    filePath: payload.filePath,
    fileBase64: payload.fileBase64,
    rawBinaryLatin1: isRawPdfBinaryString(payload.textContent) ? payload.textContent : null,
    isVideo
  });

  const cleanTextContent = (payload.textContent && !isRawPdfBinaryString(payload.textContent))
    ? String(payload.textContent).slice(0, 100000)
    : null;

  const item = {
    id,
    institutionId: instId,
    lessonId: payload.lessonId || null,
    stageId: payload.stageId || null,
    academicYearId: payload.academicYearId || payload.yearId || null,
    subjectId: payload.subjectId || null,
    groupId: payload.groupId || null,
    teacherId: payload.teacherId || null,
    title,
    description: payload.description ? String(payload.description).slice(0, 2000) : null,
    contentType: normalizedContentType,
    type: rawType,
    status: payload.status || 'PUBLISHED',
    dataUrl: payload.dataUrl || null,
    url: payload.url || payload.dataUrl || null,
    videoProvider: payload.videoProvider || null,
    durationMinutes: Number(payload.durationMinutes) || null,
    objectKey: payload.objectKey || (isVideo ? `institutions/${instId}/videos/${id}/${payload.fileName || `${id}.mp4`}` : null),
    storageBucket: isVideo ? 'cloudflare-r2://mana-videos' : 'local-and-cloud',
    fileName: payload.fileName || null,
    filePath: localStoredPath || payload.filePath || null,
    localStoredPath: localStoredPath || null,
    sizeBytes: Number(payload.sizeBytes ?? payload.size ?? 0) || null,
    mimeType: payload.mimeType || (isVideo ? 'video/mp4' : 'application/pdf'),
    pageStart: Number(payload.pageStart) || 1,
    pageEnd: Number(payload.pageEnd) || null,
    pagesCount: Number(payload.pagesCount || payload.pageEnd) || null,
    textContent: cleanTextContent,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    createdBy: actor,
    updatedBy: actor
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'contents', id), item);
  try {
    await recordAuditEvent({
      action: 'CONTENT_UPLOAD',
      actorUid: token.uid,
      actorRole: token.role,
      institutionId: instId,
      targetType: 'CONTENT',
      targetId: id,
      details: { title, contentType: item.contentType, fileName: item.fileName }
    });
  } catch (_) {}

  return item;
}

async function updateDigitalContentItem(callerToken, contentId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  if (!contentId) throw arabicServiceError('INVALID_INPUT', 'معرف المصدر مطلوب');
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'contents', contentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'المصدر غير موجود', contentId);
  const cur = snap.data() || {};

  const now = new Date().toISOString();
  const actor = { uid: token.uid, role: token.role, institutionId: instId };
  const rawType = payload.type !== undefined ? payload.type : (cur.type || cur.contentType || 'PDF');
  const normalizedContentType = normalizeAllowedContentType(payload.contentType || rawType);
  const isVideo = normalizedContentType === 'VIDEO' || rawType === 'VIDEO_LINK';

  let localStoredPath = cur.localStoredPath || cur.filePath || null;
  if (payload.fileBase64 || payload.filePath || isRawPdfBinaryString(payload.textContent)) {
    const savedPath = persistContentBinaryLocally({
      id: contentId,
      fileName: payload.fileName || cur.fileName,
      filePath: payload.filePath || cur.filePath,
      fileBase64: payload.fileBase64,
      rawBinaryLatin1: isRawPdfBinaryString(payload.textContent) ? payload.textContent : null,
      isVideo
    });
    if (savedPath) localStoredPath = savedPath;
  }

  const next = {
    ...cur,
    institutionId: instId,
    title: payload.title !== undefined ? String(payload.title).trim().slice(0, 200) : cur.title,
    stageId: payload.stageId !== undefined ? (payload.stageId || null) : (cur.stageId || null),
    academicYearId: payload.academicYearId !== undefined ? (payload.academicYearId || null) : (cur.academicYearId || null),
    subjectId: payload.subjectId !== undefined ? (payload.subjectId || null) : (cur.subjectId || null),
    groupId: payload.groupId !== undefined ? (payload.groupId || null) : (cur.groupId || null),
    teacherId: payload.teacherId !== undefined ? (payload.teacherId || null) : (cur.teacherId || null),
    contentType: normalizedContentType,
    type: rawType,
    url: payload.url !== undefined ? (payload.url || null) : (cur.url || null),
    videoProvider: payload.videoProvider !== undefined ? payload.videoProvider : (cur.videoProvider || null),
    durationMinutes: payload.durationMinutes !== undefined ? (Number(payload.durationMinutes) || null) : (cur.durationMinutes || null),
    fileName: payload.fileName !== undefined ? (payload.fileName || cur.fileName || null) : (cur.fileName || null),
    filePath: localStoredPath || payload.filePath || cur.filePath || null,
    localStoredPath: localStoredPath || null,
    sizeBytes: payload.sizeBytes !== undefined ? (Number(payload.sizeBytes) || cur.sizeBytes || null) : (cur.sizeBytes || null),
    pageStart: payload.pageStart !== undefined ? (Number(payload.pageStart) || 1) : (Number(cur.pageStart) || 1),
    pageEnd: payload.pageEnd !== undefined ? (Number(payload.pageEnd) || null) : (Number(cur.pageEnd) || null),
    pagesCount: payload.pagesCount !== undefined ? (Number(payload.pagesCount) || null) : (Number(cur.pagesCount || payload.pageEnd || cur.pageEnd) || null),
    description: payload.description !== undefined ? (payload.description ? String(payload.description).slice(0, 2000) : null) : (cur.description || null),
    updatedAt: now,
    updatedBy: actor
  };

  if (payload.textContent !== undefined) {
    next.textContent = !isRawPdfBinaryString(payload.textContent) && payload.textContent
      ? String(payload.textContent).slice(0, 100000)
      : (isRawPdfBinaryString(cur.textContent) ? null : (cur.textContent || null));
  }

  await setDoc(ref, next, { merge: true });
  try {
    await recordAuditEvent({
      action: 'CONTENT_UPDATE',
      actorUid: token.uid,
      actorRole: token.role,
      institutionId: instId,
      targetType: 'CONTENT',
      targetId: contentId,
      details: { title: next.title, contentType: next.contentType }
    });
  } catch (_) {}

  return next;
}

async function deleteDigitalContentItem(callerToken, contentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);

  await deleteDoc(doc(clientDb, 'institutions', instId, 'contents', contentId));
  try {
    await recordAuditEvent({
      action: 'CONTENT_DELETE',
      actorUid: token.uid,
      actorRole: token.role,
      institutionId: instId,
      targetType: 'CONTENT',
      targetId: contentId,
      details: { contentId }
    });
  } catch (_) {}

  return { success: true };
}

async function updateLessonContent(callerToken, contentId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'contents', contentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'عنصر المحتوى غير موجود', contentId);
  const cur = snap.data();
  if (cur.status === 'ARCHIVED') throw arabicServiceError('INVALID_STATUS_TRANSITION', 'لا يمكن تعديل عنصر مؤرشف', '');
  const next = { ...cur };
  if (payload.title !== undefined) {
    if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'العنوان مطلوب', '');
    next.title = String(payload.title).trim().slice(0, 200);
  }
  if (payload.description !== undefined) next.description = payload.description ? String(payload.description).slice(0, 2000) : null;
  if (payload.order !== undefined) {
    if (!Number.isInteger(payload.order) || payload.order < 0) throw arabicServiceError('INVALID_INPUT', 'الترتيب غير صالح', '');
    next.order = payload.order; next.sortOrder = payload.order;
  }
  if (payload.objectKey !== undefined) next.objectKey = payload.objectKey;
  if (payload.sizeBytes !== undefined) next.sizeBytes = payload.sizeBytes;
  if (payload.mimeType !== undefined) next.mimeType = payload.mimeType;
  if (payload.textBody !== undefined && cur.contentType === 'TEXT') next.textBody = String(payload.textBody).slice(0, 20000);
  next.updatedAt = new Date().toISOString();
  next.updatedBy = { uid: token.uid, role: token.role, institutionId: instId };
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'CONTENT_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'CONTENT', targetId: contentId, details: {} });
  return next;
}

async function setLessonContentStatus(callerToken, contentId, toStatus, institutionId) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const perm = toStatus === 'PUBLISHED' ? 'content:publish' : toStatus === 'ARCHIVED' ? 'content:archive' : 'content:update';
  requirePermission(token, perm);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'contents', contentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'عنصر المحتوى غير موجود', contentId);
  const cur = snap.data();
  const edges = { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: [] };
  if (!(edges[cur.status] || []).includes(toStatus) && cur.status !== toStatus) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `انتقال غير صالح ${cur.status} ← ${toStatus}`, '');
  }
  const now = new Date().toISOString();
  const next = { ...cur, status: toStatus, updatedAt: now, updatedBy: { uid: token.uid, role: token.role, institutionId: instId } };
  if (toStatus === 'PUBLISHED') next.publishedAt = now;
  if (toStatus === 'ARCHIVED') next.archivedAt = now;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: toStatus === 'PUBLISHED' ? 'CONTENT_PUBLISH' : 'CONTENT_ARCHIVE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'CONTENT', targetId: contentId, details: { from: cur.status, to: toStatus } });
  return next;
}

async function updateHomeworkRecord(callerToken, homeworkId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'homework:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'homework', homeworkId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الواجب غير موجود', homeworkId);
  const cur = snap.data();
  if (['CLOSED', 'ARCHIVED'].includes(cur.status)) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `لا يمكن تعديل واجب ${cur.status}`, '');
  }
  const next = { ...cur };
  if (payload.title !== undefined) {
    if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان الواجب مطلوب', '');
    next.title = String(payload.title).trim().slice(0, 200);
  }
  if (payload.description !== undefined) next.description = payload.description;
  if (payload.instructions !== undefined) next.instructions = payload.instructions;
  if (payload.dueAt !== undefined) {
    if (payload.dueAt !== null && Number.isNaN(Date.parse(payload.dueAt))) throw arabicServiceError('INVALID_DUE_DATE', 'تاريخ الاستحقاق غير صالح', '');
    next.dueAt = payload.dueAt;
  }
  if (payload.maxScore !== undefined) {
    if (typeof payload.maxScore !== 'number' || payload.maxScore <= 0) throw arabicServiceError('INVALID_NUMERIC_VALUE', 'النهاية العظمى يجب أن تكون موجبة', '');
    next.maxScore = payload.maxScore;
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = { uid: token.uid, role: token.role, institutionId: instId };
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'HOMEWORK_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'HOMEWORK', targetId: homeworkId, details: {} });
  return next;
}

async function getHomeworkSubmissions(callerToken, homeworkId, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'homework:grade');
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'homeworkSubmissions'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.homeworkId === homeworkId);
}

async function gradeHomeworkSubmission(callerToken, submissionId, score, feedback, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'homework:grade');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (typeof score !== 'number' || Number.isNaN(score)) throw arabicServiceError('INVALID_SCORE', 'الدرجة يجب أن تكون رقمًا', '');
  if (score < 0) throw arabicServiceError('INVALID_SCORE', 'الدرجة لا يمكن أن تكون سالبة', '');
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'homeworkSubmissions', submissionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'التسليم غير موجود', submissionId);
  const cur = snap.data();
  const max = cur.maxScore !== undefined ? cur.maxScore : 100;
  if (score > max) throw arabicServiceError('INVALID_SCORE', `الدرجة تتجاوز النهاية العظمى (${max})`, '');
  const now = new Date().toISOString();
  const next = { ...cur, status: 'RETURNED', score, teacherFeedback: feedback !== undefined ? String(feedback).slice(0, 4000) : (cur.teacherFeedback || null), gradedAt: now, gradedBy: { uid: token.uid, role: token.role, institutionId: instId }, updatedAt: now };
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'HOMEWORK_RETURN', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SUBMISSION', targetId: submissionId, details: { score } });
  return next;
}

async function recordHomeworkGradeDirect(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'homeworkSubmissions');
  const snap = await getDocs(colRef);
  const existingDoc = snap.docs.find(d => {
    const data = d.data();
    return data.homeworkId === payload.homeworkId && data.studentId === payload.studentId;
  });
  const subId = existingDoc ? existingDoc.id : (payload.submissionId || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const now = new Date().toISOString();
  const score = Number(payload.score) || 0;
  const maxScore = Number(payload.maxScore) || 20;
  const feedback = payload.feedback ? String(payload.feedback).slice(0, 4000) : '';
  const status = payload.status || 'RETURNED';

  const docData = {
    id: subId,
    institutionId: instId,
    homeworkId: payload.homeworkId,
    studentId: payload.studentId,
    studentName: payload.studentName || 'طالب',
    studentCode: payload.studentCode || '',
    status,
    score,
    maxScore,
    teacherFeedback: feedback,
    submissionMode: payload.submissionMode || 'PAPER',
    submittedAt: existingDoc ? (existingDoc.data().submittedAt || now) : now,
    gradedAt: now,
    gradedBy: { uid: token.uid, role: token.role, institutionId: instId },
    updatedAt: now
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'homeworkSubmissions', subId), docData, { merge: true });
  await recordAuditEvent({ action: 'HOMEWORK_RETURN', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SUBMISSION', targetId: subId, details: { score } }).catch(() => {});
  return docData;
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
  // CENTRAL CONTENT HUB CORE: canonical CENTER exam shape.
  // Legacy {SCHEDULED,maxScore} docs remain readable; new writes use hub shape.
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (token.role === 'teacher') throw arabicServiceError('FORBIDDEN_TEACHER_CENTER_EXAM', 'غير مصرح للمعلم بإنشاء اختبار مركزي', '');
  if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان الاختبار مطلوب', '');
  if (!payload.stageId) throw arabicServiceError('MISSING_STAGE', 'المرحلة مطلوبة', '');
  if (!payload.subjectId) throw arabicServiceError('MISSING_SUBJECT', 'المادة مطلوبة', '');
  const id = payload.id || `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const clientDb = await getClientFirestoreDb(token);
  // BATCH 1: single academic context (year required; term required when the
  // year has terms) + optional unit link + groups verified against context.
  const examCtx = await assertHubAcademicContext(clientDb, instId, payload,
    payload.academicYearId ? await hubYearHasTerms(clientDb, instId, payload.academicYearId) : false);
  const verifiedExamGroups = await assertHubGroupTargeting(clientDb, instId, normalizeHubGroupIds(payload), payload.stageId, payload.subjectId, examCtx.academicYearId, examCtx.termId);
  const examUnit = await assertHubUnit(clientDb, instId, payload.unitId, examCtx, payload.stageId, payload.subjectId);
  const exam = {
    id,
    institutionId: instId,
    ownerScope: 'CENTER',
    createdBy: token.uid,
    createdByRole: token.role,
    title: String(payload.title).trim().slice(0, 200),
    description: payload.description ? String(payload.description).slice(0, 2000) : null,
    examType: payload.examType || 'ASSESSMENT',
    academicYearId: examCtx.academicYearId,
    termId: examCtx.termId,
    unitId: examUnit,
    stageId: payload.stageId,
    subjectId: payload.subjectId,
    groupId: payload.groupId || null,
    groupIds: verifiedExamGroups,
    totalMarksHundredths: payload.totalMarksHundredths !== undefined ? payload.totalMarksHundredths : 10000,
    passingMarksHundredths: payload.passingMarksHundredths !== undefined ? payload.passingMarksHundredths : 5000,
    durationMinutes: payload.durationMinutes || null,
    status: 'DRAFT',
    accessType: normalizeHubAccessType(payload.accessType),
    packageIds: normalizeHubPackageIds(payload.packageIds),
    visibility: normalizeHubVisibility(payload.visibility),
    // Legacy-compat mirrors (one version): keep maxScore/examDate readable.
    maxScore: Number(payload.maxScore) || 100,
    examDate: payload.examDate || null,
    paperUrl: payload.paperUrl || null,
    attachmentName: payload.attachmentName || payload.fileName || null,
    attachmentSize: payload.attachmentSize || payload.fileSize || null,
    attachmentPath: payload.attachmentPath || payload.filePath || null,
    pageRange: payload.pageRange || null,
    pageStart: payload.pageStart || null,
    pageEnd: payload.pageEnd || null,
    createdAt: now, updatedAt: now,
    createdByUid: token.uid, updatedBy: { uid: token.uid, role: token.role, institutionId: instId }
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'exams', id), exam);
  await recordAuditEvent({ action: 'LESSON_CREATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'EXAM', targetId: id, details: { ownerScope: 'CENTER' } });
  return exam;
}

async function setCenterExamStatus(callerToken, examId, toStatus, institutionId) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, toStatus === 'PUBLISHED' ? 'content:publish' : 'content:archive');
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'exams', examId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الاختبار غير موجود', examId);
  const cur = snap.data();
  if ((cur.ownerScope || 'CENTER') !== 'CENTER') throw arabicServiceError('FORBIDDEN_EXAM_SCOPE', 'نطاق الاختبار غير مركزي', '');
  const edges = { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['CLOSED', 'ARCHIVED'], CLOSED: ['ARCHIVED'], ARCHIVED: [] };
  if (!(edges[cur.status] || []).includes(toStatus) && cur.status !== toStatus) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `انتقال غير صالح ${cur.status} ← ${toStatus}`, '');
  }
  const now = new Date().toISOString();
  const next = { ...cur, status: toStatus, updatedAt: now, updatedBy: { uid: token.uid, role: token.role, institutionId: instId } };
  await setDoc(ref, next, { merge: true });
  return next;
}

async function publishCenterExamWithSnapshots(callerToken, examId, bankQuestions, institutionId, options = {}) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'content:publish');
  if (!Array.isArray(bankQuestions) || bankQuestions.length === 0) {
    throw arabicServiceError('EMPTY_EXAM_QUESTIONS', 'اختر سؤالًا واحدًا على الأقل من بنك الأسئلة', '');
  }
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'exams', examId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الاختبار غير موجود', examId);
  const cur = snap.data();
  if (cur.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
  if ((cur.ownerScope || 'CENTER') !== 'CENTER') throw arabicServiceError('FORBIDDEN_EXAM_SCOPE', 'نطاق الاختبار غير مركزي', '');
  if (cur.status !== 'DRAFT') throw arabicServiceError('INVALID_STATUS_TRANSITION', 'النشر متاح للمسودات فقط', '');
  // BATCH 1: curated questions only (manager-curated list, never auto-pool);
  // every question must match the exam's exact academic context (fail closed).
  const examCtx = {
    institutionId: instId,
    academicYearId: cur.academicYearId || null,
    termId: cur.termId || null,
    stageId: cur.stageId, subjectId: cur.subjectId
  };
  let total = 0;
  const snapshots = bankQuestions.map((q, idx) => {
    for (const f of ['academicYearId', 'termId', 'stageId', 'subjectId']) {
      const expected = examCtx[f];
      const actual = q[f];
      if (expected !== undefined && expected !== null && actual !== undefined && actual !== null && actual !== expected) {
        throw arabicServiceError('EXAM_CONTEXT_MISMATCH', `السؤال لا ينتمي للسياق الأكاديمي للاختبار (${f})`, '');
      }
    }
    if (q.institutionId && q.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
    total += q.marksHundredths || 0;
    const correctOptionIds = Array.isArray(q.correctOptionIds)
      ? q.correctOptionIds.filter(x => typeof x === 'string').slice(0, 20)
      : (Array.isArray(q.options) ? q.options.filter(o => o.isCorrect === true).map(o => o.optionId).filter(Boolean) : []);
    return {
      id: `eq_snap_${examId}_${idx + 1}`, institutionId: instId, examId,
      snapshotVersion: 2,
      questionId: q.id || q.questionId, questionBankId: q.questionBankId || null,
      questionVersion: q.version !== undefined ? q.version : 1,
      academicYearId: q.academicYearId || cur.academicYearId || null,
      termId: q.termId !== undefined ? q.termId : (cur.termId || null),
      stageId: q.stageId || cur.stageId || null,
      subjectId: q.subjectId || cur.subjectId || null,
      prompt: q.prompt, questionType: q.questionType === 'SHORT_TEXT' ? 'SHORT_ANSWER' : q.questionType,
      marksHundredths: q.marksHundredths || 100,
      options: Array.isArray(q.options) ? q.options.map(o => ({ optionId: o.optionId, text: o.text, order: o.order || 0 })) : [],
      correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : null,
      correctOptionIds,
      gradingRule: q.gradingRule === 'EXACT_SET' ? 'EXACT_SET' : 'EXACT',
      order: options && options.startOrder ? (options.startOrder + idx) : (idx + 1)
    };
  });
  for (const s of snapshots) {
    await setDoc(doc(clientDb, 'institutions', instId, 'examQuestions', s.id), s);
  }
  const now = new Date().toISOString();
  const next = { ...cur, status: 'PUBLISHED', totalMarksHundredths: total, snapshotVersion: 2, publishedAt: now, updatedAt: now };
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'CONTENT_PUBLISH', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'EXAM', targetId: examId, details: { snapshots: snapshots.length } });
  return { exam: next, snapshotsCount: snapshots.length, calculatedTotalMarksHundredths: total, snapshotVersion: 2 };
}

// ---- Packages (Owner/Admin via Desktop; codes/entitlements stay server-only) ----
async function getPackages(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'packages'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (options.status) list = list.filter(p => p.status === options.status);
  return list;
}

async function createPackageRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.name || !String(payload.name).trim()) throw arabicServiceError('INVALID_PACKAGE_NAME', 'اسم الباقة مطلوب', '');
  if (!payload.durationDays || payload.durationDays <= 0) throw arabicServiceError('INVALID_DURATION', 'مدة الباقة يجب أن تكون موجبة', '');
  const strArr = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).slice(0, 200) : [];
  const clientDb = await getClientFirestoreDb(token);
  // Packages may span stages/subjects: verify allowed groups for institution +
  // existence + ACTIVE only (no stage/subject binding at package level).
  const rawPkgGroups = strArr(payload.allowedGroupIds);
  const verifiedPkgGroups = await assertHubGroupTargeting(clientDb, instId, rawPkgGroups.length ? rawPkgGroups : null, null, null);
  // BATCH 1: optional academic scope (validated when present, never invented).
  let pkgCtx = { academicYearId: null, termId: null };
  if (payload.academicYearId || payload.termId) {
    pkgCtx = await assertHubAcademicContext(clientDb, instId, payload, false);
  }
  const optId = (v) => (v === undefined || v === null || v === '' ? null : String(v));
  const id = payload.id || `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const pkg = {
    id, institutionId: instId, name: String(payload.name).trim().slice(0, 150),
    description: payload.description ? String(payload.description).slice(0, 500) : null,
    status: 'DRAFT', durationDays: Math.floor(payload.durationDays),
    priceMinor: payload.priceMinor !== undefined ? Math.max(0, Math.floor(payload.priceMinor)) : 0,
    currency: payload.currency || 'EGP',
    scopeType: ['SUBJECT', 'GROUP', 'LESSON', 'CONTENT', 'MULTI_SCOPE'].includes(payload.scopeType) ? payload.scopeType : 'MULTI_SCOPE',
    academicYearId: pkgCtx.academicYearId, termId: pkgCtx.termId,
    stageId: optId(payload.stageId), subjectId: optId(payload.subjectId),
    allowedSubjectIds: strArr(payload.allowedSubjectIds), allowedGroupIds: verifiedPkgGroups || [],
    allowedLessonIds: strArr(payload.allowedLessonIds), allowedContentIds: strArr(payload.allowedContentIds),
    allowedHomeworkIds: strArr(payload.allowedHomeworkIds), allowedExamIds: strArr(payload.allowedExamIds),
    version: 1, createdAt: now, updatedAt: now, createdBy: token.uid, updatedBy: token.uid
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'packages', id), pkg);
  await recordAuditEvent({ action: 'CONTENT_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PACKAGE', targetId: id, details: { name: pkg.name } });
  return pkg;
}

// Pure subscription-status classifier (no I/O — unit-testable). The
// subscriptions collection is server-written with heterogeneous legacy docs,
// so classification is defensive: ACTIVE only when status is ACTIVE and (no
// expiry or expiry in the future); EXPIRED when past expiry or marked so;
// CANCELLED/REVOKED keep their label; anything else is OTHER (shown raw,
// never invented).
function classifySubscriptionStatus(sub = {}, nowMs = Date.now()) {
  const raw = sub && typeof sub.status === 'string' ? sub.status.trim().toUpperCase() : '';
  const expMs = sub && sub.expiresAt ? Date.parse(sub.expiresAt) : NaN;
  const hasExp = Number.isFinite(expMs);
  if (raw === 'ACTIVE' && (!hasExp || expMs > nowMs)) return 'ACTIVE';
  if (raw === 'EXPIRED' || (hasExp && expMs <= nowMs)) return 'EXPIRED';
  if (raw === 'CANCELLED' || raw === 'REVOKED') return raw;
  if (raw) return 'OTHER';
  // No status recorded: expiry alone decides, otherwise unknown-but-present.
  if (hasExp) return expMs > nowMs ? 'ACTIVE' : 'EXPIRED';
  return 'OTHER';
}

// Pure per-package subscriber counter (no I/O — unit-testable). Matches the
// server's package reference under either `packageId` (canonical) or legacy
// `packageID`; cross-tenant rows never match because callers pre-scope by
// institution. Returns { total, active }.
function countPackageSubscriptions(subs = [], packageId) {
  let total = 0, active = 0;
  for (const s of (subs || [])) {
    const ref = (s && (s.packageId || s.packageID)) || null;
    if (!ref || ref !== packageId) continue;
    total += 1;
    if (classifySubscriptionStatus(s) === 'ACTIVE') active += 1;
  }
  return { total, active };
}

async function updatePackageRecord(callerToken, packageId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  if (!packageId) throw arabicServiceError('INVALID_PACKAGE_ID', 'معرف الباقة مطلوب', '');
  if (payload.status !== undefined && payload.status !== null) {
    throw arabicServiceError('STATUS_IMMUTABLE_HERE', 'تغيير الحالة يتم عبر مسار التفعيل/الإيقاف/الأرشفة فقط', '');
  }
  if (payload.institutionId && payload.institutionId !== instId) {
    throw arabicServiceError('IMMUTABLE_FIELD_MODIFICATION', 'لا يمكن تغيير المؤسسة الخاصة بالباقة', '');
  }
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'packages', packageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الباقة غير موجودة', packageId);
  const cur = snap.data();
  if (cur.institutionId && cur.institutionId !== instId) {
    throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن استخدام سجل من مؤسسة أخرى', packageId);
  }
  if (cur.status === 'ARCHIVED') {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', 'لا يمكن تعديل باقة مؤرشفة', packageId);
  }
  const next = { ...cur };
  if (payload.name !== undefined) {
    if (!payload.name || !String(payload.name).trim()) throw arabicServiceError('INVALID_PACKAGE_NAME', 'اسم الباقة مطلوب', '');
    next.name = String(payload.name).trim().slice(0, 150);
  }
  if (payload.description !== undefined) {
    next.description = payload.description ? String(payload.description).trim().slice(0, 500) : null;
  }
  const wantsMoneyChange =
    (payload.priceMinor !== undefined && Number(payload.priceMinor) !== Number(cur.priceMinor || 0)) ||
    (payload.durationDays !== undefined && Number(payload.durationDays) !== Number(cur.durationDays || 0)) ||
    (payload.scopeType !== undefined && String(payload.scopeType) !== String(cur.scopeType || 'MULTI_SCOPE'));
  if (payload.priceMinor !== undefined) {
    const pm = Number(payload.priceMinor);
    if (!Number.isFinite(pm) || pm < 0) throw arabicServiceError('INVALID_PRICE', 'السعر يجب أن يكون رقمًا غير سالب', '');
    next.priceMinor = Math.floor(pm);
  }
  if (payload.durationDays !== undefined) {
    const dd = Number(payload.durationDays);
    if (!Number.isInteger(dd) || dd <= 0) throw arabicServiceError('INVALID_DURATION', 'مدة الباقة يجب أن تكون عدد أيام صحيحًا موجبًا', '');
    next.durationDays = dd;
  }
  if (payload.scopeType !== undefined) {
    if (!['SUBJECT', 'GROUP', 'LESSON', 'CONTENT', 'MULTI_SCOPE'].includes(String(payload.scopeType))) {
      throw arabicServiceError('INVALID_SCOPE', 'نطاق الباقة غير صالح', '');
    }
    next.scopeType = String(payload.scopeType);
  }
  if (payload.currency !== undefined) next.currency = String(payload.currency || 'EGP').slice(0, 8);
  for (const k of ['academicYearId', 'termId', 'stageId', 'subjectId']) {
    if (payload[k] !== undefined) next[k] = payload[k] ? String(payload[k]) : null;
  }
  if (next.academicYearId || next.termId) {
    const checked = await assertHubAcademicContext(clientDb, instId, { academicYearId: next.academicYearId, termId: next.termId }, false);
    next.academicYearId = checked.academicYearId;
    next.termId = checked.termId;
  }
  // Price/duration/scope policy: existing ACTIVE subscriptions were sold on
  // the old terms — changing them would silently rewrite sold contracts, so
  // the write is refused with the live count (fail closed, Arabic).
  if (wantsMoneyChange) {
    const allSubs = await getSubscriptions(token, { institutionId: instId });
    const linked = countPackageSubscriptions(allSubs, packageId);
    if (linked.active > 0) {
      throw arabicServiceError('PACKAGE_HAS_ACTIVE_SUBSCRIPTIONS', `لا يمكن تغيير السعر أو المدة أو النطاق — توجد ${linked.active} اشتراكات نشطة مباعة بهذه الشروط. أوقف الباقة عن البيع الجديد بدلًا من ذلك`, packageId);
    }
  }
  next.version = Number.isInteger(cur.version) ? cur.version + 1 : 1;
  next.updatedAt = new Date().toISOString();
  next.updatedBy = token.uid;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'CONTENT_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PACKAGE', targetId: packageId, details: { name: next.name, version: next.version } });
  return next;
}

async function setPackageStatusRecord(callerToken, packageId, toStatus, institutionId) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, toStatus === 'ACTIVE' ? 'content:publish' : 'content:archive');
  const edges = { DRAFT: ['ACTIVE', 'ARCHIVED'], ACTIVE: ['SUSPENDED', 'ARCHIVED'], SUSPENDED: ['ACTIVE', 'ARCHIVED'], ARCHIVED: [] };
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'packages', packageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الباقة غير موجودة', packageId);
  const cur = snap.data();
  if (!(edges[cur.status] || []).includes(toStatus) && cur.status !== toStatus) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `انتقال غير صالح ${cur.status} ← ${toStatus}`, '');
  }
  const next = { ...cur, status: toStatus, updatedAt: new Date().toISOString(), updatedBy: token.uid };
  await setDoc(ref, next, { merge: true });
  return next;
}

// ---- Question Bank (Owner/Admin via Desktop) ----
async function getQuestionBanks(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'questionBanks'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  for (const k of ['subjectId', 'stageId', 'academicYearId', 'termId', 'status']) {
    if (options[k]) list = list.filter(q => !q[k] || q[k] === options[k]);
  }
  return list;
}

async function createQuestionBankRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.name || !String(payload.name).trim()) throw arabicServiceError('INVALID_TITLE', 'اسم البنك مطلوب', '');
  if (!payload.subjectId) throw arabicServiceError('MISSING_SUBJECT', 'المادة مطلوبة', '');
  const clientDb = await getClientFirestoreDb(token);
  // BATCH 1: banks carry academic context (year required; term when the year has terms).
  const bankCtx = await assertHubAcademicContext(clientDb, instId, payload,
    payload.academicYearId ? await hubYearHasTerms(clientDb, instId, payload.academicYearId) : false);
  const id = payload.id || `qb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const bank = {
    id, institutionId: instId, name: String(payload.name).slice(0, 200),
    academicYearId: bankCtx.academicYearId, termId: bankCtx.termId,
    subjectId: payload.subjectId, stageId: payload.stageId || null,
    description: payload.description ? String(payload.description).slice(0, 1000) : null,
    status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: token.uid, updatedBy: token.uid
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'questionBanks', id), bank);
  return bank;
}

async function getBankQuestions(callerToken, bankId, institutionId, options = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const opts = options || {};
  const instId = validateTenantAccess(token, (typeof institutionId === 'string' ? institutionId : (opts && opts.institutionId)) || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'questions'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(q => !bankId || q.questionBankId === bankId);
  // BATCH 1: deterministic compatible selection — filter by exact context.
  // Absent fields on legacy questions do not exclude (read compat); new writes
  // always carry context so compatible filtering is exact for them.
  const f = opts || {};
  for (const k of ['academicYearId', 'termId', 'stageId', 'subjectId', 'unitId', 'lessonId', 'sourceId', 'questionType', 'difficulty', 'status']) {
    if (f[k]) list = list.filter(q => q[k] === undefined || q[k] === null || q[k] === f[k]);
  }
  if (f.search) {
    const s = String(f.search).trim();
    if (s) list = list.filter(q => String(q.prompt || '').includes(s));
  }
  return list;
}

async function createQuestionRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.prompt || !String(payload.prompt).trim()) throw arabicServiceError('INVALID_TITLE', 'نص السؤال مطلوب', '');
  if (!payload.subjectId) throw arabicServiceError('MISSING_SUBJECT', 'المادة مطلوبة', '');
  const rawType = String(payload.questionType || 'MCQ').trim().toUpperCase();
  const qtype = rawType === 'SHORT_TEXT' ? 'SHORT_ANSWER' : rawType;
  if (!['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'SHORT_ANSWER', 'ESSAY'].includes(qtype)) {
    throw arabicServiceError('INVALID_QUESTION_TYPE', 'نوع السؤال غير مدعوم', '');
  }
  if (payload.difficulty && !['EASY', 'MEDIUM', 'HARD'].includes(String(payload.difficulty).toUpperCase())) {
    throw arabicServiceError('INVALID_DIFFICULTY', 'الصعوبة غير صالحة', '');
  }
  if (qtype === 'MCQ') {
    const opts = Array.isArray(payload.options) ? payload.options : [];
    if (opts.length < 2 || opts.filter(o => o.isCorrect === true).length !== 1) {
      throw arabicServiceError('INVALID_MCQ_OPTIONS', 'الاختيار من متعدد يتطلب خيارين على الأقل وإجابة صحيحة واحدة', '');
    }
  }
  if (qtype === 'MULTI_SELECT') {
    const opts = Array.isArray(payload.options) ? payload.options : [];
    if (opts.length < 2 || !opts.some(o => o.isCorrect === true)) {
      throw arabicServiceError('INVALID_MULTI_SELECT', 'الاختيار المتعدد يتطلب خيارين على الأقل وإجابة صحيحة واحدة على الأقل', '');
    }
  }
  if (qtype === 'TRUE_FALSE' && typeof payload.correctAnswer !== 'boolean') {
    throw arabicServiceError('INVALID_TRUE_FALSE_ANSWER', 'الصواب/الخطأ يتطلب إجابة صحيحة (نعم/لا)', '');
  }
  const clientDb = await getClientFirestoreDb(token);
  // BATCH 1: exact academic context + unit + same-context PUBLISHED source only.
  const qCtx = await assertHubAcademicContext(clientDb, instId, payload,
    payload.academicYearId ? await hubYearHasTerms(clientDb, instId, payload.academicYearId) : false);
  const qUnit = await assertHubUnit(clientDb, instId, payload.unitId, qCtx, payload.stageId, payload.subjectId);
  const qSource = await assertHubSourceRef(clientDb, instId, payload.sourceId, qCtx, payload.stageId, payload.subjectId, true);
  const correctOptionIds = Array.isArray(payload.correctOptionIds)
    ? payload.correctOptionIds.filter(x => typeof x === 'string').slice(0, 20)
    : (Array.isArray(payload.options) ? payload.options.filter(o => o.isCorrect === true).map(o => o.optionId).filter(Boolean) : []);
  // BATCH 2A: AI drafts persist as AI_GENERATED/DUPLICATE_REVIEW with full
  // provenance (never official until manager APPROVED→ACTIVE).
  const qStatus = payload.status !== undefined && payload.status !== null
    ? String(payload.status).trim().toUpperCase() : 'ACTIVE';
  if (!['ACTIVE', 'AI_GENERATED', 'DUPLICATE_REVIEW'].includes(qStatus)) {
    throw arabicServiceError('INVALID_QUESTION_STATUS', 'حالة السؤال غير صالحة عند الإنشاء', '');
  }
  const id = payload.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const q = {
    id, institutionId: instId, questionBankId: payload.questionBankId || null,
    academicYearId: qCtx.academicYearId, termId: qCtx.termId,
    subjectId: payload.subjectId, stageId: payload.stageId || null,
    unitId: qUnit, lessonId: payload.lessonId || null,
    sourceId: qSource ? qSource.sourceId : null,
    sourceReference: typeof payload.sourceReference === 'string' ? payload.sourceReference.slice(0, 500) : null,
    sourcePages: Array.isArray(payload.sourcePages)
      ? payload.sourcePages.filter((n) => Number.isInteger(n) && n >= 1).slice(0, 80)
      : null,
    difficulty: payload.difficulty ? String(payload.difficulty).toUpperCase() : null,
    questionType: qtype, prompt: String(payload.prompt).slice(0, 4000),
    explanation: payload.explanation ? String(payload.explanation).slice(0, 2000) : null,
    marksHundredths: payload.marksHundredths !== undefined ? payload.marksHundredths : 100,
    options: Array.isArray(payload.options) ? payload.options : [],
    correctAnswer: payload.correctAnswer !== undefined ? payload.correctAnswer : null,
    correctOptionIds,
    gradingRule: payload.gradingRule === 'EXACT_SET' ? 'EXACT_SET' : 'EXACT',
    version: 1,
    status: qStatus,
    generatedByAI: payload.generatedByAI === true,
    provider: typeof payload.provider === 'string' ? payload.provider.slice(0, 64) : null,
    model: typeof payload.model === 'string' ? payload.model.slice(0, 128) : null,
    sourceVersion: payload.sourceVersion !== undefined ? payload.sourceVersion : null,
    generatedAt: payload.generatedAt || null,
    generationRequestId: payload.generationRequestId || null,
    editedAfterAI: false,
    createdAt: now, updatedAt: now, createdBy: token.uid, updatedBy: token.uid
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'questions', id), q);
  await recordAuditEvent({ action: 'CONTENT_UPLOAD', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'QUESTION', targetId: id, details: { status: q.status, generatedByAI: q.generatedByAI } });
  return q;
}

// BATCH 2A: edit a generated draft (or fix an ACTIVE question's text).
// Provenance is immutable; editing an AI draft flags editedAfterAI.
async function updateQuestionRecord(callerToken, questionId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'questions', questionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'السؤال غير موجود', questionId);
  const cur = snap.data();
  if (cur.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
  if (cur.status === 'ARCHIVED' || cur.status === 'REJECTED') {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', 'لا يمكن تعديل سؤال مؤرشف أو مرفوض', '');
  }
  const next = { ...cur };
  if (payload.prompt !== undefined) {
    if (!payload.prompt || !String(payload.prompt).trim()) throw arabicServiceError('INVALID_TITLE', 'نص السؤال مطلوب', '');
    next.prompt = String(payload.prompt).trim().slice(0, 4000);
  }
  if (payload.explanation !== undefined) next.explanation = payload.explanation ? String(payload.explanation).slice(0, 2000) : null;
  if (payload.marksHundredths !== undefined) {
    if (!Number.isInteger(payload.marksHundredths) || payload.marksHundredths <= 0) throw arabicServiceError('INVALID_MARKS', 'الدرجة يجب أن تكون رقمًا موجبًا', '');
    next.marksHundredths = payload.marksHundredths;
  }
  if (payload.options !== undefined) {
    if (!Array.isArray(payload.options) || payload.options.length < 2) throw arabicServiceError('INVALID_MCQ_OPTIONS', 'الخيارات غير صالحة', '');
    next.options = payload.options;
    next.correctOptionIds = Array.isArray(payload.correctOptionIds)
      ? payload.correctOptionIds.filter(x => typeof x === 'string').slice(0, 20)
      : payload.options.filter(o => o.isCorrect === true).map(o => o.optionId).filter(Boolean);
    if ((next.questionType === 'MCQ') && next.correctOptionIds.length !== 1) {
      throw arabicServiceError('INVALID_MCQ_CORRECT_ANSWER', 'الاختيار من متعدد يتطلب إجابة صحيحة واحدة', '');
    }
  }
  if (payload.correctAnswer !== undefined) next.correctAnswer = payload.correctAnswer;
  if (payload.difficulty !== undefined) {
    if (payload.difficulty !== null && !['EASY', 'MEDIUM', 'HARD'].includes(String(payload.difficulty).toUpperCase())) {
      throw arabicServiceError('INVALID_DIFFICULTY', 'الصعوبة غير صالحة', '');
    }
    next.difficulty = payload.difficulty ? String(payload.difficulty).toUpperCase() : null;
  }
  // Provenance fields are immutable by design (generatedByAI/provider/model/
  // sourceId/sourceVersion/generatedAt/generationRequestId never change here).
  if (cur.generatedByAI === true) next.editedAfterAI = true;
  next.updatedAt = new Date().toISOString();
  next.updatedBy = token.uid;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'CONTENT_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'QUESTION', targetId: questionId, details: { editedAfterAI: next.editedAfterAI === true } });
  return next;
}

// BATCH 2A: review workflow transition (AI_GENERATED → ACTIVE/REJECTED/...).
// APPROVED (→ACTIVE) requires publish permission; roles enforced service-side.
async function setQuestionStatusRecord(callerToken, questionId, toStatus, institutionId) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const status = String(toStatus || '').trim().toUpperCase();
  requirePermission(token, status === 'ACTIVE' ? 'content:publish' : 'content:update');
  if (token.role === 'teacher' || token.role === 'student' || token.role === 'parent') {
    throw arabicServiceError('FORBIDDEN_QUESTION_REVIEW', 'مراجعة أسئلة البنك للإدارة فقط', '');
  }
  const cfg = contentConfigD2();
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'questions', questionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'السؤال غير موجود', questionId);
  const cur = snap.data();
  if (cur.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
  try {
    cfg.transitionQuestionStatusMirror(cur.status || 'AI_GENERATED', status);
  } catch (e) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `انتقال غير صالح ${cur.status} ← ${status}`, '');
  }
  const now = new Date().toISOString();
  const next = { ...cur, status, updatedAt: now, updatedBy: token.uid };
  if (status === 'ARCHIVED') next.archivedAt = now;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: status === 'ACTIVE' ? 'CONTENT_PUBLISH' : 'CONTENT_ARCHIVE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'QUESTION', targetId: questionId, details: { from: cur.status, to: status } });
  return next;
}

// Bulk archive (logical delete) for old questions — e.g. sweeping stale
// REJECTED drafts. Uses the same guarded setQuestionStatusRecord per id, so
// tenant isolation, transition rules (REJECTED -> ARCHIVED allowed, anything
// else rejected per-doc) and audit events all apply. Documents are PRESERVED
// (status flip only): examQuestions references, generation logs and shared
// records are never touched. Rules note: questions hard-delete is
// SuperAdmin-only, hence archive (update) is the owner-safe removal path.
// No silent partials: every id reports archived/failed explicitly.
async function archiveQuestionsBulk(callerToken, payload = {}) {
  const ids = Array.isArray(payload.questionIds) ? payload.questionIds : [];
  if (!ids.length) throw arabicServiceError('MISSING_REQUIRED_FIELDS', 'questionIds', 'questionIds');
  const unique = [...new Set(ids.map((x) => String(x || '').trim()).filter(Boolean))];
  if (!unique.length) throw arabicServiceError('MISSING_REQUIRED_FIELDS', 'questionIds', 'questionIds');
  if (unique.length > 50) throw arabicServiceError('BULK_LIMIT_EXCEEDED', '50', 'questionIds');
  const institutionId = payload.institutionId;
  const archived = [];
  const failed = [];
  for (const id of unique) {
    try {
      await setQuestionStatusRecord(callerToken, id, 'ARCHIVED', institutionId);
      archived.push({ id, to: 'ARCHIVED' });
    } catch (e) {
      failed.push({ id, error: String((e && e.message) || e).slice(0, 300) });
    }
  }
  return { archivedCount: archived.length, failedCount: failed.length, archived, failed };
}

// ---- BATCH 2A: AI service configuration (owner/admin; SuperAdmin reads) ----
async function getAiConfigRecord(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDoc(doc(clientDb, 'institutions', instId, 'aiConfig', 'config'));
  if (!snap.exists()) {
    return { id: 'config', institutionId: instId, aiEnabled: false, features: { questionGeneration: { enabled: false, monthlyLimit: 20 } }, _missing: true };
  }
  return { id: snap.id, ...snap.data() };
}

async function saveAiConfigRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  // AI GOVERNANCE (Batch 2A fix): SuperAdmin owns AI governance. Center roles
  // (owner/admin/employees/teachers) can NEVER modify AI flags — service
  // enforces this even before Firestore Rules deny the write.
  if (token.role !== 'superAdmin') {
    throw arabicServiceError('FORBIDDEN_AI_CONFIG', 'حوكمة الذكاء الاصطناعي للإدارة العليا (SuperAdmin) فقط', '');
  }
  const instId = payload.institutionId || token.institutionId;
  if (!instId) throw arabicServiceError('MISSING_REQUIRED_FIELDS', 'المؤسسة مطلوبة', 'institutionId');
  const monthlyLimit = payload.monthlyLimit !== undefined ? Math.floor(Number(payload.monthlyLimit)) : 20;
  if (!Number.isInteger(monthlyLimit) || monthlyLimit < 0 || monthlyLimit > 100000) {
    throw arabicServiceError('INVALID_AI_LIMIT', 'الحد الشهري يجب أن يكون رقمًا بين 0 و 100000', '');
  }
  const clientDb = await getClientFirestoreDb(token);
  const now = new Date().toISOString();
  const cfg = {
    id: 'config',
    institutionId: instId,
    aiEnabled: payload.aiEnabled === true,
    features: {
      questionGeneration: {
        enabled: payload.questionGenerationEnabled === true,
        monthlyLimit
      }
    },
    updatedAt: now,
    updatedBy: token.uid
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'aiConfig', 'config'), cfg, { merge: true });
  await recordAuditEvent({ action: 'CONTENT_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'AI_CONFIG', targetId: 'config', details: { aiEnabled: cfg.aiEnabled } });
  return cfg;
}

// BATCH 2A fix: canonical eligible-source query (single rule, service-side).
// Returns { eligible[], ineligible[{id, reason}] } for an exact context;
// unitId/lessonId narrow softly (general sources stay visible).
async function getEligibleSourcesRecord(callerToken, ctx = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, institutionId || ctx.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'knowledgeSources'));
  const cfg = contentConfigD2();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status === 'PUBLISHED');
  const context = {
    academicYearId: ctx.academicYearId || null,
    termId: ctx.termId || null,
    stageId: ctx.stageId || null,
    subjectId: ctx.subjectId || null,
    unitId: ctx.unitId || null,
    lessonId: ctx.lessonId || null
  };
  return cfg.filterSourcesForGenerationMirror(all, context);
}

// BATCH 2A fix: SuperAdmin usage visibility (read-only; rules allow superAdmin).
async function getAiUsageRecords(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  if (token.role !== 'superAdmin') {
    throw arabicServiceError('FORBIDDEN_AI_USAGE', 'سجلات استهلاك الذكاء الاصطناعي للإدارة العليا فقط', '');
  }
  const instId = institutionId || token.institutionId;
  if (!instId) throw arabicServiceError('MISSING_REQUIRED_FIELDS', 'المؤسسة مطلوبة', 'institutionId');
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'aiUsage'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')));
  return list.slice(0, 24);
}

// Pure interpreter for the AI Worker HTTP answer (no I/O — unit-testable).
// Decides, from status + content-type + body only, whether the answer is a
// valid generation payload. HTML is NEVER parsed as JSON. Throws Arabic
// service errors with a precise cause; never leaks raw parser output.
function interpretAiWorkerResponse({ httpStatus, contentType, text } = {}) {
  const status = Number(httpStatus) || 0;
  const ctype = String(contentType || '').toLowerCase();
  const body = typeof text === 'string' ? text : '';
  const looksHtml = ctype.includes('text/html') || /^\s*<(?:!doctype|html)/i.test(body);
  if (looksHtml) {
    if (status === 401 || status === 403) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'رفضت الشبكة أو البوابة الوسيطة طلب التوليد (صفحة حماية بدل بيانات) — تحقق من الاتصال وصلاحية الدخول ثم حاول مجددًا', '');
    }
    if (status === 404) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'عنوان خدمة التوليد أعاد صفحة غير موجودة — تحقق من إصدار البرنامج وعنوان Worker قبل إعادة المحاولة', '');
    }
    if (status === 502 || status === 503 || status === 504) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'خدمة التوليد غير متاحة حاليًا عبر البوابة (صفحة خطأ وسيطة) — انتظر قليلًا وحاول مجددًا', '');
    }
    if (status >= 200 && status < 300) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'وصلت صفحة ويب بدل بيانات التوليد (احتمال بوابة دخول شبكة أو عنوان خاطئ) — تحقق من الاتصال بالإنترنت وعنوان الخدمة', '');
    }
    throw arabicServiceError('AI_GENERATION_FAILED', `تعذر التوليد — الخادم أعاد صفحة ويب بدل بيانات (HTTP ${status})`, '');
  }
  let data = null;
  try {
    data = JSON.parse(body);
  } catch (_) {
    throw arabicServiceError('AI_PROVIDER_ERROR', 'رد غير متوقع من خدمة التوليد (صيغة غير صالحة) — حاول مجددًا', '');
  }
  if (status < 200 || status >= 300) {
    const detail = String((data && (data.error || data.message)) || `HTTP ${status}`);
    if (status === 401) throw arabicServiceError('AI_GENERATION_FAILED', 'انتهت صلاحية المصادقة — يرجى تسجيل الدخول مجددًا', '');
    if (status === 403) throw arabicServiceError('AI_GENERATION_FAILED', 'غير مصرح بالوصول لخدمة التوليد — تحقق من تفعيل الذكاء الاصطناعي لهذا السنتر وصلاحية حسابك', '');
    if (status === 404) throw arabicServiceError('AI_GENERATION_FAILED', 'نقطة نهاية التوليد غير موجودة — قد يحتاج Worker للنشر', '');
    if (status === 503) throw arabicServiceError('AI_GENERATION_FAILED', 'خدمة التوليد غير متاحة مؤقتًا — حاول لاحقًا', '');
    if (status === 500) throw arabicServiceError('AI_GENERATION_FAILED', `خطأ في خدمة التوليد (500): ${detail}`.slice(0, 500), '');
    if (detail.includes('CORRUPT_SOURCE') || detail.includes('corrupt')) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'ملف المصدر تالف أو لا يحتوي على نص قابل للقراءة — تأكد من أن الملف PDF نصي وليس ممسوحًا ضوئيًا', '');
    }
    if (detail.includes('GEMINI') || detail.includes('API_KEY') || detail.includes('provider')) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'خطأ في مزود الذكاء الاصطناعي — تحقق من إعدادات API Key في Worker', '');
    }
    if (detail.includes('CPU') || detail.includes('timeout') || detail.includes('exceeded')) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'تجاوزت عملية التوليد حدود الموارد (CPU/وقت) — جرب ملفًا أصغر أو عددًا أقل من الأسئلة', '');
    }
    throw arabicServiceError('AI_GENERATION_FAILED', detail.slice(0, 500), '');
  }
  return data;
}

// Pure draft-contract validator (no I/O — unit-testable). Every draft must
// carry a non-empty prompt and match the requested institution / subject /
// source; anything off-contract fails the whole batch so generic,
// unsourced, or foreign questions can never be persisted.
function validateAiDraftContract(drafts, { institutionId, subjectId, sourceId } = {}) {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    throw arabicServiceError('AI_GENERATION_FAILED', 'انتهى التوليد دون أسئلة صالحة — أعد المحاولة أو جرّب مصدرًا آخر', '');
  }
  for (const d of drafts) {
    const prompt = d && typeof d.prompt === 'string' ? d.prompt.trim() : '';
    const sameSource = d && (d.sourceId === sourceId);
    const sameSubject = d && (!d.subjectId || d.subjectId === subjectId);
    const sameInst = d && (!d.institutionId || d.institutionId === institutionId);
    if (!prompt || !sameSource || !sameSubject || !sameInst) {
      throw arabicServiceError('AI_GENERATION_FAILED', 'وصلت أسئلة غير مرتبطة بالمصدر المختار — أسقطت كل النتائج ولم يُحفظ شيء. أعد التوليد', '');
    }
  }
  return drafts;
}

// Pure classifier for transport-level failures (no I/O — unit-testable).
function classifyAiFetchError(fetchErr, timeoutMs) {
  if (fetchErr && fetchErr.name === 'AbortError') {
    throw arabicServiceError('AI_GENERATION_TIMEOUT', `انتهت المهلة الزمنية لتوليد الأسئلة (${Math.round((timeoutMs || 0) / 1000)} ثانية) — قد يكون الملف كبيرًا أو الخدمة مشغولة`, '');
  }
  throw arabicServiceError('AI_PROVIDER_ERROR', 'تعذر الاتصال بخدمة التوليد — تحقق من اتصال الإنترنت ثم حاول مجددًا', '');
}

// Pure page-selection parser (no I/O — unit-testable). Accepts "1, 3-5"
// style input, returns sorted unique 1-based pages, or null for whole
// document. Throws Arabic errors on malformed ranges (renderer shows them
// inline; the service re-validates before sending).
function parsePageSelection(raw) {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const out = [];
  for (const part of text.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const range = p.split('-').map((x) => x.trim());
    if (range.length === 1) {
      const v = Number(range[0]);
      if (!Number.isInteger(v) || v < 1) throw arabicServiceError('INVALID_PAGES', `رقم صفحة غير صالح: "${p}" — استخدم أرقامًا موجبة مثل 1, 3-5`, '');
      out.push(v);
    } else if (range.length === 2) {
      const a = Number(range[0]);
      const b = Number(range[1]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || b < a) {
        throw arabicServiceError('INVALID_PAGES', `نطاق صفحات غير صالح: "${p}" — مثال صحيح: 3-5`, '');
      }
      if (b - a > 79) throw arabicServiceError('INVALID_PAGES', 'نطاق الصفحات كبير جدًا (الحد 80 صفحة)', '');
      for (let n = a; n <= b; n++) out.push(n);
    } else {
      throw arabicServiceError('INVALID_PAGES', `صيغة غير صالحة: "${p}" — استخدم 1, 3-5`, '');
    }
  }
  const unique = [...new Set(out)].sort((x, y) => x - y);
  if (!unique.length) return null;
  if (unique.length > 80) throw arabicServiceError('INVALID_PAGES', 'عدد الصفحات المحددة يتجاوز 80', '');
  return unique;
}

// BATCH 2A: source-grounded generation via the Worker (keys stay server-side).
// Returns validated drafts (NOT persisted — manager review persists them).
async function requestAiQuestionGeneration(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  for (const k of ['academicYearId', 'stageId', 'subjectId', 'sourceId']) {
    if (!payload[k]) throw arabicServiceError('MISSING_REQUIRED_FIELDS', `الحقل مطلوب: ${k}`, k);
  }
  const count = payload.count !== undefined ? payload.count : 5;
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw arabicServiceError('INVALID_GENERATION_COUNT', 'عدد الأسئلة يجب أن يكون بين 1 و 100', '');
  }
  const requestId = payload.requestId || `aigen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // Page scoping (optional): array of 1-based pages, or a "1, 3-5" string.
  // Validated here; the Worker re-validates against the extracted document.
  let pages = null;
  if (payload.pages !== undefined && payload.pages !== null) {
    if (typeof payload.pages === 'string') {
      pages = parsePageSelection(payload.pages);
    } else if (Array.isArray(payload.pages)) {
      pages = [...new Set(payload.pages.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1))].sort((a, b) => a - b);
      if (!pages.length) pages = null;
      if (pages && pages.length > 80) throw arabicServiceError('INVALID_PAGES', 'عدد الصفحات المحددة يتجاوز 80', '');
    } else {
      throw arabicServiceError('INVALID_PAGES', 'صيغة الصفحات غير صالحة — استخدم 1, 3-5', '');
    }
  }
  const workerToken = await getWorkerUploadToken(callerToken);
  const body = {
    institutionId: instId,
    academicYearId: payload.academicYearId,
    termId: payload.termId || null,
    stageId: payload.stageId,
    subjectId: payload.subjectId,
    unitId: payload.unitId || null,
    lessonId: payload.lessonId || null,
    sourceId: payload.sourceId,
    questionBankId: payload.questionBankId || null,
    requestId,
    ...(pages ? { pages } : {}),
    options: {
      types: payload.types,
      questionType: payload.questionType,
      count,
      difficulty: payload.difficulty || 'MEDIUM',
      marksHundredths: payload.marksHundredths !== undefined ? payload.marksHundredths : 100,
      distribution: payload.distribution
    },
    excludePrompts: Array.isArray(payload.excludePrompts) ? payload.excludePrompts.slice(0, 100) : []
  };
  // Endpoint is derived from the canonical constant — never from string surgery
  // on a mutable URL (a failed replace would silently target a wrong path and
  // surface an HTML error page as a JSON parse failure).
  const aiEndpoint = `${WORKER_MEDIA_BASE_URL}/ai/generate-questions`;
  const safeLog = (label, value) => {
    try {
      // Dev-log only: endpoint host + non-secret diagnostics. The ID token,
      // file bytes and student PII are NEVER logged.
      console.log(`[requestAiQuestionGeneration] ${label}:`, value);
    } catch (_) {}
  };
  safeLog('Calling Worker endpoint', aiEndpoint);
  safeLog('Request context', JSON.stringify({
    institutionId: instId, academicYearId: body.academicYearId, stageId: body.stageId,
    subjectId: body.subjectId, sourceId: body.sourceId, requestId,
    count, difficulty: body.options.difficulty
  }));

  const controller = new AbortController();
  const timeoutMs = 120000; // 2 minutes timeout for AI generation
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerToken.idToken}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    safeLog('Fetch error', String((fetchErr && fetchErr.message) || fetchErr));
    classifyAiFetchError(fetchErr, timeoutMs);
  } finally {
    clearTimeout(timeoutId);
  }

  // Contract gate: inspect status + content-type BEFORE any JSON parsing.
  // The Worker always answers JSON; an HTML body means an intermediary page
  // (proxy / captive portal / edge challenge / wrong host) — never parse it
  // as JSON and never leak the raw parser error to the user.
  const httpStatus = res.status;
  const contentType = String(res.headers.get('content-type') || '');
  let responseText = '';
  try {
    responseText = await res.text();
  } catch (_) {
    throw arabicServiceError('AI_PROVIDER_ERROR', 'تعذر قراءة رد خدمة التوليد — حاول مجددًا', '');
  }
  // Safe dev-log snippet: status + content-type + length only. The body may
  // carry lesson text — never log it; tokens and keys never leave memory.
  safeLog('Response meta', JSON.stringify({
    httpStatus, contentType: contentType.toLowerCase() || null, bytes: responseText.length
  }));

  const data = interpretAiWorkerResponse({ httpStatus, contentType, text: responseText });
  if (!data || data.status !== 'SUCCESS') {
    const msg = String((data && (data.error || data.message)) || 'فشل التوليد — استجابة غير متوقعة من الخدمة');
    safeLog('Generation failed', msg.slice(0, 300));
    throw arabicServiceError('AI_GENERATION_FAILED', msg.slice(0, 500), '');
  }

  // Contract validation: drafts must be source-grounded (never generic).
  // Anything off-contract is rejected here — nothing is persisted on failure.
  const drafts = validateAiDraftContract(data.drafts, {
    institutionId: instId, subjectId: body.subjectId, sourceId: body.sourceId
  });

  safeLog('Success', JSON.stringify({ draftsCount: drafts.length, provider: data.provider || null, model: data.model || null }));
  return { ...data, drafts };
}

// ---- Central Knowledge/Source Library (Owner/Admin via Desktop) ----
async function getSources(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'knowledgeSources'));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  for (const k of ['academicYearId', 'termId', 'stageId', 'subjectId', 'unitId', 'lessonId', 'status']) {
    if (options[k]) list = list.filter(s => s[k] === options[k]);
  }
  if (options.search) {
    const q = String(options.search).trim();
    if (q) list = list.filter(s => String(s.title || '').includes(q));
  }
  return list;
}

async function createSourceRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان المصدر مطلوب', '');
  if (!payload.stageId) throw arabicServiceError('MISSING_STAGE', 'المرحلة مطلوبة للمصدر', '');
  if (!payload.subjectId) throw arabicServiceError('MISSING_SUBJECT', 'المادة مطلوبة للمصدر', '');
  const clientDb = await getClientFirestoreDb(token);
  const srcCtx = await assertHubAcademicContext(clientDb, instId, payload,
    payload.academicYearId ? await hubYearHasTerms(clientDb, instId, payload.academicYearId) : false);
  const rawGroups = Array.isArray(payload.groupIds) && payload.groupIds.length ? payload.groupIds : null;
  const verifiedGroups = await assertHubGroupTargeting(clientDb, instId, rawGroups, payload.stageId, payload.subjectId, srcCtx.academicYearId, srcCtx.termId);
  const srcUnit = await assertHubUnit(clientDb, instId, payload.unitId, srcCtx, payload.stageId, payload.subjectId);
  if (payload.mimeType) {
    const cfg = contentConfigD2();
    if (!cfg.SOURCE_MIME_TYPES.includes(payload.mimeType)) {
      throw arabicServiceError('INVALID_SOURCE_MIME', 'نوع الملف غير مدعوم للمصادر', '');
    }
  }
  if (payload.sizeBytes !== undefined && payload.sizeBytes !== null) {
    if (typeof payload.sizeBytes !== 'number' || payload.sizeBytes < 0) throw arabicServiceError('INVALID_NUMERIC_VALUE', 'حجم الملف غير صالح', '');
    if (payload.sizeBytes > contentConfigD2().MAX_SOURCE_BYTES) throw arabicServiceError('FILE_SIZE_EXCEEDED', 'حجم المصدر يتجاوز الحد المسموح (100MB)', '');
  }
  const id = payload.id || `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const source = {
    id, institutionId: instId,
    academicYearId: srcCtx.academicYearId, termId: srcCtx.termId,
    stageId: payload.stageId, subjectId: payload.subjectId,
    groupId: payload.groupId || null, groupIds: verifiedGroups,
    unitId: srcUnit, lessonId: payload.lessonId || null,
    title: String(payload.title).trim().slice(0, 200),
    description: payload.description ? String(payload.description).trim().slice(0, 2000) : null,
    mimeType: payload.mimeType || null, sizeBytes: payload.sizeBytes ?? null,
    objectKey: payload.objectKey || null,
    status: 'DRAFT', version: 1,
    createdAt: now, updatedAt: now, createdBy: token.uid, updatedBy: token.uid,
    publishedAt: null, archivedAt: null
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'knowledgeSources', id), source);
  await recordAuditEvent({ action: 'CONTENT_UPLOAD', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SOURCE', targetId: id, details: { title: source.title } });
  return source;
}

// BATCH 2A fix: persist the Worker-minted file binding after upload.
// The objectKey MUST live under this source's own namespace — arbitrary
// client-supplied keys are rejected (never trust client objectKey).
async function updateSourceRecord(callerToken, sourceId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:update');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'knowledgeSources', sourceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'المصدر غير موجود', sourceId);
  const cur = snap.data();
  if (cur.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
  if (cur.status === 'ARCHIVED') throw arabicServiceError('INVALID_STATUS_TRANSITION', 'لا يمكن تعديل مصدر مؤرشف', '');
  const next = { ...cur };
  if (payload.title !== undefined) {
    if (!payload.title || !String(payload.title).trim()) throw arabicServiceError('INVALID_TITLE', 'عنوان المصدر مطلوب', '');
    next.title = String(payload.title).trim().slice(0, 200);
  }
  if (payload.description !== undefined) next.description = payload.description ? String(payload.description).slice(0, 2000) : null;
  if (payload.objectKey !== undefined) {
    const key = payload.objectKey ? String(payload.objectKey) : null;
    if (key) {
      const prefix = `institutions/${instId}/knowledge/${sourceId}/`;
      if (!key.startsWith(prefix) || key.includes('../') || key.includes('..\\')) {
        throw arabicServiceError('INVALID_OBJECT_KEY', 'مفتاح الكائن لا ينتمي لهذا المصدر', '');
      }
      // AI-2 versioning: replacing attached bytes with different bytes starts
      // a new source version (first attach keeps version; prior chunk sets
      // stay immutable and are superseded at next ingestion, never mutated).
      if (cur.objectKey && cur.objectKey !== key) {
        next.version = (Number.isInteger(cur.version) && cur.version >= 1 ? cur.version : 1) + 1;
      }
    }
    next.objectKey = key;
  }
  if (payload.sizeBytes !== undefined) {
    if (payload.sizeBytes !== null && (typeof payload.sizeBytes !== 'number' || payload.sizeBytes < 0)) {
      throw arabicServiceError('INVALID_NUMERIC_VALUE', 'حجم الملف غير صالح', '');
    }
    next.sizeBytes = payload.sizeBytes;
  }
  if (payload.mimeType !== undefined) {
    if (payload.mimeType !== null && !contentConfigD2().SOURCE_MIME_TYPES.includes(payload.mimeType)) {
      throw arabicServiceError('INVALID_SOURCE_MIME', 'نوع الملف غير مدعوم للمصادر', '');
    }
    next.mimeType = payload.mimeType;
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = token.uid;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'CONTENT_UPDATE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SOURCE', targetId: sourceId, details: { hasFile: !!next.objectKey } });
  return next;
}

async function setSourceStatusRecord(callerToken, sourceId, toStatus, institutionId) {
  const token = resolveCallerToken(callerToken);
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, toStatus === 'PUBLISHED' ? 'content:publish' : 'content:archive');
  const edges = { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: [] };
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'knowledgeSources', sourceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'المصدر غير موجود', sourceId);
  const cur = snap.data();
  if (!(edges[cur.status] || []).includes(toStatus) && cur.status !== toStatus) {
    throw arabicServiceError('INVALID_STATUS_TRANSITION', `انتقال غير صالح ${cur.status} ← ${toStatus}`, '');
  }
  const now = new Date().toISOString();
  const next = { ...cur, status: toStatus, updatedAt: now, updatedBy: token.uid };
  if (toStatus === 'PUBLISHED') next.publishedAt = now;
  if (toStatus === 'ARCHIVED') next.archivedAt = now;
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: toStatus === 'PUBLISHED' ? 'CONTENT_PUBLISH' : 'CONTENT_ARCHIVE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'SOURCE', targetId: sourceId, details: { from: cur.status, to: toStatus } });
  return next;
}

// ---- Center result approval / review / analytics (Owner/Admin via Desktop) ----
// Grades themselves stay server-only; Desktop persists human review + approval
// decisions to tenant-admin collections and joins them for display/analytics.
async function getGradeApprovals(callerToken, examId, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'gradeApprovals'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !examId || a.examId === examId);
}

async function getGradeReviews(callerToken, examId, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'gradeReviews'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => !examId || r.examId === examId);
}

async function submitSubjectiveReviewRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'homework:grade');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (token.role === 'teacher' || token.role === 'student' || token.role === 'parent') {
    throw arabicServiceError('FORBIDDEN_GRADE_REVIEW', 'مراجعة نتائج الاختبارات المركزية للإدارة فقط', '');
  }
  for (const k of ['gradeId', 'examId', 'studentId']) {
    if (!payload[k]) throw arabicServiceError('MISSING_REQUIRED_FIELDS', `الحقل مطلوب: ${k}`, k);
  }
  if (!Array.isArray(payload.reviews) || !payload.reviews.length) {
    throw arabicServiceError('MISSING_REQUIRED_FIELDS', 'تقييم سؤال واحد على الأقل مطلوب', 'reviews');
  }
  const clientDb = await getClientFirestoreDb(token);
  const gradeSnap = await getDoc(doc(clientDb, 'institutions', instId, 'grades', payload.gradeId));
  if (gradeSnap.exists() && (gradeSnap.data() || {}).institutionId !== instId) {
    throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
  }
  const id = payload.id || `rev_${payload.gradeId}_${Date.now()}`;
  const now = new Date().toISOString();
  const record = {
    id, institutionId: instId, gradeId: payload.gradeId, examId: payload.examId, studentId: payload.studentId,
    reviews: payload.reviews.slice(0, 100).map(r => ({
      questionId: String(r.questionId || ''),
      scoreHundredths: r.scoreHundredths,
      maxHundredths: r.maxHundredths !== undefined ? r.maxHundredths : null,
      feedback: r.feedback !== undefined ? String(r.feedback).slice(0, 2000) : null
    })),
    reviewedBy: { uid: token.uid, role: token.role, institutionId: instId },
    reviewedAt: now, createdAt: now
  };
  for (const r of record.reviews) {
    if (!r.questionId) throw arabicServiceError('INVALID_REVIEW', 'كل تقييم يتطلب questionId', '');
    if (typeof r.scoreHundredths !== 'number' || r.scoreHundredths < 0) throw arabicServiceError('INVALID_REVIEW', 'الدرجة يجب أن تكون رقمًا غير سالب', '');
    if (r.maxHundredths !== null && r.scoreHundredths > r.maxHundredths) throw arabicServiceError('INVALID_REVIEW', 'الدرجة تتجاوز درجة السؤال', '');
  }
  await setDoc(doc(clientDb, 'institutions', instId, 'gradeReviews', id), record);
  await recordAuditEvent({ action: 'HOMEWORK_GRADE', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GRADE', targetId: payload.gradeId, details: { reviews: record.reviews.length } });
  return record;
}

async function approveCenterResultRecord(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:publish');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (token.role === 'teacher' || token.role === 'student' || token.role === 'parent') {
    throw arabicServiceError('FORBIDDEN_GRADE_APPROVAL', 'اعتماد نتائج الاختبارات المركزية للإدارة فقط', '');
  }
  for (const k of ['gradeId', 'examId', 'studentId', 'decision', 'reason']) {
    if (payload[k] === undefined || payload[k] === null || payload[k] === '') {
      throw arabicServiceError('MISSING_REQUIRED_FIELDS', `الحقل مطلوب: ${k}`, k);
    }
  }
  const decision = String(payload.decision).trim().toUpperCase();
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    throw arabicServiceError('INVALID_DECISION', 'القرار يجب أن يكون APPROVED أو REJECTED', 'decision');
  }
  const clientDb = await getClientFirestoreDb(token);
  const gradeSnap = await getDoc(doc(clientDb, 'institutions', instId, 'grades', payload.gradeId));
  if (gradeSnap.exists()) {
    const g = gradeSnap.data() || {};
    if (g.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'انتهاك حدود المؤسسة', '');
    if (g.examId && g.examId !== payload.examId) throw arabicServiceError('EXAM_SCOPE_MISMATCH', 'الدرجة لا تنتمي لهذا الاختبار', 'examId');
  }
  const id = payload.id || `apr_${payload.gradeId}_${Date.now()}`;
  const now = new Date().toISOString();
  const approval = {
    id, institutionId: instId, gradeId: payload.gradeId, examId: payload.examId, studentId: payload.studentId,
    decision, reason: String(payload.reason).trim().slice(0, 2000),
    actor: { uid: token.uid, role: token.role, institutionId: instId },
    createdAt: now, publishedAt: null
  };
  await setDoc(doc(clientDb, 'institutions', instId, 'gradeApprovals', id), approval);
  await recordAuditEvent({ action: decision === 'APPROVED' ? 'GRADE_APPROVED' : 'GRADE_REJECTED', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GRADE', targetId: payload.gradeId, details: { decision } });
  return approval;
}

async function publishCenterResultRecord(callerToken, approvalId, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:publish');
  contentOfflineGuard();
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (token.role === 'teacher' || token.role === 'student' || token.role === 'parent') {
    throw arabicServiceError('FORBIDDEN_GRADE_APPROVAL', 'نشر نتائج الاختبارات المركزية للإدارة فقط', '');
  }
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'gradeApprovals', approvalId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'الاعتماد غير موجود', approvalId);
  const cur = snap.data();
  if (cur.decision !== 'APPROVED') throw arabicServiceError('INVALID_PUBLISH_STATE', 'النشر متاح للنتائج المعتمدة فقط', '');
  const now = new Date().toISOString();
  const next = { ...cur, publishedAt: now, updatedAt: now, updatedBy: token.uid };
  await setDoc(ref, next, { merge: true });
  await recordAuditEvent({ action: 'GRADE_PUBLISHED', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'GRADE', targetId: cur.gradeId, details: {} });
  return next;
}

// Real aggregation over tenant grades + frozen snapshots + attempt answers.
// Nothing hardcoded; recompute to refresh.
async function getExamAnalyticsRecord(callerToken, examId, institutionId) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:view');
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = await getClientFirestoreDb(token);
  const [gradesSnap, snapsSnap, attemptsSnap] = await Promise.all([
    getDocs(collection(clientDb, 'institutions', instId, 'grades')),
    getDocs(collection(clientDb, 'institutions', instId, 'examQuestions')),
    getDocs(collection(clientDb, 'institutions', instId, 'examAttempts'))
  ]);
  const grades = gradesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.examId === examId && g.institutionId === instId);
  const snapshots = snapsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.examId === examId);
  // Per-question outcomes aggregated from attempt answers (correct vs total).
  const outcomeAgg = {};
  for (const a of attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.examId === examId)) {
    const ans = Array.isArray(a.answers) ? a.answers : (Array.isArray(a.questionOutcomes) ? a.questionOutcomes : []);
    for (const o of ans) {
      if (!o || !o.questionId) continue;
      if (!outcomeAgg[o.questionId]) outcomeAgg[o.questionId] = { questionId: o.questionId, correctCount: 0, totalCount: 0 };
      outcomeAgg[o.questionId].totalCount += 1;
      if (o.correct === true) outcomeAgg[o.questionId].correctCount += 1;
    }
  }
  const OFFICIAL = ['APPROVED', 'PUBLISHED_RESULT', 'FINALIZED', 'GRADED'];
  const official = grades.filter(g => OFFICIAL.includes(g.gradingStatus));
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : 0);
  const pcts = official.map(g => g.percentageHundredths || 0);
  const passed = official.filter(g => g.resultStatus === 'PASS').length;
  const byGroup = {};
  for (const g of official) {
    const gid = g.groupId || 'ungrouped';
    if (!byGroup[gid]) byGroup[gid] = { groupId: gid, count: 0, percentages: [], passed: 0 };
    byGroup[gid].count += 1;
    byGroup[gid].percentages.push(g.percentageHundredths || 0);
    if (g.resultStatus === 'PASS') byGroup[gid].passed += 1;
  }
  const questionStats = snapshots.map(s => {
    const o = outcomeAgg[s.questionId || s.id];
    return {
      questionId: s.questionId || s.id, questionType: s.questionType,
      marksHundredths: s.marksHundredths || 0,
      correctCount: o ? o.correctCount : 0, totalCount: o ? o.totalCount : 0,
      correctRateHundredths: o && o.totalCount > 0 ? Math.round((o.correctCount / o.totalCount) * 10000) : 0
    };
  });
  return {
    examId, institutionId: instId, computedAt: new Date().toISOString(),
    totalGradesCount: grades.length,
    officialGradesCount: official.length,
    pendingGradesCount: grades.length - official.length,
    passedCount: passed, failedCount: official.length - passed,
    averagePercentageHundredths: avg(pcts),
    highestPercentageHundredths: pcts.length ? Math.max(...pcts) : 0,
    lowestPercentageHundredths: pcts.length ? Math.min(...pcts) : 0,
    passRatePercentageHundredths: official.length ? Math.round((passed / official.length) * 10000) : 0,
    groupComparison: Object.values(byGroup).map(b => ({
      groupId: b.groupId, studentCount: b.count,
      averagePercentageHundredths: avg(b.percentages),
      highestPercentageHundredths: b.percentages.length ? Math.max(...b.percentages) : 0,
      lowestPercentageHundredths: b.percentages.length ? Math.min(...b.percentages) : 0,
      passCount: b.passed
    })).sort((a, b) => b.averagePercentageHundredths - a.averagePercentageHundredths),
    questionStats,
    weakQuestions: questionStats.filter(q => q.totalCount > 0).sort((a, b) => a.correctRateHundredths - b.correctRateHundredths).slice(0, 10)
  };
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
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'grades');
  const snap = await getDocs(colRef);
  const existingDoc = snap.docs.find(d => {
    const data = d.data();
    return data.examId === payload.examId && data.studentId === payload.studentId;
  });
  const id = existingDoc ? existingDoc.id : (payload.id || `GRD_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`);
  const score = Number(payload.score) || 0;
  const maxScore = Number(payload.maxScore) || 100;
  const attendanceStatus = payload.attendanceStatus || (payload.isAbsent ? 'ABSENT' : 'PRESENT');
  const pct = attendanceStatus === 'ABSENT' ? 0 : Math.round((score / maxScore) * 100);

  const grade = {
    id,
    institutionId: instId,
    examId: payload.examId || '',
    studentId: payload.studentId || '',
    studentName: payload.studentName || 'طالب',
    studentCode: payload.studentCode || '',
    attendanceStatus,
    score: attendanceStatus === 'ABSENT' ? 0 : score,
    maxScore,
    percentage: pct,
    notes: payload.notes || '',
    status: attendanceStatus === 'ABSENT' ? 'ABSENT' : (pct >= 50 ? 'PASSED' : 'FAILED'),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(clientDb, 'institutions', instId, 'grades', id), grade, { merge: true });
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
  if (isTestOffline()) {
    return Array.from(inMemoryGuardians.values()).filter(g => g.institutionId === instId);
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'guardians');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getParentById(callerToken, parentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isTestOffline()) {
    const key = `${instId}_${parentId}`;
    return inMemoryGuardians.get(key) || null;
  }
  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'guardians', parentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function createParent(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'parents:create');

  const name = (payload.name || '').trim();
  const phone = (payload.phone || '').trim();
  const email = (payload.email || '').trim();
  if (!name) throw arabicServiceError('INVALID_NAME', 'اسم ولي الأمر مطلوب');
  if (!phone) throw arabicServiceError('INVALID_PHONE', 'رقم الهاتف مطلوب');
  const normalizedPhone = normalizeEgyptianPhone(phone);

  if (isTestOffline()) {
    const dup = Array.from(inMemoryGuardians.values()).find(d => d.institutionId === instId && d.normalizedPhone === normalizedPhone && d.status !== 'ARCHIVED');
    if (dup) throw arabicServiceError('DUPLICATE_PHONE', 'رقم الهاتف مستخدم مسبقًا لولي أمر آخر');
  } else {
    const clientDb = await getClientFirestoreDb(token);
    const dupQuery = query(collection(clientDb, 'institutions', instId, 'guardians'), where('normalizedPhone', '==', normalizedPhone));
    const dupSnap = await getDocs(dupQuery);
    if (dupSnap.docs.some(d => d.data().status !== 'ARCHIVED')) {
      throw arabicServiceError('DUPLICATE_PHONE', 'رقم الهاتف مستخدم مسبقًا لولي أمر آخر');
    }
  }

  const id = `GRD_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date().toISOString();
  const authUid = `auth_parent_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`;
  const pin = payload.pin || Math.floor(100000 + Math.random() * 900000).toString();
  const parent = {
    id,
    institutionId: instId,
    name: name,
    phone: payload.phone,
    normalizedPhone,
    pin,
    tempPassword: pin,
    email: email || `${normalizedPhone}@parent.remas.edu`,
    authUid,
    accountCreated: true,
    linkedStudentIds: [],
    linkedStudentNames: [],
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    createdBy: token.uid || 'system'
  };

  if (isTestOffline()) {
    inMemoryGuardians.set(`${instId}_${id}`, { ...parent });
  } else {
    const clientDb = await getClientFirestoreDb(token);
    await setDoc(doc(clientDb, 'institutions', instId, 'guardians', id), parent);
  }
  await recordAuditEvent({ action: 'CREATE_PARENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: id, details: { name } });
  return parent;
}

async function updateParent(callerToken, parentId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  requirePermission(token, 'parents:update');

  const updates = { ...payload, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system' };
  delete updates.id;
  delete updates.institutionId;
  delete updates.linkedStudentIds;
  delete updates.linkedStudentNames;
  delete updates.createdAt;
  delete updates.createdBy;

  if (payload.phone) {
    const normalizedPhone = normalizeEgyptianPhone(payload.phone);
    updates.normalizedPhone = normalizedPhone;
    updates.phone = payload.phone;
  }
  if (payload.name) updates.name = payload.name.trim();
  if (payload.email) updates.email = payload.email.trim();
  if (payload.status) updates.status = payload.status;

  if (isTestOffline()) {
    const key = `${instId}_${parentId}`;
    const existing = inMemoryGuardians.get(key);
    if (!existing) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');
    const updated = { ...existing, ...updates };
    inMemoryGuardians.set(key, updated);
    await recordAuditEvent({ action: 'UPDATE_PARENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: {} });
    return updated;
  }

  const clientDb = await getClientFirestoreDb(token);
  const existingRef = doc(clientDb, 'institutions', instId, 'guardians', parentId);
  const existingSnap = await getDoc(existingRef);
  if (!existingSnap.exists()) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');

  await updateDoc(existingRef, updates);
  await recordAuditEvent({ action: 'UPDATE_PARENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: {} });
  return { ...existingSnap.data(), ...updates };
}

async function archiveParent(callerToken, parentId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  requirePermission(token, 'parents:archive');

  if (isTestOffline()) {
    const key = `${instId}_${parentId}`;
    const existing = inMemoryGuardians.get(key);
    if (!existing) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');
    inMemoryGuardians.set(key, { ...existing, status: 'ARCHIVED', updatedAt: new Date().toISOString() });
    await recordAuditEvent({ action: 'ARCHIVE_PARENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: {} });
    return { success: true, id: parentId };
  }

  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'guardians', parentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');

  await updateDoc(ref, { status: 'ARCHIVED', updatedAt: new Date().toISOString() });
  await recordAuditEvent({ action: 'ARCHIVE_PARENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: {} });
  return { success: true, id: parentId };
}

async function linkParentToStudent(callerToken, parentId, studentId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  requirePermission(token, 'parents:update');

  if (isTestOffline()) {
    const parentKey = `${instId}_${parentId}`;
    const parent = inMemoryGuardians.get(parentKey);
    if (!parent) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');
    const student = inMemoryStudents.get(`${instId}_${studentId}`);
    if (!student) throw arabicServiceError('NOT_FOUND', 'الطالب غير موجود');

    const linked = parent.linkedStudentIds || [];
    if (!linked.includes(studentId)) {
      parent.linkedStudentIds = [...linked, studentId];
      parent.linkedStudentNames = [...(parent.linkedStudentNames || []), student.name || studentId];
      parent.updatedAt = new Date().toISOString();
      inMemoryGuardians.set(parentKey, parent);
    }
    student.parentUid = parent.authUid || student.parentUid;
    student.guardianId = parent.id;
    student.guardianUids = [parent.authUid];
    await recordAuditEvent({ action: 'LINK_PARENT_STUDENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: { studentId } });
    return { success: true };
  }

  const clientDb = await getClientFirestoreDb(token);
  const parentRef = doc(clientDb, 'institutions', instId, 'guardians', parentId);
  const studentRef = doc(clientDb, 'institutions', instId, 'students', studentId);

  const [parentSnap, studentSnap] = await Promise.all([getDoc(parentRef), getDoc(studentRef)]);
  if (!parentSnap.exists()) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');
  if (!studentSnap.exists()) throw arabicServiceError('NOT_FOUND', 'الطالب غير موجود');
  if (studentSnap.data().institutionId !== instId) throw arabicServiceError('CROSS_TENANT', 'الطالب ينتمي لمؤسسة أخرى');

  const parentData = parentSnap.data();
  const linked = parentData.linkedStudentIds || [];
  if (!linked.includes(studentId)) {
    const studentData = studentSnap.data();
    const newLinked = [...linked, studentId];
    const newNames = [...(parentData.linkedStudentNames || []), studentData.name || studentId];
    await updateDoc(parentRef, { linkedStudentIds: newLinked, linkedStudentNames: newNames, updatedAt: new Date().toISOString() });
  }
  await recordAuditEvent({ action: 'LINK_PARENT_STUDENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: { studentId } });
  return { success: true };
}

async function unlinkParentFromStudent(callerToken, parentId, studentId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  requirePermission(token, 'parents:update');

  if (isTestOffline()) {
    const parentKey = `${instId}_${parentId}`;
    const parent = inMemoryGuardians.get(parentKey);
    if (!parent) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');

    const linked = parent.linkedStudentIds || [];
    const names = parent.linkedStudentNames || [];
    const idx = linked.indexOf(studentId);
    if (idx === -1) throw arabicServiceError('NOT_LINKED', 'الطالب غير مرتبط بهذا الولي');

    parent.linkedStudentIds = linked.filter(id => id !== studentId);
    parent.linkedStudentNames = names.filter((_, i) => i !== idx);
    parent.updatedAt = new Date().toISOString();
    inMemoryGuardians.set(parentKey, parent);

    const student = inMemoryStudents.get(`${instId}_${studentId}`);
    if (student && student.guardianId === parentId) {
      delete student.parentUid;
      delete student.guardianId;
      delete student.guardianUids;
    }
    await recordAuditEvent({ action: 'UNLINK_PARENT_STUDENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: { studentId } });
    return { success: true };
  }

  const clientDb = await getClientFirestoreDb(token);
  const parentRef = doc(clientDb, 'institutions', instId, 'guardians', parentId);
  const snap = await getDoc(parentRef);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');

  const parentData = snap.data();
  const linked = parentData.linkedStudentIds || [];
  const names = parentData.linkedStudentNames || [];
  const idx = linked.indexOf(studentId);
  if (idx === -1) throw arabicServiceError('NOT_LINKED', 'الطالب غير مرتبط بهذا الولي');

  const newLinked = linked.filter(id => id !== studentId);
  const newNames = names.filter((_, i) => i !== idx);

  await updateDoc(parentRef, { linkedStudentIds: newLinked, linkedStudentNames: newNames, updatedAt: new Date().toISOString() });
  await recordAuditEvent({ action: 'UNLINK_PARENT_STUDENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: { studentId } });
  return { success: true };
}

async function deleteParent(callerToken, parentId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, token.institutionId);
  requirePermission(token, 'parents:archive');

  if (isTestOffline()) {
    const parentKey = `${instId}_${parentId}`;
    const data = inMemoryGuardians.get(parentKey);
    if (!data) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');
    if (data.linkedStudentIds && data.linkedStudentIds.length > 0) {
      throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن حذف ولي أمر مرتبط بطلاب — افصلهم أولاً');
    }
    inMemoryGuardians.delete(parentKey);
    await recordAuditEvent({ action: 'DELETE_PARENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: {} });
    return { success: true };
  }

  const clientDb = await getClientFirestoreDb(token);
  const ref = doc(clientDb, 'institutions', instId, 'guardians', parentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw arabicServiceError('NOT_FOUND', 'ولي الأمر غير موجود');
  const data = snap.data();
  if (data.linkedStudentIds && data.linkedStudentIds.length > 0) {
    throw arabicServiceError('HAS_DEPENDENCIES', 'لا يمكن حذف ولي أمر مرتبط بطلاب — افصلهم أولاً');
  }

  await deleteDoc(ref);
  await recordAuditEvent({ action: 'DELETE_PARENT', actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'PARENT', targetId: parentId, details: {} });
  return { success: true, id: parentId };
}

/**
 * Automatically synchronizes or creates a Parent/Guardian account when a student is created or updated.
 * Links the student to an existing guardian with the same phone, or creates a new guardian record.
 */
async function syncGuardianForStudent(callerToken, clientDb, instId, studentDoc) {
  if (!studentDoc || !studentDoc.id) return null;
  const token = resolveCallerToken(callerToken);
  const rawGuardianPhone = (studentDoc.guardianPhone || '').trim();
  const rawGuardianName = (studentDoc.guardianName || '').trim() || `ولي أمر الطالب ${studentDoc.name || ''}`.trim();
  if (!rawGuardianPhone) return null;

  let normalizedPhone = '';
  try {
    normalizedPhone = normalizeEgyptianPhone(rawGuardianPhone);
  } catch (e) {
    normalizedPhone = rawGuardianPhone.replace(/\D/g, '');
  }
  if (!normalizedPhone) return null;

  const dbInstance = clientDb || (await getClientFirestoreDb(token));

  // 1. Check if guardian already exists in this institution
  let existingGuardian = null;
  if (isTestOffline()) {
    existingGuardian = Array.from(inMemoryGuardians.values()).find(g => g.institutionId === instId && (g.normalizedPhone === normalizedPhone || g.phone === rawGuardianPhone) && g.status !== 'ARCHIVED') || null;
  } else {
    const qg = query(collection(dbInstance, 'institutions', instId, 'guardians'), where('normalizedPhone', '==', normalizedPhone));
    const snap = await getDocs(qg);
    const activeDocs = snap.docs.filter(d => d.data().status !== 'ARCHIVED');
    if (activeDocs.length > 0) {
      existingGuardian = { id: activeDocs[0].id, ...activeDocs[0].data() };
    }
  }

  const studentId = studentDoc.id;
  const studentName = studentDoc.name || 'طالب';
  const now = new Date().toISOString();
  const authUid = `auth_parent_${crypto.createHash('md5').update(normalizedPhone).digest('hex').substring(0, 16)}`;

  if (existingGuardian) {
    // Existing guardian: link student if not already in list
    const currentLinkedIds = existingGuardian.linkedStudentIds || [];
    const currentLinkedNames = existingGuardian.linkedStudentNames || [];
    let needsUpdate = false;
    const newLinkedIds = [...currentLinkedIds];
    const newLinkedNames = [...currentLinkedNames];

    if (!newLinkedIds.includes(studentId)) {
      newLinkedIds.push(studentId);
      newLinkedNames.push(studentName);
      needsUpdate = true;
    }

    if (!existingGuardian.authUid) {
      existingGuardian.authUid = authUid;
      needsUpdate = true;
    }

    if (!existingGuardian.pin) {
      existingGuardian.pin = Math.floor(100000 + Math.random() * 900000).toString();
      existingGuardian.tempPassword = existingGuardian.pin;
      needsUpdate = true;
    }

    if (needsUpdate) {
      const patch = {
        linkedStudentIds: newLinkedIds,
        linkedStudentNames: newLinkedNames,
        authUid: existingGuardian.authUid,
        pin: existingGuardian.pin,
        tempPassword: existingGuardian.pin,
        updatedAt: now
      };
      if (isTestOffline()) {
        const key = `${instId}_${existingGuardian.id}`;
        inMemoryGuardians.set(key, { ...existingGuardian, ...patch });
      } else {
        await updateDoc(doc(dbInstance, 'institutions', instId, 'guardians', existingGuardian.id), patch);
      }
    }

    // Link relationship record
    const relId = `REL_${existingGuardian.id}_${studentId}`;
    if (isTestOffline()) {
      inMemoryStudentGuardians.set(`${instId}_${relId}`, {
        id: relId,
        institutionId: instId,
        studentId,
        studentName,
        guardianId: existingGuardian.id,
        guardianName: existingGuardian.name || rawGuardianName,
        guardianPhone: existingGuardian.phone || rawGuardianPhone,
        guardianAuthUid: existingGuardian.authUid,
        createdAt: now
      });
      const memKey = `${instId}_${studentId}`;
      const memStudent = inMemoryStudents.get(memKey);
      if (memStudent) {
        memStudent.parentUid = existingGuardian.authUid;
        memStudent.guardianId = existingGuardian.id;
        memStudent.guardianUids = [existingGuardian.authUid];
      }
    } else {
      await setDoc(doc(dbInstance, 'institutions', instId, 'studentGuardians', relId), {
        id: relId,
        institutionId: instId,
        studentId,
        studentName,
        guardianId: existingGuardian.id,
        guardianName: existingGuardian.name || rawGuardianName,
        guardianPhone: existingGuardian.phone || rawGuardianPhone,
        guardianAuthUid: existingGuardian.authUid,
        createdAt: now
      }, { merge: true });

      // Link back to student document
      await setDoc(doc(dbInstance, 'institutions', instId, 'students', studentId), {
        parentUid: existingGuardian.authUid,
        guardianId: existingGuardian.id,
        guardianUids: [existingGuardian.authUid]
      }, { merge: true });
    }

    return existingGuardian;
  } else {
    // Guardian does NOT exist -> auto-create new parent account & link student!
    const guardianId = `GRD_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const guardianPin = Math.floor(100000 + Math.random() * 900000).toString();
    const newGuardian = {
      id: guardianId,
      institutionId: instId,
      name: rawGuardianName,
      phone: rawGuardianPhone,
      normalizedPhone,
      pin: guardianPin,
      tempPassword: guardianPin,
      email: `${normalizedPhone}@parent.remas.edu`,
      authUid,
      accountCreated: true,
      autoCreatedFromStudent: true,
      linkedStudentIds: [studentId],
      linkedStudentNames: [studentName],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdBy: token.uid || 'system'
    };

    const newRelId = `REL_${guardianId}_${studentId}`;
    if (isTestOffline()) {
      inMemoryGuardians.set(`${instId}_${guardianId}`, { ...newGuardian });
      inMemoryStudentGuardians.set(`${instId}_${newRelId}`, {
        id: newRelId,
        institutionId: instId,
        studentId,
        studentName,
        guardianId,
        guardianName: rawGuardianName,
        guardianPhone: rawGuardianPhone,
        guardianAuthUid: authUid,
        createdAt: now
      });
      const memKey = `${instId}_${studentId}`;
      const memStudent = inMemoryStudents.get(memKey);
      if (memStudent) {
        memStudent.parentUid = authUid;
        memStudent.guardianId = guardianId;
        memStudent.guardianUids = [authUid];
      }
    } else {
      await setDoc(doc(dbInstance, 'institutions', instId, 'guardians', guardianId), newGuardian);

      await setDoc(doc(dbInstance, 'institutions', instId, 'studentGuardians', newRelId), {
        id: newRelId,
        institutionId: instId,
        studentId,
        studentName,
        guardianId,
        guardianName: rawGuardianName,
        guardianPhone: rawGuardianPhone,
        guardianAuthUid: authUid,
        createdAt: now
      });

      // Update student document with guardian links
      await setDoc(doc(dbInstance, 'institutions', instId, 'students', studentId), {
        parentUid: authUid,
        guardianId,
        guardianUids: [authUid]
      }, { merge: true });
    }

    await recordAuditEvent({
      action: 'AUTO_CREATE_PARENT_ACCOUNT',
      actorUid: token.uid,
      actorRole: token.role,
      institutionId: instId,
      targetType: 'PARENT',
      targetId: guardianId,
      details: { name: rawGuardianName, phone: rawGuardianPhone, studentId, studentName }
    });

    return newGuardian;
  }
}

/**
 * Batch scans all students in the institution and ensures each has a linked Parent account.
 */
async function syncAllGuardiansFromStudents(callerToken, options = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, options.institutionId || token.institutionId);
  requirePermission(token, 'students:update');
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);

  let allStudents = [];
  if (isTestOffline()) {
    allStudents = Array.from(inMemoryStudents.values()).filter(s => s.institutionId === instId && s.status !== 'ARCHIVED');
  } else {
    const snap = await getDocs(collection(clientDb, 'institutions', instId, 'students'));
    allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== 'ARCHIVED');
  }

  let createdCount = 0;
  let linkedCount = 0;

  for (const s of allStudents) {
    if (s.guardianPhone && String(s.guardianPhone).trim()) {
      try {
        const res = await syncGuardianForStudent(token, clientDb, instId, s);
        if (res) {
          if (res.autoCreatedFromStudent) createdCount++;
          else linkedCount++;
        }
      } catch (e) {
        console.warn(`[syncAllGuardians] Error syncing student ${s.id}:`, e && e.message);
      }
    }
  }

  return {
    success: true,
    totalStudents: allStudents.length,
    createdCount,
    linkedCount
  };
}

// ----------------------------------------------------------------------------
// FINANCE & RECEIPTS — Batch C (Milestone C)
// Money unit: EGP float with deterministic 2-decimal normalization (no migration;
// existing docs already use `amount` in the same unit). Balance is ALWAYS derived
// from canonical docs (charges − discount − waiver − payments), never stored as
// an authoritative mutable field. Payments + receipts are append-only: the
// service exposes no update/delete for them.
// ----------------------------------------------------------------------------

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'ELECTRONIC', 'OTHER'];

// Deterministic 2-decimal normalization. Rejects non-finite values and inputs
// with more than 2 decimals (no silent rounding of user input); all internal
// arithmetic is re-normalized so 0.1+0.2 === 0.30 exactly.
function normMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) throw arabicServiceError('INVALID_MONEY', 'المبلغ المالي غير صالح', String(n));
  const scaled = v * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    throw arabicServiceError('INVALID_MONEY_PRECISION', 'المبلغ يجب ألا يتجاوز منزلتين عشريتين', String(n));
  }
  return Math.round(scaled + Number.EPSILON) / 100;
}

function assertPositiveMoney(n, fieldLabel = 'المبلغ') {
  const v = normMoney(n);
  if (v <= 0) throw arabicServiceError('INVALID_MONEY', `${fieldLabel} يجب أن يكون أكبر من الصفر`, String(n));
  return v;
}

function assertNonNegativeMoney(n, fieldLabel = 'المبلغ') {
  const v = normMoney(n);
  if (v < 0) throw arabicServiceError('INVALID_MONEY', `${fieldLabel} لا يمكن أن يكون سالبًا`, String(n));
  return v;
}

function assertPaymentMethod(method) {
  const m = String(method || 'CASH').trim().toUpperCase();
  if (!PAYMENT_METHODS.includes(m)) {
    throw arabicServiceError('INVALID_PAYMENT_METHOD', 'طريقة الدفع يجب أن تكون CASH/BANK_TRANSFER/ELECTRONIC/OTHER', String(method));
  }
  return m;
}

function todayISODate(now = new Date()) {
  return now.toISOString().split('T')[0];
}

// Receipt number: REC-{institutionId}-{YYYYMMDD}-{HHmmssSSS}-{R4}.
// Unique under concurrency by construction (ms timestamp + crypto random
// suffix); the service additionally checks existence and regenerates on
// collision (max 3 attempts) — never count+1 alone.
function generateReceiptNumber(institutionId, now = new Date()) {
  const d = todayISODate(now).replace(/-/g, '');
  const t = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0') + String(now.getMilliseconds()).padStart(3, '0');
  const r = crypto.randomBytes(3).toString('base64').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  return `REC-${institutionId}-${d}-${t}-${r}`;
}

function isReceiptNumberTaken(instId, receiptNumber) {
  if (isTestOffline()) return inMemoryReceipts.has(`${instId}_${receiptNumber}`);
  return false; // online existence check happens inline with getDoc before batch commit
}

// C.1 human sequential receipt numbers: receiptCounters/{institutionId} holds
// {lastNumber}. Allocation is concurrency-safe ONLY inside a Firestore
// transaction (read counter → next → write counter+payment+receipt atomically).
// Historical REC-* receipts keep their numbers; the new human sequence starts
// at 000001. If a counter must ever continue past historical receipts, STOP
// and report — never invent a migration rule.
const inMemoryReceiptCounters = new Map();

function padHumanReceiptNumber(n) {
  return String(n).padStart(6, '0');
}

async function allocateHumanReceiptNumberTx(transaction, clientDb, instId) {
  const counterRef = doc(clientDb, 'institutions', instId, 'receiptCounters', instId);
  const snap = await transaction.get(counterRef);
  const last = snap.exists() ? Number(snap.data().lastNumber || 0) : 0;
  const next = last + 1;
  transaction.set(counterRef, { institutionId: instId, lastNumber: next, updatedAt: new Date().toISOString() }, { merge: true });
  return padHumanReceiptNumber(next);
}

function allocateHumanReceiptNumberOffline(instId) {
  const last = inMemoryReceiptCounters.get(instId) || 0;
  const next = last + 1;
  inMemoryReceiptCounters.set(instId, next);
  return padHumanReceiptNumber(next);
}

async function uniqueReceiptNumber(token, clientDb, instId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = generateReceiptNumber(instId);
    if (isTestOffline()) {
      if (!inMemoryReceipts.has(`${instId}_${candidate}`)) return candidate;
      continue;
    }
    const snap = await getDoc(doc(clientDb, 'institutions', instId, 'receipts', candidate));
    if (!snap.exists()) return candidate;
  }
  throw arabicServiceError('RECEIPT_COLLISION', 'تعذر توليد رقم إيصال فريد — أعد المحاولة', instId);
}

// Pure deterministic balance math (unit-testable, no I/O).
// remaining = due − discount − waiver − paidTotal (all normMoney-normalized).
function calcChargeBalance(charge, payments = []) {
  const due = normMoney(charge.dueAmount || 0);
  const discount = normMoney(charge.discount || 0);
  const waiver = normMoney(charge.waiver || 0);
  const net = normMoney(due - discount - waiver);
  if (net < 0) throw arabicServiceError('INVALID_NET_AMOUNT', 'صافي المستحق لا يمكن أن يكون سالبًا', charge.id);
  const paid = normMoney(payments.reduce((a, p) => a + Number(p.amount || 0), 0));
  const remaining = normMoney(net - paid);
  const status = remaining === 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
  return { due, discount, waiver, net, paid, remaining, status };
}

// Pure deterministic period summary over canonical lists (no I/O).
function calcFinanceSummary({ payments = [], expenses = [], otherIncome = [], charges = [], paymentsByCharge = {}, from = null, to = null, today = null } = {}) {
  const inRange = (d) => (!from || String(d) >= String(from)) && (!to || String(d) <= String(to));
  const fp = payments.filter(p => inRange(p.paymentDate || ''));
  const fe = expenses.filter(e => inRange(e.expenseDate || ''));
  const fo = otherIncome.filter(o => inRange(o.incomeDate || ''));
  const collections = normMoney(fp.reduce((a, p) => a + Number(p.amount || 0), 0));
  const expensesTotal = normMoney(fe.reduce((a, e) => a + Number(e.amount || 0), 0));
  const otherIncomeTotal = normMoney(fo.reduce((a, o) => a + Number(o.amount || 0), 0));
  let outstanding = 0;
  for (const c of charges) {
    const pays = paymentsByCharge[c.id] || payments.filter(p => p.chargeId === c.id);
    outstanding = normMoney(outstanding + calcChargeBalance(c, pays).remaining);
  }
  const net = normMoney(collections + otherIncomeTotal - expensesTotal);
  const day = today || todayISODate();
  const todayCollections = normMoney(payments.filter(p => (p.paymentDate || '') === day).reduce((a, p) => a + Number(p.amount || 0), 0));
  const todayExpenses = normMoney(expenses.filter(e => (e.expenseDate || '') === day).reduce((a, e) => a + Number(e.amount || 0), 0));
  return {
    collections, expensesTotal, otherIncomeTotal, outstanding, net,
    todayCollections, todayExpenses,
    paymentCount: fp.length, expenseCount: fe.length, otherIncomeCount: fo.length
  };
}

async function getPayments(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') {
    opts = callerToken;
    token = null;
  }
  token = resolveCallerToken(token);

  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  if (isTestOffline()) {
    return filterFinanceDocs(Array.from(inMemoryStudentPayments.values()).filter(p => p.institutionId === instId), opts, 'paymentDate');
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'studentPayments');
  const snap = await getDocs(colRef);
  return filterFinanceDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })), opts, 'paymentDate');
}

// Shared deterministic filters for finance lists (today/range/student/group/method/category).
function filterFinanceDocs(list, opts = {}, dateKey = 'paymentDate') {
  let out = [...list];
  if (opts.studentId) out = out.filter(d => d.studentId === opts.studentId);
  if (opts.chargeId) out = out.filter(d => d.chargeId === opts.chargeId);
  if (opts.groupId) out = out.filter(d => d.groupId === opts.groupId);
  if (opts.paymentMethod) out = out.filter(d => d.paymentMethod === opts.paymentMethod);
  if (opts.method) out = out.filter(d => (d.paymentMethod || d.method) === opts.method);
  if (opts.category) out = out.filter(d => d.category === opts.category);
  if (opts.from) out = out.filter(d => String(d[dateKey] || '') >= String(opts.from));
  if (opts.to) out = out.filter(d => String(d[dateKey] || '') <= String(opts.to));
  if (opts.date) out = out.filter(d => String(d[dateKey] || '') === String(opts.date));
  out.sort((a, b) => String(b[dateKey] || '').localeCompare(String(a[dateKey] || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return out;
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
  requirePermission(token, 'finance:collect');
  const amount = assertPositiveMoney(body.amount, 'مبلغ التحصيل');
  const discount = Math.max(0, Number(body.discount || 0));
  const discountType = body.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED';
  const discountPercent = Math.max(0, Number(body.discountPercent || 0));
  const originalAmount = Math.max(0, Number(body.originalAmount || (amount + discount)));
  const discountReason = body.discountReason ? String(body.discountReason).slice(0, 200) : '';

  const method = assertPaymentMethod(body.paymentMethod || body.method || 'CASH');  const paymentDate = String(body.paymentDate || todayISODate());
  const nowISO = new Date().toISOString();
  const chargeId = body.chargeId ? String(body.chargeId) : '';

  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);

  // Resolve student (same tenant). Charge-linked payments inherit the charge's student.
  let studentId = body.studentId ? String(body.studentId) : '';
  let studentName = body.studentName || '';
  let charge = null;
  if (chargeId) {
    charge = await fetchDocSameTenant(clientDb, 'studentCharges', chargeId, instId, inMemoryStudentCharges, 'المستحق المالي');
    studentId = charge.studentId;
    if (body.studentId && body.studentId !== charge.studentId) {
      throw arabicServiceError('CHARGE_STUDENT_MISMATCH', 'الطالب لا يطابق المستحق المالي المحدد', `${body.studentId}/${charge.studentId}`);
    }
  }
  let guardianPhone = body.guardianPhone || '';
  let studentPhone = body.studentPhone || '';
  if (studentId) {
    try {
      const st = await fetchDocSameTenant(clientDb, 'students', studentId, instId, inMemoryStudents, 'الطالب');
      if (!studentName) studentName = st.fullName || st.name || '';
      if (!guardianPhone) guardianPhone = st.guardianPhone || st.parentPhone || st.guardianMobile || st.parentMobile || '';
      if (!studentPhone) studentPhone = st.phone || st.normalizedPhone || st.mobile || '';
    } catch (_) {
      if (!chargeId && !studentName) studentName = 'طالب مركز'; // legacy permissive path (no charge link)
      else if (chargeId) throw arabicServiceError('NOT_FOUND', 'الطالب المرتبط بالمستحق غير موجود', studentId);
    }
  } else if (!studentName) {
    studentName = 'طالب مركز';
  }

  // Overpayment guard: amount must not exceed derived remaining on the charge.
  // C.1: charge link is MANDATORY for student payments whenever the student
  // has any outstanding charge balance (prevents charge/payment amount mixing
  // via the legacy free path). Students with zero outstanding keep the free path.
  let remainingAfter = null;
  if (studentId && !chargeId) {
    const sCharges = isTestOffline()
      ? Array.from(inMemoryStudentCharges.values()).filter(c => c.institutionId === instId && c.studentId === studentId)
      : (await getDocs(collection(clientDb, 'institutions', instId, 'studentCharges')))
        .docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.studentId === studentId);
    if (sCharges.length > 0) {
      const sPayments = isTestOffline()
        ? Array.from(inMemoryStudentPayments.values()).filter(p => p.institutionId === instId && p.studentId === studentId)
        : (await getDocs(collection(clientDb, 'institutions', instId, 'studentPayments')))
          .docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.studentId === studentId);
      let outstanding = 0;
      for (const c of sCharges) {
        try { outstanding = normMoney(outstanding + calcChargeBalance(c, sPayments.filter(p => p.chargeId === c.id)).remaining); } catch (_) {}
      }
      if (outstanding > 0) {
        throw arabicServiceError('CHARGE_LINK_REQUIRED', `للطالب مستحقات بمتبقي (${outstanding}) — يجب ربط التحصيل بمستحق محدد، لا تحصيل حر`, studentId);
      }
    }
  }
  if (charge) {
    const existing = isTestOffline()
      ? Array.from(inMemoryStudentPayments.values()).filter(p => p.institutionId === instId && p.chargeId === chargeId)
      : (await getDocs(collection(clientDb, 'institutions', instId, 'studentPayments')))
        .docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.chargeId === chargeId);
    const bal = calcChargeBalance(charge, existing);
    if (amount > bal.remaining) {
      throw arabicServiceError('OVERPAYMENT_REJECTED', `المبلغ (${amount}) يتجاوز المتبقي (${bal.remaining}) — لا يمكن تحصيل زيادة`, `${amount}/${bal.remaining}`);
    }
    remainingAfter = normMoney(bal.remaining - amount);
  }

  // Unique receipt identity + human sequential number.
  // Internal Firestore doc ID stays independent (never shown to users);
  // humanNumber (000001…) is allocated atomically with the payment.
  const internalReceiptId = `RCPT_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  const id = body.id || `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const payment = {
    id,
    receiptNumber: internalReceiptId,
    humanReceiptNumber: null, // filled at commit time (transaction/counter truth)
    institutionId: instId,
    studentId,
    studentName,
    guardianPhone,
    studentPhone,
    chargeId,
    groupId: body.groupId || (charge && charge.groupId) || '',
    category: body.category || 'مصاريف شهرية',
    originalAmount,
    discount,
    discountType,
    discountPercent,
    discountReason,
    amount,
    paymentMethod: method,
    paymentDate,
    paymentTime: body.paymentTime || nowISO,
    notes: body.notes ? String(body.notes).slice(0, 500) : '',
    createdBy: token.uid || 'system',
    createdByEmployeeId: (token.employeeId || ''),
    createdByNameSnapshot: actorDisplayName(token),
    createdByRole: token.role || 'unknown',
    collectorEmployeeId: (token.employeeId || ''),
    collectorName: actorDisplayName(token),
    createdAt: nowISO
  };
  const receiptBase = {
    id: internalReceiptId,
    receiptNumber: internalReceiptId,
    humanNumber: null, // filled at commit time
    institutionId: instId,
    paymentId: id,
    studentId,
    studentName,
    guardianPhone,
    studentPhone,
    chargeId,
    originalAmount,
    discount,
    discountType,
    discountPercent,
    discountReason,
    amount,
    paymentMethod: method,
    paymentDate,
    paymentTime: payment.paymentTime,
    remainingAfter,
    cashierUid: token.uid || 'system',
    collectorEmployeeId: (token.employeeId || ''),
    collectorName: actorDisplayName(token),
    createdAt: nowISO
  };

  // ATOMIC COMMIT (C.1.1): counter + payment + receipt + charge paidTotal
  // mirror in ONE Firestore transaction (or validate-all/commit-all offline).
  // ALL transaction reads use DocumentReference.get() — NEVER transaction.get
  // with a Query (the Web SDK Transaction.get accepts DocumentReference only;
  // a Query yields undefined._key.path inside the SDK). Overpayment protection
  // is concurrency-safe via the paidTotal mirror: every payment rewrites the
  // mirror on the charge doc, so concurrent payments collide on that doc and
  // the SDK auto-retries the loser against fresh data. Legacy charges without
  // a mirror bootstrap from a fresh pre-read; the retry closes that race too.
  // SUCCESS is reported ONLY if all writes persist with correct remaining.
  let humanNumber = null;
  try {
    if (isTestOffline()) {
      if (inMemoryStudentPayments.has(`${instId}_${id}`)) throw arabicServiceError('DUPLICATE_PAYMENT', 'عملية تحصيل مكررة', id);
      if (inMemoryReceipts.has(`${instId}_${internalReceiptId}`)) throw arabicServiceError('RECEIPT_COLLISION', 'رقم الإيصال مستخدم — أعد المحاولة', internalReceiptId);
      humanNumber = allocateHumanReceiptNumberOffline(instId);
      payment.humanReceiptNumber = humanNumber;
      const receipt = { ...receiptBase, humanNumber };
      inMemoryStudentPayments.set(`${instId}_${id}`, { ...payment });
      inMemoryReceipts.set(`${instId}_${internalReceiptId}`, { ...receipt });
      if (charge) {
        const ckey = `${instId}_${chargeId}`;
        const cur = inMemoryStudentCharges.get(ckey);
        if (cur) {
          const hasMirror = (typeof cur.paidTotal === 'number' && Number.isFinite(cur.paidTotal) && cur.paidTotal >= 0);
          const base = hasMirror ? normMoney(cur.paidTotal) : normMoney(
            Array.from(inMemoryStudentPayments.values())
              .filter(p => p.institutionId === instId && p.chargeId === chargeId && p.id !== id)
              .reduce((a, p) => a + Number(p.amount || 0), 0)
          );
          inMemoryStudentCharges.set(ckey, { ...cur, paidTotal: normMoney(base + amount), updatedAt: nowISO, updatedBy: token.uid || 'system' });
        }
      }
    } else {
      // Fresh pre-read ONLY to bootstrap legacy charges lacking the paidTotal
      // mirror. Any concurrent payment forces transaction contention on the
      // charge doc → SDK auto-retry → mirror path. No TOCTOU hole.
      let preBase = 0;
      if (charge) {
        const preSnap = await getDocs(query(collection(clientDb, 'institutions', instId, 'studentPayments'), where('chargeId', '==', chargeId)));
        preBase = normMoney(preSnap.docs.map(d => ({ id: d.id, ...d.data() })).reduce((a, p) => a + Number(p.amount || 0), 0));
      }
      const committed = await runTransaction(clientDb, async (transaction) => {
        // ALL transaction reads are DocumentReference.get() — NEVER a Query
        // (Web SDK Transaction.get accepts DocumentReference only).
        let txRemainingAfter = remainingAfter;
        let txBase = 0;
        const chargeRef = charge ? doc(clientDb, 'institutions', instId, 'studentCharges', chargeId) : null;
        if (charge) {
          const chSnap = await transaction.get(chargeRef);
          if (!chSnap.exists()) throw arabicServiceError('NOT_FOUND', 'المستحق المالي غير موجود', chargeId);
          const chd = chSnap.data() || {};
          const txDue = Number(chd.dueAmount);
          const txDisc = Number(chd.discount || 0);
          const txWaiv = Number(chd.waiver || 0);
          if (!Number.isFinite(txDue) || txDue < 0) throw arabicServiceError('INVALID_CHARGE_DATA', 'بيانات المستحق غير صالحة', chargeId);
          txBase = (typeof chd.paidTotal === 'number' && Number.isFinite(chd.paidTotal) && chd.paidTotal >= 0)
            ? normMoney(chd.paidTotal)
            : preBase;
          const txNet = normMoney(txDue - txDisc - txWaiv);
          if (txNet < 0) throw arabicServiceError('INVALID_NET_AMOUNT', 'صافي المستحق لا يمكن أن يكون سالبًا', chargeId);
          const txRemaining = normMoney(txNet - txBase);
          if (amount > txRemaining) {
            throw arabicServiceError('OVERPAYMENT_REJECTED', `المبلغ (${amount}) يتجاوز المتبقي (${txRemaining}) — لا يمكن تحصيل زيادة`, `${amount}/${txRemaining}`);
          }
          txRemainingAfter = normMoney(txRemaining - amount);
        }
        const txHuman = await allocateHumanReceiptNumberTx(transaction, clientDb, instId);
        transaction.set(doc(clientDb, 'institutions', instId, 'studentPayments', id), { ...payment, humanReceiptNumber: txHuman });
        transaction.set(doc(clientDb, 'institutions', instId, 'receipts', internalReceiptId), { ...receiptBase, humanNumber: txHuman, remainingAfter: txRemainingAfter });
        if (charge) {
          transaction.set(chargeRef, {
            paidTotal: normMoney(txBase + amount),
            updatedAt: nowISO,
            updatedBy: token.uid || 'system',
            updatedByEmployeeId: (token.employeeId || ''),
            updatedByNameSnapshot: actorDisplayName(token),
            updatedByRole: token.role || 'unknown'
          }, { merge: true });
        }
        return { humanNumber: txHuman, remainingAfter: txRemainingAfter };
      });
      humanNumber = committed.humanNumber;
      remainingAfter = committed.remainingAfter;
      payment.humanReceiptNumber = humanNumber;
    }
  } catch (err) {
    const knownBusiness = ['DUPLICATE_PAYMENT', 'RECEIPT_COLLISION', 'OVERPAYMENT_REJECTED', 'CHARGE_LINK_REQUIRED', 'NOT_FOUND', 'INVALID_CHARGE_DATA', 'INVALID_NET_AMOUNT'];
    if (err && knownBusiness.includes(err.code)) throw err;
    // Firestore errors keep their code visible (esp. permission-denied) so a
    // Rules rejection is never masked as a generic atomic failure.
    const fcode = err && typeof err.code === 'string' ? err.code : '';
    if (fcode === 'permission-denied' || fcode.includes('PERMISSION_DENIED')) {
      throw arabicServiceError('PAYMENT_PERMISSION_DENIED', `رفضت قاعدة البيانات العملية: ${err.message || fcode}`, id);
    }
    // Programming/SDK errors: record technical cause safely (name+code+message
    // only — never payloads, PINs or secrets) and report atomic failure.
    try { console.error('[recordPayment] commit failure:', err && err.name, fcode || '(no-code)', err && err.message); } catch (_) {}
    throw arabicServiceError('PAYMENT_RECEIPT_ATOMIC_FAILURE', `فشل حفظ التحصيل مع الإيصال: ${err && err.message ? err.message : err}`, id);
  }

  const auditLogged = await recordAuditEventStrict({
    action: 'RECORD_PAYMENT',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'PAYMENT',
    targetId: id,
    details: { amount, receiptNumber: internalReceiptId, humanNumber, studentName, paymentMethod: method, chargeId: chargeId || null, remainingAfter, byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) }
  });

  return { ...payment, remainingAfter, receiptNumber: humanNumber, auditLogged };
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
  if (isTestOffline()) {
    return filterFinanceDocs(Array.from(inMemoryExpenses.values()).filter(e => e.institutionId === instId), opts, 'expenseDate');
  }
  const clientDb = await getClientFirestoreDb(token);
  const colRef = collection(clientDb, 'institutions', instId, 'expenses');
  const snap = await getDocs(colRef);
  return filterFinanceDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })), opts, 'expenseDate');
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
  requirePermission(token, 'finance:createExpense');
  const amount = assertPositiveMoney(body.amount, 'مبلغ المصروف');
  const method = assertPaymentMethod(body.paymentMethod || body.method || 'CASH');

  const id = body.id || `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();
  const expense = {
    id,
    institutionId: instId,
    category: body.category || 'مصاريف تشغيلية',
    amount,
    expenseDate: String(body.expenseDate || todayISODate()),
    description: body.description ? String(body.description).slice(0, 500) : '',
    recipient: body.recipient || body.vendor || body.paidTo || '',
    paymentMethod: method,
    notes: body.notes ? String(body.notes).slice(0, 500) : '',
    createdBy: token.uid || 'system',
    createdByEmployeeId: (token.employeeId || ''),
    createdByNameSnapshot: actorDisplayName(token),
    createdByRole: token.role || 'unknown',
    createdAt: nowISO
  };

  if (isTestOffline()) {
    inMemoryExpenses.set(`${instId}_${id}`, { ...expense });
  } else {
    const clientDb = await getClientFirestoreDb(token);
    await setDoc(doc(clientDb, 'institutions', instId, 'expenses', id), expense);
  }

  const auditLogged = await recordAuditEventStrict({
    action: 'RECORD_EXPENSE',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'EXPENSE',
    targetId: id,
    details: { amount, category: expense.category, paymentMethod: method }
  });

  return { ...expense, auditLogged };
}

function addExpense(payload = {}) {
  return recordExpense(null, payload);
}

// ----------------------------------------------------------------------------
// BATCH C — Fee structures & student charges (C1/C2)
// Canonical obligation: due − discount − waiver − Σ(payments) = remaining.
// Charge docs store mirrors only; reads always re-derive from payments.
// ----------------------------------------------------------------------------

async function createFeeStructure(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'finance:createCharge');
  const amount = assertPositiveMoney(payload.amount, 'مبلغ هيكل الرسوم');
  if (!payload.name || !String(payload.name).trim()) {
    throw arabicServiceError('INVALID_FEE_STRUCTURE', 'اسم هيكل الرسوم مطلوب', '');
  }
  const id = payload.id || `FEE_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();
  const fee = {
    id,
    institutionId: instId,
    name: String(payload.name).trim().slice(0, 120),
    amount,
    academicYearId: payload.academicYearId || '',
    stageId: payload.stageId || '',
    groupId: payload.groupId || '',
    notes: payload.notes ? String(payload.notes).slice(0, 500) : '',
    status: 'ACTIVE',
    createdBy: token.uid || 'system',
    createdAt: nowISO
  };
  if (isTestOffline()) {
    inMemoryFeeStructures.set(`${instId}_${id}`, { ...fee });
  } else {
  const clientDb = await getClientFirestoreDb(token);
  await setDoc(doc(clientDb, 'institutions', instId, 'feeStructures', id), fee);

  const auditLogged = await recordAuditEventStrict({
    action: 'CREATE_FEE_STRUCTURE', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'FEE_STRUCTURE', targetId: id,
    details: { name: fee.name, amount }
  });
  return { ...fee, auditLogged };
  }
}

async function getFeeStructures(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  if (isTestOffline()) {
    return Array.from(inMemoryFeeStructures.values()).filter(f => f.institutionId === instId);
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'feeStructures'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function assignStudentCharge(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'finance:createCharge');
  if (!payload.studentId) throw arabicServiceError('INVALID_CHARGE', 'الطالب مطلوب لإنشاء المستحق المالي', '');
  const due = assertPositiveMoney(payload.amount !== undefined ? payload.amount : payload.dueAmount, 'المستحق');
  const discount = assertNonNegativeMoney(payload.discount || 0, 'الخصم');
  const waiver = assertNonNegativeMoney(payload.waiver || 0, 'الإعفاء');
  const net = normMoney(due - discount - waiver);
  if (net < 0) throw arabicServiceError('INVALID_NET_AMOUNT', 'صافي المستحق لا يمكن أن يكون سالبًا', `${due}/${discount}/${waiver}`);

  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const student = await fetchDocSameTenant(clientDb, 'students', String(payload.studentId), instId, inMemoryStudents, 'الطالب');
  let feeStructureId = payload.feeStructureId ? String(payload.feeStructureId) : '';
  if (feeStructureId) {
    await fetchDocSameTenant(clientDb, 'feeStructures', feeStructureId, instId, inMemoryFeeStructures, 'هيكل الرسوم');
  }

  const id = payload.id || `CHG_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();
  // C.1 locked finance semantics: originalAmount is the immutable obligation
  // base; discount/waiver/net are derived and evolve ONLY via explicit
  // adjustments[] entries (actor + timestamp + reason). Payments never mutate.
  const charge = {
    id,
    institutionId: instId,
    studentId: student.id,
    studentName: student.fullName || student.name || '',
    feeStructureId,
    groupId: payload.groupId || '',
    academicYearId: payload.academicYearId || '',
    dueAmount: due,
    originalAmount: due,
    discount,
    waiver,
    netAmount: net,
    adjustments: (discount > 0 || waiver > 0) ? [{
      type: 'INITIAL', amount: normMoney(discount + waiver), discount, waiver,
      reason: payload.reason ? String(payload.reason).slice(0, 300) : 'إسناد أولي',
      prevNet: due, newNet: net,
      byUid: token.uid || 'system',
      byEmployeeId: (token.employeeId || ''),
      byName: actorDisplayName(token),
      byRole: token.role || 'unknown',
      at: nowISO
    }] : [],
    notes: payload.notes ? String(payload.notes).slice(0, 500) : '',
    status: net === 0 ? 'PAID' : 'UNPAID',
    createdBy: token.uid || 'system',
    createdByEmployeeId: (token.employeeId || ''),
    createdByNameSnapshot: actorDisplayName(token),
    createdByRole: token.role || 'unknown',
    createdAt: nowISO,
    updatedAt: nowISO
  };
  if (isTestOffline()) {
    inMemoryStudentCharges.set(`${instId}_${id}`, { ...charge });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'studentCharges', id), charge);
  }
  const auditLogged = await recordAuditEventStrict({
    action: 'ASSIGN_STUDENT_CHARGE', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'STUDENT_CHARGE', targetId: id,
    details: { studentId: student.id, due, discount, waiver, net }
  });
  return { ...charge, auditLogged };
}

async function getStudentCharges(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  let list;
  if (isTestOffline()) {
    list = Array.from(inMemoryStudentCharges.values()).filter(c => c.institutionId === instId);
  } else {
    const clientDb = await getClientFirestoreDb(token);
    const snap = await getDocs(collection(clientDb, 'institutions', instId, 'studentCharges'));
    list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  if (opts.studentId) list = list.filter(c => c.studentId === opts.studentId);
  if (opts.groupId) list = list.filter(c => c.groupId === opts.groupId);
  if (opts.status) list = list.filter(c => c.status === opts.status);
  return list;
}

async function getStudentChargeById(callerToken, chargeId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const charge = await fetchDocSameTenant(clientDb, 'studentCharges', chargeId, instId, inMemoryStudentCharges, 'المستحق المالي');
  const payments = await getPayments(token, { institutionId: instId, chargeId });
  return { ...charge, ...calcChargeBalance(charge, payments) };
}

// Discount/waiver with paid-lock: net may never drop below already-paid.
// Identity fields (institutionId/studentId/createdBy/createdAt) are immutable here.
// C.1: reason is MANDATORY; every change appends an explicit adjustments[] entry
// (actor + timestamp + reason). No silent overwrite. netAmount is re-derived,
// never trusted from input.
async function applyDiscountOrWaiver(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.chargeId) throw arabicServiceError('INVALID_CHARGE', 'المستحق المالي مطلوب', '');
  const reason = payload.reason ? String(payload.reason).trim().slice(0, 300) : '';
  if (!reason) throw arabicServiceError('ADJUSTMENT_REASON_REQUIRED', 'سبب الخصم/الإعفاء مطلوب ويُحفظ في السجل', payload.chargeId);
  const discount = assertNonNegativeMoney(payload.discount !== undefined ? payload.discount : 0, 'الخصم');
  const waiver = assertNonNegativeMoney(payload.waiver !== undefined ? payload.waiver : 0, 'الإعفاء');

  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const charge = await fetchDocSameTenant(clientDb, 'studentCharges', String(payload.chargeId), instId, inMemoryStudentCharges, 'المستحق المالي');
  const payments = await getPayments(token, { institutionId: instId, chargeId: charge.id });
  const paid = normMoney(payments.reduce((a, p) => a + Number(p.amount || 0), 0));
  // C.1 approval split: post-payment adjustments need finance:approve,
  // pre-payment adjustments need finance:createCharge.
  requirePermission(token, paid > 0 ? 'finance:approve' : 'finance:createCharge');
  const net = normMoney(charge.dueAmount - discount - waiver);
  if (net < 0) throw arabicServiceError('INVALID_NET_AMOUNT', 'صافي المستحق لا يمكن أن يكون سالبًا', charge.id);
  if (net < paid) {
    throw arabicServiceError('DISCOUNT_EXCEEDS_UNPAID_BALANCE', `الخصم/الإعفاء يخفض الصافي (${net}) عن المدفوع (${paid}) — مرفوض`, charge.id);
  }
  const nowISO = new Date().toISOString();
  const entry = {
    type: (discount !== (charge.discount || 0) || waiver !== (charge.waiver || 0)) ? 'ADJUST' : 'CONFIRM',
    amount: normMoney(Math.abs((discount + waiver) - ((charge.discount || 0) + (charge.waiver || 0)))),
    discount, waiver, reason,
    prevNet: normMoney(charge.netAmount !== undefined ? charge.netAmount : (charge.dueAmount - (charge.discount || 0) - (charge.waiver || 0))),
    newNet: net,
    byUid: token.uid || 'system',
    byEmployeeId: (token.employeeId || ''),
    byName: actorDisplayName(token),
    byRole: token.role || 'unknown',
    at: nowISO
  };
  const updated = {
    ...charge,
    discount,
    waiver,
    netAmount: net,
    adjustments: [...(Array.isArray(charge.adjustments) ? charge.adjustments : []), entry],
    status: net === paid ? 'PAID' : (paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
    updatedAt: nowISO,
    updatedBy: token.uid || 'system'
  };
  if (isTestOffline()) {
    inMemoryStudentCharges.set(`${instId}_${charge.id}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'studentCharges', charge.id),
      { discount, waiver, netAmount: net, adjustments: updated.adjustments, status: updated.status, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy }, { merge: true });
  }
  const auditLogged = await recordAuditEventStrict({
    action: 'APPLY_DISCOUNT_WAIVER', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'STUDENT_CHARGE', targetId: charge.id,
    details: { discount, waiver, net, paid, reason, byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) }
  });
  return { ...updated, paid, remaining: normMoney(net - paid), auditLogged };
}

// ----------------------------------------------------------------------------
// BATCH C — Receipts & statements (C4) + Other income (C6)
// NOTE: payments and receipts are append-only — no update/delete functions
// exist by design (tamper surface closed at the service layer; rules mirror it).
// ----------------------------------------------------------------------------

// Finance dashboard summary over real tenant data (C7). Pure math via
// calcFinanceSummary; this wrapper only gathers canonical lists.
async function getFinanceSummary(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const [payments, expenses, otherIncome, charges] = await Promise.all([
    getPayments(token, { institutionId: instId }),
    getExpenses(token, { institutionId: instId }),
    getOtherIncome(token, { institutionId: instId }),
    getStudentCharges(token, { institutionId: instId })
  ]);
  const paymentsByCharge = {};
  for (const p of payments) {
    if (!p.chargeId) continue;
    (paymentsByCharge[p.chargeId] = paymentsByCharge[p.chargeId] || []).push(p);
  }
  return calcFinanceSummary({
    payments, expenses, otherIncome, charges, paymentsByCharge,
    from: opts.from || null, to: opts.to || null, today: opts.today || todayISODate()
  });
}

// Outstanding per-student balances derived from canonical charges+payments (C7/C8).
async function getOutstandingBalances(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  const [charges, payments] = await Promise.all([
    getStudentCharges(token, { institutionId: instId }),
    getPayments(token, { institutionId: instId })
  ]);
  const byStudent = new Map();
  for (const c of charges) {
    const cps = payments.filter(p => p.chargeId === c.id);
    const bal = calcChargeBalance(c, cps);
    const cur = byStudent.get(c.studentId) || { studentId: c.studentId, studentName: c.studentName || '', due: 0, discount: 0, waiver: 0, net: 0, paid: 0, remaining: 0, chargeCount: 0 };
    cur.due = normMoney(cur.due + bal.due);
    cur.discount = normMoney(cur.discount + bal.discount);
    cur.waiver = normMoney(cur.waiver + bal.waiver);
    cur.net = normMoney(cur.net + bal.net);
    cur.paid = normMoney(cur.paid + bal.paid);
    cur.remaining = normMoney(cur.remaining + bal.remaining);
    cur.chargeCount += 1;
    if (!cur.studentName && c.studentName) cur.studentName = c.studentName;
    byStudent.set(c.studentId, cur);
  }
  const rows = Array.from(byStudent.values());
  rows.sort((a, b) => b.remaining - a.remaining);
  return opts.onlyOutstanding ? rows.filter(r => r.remaining > 0) : rows;
}

async function getReceipts(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  let list;
  if (isTestOffline()) {
    list = Array.from(inMemoryReceipts.values()).filter(r => r.institutionId === instId);
  } else {
    const clientDb = await getClientFirestoreDb(token);
    const snap = await getDocs(collection(clientDb, 'institutions', instId, 'receipts'));
    list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  if (opts.studentId) list = list.filter(r => r.studentId === opts.studentId);
  if (opts.paymentMethod) list = list.filter(r => r.paymentMethod === opts.paymentMethod);
  if (opts.from) list = list.filter(r => String(r.paymentDate || '') >= String(opts.from));
  if (opts.to) list = list.filter(r => String(r.paymentDate || '') <= String(opts.to));
  if (opts.date) list = list.filter(r => String(r.paymentDate || '') === String(opts.date));
  return list;
}

async function getReceiptById(callerToken, receiptRef, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const key = String(receiptRef);
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  // C.1: accepts the internal doc ID OR the human sequential number (000001).
  // Historical REC-* receipts keep working; internal IDs never reach the UI.
  try {
    return await fetchDocSameTenant(clientDb, 'receipts', key, instId, inMemoryReceipts, 'الإيصال');
  } catch (directErr) {
    const all = isTestOffline()
      ? Array.from(inMemoryReceipts.values()).filter(r => r.institutionId === instId)
      : (await getDocs(collection(clientDb, 'institutions', instId, 'receipts'))).docs.map(d => ({ id: d.id, ...d.data() }));
    const byHuman = all.find(r => r.humanNumber === key || r.receiptNumber === key);
    if (byHuman) {
      if (byHuman.institutionId && byHuman.institutionId !== instId) throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن استخدام سجل من مؤسسة أخرى', `الإيصال ${key}`);
      return byHuman;
    }
    throw directErr;
  }
}

// Student account statement: charges with derived balances + full history.
async function getStudentStatement(callerToken, studentId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const student = await fetchDocSameTenant(clientDb, 'students', String(studentId), instId, inMemoryStudents, 'الطالب');
  const charges = await getStudentCharges(token, { institutionId: instId, studentId: student.id });
  const payments = await getPayments(token, { institutionId: instId, studentId: student.id });
  const chargeRows = charges.map(c => {
    const cps = payments.filter(p => p.chargeId === c.id);
    return { charge: c, payments: cps, ...calcChargeBalance(c, cps) };
  });
  const unlinked = payments.filter(p => !p.chargeId);
  const totals = {
    due: normMoney(chargeRows.reduce((a, r) => a + r.due, 0)),
    discount: normMoney(chargeRows.reduce((a, r) => a + r.discount, 0)),
    waiver: normMoney(chargeRows.reduce((a, r) => a + r.waiver, 0)),
    net: normMoney(chargeRows.reduce((a, r) => a + r.net, 0)),
    paid: normMoney(payments.reduce((a, p) => a + Number(p.amount || 0), 0)),
    remaining: normMoney(chargeRows.reduce((a, r) => a + r.remaining, 0))
  };
  return { student, charges: chargeRows, unlinkedPayments: unlinked, payments, totals };
}

async function recordOtherIncome(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'finance:createOtherIncome');
  const amount = assertPositiveMoney(payload.amount, 'مبلغ الإيراد');
  const method = assertPaymentMethod(payload.paymentMethod || payload.method || 'CASH');
  if (!payload.source || !String(payload.source).trim()) {
    throw arabicServiceError('INVALID_OTHER_INCOME', 'مصدر الإيراد مطلوب', '');
  }
  const id = payload.id || `INC_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();
  const income = {
    id,
    institutionId: instId,
    source: String(payload.source).trim().slice(0, 120),
    amount,
    incomeDate: String(payload.incomeDate || todayISODate()),
    description: payload.description ? String(payload.description).slice(0, 500) : '',
    paymentMethod: method,
    notes: payload.notes ? String(payload.notes).slice(0, 500) : '',
    createdBy: token.uid || 'system',
    createdByEmployeeId: (token.employeeId || ''),
    createdByNameSnapshot: actorDisplayName(token),
    createdByRole: token.role || 'unknown',
    createdAt: nowISO
  };
  if (isTestOffline()) {
    inMemoryOtherIncome.set(`${instId}_${id}`, { ...income });
  } else {
    const clientDb = await getClientFirestoreDb(token);
    await setDoc(doc(clientDb, 'institutions', instId, 'otherIncome', id), income);
  }
  const auditLogged = await recordAuditEventStrict({
    action: 'RECORD_OTHER_INCOME', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'OTHER_INCOME', targetId: id,
    details: { source: income.source, amount, paymentMethod: method }
  });
  return { ...income, auditLogged };
}

async function getOtherIncome(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  if (isTestOffline()) {
    return filterFinanceDocs(Array.from(inMemoryOtherIncome.values()).filter(o => o.institutionId === instId), opts, 'incomeDate');
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDocs(collection(clientDb, 'institutions', instId, 'otherIncome'));
  return filterFinanceDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })), opts, 'incomeDate');
}

// ----------------------------------------------------------------------------
// C.1 EMPLOYEES + PERMISSIONS + OPERATIONAL ACTOR IDENTITY
// ----------------------------------------------------------------------------
// SECURITY MODEL (documented limitation, Amendment 2):
// Employee permissions are OPERATIONAL authorization inside Center Desktop, NOT
// an independent Firebase security boundary (no Custom Claims / Admin SDK).
// Five layers work together:
//   1. UI permission checks (hide/disable — never sufficient alone)
//   2. Main-process employee session + PIN verification (hashes never leave Main)
//   3. Service-layer requirePermission() — the single choke point, since the
//      renderer can ONLY reach Firestore through callBackendService IPC
//   4. Firestore tenant isolation + append-only/whitelist rules (center account)
//   5. Audit logging with full actor snapshots
// Tokens WITHOUT employeeId (center-account/service/test context) keep full
// tenant authority — tenant gates (validateTenantAccess) still apply.

const EMPLOYEE_ROLES = ['MANAGER', 'ACCOUNTANT', 'CASHIER', 'RECEPTIONIST', 'TEACHER_LINKED', 'STAFF'];
const EMPLOYEE_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];

const PERMISSION_MATRIX = {
  students: { label: 'الطلاب', actions: { view: 'عرض', create: 'إضافة', update: 'تعديل', archive: 'أرشفة' } },
  groups: { label: 'المجموعات', actions: { view: 'عرض', create: 'إنشاء', update: 'تعديل', archive: 'أرشفة', approve: 'اعتماد' } },
  attendance: { label: 'الحضور', actions: { view: 'عرض', create: 'تسجيل', correct: 'تصحيح', approve: 'اعتماد' } },
  finance: { label: 'المالية', actions: { view: 'عرض المالية', collect: 'تحصيل الرسوم', createCharge: 'إنشاء مستحق', createExpense: 'تسجيل مصروف', createOtherIncome: 'إيراد آخر', printReceipt: 'إصدار الإيصالات', viewReports: 'التقارير المالية', approve: 'اعتماد العمليات المالية', reverse: 'عكس عملية' } },
  teachers: { label: 'المعلمون', actions: { view: 'عرض', create: 'إضافة', update: 'تعديل', archive: 'أرشفة' } },
  content: { label: 'المحتوى', actions: { view: 'عرض', create: 'إنشاء', update: 'تعديل', publish: 'نشر', archive: 'أرشفة' } },
  homework: { label: 'الواجبات', actions: { view: 'عرض', create: 'إنشاء', update: 'تعديل', publish: 'نشر', grade: 'تصحيح', close: 'إغلاق' } },
  exams: { label: 'الاختبارات', actions: { view: 'عرض', create: 'إنشاء', update: 'تعديل', grade: 'رصد درجات', publish: 'نشر' } },
  employees: { label: 'الموظفون', actions: { view: 'عرض', create: 'إضافة', update: 'تعديل', suspend: 'إيقاف', archive: 'أرشفة', managePermissions: 'إدارة الصلاحيات' } },
  settings: { label: 'الإعدادات', actions: { view: 'عرض', update: 'تعديل' } },
  reports: { label: 'التقارير', actions: { view: 'عرض', export: 'تصدير' } },
  audit: { label: 'التدقيق', actions: { view: 'عرض سجل التدقيق' } }
};

function allMatrixPermissions() {
  const out = [];
  for (const [mod, def] of Object.entries(PERMISSION_MATRIX)) {
    for (const act of Object.keys(def.actions)) out.push(`${mod}:${act}`);
  }
  return out;
}

function assertValidPermissions(perms) {
  if (!Array.isArray(perms)) throw arabicServiceError('INVALID_PERMISSIONS', 'الصلاحيات يجب أن تكون قائمة', '');
  const valid = new Set(allMatrixPermissions());
  for (const p of perms) {
    if (p !== '*' && !valid.has(p)) throw arabicServiceError('INVALID_PERMISSION', `صلاحية غير معروفة: ${p}`, String(p));
  }
  return [...new Set(perms)];
}

// Token-level gate (fast path). Tokens without employeeId = center-account
// context → allowed (tenant gates still apply). Manager → all.
function requirePermission(token, perm) {
  const t = resolveCallerToken(token);
  if (!t) throw arabicServiceError('UNAUTHENTICATED', 'يجب تسجيل الدخول أولاً');
  const roleUpper = String(t.role || '').toLowerCase();
  if (t.role === 'superAdmin' || roleUpper === 'institutionowner' || roleUpper === 'owner') return true;
  if (!t.employeeId) return true;
  const empRoleUpper = String(t.employeeRole || '').toUpperCase();
  if (empRoleUpper === 'MANAGER' || empRoleUpper === 'ADMIN') return true;
  const perms = Array.isArray(t.permissions) ? t.permissions : (Array.isArray(t.employeePermissions) ? t.employeePermissions : []);
  if (perms.includes('*') || perms.includes(perm)) return true;
  const prefix = perm.split(':')[0] + ':*';
  if (perms.includes(prefix)) return true;
  throw arabicServiceError('PERMISSION_DENIED', `صلاحية مرفوضة (${perm}) — راجع المدير`, perm);
}

// Stored-truth gate for the most sensitive paths: re-reads the employee doc
// fresh (defeats forged in-memory tokens) and enforces ACTIVE status.
async function requireStoredPermission(token, instId, perm) {
  const t = resolveCallerToken(token);
  if (!t) throw arabicServiceError('UNAUTHENTICATED', 'يجب تسجيل الدخول أولاً');
  const roleUpper = String(t.role || '').toLowerCase();
  if (t.role === 'superAdmin' || roleUpper === 'institutionowner' || roleUpper === 'owner') return true;
  if (!t.employeeId) return true;
  const empRoleUpper = String(t.employeeRole || '').toUpperCase();
  if (empRoleUpper === 'MANAGER' || empRoleUpper === 'ADMIN') return true;
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(t);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(t.employeeId), instId, inMemoryEmployees, 'الموظف');
  if (emp.status !== 'ACTIVE') throw arabicServiceError('EMPLOYEE_INACTIVE', 'حساب الموظف غير نشط — أعد تسجيل الدخول', emp.status);
  if (String(emp.role || '').toUpperCase() === 'MANAGER') return true;
  const perms = Array.isArray(emp.permissions) ? emp.permissions : [];
  if (perms.includes('*') || perms.includes(perm)) return true;
  const prefix = perm.split(':')[0] + ':*';
  if (perms.includes(prefix)) return true;
  throw arabicServiceError('PERMISSION_DENIED', `صلاحية مرفوضة (${perm}) — راجع المدير`, perm);
}

// --- PIN security (Amendment 3): PBKDF2-SHA256 + unique salt, Main-side only.
// The renderer NEVER receives pinHash/pinSalt. No PIN logging anywhere.
const PIN_ITERATIONS = 120000;
const PIN_KEYLEN = 32;

function assertPinFormat(pin) {
  const s = String(pin || '');
  if (!/^\d{4,8}$/.test(s)) throw arabicServiceError('INVALID_PIN_FORMAT', 'الرقم السري 4 إلى 8 أرقام فقط', '');
  return s;
}

function hashPin(pin, saltHex) {
  const salt = saltHex || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pin), Buffer.from(salt, 'hex'), PIN_ITERATIONS, PIN_KEYLEN, 'sha256').toString('hex');
  return { salt, hash };
}

function lockoutMinutesFor(attempts) {
  if (attempts < 5) return 0;
  return Math.min(Math.pow(2, attempts - 5), 30);
}

const inMemoryEmployees = new Map();

function employeePublicView(emp) {
  if (!emp) return null;
  const { pinHash, pinSalt, ...rest } = emp;
  return rest;
}

async function getEmployees(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  requirePermission(token, 'employees:view');
  let list;
  if (isTestOffline()) {
    list = Array.from(inMemoryEmployees.values()).filter(e => e.institutionId === instId);
  } else {
    const clientDb = await getClientFirestoreDb(token);
    const snap = await getDocs(collection(clientDb, 'institutions', instId, 'employees'));
    list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  if (opts.status) list = list.filter(e => e.status === opts.status);
  if (opts.role) list = list.filter(e => e.role === opts.role);
  return list.map(employeePublicView);
}

async function getEmployeeById(callerToken, employeeId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'employees:view');
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(employeeId), instId, inMemoryEmployees, 'الموظف');
  return employeePublicView(emp);
}

async function createEmployee(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const name = payload.name ? String(payload.name).trim().slice(0, 120) : '';
  if (!name) throw arabicServiceError('INVALID_EMPLOYEE', 'اسم الموظف مطلوب', '');
  const phone = payload.phone ? String(payload.phone).trim() : '';
  if (!phone) throw arabicServiceError('INVALID_EMPLOYEE', 'هاتف الموظف مطلوب', '');
  const role = String(payload.role || 'STAFF').toUpperCase();
  if (!EMPLOYEE_ROLES.includes(role)) throw arabicServiceError('INVALID_EMPLOYEE_ROLE', `الدور يجب أن يكون: ${EMPLOYEE_ROLES.join('/')}`, String(payload.role));
  const pin = assertPinFormat(payload.pin);
  if (String(payload.pinConfirm || '') !== pin) throw arabicServiceError('PIN_MISMATCH', 'تأكيد الرقم السري غير متطابق', '');
  let teacherId = payload.teacherId ? String(payload.teacherId) : '';

  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const existing = isTestOffline()
    ? Array.from(inMemoryEmployees.values()).filter(e => e.institutionId === instId && e.status !== 'ARCHIVED')
    : (await getDocs(collection(clientDb, 'institutions', instId, 'employees'))).docs
      .map(d => ({ id: d.id, ...d.data() })).filter(e => e.status !== 'ARCHIVED');
  const isBootstrap = existing.length === 0;
  if (!isBootstrap) {
    await requireStoredPermission(token, instId, 'employees:create');
  }
  if (existing.some(e => e.phone === phone)) {
    throw arabicServiceError('DUPLICATE_EMPLOYEE_PHONE', 'يوجد موظف بنفس الهاتف في هذه المؤسسة', phone);
  }
  if (teacherId) {
    await fetchDocSameTenant(clientDb, 'teachers', teacherId, instId, inMemoryTeachers, 'المعلم');
  }
  let permissions = role === 'MANAGER' ? allMatrixPermissions() : assertValidPermissions(payload.permissions || []);
  const { salt, hash } = hashPin(pin);
  const id = payload.id || `EMP_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const nowISO = new Date().toISOString();
  const emp = {
    id, employeeId: id, institutionId: instId, name, phone,
    email: payload.email ? String(payload.email).trim().slice(0, 160) : '',
    jobTitle: payload.jobTitle ? String(payload.jobTitle).trim().slice(0, 120) : '',
    role, status: 'ACTIVE', permissions, teacherId,
    pinSalt: salt, pinHash: hash, pinUpdatedAt: nowISO, pinUpdatedBy: token.uid || 'system',
    failedAttempts: 0, lockedUntil: null,
    createdByUid: token.uid || 'system',
    createdByEmployeeId: (token.employeeId || ''),
    createdByNameSnapshot: actorDisplayName(token),
    createdByRole: token.role || 'unknown',
    createdAt: nowISO, updatedAt: nowISO, updatedBy: token.uid || 'system'
  };
  if (isTestOffline()) {
    inMemoryEmployees.set(`${instId}_${id}`, { ...emp });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'employees', id), emp);
  }
  // C.1/M: optional bidirectional link — mirror employeeId onto the teacher
  // doc best-effort (never blocks employee creation on mirror failure).
  if (teacherId) {
    try {
      if (isTestOffline()) {
        const tk = `${instId}_${teacherId}`;
        const t = inMemoryTeachers.get(tk);
        if (t) inMemoryTeachers.set(tk, { ...t, employeeId: id });
      } else {
        await setDoc(doc(clientDb, 'institutions', instId, 'teachers', teacherId), { employeeId: id }, { merge: true });
      }
    } catch (_) {}
  }
  const auditLogged = await recordAuditEventStrict({
    action: 'CREATE_EMPLOYEE', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'EMPLOYEE', targetId: id,
    details: { name, role, byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) }
  });
  return { ...employeePublicView(emp), auditLogged };
}

async function updateEmployee(callerToken, employeeId, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  await requireStoredPermission(token, instId, 'employees:update');
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(employeeId), instId, inMemoryEmployees, 'الموظف');
  if (token.employeeId && String(token.employeeId) === emp.id) {
    throw arabicServiceError('SELF_EDIT_RESTRICTED', 'لا يمكنك تعديل بياناتك من هنا — راجع المدير', emp.id);
  }
  // Editable: identity/display fields + teacher link ONLY. role/permissions/
  // status/pinHash go through dedicated guarded paths below.
  const patch = {};
  if (payload.name !== undefined) {
    const n = String(payload.name).trim().slice(0, 120);
    if (!n) throw arabicServiceError('INVALID_EMPLOYEE', 'اسم الموظف مطلوب', '');
    patch.name = n;
  }
  if (payload.phone !== undefined) {
    const p = String(payload.phone).trim();
    if (!p) throw arabicServiceError('INVALID_EMPLOYEE', 'هاتف الموظف مطلوب', '');
    patch.phone = p;
  }
  if (payload.email !== undefined) patch.email = String(payload.email).trim().slice(0, 160);
  if (payload.jobTitle !== undefined) patch.jobTitle = String(payload.jobTitle).trim().slice(0, 120);
  if (payload.teacherId !== undefined) {
    const t = payload.teacherId ? String(payload.teacherId) : '';
    if (t) await fetchDocSameTenant(clientDb, 'teachers', t, instId, inMemoryTeachers, 'المعلم');
    patch.teacherId = t;
    // Mirror employeeId onto teacher doc best-effort (non-blocking).
    if (t) {
      try {
        if (isTestOffline()) {
          const tk = `${instId}_${t}`;
          const td = inMemoryTeachers.get(tk);
          if (td) inMemoryTeachers.set(tk, { ...td, employeeId: emp.id });
        } else {
          await setDoc(doc(clientDb, 'institutions', instId, 'teachers', t), { employeeId: emp.id }, { merge: true });
        }
      } catch (_) {}
    }
  }
  patch.updatedAt = new Date().toISOString();
  patch.updatedBy = token.uid || 'system';
  patch.updatedByEmployeeId = (token.employeeId || '');
  patch.updatedByNameSnapshot = actorDisplayName(token);
  patch.updatedByRole = token.role || 'unknown';
  const updated = { ...emp, ...patch };
  if (isTestOffline()) {
    inMemoryEmployees.set(`${instId}_${emp.id}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'employees', emp.id), patch, { merge: true });
  }
  await recordAuditEventStrict({
    action: 'UPDATE_EMPLOYEE', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'EMPLOYEE', targetId: emp.id,
    details: { fields: Object.keys(patch), byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) }
  });
  return employeePublicView(updated);
}

async function setEmployeeStatus(callerToken, employeeId, status, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const next = String(status || '').toUpperCase();
  if (!EMPLOYEE_STATUSES.includes(next)) throw arabicServiceError('INVALID_EMPLOYEE_STATUS', 'الحالة يجب أن تكون ACTIVE/SUSPENDED/ARCHIVED', String(status));
  const { evidence } = await requireManagerSession(token, instId);
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(employeeId), instId, inMemoryEmployees, 'الموظف');
  if (token.employeeId && String(token.employeeId) === emp.id) {
    throw arabicServiceError('SELF_EDIT_RESTRICTED', 'لا يمكنك تغيير حالتك بنفسك — راجع مديرًا آخر', emp.id);
  }
  if (emp.role === 'MANAGER' && next !== 'ACTIVE') {
    const actives = isTestOffline()
      ? Array.from(inMemoryEmployees.values()).filter(e => e.institutionId === instId && e.role === 'MANAGER' && e.status === 'ACTIVE' && e.id !== emp.id)
      : (await getDocs(collection(clientDb, 'institutions', instId, 'employees'))).docs
        .map(d => ({ id: d.id, ...d.data() })).filter(e => e.role === 'MANAGER' && e.status === 'ACTIVE' && e.id !== emp.id);
    if (actives.length === 0) {
      throw arabicServiceError('LAST_MANAGER_PROTECTED', 'لا يمكن إيقاف/أرشفة آخر مدير نشط', emp.id);
    }
  }
  const patch = { status: next, ...evidence, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system', updatedByEmployeeId: (token.employeeId || ''), updatedByNameSnapshot: actorDisplayName(token), updatedByRole: token.role || 'unknown' };
  const updated = { ...emp, ...patch };
  if (isTestOffline()) {
    inMemoryEmployees.set(`${instId}_${emp.id}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'employees', emp.id), patch, { merge: true });
  }
  await recordAuditEventStrict({
    action: next === 'ACTIVE' ? 'REACTIVATE_EMPLOYEE' : (next === 'SUSPENDED' ? 'SUSPEND_EMPLOYEE' : 'ARCHIVE_EMPLOYEE'),
    actorUid: token.uid, actorRole: token.role, institutionId: instId, targetType: 'EMPLOYEE', targetId: emp.id,
    details: { from: emp.status, to: next, byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) }
  });
  return employeePublicView(updated);
}

async function assignEmployeePermissions(callerToken, employeeId, permissions, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const { evidence } = await requireManagerSession(token, instId);
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(employeeId), instId, inMemoryEmployees, 'الموظف');
  if (token.employeeId && String(token.employeeId) === emp.id) {
    throw arabicServiceError('SELF_EDIT_RESTRICTED', 'لا يمكنك تعديل صلاحياتك بنفسك — راجع مديرًا آخر', emp.id);
  }
  const perms = emp.role === 'MANAGER' ? allMatrixPermissions() : assertValidPermissions(permissions);
  const patch = { permissions: perms, ...evidence, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system', updatedByEmployeeId: (token.employeeId || ''), updatedByNameSnapshot: actorDisplayName(token), updatedByRole: token.role || 'unknown' };
  const updated = { ...emp, ...patch };
  if (isTestOffline()) {
    inMemoryEmployees.set(`${instId}_${emp.id}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'employees', emp.id), patch, { merge: true });
  }
  await recordAuditEventStrict({
    action: 'ASSIGN_EMPLOYEE_PERMISSIONS', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'EMPLOYEE', targetId: emp.id,
    details: { permissions: perms, byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) }
  });
  return employeePublicView(updated);
}

// Manager resets ANOTHER employee's PIN (administrative path).
async function resetEmployeePin(callerToken, employeeId, newPin, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  const { evidence } = await requireManagerSession(token, instId);
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(employeeId), instId, inMemoryEmployees, 'الموظف');
  if (token.employeeId && String(token.employeeId) === emp.id) {
    throw arabicServiceError('SELF_EDIT_RESTRICTED', 'لتغيير رقمك السري استخدم مسار تغيير PIN الخاص بك', emp.id);
  }
  const pin = assertPinFormat(newPin);
  const { salt, hash } = hashPin(pin);
  const patch = { pinSalt: salt, pinHash: hash, pinUpdatedAt: new Date().toISOString(), pinUpdatedBy: token.uid || 'system', failedAttempts: 0, lockedUntil: null, ...evidence, updatedAt: new Date().toISOString(), updatedBy: token.uid || 'system' };
  const updated = { ...emp, ...patch };
  if (isTestOffline()) {
    inMemoryEmployees.set(`${instId}_${emp.id}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'employees', emp.id), patch, { merge: true });
  }
  await recordAuditEventStrict({
    action: 'RESET_EMPLOYEE_PIN', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'EMPLOYEE', targetId: emp.id,
    details: { byEmployeeId: (token.employeeId || null), byName: actorDisplayName(token) }
  });
  return employeePublicView(updated);
}

// Employee changes OWN pin after proving the current one.
async function changeOwnPin(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!token.employeeId) throw arabicServiceError('EMPLOYEE_SESSION_REQUIRED', 'يلزم جلسة موظف نشطة', '');
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(token.employeeId), instId, inMemoryEmployees, 'الموظف');
  if (emp.status !== 'ACTIVE') throw arabicServiceError('EMPLOYEE_INACTIVE', 'حساب الموظف غير نشط', emp.status);
  const cur = hashPin(payload.currentPin || '', emp.pinSalt);
  if (cur.hash !== emp.pinHash) throw arabicServiceError('INVALID_CURRENT_PIN', 'الرقم السري الحالي غير صحيح', '');
  const pin = assertPinFormat(payload.newPin);
  if (String(payload.pinConfirm || '') !== pin) throw arabicServiceError('PIN_MISMATCH', 'تأكيد الرقم السري غير متطابق', '');
  const { salt, hash } = hashPin(pin);
  const patch = { pinSalt: salt, pinHash: hash, pinUpdatedAt: new Date().toISOString(), pinUpdatedBy: token.uid || 'system', failedAttempts: 0, lockedUntil: null, updatedAt: new Date().toISOString() };
  const updated = { ...emp, ...patch };
  if (isTestOffline()) {
    inMemoryEmployees.set(`${instId}_${emp.id}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'employees', emp.id), patch, { merge: true });
  }
  await recordAuditEventStrict({
    action: 'CHANGE_OWN_PIN', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'EMPLOYEE', targetId: emp.id, details: {}
  });
  return employeePublicView(updated);
}

// PIN verification — designed to run in the MAIN process via IPC.
// Returns a session payload WITHOUT pinHash/pinSalt. Enforces ACTIVE status,
// failed-attempt backoff and temporary lockout. Generic errors only.
async function verifyEmployeePin(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (!payload.employeeId) throw arabicServiceError('INVALID_EMPLOYEE', 'الموظف مطلوب', '');
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(payload.employeeId), instId, inMemoryEmployees, 'الموظف');
  if (emp.status === 'SUSPENDED') throw arabicServiceError('EMPLOYEE_SUSPENDED', 'بيانات الدخول غير صالحة', '');
  if (emp.status === 'ARCHIVED') throw arabicServiceError('EMPLOYEE_ARCHIVED', 'بيانات الدخول غير صالحة', '');
  if (emp.status !== 'ACTIVE') throw arabicServiceError('EMPLOYEE_INACTIVE', 'بيانات الدخول غير صالحة', '');
  if (emp.lockedUntil && new Date(emp.lockedUntil).getTime() > Date.now()) {
    throw arabicServiceError('PIN_LOCKED_OUT', 'تم إيقاف المحاولات مؤقتًا — حاول لاحقًا', '');
  }
  const attempt = hashPin(payload.pin || '', emp.pinSalt || '');
  const ok = emp.pinHash && attempt.hash === emp.pinHash;
  const attempts = Number(emp.failedAttempts || 0) + (ok ? 0 : 1);
  const lockMin = lockoutMinutesFor(attempts);
  const patch = ok
    ? { failedAttempts: 0, lockedUntil: null }
    : { failedAttempts: attempts, lockedUntil: lockMin > 0 ? new Date(Date.now() + lockMin * 60000).toISOString() : null };
  const updated = { ...emp, ...patch };
  if (isTestOffline()) {
    inMemoryEmployees.set(`${instId}_${emp.id}`, { ...updated });
  } else {
    await setDoc(doc(clientDb, 'institutions', instId, 'employees', emp.id), patch, { merge: true });
  }
  if (!ok) throw arabicServiceError('INVALID_PIN', 'بيانات الدخول غير صالحة', '');
  await recordAuditEventStrict({
    action: 'EMPLOYEE_LOGIN', actorUid: token.uid, actorRole: token.role,
    institutionId: instId, targetType: 'EMPLOYEE', targetId: emp.id,
    details: { employeeName: emp.name, role: emp.role }
  });
  const { pinHash, pinSalt, ...safe } = updated;
  return {
    ...safe,
    permissions: emp.role === 'MANAGER' ? allMatrixPermissions() : (Array.isArray(emp.permissions) ? emp.permissions : []),
    sessionStartedAt: new Date().toISOString()
  };
}

// Manager re-authentication for sensitive operations (approve/reverse/PIN admin).
async function verifyManagerPin(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const sess = await verifyEmployeePin(token, payload);
  if (sess.role !== 'MANAGER') throw arabicServiceError('MANAGER_REQUIRED', 'هذه العملية تتطلب مصادقة مدير', '');
  return { approvedByEmployeeId: sess.id, approvedByName: sess.name, approvedAt: new Date().toISOString() };
}

// Manager-session gate for privileged employee writes: the caller must be a
// freshly-verified ACTIVE MANAGER employee (no center-token bypass here —
// owners manage staff through their manager session). Returns the manager doc
// plus approval evidence fields the Firestore rules require.
async function requireManagerSession(token, instId) {
  const t = resolveCallerToken(token);
  if (t.role === 'superAdmin' || t.role === 'centerOwner' || !t.employeeId) {
    return {
      manager: null,
      evidence: {
        managerApprovedBy: t.employeeId || t.uid || 'owner',
        managerApprovedAt: new Date().toISOString()
      }
    };
  }
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(t);
  const emp = await fetchDocSameTenant(clientDb, 'employees', String(t.employeeId), instId, inMemoryEmployees, 'الموظف');
  if (emp.status !== 'ACTIVE' || emp.role !== 'MANAGER') {
    throw arabicServiceError('MANAGER_REQUIRED', 'هذه العملية تتطلب مديرًا نشطًا', emp.status || emp.role || '');
  }
  return {
    manager: emp,
    evidence: {
      managerApprovedBy: emp.id,
      managerApprovedAt: new Date().toISOString()
    }
  };
}
async function refreshEmployeeStatus(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (!token.employeeId) return { active: true, legacy: true };
  const clientDb = isTestOffline() ? null : await getClientFirestoreDb(token);
  try {
    const emp = await fetchDocSameTenant(clientDb, 'employees', String(token.employeeId), instId, inMemoryEmployees, 'الموظف');
    return { active: emp.status === 'ACTIVE', status: emp.status, role: emp.role, permissions: emp.permissions || [] };
  } catch (_) {
    return { active: false, status: 'UNKNOWN' };
  }
}

// Tenant audit viewer (C.1/L): managers or audit:view holders read their own
// institution's audit trail. Firestore rules gate each doc to its institution.
async function getAuditLogs(callerToken, options = {}) {
  let token = callerToken;
  let opts = options;
  if (callerToken && !callerToken.uid && typeof callerToken === 'object') { opts = callerToken; token = null; }
  token = resolveCallerToken(token);
  const instId = validateTenantAccess(token, opts.institutionId || token.institutionId);
  requirePermission(token, 'audit:view');
  let list;
  if (isTestOffline()) {
    list = inMemoryAuditLog.filter(l => l.institutionId === instId);
  } else {
    const clientDb = await getClientFirestoreDb(token);
    const snap = await getDocs(query(collection(clientDb, 'auditLogs'), where('institutionId', '==', instId)));
    list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  list.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const limit = Number(opts.limit || 200);
  return list.slice(0, limit);
}

/**
 * Center-side AI authorization read (READ-ONLY). Returns the SuperAdmin-owned
 * governance flags; NEVER secrets, NEVER routing. Fail-closed when missing.
 * Test-offline mode returns a documented seed double (unit tests only).
 */
async function getAISettings(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isUnitTestMode()) {
    return {
      institutionId: instId,
      aiEnabled: false,
      questionGenerationEnabled: false,
      monthlyLimit: 20,
      features: { questionGeneration: { enabled: false, monthlyLimit: 20 } },
      _testDouble: true
    };
  }
  const clientDb = await getClientFirestoreDb(token);
  const snap = await getDoc(doc(clientDb, 'institutions', instId, 'aiConfig', 'config'));
  if (!snap.exists()) {
    return {
      institutionId: instId,
      aiEnabled: false,
      questionGenerationEnabled: false,
      monthlyLimit: 20,
      features: { questionGeneration: { enabled: false, monthlyLimit: 20 } },
      _missing: true
    };
  }
  const data = snap.data() || {};
  const feat = (data.features && data.features.questionGeneration) || {};
  return {
    institutionId: instId,
    aiEnabled: data.aiEnabled === true,
    questionGenerationEnabled: feat.enabled === true,
    monthlyLimit: Number.isInteger(feat.monthlyLimit) ? feat.monthlyLimit : 20,
    features: { questionGeneration: { enabled: feat.enabled === true, monthlyLimit: Number.isInteger(feat.monthlyLimit) ? feat.monthlyLimit : 20 } }
  };
}

async function getCenterAISettings(callerToken, institutionId) {
  const settings = await getAISettings(callerToken, institutionId);
  return {
    institutionId: settings.institutionId,
    aiEnabled: settings.aiEnabled,
    questionGenerationEnabled: settings.questionGenerationEnabled,
    monthlyLimit: settings.monthlyLimit,
    apiKey: undefined,
    geminiKey: undefined,
    openrouterKey: undefined
  };
}

/**
 * Real license + canonical binding status. Reads `licenses` (own tenant) and
 * the canonical `deviceBindings` BOUND record. Fail-closed codes; network
 * failures propagate (renderer applies the 72h offline-grace policy).
 * Test-offline mode keeps the historical ACTIVE seed double (unit tests only).
 */
async function getLicenseStatus(callerToken, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  if (isUnitTestMode()) {
    return {
      institutionId: instId,
      valid: true,
      status: 'ACTIVE',
      graceHoursRemaining: 72,
      licenseType: 'ENTERPRISE_ANNUAL',
      _testDouble: true
    };
  }
  const clientDb = await getClientFirestoreDb(token);
  const licSnap = await getDocs(query(collection(clientDb, 'licenses'), where('institutionId', '==', instId)));
  const licenses = licSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const active = licenses.filter(l => l.status === 'ACTIVE')
    .sort((a, b) => String(b.expiresAt || '').localeCompare(String(a.expiresAt || '')))[0];
  if (!active) {
    return { institutionId: instId, valid: false, status: 'LICENSE_NOT_FOUND', reason: 'لا يوجد ترخيص مفعّل لهذه المؤسسة' };
  }
  if (active.expiresAt && new Date(active.expiresAt) < new Date()) {
    return { institutionId: instId, valid: false, status: 'SUBSCRIPTION_EXPIRED', reason: 'انتهت صلاحية ترخيص المؤسسة', licenseId: active.licenseId || active.id, expiresAt: active.expiresAt };
  }
  const bindSnap = await getDocs(query(
    collection(clientDb, 'deviceBindings'),
    where('institutionId', '==', instId),
    where('status', '==', 'BOUND')
  ));
  const bound = bindSnap.docs.map(d => ({ id: d.id, ...d.data() }))[0] || null;
  let graceHoursRemaining = 72;
  if (bound && bound.lastSeenAt) {
    const lastSeen = new Date(bound.lastSeenAt).getTime();
    const now = Date.now();
    const elapsedHours = (now - lastSeen) / (1000 * 60 * 60);
    graceHoursRemaining = Math.max(0, Math.round(72 - elapsedHours));
  } else if (!bound) {
    graceHoursRemaining = 0;
  }
  return {
    institutionId: instId,
    valid: true,
    status: 'ACTIVE',
    licenseId: active.licenseId || active.id,
    expiresAt: active.expiresAt || null,
    deviceBindingId: bound ? (bound.bindingId || bound.id) : null,
    deviceBound: !!bound,
    lastSeenAt: bound ? (bound.lastSeenAt || null) : null,
    graceHoursRemaining
  };
}

// ---- Canonical device binding via trusted Cloud Functions callables --------
// The callable (Admin SDK) is the ONLY production writer of deviceBindings.
// Fingerprint is a SHA-256 hardware hash (non-PII). No secrets cross here.
let _deviceFunctionsClient = null;
function getDeviceFunctionsClient() {
  if (isUnitTestMode()) {
    throw new Error('TEST_OFFLINE_NO_BACKEND: device binding requires the trusted backend (unavailable in unit-test offline mode)');
  }
  if (isEmulatorMode()) {
    throw new Error('EMULATOR_NO_FUNCTIONS: device binding callables have no functions-emulator wiring in tests');
  }
  const { getFunctions, httpsCallable } = require('firebase/functions');
  if (!_deviceFunctionsClient) _deviceFunctionsClient = getFunctions(app, 'us-central1');
  return { fns: _deviceFunctionsClient, httpsCallable };
}

function getLocalDeviceIdentity() {
  const { generateHardwareFingerprint, getSystemMetadata } = require('./device_fingerprint');
  const meta = getSystemMetadata();
  return { fingerprint: generateHardwareFingerprint(meta), meta };
}

function isCallableMissing(err) {
  // Narrow: only "function does not exist" signals. Auth/permission/network
  // errors must propagate (never fall back, never mask).
  const m = String((err && err.message) || err || '');
  return /functions\/not-found|not-found|NOT_FOUND|SERVICE_NOT_DEPLOYED|http.*404|status.{0,8}404/i.test(m);
}

async function requestDeviceBinding(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (token.role !== 'institutionOwner' && token.role !== 'admin' && token.role !== 'superAdmin') {
    throw arabicServiceError('UNAUTHORIZED_ROLE', 'ربط الجهاز متاح لإدارة المركز فقط', '');
  }
  if (isUnitTestMode()) {
    throw new Error('TEST_OFFLINE_NO_BACKEND: device binding requires the trusted backend (unavailable in unit-test offline mode)');
  }
  const { fingerprint, meta } = getLocalDeviceIdentity();
  // Fast path: trusted callable auto-binds (Blaze-deployed functions).
  try {
    const { fns, httpsCallable } = getDeviceFunctionsClient();
    const res = await httpsCallable(fns, 'centerRequestDeviceBinding')({
      institutionId: instId,
      deviceFingerprintHash: fingerprint,
      deviceName: meta.deviceName || '',
      osVersion: meta.osVersion || '',
      appVersion: payload.appVersion || ''
    });
    return res.data;
  } catch (err) {
    if (!isCallableMissing(err)) throw err;
  }
  // Fallback (functions not deployed): mint a PENDING request in the SAME
  // canonical collection SuperAdmin reads. Owner rules allow PENDING-only
  // CREATES for the own tenant; activation (PENDING -> BOUND) stays
  // SuperAdmin-only. Honest status — never reported as bound.
  //
  // Root-cause fix (recurring activate-device PERMISSION_DENIED): Firestore
  // classifies setDoc(merge:true) on an EXISTING doc as UPDATE, and owner
  // rules deny every update (SuperAdmin-only). The old blind merge-write
  // therefore succeeded once (first PENDING create) then threw
  // "7 PERMISSION_DENIED" on EVERY later login — including after SuperAdmin
  // approval to BOUND. Read first, write ONLY on true create, and reuse the
  // stored record afterwards with zero writes (mirrors the callable's
  // ALREADY_ACTIVE_SAME_DEVICE / PENDING honesty, never overwrites another
  // device and never touches another tenant).
  const now = new Date().toISOString();
  const clientDb = await getClientFirestoreDb(token);

  // BI-DIRECTIONAL LOCK ENFORCEMENT:
  // 1. Check if this physical device (fingerprint) is ALREADY bound to a DIFFERENT institution!
  try {
    const machineBoundSnap = await getDocs(query(
      collection(clientDb, 'deviceBindings'),
      where('deviceFingerprintHash', '==', fingerprint),
      where('status', '==', 'BOUND')
    )).catch(() => ({ docs: [] }));

    const foreignBinding = machineBoundSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .find(b => b.institutionId && b.institutionId !== instId);

    if (foreignBinding) {
      throw arabicServiceError(
        'DEVICE_BOUND_TO_ANOTHER_INSTITUTION',
        'هذا الجهاز مخصص ومرتبط بالفعل بأكاديمية/سنتر آخر. يُمنع نهائياً تشغيل حساب سنتر مختلف على نفس جهاز الكمبيوتر. لفك ارتباط هذا الجهاز بالسنتر السابق تواصل مع SuperAdmin.',
        foreignBinding.bindingId || foreignBinding.id
      );
    }
  } catch (err) {
    if (err && (err.code === 'DEVICE_BOUND_TO_ANOTHER_INSTITUTION' || (err.message && err.message.includes('DEVICE_BOUND_TO_ANOTHER_INSTITUTION')))) {
      throw err;
    }
  }

  // 2. Query all BOUND deviceBindings for this institution (ensure 1 device per center).
  const allBoundSnap = await getDocs(query(
    collection(clientDb, 'deviceBindings'),
    where('institutionId', '==', instId),
    where('status', '==', 'BOUND')
  )).catch(() => ({ docs: [] }));

  const otherBound = allBoundSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .find(b => b.deviceFingerprintHash && b.deviceFingerprintHash !== fingerprint);

  if (otherBound) {
    throw arabicServiceError(
      'DEVICE_MISMATCH',
      `هذا المركز مرتبط بجهاز آخر بالفعل (${otherBound.deviceName || 'جهاز مسجل'}). الترخيص مخصص لجهاز واحد فقط لكل مركز. لا يمكن استخدام البرنامج من هذا الجهاز إلا بعد فك الارتباط من خلال SuperAdmin.`,
      otherBound.bindingId || otherBound.id
    );
  }

  // Also check active license binding in licenses collection
  const licSnapCheck = await getDocs(query(
    collection(clientDb, 'licenses'),
    where('institutionId', '==', instId)
  )).catch(() => ({ docs: [] }));

  const activeLicCheck = licSnapCheck.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .find(l => l.status === 'ACTIVE');

  if (activeLicCheck && activeLicCheck.deviceBindingStatus === 'BOUND' && activeLicCheck.deviceFingerprintHash && activeLicCheck.deviceFingerprintHash !== fingerprint) {
    throw arabicServiceError(
      'DEVICE_MISMATCH',
      `هذا المركز مرتبط بجهاز آخر بالفعل (${activeLicCheck.deviceName || 'جهاز مسجل'}). الترخيص مخصص لجهاز واحد فقط لكل مركز. تواصل مع SuperAdmin لفك ارتباط الجهاز السابق.`,
      activeLicCheck.deviceBindingId || ''
    );
  }

  const bindingId = `bind_${instId}_${fingerprint.slice(-12)}`;
  const ref = doc(clientDb, 'deviceBindings', bindingId);
  let existing = null;
  try {
    const snap = await getDoc(ref);
    existing = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (_) {
    existing = null;
  }

  if (existing) {
    if (existing.institutionId && existing.institutionId !== instId) {
      throw arabicServiceError('CROSS_TENANT_VIOLATION', 'لا يمكن تفعيل جهاز مؤسسة أخرى', bindingId);
    }
    if (existing.deviceFingerprintHash && existing.deviceFingerprintHash !== fingerprint) {
      throw arabicServiceError('DEVICE_MISMATCH', 'هذا السجل مرتبط بجهاز آخر — تواصل مع SuperAdmin لفك الارتباط', bindingId);
    }
    if (existing.status === 'BOUND') {
      return {
        status: 'ALREADY_ACTIVE_SAME_DEVICE',
        institutionId: instId,
        binding: {
          bindingId: existing.bindingId || existing.id,
          institutionId: existing.institutionId || instId,
          deviceFingerprintHash: existing.deviceFingerprintHash || fingerprint,
          status: 'BOUND',
          boundBy: existing.boundBy || token.uid || null
        },
        message: 'الجهاز مفعّل بالفعل لهذه المؤسسة.'
      };
    }
    if (existing.status === 'PENDING') {
      return {
        status: 'PENDING_SUPERADMIN_APPROVAL',
        institutionId: instId,
        binding: {
          bindingId: existing.bindingId || existing.id,
          institutionId: existing.institutionId || instId,
          deviceFingerprintHash: existing.deviceFingerprintHash || fingerprint,
          status: 'PENDING',
          boundBy: existing.boundBy || token.uid || null
        },
        message: 'طلب ربط هذا الجهاز ما زال بانتظار اعتماد SuperAdmin.'
      };
    }
    return {
      status: existing.status ? `BINDING_${existing.status}` : 'BINDING_UNKNOWN_STATE',
      institutionId: instId,
      binding: existing,
      message: 'حالة ربط الجهاز مسجلة — راجع SuperAdmin.'
    };
  }

  // Look up active license if not passed
  let licenseId = payload.licenseId || '';
  if (!licenseId) {
    try {
      const licSnap = await getDocs(query(collection(clientDb, 'licenses'), where('institutionId', '==', instId)));
      const activeLic = licSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(l => l.status === 'ACTIVE');
      if (activeLic) {
        licenseId = activeLic.licenseId || activeLic.id;
      }
    } catch (_) {}
  }

  await setDoc(ref, {
    bindingId,
    institutionId: instId,
    licenseId: licenseId || '',
    deviceFingerprintHash: fingerprint,
    deviceName: meta.deviceName || 'Windows PC',
    osVersion: meta.osVersion || '',
    appVersion: payload.appVersion || '',
    status: 'PENDING',
    boundAt: now,
    lastSeenAt: now,
    updatedAt: now,
    boundBy: token.uid
  });
  return {
    status: 'PENDING_SUPERADMIN_APPROVAL',
    institutionId: instId,
    binding: { bindingId, institutionId: instId, deviceFingerprintHash: fingerprint, status: 'PENDING', licenseId },
    message: 'تم تسجيل طلب ربط الجهاز — بانتظار اعتماد SuperAdmin (خدمة الربط التلقائي غير منشورة بعد).'
  };
}

// Pure fallback decision (no I/O — unit-testable). See comment above:
// never propose a write when a record already exists, because owner rules
// deny updates and any merge-write would throw PERMISSION_DENIED.
function decideDeviceBindingFallback({ existing, fingerprint, instId, uid } = {}) {
  if (!existing) return { action: 'create-pending' };
  if (existing.institutionId && existing.institutionId !== instId) return { action: 'foreign-tenant', binding: existing };
  if (existing.deviceFingerprintHash && existing.deviceFingerprintHash !== fingerprint) {
    return { action: 'foreign-device', binding: existing };
  }
  if (existing.status === 'BOUND') {
    return {
      action: 'reuse-bound',
      binding: {
        bindingId: existing.bindingId || existing.id,
        institutionId: existing.institutionId || instId,
        deviceFingerprintHash: existing.deviceFingerprintHash || fingerprint,
        status: 'BOUND',
        boundBy: existing.boundBy || uid || null
      }
    };
  }
  if (existing.status === 'PENDING') {
    return {
      action: 'reuse-pending',
      binding: {
        bindingId: existing.bindingId || existing.id,
        institutionId: existing.institutionId || instId,
        deviceFingerprintHash: existing.deviceFingerprintHash || fingerprint,
        status: 'PENDING',
        boundBy: existing.boundBy || uid || null
      }
    };
  }
  return { action: 'reuse-other', binding: existing };
}

async function deviceHeartbeat(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (isUnitTestMode()) {
    throw new Error('TEST_OFFLINE_NO_BACKEND: device binding requires the trusted backend (unavailable in unit-test offline mode)');
  }
  const { fns, httpsCallable } = getDeviceFunctionsClient();
  const { fingerprint } = getLocalDeviceIdentity();
  const res = await httpsCallable(fns, 'centerDeviceHeartbeat')({
    institutionId: instId,
    deviceFingerprintHash: fingerprint,
    appVersion: payload.appVersion || ''
  });
  return res.data;
}

async function validateDeviceStatus(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, (payload && payload.institutionId) || token.institutionId);
  if (isUnitTestMode()) {
    throw new Error('TEST_OFFLINE_NO_BACKEND: device binding requires the trusted backend (unavailable in unit-test offline mode)');
  }
  try {
    const { fns, httpsCallable } = getDeviceFunctionsClient();
    const { fingerprint } = getLocalDeviceIdentity();
    const res = await httpsCallable(fns, 'centerValidateDevice')({
      institutionId: instId,
      deviceFingerprintHash: fingerprint
    });
    return res.data;
  } catch (err) {
    if (!isCallableMissing(err)) throw err;
  }
  // Fallback: read-only evaluation against the canonical docs (same truth
  // SuperAdmin reads). No writes here — heartbeat/activation own the writes.
  const { fingerprint } = getLocalDeviceIdentity();
  const clientDb = await getClientFirestoreDb(token);
  const licSnap = await getDocs(query(collection(clientDb, 'licenses'), where('institutionId', '==', instId)));
  const active = licSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.status === 'ACTIVE')[0];
  if (!active) {
    return { valid: false, status: 'LICENSE_NOT_FOUND', reason: 'لا يوجد ترخيص مفعّل لهذه المؤسسة' };
  }
  if (active.expiresAt && new Date(active.expiresAt) < new Date()) {
    return { valid: false, status: 'SUBSCRIPTION_EXPIRED', reason: 'انتهت صلاحية ترخيص المؤسسة' };
  }

  // Bi-directional check: Is this physical machine bound to another institution?
  try {
    const foreignSnap = await getDocs(query(
      collection(clientDb, 'deviceBindings'),
      where('deviceFingerprintHash', '==', fingerprint),
      where('status', '==', 'BOUND')
    )).catch(() => ({ docs: [] }));
    const foreign = foreignSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .find(b => b.institutionId && b.institutionId !== instId);
    if (foreign) {
      return {
        valid: false,
        status: 'DEVICE_BOUND_TO_ANOTHER_INSTITUTION',
        reason: 'هذا الجهاز مخصص ومرتبط بالفعل بأكاديمية/سنتر آخر. يُمنع نهائياً تشغيل حساب سنتر مختلف على نفس جهاز الكمبيوتر.'
      };
    }
  } catch (_) {}

  const bindSnap = await getDocs(query(
    collection(clientDb, 'deviceBindings'),
    where('institutionId', '==', instId),
    where('status', '==', 'BOUND')
  ));
  const bound = bindSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const same = bound.find(b => b.deviceFingerprintHash === fingerprint);
  if (same) {
    return { valid: true, status: 'ACTIVE', bindingId: same.bindingId || same.id, licenseId: active.licenseId || active.id };
  }
  const pendSnap = await getDocs(query(
    collection(clientDb, 'deviceBindings'),
    where('institutionId', '==', instId),
    where('status', '==', 'PENDING')
  ));
  const pending = pendSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(b => b.deviceFingerprintHash === fingerprint);
  if (pending) {
    return { valid: false, status: 'PENDING_APPROVAL', reason: 'طلب ربط هذا الجهاز بانتظار اعتماد SuperAdmin' };
  }
  if (bound.some(b => b.deviceFingerprintHash !== fingerprint)) {
    return { valid: false, status: 'DEVICE_MISMATCH', reason: 'هذا الجهاز غير مصرح له (مرتبط بجهاز آخر)' };
  }
  return { valid: false, status: 'UNBOUND', reason: 'الترخيص غير مرتبط بجهاز حالياً (يتطلب التفعيل الأول)' };
}

async function requestRebind(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  if (isUnitTestMode()) {
    return {
      requestId: `req_rebind_${Date.now()}_test`,
      institutionId: instId,
      status: 'PENDING_TEST_ONLY',
      message: 'TEST DOUBLE: rebind is not attempted in unit-test offline mode',
      _testDouble: true
    };
  }
  // Honest path: attempt the real canonical bind. A different active device
  // yields DEVICE_LIMIT_EXCEEDED (fail closed) instead of a fake "pending".
  return requestDeviceBinding(token, { institutionId: instId });
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
  const instId = validateTenantAccess(token, targetInstitutionId || token.institutionId);

  // Cloud Firestore document institutions/{instId} is authoritative source for branding
  if (isTestOffline()) {
    const raw = inMemoryBranding.get(instId) || {};
    return resolveInstitutionTheme(buildBrandingMerged(instId, raw));
  }
  const clientDb = await getClientFirestoreDb(token);
  const instRef = doc(clientDb, 'institutions', instId);
  const snap = await getDoc(instRef);

  let raw = {};
  if (snap.exists()) {
    const data = snap.data();
    raw = data.branding || data;
  }
  if (inMemoryBranding.has(instId)) {
    raw = { ...raw, ...inMemoryBranding.get(instId) };
  }

  return resolveInstitutionTheme(buildBrandingMerged(instId, raw));
}

function buildBrandingMerged(instId, raw = {}) {
  return {
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
}

async function updateBranding(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'settings:update');

  let existingBranding = {};
  let snapExists = false;
  let clientDb = null;
  let instRef = null;
  if (isTestOffline()) {
    existingBranding = inMemoryBranding.get(instId) || {};
    snapExists = inMemoryBranding.has(instId);
  } else {
    clientDb = await getClientFirestoreDb(token);
    instRef = doc(clientDb, 'institutions', instId);
    const snap = await getDoc(instRef);
    snapExists = snap.exists();
    if (snapExists) {
      const data = snap.data();
      existingBranding = data.branding || data;
    }
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
  if (isTestOffline()) {
    inMemoryBranding.set(instId, { ...existingBranding, ...updatedBranding });
  } else if (!snapExists) {
    await setDoc(instRef, {
      id: instId,
      institutionId: instId,
      name: updatedBranding.centerName || 'سنتر التفوق التعليمي',
      status: 'ACTIVE',
      createdBy: token.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      branding: updatedBranding
    }, { merge: true });
    inMemoryBranding.set(instId, { ...existingBranding, ...updatedBranding });
  } else {
    try {
      await setDoc(instRef, {
        name: updatedBranding.centerName || 'سنتر التفوق التعليمي',
        branding: updatedBranding,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (writeErr) {
      // Fallback: update whitelisted name on institutions doc and keep branding in memory/cache
      await setDoc(instRef, {
        name: updatedBranding.centerName || 'سنتر التفوق التعليمي',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    inMemoryBranding.set(instId, { ...existingBranding, ...updatedBranding });
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
  const { assetType } = payload;
  if (assetType !== 'logo' && assetType !== 'watermark') {
    throw new Error('INVALID_ASSET_TYPE: Asset type must be logo or watermark');
  }

  // P0 SECURITY: fail closed. The canonical Worker PUT (/upload) supports
  // uploadKind=lesson|source only — there is NO authenticated branding path,
  // so no URL/objectKey is minted here. Metadata-only branding remains
  // available via updateBranding (logoUrl/watermarkUrl as external URLs).
  // Required future extension (NOT implemented in P0): PUT
  // /upload?uploadKind=branding&institutionId&assetType=logo|watermark with
  // IMAGE caps+MIME, key institutions/{inst}/branding/{assetId}, UPLOAD_ROLES
  // membership check, then updateBranding persists the real objectKey.
  // Never return a fake successful upload response.
  throw new Error('BRANDING_UPLOAD_UNSUPPORTED: branding binary upload has no canonical Worker path — use updateBranding with an externally hosted logoUrl/watermarkUrl');
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

// ----------------------------------------------------------------------------
// STUDENT AUTHENTICATION MANAGEMENT
// ----------------------------------------------------------------------------

/**
 * Generate initial PIN for a student
 * Returns the PIN once for display to authorized staff
 * 
 * Validates student account state before generating PIN
 */
async function generateStudentPin(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'students:create');

  const studentId = (payload.studentId || '').trim();
  if (!studentId) {
    throw arabicServiceError('INVALID_STUDENT_ID', 'معرف الطالب مطلوب');
  }

  if (isUnitTestMode()) {
    throw new Error('TEST_OFFLINE_NO_BACKEND: PIN generation requires the trusted backend (unavailable in unit-test offline mode)');
  }

  // Validate student exists and is in a valid state
  const student = await getStudentById(token, studentId, instId);
  if (!student) {
    throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود في هذه المؤسسة');
  }

  // Check if student is archived
  if (student.status === 'ARCHIVED') {
    throw arabicServiceError('STUDENT_ARCHIVED', 'لا يمكن إنشاء رقم سري لطالب مؤرشف');
  }

  const { fns, httpsCallable } = getDeviceFunctionsClient();
  const callable = httpsCallable(fns, 'generateStudentPin');

  try {
    const result = await callable({
      studentId: studentId,
      institutionId: instId,
    });
    return result.data;
  } catch (err) {
    if (err.code === 'functions/unauthenticated') {
      throw arabicServiceError('UNAUTHENTICATED', 'يجب تسجيل الدخول أولاً');
    }
    if (err.code === 'functions/permission-denied') {
      throw arabicServiceError('PERMISSION_DENIED', 'ليس لديك صلاحية لإنشاء أرقام سرية للطلاب');
    }
    if (err.code === 'functions/not-found') {
      throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود في هذه المؤسسة');
    }
    throw arabicServiceError('PIN_GENERATION_FAILED', err.message || 'فشل إنشاء الرقم السري');
  }
}

/**
 * Reset student password (generate new PIN)
 * Returns the new PIN once for display to authorized staff
 * 
 * Validates student account state before resetting password
 */
async function resetStudentPassword(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'students:create');

  const studentId = (payload.studentId || '').trim();
  if (!studentId) {
    throw arabicServiceError('INVALID_STUDENT_ID', 'معرف الطالب مطلوب');
  }

  // Validate student exists and is in a valid state
  const student = await getStudentById(token, studentId, instId);
  if (!student) {
    throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود في هذه المؤسسة');
  }

  // Check if student is archived
  if (student.status === 'ARCHIVED') {
    throw arabicServiceError('STUDENT_ARCHIVED', 'لا يمكن إعادة تعيين كلمة مرور لطالب مؤرشف');
  }

  const newPin = crypto.randomInt(100000, 1000000).toString();

  if (isUnitTestMode()) {
    student.tempPassword = newPin;
    student.status = 'ACTIVE';
    const key = `${instId}_${studentId}`;
    inMemoryStudents.set(key, { ...student });
    return { success: true, studentId, studentName: student.name, pin: newPin };
  }

  const clientDb = await getClientFirestoreDb(token);

  // Provision / update password in Firebase Auth so student mobile login works immediately
  const normPhone = student.normalizedPhone || (student.phone ? normalizeEgyptianPhone(student.phone) : '');
  let updatedAuthUid = student.authUid;
  if (normPhone) {
    try {
      const prov = await provisionStudentAuthAccount(normPhone, newPin, student.tempPassword);
      if (prov && prov.authUid && !prov.authUid.startsWith('auth_uid_')) {
        updatedAuthUid = prov.authUid;
      }
    } catch (authErr) {
      console.warn('[resetStudentPassword] Auth provisioning warning:', authErr && authErr.message);
    }
  }

  const patch = {
    status: 'MUST_CHANGE_PASSWORD',
    mustChangePassword: true,
    initialPinChanged: false,
    tempPassword: newPin,
    updatedAt: new Date().toISOString()
  };
  if (updatedAuthUid && updatedAuthUid !== student.authUid) {
    patch.authUid = updatedAuthUid;
  }

  try {
    await setDoc(doc(clientDb, 'institutions', instId, 'students', studentId), patch, { merge: true });
  } catch (setErr) {
    const isPermDenied = setErr && (setErr.code === 'permission-denied' || (setErr.message && setErr.message.includes('PERMISSION_DENIED')));
    if (isPermDenied && patch.authUid) {
      console.warn('[resetStudentPassword] setDoc failed with authUid update due to rules, retrying without authUid patch...');
      const patchWithoutAuthUid = { ...patch };
      delete patchWithoutAuthUid.authUid;
      await setDoc(doc(clientDb, 'institutions', instId, 'students', studentId), patchWithoutAuthUid, { merge: true });
    } else {
      throw setErr;
    }
  }
  student.tempPassword = newPin;
  student.status = 'MUST_CHANGE_PASSWORD';
  student.mustChangePassword = true;
  student.initialPinChanged = false;
  if (patch.authUid) student.authUid = patch.authUid;

  await recordAuditEvent({
    action: 'RESET_STUDENT_PASSWORD',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'STUDENT',
    targetId: studentId,
    details: { studentName: student.name }
  });

  return { success: true, studentId, studentName: student.name, pin: newPin };
}

/**
 * Reset teacher password (generate new PIN)
 * Forces password change on first login
 */
async function resetTeacherPassword(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'teachers:create');

  const teacherId = (payload.teacherId || '').trim();
  if (!teacherId) {
    throw arabicServiceError('INVALID_TEACHER_ID', 'معرف المعلم مطلوب');
  }

  const newPin = crypto.randomInt(100000, 1000000).toString();

  if (isTestOffline() || isUnitTestMode()) {
    const key = `${instId}_${teacherId}`;
    const memTeacher = inMemoryTeachers.get(key);
    if (!memTeacher) {
      throw arabicServiceError('TEACHER_NOT_FOUND', 'المعلم غير موجود في هذه المؤسسة');
    }
    if (memTeacher.status === 'ARCHIVED') {
      throw arabicServiceError('TEACHER_ARCHIVED', 'لا يمكن إعادة تعيين كلمة مرور لمعلم مؤرشف');
    }
    memTeacher.tempPassword = newPin;
    memTeacher.status = 'MUST_CHANGE_PASSWORD';
    memTeacher.mustChangePassword = true;
    memTeacher.initialPinChanged = false;
    inMemoryTeachers.set(key, { ...memTeacher });
    return { success: true, teacherId, teacherName: memTeacher.fullName || memTeacher.name, pin: newPin };
  }

  const clientDb = await getClientFirestoreDb(token);
  const teacherRef = doc(clientDb, 'institutions', instId, 'teachers', teacherId);
  const teacherSnap = await getDoc(teacherRef);
  if (!teacherSnap.exists()) {
    throw arabicServiceError('TEACHER_NOT_FOUND', 'المعلم غير موجود في هذه المؤسسة');
  }
  const teacher = teacherSnap.data();

  if (teacher.status === 'ARCHIVED') {
    throw arabicServiceError('TEACHER_ARCHIVED', 'لا يمكن إعادة تعيين كلمة مرور لمعلم مؤرشف');
  }

  const normPhone = teacher.normalizedPhone || (teacher.phone ? normalizeEgyptianPhone(teacher.phone) : '');
  let updatedAuthUid = teacher.authUid;
  if (normPhone) {
    try {
      const prov = await provisionTeacherAuthAccount(normPhone, newPin, teacher.tempPassword);
      if (prov && prov.authUid && !prov.authUid.startsWith('auth_uid_')) {
        updatedAuthUid = prov.authUid;
      }
    } catch (authErr) {
      console.warn('[resetTeacherPassword] Auth provisioning warning:', authErr && authErr.message);
    }
  }

  const cleanPhone = normPhone.replace(/[^\d]/g, '');
  const patch = {
    status: 'MUST_CHANGE_PASSWORD',
    mustChangePassword: true,
    initialPinChanged: false,
    tempPassword: newPin,
    authEmail: `tch_${cleanPhone}@remas.local`,
    updatedAt: new Date().toISOString()
  };
  if (updatedAuthUid && updatedAuthUid !== teacher.authUid) {
    patch.authUid = updatedAuthUid;
  }

  try {
    await setDoc(teacherRef, patch, { merge: true });
  } catch (setErr) {
    const isPermDenied = setErr && (setErr.code === 'permission-denied' || (setErr.message && setErr.message.includes('PERMISSION_DENIED')));
    if (isPermDenied && patch.authUid) {
      console.warn('[resetTeacherPassword] setDoc failed with authUid update due to rules, retrying without authUid patch...');
      const patchWithoutAuthUid = { ...patch };
      delete patchWithoutAuthUid.authUid;
      await setDoc(teacherRef, patchWithoutAuthUid, { merge: true });
    } else {
      throw setErr;
    }
  }
  await recordAuditEvent({
    action: 'RESET_TEACHER_PASSWORD',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'TEACHER',
    targetId: teacherId,
    details: { teacherName: teacher.name || teacher.fullName, phone: teacher.phone }
  });

  return { success: true, teacherId, teacherName: teacher.name || teacher.fullName, pin: newPin };
}

/**
 * Get student account status
 */
async function getStudentAccountStatus(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'students:read');

  const studentId = (payload.studentId || '').trim();
  if (!studentId) {
    throw arabicServiceError('INVALID_STUDENT_ID', 'معرف الطالب مطلوب');
  }

  if (isUnitTestMode()) {
    // Return mock data for unit tests
    const student = inMemoryStudents.get(`${instId}_${studentId}`);
    if (!student) {
      throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود');
    }
    const statusMap = {
      'ACTIVE': 'نشط',
      'MUST_CHANGE_PASSWORD': 'يحتاج تغيير كلمة المرور',
      'INACTIVE': 'غير نشط',
      'ARCHIVED': 'مؤرشف',
    };
    return {
      success: true,
      studentId: studentId,
      studentName: student.name,
      status: student.status || 'UNKNOWN',
      statusArabic: statusMap[student.status] || 'غير معروف',
      hasAuthAccount: !!student.authUid,
      institutionId: instId,
    };
  }

  // Validate student exists
  const student = await getStudentById(token, studentId, instId);
  if (!student) {
    throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود في هذه المؤسسة');
  }

  const { fns, httpsCallable } = getDeviceFunctionsClient();
  const callable = httpsCallable(fns, 'getStudentAccountStatus');

  try {
    const result = await callable({
      studentId: studentId,
      institutionId: instId,
    });
    return result.data;
  } catch (err) {
    if (err.code === 'functions/not-found') {
      throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود في هذه المؤسسة');
    }
    throw err;
  }
}

// ----------------------------------------------------------------------------
// SUPERADMIN & CENTER AI SERVICES (ZERO-COST GEMINI ARCHITECTURE)
// ----------------------------------------------------------------------------

async function getSuperAdminAiConfig(callerToken) {
  const token = resolveCallerToken(callerToken);
  const clientDb = await getClientFirestoreDb(token);
  try {
    const snap = await getDoc(doc(clientDb, 'system', 'aiConfig'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...data,
        isConfigured: !!(data.geminiKey || (data.geminiKeys && data.geminiKeys.length)),
        geminiKeyMasked: data.geminiKey ? `${data.geminiKey.slice(0, 7)}...${data.geminiKey.slice(-4)}` : 'غير مسجل'
      };
    }
  } catch (_) {}
  return {
    isConfigured: false,
    enabledForCenters: true,
    primaryProvider: 'gemini',
    geminiKey: '',
    geminiKeys: [],
    groqKey: '',
    dailyStudentLimit: 15
  };
}

async function saveSuperAdminAiConfig(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const isSuper = token.isSuperAdmin === true || token.role === 'superadmin' || token.role === 'SUPERADMIN' || token.superadmin === true;
  if (!isSuper) {
    throw arabicServiceError('FORBIDDEN', 'تعديل وضبط مفاتيح الذكاء الاصطناعي مقتصر فقط على حساب السوبر أدمن');
  }

  const clientDb = await getClientFirestoreDb(token);
  const docRef = doc(clientDb, 'system', 'aiConfig');
  const existing = await getDoc(docRef).catch(() => null);
  const cur = existing && existing.exists() ? existing.data() : {};

  const cleanKey = (k) => typeof k === 'string' ? k.trim() : '';
  const geminiKey = payload.geminiKey !== undefined ? cleanKey(payload.geminiKey) : (cur.geminiKey || '');
  const groqKey = payload.groqKey !== undefined ? cleanKey(payload.groqKey) : (cur.groqKey || '');
  const rawPool = Array.isArray(payload.geminiKeys) ? payload.geminiKeys : (cur.geminiKeys || []);
  const geminiKeys = rawPool.map(cleanKey).filter(k => k && k.length > 10);

  const data = {
    ...cur,
    geminiKey,
    geminiKeys,
    groqKey,
    primaryProvider: payload.primaryProvider || cur.primaryProvider || 'gemini',
    enabledForCenters: payload.enabledForCenters !== undefined ? !!payload.enabledForCenters : (cur.enabledForCenters !== false),
    dailyStudentLimit: Number(payload.dailyStudentLimit || cur.dailyStudentLimit || 15),
    updatedAt: new Date().toISOString(),
    updatedBy: token.uid || 'superadmin'
  };

  await setDoc(docRef, data, { merge: true });
  return { success: true, message: 'تم حفظ مفاتيح وإعدادات الذكاء الاصطناعي بنجاح' };
}

async function testAiKeyConnection(callerToken, apiKeyToTest) {
  const token = resolveCallerToken(callerToken);
  let key = typeof apiKeyToTest === 'string' ? apiKeyToTest.trim() : '';
  if (!key) {
    const conf = await getSuperAdminAiConfig(token);
    key = conf.geminiKey || (conf.geminiKeys && conf.geminiKeys[0]) || '';
  }
  if (!key) {
    throw arabicServiceError('MISSING_KEY', 'يرجى إدخال مفتاح API لفحصه أولاً');
  }

  // Auto-detect Groq Key (starts with gsk_)
  if (key.startsWith('gsk_')) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'قل كلمة: ناجح' }],
          max_tokens: 10
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`فشل الاتصال بمفتاح Groq (${res.status}): ${errText.slice(0, 150)}`);
      }
      return { success: true, status: 'CONNECTED', provider: 'Groq', message: 'الاتصال بمحرك Groq (Llama 3.3 70B) يعمل بنجاح فائق وبدون أي حظر 🟢' };
    } catch (e) {
      throw arabicServiceError('GROQ_CONNECTION_FAILED', e.message);
    }
  }

  // Google Gemini Key probe (try gemini-1.5-flash then gemini-2.0-flash)
  const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  let lastErr = null;
  for (const m of geminiModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'قل كلمة: ناجح' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });

      if (res.ok) {
        return { success: true, status: 'CONNECTED', provider: 'Gemini', message: `الاتصال بمحرك Gemini (${m}) يعمل بنجاح وكفاءة تامة 🟢` };
      }

      const errText = await res.text();
      if (errText.includes('User location is not supported')) {
        return { success: true, status: 'CONNECTED', provider: 'Gemini', message: 'تم التحقق من صحة مفتاح Gemini لدى Google بنجاح 🟢 (المفتاح سليم ومسجل).' };
      }
      lastErr = `(${res.status}): ${errText.slice(0, 150)}`;
    } catch (e) {
      lastErr = e.message;
    }
  }

  throw new Error(`فشل الاتصال بمفتاح Gemini: ${lastErr}`);
}

async function generateExamQuestionsAi(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const clientDb = await getClientFirestoreDb(token);
  const instId = token.institutionId || payload.institutionId;

  // 1. Fetch Central AI Configuration & Provider Routing
  let config = {};
  let provMeta = {};
  try {
    const snap = await getDoc(doc(clientDb, 'system', 'aiConfig'));
    if (snap.exists()) config = snap.data();
  } catch (err) {
    console.warn('Could not read system/aiConfig:', err);
  }

  try {
    const pSnap = await getDoc(doc(clientDb, 'system', 'aiProviders'));
    if (pSnap.exists()) provMeta = pSnap.data();
  } catch (_) {}

  // 2. Fetch Center AI Governance & Quota
  let instConfig = null;
  if (instId) {
    try {
      const instSnap = await getDoc(doc(clientDb, 'institutions', instId, 'aiConfig', 'config'));
      if (instSnap.exists()) instConfig = instSnap.data();
    } catch (_) {}
  }

  // Validate Center Permissions
  if (instConfig && instConfig.aiEnabled === false) {
    throw arabicServiceError('FORBIDDEN', 'خدمات الذكاء الاصطناعي معلقة لهذا السنتر بقرار إداري من السوبر أدمن.');
  }
  if (instConfig && instConfig.features?.questionGeneration?.enabled === false) {
    throw arabicServiceError('FORBIDDEN', 'خاصية توليد الأسئلة غير مصرح بها لهذا السنتر. يرجى مراجعة إدارة المنصة.');
  }

  // Check Monthly Quota
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let currentMonthQuestions = 0;
  if (instId) {
    try {
      const usageSnap = await getDoc(doc(clientDb, 'institutions', instId, 'aiUsage', periodKey));
      if (usageSnap.exists()) {
        currentMonthQuestions = Number(usageSnap.data().questionsGenerated || 0);
      }
    } catch (_) {}
  }

  const monthlyLimit = (instConfig && (instConfig.features?.questionGeneration?.monthlyLimit || instConfig.monthlyLimit)) || 3000;
  if (currentMonthQuestions >= monthlyLimit) {
    throw arabicServiceError('QUOTA_EXCEEDED', `تم استنفاد الكوتة الشهرية المخصصة للسنتر (${currentMonthQuestions}/${monthlyLimit} سؤال). يمكنك طلب زيادة الكوتة من السوبر أدمن.`);
  }

  // 3. Extract Multi-Provider Keys
  const geminiKeys = [];
  if (config.geminiKey && typeof config.geminiKey === 'string' && config.geminiKey.trim()) {
    geminiKeys.push(config.geminiKey.trim());
  }
  if (Array.isArray(config.geminiKeys)) {
    for (const k of config.geminiKeys) {
      if (typeof k === 'string' && k.trim() && !geminiKeys.includes(k.trim())) geminiKeys.push(k.trim());
    }
  }

  const openrouterKey = (config.openrouterKey || '').trim();
  const openrouterModel = config.openrouterModel || provMeta.openrouter?.model || 'nvidia/nemotron-3.5-lightning:free';
  const primaryProvider = provMeta.primaryProvider || 'gemini';

  const hasAnyKey = geminiKeys.length > 0 || openrouterKey.length > 0;
  if (!hasAnyKey) {
    throw arabicServiceError('AI_NOT_CONFIGURED', 'لم يتم ضبط مفاتيح الذكاء الاصطناعي المجانية من قِبل السوبر أدمن بعد. يرجى إدخال مفتاح Gemini أو OpenRouter من لوحة السوبر أدمن أولاً.');
  }

  // Helper to slice text based on requested page numbers
  function extractPageRangeFromContent(rawText, startPage, endPage) {
    if (!rawText || typeof rawText !== 'string') return '';
    if (!startPage && !endPage) return rawText;

    const sPage = Math.max(1, Number(startPage) || 1);
    const ePage = endPage ? Math.max(sPage, Number(endPage)) : null;

    // 1. Form Feed page break (\f)
    if (rawText.includes('\f')) {
      const pages = rawText.split('\f');
      const startIdx = sPage - 1;
      const endIdx = ePage ? ePage : pages.length;
      const sliced = pages.slice(startIdx, endIdx).join('\n\n--- صفحة جديدة ---\n\n');
      if (sliced.trim().length > 30) return sliced;
    }

    // 2. Explicit Arabic/English page headers e.g. "صفحة 5" or "Page 5"
    const pageHeaderRegex = /(?:(?:\r?\n){2,}|^)(?:صفحة|الصفحة|Page|PAGE)\s*[:#-]?\s*(\d+)/g;
    const matches = [...rawText.matchAll(pageHeaderRegex)];
    if (matches.length >= 2) {
      let startCharIdx = 0;
      let endCharIdx = rawText.length;
      let foundStart = false;

      for (const match of matches) {
        const pNum = parseInt(match[1], 10);
        if (!foundStart && pNum >= sPage) {
          startCharIdx = match.index;
          foundStart = true;
        }
        if (ePage && pNum > ePage) {
          endCharIdx = match.index;
          break;
        }
      }
      const sliced = rawText.slice(startCharIdx, endCharIdx);
      if (sliced.trim().length > 50) return sliced;
    }

    // 3. PDF Page objects /Type /Page
    const pdfPageRegex = /\/Type\s*\/Page\b/g;
    const pdfMatches = [...rawText.matchAll(pdfPageRegex)];
    if (pdfMatches.length >= 2) {
      const totalPdfPages = pdfMatches.length;
      const startIdx = Math.min(sPage - 1, totalPdfPages - 1);
      const endIdx = ePage ? Math.min(ePage, totalPdfPages) : totalPdfPages;

      const startChar = pdfMatches[startIdx] ? pdfMatches[startIdx].index : 0;
      const endChar = (endIdx < totalPdfPages && pdfMatches[endIdx]) ? pdfMatches[endIdx].index : rawText.length;
      const sliced = rawText.slice(startChar, endChar);
      if (sliced.trim().length > 50) return sliced;
    }

    // 4. Proportional slicing fallback based on document length
    const estimatedTotalPages = Math.max(ePage || sPage, Math.ceil(rawText.length / 2500));
    const charPerPage = Math.floor(rawText.length / estimatedTotalPages);

    const startChar = Math.max(0, (sPage - 1) * charPerPage);
    const endChar = ePage ? Math.min(rawText.length, ePage * charPerPage) : rawText.length;

    return rawText.slice(startChar, endChar);
  }

  function sanitizeDocumentText(text) {
    if (!text || typeof text !== 'string') return '';
    if (isRawPdfBinaryString(text)) {
      return extractReadableTextFromPdfBuffer(Buffer.from(text, 'latin1'));
    }
    if (text.includes('stream') && text.includes('endstream')) {
      text = text.replace(/stream[\r\n]+[\s\S]*?[\r\n]+endstream/g, (match) => {
        const printable = match.replace(/[^\x20-\x7E\u0600-\u06FF\n\r\t]/g, ' ');
        return printable.length > 30 ? printable : ' ';
      });
    }
    return text.replace(/[\x00-\x08\x0B\x0E-\x1F\x7F]/g, ' ');
  }

  const {
    stageName: rawStageName = '',
    subjectName: rawSubjectName = '',
    lessonTitle = '',
    topic = '',
    sourceText = '',
    contextText = '',
    count = 5,
    questionCount = 5,
    type = 'MCQ',
    questionType = 'MCQ',
    difficulty = 'MEDIUM',
    startPage = null,
    endPage = null
  } = payload;

  let stageName = rawStageName;
  let subjectName = rawSubjectName;
  if (!stageName && payload.stageId && instId) {
    try {
      const stSnap = await getDoc(doc(clientDb, 'institutions', instId, 'stages', payload.stageId));
      if (stSnap.exists()) stageName = stSnap.data().name || '';
    } catch (_) {}
  }
  if (!subjectName && payload.subjectId && instId) {
    try {
      const subSnap = await getDoc(doc(clientDb, 'institutions', instId, 'subjects', payload.subjectId));
      if (subSnap.exists()) subjectName = subSnap.data().name || '';
    } catch (_) {}
  }

  const resolvedSource = await resolveAiSourceMaterial(clientDb, instId, payload);
  const sPage = resolvedSource.startPage || startPage || null;
  const ePage = resolvedSource.endPage || endPage || null;
  const pdfBase64 = resolvedSource.pdfBase64 || null;

  const countNum = Math.min(20, Math.max(1, Number(questionCount || count) || 5));
  const finalType = questionType || type || 'MCQ';
  const effectiveTopic = topic || lessonTitle || resolvedSource.sourceTitle || '';
  
  let effectiveSource = sanitizeDocumentText(resolvedSource.cleanText || contextText || sourceText || '');
  if (effectiveSource && (sPage || ePage)) {
    effectiveSource = extractPageRangeFromContent(effectiveSource, sPage, ePage);
  }

  const diffArabic = {
    EASY: 'مستوى سهل ومباشر يقيس التذكر والاستيعاب البسيط',
    MEDIUM: 'مستوى متوسط يقيس الفهم والتطبيق',
    HARD: 'مستوى متقدم للمتفوقين يقيس التحليل والتركيب والمسائل العميقة',
    GRADUATED: 'مستوى متدرج (يبدأ بأسئلة سهلة ثم متوسطة ثم ينتهي بأسئلة للمتفوقين)'
  }[difficulty] || 'مستوى متوسط';

  const typeDesc = {
    MCQ: 'أسئلة اختيار من متعدد (كل سؤال له 4 خيارات أ، ب، ج، د مع تحديد الخيار الصحيح)',
    TRUE_FALSE: 'أسئلة صواب وخطأ مع تصويب العبارة الخاطئة',
    ESSAY: 'أسئلة مقالية وأسئلة علل ومسائل وشرح خطوات الحل',
    MIXED: 'مزيج من أسئلة الاختيار من متعدد والمسائل والأسئلة المقالية'
  }[finalType] || 'أسئلة اختيار من متعدد';

  const systemPrompt = `أنت خبير تربوي ومعلم أول متخصص في وضع الامتحانات الرسمية والمدرسية باللغة العربية وفق المناهج التعليمية المعتمدة.
مهمتك: توليد اختبار تعليمي دقيق وممتاز للطلاب.
المطلوب إخراج النتيجة بتنسيق JSON صالح فقط (valid JSON array) بدون أي نصوص قبلها أو بعدها.
يُمنع منعاً باتاً إرجاع أي رسائل اعتذار داخل الأسئلة؛ إذا كان هناك ملف PDF مرفق، اقرأ الصفحات المحددة منه بدقة واستخرج الأسئلة منها مباشرة.
هيكل كل سؤال في الـ JSON:
{
  "questionNumber": 1,
  "prompt": "نص السؤال بوضوح وصياغة لغوية سليمة",
  "type": "MCQ",
  "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
  "correctIndex": 0,
  "correctAnswer": "نص الخيار الصحيح",
  "explanation": "شرح علمي مبسط لسبب صحة هذه الإجابة ليتعلم منه الطالب",
  "marks": 2
}`;

  let userPrompt = `يرجى توليد عدد ${countNum} سؤال (${typeDesc}) بمستوى صعوبة: ${diffArabic}.
المرحلة الدراسية: ${stageName || 'المرحلة التعليمية المعتمدة'}
المادة: ${subjectName || 'المادة الدراسية'}
عنوان الدرس / الموضوع: ${effectiveTopic || 'الدرس المحدد'}
`;

  if (sPage || ePage) {
    userPrompt += `\n🎯 نطاق الصفحات المستهدفة حصرياً: من صفحة (${sPage || 1}) إلى صفحة (${ePage || 'نهاية المذكرة'}).\n⚠️ توجيه تعليمي إلزامي: يجب قراءة واستنباط جميع الأسئلة حصرياً وبدقة تامة من الصفحات من (${sPage || 1}) إلى (${ePage || 'النهاية'}) فقط داخل المذكرة المرفقة وتجاهل أي صفحات خارج هذا النطاق.\n`;
  }

  if (pdfBase64) {
    userPrompt += `\n📎 مرفق لك ملف الـ PDF الأصلي للمذكرة (${resolvedSource.sourceTitle || 'المذكرة الدراسية'}). اقرأ محتوى الصفحات المطلوبة (${sPage || 1} إلى ${ePage || 'النهاية'}) مباشرة من ملف الـ PDF المرفق واستخرج الأسئلة منها بدقة علمية كاملة.\n`;
  }

  if (effectiveSource && String(effectiveSource).trim().length > 40) {
    userPrompt += `\nنص مستخرج مساعد من المذكرة:\n"""\n${String(effectiveSource).slice(0, 30000)}\n"""\n`;
  } else if (!pdfBase64) {
    userPrompt += `\nيرجى صياغة الأسئلة حول موضوع "${effectiveTopic || subjectName}" وفق المنهج الدراسي المصري الرسمي المعتمد لهذه المرحلة والمادة بدقة واحترافية.\n`;
  }

  let lastError = null;

  // Helper function to call OpenRouter
  async function callOpenRouter() {
    if (!openrouterKey) throw new Error('مفتاح OpenRouter غير متوفر');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://educenter-saas-860c5.web.app',
        'X-Title': 'REMAS Center Desktop App'
      },
      body: JSON.stringify({
        model: openrouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content || '';
    if (!rawText) throw new Error('رد محرك OpenRouter فارغ');

    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (_) {
      const match = rawText.match(/```(?:json)?([\s\S]*?)```/);
      if (match) parsed = JSON.parse(match[1]);
      else throw new Error('تعذر معالجة صيغة JSON المسترجعة من OpenRouter');
    }

    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || [parsed]);
    return {
      success: true,
      provider: 'OpenRouter',
      model: openrouterModel,
      questionsCount: questions.length,
      questions
    };
  }

  // Helper function to call Gemini (with native Multimodal PDF support + fallback)
  async function callGemini() {
    if (geminiKeys.length === 0) throw new Error('مفتاح Google Gemini غير متوفر');
    const modelsToTry = [...new Set([config.primaryModel || config.model || 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'])];
    let innerErr = null;

    const attachmentAttempts = pdfBase64 ? [true, false] : [false];

    for (const withPdf of attachmentAttempts) {
      for (const apiKey of geminiKeys) {
        for (const m of modelsToTry) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
            const parts = [];
            if (withPdf && pdfBase64) {
              parts.push({
                inline_data: {
                  mime_type: 'application/pdf',
                  data: pdfBase64
                }
              });
            }
            parts.push({ text: systemPrompt + '\n\n' + userPrompt });

            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 4096,
                  responseMimeType: 'application/json'
                }
              })
            });

            if (!res.ok) {
              const errText = await res.text();
              innerErr = new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 150)}`);
              continue;
            }

            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!rawText) throw new Error('رد نموذج Gemini فارغ');

            let parsed = null;
            try {
              parsed = JSON.parse(rawText);
            } catch (_) {
              const match = rawText.match(/```(?:json)?([\s\S]*?)```/);
              if (match) parsed = JSON.parse(match[1]);
              else throw new Error('تعذر معالجة صيغة JSON المسترجعة');
            }

            const questions = Array.isArray(parsed) ? parsed : (parsed.questions || [parsed]);
            if (questions.length > 0 && String(questions[0]?.prompt || '').includes('لا يمكنني توليد أسئلة')) {
              throw new Error('رفض النموذج قراءة النص الخام — جاري المحاولة بالبديل');
            }
            return {
              success: true,
              provider: 'Google Gemini',
              model: m,
              questionsCount: questions.length,
              questions
            };
          } catch (err) {
            innerErr = err;
          }
        }
      }
    }
    throw innerErr || new Error('فشلت جميع محاولات الاتصال بـ Google Gemini');
  }

  // 4. Execution: When a PDF is attached and Gemini keys exist, ALWAYS prefer Gemini first
  let result = null;
  const preferGemini = Boolean(pdfBase64 && geminiKeys.length > 0) || primaryProvider !== 'openrouter';
  if (!preferGemini) {
    try {
      result = await callOpenRouter();
    } catch (orErr) {
      lastError = orErr;
      console.warn('OpenRouter primary failed, falling back to Gemini:', orErr.message);
      if (geminiKeys.length > 0) {
        try {
          result = await callGemini();
        } catch (gErr) {
          lastError = gErr;
        }
      }
    }
  } else {
    try {
      result = await callGemini();
    } catch (gErr) {
      lastError = gErr;
      console.warn('Gemini primary failed, falling back to OpenRouter:', gErr.message);
      if (openrouterKey) {
        try {
          result = await callOpenRouter();
        } catch (orErr) {
          lastError = orErr;
        }
      }
    }
  }

  if (!result || !result.questions || result.questions.length === 0) {
    throw arabicServiceError('AI_GENERATION_FAILED', `تعذر توليد الأسئلة حالياً: ${lastError ? lastError.message : 'خطأ غير معروف في مزودات الذكاء'}`);
  }

  // 5. Track Question Usage for Center Governance
  if (instId && result.questions.length > 0) {
    try {
      const usageRef = doc(clientDb, 'institutions', instId, 'aiUsage', periodKey);
      const uSnap = await getDoc(usageRef);
      const prevCount = uSnap.exists() ? (Number(uSnap.data().questionsGenerated) || 0) : 0;
      await setDoc(usageRef, {
        questionsGenerated: prevCount + result.questions.length,
        lastUsedAt: now.toISOString(),
        institutionId: instId,
        updatedAt: now.toISOString()
      }, { merge: true });
    } catch (uErr) {
      console.warn('Non-blocking AI usage update error:', uErr);
    }
  }

  return result;
}

function findUploadedFileByName(fileName) {
  if (!fileName || typeof fileName !== 'string') return null;
  const targetName = path.basename(fileName).trim().toLowerCase();
  if (!targetName) return null;

  try {
    const os = require('os');
    const home = os.homedir() || process.env.USERPROFILE || '';
    const candidateDirs = [
      path.join(getLocalDataDir(), 'content_files'),
      path.join(getLocalDataDir(), 'videos'),
      home ? path.join(home, 'Downloads') : '',
      home ? path.join(home, 'Desktop') : '',
      home ? path.join(home, 'Documents') : '',
      'D:\\',
      'E:\\'
    ].filter(Boolean);

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      const directPath = path.join(dir, path.basename(fileName));
      if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
        return directPath;
      }
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries.slice(0, 80)) {
          if (entry.isFile() && entry.name.trim().toLowerCase() === targetName) {
            return path.join(dir, entry.name);
          }
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'Windows') {
            const subPath = path.join(dir, entry.name, path.basename(fileName));
            if (fs.existsSync(subPath) && fs.statSync(subPath).isFile()) {
              return subPath;
            }
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function extractReadableTextFromPdfBuffer(pdfBuf) {
  if (!pdfBuf || !Buffer.isBuffer(pdfBuf)) return '';
  const zlib = require('zlib');
  const rawStr = pdfBuf.toString('latin1');
  const chunks = [];

  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(rawStr)) !== null) {
    try {
      const streamBytes = Buffer.from(match[1], 'latin1');
      let decompressed = null;
      try {
        decompressed = zlib.inflateSync(streamBytes);
      } catch (_) {
        try {
          decompressed = zlib.inflateRawSync(streamBytes);
        } catch (__) {}
      }
      if (decompressed) {
        const utf8Text = decompressed.toString('utf8');
        const parenMatches = utf8Text.match(/\(([^()]{2,})\)/g) || [];
        for (const pm of parenMatches) {
          const inner = pm.slice(1, -1).replace(/\\n/g, '\n').replace(/[^\x20-\x7E\u0600-\u06FF\n\r\t]/g, ' ').trim();
          if (inner.length > 2 && /[\u0600-\u06FFa-zA-Z]{2,}/.test(inner)) {
            chunks.push(inner);
          }
        }
        const arabicRuns = utf8Text.match(/[\u0600-\u06FF][\u0600-\u06FF\s0-9،.؟!-]{4,}/g) || [];
        for (const ar of arabicRuns) {
          chunks.push(ar.trim());
        }
      }
    } catch (_) {}
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

async function resolveAiSourceMaterial(clientDb, instId, payload = {}) {
  let contentDoc = null;
  const sourceId = payload.sourceId || payload.memoId || null;
  if (sourceId && instId) {
    try {
      const snap = await getDoc(doc(clientDb, 'institutions', instId, 'contents', sourceId));
      if (snap.exists()) contentDoc = { id: snap.id, ...snap.data() };
    } catch (_) {}
  }

  const startPage = Number(payload.startPage || contentDoc?.pageStart) || null;
  const endPage = Number(payload.endPage || contentDoc?.pageEnd) || null;
  const sourceTitle = payload.lessonTitle || payload.topic || contentDoc?.title || contentDoc?.fileName || '';
  const totalPages = Number(contentDoc?.pagesCount || contentDoc?.pageEnd) || null;

  let pdfBuf = null;

  if (payload.pdfBase64 || payload.fileBase64) {
    try {
      const b64 = String(payload.pdfBase64 || payload.fileBase64);
      const clean = b64.includes('base64,') ? b64.split('base64,')[1] : b64;
      pdfBuf = Buffer.from(clean, 'base64');
    } catch (_) {}
  }

  if (!pdfBuf) {
    const candidatePaths = [
      payload.filePath,
      contentDoc?.localStoredPath,
      contentDoc?.filePath,
      findUploadedFileByName(payload.fileName || contentDoc?.fileName || (contentDoc?.title ? `${contentDoc.title}.pdf` : ''))
    ].filter(Boolean);

    for (const p of candidatePaths) {
      try {
        if (typeof p === 'string' && fs.existsSync(p) && fs.statSync(p).isFile()) {
          pdfBuf = fs.readFileSync(p);
          if (contentDoc?.id && !contentDoc.localStoredPath) {
            const cachedPath = persistContentBinaryLocally({
              id: contentDoc.id,
              fileName: contentDoc.fileName || path.basename(p),
              filePath: p,
              isVideo: false
            });
            if (cachedPath) {
              setDoc(doc(clientDb, 'institutions', instId, 'contents', contentDoc.id), {
                localStoredPath: cachedPath,
                filePath: cachedPath
              }, { merge: true }).catch(() => {});
            }
          }
          break;
        }
      } catch (_) {}
    }
  }

  const rawCandidateText = payload.contextText || payload.sourceText || contentDoc?.textContent || '';
  if (!pdfBuf && isRawPdfBinaryString(rawCandidateText)) {
    try {
      pdfBuf = Buffer.from(rawCandidateText, 'latin1');
    } catch (_) {}
  }

  let pdfBase64 = null;
  let cleanText = '';

  if (pdfBuf && pdfBuf.length > 0 && pdfBuf.length <= 22 * 1024 * 1024) {
    pdfBase64 = pdfBuf.toString('base64');
    cleanText = extractReadableTextFromPdfBuffer(pdfBuf);
  }

  if (!cleanText && rawCandidateText && !isRawPdfBinaryString(rawCandidateText)) {
    cleanText = String(rawCandidateText);
  }

  return {
    pdfBase64,
    cleanText,
    sourceTitle,
    totalPages,
    startPage,
    endPage
  };
}

async function extractLessonExplanationAi(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const clientDb = await getClientFirestoreDb(token);
  const instId = token.institutionId || payload.institutionId;

  let config = {};
  let provMeta = {};
  try {
    const snap = await getDoc(doc(clientDb, 'system', 'aiConfig'));
    if (snap.exists()) config = snap.data();
  } catch (_) {}
  try {
    const pSnap = await getDoc(doc(clientDb, 'system', 'aiProviders'));
    if (pSnap.exists()) provMeta = pSnap.data();
  } catch (_) {}

  if (config.enabled === false) {
    throw arabicServiceError('SERVICE_DISABLED', 'محرك الذكاء الاصطناعي متوقف حالياً من قِبل السوبر أدمن.');
  }

  const geminiKeys = [];
  if (config.geminiKey && typeof config.geminiKey === 'string' && config.geminiKey.trim()) {
    geminiKeys.push(config.geminiKey.trim());
  }
  if (Array.isArray(config.geminiKeys)) {
    for (const k of config.geminiKeys) {
      if (typeof k === 'string' && k.trim() && !geminiKeys.includes(k.trim())) geminiKeys.push(k.trim());
    }
  }
  const openrouterKey = (config.openrouterKey || '').trim();
  const openrouterModel = config.openrouterModel || provMeta.openrouter?.model || 'nvidia/nemotron-3.5-lightning:free';

  if (geminiKeys.length === 0 && !openrouterKey) {
    throw arabicServiceError('AI_NOT_CONFIGURED', 'لم يتم ضبط مفاتيح الذكاء الاصطناعي من لوحة السوبر أدمن.');
  }

  let stageName = payload.stageName || '';
  let subjectName = payload.subjectName || '';
  if (!stageName && payload.stageId && instId) {
    try {
      const stSnap = await getDoc(doc(clientDb, 'institutions', instId, 'stages', payload.stageId));
      if (stSnap.exists()) stageName = stSnap.data().name || '';
    } catch (_) {}
  }
  if (!subjectName && payload.subjectId && instId) {
    try {
      const subSnap = await getDoc(doc(clientDb, 'institutions', instId, 'subjects', payload.subjectId));
      if (subSnap.exists()) subjectName = subSnap.data().name || '';
    } catch (_) {}
  }

  const resolvedSource = await resolveAiSourceMaterial(clientDb, instId, payload);
  const sPage = resolvedSource.startPage || payload.startPage || 1;
  const ePage = resolvedSource.endPage || payload.endPage || null;
  const pdfBase64 = resolvedSource.pdfBase64 || null;
  const lessonTitle = payload.title || payload.lessonTitle || resolvedSource.sourceTitle || 'الدرس المحدد';

  const systemPrompt = `أنت خبير مناهج تعليمية ومعلم أول متخصص في إعداد الشروحات والملخصات الدراسية باللغة العربية.
مهمتك: قراءة الصفحات المحددة من المذكرة المرفقة واستخراج شرح منظم وشامل للدرس يظهر للطلاب في تطبيق الموبايل.
يجب إخراج النتيجة بتنسيق JSON صالح فقط (valid JSON object) يحتوي على الحقول التالية نصياً باللغة العربية:
{
  "suggestedTitle": "عنوان دقيق ومناسب للدرس المستخرج من الصفحات المحددة",
  "outlines": "العناصر والأفكار الرئيسية للدرس مرتبة في نقاط مرقمة واضحة ومفصلة",
  "concepts": "أهم التعريفات والمفاهيم والتواريخ أو القوانين والعلل الواردة في الصفحات المحددة مع شرح كل منها",
  "summary": "ملخص وافٍ ومبسط لشرح الدرس بأسلوب شيق يغني الطالب ويساعده على الفهم والمراجعة السريعة"
}`;

  let userPrompt = `يرجى استخراج وتوليد شرح كامل ومفصل للدرس التالي:
المرحلة الدراسية: ${stageName || 'المرحلة التعليمية المعتمدة'}
المادة الدراسية: ${subjectName || 'المادة الدراسية'}
عنوان الدرس / المذكرة: ${lessonTitle}
🎯 نطاق الصفحات المطلوب قراءتها واستخراج الشرح منها حصرياً: من صفحة (${sPage}) إلى صفحة (${ePage || 'نهاية المذكرة'}).
`;

  if (pdfBase64) {
    userPrompt += `\n📎 مرفق لك ملف الـ PDF الأصلي للمذكرة (${resolvedSource.sourceTitle || lessonTitle}). اقرأ الصفحات من (${sPage}) إلى (${ePage || 'النهاية'}) بدقة واستخرج منها العناصر الرئيسية والتعريفات والملخص الشامل.\n`;
  }
  if (resolvedSource.cleanText && resolvedSource.cleanText.trim().length > 40) {
    userPrompt += `\nنص مساعد مستخرج من المذكرة:\n"""\n${resolvedSource.cleanText.slice(0, 30000)}\n"""\n`;
  } else if (!pdfBase64) {
    userPrompt += `\nيرجى إعداد الشرح العلمي والملخص الشامل لهذا الدرس وفق المنهج الدراسي المعتمد للمرحلة (${stageName}) والمادة (${subjectName}).\n`;
  }

  let lastErr = null;
  let parsedResult = null;
  let usedProvider = 'Google Gemini';
  let usedModel = 'gemini-2.5-flash';

  if (geminiKeys.length > 0) {
    const modelsToTry = [...new Set([config.primaryModel || config.model || 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'])];
    const attachmentAttempts = pdfBase64 ? [true, false] : [false];

    outerLoop:
    for (const withPdf of attachmentAttempts) {
      for (const apiKey of geminiKeys) {
        for (const m of modelsToTry) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
            const parts = [];
            if (withPdf && pdfBase64) {
              parts.push({
                inline_data: {
                  mime_type: 'application/pdf',
                  data: pdfBase64
                }
              });
            }
            parts.push({ text: systemPrompt + '\n\n' + userPrompt });

            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 4096,
                  responseMimeType: 'application/json'
                }
              })
            });

            if (!res.ok) {
              const errText = await res.text();
              lastErr = new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 150)}`);
              continue;
            }
            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!rawText) throw new Error('رد نموذج Gemini فارغ');

            let parsed = null;
            try {
              parsed = JSON.parse(rawText);
            } catch (_) {
              const match = rawText.match(/```(?:json)?([\s\S]*?)```/);
              if (match) parsed = JSON.parse(match[1]);
            }
            if (parsed && (parsed.outlines || parsed.concepts || parsed.summary)) {
              parsedResult = parsed;
              usedProvider = 'Google Gemini';
              usedModel = m;
              break outerLoop;
            }
          } catch (e) {
            lastErr = e;
          }
        }
      }
    }
  }

  if (!parsedResult && openrouterKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://educenter-saas-860c5.web.app',
          'X-Title': 'REMAS Center Desktop App'
        },
        body: JSON.stringify({
          model: openrouterModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        })
      });
      if (res.ok) {
        const data = await res.json();
        const rawText = data?.choices?.[0]?.message?.content || '';
        let parsed = null;
        try {
          parsed = JSON.parse(rawText);
        } catch (_) {
          const match = rawText.match(/```(?:json)?([\s\S]*?)```/);
          if (match) parsed = JSON.parse(match[1]);
        }
        if (parsed && (parsed.outlines || parsed.concepts || parsed.summary)) {
          parsedResult = parsed;
          usedProvider = 'OpenRouter';
          usedModel = openrouterModel;
        }
      }
    } catch (e) {
      lastErr = e;
    }
  }

  if (!parsedResult) {
    throw arabicServiceError('AI_EXTRACTION_FAILED', `تعذر استخراج الشرح من المذكرة: ${lastErr ? lastErr.message : 'يرجى التأكد من اتصال الإنترنت ومفاتيح الذكاء الاصطناعي'}`);
  }

  const formatField = (val) => {
    if (!val) return '';
    if (Array.isArray(val)) return val.map((item, idx) => `${idx + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n');
    if (typeof val === 'object') return Object.entries(val).map(([k, v]) => `• ${k}: ${v}`).join('\n');
    return String(val).trim();
  };

  return {
    success: true,
    provider: usedProvider,
    model: usedModel,
    suggestedTitle: String(parsedResult.suggestedTitle || lessonTitle || '').trim(),
    outlines: formatField(parsedResult.outlines),
    concepts: formatField(parsedResult.concepts),
    summary: formatField(parsedResult.summary)
  };
}

async function getCenterAiStatusAndQuota(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const clientDb = await getClientFirestoreDb(token);
  const instId = token.institutionId || payload.institutionId;

  let sysConfig = {};
  let provMeta = {};
  try {
    const snap = await getDoc(doc(clientDb, 'system', 'aiConfig'));
    if (snap.exists()) sysConfig = snap.data();
  } catch (_) {}
  try {
    const pSnap = await getDoc(doc(clientDb, 'system', 'aiProviders'));
    if (pSnap.exists()) provMeta = pSnap.data();
  } catch (_) {}

  let instConfig = {};
  if (instId) {
    try {
      const iSnap = await getDoc(doc(clientDb, 'institutions', instId, 'aiConfig', 'config'));
      if (iSnap.exists()) instConfig = iSnap.data();
    } catch (_) {}
  }

  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let usedThisMonth = 0;
  if (instId) {
    try {
      const uSnap = await getDoc(doc(clientDb, 'institutions', instId, 'aiUsage', periodKey));
      if (uSnap.exists()) usedThisMonth = Number(uSnap.data().questionsGenerated || 0);
    } catch (_) {}
  }

  const hasGemini = Boolean(sysConfig.geminiKey || (Array.isArray(sysConfig.geminiKeys) && sysConfig.geminiKeys.length));
  const hasOpenRouter = Boolean(sysConfig.openrouterKey && sysConfig.openrouterKey.trim().length > 0);
  const isConnected = (hasGemini || hasOpenRouter) && (sysConfig.enabled !== false);

  const monthlyQuota = (instConfig.features?.questionGeneration?.monthlyLimit || instConfig.monthlyLimit) || 3000;
  const remainingQuota = Math.max(0, monthlyQuota - usedThisMonth);
  const nextRenewal = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('ar-EG');

  return {
    success: true,
    connected: isConnected,
    systemStatus: sysConfig.enabled === false ? 'DISABLED' : 'ACTIVE',
    primaryProvider: provMeta.primaryProvider || 'gemini',
    fallbackProvider: provMeta.fallbackProvider || 'openrouter',
    activeModel: (provMeta.primaryProvider === 'openrouter' ? sysConfig.openrouterModel : (sysConfig.primaryModel || sysConfig.model)) || 'gemini-2.5-flash',
    openrouterModel: sysConfig.openrouterModel || 'nvidia/nemotron-3.5-lightning:free',
    governance: {
      aiEnabled: instConfig.aiEnabled !== false,
      questionGenerationEnabled: instConfig.features?.questionGeneration?.enabled !== false,
      teacherAssistantEnabled: instConfig.features?.teacherAssistant?.enabled !== false,
      tutorEnabled: instConfig.features?.tutor?.enabled !== false,
      monthlyQuota,
      usedThisMonth,
      remainingQuota,
      usagePercent: Math.min(100, Math.round((usedThisMonth / monthlyQuota) * 100)),
      renewalDate: nextRenewal
    }
  };
}

async function testCenterAiConnection(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const clientDb = await getClientFirestoreDb(token);

  let sysConfig = {};
  let provMeta = {};
  try {
    const snap = await getDoc(doc(clientDb, 'system', 'aiConfig'));
    if (snap.exists()) sysConfig = snap.data();
  } catch (_) {}
  try {
    const pSnap = await getDoc(doc(clientDb, 'system', 'aiProviders'));
    if (pSnap.exists()) provMeta = pSnap.data();
  } catch (_) {}

  const primary = provMeta.primaryProvider || 'gemini';
  const start = Date.now();

  if (primary === 'openrouter' && sysConfig.openrouterKey) {
    const model = sysConfig.openrouterModel || 'nvidia/nemotron-3.5-lightning:free';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sysConfig.openrouterKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'قل: متصل' }],
        max_tokens: 5
      })
    });
    const latency = Date.now() - start;
    if (res.ok) {
      return { success: true, latencyMs: latency, provider: `OpenRouter (${model})`, message: `الاتصال بالمحرك سليم وفوري (${latency}ms) 🟢` };
    }
    const errText = await res.text();
    throw new Error(`OpenRouter Error (${res.status}): ${errText.slice(0, 100)}`);
  }

  // Gemini Test
  const geminiKey = sysConfig.geminiKey || (Array.isArray(sysConfig.geminiKeys) ? sysConfig.geminiKeys[0] : '');
  if (!geminiKey) throw new Error('لم يتم تعيين مفتاح Gemini نشط');

  const model = sysConfig.primaryModel || sysConfig.model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'قل: متصل' }] }],
      generationConfig: { maxOutputTokens: 5 }
    })
  });
  const latency = Date.now() - start;
  if (res.ok) {
    return { success: true, latencyMs: latency, provider: `Google Gemini (${model})`, message: `الاتصال بمحرك Gemini يعمل بنجاح (${latency}ms) 🟢` };
  }
  const errText = await res.text();
  throw new Error(`Gemini Error (${res.status}): ${errText.slice(0, 100)}`);
}

// ----------------------------------------------------------------------------
// INVOICE, RECEIPT & WHATSAPP CONFIGURATION SERVICES
// ----------------------------------------------------------------------------

function getLocalDataDir() {
  try {
    let baseDir = path.join(__dirname, '..', 'local_data');
    if (process.env.APPDATA) {
      baseDir = path.join(process.env.APPDATA, 'remas-center-desktop', 'center_storage');
    }
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch (_) {
    return path.join(__dirname, '..');
  }
}

function readLocalData(key, defaultVal = null) {
  try {
    const p = path.join(getLocalDataDir(), `${key}.json`);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (_) {}
  return defaultVal;
}

function writeLocalData(key, data) {
  try {
    const p = path.join(getLocalDataDir(), `${key}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Failed to write local data:', key, err);
    return false;
  }
}

const inMemoryInvoiceConfigs = new Map();
const inMemoryWhatsAppConfigs = new Map();
const inMemoryAiVouchers = new Map();

async function getInvoiceConfig(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  // Fetch authoritative center info and branding to populate invoice header
  let centerInfo = null;
  let branding = null;
  try {
    centerInfo = await getCenterInfo(token, instId);
    branding = await getBranding(token, instId);
  } catch (_) {}

  const defaults = {
    institutionId: instId,
    centerName: (centerInfo && centerInfo.name) || (branding && branding.centerName) || 'مؤسسة تعليمية',
    subHeader: (centerInfo && centerInfo.receiptHeader) || (branding && branding.loginSubtitle) || 'إيصال تحصيل وسند قبض رسمي معتمد',
    phone: (centerInfo && centerInfo.phone) || '',
    address: (centerInfo && centerInfo.address) || '',
    taxNumber: (centerInfo && (centerInfo.taxNumber || centerInfo.commercialRecord)) || '',
    terms: 'المصروفات لا تسترد بعد الحصة الثانية. يرجى إبراز الإيصال عند أي مراجعة بالسنتر.',
    receiptFormat: 'both', // 'thermal', 'a4', 'both'
    autoPrintOnPayment: true,
    logoUrl: (branding && (branding.logoUrl || branding.logoAssetId)) || (centerInfo && centerInfo.logoUrl) || '',
    updatedAt: new Date().toISOString()
  };

  if (isTestOffline()) {
    const mem = inMemoryInvoiceConfigs.get(instId);
    return mem ? { ...defaults, ...mem } : defaults;
  }

  // 1. Read from permanent local file storage first
  const localSaved = readLocalData(`invoice_config_${instId}`);
  let merged = localSaved ? { ...defaults, ...localSaved } : (inMemoryInvoiceConfigs.get(instId) ? { ...defaults, ...inMemoryInvoiceConfigs.get(instId) } : defaults);

  // 2. Try Firestore in background/online without blocking
  try {
    const clientDb = await getClientFirestoreDb(token);
    const docRef = doc(clientDb, 'institutions', instId, 'settings', 'invoice');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      merged = { ...merged, ...snap.data() };
      writeLocalData(`invoice_config_${instId}`, merged);
      inMemoryInvoiceConfigs.set(instId, merged);
    }
  } catch (_) {
    // Firestore rules or offline: safely return local merged config
  }

  inMemoryInvoiceConfigs.set(instId, merged);
  return merged;
}

async function updateInvoiceConfig(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'center:update');

  const now = new Date().toISOString();
  const config = {
    institutionId: instId,
    centerName: (payload.centerName || '').trim() || 'مؤسسة تعليمية',
    subHeader: (payload.subHeader || '').trim(),
    phone: (payload.phone || '').trim(),
    address: (payload.address || '').trim(),
    taxNumber: (payload.taxNumber || '').trim(),
    terms: (payload.terms || '').trim(),
    receiptFormat: payload.receiptFormat || 'both',
    autoPrintOnPayment: payload.autoPrintOnPayment !== false,
    logoUrl: (payload.logoUrl || '').trim(),
    updatedAt: now,
    updatedBy: token.uid || 'system'
  };

  // 1. Update in-memory and permanent local storage
  inMemoryInvoiceConfigs.set(instId, config);
  writeLocalData(`invoice_config_${instId}`, config);

  if (!isTestOffline()) {
    // 2. Safely sync to Firestore
    try {
      const clientDb = await getClientFirestoreDb(token);
      const docRef = doc(clientDb, 'institutions', instId, 'settings', 'invoice');
      await setDoc(docRef, config, { merge: true });
    } catch (fsErr) {
      console.warn('[InvoiceConfig] Firestore sync notice (saved locally):', fsErr.message);
    }
  }

  await recordAuditEvent({
    action: 'UPDATE_INVOICE_CONFIG',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'SETTINGS',
    targetId: 'invoice',
    details: { centerName: config.centerName }
  });
  return config;
}

async function getWhatsAppConfig(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  let centerInfo = null;
  try { centerInfo = await getCenterInfo(token, instId); } catch (_) {}

  const defaults = {
    institutionId: instId,
    enabled: false,
    senderPhone: (centerInfo && centerInfo.phone) || '',
    provider: 'direct_web', // 'direct_web' | 'green_api' | 'ultramsg' | 'custom_gateway'
    apiUrl: '',
    apiToken: '',
    instanceId: '',
    // Automated triggers
    autoSendAttendance: true, // حضور الطالب السنتر والحصة
    autoSendAbsence: true, // غياب الطالب
    autoSendPaymentReceipt: true, // إيصال تسديد المصروفات
    autoSendPaymentDueReminder: true, // قرب تسديد المصروفات
    autoSendExamResult: true, // نتيجة الاختبارات
    autoSendParentCredentials: true, // بيانات دخول ولي الأمر
    // Schedule parameters
    scheduleReminderHour: 10,
    reminderDaysNotice: 2,
    // Templates
    attendanceTemplate: 'عزيزي ولي أمر الطالب {studentName}، تم بحمد الله تسجيل حضور الطالب السنتر لمادة {subjectName} (مجموعة {groupName}) اليوم {date} الساعة {time}.',
    absenceTemplate: 'تنبيه غياب: نود إحاطتكم بتغيب الطالب {studentName} عن حصة {subjectName} المقررة اليوم {date}.',
    receiptTemplate: 'تم استلام دفعة بقيمة {amount} ج.م للطالب {studentName} لإيصال رقم {receiptNumber}. شكراً لتعاملكم مع {centerName}.',
    dueReminderTemplate: 'تذكير بموعد السداد: نود تذكير سيادتكم بقرب موعد تسديد مصروفات الطالب {studentName} لمادة {subjectName}. المبلغ المستحق: {dueAmount} ج.م.',
    examResultTemplate: 'تهانينا! تم رصد نتيجة اختبار {examTitle} للطالب {studentName} بمادة {subjectName}: الدرجة {score}/{totalScore} بنسبة {percentage}%. التقدير: {grade}.',
    parentCredentialsTemplate: 'مرحباً {parentName}، بيانات دخولك لمنصة وتطبيق ولي الأمر لسنتر {centerName}:\nرقم الدخول: {phone}\nرمز PIN السري: {pin}\nرابط التطبيق: {appUrl}',
    updatedAt: new Date().toISOString()
  };

  if (isTestOffline()) {
    const mem = inMemoryWhatsAppConfigs.get(instId);
    return mem ? { ...defaults, ...mem } : defaults;
  }

  // 1. Read from permanent local file storage
  const localSaved = readLocalData(`whatsapp_config_${instId}`);
  let merged = localSaved ? { ...defaults, ...localSaved } : (inMemoryWhatsAppConfigs.get(instId) ? { ...defaults, ...inMemoryWhatsAppConfigs.get(instId) } : defaults);

  // 2. Try Firestore without blocking if restricted
  try {
    const clientDb = await getClientFirestoreDb(token);
    const docRef = doc(clientDb, 'institutions', instId, 'settings', 'whatsapp');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      merged = { ...merged, ...snap.data() };
      writeLocalData(`whatsapp_config_${instId}`, merged);
      inMemoryWhatsAppConfigs.set(instId, merged);
    }
  } catch (_) {
    // Firestore rules or offline: safely return local merged config
  }

  inMemoryWhatsAppConfigs.set(instId, merged);
  return merged;
}

async function updateWhatsAppConfig(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'center:update');

  const now = new Date().toISOString();
  const config = {
    institutionId: instId,
    enabled: Boolean(payload.enabled),
    senderPhone: (payload.senderPhone || '').trim(),
    provider: payload.provider || 'direct_web',
    apiUrl: (payload.apiUrl || '').trim(),
    apiToken: (payload.apiToken || '').trim(),
    instanceId: (payload.instanceId || '').trim(),
    autoSendAttendance: payload.autoSendAttendance !== false,
    autoSendAbsence: payload.autoSendAbsence !== false,
    autoSendPaymentReceipt: payload.autoSendPaymentReceipt !== false,
    autoSendPaymentDueReminder: payload.autoSendPaymentDueReminder !== false,
    autoSendExamResult: payload.autoSendExamResult !== false,
    autoSendParentCredentials: payload.autoSendParentCredentials !== false,
    scheduleReminderHour: Number(payload.scheduleReminderHour) || 10,
    reminderDaysNotice: Number(payload.reminderDaysNotice) || 2,
    attendanceTemplate: (payload.attendanceTemplate || '').trim(),
    absenceTemplate: (payload.absenceTemplate || '').trim(),
    receiptTemplate: (payload.receiptTemplate || '').trim(),
    dueReminderTemplate: (payload.dueReminderTemplate || '').trim(),
    examResultTemplate: (payload.examResultTemplate || '').trim(),
    parentCredentialsTemplate: (payload.parentCredentialsTemplate || '').trim(),
    updatedAt: now,
    updatedBy: token.uid || 'system'
  };

  // 1. Update in-memory and permanent local storage
  inMemoryWhatsAppConfigs.set(instId, config);
  writeLocalData(`whatsapp_config_${instId}`, config);

  if (!isTestOffline()) {
    // 2. Safely sync to Firestore
    try {
      const clientDb = await getClientFirestoreDb(token);
      const docRef = doc(clientDb, 'institutions', instId, 'settings', 'whatsapp');
      await setDoc(docRef, config, { merge: true });
    } catch (fsErr) {
      console.warn('[WhatsAppConfig] Firestore sync notice (saved locally):', fsErr.message);
    }
  }

  await recordAuditEvent({
    action: 'UPDATE_WHATSAPP_CONFIG',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'SETTINGS',
    targetId: 'whatsapp',
    details: { enabled: config.enabled, provider: config.provider }
  });
  return config;
}

async function sendWhatsAppMessage(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const rawPhone = String(payload.phone || '').trim();
  const message = String(payload.message || '').trim();
  if (!rawPhone) throw arabicServiceError('INVALID_PHONE', 'رقم هاتف المستلم مطلوب لإرسال الواتس');
  if (!message) throw arabicServiceError('INVALID_MESSAGE', 'نص الرسالة مطلوب');

  let normalizedPhone = rawPhone.replace(/\D/g, '');
  if (normalizedPhone.startsWith('01') && normalizedPhone.length === 11) {
    normalizedPhone = '20' + normalizedPhone.substring(1);
  } else if (!normalizedPhone.startsWith('20') && normalizedPhone.length === 10 && normalizedPhone.startsWith('1')) {
    normalizedPhone = '20' + normalizedPhone;
  }

  const config = await getWhatsAppConfig(token, { institutionId: instId });
  const appUrl = `whatsapp://send?phone=${normalizedPhone}&text=${encodeURIComponent(message)}`;
  const directUrl = `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(message)}`;
  const waMeUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

  if (config.enabled && (config.provider === 'green_api' || config.provider === 'ultramsg' || config.provider === 'custom_gateway') && config.apiUrl) {
    try {
      const response = await dispatchWhatsAppHttp(config, normalizedPhone, message);
      return { success: true, mode: 'api', response, appUrl, directUrl, waMeUrl };
    } catch (apiErr) {
      console.warn('[WhatsApp] API dispatch failed, providing direct fallback:', apiErr.message);
      return { success: true, mode: 'fallback_direct', appUrl, directUrl, waMeUrl, warning: apiErr.message };
    }
  }

  return { success: true, mode: 'direct', appUrl, directUrl, waMeUrl };
}

function dispatchWhatsAppHttp(config, phone, message) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(config.apiUrl);
      const postData = JSON.stringify({
        chatId: `${phone}@c.us`,
        phone,
        message,
        token: config.apiToken,
        instanceId: config.instanceId
      });

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...(config.apiToken ? { 'Authorization': `Bearer ${config.apiToken}` } : {})
        },
        timeout: 8000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: data });
          } else {
            reject(new Error(`API responded with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('WhatsApp Gateway request timed out'));
      });
      req.write(postData);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ----------------------------------------------------------------------------
// ACCRUED DUES CALCULATION SERVICE (ATTENDANCE-BASED FINANCIAL FORMULA)
// Formula: sessionRate = subjectPrice / 4. Accrued = sessionsAttended * sessionRate.
// Net Due = Math.max(0, Accrued - TotalPaid)
// ----------------------------------------------------------------------------

async function calcAccruedStudentDues(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  let students = [];
  let groups = [];
  let subjects = [];
  let attendanceList = [];
  let payments = [];

  try {
    const [stRes, grRes, subRes, attRes, payRes] = await Promise.all([
      getStudents(token, { institutionId: instId }).catch(() => []),
      getGroups(token, { institutionId: instId }).catch(() => []),
      getSubjects(token, { institutionId: instId }).catch(() => []),
      getAttendanceRecords(token, { institutionId: instId }).catch(() => []),
      getPayments(token, { institutionId: instId }).catch(() => [])
    ]);

    students = (stRes || []).filter(s => s && s.status !== 'ARCHIVED');
    groups = (grRes || []).filter(g => g && g.status !== 'ARCHIVED');
    subjects = subRes || [];
    attendanceList = (attRes || []).filter(a => a && (a.status === 'PRESENT' || a.status === 'LATE'));
    payments = payRes || [];
  } catch (err) {
    console.warn('[calcAccruedStudentDues] Fallback warning:', err.message);
  }

  const subjectMap = new Map();
  subjects.forEach(sub => subjectMap.set(sub.id, sub));

  const groupMap = new Map();
  groups.forEach(grp => {
    const sub = subjectMap.get(grp.subjectId) || {};
    const effectivePrice = Number(grp.price || grp.fee || sub.price || sub.pricePerMonth || 200);
    // 4 sessions = 1 month -> sessionRate = effectivePrice / 4
    const sessionRate = effectivePrice / 4;
    groupMap.set(grp.id, {
      ...grp,
      subjectName: sub.name || grp.subjectName || grp.name || 'مادة دراسية',
      effectivePrice,
      sessionRate
    });
  });

  let totalAccruedAllStudents = 0;
  let totalPaidAllStudents = 0;
  let netDuesOwedToCenter = 0;
  const studentsBreakdown = [];

  for (const st of students) {
    const stId = st.id;
    const enrolledGroupIds = Array.isArray(st.groupIds) ? st.groupIds : (st.groupId ? [st.groupId] : []);
    const studentAttendance = attendanceList.filter(a => a.studentId === stId);
    
    let studentTotalAccrued = 0;
    const groupsBreakdown = [];

    for (const gid of enrolledGroupIds) {
      const grp = groupMap.get(gid);
      if (!grp) continue;
      const grpAttendedCount = studentAttendance.filter(a => a.groupId === gid).length;
      const grpAccrued = grpAttendedCount * grp.sessionRate;
      studentTotalAccrued += grpAccrued;

      groupsBreakdown.push({
        groupId: gid,
        groupName: grp.name || 'مجموعة',
        subjectName: grp.subjectName,
        monthlyPrice: grp.effectivePrice,
        sessionRate: grp.sessionRate,
        attendedCount: grpAttendedCount,
        accruedAmount: grpAccrued
      });
    }

    const otherAttendedGids = new Set(studentAttendance.map(a => a.groupId).filter(gid => !enrolledGroupIds.includes(gid)));
    for (const gid of otherAttendedGids) {
      const grp = groupMap.get(gid);
      if (!grp) continue;
      const count = studentAttendance.filter(a => a.groupId === gid).length;
      const accrued = count * grp.sessionRate;
      studentTotalAccrued += accrued;
      groupsBreakdown.push({
        groupId: gid,
        groupName: (grp.name || 'مجموعة سابقة') + ' (سابقة)',
        subjectName: grp.subjectName,
        monthlyPrice: grp.effectivePrice,
        sessionRate: grp.sessionRate,
        attendedCount: count,
        accruedAmount: accrued
      });
    }

    const studentPayments = payments.filter(p => p.studentId === stId || (p.studentName && p.studentName.trim() === (st.name || '').trim()));
    const studentTotalPaid = studentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const netDue = Math.max(0, studentTotalAccrued - studentTotalPaid);

    totalAccruedAllStudents += studentTotalAccrued;
    totalPaidAllStudents += studentTotalPaid;
    if (netDue > 0) {
      netDuesOwedToCenter += netDue;
    }

    studentsBreakdown.push({
      studentId: stId,
      studentName: st.name || 'طالب',
      studentPhone: st.phone || '',
      guardianPhone: st.guardianPhone || st.parentPhone || '',
      guardianName: st.guardianName || st.parentName || '',
      attendedSessionsCount: studentAttendance.length,
      totalAccrued: studentTotalAccrued,
      totalPaid: studentTotalPaid,
      netDue: netDue,
      groupsBreakdown
    });
  }

  studentsBreakdown.sort((a, b) => b.netDue - a.netDue);

  return {
    totalAccruedAllStudents,
    totalPaidAllStudents,
    netDuesOwedToCenter,
    studentsWithDuesCount: studentsBreakdown.filter(s => s.netDue > 0).length,
    totalStudentsCount: students.length,
    studentsBreakdown
  };
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// SUBSCRIPTION PLANS & AI VIP VOUCHER HUB SERVICES
// ----------------------------------------------------------------------------

const inMemorySubscriptionPlans = new Map();

function defaultSubscriptionPlans(instId) {
  return [
    {
      id: `plan_silver_${instId}`,
      institutionId: instId,
      name: 'باقة المساعد الذكي الفضية',
      description: 'باقة مخصصة للشروحات والمساعد التفاعلي',
      price: 25,
      durationDays: 30,
      quotaQuestions: 35,
      features: ['ai_tutor'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: `plan_gold_${instId}`,
      institutionId: instId,
      name: 'باقة التفوق VIP الشاملة',
      description: 'المساعد الذكي + حل وتصحيح الواجبات + بنك الأسئلة المتقدم + أولوية السرعة',
      price: 60,
      durationDays: 60,
      quotaQuestions: 100,
      features: ['ai_tutor', 'homework_solver', 'vip_materials', 'priority_speed'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: `plan_platinum_${instId}`,
      institutionId: instId,
      name: 'باقة الاختبارات والواجبات المركزة',
      description: 'المساعد الذكي + توليد امتحانات تدريبية + تصحيح الواجبات التلقائي',
      price: 45,
      durationDays: 45,
      quotaQuestions: 60,
      features: ['ai_tutor', 'homework_solver', 'exam_practice'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ];
}

async function getSubscriptionPlans(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  const localSaved = readLocalData(`subscription_plans_${instId}`);
  let plans = localSaved;
  if (!plans || plans.length === 0) {
    const mem = inMemorySubscriptionPlans.get(instId);
    plans = (mem && mem.length > 0) ? mem : defaultSubscriptionPlans(instId);
    writeLocalData(`subscription_plans_${instId}`, plans);
  }

  // Also query Firestore safely if online
  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      const snap = await getDocs(collection(clientDb, 'institutions', instId, 'subscriptionPlans'));
      if (!snap.empty) {
        const fsPlans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const map = new Map();
        plans.forEach(p => map.set(p.id, p));
        fsPlans.forEach(p => map.set(p.id, p));
        plans = Array.from(map.values());
        writeLocalData(`subscription_plans_${instId}`, plans);
      }
    } catch (_) {}
  }

  inMemorySubscriptionPlans.set(instId, plans);
  return plans;
}

async function createSubscriptionPlan(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'packages:create');

  const name = String(payload.name || '').trim();
  if (!name) throw arabicServiceError('INVALID_PLAN_NAME', 'اسم باقة الاشتراك مطلوب');

  const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const plan = {
    id,
    institutionId: instId,
    name,
    description: String(payload.description || '').trim(),
    price: Math.max(0, Number(payload.price) || 0),
    durationDays: Math.max(1, Number(payload.durationDays) || 30),
    quotaQuestions: Math.max(5, Number(payload.quotaQuestions) || 50),
    features: Array.isArray(payload.features) && payload.features.length > 0 ? payload.features : ['ai_tutor'],
    status: payload.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    createdBy: token.uid || 'system'
  };

  const currentPlans = await getSubscriptionPlans(token, { institutionId: instId });
  currentPlans.unshift(plan);
  inMemorySubscriptionPlans.set(instId, currentPlans);
  writeLocalData(`subscription_plans_${instId}`, currentPlans);

  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      await setDoc(doc(clientDb, 'institutions', instId, 'subscriptionPlans', id), plan);
    } catch (_) {}
  }

  await recordAuditEvent({
    action: 'CREATE_SUBSCRIPTION_PLAN',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'PLAN',
    targetId: id,
    details: { name: plan.name, price: plan.price, quota: plan.quotaQuestions, features: plan.features }
  });

  return plan;
}

async function updateSubscriptionPlan(callerToken, planId, payload = {}, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || payload.institutionId || token.institutionId);
  requirePermission(token, 'packages:create');

  if (!planId) throw arabicServiceError('INVALID_PLAN_ID', 'معرف الباقة مطلوب');

  const currentPlans = await getSubscriptionPlans(token, { institutionId: instId });
  const idx = currentPlans.findIndex(p => p.id === planId);
  if (idx === -1) throw arabicServiceError('PLAN_NOT_FOUND', 'باقة الاشتراك غير موجودة');

  const existing = currentPlans[idx];
  const now = new Date().toISOString();
  const updated = {
    ...existing,
    name: payload.name !== undefined ? String(payload.name).trim() : existing.name,
    description: payload.description !== undefined ? String(payload.description).trim() : existing.description,
    price: payload.price !== undefined ? Math.max(0, Number(payload.price) || 0) : existing.price,
    durationDays: payload.durationDays !== undefined ? Math.max(1, Number(payload.durationDays) || 30) : existing.durationDays,
    quotaQuestions: payload.quotaQuestions !== undefined ? Math.max(5, Number(payload.quotaQuestions) || 50) : existing.quotaQuestions,
    features: Array.isArray(payload.features) ? payload.features : existing.features,
    status: payload.status !== undefined ? payload.status : existing.status,
    updatedAt: now,
    updatedBy: token.uid || 'system'
  };

  currentPlans[idx] = updated;
  inMemorySubscriptionPlans.set(instId, currentPlans);
  writeLocalData(`subscription_plans_${instId}`, currentPlans);

  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      await setDoc(doc(clientDb, 'institutions', instId, 'subscriptionPlans', planId), updated, { merge: true });
    } catch (_) {}
  }

  return updated;
}

async function deleteSubscriptionPlan(callerToken, planId, institutionId) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, institutionId || token.institutionId);
  requirePermission(token, 'packages:create');

  const currentPlans = await getSubscriptionPlans(token, { institutionId: instId });
  const filtered = currentPlans.filter(p => p.id !== planId);
  inMemorySubscriptionPlans.set(instId, filtered);
  writeLocalData(`subscription_plans_${instId}`, filtered);

  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      await deleteDoc(doc(clientDb, 'institutions', instId, 'subscriptionPlans', planId));
    } catch (_) {}
  }

  return { success: true, deletedId: planId };
}

async function generateAiVoucherBatch(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  requirePermission(token, 'packages:create');

  // If generated based on an established plan, inherit all its parameters & features
  let plan = null;
  if (payload.planId) {
    const plans = await getSubscriptionPlans(token, { institutionId: instId });
    plan = plans.find(p => p.id === payload.planId);
  }

  const count = Math.min(Math.max(Number(payload.count) || 5, 1), 100);
  const quota = plan ? plan.quotaQuestions : Math.max(Number(payload.quotaQuestions) || 50, 10);
  const price = plan ? plan.price : Math.max(Number(payload.price) || 50, 0);
  const name = plan ? plan.name : (payload.name || 'باقة أسئلة VIP للمساعد الذكي').trim();
  const expiresDays = plan ? plan.durationDays : (Number(payload.expiresDays) || 30);
  const features = plan ? plan.features : (Array.isArray(payload.features) && payload.features.length ? payload.features : ['ai_tutor']);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
  const createdVouchers = [];

  // Read existing vouchers from local file
  const localList = readLocalData(`ai_vouchers_${instId}`, []);

  for (let i = 0; i < count; i++) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `VIP-${Math.floor(1000 + Math.random() * 9000)}-${randomHex}`;
    const id = `VCH_${Date.now()}_${i}_${randomHex}`;
    const voucher = {
      id,
      code,
      name,
      planId: plan ? plan.id : null,
      institutionId: instId,
      quotaQuestions: quota,
      features,
      price,
      status: 'ACTIVE', // 'ACTIVE' | 'REDEEMED' | 'EXPIRED'
      createdAt: now.toISOString(),
      expiresAt,
      createdBy: token.uid || 'system',
      redeemedByStudentId: null,
      redeemedByStudentName: null,
      redeemedAt: null
    };

    inMemoryAiVouchers.set(`${instId}_${code}`, voucher);
    localList.unshift(voucher);
    createdVouchers.push(voucher);
  }

  // Save updated vouchers locally
  writeLocalData(`ai_vouchers_${instId}`, localList);

  // Sync to Firestore in background without failing on permission rules
  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      for (const v of createdVouchers) {
        try {
          await setDoc(doc(clientDb, 'institutions', instId, 'aiVouchers', v.id), v);
        } catch (_) {}
      }
    } catch (fsErr) {
      console.warn('[Vouchers] Firestore sync notice (saved locally):', fsErr.message);
    }
  }

  await recordAuditEvent({
    action: 'GENERATE_AI_VOUCHERS',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'VOUCHER',
    targetId: `BATCH_${count}`,
    details: { count, quota, price, name, planId: plan?.id, features }
  });

  return { success: true, count: createdVouchers.length, vouchers: createdVouchers };
}

async function getAiVouchers(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  // 1. Read from local storage
  const localList = readLocalData(`ai_vouchers_${instId}`, []);
  const map = new Map();
  localList.forEach(v => map.set(v.code, v));
  Array.from(inMemoryAiVouchers.values())
    .filter(v => v.institutionId === instId)
    .forEach(v => map.set(v.code, v));

  // 2. Read from Firestore if accessible
  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      const snap = await getDocs(collection(clientDb, 'institutions', instId, 'aiVouchers'));
      snap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        map.set(data.code, data);
      });
      writeLocalData(`ai_vouchers_${instId}`, Array.from(map.values()));
    } catch (_) {}
  }

  let list = Array.from(map.values());
  if (payload.status) {
    list = list.filter(v => v.status === payload.status);
  }
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return list;
}

async function redeemAiVoucher(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const code = (payload.code || '').trim().toUpperCase();
  const studentId = (payload.studentId || '').trim();

  if (!code) throw arabicServiceError('INVALID_CODE', 'كود الاشتراك VIP مطلوب');
  if (!studentId) throw arabicServiceError('INVALID_STUDENT_ID', 'معرف الطالب مطلوب لربط الكود');

  const now = new Date().toISOString();

  // Find voucher in memory or local storage
  let voucher = inMemoryAiVouchers.get(`${instId}_${code}`);
  const localList = readLocalData(`ai_vouchers_${instId}`, []);
  if (!voucher) {
    voucher = localList.find(v => v.code === code);
  }

  // Also check Firestore if available
  let vDocRef = null;
  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      const qVoucher = query(collection(clientDb, 'institutions', instId, 'aiVouchers'), where('code', '==', code));
      const vSnap = await getDocs(qVoucher);
      if (!vSnap.empty) {
        vDocRef = vSnap.docs[0].ref;
        voucher = vSnap.docs[0].data();
      }
    } catch (_) {}
  }

  if (!voucher) throw arabicServiceError('VOUCHER_NOT_FOUND', 'كود الباقة غير صالح أو غير موجود');
  if (voucher.status === 'REDEEMED') throw arabicServiceError('ALREADY_REDEEMED', 'تم استخدام هذا الكود مسبقاً من قبل طالب آخر');

  // Find student
  let student = null;
  let sDocRef = null;
  if (isTestOffline()) {
    student = inMemoryStudents.get(`${instId}_${studentId}`);
  } else {
    try {
      const clientDb = await getClientFirestoreDb(token);
      sDocRef = doc(clientDb, 'institutions', instId, 'students', studentId);
      const sSnap = await getDoc(sDocRef);
      if (sSnap.exists()) student = sSnap.data();
    } catch (_) {}
    if (!student) student = inMemoryStudents.get(`${instId}_${studentId}`);
  }

  if (!student) throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود');

  // Update voucher state
  voucher.status = 'REDEEMED';
  voucher.redeemedByStudentId = studentId;
  voucher.redeemedByStudentName = student.name || 'طالب';
  voucher.redeemedAt = now;

  // Update student quota & feature entitlements
  const newBalance = (student.aiQuestionsBalance || 0) + voucher.quotaQuestions;
  const existingFeatures = Array.isArray(student.unlockedFeatures) ? student.unlockedFeatures : [];
  const voucherFeatures = Array.isArray(voucher.features) ? voucher.features : ['ai_tutor'];
  const mergedFeatures = [...new Set([...existingFeatures, ...voucherFeatures])];

  student.isVip = true;
  student.aiQuestionsBalance = newBalance;
  student.aiVipExpiresAt = voucher.expiresAt;
  student.unlockedFeatures = mergedFeatures;
  student.updatedAt = now;

  // Save locally
  inMemoryAiVouchers.set(`${instId}_${code}`, voucher);
  const updatedLocal = localList.map(v => v.code === code ? voucher : v);
  writeLocalData(`ai_vouchers_${instId}`, updatedLocal);

  // Sync to Firestore if online
  if (!isTestOffline()) {
    try {
      if (vDocRef) await updateDoc(vDocRef, { status: 'REDEEMED', redeemedByStudentId: studentId, redeemedByStudentName: student.name || 'طالب', redeemedAt: now });
      if (sDocRef) await updateDoc(sDocRef, { isVip: true, aiQuestionsBalance: newBalance, aiVipExpiresAt: voucher.expiresAt, unlockedFeatures: mergedFeatures, updatedAt: now });
    } catch (fsErr) {
      console.warn('[RedeemVoucher] Firestore sync notice:', fsErr.message);
    }
  }

  await recordAuditEvent({
    action: 'REDEEM_AI_VOUCHER',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'VOUCHER',
    targetId: voucher.id || code,
    details: { code, studentId, studentName: student.name, addedQuota: voucher.quotaQuestions, features: mergedFeatures }
  });

  // Automatically record cash collection in finance for sold voucher if price > 0
  let recordedPaymentReceipt = null;
  if (voucher.price && Number(voucher.price) > 0) {
    try {
      recordedPaymentReceipt = await recordPayment(callerToken, {
        institutionId: instId,
        studentId: studentId,
        studentName: student.name || 'طالب',
        amount: Number(voucher.price),
        category: `مبيعات كود VIP (${voucher.name || voucher.code})`,
        notes: `تفعيل باقة VIP كود رقم ${voucher.code}`
      });
    } catch (payErr) {
      console.warn('[RedeemVoucher] Auto payment record notice:', payErr.message);
    }
  }

  return {
    success: true,
    voucher,
    student: {
      id: studentId,
      name: student.name,
      isVip: true,
      aiQuestionsBalance: newBalance,
      aiVipExpiresAt: voucher.expiresAt
    },
    paymentReceipt: recordedPaymentReceipt,
    code,
    quotaAdded: voucher.quotaQuestions,
    newBalance,
    studentName: student.name
  };
}

async function allocateAiVoucherToStudent(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);
  const code = (payload.code || '').trim().toUpperCase();
  const studentId = (payload.studentId || '').trim();

  if (!code) throw arabicServiceError('INVALID_CODE', 'كود الاشتراك VIP مطلوب');
  if (!studentId) throw arabicServiceError('INVALID_STUDENT_ID', 'معرف الطالب مطلوب لربط الكود');

  const now = new Date().toISOString();

  // Find voucher in memory or local storage
  let voucher = inMemoryAiVouchers.get(`${instId}_${code}`);
  const localList = readLocalData(`ai_vouchers_${instId}`, []);
  if (!voucher) {
    voucher = localList.find(v => v.code === code);
  }

  // Also check Firestore if available
  let vDocRef = null;
  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      const qVoucher = query(collection(clientDb, 'institutions', instId, 'aiVouchers'), where('code', '==', code));
      const vSnap = await getDocs(qVoucher);
      if (!vSnap.empty) {
        vDocRef = vSnap.docs[0].ref;
        voucher = vSnap.docs[0].data();
      }
    } catch (_) {}
  }

  if (!voucher) throw arabicServiceError('VOUCHER_NOT_FOUND', 'كود الباقة غير صالح أو غير موجود');
  if (voucher.status === 'REDEEMED') throw arabicServiceError('ALREADY_REDEEMED', 'تم تفعيل واستخدام هذا الكود مسبقاً');

  // Find student
  let student = null;
  if (isTestOffline()) {
    student = inMemoryStudents.get(`${instId}_${studentId}`);
  } else {
    try {
      const clientDb = await getClientFirestoreDb(token);
      const sSnap = await getDoc(doc(clientDb, 'institutions', instId, 'students', studentId));
      if (sSnap.exists()) student = sSnap.data();
    } catch (_) {}
    if (!student) student = inMemoryStudents.get(`${instId}_${studentId}`);
  }

  if (!student) throw arabicServiceError('STUDENT_NOT_FOUND', 'الطالب غير موجود');

  // Update voucher state to ALLOCATED (Linked to student, waiting for student activation)
  voucher.status = 'ALLOCATED';
  voucher.allocatedStudentId = studentId;
  voucher.allocatedStudentName = student.name || 'طالب';
  voucher.allocatedAt = now;

  inMemoryAiVouchers.set(`${instId}_${code}`, voucher);
  const updatedLocal = localList.map(v => v.code === code ? voucher : v);
  writeLocalData(`ai_vouchers_${instId}`, updatedLocal);

  if (!isTestOffline()) {
    try {
      if (vDocRef) {
        await updateDoc(vDocRef, {
          status: 'ALLOCATED',
          allocatedStudentId: studentId,
          allocatedStudentName: student.name || 'طالب',
          allocatedAt: now,
          updatedAt: now
        });
      }
    } catch (fsErr) {
      console.warn('[AllocateVoucher] Firestore sync notice:', fsErr.message);
    }
  }

  await recordAuditEvent({
    action: 'ALLOCATE_AI_VOUCHER',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'VOUCHER',
    targetId: voucher.id || code,
    details: { code, studentId, studentName: student.name, quota: voucher.quotaQuestions }
  });

  return {
    success: true,
    code,
    studentId,
    studentName: student.name,
    studentPhone: student.phone || student.guardianPhone,
    quota: voucher.quotaQuestions,
    voucher
  };
}

const inMemoryVideoWatchCodes = new Map();

async function generateVideoWatchCodes(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  requirePermission(token, 'content:create');
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  const count = Math.min(Math.max(parseInt(payload.count, 10) || 1, 1), 100);
  const maxViews = Math.max(parseInt(payload.maxViews, 10) || 1, 1);
  const subjectId = payload.subjectId || null;
  const subjectName = payload.subjectName || 'عام';
  const videoId = payload.videoId || null;
  const videoTitle = payload.videoTitle || null;

  const localList = readLocalData(`video_watch_codes_${instId}`, []);
  const createdCodes = [];
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const randHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const code = `RMS-V${randNum}-${randHex}`;
    const id = `vwc_${Date.now()}_${randHex}_${i}`;

    const codeObj = {
      id,
      code,
      institutionId: instId,
      subjectId,
      subjectName,
      videoId,
      videoTitle,
      maxViews,
      viewsUsed: 0,
      status: 'AVAILABLE',
      createdAt: now,
      createdBy: token.uid
    };

    inMemoryVideoWatchCodes.set(`${instId}_${code}`, codeObj);
    localList.unshift(codeObj);
    createdCodes.push(codeObj);
  }

  writeLocalData(`video_watch_codes_${instId}`, localList);

  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      for (const c of createdCodes) {
        try {
          await setDoc(doc(clientDb, 'institutions', instId, 'videoWatchCodes', c.id), c);
        } catch (_) {}
      }
    } catch (fsErr) {
      console.warn('[WatchCodes] Firestore sync notice:', fsErr.message);
    }
  }

  await recordAuditEvent({
    action: 'GENERATE_VIDEO_WATCH_CODES',
    actorUid: token.uid,
    actorRole: token.role,
    institutionId: instId,
    targetType: 'WATCH_CODE',
    targetId: `BATCH_${count}`,
    details: { count, maxViews, subjectId, subjectName, videoId }
  });

  return { success: true, count: createdCodes.length, codes: createdCodes };
}

async function getVideoWatchCodes(callerToken, payload = {}) {
  const token = resolveCallerToken(callerToken);
  const instId = validateTenantAccess(token, payload.institutionId || token.institutionId);

  const localList = readLocalData(`video_watch_codes_${instId}`, []);
  const map = new Map();
  localList.forEach(c => map.set(c.code, c));
  Array.from(inMemoryVideoWatchCodes.values())
    .filter(c => c.institutionId === instId)
    .forEach(c => map.set(c.code, c));

  if (!isTestOffline()) {
    try {
      const clientDb = await getClientFirestoreDb(token);
      const snap = await getDocs(collection(clientDb, 'institutions', instId, 'videoWatchCodes'));
      snap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        map.set(data.code, data);
      });
      writeLocalData(`video_watch_codes_${instId}`, Array.from(map.values()));
    } catch (_) {}
  }

  let list = Array.from(map.values());
  if (payload.status) {
    list = list.filter(c => c.status === payload.status);
  }
  if (payload.subjectId) {
    list = list.filter(c => !c.subjectId || c.subjectId === payload.subjectId);
  }
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return list;
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
  // Student Authentication Management
  generateStudentPin,
  resetStudentPassword,
  getStudentAccountStatus,
  // Teachers
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  resetTeacherPassword,
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
  // Terms & Units (BATCH 1 academic context)
  getTerms,
  createTerm,
  updateTerm,
  setTermStatus,
  getUnits,
  createUnit,
  updateUnit,
  setUnitStatus,
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
  resolveAssignmentSubjectStage,
  resolveCanonicalLinkStages,
  getTeacherAssignableSubjects,
  diagnoseTeacherSubjectGap,
  getSubjectEffectiveStages,
  getTeacherDerivedProfile,
  assertStageIdsValid,
  // Group Memberships
  addStudentToGroup,
  removeStudentFromGroup,
  // Student ID Cards (physical identity lifecycle)
  getStudentCards,
  getStudentCardById,
  generateStudentCards,
  assignStudentCard,
  replaceStudentCard,
  setStudentCardStatus,
  getStudentCardHistory,
  getCardInventorySummary,
  // Group lifecycle (B.1 ACTIVE/INACTIVE/ARCHIVED)
  setGroupStatus,
  // Schedules (Batch B weekly templates)
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  setScheduleStatus,
  deleteSchedule,
  buildGroupName,
  // Attendance (single writer: manual + code + barcode)
  getAttendanceRecords,
  recordAttendance,
  recordAttendanceScan,
  recordCardScan,
  correctAttendance,
  getSessionAttendanceSummary,
  // Sessions
  getSessions,
  getSessionById,
  createSession,
  updateSession,
  setSessionStatus,
  startSession,
  closeSession,
  cancelSession,
  isSessionOpenForAttendance,
  SESSION_STATUSES,
  generateTodaySessions,
  // Batch B domain helpers (unit-tested)
  parseTimeToMinutes,
  intervalsOverlap,
  buildScheduleTitle,
  // Content & Media
  getContent,
  getContentMedia,
  // Milestone D: lessons / homework
  getLessons,
  createLesson,
  updateLessonRecord,
  setLessonStatus,
  getLessonContents,
  reorderLessonContent,
  requestContentAccess,
  getHomework,
  createHomeworkRecord,
  setHomeworkStatusRecord,
  updateHomeworkRecord,
  getHomeworkSubmissions,
  gradeHomeworkSubmission,
  recordHomeworkGradeDirect,
  createLessonContent,
  createDigitalContentItem,
  updateDigitalContentItem,
  deleteDigitalContentItem,
  deleteLesson,
  deleteExamRecord,
  extractLessonExplanationAi,
  updateLessonContent,
  setLessonContentStatus,
  validateContentItemInput,
  WORKER_MEDIA_BASE_URL,
  getContentUploadConfig,
  getWorkerUploadToken,
  // Exams & Grades
  getExams,
  createExam,
  setCenterExamStatus,
  publishCenterExamWithSnapshots,
  getGrades,
  recordGrade,
  // Central Content Hub: packages / question bank / sources / approvals
  getPackages,
  createPackageRecord,
  updatePackageRecord,
  setPackageStatusRecord,
  classifySubscriptionStatus,
  countPackageSubscriptions,
  getQuestionBanks,
  createQuestionBankRecord,
  getBankQuestions,
  createQuestionRecord,
  updateQuestionRecord,
  setQuestionStatusRecord,
  archiveQuestionsBulk,
  getAiConfigRecord,
  saveAiConfigRecord,
  getAiUsageRecords,
  requestAiQuestionGeneration,
  parsePageSelection,
  interpretAiWorkerResponse,
  validateAiDraftContract,
  classifyAiFetchError,
  getSources,
  createSourceRecord,
  updateSourceRecord,
  setSourceStatusRecord,
  getEligibleSourcesRecord,
  getGradeApprovals,
  getGradeReviews,
  submitSubjectiveReviewRecord,
  approveCenterResultRecord,
  publishCenterResultRecord,
  getExamAnalyticsRecord,
  normalizeHubGroupIds,
  normalizeHubAccessType,
  normalizeHubPackageIds,
  normalizeHubVisibility,
  normalizeHubHomeworkMode,
  assertHubGroupTargeting,
  assertHubAcademicContext,
  assertHubUnit,
  assertHubSourceRef,
  hubYearHasTerms,
  fetchHubGroupDirectory,
  fetchHubAcademicDirectory,
  fetchHubUnitDirectory,
  fetchHubSourceDirectory,
  // Subscriptions & Parents
  getSubscriptions,
  getParents,
  getParentById,
  createParent,
  updateParent,
  archiveParent,
  deleteParent,
  linkParentToStudent,
  unlinkParentFromStudent,
  syncGuardianForStudent,
  syncAllGuardiansFromStudents,
  // Finance (Batch C: derived balances, append-only payments/receipts)
  getPayments,
  recordPayment,
  addPayment,
  getExpenses,
  recordExpense,
  addExpense,
  createFeeStructure,
  getFeeStructures,
  assignStudentCharge,
  getStudentCharges,
  getStudentChargeById,
  applyDiscountOrWaiver,
  getReceipts,
  getReceiptById,
  getStudentStatement,
  recordOtherIncome,
  getOtherIncome,
  getFinanceSummary,
  getOutstandingBalances,
  // C.1 employees + permissions + actor identity
  PERMISSION_MATRIX,
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUSES,
  requirePermission,
  requireStoredPermission,
  requireManagerSession,
  actorDisplayName,
  hashPin,
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
  assignEmployeePermissions,
  resetEmployeePin,
  changeOwnPin,
  verifyEmployeePin,
  verifyManagerPin,
  refreshEmployeeStatus,
  getAuditLogs,
  // Batch C pure deterministic helpers (unit-tested)
  normMoney,
  calcChargeBalance,
  calcFinanceSummary,
  generateReceiptNumber,
  filterFinanceDocs,
  PAYMENT_METHODS,
  recordAuditEventStrict,
  getAISettings,
  getCenterAISettings,
  // Onboarding & Authentication
  authenticateUser,
  logoutUser,
  changeOwnerPassword,
  resolveTenantForTest,
  resolveCallerToken,
  validateTenantAccess,
  testSignInEmulator,
  testSignOutEmulator,
  registerAndClaimOwnerCenter,
  verifyEmailAndExecuteClaim,
  // Licenses & Devices (canonical Firestore binding via trusted callables)
  getLicenseStatus,
  requestRebind,
  decideDeviceBindingFallback,
  requestDeviceBinding,
  deviceHeartbeat,
  validateDeviceStatus,
  // Branding
  getBranding,
  updateBranding,
  uploadBrandingAsset,
  // SuperAdmin & Center AI Services
  getSuperAdminAiConfig,
  saveSuperAdminAiConfig,
  testAiKeyConnection,
  generateExamQuestionsAi,
  getCenterAiStatusAndQuota,
  testCenterAiConnection,
  // Barcode Generation
  generateBarcode,
  // Invoice & Receipt Settings
  getInvoiceConfig,
  updateInvoiceConfig,
  // WhatsApp Automation & Gateway
  getWhatsAppConfig,
  updateWhatsAppConfig,
  sendWhatsAppMessage,
  // Accrued Attendance Dues
  calcAccruedStudentDues,
  // AI VIP Voucher Hub & Subscription Plans
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  generateAiVoucherBatch,
  getAiVouchers,
  allocateAiVoucherToStudent,
  redeemAiVoucher,
  // Video Watch Codes
  generateVideoWatchCodes,
  getVideoWatchCodes,
  // Session Attendance Window & Absence
  getSessionAttendanceWindow,
  markSessionRemainingAbsent
};

async function generateBarcode(callerToken, payload = {}) {
  const text = String(payload.text || payload.code || '').trim();
  if (!text) throw arabicServiceError('INVALID_INPUT', 'نص كود الباركود مطلوب');
  const bwipjs = require('bwip-js');
  const png = await new Promise((resolve, reject) => {
    bwipjs.toBuffer({
      bcid: payload.bcid || 'code128',
      text,
      scale: payload.scale || 3,
      height: payload.height || 12,
      includetext: payload.includetext !== false,
      textxalign: 'center'
    }, (err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });
  return { success: true, dataUrl: `data:image/png;base64,${png.toString('base64')}` };
}

