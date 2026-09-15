const { spawnSync } = require('child_process');
const path = require('path');

const javaBinDir = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin';
const newPath = javaBinDir + path.delimiter + process.env.PATH;

console.log('Setting JAVA_HOME & PATH to JDK 21:', 'C:\\Program Files\\Android\\Android Studio\\jbr');

const res = spawnSync('npx firebase emulators:exec "node tests/run_phase_44_emulator_matrix.js"', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    JAVA_HOME: 'C:\\Program Files\\Android\\Android Studio\\jbr',
    PATH: newPath
  }
});

process.exit(res.status || 0);
