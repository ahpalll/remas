/**
 * REMAS update launcher script builder.
 *
 * The Electron app cannot replace its own files while running (Windows file
 * locks), so installation is deferred to a detached cmd script that:
 *   1. polls until THIS app's PID has fully exited (safe close timing),
 *   2. then launches the NSIS installer in silent mode.
 *
 * Extracted from main.js so the exact production template can be unit-tested
 * and behaviorally tested (real process + real script) without Electron.
 */

/**
 * Build the .cmd launcher script.
 * @param {number} pid        PID of the app process to wait for
 * @param {string} installerPath absolute path to the downloaded installer
 * @param {string} installArgs   extra installer args (production: '/S';
 *                               tests may append '/D=<isolated dir>')
 * @returns {string} script contents (CRLF)
 */
function buildUpdateLauncherScript(pid, installerPath, installArgs = '/S') {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error('PID غير صالح لسكربت التحديث');
  }
  if (!installerPath || typeof installerPath !== 'string') {
    throw new Error('مسار المثبّت غير صالح لسكربت التحديث');
  }
  const safePath = installerPath.replace(/"/g, '""');
  return (
    '@echo off\r\n' +
    ':waitloop\r\n' +
    `tasklist /FI "PID eq ${pid}" 2>NUL | find /I "${pid}" >NUL\r\n` +
    'if NOT ERRORLEVEL 1 (timeout /T 1 /NOBREAK >NUL & goto waitloop)\r\n' +
    `start "" "${safePath}" ${installArgs}\r\n`
  );
}

module.exports = { buildUpdateLauncherScript };
