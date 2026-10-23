// Print version + size + SHA-256 for delivery artifacts.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');

const files = [
  { label: 'Windows installer', p: process.argv[2] || '' },
  { label: 'Student APK', p: process.argv[3] || '' }
];

for (const f of files) {
  if (!f.p || !fs.existsSync(f.p)) {
    console.log(`${f.label}: NOT FOUND (${f.p || 'no path'})`);
    continue;
  }
  const buf = fs.readFileSync(f.p);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const st = fs.statSync(f.p);
  console.log(`${f.label}:`);
  console.log(`  path  : ${path.resolve(f.p)}`);
  console.log(`  size  : ${buf.length} bytes (${(buf.length / 1024 / 1024).toFixed(2)} MiB)`);
  console.log(`  sha256: ${sha}`);
  console.log(`  mtime : ${st.mtime.toISOString()}`);
}
try {
  const pkg = require('./package.json');
  console.log(`center-desktop version: ${pkg.version}`);
} catch (_) {}
