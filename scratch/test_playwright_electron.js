const { _electron } = require('playwright');
const { execSync } = require('child_process');

async function test() {
  const exePath = 'C:\\Users\\hp\\AppData\Local\\Programs\\remas-center-desktop\\remas-center-desktop.exe';
  console.log('Testing Playwright _electron.launch with packaged EXE:', exePath);

  const app = await _electron.launch({
    executablePath: exePath,
    args: []
  });

  const pid = app.process().pid;
  console.log('App launched! Main process PID:', pid);

  const window = await app.firstWindow();
  console.log('Window title:', await window.title());

  const psOutput = execSync(`powershell -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\" | Select-Object ProcessId, Name, CommandLine | Format-List"`, { encoding: 'utf8' });
  console.log('=== VERIFIED WINDOWS PROCESS ===\n' + psOutput);

  await app.close();
  console.log('App closed.');

  const checkAfterClose = execSync(`powershell -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\" | Select-Object ProcessId"`, { encoding: 'utf8' });
  console.log('Process check after close (should be empty):', checkAfterClose.trim() ? 'STILL RUNNING' : 'TERMINATED CLEANLY');
}

test().catch(err => {
  console.error('PLAYWRIGHT ELECTRON TEST ERROR:', err);
  process.exit(1);
});
