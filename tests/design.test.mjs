import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  disciplineIds,
  makeDesignScope,
  toggleDiscipline,
  designRows,
  designIssues,
  designInvestment,
  designSchedule,
  publicDesignScope,
  costTotal,
  emptyArchitectDraft,
} from '../app/design-model.ts';
import { scopeRows } from '../app/data.ts';
import { designSchema } from '../server/design-schema.ts';
import {
  draftSchema,
  draftFromJob,
  proposalSchema,
} from '../server/contracts.ts';
import { connectDatabase, migrate } from '../server/db.ts';
import { BuildService } from '../server/service.ts';
import { seedLocal, localAccounts } from '../server/seed.ts';
const key = () => randomUUID();
function priced(enabled = [...disciplineIds]) {
  const scope = makeDesignScope(enabled);
  for (const [i, id] of disciplineIds.entries()) {
    const s = scope.sections[id];
    s.costs = [
      { ...s.costs[0], quantity: 2, rate: (i + 1) * 100, taxable: true },
    ];
    s.startWeek = 0;
    s.leadWeeks = 1;
    s.durationWeeks = 4;
  }
  return scope;
}
const rows = (scope) => scopeRows([], 0, 25, [], scope);
test('all 15 combinations select only their costs and preserve unselected drafts', () => {
  for (let mask = 1; mask < 16; mask++) {
    const enabled = disciplineIds.filter((_, i) => mask & (1 << i)),
      s = priced(enabled);
    assert.equal(designSchema.safeParse(s).success, true);
    assert.deepEqual(designIssues(s), []);
    assert.deepEqual(
      rows(s).map((r) => r.discipline),
      enabled,
    );
    assert.equal(
      designInvestment(s, rows(s), 0, 0).subtotal,
      enabled.reduce(
        (sum, id) => sum + (disciplineIds.indexOf(id) + 1) * 200,
        0,
      ),
    );
  }
  const s = priced();
  s.sections.furniture.brief.intent = 'An heirloom table';
  const off = toggleDiscipline(s, 'furniture');
  assert.equal(
    off.sections.furniture.brief.intent,
    s.sections.furniture.brief.intent,
  );
  assert.deepEqual(
    toggleDiscipline(off, 'furniture').sections.furniture,
    s.sections.furniture,
  );
  const single = priced(['interiors']);
  assert.deepEqual(toggleDiscipline(single, 'interiors'), single);
});
test('unknown quantity or rate remains unpriced, explicit zero is a priced choice', () => {
  const s = makeDesignScope(['furniture']);
  assert.equal(rows(s).length, 0);
  assert.equal(designInvestment(s, rows(s), 10, 10000).missing.length, 5);
  const c = s.sections.furniture.costs[0];
  assert.equal(costTotal(c), null);
  c.rate = 0;
  assert.equal(costTotal(c), 0);
  c.quantity = null;
  assert.equal(costTotal(c), null);
  assert.ok(designIssues(s).some((x) => x.includes('price')));
});
test('mapped land, common work, and discipline lines reconcile once with tax and contingency', () => {
  const s = priced(['land', 'interiors']);
  s.taxPercent = 10;
  // A deliberately excluded module has a high taxable cost, which must not enter the total.
  s.sections.furniture.costs[0].rate = 999999;
  const feature = {
    id: 'land-area',
    name: 'Garden',
    kind: 'area',
    included: true,
    points: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    rate: 2,
    status: '',
    description: '',
  };
  const common = {
    id: 'coordination',
    name: 'Coordination',
    quantity: 1,
    rate: 50,
    unit: 'allowance',
    included: true,
    description: '',
  };
  const r = scopeRows([feature], 1, 25, [common], s),
    p = designInvestment(s, r, 10, 1000);
  assert.equal(p.subtotal, 1050); // land 200 + interior 600 + mapped 200 + common 50
  assert.equal(p.tax, 80);
  assert.equal(p.reserve, 105);
  assert.equal(p.total, 1235);
  assert.equal(p.gap, 235);
  assert.equal(
    p.byDiscipline.reduce((sum, d) => sum + d.total, p.common),
    p.subtotal,
  );
  assert.equal(p.common, 50);
  s.enabled = ['interiors'];
  assert.equal(scopeRows([feature], 1, 25, [common], s).length, 2);
  assert.equal(
    designInvestment(s, scopeRows([feature], 1, 25, [common], s), 0, 0)
      .subtotal,
    650,
  );
});
test('cent rounding is deterministic and entered budget never silently drops work', () => {
  const s = priced(['furniture']);
  s.sections.furniture.costs[0].quantity = 3;
  s.sections.furniture.costs[0].rate = 0.335;
  assert.equal(rows(s)[0].total, 1.02);
  const p = designInvestment(s, rows(s), 10, 0);
  assert.equal(p.reserve, 0.1);
  assert.equal(p.total, 1.12);
  assert.equal(p.gap, 1.12);
  assert.equal(rows(s).length, 1);
});
test('parallel timing, lead time and chained dependencies determine completion', () => {
  const s = priced();
  s.sections.land.durationWeeks = 6; // finish 7
  s.sections.architecture.dependsOn = ['land']; // finish 12
  s.sections.interiors.dependsOn = ['architecture']; // finish 17
  s.sections.furniture.startWeek = 3; // independent finish 8
  const p = designSchedule(s);
  assert.deepEqual(
    p.map((x) => x.end),
    [7, 12, 17, 8],
  );
  assert.equal(designInvestment(s, rows(s), 0, 0).finishWeek, 17);
  s.sections.land.leadWeeks = null;
  assert.deepEqual(
    designSchedule(s).map((x) => x.end),
    [null, null, null, 8],
  );
  s.sections.land.leadWeeks = 1;
  s.enabled = ['interiors'];
  assert.ok(designIssues(s).some((x) => x.includes('enable Architecture')));
  assert.equal(designSchedule(s)[0].end, null);
});
test('validation rejects cycles, malformed specs, forged IDs and fabricated amounts', () => {
  const s = priced();
  s.sections.land.dependsOn = ['architecture'];
  s.sections.architecture.dependsOn = ['land'];
  assert.equal(designSchema.safeParse(s).success, false);
  assert.throws(() => designSchedule(s));
  for (const mutation of [
    (s) => s.enabled.push('furniture'),
    (s) => (s.sections.furniture.costs[0].rate = -1),
    (s) => (s.sections.furniture.costs[0].rate = Infinity),
    (s) => (s.sections.furniture.startWeek = 1.5),
    (s) => (s.sections.interiors.brief.area = 'very large'),
    (s) => (s.sections.architecture.brief.fakePermitApproval = 'approved'),
  ]) {
    const candidate = priced();
    mutation(candidate);
    assert.equal(designSchema.safeParse(candidate).success, false);
  }
  const draft = emptyArchitectDraft();
  draft.items = [
    {
      id: 'design:architecture:forged',
      name: 'Bad',
      quantity: 1,
      rate: 1,
      unit: 'each',
      included: true,
      description: '',
    },
  ];
  assert.equal(draftSchema.safeParse(draft).success, false);
  const q = priced(['architecture']);
  q.sections.architecture.costs[0].basis = 'quote';
  assert.ok(designIssues(q).some((x) => x.includes('reference')));
});
test('public scope strips inactive content while preserving selected specifications', () => {
  const s = priced(['architecture']);
  s.sections.furniture.brief.intent = 'private furniture marker';
  s.sections.architecture.brief.intent = 'A light-filled home';
  const shared = publicDesignScope(s);
  assert.equal(
    JSON.stringify(shared).includes('private furniture marker'),
    false,
  );
  assert.equal(
    shared.sections.architecture.brief.intent,
    'A light-filled home',
  );
  assert.equal(s.sections.furniture.brief.intent, 'private furniture marker');
});
test('blank startup, durable drafts, permissions and immutable modular client revisions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tera-architect-'));
  let db = await connectDatabase({ localPath: join(dir, 'db') });
  const secret = 'test-architect-secret-at-least-32-characters';
  try {
    await migrate(db);
    let service = new BuildService(db, secret);
    await seedLocal(service, true);
    let owner = await service.actor(localAccounts[0].id),
      lead = await service.actor(localAccounts[1].id),
      crew = await service.actor(localAccounts[2].id);
    assert.equal((await service.workspace(owner)).projects.length, 0);
    const project = await service.createProject(
      owner,
      {
        name: 'Architecture test',
        client: 'Test client',
        location: '',
        acres: 0,
        template: 'general',
      },
      key(),
    );
    let record = await service.record(owner, project.id);
    assert.deepEqual(record.job.designScope.enabled, ['architecture']);
    assert.equal(record.job.image, '');
    assert.equal(record.job.planning.budget, 0);
    await assert.rejects(
      service.publish(owner, project.id, { expectedVersion: 1 }, key()),
      { status: 400 },
    );
    const draft = draftFromJob(record.job);
    draft.designScope = priced(['architecture']);
    draft.planning.budget = 10000;
    draft.designScope.sections.architecture.entries = [
      { id: 'room-a', values: { name: 'Library', area: 180 } },
    ];
    draft.designScope.sections.interiors.brief.intent =
      'private interior marker';
    draft.designScope.sections.furniture.costs[0].reference =
      'private furniture marker';
    draft.site = { privateLandMarker: 'private parcel marker' };
    draft.features = [
      {
        id: 'private-feature',
        name: 'private land marker',
        kind: 'path',
        included: true,
        points: [
          [0, 0],
          [10, 10],
        ],
        rate: 2,
        status: '',
        description: '',
      },
    ];
    draft.image = '/property-aerial.png'; // uncalibrated, inactive land must not block architecture
    await service.assign(owner, project.id, lead.id, key());
    await service.assign(owner, project.id, crew.id, key());
    await assert.rejects(
      service.saveDraft(crew, project.id, { expectedVersion: 1, draft }, key()),
      { status: 403 },
    );
    await service.saveDraft(
      lead,
      project.id,
      { expectedVersion: 1, draft },
      key(),
    );
    await assert.rejects(
      service.publish(lead, project.id, { expectedVersion: 2 }, key()),
      { status: 403 },
    );
    // Simulate a real process/database reopen, not just a second in-memory read.
    await db.close();
    db = await connectDatabase({ localPath: join(dir, 'db') });
    service = new BuildService(db, secret);
    owner = await service.actor(owner.id);
    record = await service.record(owner, project.id);
    assert.equal(
      record.job.designScope.sections.architecture.entries[0].values.area,
      180,
    );
    assert.equal(
      record.job.designScope.sections.interiors.brief.intent,
      'private interior marker',
    );
    assert.deepEqual(
      proposalSchema.parse({
        action: 'propose_scope',
        expectedVersion: 2,
        draft: draftFromJob(record.job),
      }).draft.designScope,
      record.job.designScope,
    );
    const published = await service.publish(
      owner,
      project.id,
      { expectedVersion: 2 },
      key(),
    );
    const token = published.sharePath.split('/').pop();
    const shared = await service.share(token);
    assert.equal(shared.job.shared.total, 400);
    for (const marker of [
      'private interior marker',
      'private furniture marker',
      'private parcel marker',
      'private land marker',
      '/property-aerial.png',
    ])
      assert.equal(JSON.stringify(shared).includes(marker), false, marker);
    const hash = shared.snapshotHash;
    record = await service.record(owner, project.id);
    const changed = draftFromJob(record.job);
    changed.designScope.sections.architecture.costs[0].rate = 777;
    changed.designScope.sections.architecture.entries[0].values.name =
      'Changed draft';
    await service.saveDraft(
      owner,
      project.id,
      { expectedVersion: record.version, draft: changed },
      key(),
    );
    const unchanged = await service.share(token);
    assert.equal(unchanged.snapshotHash, hash);
    assert.equal(unchanged.job.shared.total, 400);
    assert.equal(
      unchanged.job.shared.designScope.sections.architecture.entries[0].values
        .name,
      'Library',
    );
    const restored = await service.record(owner, project.id);
    assert.equal(
      restored.job.designScope.sections.furniture.costs[0].reference,
      'private furniture marker',
    );
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
