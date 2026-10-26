/**
 * REMAS — OTA Hot-Patch Publisher
 * Generates lightweight hotpatch bundles (< 1 MB) from current src files.
 *
 * Usage:
 *   node scripts/publish_hotpatch.js [patchVersion] [description]
 *
 * Example:
 *   node scripts/publish_hotpatch.js 1.0.0-hp.52.5.1 "إصلاح انقطاع النت وتحسين المعاينة"
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');
const pkg = require('../package.json');

const args = process.argv.slice(2);
const baseDir = path.resolve(__dirname, '..');
const outDir = path.join(baseDir, 'release_hotpatches');

// 1. Determine patch version
const dateStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12);
const autoVersion = `1.0.0-hp.${pkg.version.split('-')[1]?.replace('release.', '') || '52.5'}.${Date.now().toString().slice(-4)}`;
const patchVersion = args[0] || autoVersion;
const description = args[1] || 'تحديث فوري للنظام يتضمن تحسينات الاستقرار وسرعة الاستجابة.';

// 2. Target files to bundle in the hotpatch
const targetFiles = [
  'src/desktop_app.js',
  'src/center_desktop_services.js',
  'src/hotpatch_service.js',
  'src/device_fingerprint.js',
  'src/content_upload_config.js'
];

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('======================================================');
console.log(`🚀 REMAS OTA Hot-Patch Generator — Version: ${patchVersion}`);
console.log('======================================================\n');

const filesManifest = [];
let totalBytes = 0;

for (const relPath of targetFiles) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] File not found, skipping: ${relPath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const size = content.length;
  totalBytes += size;

  // Copy file to release_hotpatches
  const outFilePath = path.join(outDir, path.basename(relPath));
  fs.writeFileSync(outFilePath, content);

  filesManifest.push({
    relativePath: relPath.replace(/\\/g, '/'),
    filename: path.basename(relPath),
    size,
    sha256,
    // Provide GitHub Raw URL for instant, reliable zero-rate-limit download
    url: `https://raw.githubusercontent.com/ahpalll/remas/master/center-desktop/release_hotpatches/${path.basename(relPath)}`
  });

  console.log(`  ✓ ${relPath.padEnd(32)} ${(size / 1024).toFixed(1)} KB (SHA-256: ${sha256.slice(0, 12)}...)`);
}

const manifest = {
  patchVersion,
  targetVersion: pkg.version,
  publishedAt: new Date().toISOString(),
  active: true,
  description,
  totalSizeKb: (totalBytes / 1024).toFixed(1),
  files: filesManifest
};

const manifestPath = path.join(outDir, 'hotpatch_manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`\n📦 Total Patch Size: ${(totalBytes / 1024).toFixed(1)} KB (Less than 1 MB!)`);
console.log(`📂 Output Directory: ${outDir}`);
console.log(`📄 Manifest File:    ${manifestPath}\n`);

console.log('------------------------------------------------------');
console.log('📋 Firestore Document for: appHotpatches/latest');
console.log('------------------------------------------------------');
console.log(JSON.stringify(manifest, null, 2));
console.log('------------------------------------------------------\n');
console.log('✅ تم تجهيز التحديث الفوري بنجاح! يمكن وضعه في Firestore أو رفعه على GitHub مباشرة.');
