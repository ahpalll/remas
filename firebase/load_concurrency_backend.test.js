/**
 * Phase 30 — Load & Concurrency Backend Unit Test Suite
 * REMAS Educational Center SaaS Monorepo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TARGET_PROJECT_ID,
  runLoadAndConcurrencyBenchmarks
} = require('./load_concurrency_benchmarks');

describe('Phase 30 — Load & Concurrency Benchmarking Suite', () => {

  it('1. Target Project Alignment — Aligns target project strictly to educenter-saas', () => {
    assert.equal(TARGET_PROJECT_ID, 'educenter-saas');
  });

  it('2. Roster Attendance Load Test — Executes concurrent attendance mutations cleanly', async () => {
    const bench = await runLoadAndConcurrencyBenchmarks({ concurrencyLevel: 50, operationsCount: 100 });
    assert.equal(bench.status, 'BENCHMARKS_COMPLETE');
    assert.equal(bench.targetProjectId, 'educenter-saas');
    assert.equal(bench.metrics.rosterAttendance.totalRequests, 100);
    assert.equal(bench.metrics.rosterAttendance.passes, 100);
    assert.equal(bench.metrics.rosterAttendance.failures, 0);
  });

  it('3. Race Condition Defeated — Prevents duplicate attendance writes under concurrent same-student attempts', async () => {
    const bench = await runLoadAndConcurrencyBenchmarks({ concurrencyLevel: 10, operationsCount: 50 });
    const race = bench.metrics.raceConditionProtection;
    assert.equal(race.concurrentAttempts, 10);
    assert.equal(race.successfulWrites, 1, 'Only 1 attendance write must succeed for same student/session');
    assert.equal(race.duplicateRejections, 9, 'Subsequent concurrent attempts must be rejected as duplicate');
    assert.equal(race.raceConditionDefeated, true);
  });

  it('4. Group Capacity Limit Protection — Enforces maxCapacity limit under concurrent enrollment pressure', async () => {
    const bench = await runLoadAndConcurrencyBenchmarks({ concurrencyLevel: 30, operationsCount: 50 });
    const cap = bench.metrics.capacityProtection;
    assert.equal(cap.totalEnrollmentAttempts, 30);
    assert.equal(cap.maxCapacityLimit, 20);
    assert.ok(cap.successfulEnrolled <= 20, 'Enrolled count must never exceed maxCapacity');
    assert.equal(cap.capacityLimitRespected, true);
  });

  it('5. Cross-Tenant Concurrency Leak Isolation — Rejects cross-tenant operations under concurrent load', async () => {
    const bench = await runLoadAndConcurrencyBenchmarks({ concurrencyLevel: 20, operationsCount: 50 });
    const iso = bench.metrics.tenantIsolationProtection;
    assert.equal(iso.totalConcurrentCrossTenantRequests, 20);
    assert.equal(iso.crossTenantViolationsBlocked, 10, 'All 10 cross-tenant requests must be blocked');
    assert.equal(iso.isolationIntact, true);
  });

  it('6. Performance Metric Benchmarks — Calculates latency & pass rate metrics', async () => {
    const bench = await runLoadAndConcurrencyBenchmarks({ concurrencyLevel: 50, operationsCount: 100 });
    assert.ok(bench.metrics.avgLatencyMs >= 0);
    assert.ok(bench.metrics.overallPassRatePercent >= 95);
    assert.ok(bench.bottleneckAnalysis.firestoreWriteContention);
    assert.ok(bench.bottleneckAnalysis.capacityCounterRace);
    assert.ok(bench.bottleneckAnalysis.crossTenantLeakRisk);
  });

});
