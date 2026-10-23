/**
 * REMAS — appReleases document builder (LOCAL UTILITY — does NOT deploy).
 *
 * Prints a ready-to-paste Firestore document for the `appReleases` collection.
 * Run it AFTER building the installer and computing its SHA-256.
 *
 * Usage:
 *   node scripts/prepare_release_doc.js <version> <filePath> [platform] [channel] [minVersion]
 *
 * Example:
 *   node scripts/prepare_release_doc.js 1.0.0-release.53.0.0 "../release_center_pdf_pages/REMAS Center Setup 1.0.0-release.53.0.0.exe"
 *
 * Steps to activate updates (requires explicit approval — NOT done automatically):
 *   1. Build installer:  npm run build:win
 *   2. Generate keys:    node scripts/sign_release.js generate-keypair
 *   3. Copy public key into src/update_service.js (REMAS_UPDATE_PUBLIC_KEY)
 *   4. Sign release:     node scripts/sign_release.js sign <ver> <sha256> <url> ...
 *   5. Upload installer to a free host (e.g., GitHub Releases / R2 free tier)
 *   6. Paste signed document into Firestore `appReleases` (SuperAdmin only)
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');

const [,, version, filePath, platform, channel, minVersion] = process.argv;

if (!version || !filePath) {
  console.log('Usage: node scripts/prepare_release_doc.js <version> <filePath> [platform] [channel] [minVersion]');
  process.exit(1);
}

const absPath = path.resolve(filePath);
if (!fs.existsSync(absPath)) {
  console.error('File not found:', absPath);
  process.exit(1);
}

const buffer = fs.readFileSync(absPath);
const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

const doc = {
  version,
  platform: platform || 'windows-x64',
  channel: channel || 'stable',
  status: 'APPROVED',
  published: true,
  downloadUrl: 'REPLACE_WITH_HOSTED_URL',
  size: buffer.length,
  sha256Hash: sha256,
  signature: 'RUN sign_release.js TO_FILL',
  minVersion: minVersion || '0.0.0',
  mandatory: false,
  releaseNotes: 'REPLACE_WITH_RELEASE_NOTES',
  createdAt: new Date().toISOString()
};

console.log('\n=== Firestore: appReleases/{auto-id} ===\n');
console.log(JSON.stringify(doc, null, 2));
console.log('\nFile:', absPath);
console.log('Size:', buffer.length, 'bytes');
console.log('SHA-256:', sha256);
console.log('\nNext: sign with scripts/sign_release.js and upload installer to your host.');
