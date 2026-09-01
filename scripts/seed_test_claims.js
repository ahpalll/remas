/**
 * Helper script to set Custom Claims (role, institutionId) on test accounts in Firebase Auth Emulator.
 * Usage: node scripts/seed_test_claims.js <uid> <role> <institutionId>
 * Requires FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 */

const http = require('http');

const uid = process.argv[2] || 'test-user-123';
const role = process.argv[3] || 'institutionOwner';
const institutionId = process.argv[4] || 'inst_demo_01';

console.log(`Setting Custom Claims for UID: ${uid}, Role: ${role}, Tenant: ${institutionId}...`);
console.log('Ensure Firebase Auth Emulator is running on http://localhost:9099');
