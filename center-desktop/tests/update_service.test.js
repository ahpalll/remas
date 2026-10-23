/**
 * REMAS Update Service Tests
 * Run with: npx jest tests/update_service.test.js
 * (Or directly: node tests/update_service.test.js)
 */

const {
  compareVersions,
  sha256,
  verifyRsaSignature,
  buildSigningPayload,
  verifyUpdate
} = require('../src/update_service');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

// ─── Version Comparison Tests ───
console.log('\n[1] Version Comparison Tests');
assertEqual(compareVersions('1.0.0', '1.0.0'), 0, 'Same versions are equal');
assertEqual(compareVersions('2.0.0', '1.0.0'), 1, 'Major version bump');
assertEqual(compareVersions('1.1.0', '1.0.0'), 1, 'Minor version bump');
assertEqual(compareVersions('1.0.1', '1.0.0'), 1, 'Patch version bump');
assertEqual(compareVersions('1.0.0', '2.0.0'), -1, 'Lower version');
assertEqual(compareVersions('1.0.0-release.52', '1.0.0-release.51'), 1, 'Release suffix comparison');
assertEqual(compareVersions('1.0.0', '1.0.1'), -1, 'Patch comparison');

// ─── SHA-256 Tests ───
console.log('\n[2] SHA-256 Hash Tests');
const testBuffer = Buffer.from('Hello, REMAS!');
const expectedHash = sha256(testBuffer);
assert(expectedHash.length === 64, 'SHA-256 produces 64 hex characters');
assert(sha256('test') === '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'Known SHA-256 hash matches');
assert(sha256('test') === sha256('test'), 'Same input produces same hash');
assert(sha256('test1') !== sha256('test2'), 'Different inputs produce different hashes');

// ─── RSA Signature Tests ───
console.log('\n[3] RSA Signature Verification Tests');
const testKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const testPayload = JSON.stringify({
  version: '1.0.0-release.53.0.0',
  sha256Hash: expectedHash,
  downloadUrl: 'https://example.com/setup.exe',
  platform: 'windows-x64',
  channel: 'stable',
  minVersion: '1.0.0-release.50.0.0',
  size: 183500800
});

const testSignature = crypto.sign('RSA-SHA256', Buffer.from(testPayload), testKeyPair.privateKey).toString('base64');

assert(verifyRsaSignature(Buffer.from(testPayload), testSignature) === false, 'Signature from different key does NOT verify against embedded public key');

// Self-verification with correct key
const selfVerify = crypto.createVerify('RSA-SHA256');
selfVerify.update(Buffer.from(testPayload));
assert(selfVerify.verify(testKeyPair.publicKey, Buffer.from(testSignature, 'base64')) === true, 'Signature verifies with correct public key');

// ─── Update Verification Tests ───
console.log('\n[4] Update File Verification Tests');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remas-test-'));
const testFile = path.join(tmpDir, 'test-update.exe');
fs.writeFileSync(testFile, testBuffer);

const releaseInfo = {
  version: '1.0.0-release.53.0.0',
  sha256Hash: expectedHash,
  hash: expectedHash,
  downloadUrl: 'https://example.com/setup.exe',
  signature: testSignature,
  platform: 'windows-x64',
  channel: 'stable',
  minVersion: '1.0.0-release.50.0.0',
  size: 183500800,
  publicKey: testKeyPair.publicKey
};

const verifyOpts = { publicKey: testKeyPair.publicKey, trustedHosts: ['example.com'] };

const validResult = verifyUpdate(testFile, releaseInfo, verifyOpts);
assert(validResult.valid === true, 'Valid update passes verification');

// Tampered file
const tamperedFile = path.join(tmpDir, 'tampered.exe');
fs.writeFileSync(tamperedFile, Buffer.from('tampered content'));
const tamperedResult = verifyUpdate(tamperedFile, releaseInfo, verifyOpts);
assert(tamperedResult.valid === false, 'Tampered file fails verification');
assert(tamperedResult.error.includes('بصمة') || tamperedResult.error.includes('التحقق'), 'Hash mismatch error message is clear');

// Missing file
const missingResult = verifyUpdate(path.join(tmpDir, 'nonexistent.exe'), releaseInfo, verifyOpts);
assert(missingResult.valid === false, 'Missing file fails verification');
assert(missingResult.error.includes('غير موجود'), 'Missing file error message is clear');

// Cleanup
fs.rmSync(tmpDir, { recursive: true });

// ─── Summary ───
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
