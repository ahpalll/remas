const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const http = require('http');

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
  console.log('Connected to packaged app over CDP!');

  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  console.log('Page Title:', await page.title());
  console.log('Page URL:', page.url());

  // Check login screen element
  const loginEmailInput = await page.$('#loginEmail');
  console.log('#loginEmail element exists:', !!loginEmailInput);

  await browser.close();
  console.log('Disconnected CDP.');

  // Terminate process tree
  execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
  console.log('Terminated process.');
}

test().catch(err => {
  console.error('CDP PLAYWRIGHT ERROR:', err);
  process.exit(1);
});
