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

  await delay(3000);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  console.log('Context count:', contexts.length);

  for (const ctx of contexts) {
    const pages = ctx.pages();
    console.log('Pages in context:', pages.length);
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      console.log(`Page [${i}] URL:`, p.url(), 'Title:', await p.title());
      const hasEmail = await p.evaluate(() => !!document.getElementById('loginEmail')).catch(() => false);
      console.log(`Page [${i}] has #loginEmail:`, hasEmail);
    }
  }

  await browser.close();
  execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
}

test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
