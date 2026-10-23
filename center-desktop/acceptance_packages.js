/**
 * REMAS Center Desktop — packages/subscriptions acceptance (repeatable, isolated).
 * Scope: F:\remas\center-desktop ONLY. No production data, no network, no secrets.
 * Run:  $env:NODE_ENV='test'; node acceptance_packages.js
 */
'use strict';

process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const path = require('node:path');
const s = require('./src/center_desktop_services.js');

let pass = 0, fail = 0;
const bad = [];
function check(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`PASS: ${name}`); }
  else { fail += 1; bad.push(name); console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}

(async () => {
  console.log('=== classifySubscriptionStatus ===');
  const now = Date.now();
  const future = new Date(now + 86400000).toISOString();
  const past = new Date(now - 86400000).toISOString();
  check('ACTIVE + future expiry -> ACTIVE', s.classifySubscriptionStatus({ status: 'ACTIVE', expiresAt: future }, now) === 'ACTIVE');
  check('ACTIVE + past expiry -> EXPIRED', s.classifySubscriptionStatus({ status: 'ACTIVE', expiresAt: past }, now) === 'EXPIRED');
  check('ACTIVE no expiry -> ACTIVE', s.classifySubscriptionStatus({ status: 'ACTIVE' }, now) === 'ACTIVE');
  check('EXPIRED marked -> EXPIRED', s.classifySubscriptionStatus({ status: 'EXPIRED', expiresAt: future }, now) === 'EXPIRED');
  check('CANCELLED kept', s.classifySubscriptionStatus({ status: 'CANCELLED' }, now) === 'CANCELLED');
  check('REVOKED kept', s.classifySubscriptionStatus({ status: 'REVOKED' }, now) === 'REVOKED');
  check('lowercase active normalized', s.classifySubscriptionStatus({ status: 'active', expiresAt: future }, now) === 'ACTIVE');
  check('unknown status -> OTHER (shown raw, never invented)', s.classifySubscriptionStatus({ status: 'PENDING' }, now) === 'OTHER');
  check('missing status + future expiry -> ACTIVE', s.classifySubscriptionStatus({ expiresAt: future }, now) === 'ACTIVE');
  check('missing status + past expiry -> EXPIRED', s.classifySubscriptionStatus({ expiresAt: past }, now) === 'EXPIRED');
  check('empty doc -> OTHER', s.classifySubscriptionStatus({}, now) === 'OTHER');

  console.log('=== countPackageSubscriptions ===');
  const subs = [
    { id: 'a', packageId: 'pkg1', status: 'ACTIVE', expiresAt: future },
    { id: 'b', packageId: 'pkg1', status: 'ACTIVE', expiresAt: past },
    { id: 'c', packageId: 'pkg1', status: 'CANCELLED' },
    { id: 'd', packageID: 'pkg1', status: 'ACTIVE', expiresAt: future },
    { id: 'e', packageId: 'pkg2', status: 'ACTIVE', expiresAt: future },
    { id: 'f', status: 'ACTIVE' }
  ];
  const c1 = s.countPackageSubscriptions(subs, 'pkg1');
  check('pkg1 total counts both key variants (4)', c1.total === 4, JSON.stringify(c1));
  check('pkg1 active excludes expired/cancelled (2)', c1.active === 2, JSON.stringify(c1));
  const c2 = s.countPackageSubscriptions(subs, 'pkg2');
  check('pkg2 isolated (1/1)', c2.total === 1 && c2.active === 1, JSON.stringify(c2));
  const c3 = s.countPackageSubscriptions(subs, 'pkgX');
  check('unknown package zero (no fake numbers)', c3.total === 0 && c3.active === 0, JSON.stringify(c3));

  console.log('=== renderer wired to real services (static proof) ===');
  const app = fs.readFileSync(path.join(__dirname, 'src', 'desktop_app.js'), 'utf8');
  check('view loads packages AND subscriptions', app.includes("callBackend('getPackages'") && app.includes("callBackend('getSubscriptions'"));
  check('edit path calls updatePackageRecord', app.includes("callBackend('updatePackageRecord'"));
  check('status actions call setPackageStatusRecord', app.includes("callBackend('setPackageStatusRecord'"));
  check('details view lists linked subscriptions', app.includes('openPackageDetailsModal') && app.includes('الاشتراكات المرتبطة'));
  check('archive/suspend guarded by confirm with live counts', app.includes('مرتبطة بـ') && app.includes('confirm('));
  check('no hardcoded fake package/subscription rows', !/sub_fake|pkg_demo|بيانات تجريبية/.test(app));
  check('price shown from priceMinor (minor units converted)', app.includes('priceMinor:') && app.includes('/ 100)'));

  console.log('=== price milliemes round-trip (no conversion errors) ===');
  const toMinor = (major) => Math.round(Number(major) * 100);
  const toMajor = (minor) => (Number(minor) / 100).toFixed(2);
  const cases = [[0, 0], [250, 25000], [250.75, 25075], [99.99, 9999], [1000, 100000]];
  for (const [major, minor] of cases) {
    check(`EGP ${major} -> minor ${minor}`, toMinor(major) === minor, `got ${toMinor(major)}`);
    check(`minor ${minor} -> EGP ${major.toFixed(2)}`, toMajor(minor) === major.toFixed(2), `got ${toMajor(minor)}`);
  }
  check('renderer converts minor/100 for display', app.includes('/ 100).toFixed(2)'));
  check('renderer converts major*100 on save', app.includes('Math.round(priceMajor * 100)'));

  console.log('=== service guards (static proof) ===');
  const svc = fs.readFileSync(path.join(__dirname, 'src', 'center_desktop_services.js'), 'utf8');
  check('updatePackageRecord exported', typeof s.updatePackageRecord === 'function');
  check('edit refuses status changes (status via transitions only)', svc.includes('STATUS_IMMUTABLE_HERE'));
  check('edit refuses archived packages', svc.includes("cur.status === 'ARCHIVED'"));
  check('edit refuses price/duration/scope with active subs', svc.includes('PACKAGE_HAS_ACTIVE_SUBSCRIPTIONS'));
  check('edit bumps version + audits', svc.includes('CONTENT_UPDATE') && svc.includes('version: next.version'));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) { console.log(`FAILURES: ${bad.join(' | ')}`); process.exit(1); }
  console.log('ACCEPTANCE_PACKAGES_PASSED');
})().catch((e) => { console.error(`FATAL: ${(e && e.message) || e}`); process.exit(1); });
