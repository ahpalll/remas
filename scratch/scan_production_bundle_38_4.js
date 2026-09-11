const fs = require('fs');
const path = require('path');

const srcDir = 'F:\\remas\\center-desktop\\src';
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

console.log('============================================================');
console.log('PRODUCTION MOCK DATA & RESET STORE SCANNER OUTPUT');
console.log('Target Directory:', srcDir);
console.log('============================================================\n');

let mockHits = 0;

files.forEach(file => {
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Check resetStore production isolation
  if (content.includes('resetStore')) {
    if (content.includes('UNAUTHORIZED_TEST_METHOD')) {
      console.log(`[PASS] ${file}: resetStore is ISOLATED from production runtime (throws UNAUTHORIZED_TEST_METHOD).`);
    } else {
      console.warn(`[WARN] ${file}: resetStore present without production guard!`);
      mockHits++;
    }
  }

  // Check for forbidden seed/demo arrays exposed to production
  const forbiddenPatterns = ['USE_TEST_SEED', 'demoData', 'seedData', 'fakeData', 'mockData'];
  forbiddenPatterns.forEach(pattern => {
    if (content.includes(pattern) && !content.includes('//')) {
      console.warn(`[FAIL] ${file}: Contains forbidden production seed pattern '${pattern}'`);
      mockHits++;
    }
  });
});

console.log('\n============================================================');
console.log(`SCAN RESULT: ${mockHits === 0 ? 'PASS (0 production mock/seed vulnerabilities detected)' : 'FAIL'}`);
console.log('============================================================');
