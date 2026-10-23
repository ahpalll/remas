const { execSync } = require('child_process');

function killQuiet(processName) {
  try {
    execSync(`taskkill /F /IM ${processName} /T`, { stdio: 'ignore' });
    console.log(`Terminated running instance of ${processName}`);
  } catch (e) {
    // Process not running, safe to continue
  }
}

console.log('--- PREBUILD CLEAN: Clearing active locks ---');
killQuiet('electron.exe');
killQuiet('remas-center-desktop.exe');
console.log('--- Locks cleared successfully ---');
