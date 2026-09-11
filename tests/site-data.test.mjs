import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mercator,
  unproject,
  pixelPoint,
  parcelBounds,
  profilePoints,
  feetPerPixel,
  readAcreage,
  usableZoning,
  containsPoint,
  demExportUrl,
} from '../app/site-data.ts';
const parcel = [
  [
    [-119.25, 34.44],
    [-119.245, 34.44],
    [-119.245, 34.445],
    [-119.25, 34.445],
    [-119.25, 34.44],
  ],
];
test('geographic transform round trips and fits the exact raster aspect ratio', () => {
  const point = [-119.247, 34.444];
  const restored = unproject(mercator(point));
  assert.ok(Math.abs(restored[0] - point[0]) < 1e-9);
  assert.ok(Math.abs(restored[1] - point[1]) < 1e-9);
  const bounds = parcelBounds(parcel);
  assert.ok(
    Math.abs((bounds[2] - bounds[0]) / (bounds[3] - bounds[1]) - 1.5) < 1e-8,
  );
  for (const p of parcel[0]) {
    const [x, y] = pixelPoint(p, bounds);
    assert.ok(x >= 0 && x <= 1200 && y >= 0 && y <= 800);
  }
});
test('GIS acreage keeps missing data distinct from zero', () => {
  assert.equal(readAcreage('8.7900'), 8.79);
  assert.equal(readAcreage(''), null);
  assert.equal(readAcreage(null), null);
  assert.equal(readAcreage('bad'), null);
});
test('county municipality placeholders cannot masquerade as city zoning', () => {
  assert.deepEqual(
    usableZoning([{ ZONE: 'Ojai', DEFINITION: 'City' }], []),
    [],
  );
  assert.deepEqual(
    usableZoning([{ ZONE: 'RE', DEFINITION: 'Rural Exclusive' }], ['Ojai']),
    [],
  );
  assert.equal(
    usableZoning([{ ZONE: 'RE', DEFINITION: 'Rural Exclusive' }], []).length,
    1,
  );
});
test('address containment respects holes and never assumes nearby means matching', () => {
  assert.equal(containsPoint([-119.247, 34.443], parcel), true);
  assert.equal(containsPoint([-119.26, 34.44], parcel), false);
  const hole = [
    [-119.248, 34.442],
    [-119.246, 34.442],
    [-119.246, 34.444],
    [-119.248, 34.444],
    [-119.248, 34.442],
  ];
  assert.equal(containsPoint([-119.247, 34.443], [...parcel, hole]), false);
});
test('profile endpoints map to A-B and ground scale corrects Web Mercator', () => {
  const bounds = parcelBounds(parcel),
    p = profilePoints(bounds);
  assert.equal(p.length, 17);
  assert.ok(Math.abs(pixelPoint(p[0], bounds)[0]) < 1e-7);
  assert.ok(Math.abs(pixelPoint(p[16], bounds)[0] - 1200) < 1e-7);
  assert.ok(feetPerPixel(bounds) < (bounds[2] - bounds[0]) / 1200 / 0.3048);
});
test('DEM export requests raw elevation instead of a display raster', () => {
  const u = new URL(demExportUrl(parcelBounds(parcel)));
  assert.equal(u.searchParams.get('pixelType'), 'F32');
  assert.equal(u.searchParams.get('format'), 'tiff');
  assert.equal(u.searchParams.get('imageSR'), '32611');
  assert.equal(
    JSON.parse(u.searchParams.get('renderingRule')).rasterFunction,
    'None',
  );
});
