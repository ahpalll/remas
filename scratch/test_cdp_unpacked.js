const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  const exePath = 'F:\\remas\\center-desktop\\dist\\win-unpacked\\remas-center-desktop.exe';
  console.log('Testing unpacked EXE:', exePath);

  const proc = spawn(exePath, ['--remote-debugging-port=9222'], {
    detached: true,
    stdio: 'ignore'
  });

  await delay(3000);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  console.log('=== UNPACKED EXE BODY HTML ===\n', bodyHtml);

  await browser.close();
  execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
}

test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
