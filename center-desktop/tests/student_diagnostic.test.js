/**
 * Student diagnostic — computed from real grade records only.
 * Extracts the pure computeStudentDiagnostic() block from the renderer
 * (desktop_app.js is a browser script) and runs it in an isolated VM.
 * Run: node --test tests/student_diagnostic.test.js
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'desktop_app.js'), 'utf8');
const start = SRC.indexOf('const DIAGNOSTIC_MIN_EXAMS');
const end = SRC.indexOf('async function renderStudentDiagnosticView');
assert.ok(start > 0 && end > start, 'diagnostic block not found in renderer');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${SRC.slice(start, end)}; this.compute = computeStudentDiagnostic;`, ctx);
const compute = ctx.compute;

const student = { id: 'S1', name: 'أحمد' };
const subjects = [{ id: 'math', name: 'رياضيات' }, { id: 'sci', name: 'علوم' }];
const exams = [
  { id: 'E1', title: 'شهر 1', subjectId: 'math', date: '2026-01-10' },
  { id: 'E2', title: 'شهر 2', subjectId: 'math', date: '2026-02-10' },
  { id: 'E3', title: 'علوم 1', subjectId: 'sci', date: '2026-03-10' },
  { id: 'E4', title: 'علوم 2', subjectId: 'sci', date: '2026-04-10' }
];

test('renderer contains no hardcoded mastery number', () => {
  assert.ok(!/const masteryPercentage = \d+/.test(SRC), 'hardcoded masteryPercentage still present');
  assert.ok(!SRC.includes('إتقان تام لحل مسائل القوانين الرياضية'), 'canned strengths text still present');
});

test('no grades => insufficient, no tier, nothing invented', () => {
  const d = compute(student, [], exams, subjects);
  assert.strictEqual(d.sufficient, false);
  assert.strictEqual(d.tier, null);
  assert.strictEqual(d.average, null);
  assert.strictEqual(d.gradedCount, 0);
});

test('one graded exam is not enough for a level', () => {
  const d = compute(student, [{ studentId: 'S1', examId: 'E1', percentage: 90 }], exams, subjects);
  assert.strictEqual(d.sufficient, false);
  assert.strictEqual(d.tier, null);
});

test('average + tier come from the real percentages', () => {
  const d = compute(student, [
    { studentId: 'S1', examId: 'E1', percentage: 90 },
    { studentId: 'S1', examId: 'E2', percentage: 80 }
  ], exams, subjects);
  assert.strictEqual(d.sufficient, true);
  assert.strictEqual(d.average, 85);
  assert.strictEqual(d.tier.key, 'EXCELLENT');
});

test('tier boundaries: 70 advanced, 50 average, 49 weak', () => {
  const two = (p) => [{ studentId: 'S1', examId: 'E1', percentage: p }, { studentId: 'S1', examId: 'E2', percentage: p }];
  assert.strictEqual(compute(student, two(70), exams, subjects).tier.key, 'ADVANCED');
  assert.strictEqual(compute(student, two(50), exams, subjects).tier.key, 'AVERAGE');
  assert.strictEqual(compute(student, two(49), exams, subjects).tier.key, 'WEAK');
});

test('canonical percentageHundredths and score/maxScore shapes are both read', () => {
  const d = compute(student, [
    { studentId: 'S1', examId: 'E1', gradingStatus: 'FINALIZED', percentageHundredths: 6000 },
    { studentId: 'S1', examId: 'E2', score: 16, maxScore: 20 }
  ], exams, subjects);
  assert.strictEqual(d.average, 70);
});

test('pending canonical grades are excluded, not averaged', () => {
  const d = compute(student, [
    { studentId: 'S1', examId: 'E1', percentage: 80 },
    { studentId: 'S1', examId: 'E2', percentage: 80 },
    { studentId: 'S1', examId: 'E3', gradingStatus: 'DRAFT', percentageHundredths: 1000 }
  ], exams, subjects);
  assert.strictEqual(d.average, 80);
  assert.strictEqual(d.pending, 1);
});

test('absences are counted separately, never as zero', () => {
  const d = compute(student, [
    { studentId: 'S1', examId: 'E1', percentage: 80 },
    { studentId: 'S1', examId: 'E2', percentage: 80 },
    { studentId: 'S1', examId: 'E3', attendanceStatus: 'ABSENT', score: 0, maxScore: 20, percentage: 0 }
  ], exams, subjects);
  assert.strictEqual(d.average, 80);
  assert.strictEqual(d.absences, 1);
});

test("other students' grades never leak into the report", () => {
  const d = compute(student, [
    { studentId: 'S1', examId: 'E1', percentage: 40 },
    { studentId: 'S1', examId: 'E2', percentage: 40 },
    { studentId: 'OTHER', examId: 'E1', percentage: 100 },
    { studentId: 'OTHER', examId: 'E2', percentage: 100 }
  ], exams, subjects);
  assert.strictEqual(d.average, 40);
  assert.strictEqual(d.gradedCount, 2);
});

test('strengths / gaps are real per-subject averages', () => {
  const d = compute(student, [
    { studentId: 'S1', examId: 'E1', percentage: 90 },
    { studentId: 'S1', examId: 'E2', percentage: 80 },
    { studentId: 'S1', examId: 'E3', percentage: 40 },
    { studentId: 'S1', examId: 'E4', percentage: 50 }
  ], exams, subjects);
  assert.deepStrictEqual(JSON.stringify(d.strengths.map((s) => s.name)), JSON.stringify(['رياضيات']));
  assert.deepStrictEqual(JSON.stringify(d.gaps.map((s) => s.name)), JSON.stringify(['علوم']));
});

test('trend: chronological, needs >= 3 exams, detects decline', () => {
  assert.strictEqual(compute(student, [
    { studentId: 'S1', examId: 'E1', percentage: 90 },
    { studentId: 'S1', examId: 'E2', percentage: 80 }
  ], exams, subjects).trend, null);
  const d = compute(student, [
    { studentId: 'S1', examId: 'E4', percentage: 50 }, // newest, given first on purpose
    { studentId: 'S1', examId: 'E1', percentage: 90 },
    { studentId: 'S1', examId: 'E2', percentage: 85 },
    { studentId: 'S1', examId: 'E3', percentage: 60 }
  ], exams, subjects);
  assert.strictEqual(d.trend.direction, 'DOWN');
});
