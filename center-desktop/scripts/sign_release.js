/**
 * REMAS Release Signing Script — RUN ONLY ON THE RELEASE SERVER.
 *
 * This script generates the RSA-2048 keypair (first run) and signs release
 * metadata. The PRIVATE KEY NEVER leaves this machine.
 *
 * Usage:
 *   node scripts/sign_release.js generate-keypair
 *   node scripts/sign_release.js sign <version> <sha256Hash> <downloadUrl> [platform] [channel] [minVersion] [size]
 *
 * Output: prints a JSON payload to paste into the Firestore `appReleases` doc.
 *
 * SECURITY NOTES:
 * - Store the private key in a secure, access-controlled location.
 * - Never commit the private key to git or ship it in the installer.
 * - The public key is embedded in update_service.js (verify-only).
 * - After changing the public key, rebuild and re-distribute the app.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const KEY_DIR = path.join(__dirname, '..', '.release-keys');
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'release_private.pem');
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'release_public.pem');

function ensureKeyDir() {
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  }
}

function generateKeypair() {
  ensureKeyDir();
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('PRIVATE KEY ALREADY EXISTS. Refusing to overwrite.');
    console.error('Delete it manually if you really want to regenerate.');
    process.exit(1);
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });
  console.log('Keypair generated.');
  console.log('\n=== PUBLIC KEY (embed this in update_service.js) ===\n');
  console.log(publicKey);
  console.log('\nPrivate key stored at:', PRIVATE_KEY_PATH);
  console.log('Keep it secret. Never ship it with the app.');
}

function buildSigningPayload(release) {
  return JSON.stringify({
    version: release.version,
    sha256Hash: release.sha256Hash,
    downloadUrl: release.downloadUrl,
    platform: release.platform || 'windows-x64',
    channel: release.channel || 'stable',
    minVersion: release.minVersion || '0.0.0',
    size: release.size || 0
  });
}

function signRelease(args) {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('Private key not found. Run "generate-keypair" first.');
    process.exit(1);
  }
  const [version, sha256Hash, downloadUrl, platform, channel, minVersion, size] = args;
  if (!version || !sha256Hash || !downloadUrl) {
    console.error('Usage: sign <version> <sha256Hash> <downloadUrl> [platform] [channel] [minVersion] [size]');
    process.exit(1);
  }
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const release = {
    version,
    sha256Hash,
    downloadUrl,
    platform: platform || 'windows-x64',
    channel: channel || 'stable',
    minVersion: minVersion || '0.0.0',
    size: parseInt(size, 10) || 0
  };
  const payload = buildSigningPayload(release);
  const signature = crypto.sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64');
  console.log('\n=== Firestore appReleases document ===\n');
  console.log(JSON.stringify({
    ...release,
    signature,
    status: 'APPROVED',
    published: true,
    createdAt: new Date().toISOString()
  }, null, 2));
  console.log('\nSignature (base64):\n' + signature);
}

const [,, command, ...args] = process.argv;
if (command === 'generate-keypair') {
  generateKeypair();
} else if (command === 'sign') {
  signRelease(args);
} else {
  console.log('Commands:');
  console.log('  generate-keypair    Generate RSA-2048 keypair (first run only)');
  console.log('  sign <ver> <hash> <url> [platform] [channel] [minVersion] [size]   Sign a release');
}
