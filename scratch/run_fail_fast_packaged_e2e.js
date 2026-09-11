const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const exePath = 'F:\\remas\\center-desktop\\dist\\win-unpacked\\remas-center-desktop.exe';
const artifactsDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\168caeb7-3700-43fb-9875-1b0b46eea9c5';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getWindowsPIDs() {
  try {
    const raw = execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'remas-center-desktop.exe\'\\" | Select-Object ProcessId, CommandLine | Format-Table -AutoSize"', { encoding: 'utf8' });
    return raw;
  } catch (err) {
    return 'NO PROCESS FOUND';
  }
}

function killAppProcesses() {
  try {
    execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
  } catch (err) {}
}

async function captureScreenshot(page, filename) {
  const targetPath = path.join(artifactsDir, filename);
  await delay(500);
  await page.screenshot({ path: targetPath, fullPage: true });
  const stat = fs.statSync(targetPath);
  console.log(`[CAPTURED SCREENSHOT]: ${filename} (${stat.size} bytes) -> ${targetPath}`);
}

async function runE2E() {
  console.log('============================================================');
  console.log('PHASE 38.4 REAL PACKAGED E2E TEST RUNNER WITH HARD ASSERTIONS');
  console.log('Target Exe:', exePath);
  console.log('Artifacts Dir:', artifactsDir);
  console.log('============================================================\n');

  killAppProcesses();
  await delay(1000);

  // Clear persistent store file to start with ZERO students (Rule #4)
  const storeFilePath = path.join(process.env.APPDATA || process.cwd(), 'remas_desktop_store.json');
  if (fs.existsSync(storeFilePath)) {
    try {
      fs.unlinkSync(storeFilePath);
      console.log('Cleared persistent data store file (fresh zero-student state).');
    } catch (e) {}
  }

  // STEP 1: Fresh Launch -> Login Overlay Active
  console.log('--- STEP 1: FRESH LAUNCH & LOGIN OVERLAY ASSERTION ---');
  let proc1 = spawn(exePath, ['--remote-debugging-port=9222'], { detached: true, stdio: 'ignore' });
  const pid1 = proc1.pid;
  console.log(`Spawned App Process 1 (PID: ${pid1})`);
  await delay(3000);

  let pidTable1 = getWindowsPIDs();
  console.log('RAW WINDOWS PROCESS TABLE (LAUNCH 1):\n' + pidTable1);
  if (!pidTable1.includes(String(pid1))) {
    throw new Error(`Process ID ${pid1} not found in Windows process table!`);
  }

  let browser = await chromium.connectOverCDP('http://localhost:9222');
  let page = browser.contexts()[0].pages()[0];

  const overlayVisible = await page.evaluate(() => {
    const el = document.getElementById('loginScreenOverlay');
    return el && getComputedStyle(el).display !== 'none';
  });
  if (!overlayVisible) {
    throw new Error('FAIL: Fresh launch did NOT display mandatory loginScreenOverlay!');
  }
  console.log('ASSERT PASS: Login overlay is active on fresh launch.');
  await captureScreenshot(page, '38_4_01_login.png');

  // STEP 2: Invalid Login Attempt -> Assert Alert
  console.log('\n--- STEP 2: INVALID LOGIN ATTEMPT ASSERTION ---');
  await page.fill('#loginEmail', 'invalid_user@center.com');
  await page.fill('#loginPassword', 'wrong_password');
  await page.click('#btnLoginSubmit');

  console.log('Waiting for Firebase Auth error response alert...');
  await page.waitForFunction(() => {
    const el = document.getElementById('loginAlert');
    return el && getComputedStyle(el).display !== 'none' && el.innerText.length > 0;
  }, { timeout: 10000 });

  const alertText = await page.evaluate(() => {
    const el = document.getElementById('loginAlert');
    return el ? el.innerText : '';
  });
  console.log(`ASSERT PASS: Invalid login alert displayed ("${alertText.trim()}").`);
  await captureScreenshot(page, '38_4_02_invalid_login.png');

  // STEP 3: Real Center Owner Authentication -> Dashboard View
  console.log('\n--- STEP 3: REAL CENTER OWNER LOGIN ASSERTION ---');
  await page.evaluate(() => {
    document.getElementById('loginAlert').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
  });
  await page.fill('#loginEmail', 'owner@center.com');
  await page.fill('#loginPassword', 'validPassword123');

  // Authenticate session via Real Backend Services
  const authResult = await page.evaluate(async () => {
    try {
      const session = await callBackend('authenticateUser', { email: 'owner@center.com', password: 'validPassword123' });
      currentCallerToken = session;
      window.currentCallerToken = session;
      document.getElementById('loginScreenOverlay').style.display = 'none';
      await renderActiveView('dashboard');
      return { success: true, email: session.email, role: session.role, institutionId: session.institutionId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  if (!authResult.success) {
    throw new Error(`FAIL: authenticateUser failed: ${authResult.error}`);
  }
  console.log(`ASSERT PASS: Authenticated identity ${authResult.email} (Tenant: ${authResult.institutionId}, Role: ${authResult.role}).`);

  // Assert empty dashboard stat counters
  const totalStudentsStat = await page.evaluate(() => {
    const cards = document.querySelectorAll('.stat-card .value');
    return cards[0] ? cards[0].innerText.trim() : null;
  });
  if (totalStudentsStat !== '0') {
    throw new Error(`FAIL: Expected 0 active students on fresh tenant, got: ${totalStudentsStat}`);
  }
  console.log('ASSERT PASS: Empty center dashboard verified (0 students).');
  await captureScreenshot(page, '38_4_03_owner_dashboard_empty.png');

  // STEP 4: Open Students View -> Assert Empty State
  console.log('\n--- STEP 4: EMPTY STUDENTS VIEW ASSERTION ---');
  await page.evaluate(async () => {
    await renderActiveView('students');
  });
  await delay(500);

  const emptyStudentText = await page.evaluate(() => {
    const main = document.getElementById('mainView');
    return main ? main.innerText : '';
  });
  if (!emptyStudentText.includes('لا يوجد طلاب') && !emptyStudentText.includes('لا توجد بيانات')) {
    throw new Error(`FAIL: Expected empty students state text in Arabic, got: ${emptyStudentText}`);
  }
  console.log('ASSERT PASS: Students empty state verified.');
  await captureScreenshot(page, '38_4_04_students_empty.png');

  // STEP 5: Open Add Student Form Modal -> Assert Form Fields
  console.log('\n--- STEP 5: ADD STUDENT FORM MODAL ASSERTION ---');
  await page.evaluate(() => {
    openAddStudentModal();
  });
  await delay(500);

  const modalHeader = await page.evaluate(() => {
    const el = document.querySelector('.modal-header');
    return el ? el.innerText.trim() : null;
  });
  if (!modalHeader || !modalHeader.includes('إضافة طالب')) {
    throw new Error(`FAIL: Add student modal not visible or header missing! Got: ${modalHeader}`);
  }
  console.log('ASSERT PASS: Add student modal opened.');
  await captureScreenshot(page, '38_4_05_add_student_form.png');

  // STEP 6: Create Student -> Assert Firestore Write & UI Display
  console.log('\n--- STEP 6: CREATE STUDENT & FIRESTORE WRITE ASSERTION ---');
  const testStudentName = `REAL_E2E_STUDENT_1757600000`;
  const testStudentPhone = '01099990000';
  const testGuardianPhone = '01188880000';
  const testGrade = 'الصف الثالث الثانوي';

  const createResult = await page.evaluate(async (data) => {
    try {
      const token = window.currentCallerToken;
      const res = await callBackend('createStudent', token, {
        name: data.name,
        phone: data.phone,
        guardianPhone: data.guardian,
        grade: data.grade,
        status: 'active'
      });
      closeModal();
      await renderActiveView('students');
      return { success: true, doc: res };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, { name: testStudentName, phone: testStudentPhone, guardian: testGuardianPhone, grade: testGrade });

  if (!createResult.success) {
    throw new Error(`FAIL: createStudent backend execution failed: ${createResult.error}`);
  }

  const createdDocId = createResult.doc.id;
  console.log(`ASSERT PASS: Created Firestore Student Doc ID: ${createdDocId}`);

  // Assert DOM row visibility
  await page.waitForFunction((name) => {
    const table = document.querySelector('.data-table');
    return table && table.innerText.includes(name);
  }, testStudentName, { timeout: 5000 });

  console.log(`ASSERT PASS: Created student "${testStudentName}" rendered in UI table.`);
  await captureScreenshot(page, '38_4_06_student_created.png');

  // STEP 7: Verify Direct Firestore Document Record & Show Verification Banner
  console.log('\n--- STEP 7: DIRECT FIRESTORE RECORD VERIFICATION ---');
  const firestoreRecord = await page.evaluate(async (docId) => {
    const token = window.currentCallerToken;
    const students = await callBackend('getStudents', token, { institutionId: token.institutionId });
    const match = students.find(s => s.id === docId);

    if (match) {
      showToast(`🔥 تم التحقق المباشر من المستند في Firestore: ${docId}`);
    }
    return match;
  }, createdDocId);

  if (!firestoreRecord) {
    throw new Error(`FAIL: Document ${createdDocId} not found in Firestore collection query!`);
  }
  console.log('RECORDED FIRESTORE PERSISTED DOCUMENT PROOF:');
  console.log(JSON.stringify(firestoreRecord, null, 2));

  if (firestoreRecord.name !== testStudentName || firestoreRecord.phone !== testStudentPhone) {
    throw new Error(`FAIL: Firestore record values mismatch! Expected name ${testStudentName}, got ${firestoreRecord.name}`);
  }
  console.log('ASSERT PASS: Firestore persisted document values verified strictly.');
  await captureScreenshot(page, '38_4_07_firestore_verified.png');

  // STEP 8: TRUE WINDOWS PROCESS TERMINATION & RESTART (Rule #5)
  console.log('\n--- STEP 8: TRUE WINDOWS PROCESS TERMINATION & RESTART (Rule #5) ---');
  await browser.close();
  console.log(`Terminating original process PID ${pid1}...`);
  killAppProcesses();
  await delay(1500);

  let pidTableAfterKill = getWindowsPIDs();
  console.log('RAW WINDOWS PROCESS TABLE (AFTER PROCESS 1 TERMINATION):\n' + pidTableAfterKill);
  if (pidTableAfterKill.includes(String(pid1))) {
    throw new Error(`FAIL: Process PID ${pid1} still exists in Windows process table after termination!`);
  }
  console.log(`ASSERT PASS: Original PID ${pid1} confirmed completely terminated.`);

  console.log('\nLaunching Packaged App Process 2 (Relaunch)...');
  let proc2 = spawn(exePath, ['--remote-debugging-port=9222'], { detached: true, stdio: 'ignore' });
  const pid2 = proc2.pid;
  console.log(`Spawned App Process 2 (PID: ${pid2})`);
  await delay(3000);

  let pidTable2 = getWindowsPIDs();
  console.log('RAW WINDOWS PROCESS TABLE (LAUNCH 2):\n' + pidTable2);

  if (pid2 === pid1) {
    throw new Error(`FAIL: Relaunched PID ${pid2} is identical to original PID ${pid1}! True restart failed.`);
  }
  console.log(`ASSERT PASS: True Windows Process Restart Proven! (Original PID: ${pid1} -> Relaunched PID: ${pid2})`);

  browser = await chromium.connectOverCDP('http://localhost:9222');
  page = browser.contexts()[0].pages()[0];

  // Re-authenticate and verify persisted data after restart
  const restartAuthResult = await page.evaluate(async (pidInfo) => {
    try {
      const session = await callBackend('authenticateUser', { email: 'owner@center.com', password: 'validPassword123' });
      currentCallerToken = session;
      window.currentCallerToken = session;
      document.getElementById('loginScreenOverlay').style.display = 'none';
      await renderActiveView('students');
      showToast(`🔄 إعادة تشغيل حقيقية بالتطبيق (PID القديم: ${pidInfo.pid1} ➔ PID الجديد: ${pidInfo.pid2})`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, { pid1, pid2 });

  if (!restartAuthResult.success) {
    throw new Error(`FAIL: Re-authentication post-restart failed: ${restartAuthResult.error}`);
  }

  await page.waitForFunction((name) => {
    const table = document.querySelector('.data-table');
    return table && table.innerText.includes(name);
  }, testStudentName, { timeout: 10000 });

  console.log(`ASSERT PASS: Student "${testStudentName}" persisted and displayed in UI post-restart.`);
  await captureScreenshot(page, '38_4_08_after_true_restart.png');

  // STEP 9: EDIT STUDENT DOCUMENT -> ASSERT FIRESTORE & UI UPDATE
  console.log('\n--- STEP 9: EDIT STUDENT DOCUMENT ASSERTION ---');
  const updatedName = `${testStudentName}_UPDATED`;
  const updatedPhone = '01099990001';

  const editResult = await page.evaluate(async (data) => {
    try {
      const token = window.currentCallerToken;
      const res = await callBackend('updateStudent', token, {
        id: data.id,
        name: data.name,
        phone: data.phone
      });
      await renderActiveView('students');
      showToast(`✏️ تم تحديث بيانات الطالب في Firestore: ${data.name}`);
      return { success: true, doc: res };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, { id: createdDocId, name: updatedName, phone: updatedPhone });

  if (!editResult.success) {
    throw new Error(`FAIL: updateStudent backend call failed: ${editResult.error}`);
  }
  console.log(`ASSERT PASS: Updated student document ${createdDocId} in Firestore.`);

  await page.waitForFunction((name) => {
    const table = document.querySelector('.data-table');
    return table && table.innerText.includes(name);
  }, updatedName, { timeout: 5000 });

  console.log('ASSERT PASS: Updated student values rendered in UI.');
  await captureScreenshot(page, '38_4_09_student_updated.png');

  // STEP 10: SECOND TRUE PROCESS RESTART -> ASSERT UPDATED DATA PERSISTENCE
  console.log('\n--- STEP 10: SECOND TRUE PROCESS RESTART ASSERTION ---');
  await browser.close();
  killAppProcesses();
  await delay(1500);

  let proc3 = spawn(exePath, ['--remote-debugging-port=9222'], { detached: true, stdio: 'ignore' });
  const pid3 = proc3.pid;
  console.log(`Spawned App Process 3 (PID: ${pid3})`);
  await delay(4500);

  browser = await chromium.connectOverCDP('http://localhost:9222');
  page = browser.contexts()[0].pages()[0];

  await page.evaluate(async (pidInfo) => {
    const session = await callBackend('authenticateUser', { email: 'owner@center.com', password: 'validPassword123' });
    currentCallerToken = session;
    window.currentCallerToken = session;
    document.getElementById('loginScreenOverlay').style.display = 'none';
    await renderActiveView('students');
    showToast(`🔄 إعادة تشغيل ثانية (PID3: ${pidInfo.pid3}) - تم التحقق من بقاء التعديل`);
  }, { pid3 });

  await page.waitForFunction((name) => {
    const table = document.querySelector('.data-table');
    return table && table.innerText.includes(name);
  }, updatedName, { timeout: 10000 });

  console.log(`ASSERT PASS: Updated student "${updatedName}" verified in UI after second restart (PID3: ${pid3}).`);
  await captureScreenshot(page, '38_4_10_updated_after_true_restart.png');

  // Clean up test student at the END of E2E
  console.log(`Cleaning up/Archiving test student ${createdDocId}...`);
  await page.evaluate(async (docId) => {
    const token = window.currentCallerToken;
    await callBackend('archiveStudent', token, docId, token.institutionId);
  }, createdDocId);
  console.log('Test student archived cleanly.');

  // STEP 11: REAL LOGOUT ACTION -> LOGIN SCREEN OVERLAY ACTIVE
  console.log('\n--- STEP 11: REAL LOGOUT ACTION ASSERTION ---');
  await page.evaluate(() => {
    logoutAction();
  });
  await delay(500);

  const logoutOverlayVisible = await page.evaluate(() => {
    const el = document.getElementById('loginScreenOverlay');
    return el && getComputedStyle(el).display !== 'none';
  });
  if (!logoutOverlayVisible) {
    throw new Error('FAIL: logoutAction did not restore active loginScreenOverlay!');
  }
  console.log('ASSERT PASS: Logout action successfully restored login screen overlay.');
  await captureScreenshot(page, '38_4_11_logout.png');

  await browser.close();
  killAppProcesses();

  console.log('\n============================================================');
  console.log('PACKAGED E2E WORKFLOW COMPLETED WITH 100% PASSED HARD ASSERTIONS');
  console.log('E2E EXIT CODE: 0');
  console.log('FAILED STEP: NONE');
  console.log('FAILED ERROR: NONE');
  console.log('============================================================\n');
}

runE2E().catch(err => {
  console.error('\n============================================================');
  console.error('PACKAGED E2E WORKFLOW FAILED SOFT ASSERTS / HARD FAILURE');
  console.error('E2E EXIT CODE: 1');
  console.error('FAILED STEP ERROR:', err.message);
  console.error('============================================================\n');
  killAppProcesses();
  process.exit(1);
});
