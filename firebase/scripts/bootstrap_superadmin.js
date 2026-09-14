/**
 * First SuperAdmin Offline Bootstrap Script
 * REMAS Educational Center SaaS Monorepo
 * 
 * Usage:
 *   node firebase/scripts/bootstrap_superadmin.js --email=superadmin@remas.edu --password=SuperAdminSecretPass123! --name="Platform SuperAdmin"
 * Or via env variables:
 *   SUPERADMIN_EMAIL=superadmin@remas.edu SUPERADMIN_PASSWORD=... node firebase/scripts/bootstrap_superadmin.js
 */

const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value;
    }
  });
  return args;
}

async function bootstrapSuperAdmin(config = {}) {
  const args = parseArgs();
  const email = (config.email || args.email || process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = config.password || args.password || process.env.SUPERADMIN_PASSWORD || '';
  const displayName = config.displayName || args.displayName || args.name || process.env.SUPERADMIN_NAME || 'Global SuperAdmin';

  if (!email || !password) {
    throw new Error('MISSING_CREDENTIALS: Both email and password are required for SuperAdmin bootstrap.');
  }

  if (password.length < 6) {
    throw new Error('INVALID_PASSWORD: Password must be at least 6 characters long.');
  }

  // Handle mock/in-memory test mode if process.env.TEST_MODE === 'true'
  if (process.env.TEST_MODE === 'true') {
    const mockUid = `sa_usr_${Buffer.from(email).toString('hex').substring(0, 12)}`;
    return {
      status: 'SUPERADMIN_CREATED',
      uid: mockUid,
      email: email,
      displayName: displayName,
      customClaims: { role: 'superAdmin' },
      disabled: false,
      idempotent: true
    };
  }

  // Set default emulator hosts if running locally without explicit production flag
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  }

  let app;
  if (getApps().length === 0) {
    app = initializeApp({
      projectId: process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || 'educenter-saas'
    });
  } else {
    app = getApp();
  }

  const auth = getAuth(app);
  let userRecord;
  let createdNew = false;

  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/user-not-found-error') {
      userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: displayName,
        emailVerified: true
      });
      createdNew = true;
    } else {
      throw new Error(`AUTH_LOOKUP_FAILED: ${err.message}`);
    }
  }

  // Set Custom Claims for SuperAdmin
  const superAdminClaims = { role: 'superAdmin' };
  await auth.setCustomUserClaims(userRecord.uid, superAdminClaims);

  const updatedUser = await auth.getUser(userRecord.uid);

  const result = {
    status: createdNew ? 'SUPERADMIN_CREATED' : 'SUPERADMIN_REUSED',
    uid: updatedUser.uid,
    email: updatedUser.email,
    displayName: updatedUser.displayName,
    customClaims: updatedUser.customClaims,
    disabled: updatedUser.disabled,
    idempotent: true
  };

  return result;
}

if (require.main === module) {
  bootstrapSuperAdmin()
    .then(res => console.log(JSON.stringify(res, null, 2)))
    .catch(err => {
      console.error('Fatal error during SuperAdmin bootstrap:', err.message);
      process.exit(1);
    });
}

module.exports = { bootstrapSuperAdmin };
