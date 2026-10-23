const fs = require('fs');
let content = fs.readFileSync('F:\\remas\\center-desktop\\release_50_3_1\\win-unpacked\\resources\\app\\main.js', 'utf8');
// Remove the hardcoded version from JSDoc comment to prevent version mismatch
content = content.replace(/\/\*[\s\S]*?\*\/[\s\]?*/, '/**\n * REMAS Educational Center SaaS — Windows Desktop Application Main Process\n * Target Project: educenter-saas\n */');
fs.writeFileSync('F:\\remas\\center-desktop\\release_50_3_1\\win-unpacked\\resources\\app\\main.js', content, 'utf8');
console.log('main.js version line removed');