const { spawn, execSync } = require('child_process');
const http = require('http');

async function test() {
  const exePath = 'C:\\Users\\hp\\AppData\\Local\\Programs\\remas-center-desktop\\remas-center-desktop.exe';
  console.log('Launching packaged EXE:', exePath);

  const proc = spawn(exePath, ['--remote-debugging-port=9222'], {
    detached: true,
    stdio: 'ignore'
  });

  console.log('Spawned process PID:', proc.pid);

  // Wait 3 seconds for window startup
  await new Promise(r => setTimeout(r, 3000));

  // Query Windows PIDs for remas-center-desktop
  const psOutput = execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'remas-center-desktop.exe\'\\" | Select-Object ProcessId, CommandLine | Format-Table -AutoSize"', { encoding: 'utf8' });
  console.log('=== REAL WINDOWS PROCESS TABLE ===\n' + psOutput);

  // Fetch CDP target list
  http.get('http://localhost:9222/json/list', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('=== CDP TARGET LIST ===\n' + data);
      // Clean up process
      console.log('Terminating process tree...');
      execSync('powershell -Command "Stop-Process -Name \'remas-center-desktop\' -Force -ErrorAction SilentlyContinue"');
      console.log('Process terminated.');
    });
  });
}

test().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
