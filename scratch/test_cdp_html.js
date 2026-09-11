const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  const exePath = 'C:\\Users\\hp\\AppData\\Local\\Programs\\remas-center-desktop\\remas-center-desktop.exe';
  const proc = spawn(exePath, ['--remote-debugging-port=9222'], {
    detached: true,
    stdio: 'ignore'
  });

  await delay(3000);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  console.log('=== PACKAGED EXE BODY HTML ===\n', bodyHtml);

  await browser.close();
  execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
}

test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
