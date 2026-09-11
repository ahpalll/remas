const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  const exePath = 'F:\\remas\\center-desktop\\dist\\win-unpacked\\remas-center-desktop.exe';
  const proc = spawn(exePath, ['--remote-debugging-port=9222'], { detached: true, stdio: 'ignore' });
  await delay(3000);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  console.log('Filling invalid credentials...');
  await page.fill('#loginEmail', 'invalid_user@center.com');
  await page.fill('#loginPassword', 'wrong_password_123');

  console.log('Calling handleLoginSubmit() directly...');
  const res = await page.evaluate(async () => {
    try {
      await handleLoginSubmit();
      const alert = document.getElementById('loginAlert');
      return {
        alertDisplay: alert ? alert.style.display : null,
        alertText: alert ? alert.innerText : null
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  console.log('Result:', res);

  await browser.close();
  execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
}

test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
