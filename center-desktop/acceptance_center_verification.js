/**
 * REMAS Center Desktop — Final verification acceptance checks (repeatable, isolated).
 *
 * Scope: F:\remas\center-desktop ONLY. No production data, no network, no secrets.
 * Run:  $env:NODE_ENV='test'; node acceptance_center_verification.js
 *
 * What it proves:
 *  A) The fixes exist in the exact files Electron runs (main.js -> src/*, index.html -> src/desktop_app.js).
 *  B) Finance math + statement accuracy offline (paid/unpaid/partial, discount/waiver, no double count).
 *  C) Card binding uses fixed studentId, name preserved, history correct, invalid-ID state detectable.
 *  D) Long Arabic names survive round-trip (card + profile).
 *  E) AI/question persistence paths FAIL CLOSED offline (never fake success) — real
 *     generation/persistence requires on-device network test (explicitly NOT claimed here).
 */
'use strict';

process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const SERVICES_PATH = path.join(ROOT, 'src', 'center_desktop_services.js');
const APP_PATH = path.join(ROOT, 'src', 'desktop_app.js');
const MAIN_PATH = path.join(ROOT, 'main.js');
const INDEX_PATH = path.join(ROOT, 'index.html');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS: ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function mustContain(file, needle, label) {
  const text = fs.readFileSync(file, 'utf8');
  check(label, text.includes(needle), `missing: ${needle.slice(0, 80)}`);
}

(async () => {
  console.log('=== A) fixes present in runtime files ===');
  check('runtime files exist', [SERVICES_PATH, APP_PATH, MAIN_PATH, INDEX_PATH].every((p) => fs.existsSync(p)));
  const main = fs.readFileSync(MAIN_PATH, 'utf8');
  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  check('main.js loads src/center_desktop_services.js', main.includes('./src/center_desktop_services'));
  check('main.js loads src/preload.js', main.includes(path.join('src', 'preload.js')) || main.includes("'src', 'preload.js'"));
  check('index.html loads src/desktop_app.js', index.includes('src/desktop_app.js'));

  // Issue 1 markers
  mustContain(SERVICES_PATH, '/ai/generate-questions', 'AI endpoint path present');
  mustContain(SERVICES_PATH, 'AI_GENERATION_TIMEOUT', 'AI timeout error present');
  mustContain(SERVICES_PATH, 'CORRUPT_SOURCE', 'CORRUPT_SOURCE guidance present');
  mustContain(SERVICES_PATH, 'تجاوزت عملية التوليد حدود الموارد', 'CPU/timeout Arabic message present');
  mustContain(SERVICES_PATH, 'مزود الذكاء الاصطناعي', 'provider-key Arabic message present');
  // Issue 2 markers
  mustContain(APP_PATH, 'const studentCell = (c) => {', 'cards view studentCell present');
  mustContain(APP_PATH, 'معرف غير صحيح', 'invalid-card-ID state present');
  mustContain(APP_PATH, 'غير مرتبط بطالب', 'unlinked-card state present');
  mustContain(APP_PATH, "getStudentById', currentCallerToken, card.studentId", 'card preview fetches by fixed studentId');
  mustContain(APP_PATH, 'linkedName', 'replace-modal student name present');
  mustContain(APP_PATH, 'dir="rtl"', 'RTL direction present for Arabic names');
  // Issue 3 markers
  mustContain(APP_PATH, 'width:min(980px', 'profile modal widened to 980px');
  mustContain(APP_PATH, "getStudentStatement', currentCallerToken, studentId", 'profile fetches real statement');
  mustContain(APP_PATH, 'الحساب المالي — المستحق / المدفوع / المتبقي (من السجلات الفعلية)', 'profile financial section present');
  mustContain(APP_PATH, "openStudentStatementModal('${student.id}')", 'profile links to full statement');

  console.log('=== B) finance accuracy offline (isolated tenant) ===');
  const s = require('./src/center_desktop_services.js');
  const tok = { uid: 'accept_tester', role: 'institutionOwner', institutionId: 'inst_accept_verify_1' };

  const full = s.calcChargeBalance({ id: 't_full', dueAmount: 1000, discount: 100, waiver: 0 }, [{ amount: 400 }, { amount: 500 }]);
  check('paid-in-full invoice: remaining 0, status PAID (not debt)', full.remaining === 0 && full.status === 'PAID', JSON.stringify(full));
  const unpaid = s.calcChargeBalance({ id: 't_unpaid', dueAmount: 700, discount: 0, waiver: 0 }, []);
  check('unpaid invoice: remaining 700, status UNPAID', unpaid.remaining === 700 && unpaid.status === 'UNPAID', JSON.stringify(unpaid));
  const partial = s.calcChargeBalance({ id: 't_part', dueAmount: 1000, discount: 200, waiver: 100 }, [{ amount: 300 }]);
  check('partial with discount+waiver: net 700, paid 300, remaining 400', partial.net === 700 && partial.paid === 300 && partial.remaining === 400, JSON.stringify(partial));

  const stu = await s.createStudent(tok, { institutionId: 'inst_accept_verify_1', name: 'طالب قبول مالي', phone: '01001234567', guardianPhone: '01007654321' });
  const chA = await s.assignStudentCharge(tok, { institutionId: 'inst_accept_verify_1', studentId: stu.id, amount: 1000 });
  const chB = await s.assignStudentCharge(tok, { institutionId: 'inst_accept_verify_1', studentId: stu.id, amount: 500, discount: 50 });
  await s.recordPayment(tok, { institutionId: 'inst_accept_verify_1', studentId: stu.id, chargeId: chA.id, amount: 1000, paymentMethod: 'CASH', paymentDate: '2026-10-01' });
  const stmt = await s.getStudentStatement(tok, stu.id, 'inst_accept_verify_1');
  check('statement due 1500 (1000 + 500)', stmt.totals.due === 1500, JSON.stringify(stmt.totals));
  check('statement paid 1000 (single payment, no duplication)', stmt.totals.paid === 1000 && stmt.payments.length === 1, JSON.stringify({ paid: stmt.totals.paid, n: stmt.payments.length }));
  check('statement remaining 450 (paid invoice not counted as debt)', stmt.totals.remaining === 450, JSON.stringify(stmt.totals));
  check('payment history carries date+method', (stmt.payments[0].paymentDate === '2026-10-01') && !!stmt.payments[0].paymentMethod, JSON.stringify(stmt.payments[0]));

  const stuEmpty = await s.createStudent(tok, { institutionId: 'inst_accept_verify_1', name: 'طالب بلا معاملات', phone: '01009876543', guardianPhone: '01001112222' });
  const stmtEmpty = await s.getStudentStatement(tok, stuEmpty.id, 'inst_accept_verify_1');
  check('empty student: all totals zero (explicit, not fabricated)', stmtEmpty.totals.due === 0 && stmtEmpty.totals.paid === 0 && stmtEmpty.totals.remaining === 0, JSON.stringify(stmtEmpty.totals));

  console.log('=== C) card binding by fixed studentId ===');
  const made = await s.generateStudentCards(tok, { institutionId: 'inst_accept_verify_1', count: 1 });
  const card = made[0];
  check('generated card starts AVAILABLE unlinked', card.status === 'AVAILABLE' && !card.studentId, JSON.stringify({ status: card.status, studentId: card.studentId }));
  const bound = await s.assignStudentCard(tok, stu.id, card.id, 'inst_accept_verify_1');
  check('card bound by fixed studentId', bound.card.studentId === stu.id, JSON.stringify({ want: stu.id, got: bound.card.studentId }));
  check('student pointer matches card (no duplicate binding)', bound.student.studentCardId === card.id, JSON.stringify({ want: card.id, got: bound.student.studentCardId }));
  const refetched = await s.getStudentById(tok, stu.id, 'inst_accept_verify_1');
  check('student name unchanged after binding', refetched.name === stu.name, JSON.stringify({ want: stu.name, got: refetched.name }));
  const hist = await s.getStudentCardHistory(tok, stu.id, 'inst_accept_verify_1');
  check('card history current points at bound card', hist.currentCardId === card.id && hist.cards.length === 1, JSON.stringify({ cur: hist.currentCardId, n: hist.cards.length }));
  let dupBlocked = false;
  try {
    const made2 = await s.generateStudentCards(tok, { institutionId: 'inst_accept_verify_1', count: 1 });
    await s.assignStudentCard(tok, stu.id, made2[0].id, 'inst_accept_verify_1');
  } catch (e) {
    dupBlocked = /STUDENT_ALREADY_HAS_CARD|CARD_NOT_AVAILABLE/.test(String((e && e.message) || e));
  }
  check('second card for same student blocked (no duplicate links)', dupBlocked === true);

  console.log('=== D) long Arabic names round-trip ===');
  const longName = 'عبد الرحمن محمد السيد أحمد الفاروق عبد الله الطويل للتحقق من عرض الأسماء العربية الطويلة';
  const stuLong = await s.createStudent(tok, { institutionId: 'inst_accept_verify_1', name: longName, phone: '01005556666', guardianPhone: '01006667777' });
  const gotLong = await s.getStudentById(tok, stuLong.id, 'inst_accept_verify_1');
  check('long Arabic name preserved exactly', gotLong.name === longName, `len want ${longName.length} got ${(gotLong.name || '').length}`);

  console.log('=== E) AI/question persistence fail closed offline ===');
  let aiClosed = false;
  try {
    await s.requestAiQuestionGeneration(tok, { institutionId: 'inst_accept_verify_1', academicYearId: 'y', stageId: 'st', subjectId: 'su', sourceId: 'src', count: 1, types: ['MCQ'] });
  } catch (e) {
    aiClosed = /OFFLINE/.test(String((e && e.message) || e));
  }
  check('AI generation offline fails closed (no mock success)', aiClosed === true);
  let qClosed = false;
  try {
    await s.createQuestionRecord(tok, { institutionId: 'inst_accept_verify_1', prompt: 'سؤال؟', subjectId: 'su', questionType: 'MCQ', options: [{ optionId: 'a', text: 'أ', isCorrect: true }, { optionId: 'b', text: 'ب', isCorrect: false }] });
  } catch (e) {
    qClosed = /OFFLINE/.test(String((e && e.message) || e));
  }
  check('question persistence offline fails closed (no fake save)', qClosed === true);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`FAILURES: ${failures.join(' | ')}`);
    process.exit(1);
  }
  console.log('ACCEPTANCE_CENTER_VERIFICATION_PASSED');
})().catch((e) => {
  console.error(`FATAL: ${(e && e.message) || e}`);
  process.exit(1);
});
