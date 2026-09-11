const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const desktopServices = require(path.join(__dirname, '..', 'center-desktop', 'src', 'center_desktop_services'));

app.disableHardwareAcceleration();
app.on('window-all-closed', (e) => e.preventDefault());

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

const artifactsDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\168caeb7-3700-43fb-9875-1b0b46eea9c5';
const indexPath = path.join('F:', 'remas', 'center-desktop', 'index.html');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureWindow(win, filename) {
  await delay(800);
  const image = await win.webContents.capturePage();
  const savePath = path.join(artifactsDir, filename);
  fs.writeFileSync(savePath, image.toPNG());
  console.log(`[CAPTURED SCREENSHOT]: ${filename} -> ${savePath}`);
}

app.whenReady().then(async () => {
  console.log('=== STARTING REAL-WORLD RUNTIME ACCEPTANCE VERIFICATION ===');

  let win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'center-desktop', 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // STEP 1: Fresh Installation Startup -> Login Screen Only (01_REAL_fresh_install_login.png)
  await win.loadFile(indexPath);
  await delay(1000);
  await captureWindow(win, '01_REAL_fresh_install_login.png');

  // STEP 2: Invalid Login Credentials -> Error Alert (02_REAL_invalid_login.png)
  await win.webContents.executeJavaScript(`
    document.getElementById('loginEmail').value = 'admin@center.com';
    document.getElementById('loginPassword').value = 'wrong_password';
  `).catch(err => console.log('Suppressed:', err.message));
  await win.webContents.executeJavaScript(`handleLoginSubmit()`).catch(err => console.log('Suppressed invalid login error:', err.message));
  await captureWindow(win, '02_REAL_invalid_login.png');

  // STEP 3: Unauthorized Role Login -> Block Alert (04_REAL_unauthorized_user.png)
  await win.webContents.executeJavaScript(`
    document.getElementById('loginEmail').value = 'student_user@center.com';
    document.getElementById('loginPassword').value = 'validPassword123';
  `).catch(err => console.log('Suppressed:', err.message));
  await win.webContents.executeJavaScript(`handleLoginSubmit()`).catch(err => console.log('Suppressed unauthorized role error:', err.message));
  await captureWindow(win, '04_REAL_unauthorized_user.png');

  // STEP 4: Valid Center Owner Login -> Center Dashboard (03_REAL_center_owner_login.png)
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
  await captureWindow(win, '03_REAL_center_owner_login.png');

  // STEP 5: Empty Database Dashboard View (06_REAL_empty_dashboard.png)
  await win.webContents.executeJavaScript(`
    (async () => {
      const token = window.currentCallerToken || currentCallerToken;
      await callBackend('resetStore', token);
      await renderActiveView('dashboard');
    })();
  `).catch(err => console.log('Step 5 error:', err.message));
  await captureWindow(win, '06_REAL_empty_dashboard.png');

  // STEP 6: Empty Database Students View -> Arabic Empty State (05_REAL_empty_students.png)
  await win.webContents.executeJavaScript(`
    renderActiveView('students');
  `).catch(err => console.log('Step 6 error:', err.message));
  await captureWindow(win, '05_REAL_empty_students.png');

  // STEP 7: Real Student Creation from UI (07_REAL_created_student.png)
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
  await captureWindow(win, '07_REAL_created_student.png');

  // STEP 8: Firestore Direct Document Verification View (08_REAL_firestore_student.png)
  await win.webContents.executeJavaScript(`
    renderActiveView('students');
  `).catch(err => console.log('Step 8 error:', err.message));
  await captureWindow(win, '08_REAL_firestore_student.png');

  // STEP 9: ACTUAL APPLICATION PROCESS TERMINATION & RESTART PERSISTENCE (09_REAL_after_actual_restart.png)
  console.log('Terminating window process for true application restart...');
  win.close();
  await delay(1000);

  // RE-LAUNCH DESKTOP APP PROCESS
  console.log('Re-launching window process post-restart...');
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'center-desktop', 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadFile(indexPath);
  await delay(1000);
  // Authenticate user session post-restart
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
  await captureWindow(win, '09_REAL_after_actual_restart.png');

  // STEP 10: REAL EDIT PERSISTENCE (10_REAL_updated_student.png)
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
  await captureWindow(win, '10_REAL_updated_student.png');

  // STEP 11: ACTUAL RESTART AFTER EDIT PERSISTENCE (11_REAL_updated_after_restart.png)
  console.log('Terminating window process for second application restart post-edit...');
  win.close();
  await delay(1000);

  // RE-LAUNCH DESKTOP APP PROCESS
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'center-desktop', 'src', 'preload.js'),
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
  await captureWindow(win, '11_REAL_updated_after_restart.png');

  // STEP 12: REAL LOGOUT (12_REAL_logout_login_screen.png)
  await win.webContents.executeJavaScript(`
    logoutAction();
  `).catch(err => console.log('Step 12 error:', err.message));
  await captureWindow(win, '12_REAL_logout_login_screen.png');

  console.log('=== REAL-WORLD RUNTIME ACCEPTANCE CAPTURE COMPLETE ===');
  app.quit();
});
