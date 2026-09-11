process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { setDoc, getDoc, doc } = require('firebase/firestore');

async function test() {
  const rulesPath = path.resolve(__dirname, '../firebase/firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log('Initializing test environment with rules from:', rulesPath);
  const testEnv = await initializeTestEnvironment({
    projectId: 'educenter-saas-860c5',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: rulesContent
    }
  });

  console.log('Test environment initialized.');

  const ownerAContext = testEnv.authenticatedContext('ownerA_uid', {
    institutionId: 'inst_A',
    role: 'institutionOwner'
  });

  const dbA = ownerAContext.firestore();

  // Test write to owner A student
  console.log('Testing write to inst_A student...');
  const studentRefA = doc(dbA, 'institutions/inst_A/students/student_1');
  await assertSucceeds(setDoc(studentRefA, { name: 'Test Student A', status: 'active' }));
  console.log('SUCCESS: ownerA setDoc inst_A student_1 ALLOWED');

  // Test write to owner B student
  console.log('Testing write to inst_B student...');
  const studentRefB = doc(dbA, 'institutions/inst_B/students/student_1');
  await assertFails(setDoc(studentRefB, { name: 'Test Student B', status: 'active' }));
  console.log('SUCCESS: ownerA setDoc inst_B student_1 DENIED BY FIRESTORE SECURITY RULES');

  await testEnv.cleanup();
  console.log('ALL EMULATOR TESTS COMPLETED SUCCESSFULLY');
}

test().catch(err => {
  console.error('EMULATOR TEST ERROR:', err);
  process.exit(1);
});
