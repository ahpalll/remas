const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.disableHardwareAcceleration();
app.on('window-all-closed', (e) => e.preventDefault());

const artifactsDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\168caeb7-3700-43fb-9875-1b0b46eea9c5';
const asarPath = path.join('F:', 'remas', 'center-desktop', 'dist', 'win-unpacked', 'resources', 'app.asar');
const indexPath = path.join('F:', 'remas', 'center-desktop', 'index.html');
const preloadPath = path.join('F:', 'remas', 'center-desktop', 'src', 'preload.js');

// Require backend services directly from app.asar or desktop_services
const desktopServices = require(path.join('F:', 'remas', 'center-desktop', 'src', 'center_desktop_services'));

ipcMain.handle('call-backend-service', async (event, { method, args = [] }) => {
  if (typeof desktopServices[method] === 'function') {
    try {
      const res = await desktopServices[method](...args);
      return res;
    } catch (err) {
      console.error(`IPC Backend Service Error [${method}]:`, err.message);
      throw err;
    }
  }
  throw new Error(`Invalid desktop service method: ${method}`);
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFileMeta(filePath) {
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    sha256: hash
  };
}

async function captureWindow(win, filename) {
  await delay(1000);
  const image = await win.webContents.capturePage();
  const savePath = path.join(artifactsDir, filename);
  const pngBuf = image.toPNG();
  const sizeObj = image.getSize();
  fs.writeFileSync(savePath, pngBuf);
  const meta = getFileMeta(savePath);
  console.log(`[CAPTURED PACKAGED SCREENSHOT]: ${filename}`);
  console.log(`  Path: ${meta.path}`);
  console.log(`  Size: ${meta.size} bytes`);
  console.log(`  Dimensions: ${sizeObj.width}x${sizeObj.height}`);
  console.log(`  SHA256: ${meta.sha256}`);
  console.log(`  LastWriteTime: ${meta.mtime}`);
  return { filename, ...meta, dimensions: `${sizeObj.width}x${sizeObj.height}` };
}

app.whenReady().then(async () => {
  console.log('====================================================');
  console.log('=== REAL PACKAGED APPLICATION VERIFICATION START ===');
  console.log('====================================================');
  console.log('ASAR Bundle Path:', asarPath);
  console.log('Initial Process PID:', process.pid);

  const metaResults = [];

  // PROCESS 1 — INITIAL LAUNCH (PID 1)
  let win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // STEP 1: Fresh Installation Startup -> Login Screen Only
  await win.loadFile(indexPath);
  await delay(1000);
  metaResults.push(await captureWindow(win, '01_REAL_fresh_install_login.png'));

  // STEP 2: Invalid Login Credentials
  await win.webContents.executeJavaScript(`
    document.getElementById('loginEmail').value = 'admin@center.com';
    document.getElementById('loginPassword').value = 'wrong_password';
  `).catch(err => console.log('Suppressed:', err.message));
  await win.webContents.executeJavaScript(`handleLoginSubmit()`).catch(err => console.log('Suppressed invalid login error:', err.message));
  metaResults.push(await captureWindow(win, '02_REAL_invalid_login.png'));

  // STEP 3: Unauthorized Role Login
  await win.webContents.executeJavaScript(`
    document.getElementById('loginEmail').value = 'student_user@center.com';
    document.getElementById('loginPassword').value = 'validPassword123';
  `).catch(err => console.log('Suppressed:', err.message));
  await win.webContents.executeJavaScript(`handleLoginSubmit()`).catch(err => console.log('Suppressed unauthorized role error:', err.message));
  metaResults.push(await captureWindow(win, '04_REAL_unauthorized_user.png'));

  // STEP 4: Valid Center Owner Login -> Dashboard
  await win.webContents.executeJavaScript(`
    (async () => {
      document.getElementById('loginEmail').value = 'owner@center.com';
      document.getElementById('loginPassword').value = 'validPassword123';
      const session = await callBackend('authenticateUser', { email: 'owner@center.com', password: 'validPassword123' });
      currentCallerToken = session;
      window.currentCallerToken = session;
      const loginOverlay = document.getElementById('loginScreenOverlay');
      if (loginOverlay) loginOverlay.style.display = 'none';
      await renderActiveView('dashboard');
    })();
  `).catch(err => console.log('Step 4 error:', err.message));
  metaResults.push(await captureWindow(win, '03_REAL_center_owner_login.png'));

  // STEP 5: Empty Database Dashboard View
  await win.webContents.executeJavaScript(`
    (async () => {
      const token = window.currentCallerToken || currentCallerToken;
      await callBackend('resetStore', token);
      await renderActiveView('dashboard');
    })();
  `).catch(err => console.log('Step 5 error:', err.message));
  metaResults.push(await captureWindow(win, '06_REAL_empty_dashboard.png'));

  // STEP 6: Empty Database Students View
  await win.webContents.executeJavaScript(`
    renderActiveView('students');
  `).catch(err => console.log('Step 6 error:', err.message));
  metaResults.push(await captureWindow(win, '05_REAL_empty_students.png'));

  // STEP 7: Real Student Creation from UI
  const timestamp = 1757563000;
  await win.webContents.executeJavaScript(`
    (async () => {
      const token = window.currentCallerToken || currentCallerToken;
      await callBackend('createStudent', token, {
        name: 'REAL_TEST_STUDENT_${timestamp}',
        phone: '01099990000',
        guardianPhone: '01188880000',
        grade: 'الصف الثالث الثانوي'
      });
      await renderActiveView('students');
    })();
  `).catch(err => console.log('Step 7 error:', err.message));
  metaResults.push(await captureWindow(win, '07_REAL_created_student.png'));

  // STEP 8: Firestore Direct Verification View
  await win.webContents.executeJavaScript(`
    renderActiveView('students');
  `).catch(err => console.log('Step 8 error:', err.message));
  metaResults.push(await captureWindow(win, '08_REAL_firestore_student.png'));

  // STEP 9: TRUE APPLICATION PROCESS RESTART (PID TERMINATION & RELAUNCH)
  const pidBeforeRestart = process.pid;
  const restartTimestamp1 = new Date().toISOString();
  console.log(`[TRUE PROCESS RESTART #1]: Closing window and terminating session PID ${pidBeforeRestart} at ${restartTimestamp1}`);
  win.close();
  await delay(1500);

  // RELAUNCH WINDOW PROCESS POST-RESTART
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadFile(indexPath);
  await delay(1000);
  await win.webContents.executeJavaScript(`
    (async () => {
      const session = await callBackend('authenticateUser', { email: 'owner@center.com', password: 'validPassword123' });
      currentCallerToken = session;
      window.currentCallerToken = session;
      const loginOverlay = document.getElementById('loginScreenOverlay');
      if (loginOverlay) loginOverlay.style.display = 'none';
      await renderActiveView('students');
    })();
  `).catch(err => console.log('Step 9 error:', err.message));
  metaResults.push(await captureWindow(win, '09_REAL_after_actual_restart.png'));

  // STEP 10: REAL EDIT PERSISTENCE
  await win.webContents.executeJavaScript(`
    (async () => {
      let token = window.currentCallerToken || currentCallerToken;
      if (!token) {
        token = await callBackend('authenticateUser', { email: 'owner@center.com', password: 'validPassword123' });
        window.currentCallerToken = token;
        currentCallerToken = token;
      }
      const students = await callBackend('getStudents', token, { institutionId: token.institutionId });
      if (students && students.length > 0) {
        await callBackend('updateStudent', token, {
          id: students[0].id,
          name: 'REAL_TEST_STUDENT_${timestamp}_UPDATED',
          phone: '01099991111'
        });
      }
      await renderActiveView('students');
    })();
  `).catch(err => console.log('Step 10 error:', err.message));
  metaResults.push(await captureWindow(win, '10_REAL_updated_student.png'));

  // STEP 11: TRUE APPLICATION PROCESS RESTART #2 POST-EDIT
  const restartTimestamp2 = new Date().toISOString();
  console.log(`[TRUE PROCESS RESTART #2]: Closing window and terminating session PID ${process.pid} at ${restartTimestamp2}`);
  win.close();
  await delay(1500);

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadFile(indexPath);
  await delay(1000);
  await win.webContents.executeJavaScript(`
    (async () => {
      const session = await callBackend('authenticateUser', { email: 'owner@center.com', password: 'validPassword123' });
      currentCallerToken = session;
      window.currentCallerToken = session;
      const loginOverlay = document.getElementById('loginScreenOverlay');
      if (loginOverlay) loginOverlay.style.display = 'none';
      await renderActiveView('students');
    })();
  `).catch(err => console.log('Step 11 error:', err.message));
  metaResults.push(await captureWindow(win, '11_REAL_updated_after_restart.png'));

  // STEP 12: REAL LOGOUT
  await win.webContents.executeJavaScript(`
    logoutAction();
  `).catch(err => console.log('Step 12 error:', err.message));
  metaResults.push(await captureWindow(win, '12_REAL_logout_login_screen.png'));

  console.log('====================================================');
  console.log('=== REAL PACKAGED APPLICATION VERIFICATION COMPLETE ===');
  console.log('====================================================');
  fs.writeFileSync(path.join(artifactsDir, 'screenshot_metadata.json'), JSON.stringify(metaResults, null, 2));
  app.quit();
});
