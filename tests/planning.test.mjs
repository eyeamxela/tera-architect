import test from 'node:test';
import assert from 'node:assert/strict';
import { makeJob, scopeRows } from '../app/data.ts';
import { calculatePlan } from '../app/plan-model.ts';
const fixture = (patch = {}) => {
  const j = makeJob();
  return calculatePlan(scopeRows(j.features, j.scale, j.spacing), j.features, {
    ...j.planning,
    ...patch,
  });
};
test('whole phases fit exactly in a budget and reserve reconciles', () => {
  const p = fixture({ budget: 23227.05 });
  assert.deepEqual(
    p.funded.map((p) => p.id),
    ['pond', 'trees'],
  );
  assert.equal(p.remaining, 0);
  assert.equal(p.allowance, 23227.05);
  assert.equal(p.install + p.reserve, p.allowance);
  assert.deepEqual(
    fixture({ budget: 23227.04 }).funded.map((p) => p.id),
    ['pond'],
  );
});
test('priority is preserved instead of silently skipping unaffordable phases', () => {
  assert.equal(fixture({ budget: 6000 }).funded.length, 0);
  assert.deepEqual(
    fixture({ budget: 18000, priority: 'planting' }).funded.map((p) => p.id),
    ['trees'],
  );
});
test('completion dates stay stable when future phases lose funding', () => {
  const full = fixture({ budget: 45000, months: 36 }),
    partial = fixture({ budget: 25000, months: 36 });
  assert.deepEqual(
    full.phases.map((p) => p.month),
    [12, 24, 36],
  );
  assert.deepEqual(
    partial.phases.map((p) => p.month),
    [12, 24, 36],
  );
});
test('care starts after tree delivery and later planting gives less growing time', () => {
  const p = fixture({ months: 36, carePerTree: 25 });
  assert.equal(p.atYear(1).trees, 0);
  assert.equal(p.atYear(2).trees, 80);
  assert.equal(p.atYear(2).care, 0);
  assert.equal(p.atYear(5).care, 6000);
  assert.equal(p.atYear(5).oldestTrees, 3);
  const fast = fixture({ months: 12, carePerTree: 25 });
  assert.ok(fast.atYear(5).care > p.atYear(5).care);
  assert.ok(fast.atYear(5).oldestTrees > p.atYear(5).oldestTrees);
});
test('zero budget and uncalibrated scopes do not invent funded work', () => {
  const p = fixture({ budget: 0 });
  assert.equal(p.atYear(5).total, 0);
  assert.equal(p.atYear(5).trees, 0);
  const j = makeJob(true);
  const empty = calculatePlan(
    scopeRows(j.features, j.scale, j.spacing),
    j.features,
    j.planning,
  );
  assert.equal(empty.phases.length, 0);
});
test('shared financial and schedule assumptions are isolated from draft changes', () => {
  const j = makeJob();
  j.planning.budget = 1000;
  j.planning.months = 60;
  j.features[0].rate = 100;
  assert.equal(j.shared.planning.budget, 35000);
  assert.equal(j.shared.planning.months, 24);
  assert.equal(j.shared.features[0].rate, 8.5);
});
test('negative or non-finite planning inputs are rejected', () => {
  assert.throws(() => fixture({ budget: NaN }));
  assert.throws(() => fixture({ contingency: -1 }));
  assert.throws(() => fixture({ months: 61 }));
});
