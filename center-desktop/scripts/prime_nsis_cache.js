// Compute @electron/get cache paths for NSIS toolset files and place them.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const cacheRoot = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'downloads');

function cachePathFor(url) {
  const u = new URL(url);
  const pathname = u.pathname;
  const dirname = pathname.slice(0, pathname.lastIndexOf('/'));
  const strippedUrl = `${u.protocol}//${u.host}${dirname}`;
  const hash = crypto.createHash('sha256').update(strippedUrl).digest('hex');
  const fileName = pathname.slice(pathname.lastIndexOf('/') + 1);
  return { dir: path.join(cacheRoot, hash), file: path.join(cacheRoot, hash, fileName), strippedUrl };
}

const base = 'https://github.com/electron-userland/electron-builder-binaries/releases/download';
const targets = [
  { url: `${base}/nsis-3.0.4.1/nsis-3.0.4.1.7z`, src: path.join(process.env.TEMP, 'nsis-3.0.4.1.7z') },
  { url: `${base}/nsis-resources-3.4.1/nsis-resources-3.4.1.7z`, src: path.join(process.env.TEMP, 'nsis-resources-3.4.1.7z') }
];

for (const t of targets) {
  const info = cachePathFor(t.url);
  if (!fs.existsSync(t.src)) {
    console.log(`MISSING-SRC ${t.src}`);
    continue;
  }
  fs.mkdirSync(info.dir, { recursive: true });
  fs.copyFileSync(t.src, info.file);
  console.log(`PLACED ${info.file}`);
}
