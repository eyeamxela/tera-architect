import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDatabase, migrate, one } from '../server/db.ts';
import { BuildService } from '../server/service.ts';
import { seedLocal, localAccounts, localOrg } from '../server/seed.ts';
import { draftFromJob } from '../server/contracts.ts';
import { createApi } from '../server/api.ts';
import { uploadFile, readProjectFile } from '../server/files.ts';
import {
  bindTelegram,
  ingestTelegram,
  claimJob,
  prepareJob,
  applyProposal,
  leasedJob,
  jobContext,
} from '../server/jobs.ts';
import { runOnce, deliverOnce } from '../server/worker-runtime.ts';

test('TERA database, API, and worker contracts', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'build-contract-'));
  const db = await connectDatabase({ localPath: '' });
  await migrate(db);
  const service = new BuildService(
    db,
    'test-share-secret-with-at-least-32-characters',
  );
  await seedLocal(service);
  const [owner, lead, crew, client] = await Promise.all(
    localAccounts.map((a) => service.actor(a.id)),
  );
  const c = {
    mode: 'local',
    appOrigin: 'http://localhost:3000',
    shareSecret: service.shareSecret,
    workerSecret: 'test-worker-key',
    workerOrganizationId: localOrg,
    proxySecret: 'proxy',
    telegramSecret: 'webhook',
    telegramBotId: 'test-bot',
    telegramToken: '',
    supabaseUrl: '',
    supabaseKey: '',
    supabaseServiceKey: '',
    storageBucket: 'build-files',
    dataDir: dir,
  };
  const api = createApi(service, c),
    key = () => randomUUID();
  const ws = await service.workspace(owner),
    land = ws.projects.find((p) => p.template === 'landscape').id,
    general = ws.projects.find((p) => p.template === 'general').id;
  const get = () => service.record(owner, land);
  const call = async (path, body = {}, headers = {}) =>
    api(
      new Request('http://localhost:3000/api/build' + path, {
        method: 'POST',
        headers: {
          origin: c.appOrigin,
          'content-type': 'application/json',
          'idempotency-key': key(),
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
  const worker = (path, body = {}) =>
    call('/worker' + path, body, { authorization: 'Bearer ' + c.workerSecret });
  const pdf = new TextEncoder().encode('%PDF-1.4\nfixture');
  let token = ws.shares[land].split('/').pop();
  try {
    await t.test(
      'role and project checks prevent cross-project and crew writes',
      async () => {
        assert.equal((await service.workspace(crew)).projects.length, 1);
        await assert.rejects(service.record(lead, general), { status: 404 });
        const record = await get();
        await assert.rejects(
          service.saveDraft(
            crew,
            land,
            {
              expectedVersion: record.version,
              draft: draftFromJob(record.job),
            },
            key(),
          ),
          { status: 403 },
        );
        await assert.rejects(
          service.publish(
            lead,
            land,
            { expectedVersion: record.version },
            key(),
          ),
          { status: 403 },
        );
        await assert.rejects(
          service.captureUpdate(
            crew,
            land,
            { text: 'public', visibility: 'client' },
            key(),
          ),
          { status: 403 },
        );
        await assert.rejects(
          service.record({ ...owner, organizationId: randomUUID() }, land),
          { status: 403 },
        );
      },
    );
    await t.test(
      'draft allowlist rejects fabricated server fields and invalid rates',
      async () => {
        const r = await get(),
          d = draftFromJob(r.job);
        await assert.rejects(
          service.saveDraft(
            owner,
            land,
            {
              expectedVersion: r.version,
              draft: { ...d, shared: { total: 1 } },
            },
            key(),
          ),
        );
        d.features[0].rate = -1;
        await assert.rejects(
          service.saveDraft(
            owner,
            land,
            { expectedVersion: r.version, draft: d },
            key(),
          ),
        );
      },
    );
    await t.test(
      'atomic revision check permits one concurrent editor and idempotent retries',
      async () => {
        const r = await get(),
          body = { expectedVersion: r.version, draft: draftFromJob(r.job) },
          k = key();
        const results = await Promise.allSettled([
          service.saveDraft(owner, land, body, k),
          service.saveDraft(owner, land, body, key()),
        ]);
        assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
        assert.equal(
          results.find((x) => x.status === 'rejected').reason.status,
          409,
        );
        assert.deepEqual(
          await service.saveDraft(owner, land, body, k),
          results[0].value,
        );
        await assert.rejects(
          service.saveDraft(owner, land, { ...body, expectedVersion: 99 }, k),
          { status: 409 },
        );
        await assert.rejects(
          service.publish(owner, land, { expectedVersion: r.version }, key()),
          { status: 409 },
        );
      },
    );
    await t.test(
      'published snapshots stay immutable and private notes never enter client DTO',
      async () => {
        const before = await service.share(token),
          r = await get(),
          d = draftFromJob(r.job);
        d.features[0].description = 'PRIVATE DRAFT';
        await service.saveDraft(
          owner,
          land,
          { expectedVersion: r.version, draft: d },
          key(),
        );
        await service.captureUpdate(
          owner,
          land,
          { text: 'PRIVATE NOTE', visibility: 'internal' },
          key(),
        );
        await service.captureUpdate(
          owner,
          land,
          { text: 'Client progress update', visibility: 'client' },
          key(),
        );
        const after = await service.share(token);
        assert.equal(after.snapshotHash, before.snapshotHash);
        assert.ok(!JSON.stringify(after).includes('PRIVATE'));
        assert.ok(after.job.activity.includes('Client progress update'));
        await assert.rejects(
          db.query("UPDATE build_revisions SET snapshot='{}' WHERE id=$1", [
            before.revisionId,
          ]),
          /immutable/i,
        );
        await assert.rejects(
          db.query('DELETE FROM build_revisions WHERE id=$1', [
            before.revisionId,
          ]),
          /immutable/i,
        );
      },
    );
    await t.test(
      'only invited clients may approve the exact current revision',
      async () => {
        const before = await service.share(token);
        await assert.rejects(
          service.respond(
            owner,
            token,
            { revisionId: before.revisionId, kind: 'approved' },
            key(),
          ),
          { status: 403 },
        );
        await service.respond(
          client,
          token,
          { revisionId: before.revisionId, kind: 'approved' },
          key(),
        );
        assert.equal(
          (await service.share(token)).job.shared.status,
          'Approved',
        );
        const r = await get();
        await service.publish(
          owner,
          land,
          { expectedVersion: r.version },
          key(),
        );
        await assert.rejects(
          service.respond(
            client,
            token,
            { revisionId: before.revisionId, kind: 'approved' },
            key(),
          ),
          { status: 409 },
        );
        assert.equal(
          (await service.share(token, client, before.revisionId)).canRespond,
          false,
        );
      },
    );
    await t.test(
      'file access requires exact project and frozen attachment membership',
      async () => {
        const foreign = await uploadFile(
          service,
          c,
          owner,
          general,
          pdf,
          'application/pdf',
          'private.pdf',
        );
        const r = await get(),
          draft = draftFromJob(r.job);
        draft.attachments = [foreign.id];
        await assert.rejects(
          service.saveDraft(
            owner,
            land,
            { expectedVersion: r.version, draft },
            key(),
          ),
          { status: 400 },
        );
        draft.attachments = [];
        draft.image = `https://elevation.nationalmap.gov/image?file=${foreign.id}`;
        const saved = await service.saveDraft(
          owner,
          land,
          { expectedVersion: r.version, draft },
          key(),
        );
        await service.publish(
          owner,
          land,
          { expectedVersion: saved.version },
          key(),
        );
        await assert.rejects(
          readProjectFile(service, c, foreign.id, undefined, token),
          { status: 404 },
        );
        const own = await uploadFile(
          service,
          c,
          owner,
          land,
          pdf,
          'application/pdf',
          'scope.pdf',
        );
        await assert.rejects(
          readProjectFile(service, c, own.id, undefined, token),
          { status: 404 },
        );
        const next = await get();
        const d = draftFromJob(next.job);
        d.attachments = [own.id];
        const v = await service.saveDraft(
          owner,
          land,
          { expectedVersion: next.version, draft: d },
          key(),
        );
        await service.publish(
          owner,
          land,
          { expectedVersion: v.version },
          key(),
        );
        assert.equal(
          (await readProjectFile(service, c, own.id, undefined, token)).status,
          200,
        );
      },
    );
    await t.test('revoked and expired share links stop resolving', async () => {
      await db.query(
        "UPDATE build_shares SET expires_at=now()-interval '1 second' WHERE project_id=$1",
        [land],
      );
      await assert.rejects(service.share(token), { status: 404 });
      await db.query(
        'UPDATE build_shares SET expires_at=NULL WHERE project_id=$1',
        [land],
      );
      await service.revoke(owner, land, key());
      await assert.rejects(service.share(token), { status: 404 });
      const r = await get();
      const published = await service.publish(
        owner,
        land,
        { expectedVersion: r.version },
        key(),
      );
      token = published.sharePath.split('/').pop();
      assert.ok(await service.share(token));
    });
    await t.test(
      'local HTTP sessions and origin checks are enforced; production fixture login is disabled',
      async () => {
        const login = await call('/auth/local', { userId: owner.id });
        assert.equal(login.status, 200);
        const cookie = login.headers.get('set-cookie').split(';')[0];
        assert.equal(
          (
            await api(
              new Request('http://localhost:3000/api/build/workspace', {
                headers: { cookie },
              }),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              '/projects',
              {},
              { cookie, origin: 'https://unrelated.example' },
            )
          ).status,
          403,
        );
        assert.equal((await worker('/claim', {})).status, 200);
        const prod = createApi(service, { ...c, mode: 'production' });
        assert.equal(
          (
            await prod(
              new Request('https://build.example/api/build/auth/local', {
                method: 'POST',
                headers: {
                  origin: c.appOrigin,
                  'x-build-proxy-secret': c.proxySecret,
                  'content-type': 'application/json',
                },
                body: JSON.stringify({ userId: owner.id }),
              }),
            )
          ).status,
          404,
        );
      },
    );
    let update = 100;
    const enqueue = async () => {
      await bindTelegram(service, owner, c.telegramBotId, {
        userId: crew.id,
        projectId: land,
        senderId: '42',
        chatId: '-100',
        threadId: '7',
      });
      return ingestTelegram(service, c.telegramBotId, {
        update_id: update++,
        message: {
          from: { id: 42 },
          chat: { id: -100 },
          message_thread_id: 7,
          text: 'The site walk is complete.',
        },
      });
    };
    await t.test(
      'Telegram dedupe, stale leases, exact prepared requests, and single application',
      async () => {
        const input = await enqueue();
        const duplicate = await ingestTelegram(service, c.telegramBotId, {
          update_id: update - 1,
          message: { from: { id: 42 }, chat: { id: -100 }, text: 'different' },
        });
        assert.equal(duplicate.duplicate, true);
        const a = await claimJob(service, localOrg);
        assert.equal(a.id, input.id);
        const prepared = await prepareJob(
          service,
          a.id,
          a.lease_token,
          localOrg,
          { input: 'original' },
        );
        assert.deepEqual(
          await prepareJob(service, a.id, a.lease_token, localOrg, {
            input: 'different',
          }),
          prepared,
        );
        assert.ok((await jobContext(service, a)).draft.attachments.length);
        await db.query(
          "UPDATE build_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
          [a.id],
        );
        const b = await claimJob(service, localOrg);
        assert.notEqual(a.lease_token, b.lease_token);
        await assert.rejects(
          applyProposal(service, a.id, a.lease_token, localOrg, {
            action: 'capture_update',
            text: 'stale',
          }),
          { status: 409 },
        );
        const p = { action: 'capture_update', text: 'Only once' };
        await applyProposal(service, b.id, b.lease_token, localOrg, p);
        await applyProposal(service, b.id, b.lease_token, localOrg, p);
        assert.equal(
          (
            await one(
              db,
              'SELECT count(*)::int AS n FROM build_updates WHERE body=$1',
              ['Only once'],
            )
          ).n,
          1,
        );
        assert.equal(
          (
            await one(
              db,
              'SELECT thread_id FROM build_outbox WHERE job_id=$1',
              [b.id],
            )
          ).thread_id,
          '7',
        );
      },
    );
    await t.test(
      'stale media upload cleans up and revoked crew cannot apply',
      async () => {
        await enqueue();
        const j = await claimJob(service, localOrg);
        let guardCalls = 0;
        const before = await readdir(join(dir, 'files'));
        await assert.rejects(
          uploadFile(
            service,
            c,
            crew,
            land,
            pdf,
            'application/pdf',
            'stale.pdf',
            'telegram:' + j.id,
            async (tx) => {
              if (++guardCalls === 2)
                await tx.query(
                  "UPDATE build_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
                  [j.id],
                );
              return leasedJob(service, tx, j.id, j.lease_token, localOrg);
            },
          ),
          { status: 409 },
        );
        assert.deepEqual(await readdir(join(dir, 'files')), before);
        await db.query(
          'UPDATE build_memberships SET active=false WHERE user_id=$1',
          [crew.id],
        );
        await assert.rejects(
          applyProposal(service, j.id, j.lease_token, localOrg, {
            action: 'capture_update',
            text: 'revoked',
          }),
          { status: 403 },
        );
        await db.query(
          'UPDATE build_memberships SET active=true WHERE user_id=$1',
          [crew.id],
        );
        await db.query("UPDATE build_jobs SET status='failed' WHERE id=$1", [
          j.id,
        ]);
      },
    );
    await t.test(
      'job base version cannot be replaced by a model-selected newer version',
      async () => {
        await enqueue();
        await db.query('UPDATE build_inbox SET user_id=$1 WHERE update_id=$2', [
          owner.id,
          String(update - 1),
        ]);
        const j = await claimJob(service, localOrg);
        const r = await get(),
          d = draftFromJob(r.job);
        const saved = await service.saveDraft(
          owner,
          land,
          { expectedVersion: r.version, draft: d },
          key(),
        );
        await assert.rejects(
          applyProposal(service, j.id, j.lease_token, localOrg, {
            action: 'propose_scope',
            expectedVersion: saved.version,
            draft: d,
          }),
          { status: 409 },
        );
        await db.query("UPDATE build_jobs SET status='failed' WHERE id=$1", [
          j.id,
        ]);
      },
    );
    await t.test(
      'exhausted jobs fail and uncertain outbox claims never resend automatically',
      async () => {
        const item = await enqueue();
        await db.query(
          "UPDATE build_jobs SET status='running',attempts=5,lease_until=now()-interval '1 second' WHERE id=$1",
          [item.id],
        );
        assert.equal(await claimJob(service, localOrg), null);
        assert.equal(
          (
            await one(db, 'SELECT status FROM build_jobs WHERE id=$1', [
              item.id,
            ])
          ).status,
          'failed',
        );
        const response = await worker('/outbox/claim');
        const { message } = await response.json();
        assert.ok(message);
        assert.equal(
          (
            await worker('/outbox/result', {
              id: message.id,
              claimToken: 'wrong',
              status: 'sent',
            })
          ).status,
          409,
        );
        await db.query(
          "UPDATE build_outbox SET updated_at=now()-interval '6 minutes' WHERE id=$1",
          [message.id],
        );
        await worker('/outbox/claim');
        assert.equal(
          (
            await one(db, 'SELECT status FROM build_outbox WHERE id=$1', [
              message.id,
            ])
          ).status,
          'uncertain',
        );
      },
    );
    await t.test(
      'worker connects the real API to a simulated Hermes contract, preserving one write',
      async () => {
        await enqueue();
        let submits = 0,
          sends = 0;
        const fetcher = async (input, init) => {
          const url = String(input);
          if (url.startsWith('http://api')) return api(new Request(url, init));
          if (url === 'http://hermes/v1/runs') {
            submits++;
            assert.ok(init.headers['Idempotency-Key']);
            return Response.json({ run_id: 'run-test', status: 'started' });
          }
          if (url === 'http://hermes/v1/runs/run-test')
            return Response.json({
              status: 'completed',
              output: JSON.stringify({
                action: 'capture_update',
                text: 'Worker contract verified',
              }),
            });
          if (url.includes('/sendMessage')) {
            sends++;
            assert.equal(JSON.parse(init.body).message_thread_id, 7);
            return Response.json({ ok: true, result: { message_id: 123 } });
          }
          throw new Error('Unexpected request ' + url);
        };
        const config = {
          api: 'http://api',
          secret: c.workerSecret,
          hermes: 'http://hermes',
          hermesKey: 'test',
          telegramToken: 'test',
          transcriptionUrl: '',
          transcriptionKey: '',
          transcriptionModel: '',
          sendReplies: true,
        };
        assert.equal(await runOnce(config, fetcher), true);
        assert.equal(await runOnce(config, fetcher), false);
        assert.equal(submits, 1);
        assert.equal(await deliverOnce(config, fetcher), true);
        assert.equal(sends, 1);
        assert.equal(
          (
            await one(
              db,
              'SELECT count(*)::int AS n FROM build_updates WHERE body=$1',
              ['Worker contract verified'],
            )
          ).n,
          1,
        );
      },
    );
    await t.test(
      'team creation grants no unassigned project and deactivation removes access',
      async () => {
        const member = await service.addMember(
          owner,
          { name: 'New lead', email: 'new@build.test', role: 'lead' },
          key(),
        );
        const actor = await service.actor(member.id);
        assert.equal((await service.workspace(actor)).projects.length, 0);
        await service.assign(owner, land, actor.id, key());
        assert.equal((await service.workspace(actor)).projects.length, 1);
        await service.deactivateMember(owner, actor.id, key());
        await assert.rejects(service.actor(actor.id), { status: 403 });
        await assert.rejects(service.deactivateMember(owner, owner.id, key()), {
          status: 400,
        });
      },
    );
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('filesystem database retains saved data after closing and reopening', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'build-persist-'));
  try {
    let db = await connectDatabase({ localPath: join(dir, 'db') });
    await migrate(db);
    await db.query(
      "INSERT INTO build_organizations(id,name,brand) VALUES($1,'Persistent studio','{}')",
      [localOrg],
    );
    await db.close();
    db = await connectDatabase({ localPath: join(dir, 'db') });
    await migrate(db);
    assert.equal(
      (
        await one(db, 'SELECT name FROM build_organizations WHERE id=$1', [
          localOrg,
        ])
      ).name,
      'Persistent studio',
    );
    await db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
