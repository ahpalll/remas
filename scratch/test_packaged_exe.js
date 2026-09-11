const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const exePath = 'F:\\remas\\center-desktop\\dist\\win-unpacked\\remas-center-desktop.exe';
const artifactsDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\168caeb7-3700-43fb-9875-1b0b46eea9c5';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('Testing packaged executable launch:', exePath);
const child = spawn(exePath, ['--remote-debugging-port=9222'], {
  detached: true,
  stdio: 'ignore'
});

console.log('Spawned EXE PID:', child.pid);
delay(3000).then(() => {
  http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('CDP Targets:', data);
      child.kill();
      process.exit(0);
    });
  }).on('error', (err) => {
    console.error('CDP Error:', err.message);
    child.kill();
    process.exit(1);
  });
});
