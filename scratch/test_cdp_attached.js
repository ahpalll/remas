const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  const exePath = 'C:\\Users\\hp\\AppData\\Local\\Programs\\remas-center-desktop\\remas-center-desktop.exe';
  console.log('Spawning packaged EXE with remote debugging port 9222...');
  
  const proc = spawn(exePath, ['--remote-debugging-port=9222'], {
    detached: true,
    stdio: 'ignore'
  });

  const mainPid = proc.pid;
  console.log('Main Process PID:', mainPid);
  await delay(3000);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  console.log('Waiting for #loginEmail element (attached)...');
  await page.waitForSelector('#loginEmail', { state: 'attached', timeout: 10000 });
  console.log('#loginEmail element attached!');

  const displayStyle = await page.evaluate(() => {
    const el = document.getElementById('loginScreenOverlay');
    const input = document.getElementById('loginEmail');
    return {
      overlayDisplay: el ? el.style.display : null,
      overlayComputedDisplay: el ? window.getComputedStyle(el).display : null,
      inputDisplay: input ? window.getComputedStyle(input).display : null
    };
  });
  console.log('DOM Display Styles:', displayStyle);

  await browser.close();
  execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
  console.log('Terminated process.');
}

test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
