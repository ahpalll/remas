const fs = require('fs');
let content = fs.readFileSync('F:\\remas\\center-desktop\\release_50_3_1\\win-unpacked\\resources\\app\\main.js', 'utf8');
content = content.replace(/1\.0\.0-release\.50\.2\.5/g, '1.0.0-release.50.3.1');
fs.writeFileSync('F:\\remas\\center-desktop\\release_50_3_1\\win-unpacked\\resources\\app\\main.js', content, 'utf8');
console.log('Version fixed in main.js');