const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const exePath = path.join(__dirname, '..', 'center-desktop', 'build_output', 'win-unpacked', 'remas-center-desktop.exe');

if (!fs.existsSync(exePath)) {
  console.error('Exe file not found at:', exePath);
  process.exit(1);
}

const stats = fs.statSync(exePath);
const fileBuffer = fs.readFileSync(exePath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

console.log('=== CENTER DESKTOP WIN-UNPACKED BUILD VERIFICATION ===');
console.log('Relative Path:', 'center-desktop/build_output/win-unpacked/remas-center-desktop.exe');
console.log('Absolute Path:', exePath);
console.log('File Size (Bytes):', stats.size);
console.log('File Size (MB):', (stats.size / (1024 * 1024)).toFixed(2) + ' MB');
console.log('SHA256 Checksum:', sha256);
console.log('versionName:', '1.0.0-release.49.10');
console.log('versionCode:', '4910');
