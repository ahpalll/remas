const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const artifactsDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\168caeb7-3700-43fb-9875-1b0b46eea9c5';
const files = [
  '38_4_01_login.png',
  '38_4_02_invalid_login.png',
  '38_4_03_owner_dashboard_empty.png',
  '38_4_04_students_empty.png',
  '38_4_05_add_student_form.png',
  '38_4_06_student_created.png',
  '38_4_07_firestore_verified.png',
  '38_4_08_after_true_restart.png',
  '38_4_09_student_updated.png',
  '38_4_10_updated_after_true_restart.png',
  '38_4_11_logout.png'
];

console.log('============================================================');
console.log('PHASE 38.4 SCREENSHOT MANIFEST & SHA256 AUDIT');
console.log('============================================================\n');

const hashes = new Set();
let duplicates = 0;

files.forEach(file => {
  const filePath = path.join(artifactsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING FILE: ${file}`);
    return;
  }
  const stat = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  if (hashes.has(hash)) {
    console.warn(`DUPLICATE DETECTED: ${file} -> SHA256: ${hash}`);
    duplicates++;
  } else {
    hashes.add(hash);
  }

  console.log(`Filename : ${file}`);
  console.log(`Path     : ${filePath}`);
  console.log(`Size     : ${stat.size} bytes`);
  console.log(`Modified : ${stat.mtime.toISOString()}`);
  console.log(`SHA256   : ${hash}\n`);
});

console.log(`Unique Hashes: ${hashes.size} / ${files.length}`);
console.log(`Duplicates   : ${duplicates}`);
