import test from 'node:test';
import assert from 'node:assert/strict';
import {
  metrics,
  plantingPoints,
  inside,
  scopeRows,
  makeJob,
  validPolygon,
  layoutFits,
} from '../app/data.ts';
const rect = [
  [0, 0],
  [30, 0],
  [30, 20],
  [0, 20],
];
test('calibrated dimensions and area match a known rectangle', () => {
  const m = metrics(rect, 2);
  assert.equal(m.area, 2400);
  assert.equal(m.perimeter, 200);
  assert.equal(m.width, 60);
  assert.equal(m.height, 40);
});
test('image resizing preserves calibrated geometry', () => {
  const a = metrics(rect, 2),
    b = metrics(
      rect.map(([x, y]) => [x / 2, y / 2]),
      4,
    );
  assert.deepEqual(a, b);
});
test('open paths never include closing distance or enclosed area', () => {
  const m = metrics(
    [
      [0, 0],
      [3, 0],
      [3, 4],
    ],
    2,
    false,
  );
  assert.equal(m.perimeter, 14);
  assert.equal(m.area, 0);
});
test('planting positions remain inside boundary and obey spacing', () => {
  const points = plantingPoints(rect, 2, 10);
  assert.equal(points.length, 24);
  for (const p of points) assert.ok(inside(p, rect));
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      assert.ok(
        Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) *
          2 >=
          10 - 1e-8,
      );
});
test('missing scale produces no scope quantities or planting layout', () => {
  const job = makeJob();
  assert.deepEqual(scopeRows(job.features, 0, 25), []);
  assert.deepEqual(plantingPoints(rect, 0, 25), []);
});
test('excluded features do not contribute to a scope', () => {
  const job = makeJob();
  job.features[0].included = false;
  const rows = scopeRows(job.features, job.scale, job.spacing);
  assert.ok(!rows.some((r) => r.id === 'pond'));
  assert.equal(
    rows.reduce((s, r) => s + r.total, 0),
    rows.reduce((s, r) => s + r.quantity * r.rate, 0),
  );
});
test('shared revision is a snapshot independent of draft edits', () => {
  const job = makeJob();
  const old = job.shared.features[0].description;
  job.features[0].description = 'Changed draft';
  assert.equal(job.shared.features[0].description, old);
});
test('crossing boundaries and excessive planting density are rejected', () => {
  assert.ok(validPolygon(rect));
  assert.equal(
    validPolygon([
      [0, 0],
      [100, 100],
      [0, 100],
      [80, 0],
    ]),
    false,
  );
  assert.equal(layoutFits(rect, 1e10, 10), false);
  assert.deepEqual(plantingPoints(rect, 1e10, 10), []);
});
