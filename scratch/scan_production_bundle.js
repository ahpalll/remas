/**
 * REMAS Educational Center SaaS — Production Bundle Scanner Script
 * Version: 1.0.0-release.38.3
 * Scans center-desktop production source files to verify ZERO runtime mock datasets exist in production code.
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..', 'center-desktop', 'src');
const BANNED_PATTERNS = [
  /mockStudents/i,
  /demoStudents/i,
  /fakeStudents/i,
  /seedStudents/i,
  /sampleStudents/i,
  /hardcodedStudents/i,
  /fakeTeachers/i,
  /fakeGroups/i,
  /fakePayments/i,
  /fakeAttendance/i,
  /fakeDashboardMetrics/i
];

function scanDirectory(dir) {
  let hits = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      hits = hits.concat(scanDirectory(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.json')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const pattern of BANNED_PATTERNS) {
          if (pattern.test(line)) {
            hits.push({
              file: path.relative(path.join(__dirname, '..'), fullPath),
              line: index + 1,
              pattern: pattern.toString(),
              snippet: line.trim()
            });
          }
        }
      });
    }
  }

  return hits;
}

console.log('=== REMAS SaaS Production Bundle Mock Scanner ===');
const hits = scanDirectory(TARGET_DIR);

if (hits.length === 0) {
  console.log('STATUS: PASS — Zero runtime mock datasets detected in production code bundle.');
  process.exit(0);
} else {
  console.error('STATUS: FAIL — Detected runtime mock datasets in production code bundle:');
  console.error(JSON.stringify(hits, null, 2));
  process.exit(1);
}
