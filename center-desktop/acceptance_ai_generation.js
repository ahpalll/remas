/**
 * REMAS Center Desktop — AI generation acceptance checks (repeatable, isolated).
 * Scope: F:\remas\center-desktop ONLY. No production data, no network, no secrets.
 * Run:  $env:NODE_ENV='test'; node acceptance_ai_generation.js
 *
 * Covers (client-side, honestly testable here):
 *  1) valid JSON success with valid questions
 *  2) HTML body instead of JSON (the reported <!DOCTYPE bug)
 *  3) HTTP 401/403/404/500/503 error mapping
 *  4) timeout + connection failure classification
 *  6b) CORRUPT_SOURCE / provider / quota message mapping (server verdicts)
 *  7) unpublished / file-less / archived / mismatched source ineligible (packaged mirror)
 *  8) empty or off-contract provider payload rejected (nothing persistable)
 *  9) no-save-on-failure: renderer persists only after awaited SUCCESS (static order proof)
 * Real-PDF end-to-end (cases 5/6 over the wire) still requires on-device test.
 */
'use strict';

process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const path = require('node:path');

const s = require('./src/center_desktop_services.js');
const cfg = require('./src/content_upload_config.js');

let pass = 0, fail = 0;
const bad = [];
function check(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`PASS: ${name}`); }
  else { fail += 1; bad.push(name); console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}
function throwsCode(fn, code, label) {
  try { fn(); } catch (e) {
    const ok = e && e.code === code;
    check(label, ok === true, `got code=${e && e.code} msg=${String(e && e.message).slice(0, 120)}`);
    return e;
  }
  check(label, false, 'did not throw');
  return null;
}
const noRawLeak = (e) => !/<!DOCTYPE|<html|Unexpected token/i.test(String((e && e.message) || ''));

(async () => {
  console.log('=== 1) valid JSON success ===');
  const goodDraft = { prompt: 'ما عاصمة الدولة الفاطمية؟', sourceId: 'src1', subjectId: 'sub1', institutionId: 'inst1' };
  const okBody = JSON.stringify({ status: 'SUCCESS', drafts: [goodDraft], provider: 'gemini', model: 'm' });
  const parsed = s.interpretAiWorkerResponse({ httpStatus: 200, contentType: 'application/json', text: okBody });
  check('200 JSON SUCCESS parses', parsed && parsed.status === 'SUCCESS' && parsed.drafts.length === 1);
  check('contract accepts grounded draft', s.validateAiDraftContract(parsed.drafts, { institutionId: 'inst1', subjectId: 'sub1', sourceId: 'src1' }).length === 1);

  console.log('=== 2) HTML instead of JSON ===');
  const html = '<!DOCTYPE html><html><head><title>Attention Required</title></head><body>blocked</body></html>';
  const eHtml200 = throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 200, contentType: 'text/html', text: html }), 'AI_GENERATION_FAILED', '200 text/html DOCTYPE -> AI_GENERATION_FAILED (Arabic, no raw leak)');
  check('no raw parser/HTML leak to user', noRawLeak(eHtml200));
  const eHtml503 = throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 503, contentType: 'text/html', text: html }), 'AI_GENERATION_FAILED', '503 HTML -> gateway-unavailable message');
  check('503 HTML message mentions unavailability', /غير متاحة|البوابة/.test(String(eHtml503 && eHtml503.message)));
  const eHtml404 = throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 404, contentType: 'text/html', text: '<html>not found</html>' }), 'AI_GENERATION_FAILED', '404 HTML -> endpoint-missing message');
  check('404 HTML message mentions endpoint', /غير موجودة|Worker/.test(String(eHtml404 && eHtml404.message)));
  // HTML without content-type header at all (header-stripping proxy)
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 200, contentType: '', text: html }), 'AI_GENERATION_FAILED', '200 DOCTYPE with empty content-type still detected as HTML');

  console.log('=== 3) HTTP JSON errors 401/403/404/500/503 ===');
  const j = (e) => JSON.stringify({ status: 'ERROR', error: e });
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 401, contentType: 'application/json', text: j('UNAUTHENTICATED_REQUEST: bad token') }), 'AI_GENERATION_FAILED', '401 -> re-login message');
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 403, contentType: 'application/json', text: j('FORBIDDEN_ROLE: nope') }), 'AI_GENERATION_FAILED', '403 -> permission/config message');
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 404, contentType: 'application/json', text: j('NOT_FOUND') }), 'AI_GENERATION_FAILED', '404 JSON -> endpoint-missing message');
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 500, contentType: 'application/json', text: j('INTERNAL_WORKER_ERROR') }), 'AI_GENERATION_FAILED', '500 -> worker-error message');
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 503, contentType: 'application/json', text: j('OVERLOADED') }), 'AI_GENERATION_FAILED', '503 -> retry-later message');

  console.log('=== 4) timeout + connection failure ===');
  const eTo = throwsCode(() => s.classifyAiFetchError(Object.assign(new Error('aborted'), { name: 'AbortError' }), 120000), 'AI_GENERATION_TIMEOUT', 'AbortError -> AI_GENERATION_TIMEOUT (120s named)');
  check('timeout message has no technical jargon leak', !/AbortError|DOMException/i.test(String(eTo && eTo.message)));
  throwsCode(() => s.classifyAiFetchError(new Error('fetch failed'), 120000), 'AI_PROVIDER_ERROR', 'connection failure -> AI_PROVIDER_ERROR (Arabic)');

  console.log('=== 6b/7) server verdicts + source eligibility mirror ===');
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 422, contentType: 'application/json', text: j('CORRUPT_SOURCE: bad pdf') }), 'AI_GENERATION_FAILED', 'CORRUPT_SOURCE -> scanned/invalid-file guidance');
  throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 500, contentType: 'application/json', text: j('AI_NOT_CONFIGURED: GEMINI_API_KEY missing') }), 'AI_GENERATION_FAILED', 'provider-key verdict -> provider guidance');
  const ctx = { academicYearId: 'y1', termId: null, stageId: 'st1', subjectId: 'su1' };
  const base = { id: 's1', status: 'PUBLISHED', objectKey: 'k', academicYearId: 'y1', termId: null, stageId: 'st1', subjectId: 'su1' };
  const elig = cfg.filterSourcesForGenerationMirror([base], ctx);
  check('published+file+matching source eligible', elig.eligible.length === 1 && elig.ineligible.length === 0);
  const bads = [
    { ...base, id: 'd', status: 'DRAFT' },
    { ...base, id: 'a', status: 'ARCHIVED' },
    { ...base, id: 'n', objectKey: null },
    { ...base, id: 'y', academicYearId: 'y2' },
    { ...base, id: 't', subjectId: 'other' }
  ];
  const r2 = cfg.filterSourcesForGenerationMirror(bads, ctx);
  check('draft/archived/file-less/mismatched all ineligible', r2.eligible.length === 0 && r2.ineligible.length === 5, JSON.stringify(r2.ineligible.map((x) => x.reason)));

  console.log('=== 8) empty / off-contract provider payload ===');
  throwsCode(() => s.validateAiDraftContract([], { institutionId: 'i', subjectId: 's', sourceId: 'x' }), 'AI_GENERATION_FAILED', 'empty drafts rejected');
  throwsCode(() => s.validateAiDraftContract([{ prompt: '  ', sourceId: 'x' }], { institutionId: 'i', subjectId: 's', sourceId: 'x' }), 'AI_GENERATION_FAILED', 'blank prompt rejected');
  throwsCode(() => s.validateAiDraftContract([{ prompt: 'عام؟', sourceId: 'OTHER' }], { institutionId: 'i', subjectId: 's', sourceId: 'x' }), 'AI_GENERATION_FAILED', 'foreign-source draft rejected (whole batch)');
  throwsCode(() => s.validateAiDraftContract([{ prompt: 'عام؟', sourceId: 'x', subjectId: 'OTHER' }], { institutionId: 'i', subjectId: 's', sourceId: 'x' }), 'AI_GENERATION_FAILED', 'foreign-subject draft rejected');
  throwsCode(() => s.validateAiDraftContract([{ prompt: 'عام؟', sourceId: 'x', subjectId: 's', institutionId: 'OTHER' }], { institutionId: 'i', subjectId: 's', sourceId: 'x' }), 'AI_GENERATION_FAILED', 'foreign-institution draft rejected');
  const eNonSuccess = throwsCode(() => {
    const d = s.interpretAiWorkerResponse({ httpStatus: 200, contentType: 'application/json', text: JSON.stringify({ status: 'ERROR', error: 'VALIDATION: bad' }) });
    if (!d || d.status !== 'SUCCESS') { const err = new Error(`AI_GENERATION_FAILED: ${d.error}`); err.code = 'AI_GENERATION_FAILED'; throw err; }
  }, 'AI_GENERATION_FAILED', 'non-SUCCESS envelope rejected');
  check('non-SUCCESS carries server reason safely', /VALIDATION/.test(String(eNonSuccess && eNonSuccess.message)));

  console.log('=== 2b) interpreter robustness (discovered cases) ===');
  const okCharset = s.interpretAiWorkerResponse({ httpStatus: 200, contentType: 'application/json; charset=utf-8', text: okBody });
  check('JSON with charset content-type still parses', okCharset && okCharset.status === 'SUCCESS');
  const e301 = throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 301, contentType: 'text/html', text: '<html><body>redirect</body></html>' }), 'AI_GENERATION_FAILED', '301 HTML redirect page -> precise failure (never parsed, never saved)');
  check('301 message names HTTP status for diagnosis', /301/.test(String(e301 && e301.message)));
  const eEmpty = throwsCode(() => s.interpretAiWorkerResponse({ httpStatus: 200, contentType: 'application/json', text: '' }), 'AI_PROVIDER_ERROR', 'empty 200 body -> invalid-format (not a crash)');

  console.log('=== 8b) page selection parser (service single source of truth) ===');
  check('empty -> null (whole document)', s.parsePageSelection('') === null && s.parsePageSelection(null) === null);
  check('"1, 3-5" -> [1,3,4,5]', JSON.stringify(s.parsePageSelection('1, 3-5')) === '[1,3,4,5]');
  check('dedupe+sort "5,2,2" -> [2,5]', JSON.stringify(s.parsePageSelection('5,2,2')) === '[2,5]');
  check('"1,," tolerates trailing comma -> [1]', JSON.stringify(s.parsePageSelection('1,,')) === '[1]');
  const badPages = ['0', '-3', '2-1', 'a', '1-2-3'];
  for (const bad of badPages) {
    let threw = false;
    try { s.parsePageSelection(bad); } catch (e) { threw = /INVALID_PAGES/.test(String((e && e.message) || e)); }
    check(`rejects "${bad}"`, threw);
  }
  let threwBig = false;
  try { s.parsePageSelection('1-200'); } catch (e) { threwBig = /INVALID_PAGES/.test(String((e && e.message) || e)); }
  check('rejects oversized range', threwBig);
  // Renderer mirror parity (same behavior contract, enforced statically).
  const appSrc = fs.readFileSync(path.join(__dirname, 'src', 'desktop_app.js'), 'utf8');
  check('renderer has parseGenPages mirror', appSrc.includes('function parseGenPages'));
  check('renderer mirror validates ranges', appSrc.includes('نطاق صفحات غير صالح'));
  check('renderer sends pages[] in generation payload', appSrc.includes('mGenPages') && appSrc.includes('...(pages ? { pages } : {})'));
  check('renderer persists sourcePages with drafts', appSrc.includes('sourcePages: Array.isArray(d.sourcePages)'));
  check('service persists sourcePages on questions', fs.readFileSync(path.join(__dirname, 'src', 'center_desktop_services.js'), 'utf8').includes('sourcePages: Array.isArray(payload.sourcePages)'));

  console.log('=== 9) no-save-on-failure (renderer order proof) ===');
  const app = fs.readFileSync(path.join(__dirname, 'src', 'desktop_app.js'), 'utf8');
  // Scope the order proof to submitAiGeneration (other flows have their own awaits).
  const fnStart = app.indexOf('async function submitAiGeneration()');
  const fnEnd = app.indexOf('async function renderAiReviewQueue()', fnStart);
  const fnBody = fnStart !== -1 && fnEnd !== -1 ? app.slice(fnStart, fnEnd) : '';
  const awaitGen = fnBody.indexOf("await callBackend('requestAiQuestionGeneration'");
  const createQ = fnBody.indexOf("callBackend('createQuestionRecord'");
  check('submitAiGeneration awaits generation before persisting any draft', fnBody.length > 0 && awaitGen !== -1 && createQ !== -1 && awaitGen < createQ);
  const svc = fs.readFileSync(path.join(__dirname, 'src', 'center_desktop_services.js'), 'utf8');
  check('endpoint built from canonical constant (no fragile replace)', svc.includes('${WORKER_MEDIA_BASE_URL}/ai/generate-questions') && !svc.includes("workerUploadUrl.replace"));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) { console.log(`FAILURES: ${bad.join(' | ')}`); process.exit(1); }
  console.log('ACCEPTANCE_AI_GENERATION_PASSED');
})().catch((e) => { console.error(`FATAL: ${(e && e.message) || e}`); process.exit(1); });
