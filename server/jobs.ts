import { z } from 'zod';
import { randomBytes, randomUUID } from 'node:crypto';
import { check, proposalSchema } from './contracts.ts';
import { one, type Sql, type Row } from './db.ts';
import { BuildService, type Actor } from './service.ts';
import { draftFromJob } from './contracts.ts';

export async function ingestTelegram(
  service: BuildService,
  botId: string,
  input: unknown,
) {
  const body = z
    .object({
      update_id: z.number().int(),
      message: z
        .object({
          from: z.object({ id: z.number().int() }).loose().optional(),
          chat: z.object({ id: z.number().int() }).loose(),
          message_thread_id: z.number().int().optional(),
        })
        .loose()
        .optional(),
    })
    .loose()
    .parse(input);
  check(Number.isSafeInteger(body?.update_id), 400, 'Invalid Telegram update.');
  const message = body.message;
  // Edits and anonymous/channel senders do not retroactively mutate a scope.
  if (
    !message ||
    !Number.isSafeInteger(message.from?.id) ||
    !Number.isSafeInteger(message.chat?.id)
  )
    return { accepted: false };
  return service.db.transaction(async (tx) => {
    const sender = await one(
      tx,
      'SELECT t.* FROM build_telegram_identities t JOIN build_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.user_id AND m.active=true WHERE bot_id=$1 AND sender_id=$2',
      [botId, String(message.from!.id)],
    );
    if (!sender) return { accepted: false };
    const route = await one(
      tx,
      'SELECT * FROM build_telegram_routes WHERE bot_id=$1 AND chat_id=$2 AND thread_id=$3 AND organization_id=$4',
      [
        botId,
        String(message.chat.id),
        String(message.message_thread_id || ''),
        sender.organization_id,
      ],
    );
    const id = randomUUID();
    const inserted = await one(
      tx,
      'INSERT INTO build_inbox(id,bot_id,update_id,organization_id,user_id,project_id,chat_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(bot_id,update_id) DO NOTHING RETURNING id',
      [
        id,
        botId,
        String(body.update_id),
        sender.organization_id,
        sender.user_id,
        route?.project_id || null,
        String(message.chat.id),
        JSON.stringify(body),
      ],
    );
    if (!inserted) return { accepted: true, duplicate: true };
    await tx.query('INSERT INTO build_jobs(id) VALUES($1)', [id]);
    return { accepted: true, id };
  });
}

export async function claimJob(service: BuildService, organizationId: string) {
  return service.db.transaction(async (tx) => {
    await tx.query(
      "UPDATE build_jobs SET status='failed',error='Retry limit reached; review this field message',updated_at=now() WHERE attempts>=5 AND status='running' AND lease_until<now() AND id IN(SELECT id FROM build_inbox WHERE organization_id=$1)",
      [organizationId],
    );
    const job = await one(
      tx,
      `SELECT j.*,i.organization_id,i.user_id,i.project_id,i.payload,i.chat_id FROM build_jobs j JOIN build_inbox i ON i.id=j.id WHERE i.organization_id=$1 AND j.attempts<5 AND (j.status='queued' OR (j.status='running' AND j.lease_until<now())) ORDER BY i.received_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`,
      [organizationId],
    );
    if (!job) return null;
    const token = Buffer.from(randomBytes(24)).toString('base64url');
    const draft = job.project_id
      ? await one(
          tx,
          'SELECT version FROM build_drafts WHERE organization_id=$1 AND project_id=$2',
          [organizationId, job.project_id],
        )
      : null;
    const base = job.base_version ?? draft?.version ?? null;
    await tx.query(
      "UPDATE build_jobs SET status='running',lease_token=$1,lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now(),base_version=$3 WHERE id=$2",
      [token, job.id, base],
    );
    return { ...job, id: job.id, lease_token: token, base_version: base };
  });
}

export async function leasedJob(
  service: BuildService,
  tx: Sql,
  id: string,
  token: string,
  org: string,
  allowDone = false,
) {
  const j = await one(
    tx,
    "SELECT j.*,i.user_id,i.project_id,i.organization_id,i.chat_id,i.payload FROM build_jobs j JOIN build_inbox i ON i.id=j.id WHERE j.id=$1 AND i.organization_id=$2 AND j.lease_token=$3 AND ((j.status='running' AND j.lease_until>now()) OR ($4 AND j.status IN ('done','needs_input'))) FOR UPDATE OF j",
    [id, org, token, allowDone],
  );
  check(j, 409, 'This job lease is no longer active.');
  return j;
}

export async function prepareJob(
  service: BuildService,
  id: string,
  token: string,
  org: string,
  request: unknown,
) {
  check(
    JSON.stringify(request).length < 500_000,
    413,
    'Assistant request too large.',
  );
  return service.db.transaction(async (tx) => {
    const j = await leasedJob(service, tx, id, token, org);
    if (j.request)
      return { request: j.request, key: j.hermes_key, runId: j.run_id };
    const key = `build-${id}`;
    await tx.query(
      'UPDATE build_jobs SET request=$1,hermes_key=$2,updated_at=now() WHERE id=$3',
      [JSON.stringify(request), key, id],
    );
    return { request, key, runId: null };
  });
}

export async function jobContext(service: BuildService, job: Row) {
  const actor = await service.actor(job.user_id);
  check(
    actor.organizationId === job.organization_id,
    403,
    'Job workspace access changed.',
  );
  if (!job.project_id)
    return { actor, project: null, draft: null, version: null };
  const record = await service.record(actor, job.project_id);
  check(
    job.request || record.version === job.base_version,
    409,
    'Project changed before the assistant started. Submit the field request again.',
  );
  return {
    actor,
    project: record.project,
    draft: draftFromJob(record.job),
    version: record.version,
  };
}

export async function applyProposal(
  service: BuildService,
  id: string,
  token: string,
  org: string,
  input: unknown,
) {
  const proposal = proposalSchema.parse(input);
  const initial = await leasedJob(service, service.db, id, token, org, true);
  const actor = await service.actor(initial.user_id);
  check(actor.organizationId === org, 403, 'Workspace access changed.');
  return service.action(
    actor,
    `job:${id}`,
    { id, proposal },
    async (tx) => {
      const j = await leasedJob(service, tx, id, token, org, true);
      if (proposal.action !== 'needs_input') {
        check(j.project_id, 400, 'Select a project first.');
        await service.access(
          tx,
          actor,
          j.project_id,
          proposal.action === 'propose_scope'
            ? ['owner', 'lead']
            : ['owner', 'lead', 'crew'],
        );
      }
    },
    async (tx) => {
      const j = await leasedJob(service, tx, id, token, org);
      let message: string;
      if (proposal.action === 'capture_update') {
        await tx.query(
          "INSERT INTO build_updates(id,organization_id,project_id,author_id,body,visibility) VALUES($1,$2,$3,$4,$5,'internal')",
          [randomUUID(), org, j.project_id, actor.id, proposal.text],
        );
        message = `Saved to ${j.project_id}: ${proposal.text}`;
      } else if (proposal.action === 'propose_scope') {
        check(
          proposal.expectedVersion === j.base_version,
          409,
          'The assistant may only edit the draft version it received.',
        );
        const draft = await service.validateDraft(
          tx,
          actor,
          j.project_id,
          proposal.draft,
        );
        const changed = await one(
          tx,
          'UPDATE build_drafts SET content=$1,version=version+1,updated_by=$2,updated_at=now() WHERE organization_id=$3 AND project_id=$4 AND version=$5 RETURNING version',
          [
            JSON.stringify(draft),
            actor.id,
            org,
            j.project_id,
            proposal.expectedVersion,
          ],
        );
        check(
          changed,
          409,
          'The project changed while the assistant was working. Review the latest draft.',
        );
        message = `Draft scope updated for ${j.project_id}. Review it in TERA before publishing.`;
      } else message = proposal.question;
      const status = proposal.action === 'needs_input' ? 'needs_input' : 'done';
      await tx.query(
        'UPDATE build_jobs SET status=$1,updated_at=now(),error=NULL WHERE id=$2',
        [status, id],
      );
      await tx.query(
        'INSERT INTO build_outbox(id,job_id,chat_id,body,thread_id) VALUES($1,$2,$3,$4,$5)',
        [
          randomUUID(),
          id,
          j.chat_id,
          message,
          j.payload.message?.message_thread_id
            ? String(j.payload.message.message_thread_id)
            : null,
        ],
      );
      return { status, message };
    },
  );
}

export async function bindTelegram(
  service: BuildService,
  actor: Actor,
  botId: string,
  raw: unknown,
) {
  const input = z
    .object({
      userId: z.uuid(),
      projectId: z.string(),
      senderId: z.string(),
      chatId: z.string(),
      threadId: z.string().optional(),
    })
    .strict()
    .parse(raw);
  await service.owner(service.db, actor);
  check(
    typeof input.userId === 'string' &&
      /^-?\d{1,20}$/.test(input.senderId) &&
      /^-?\d{1,20}$/.test(input.chatId) &&
      /^(\d{1,20})?$/.test(input.threadId || ''),
    400,
    'Use numeric Telegram user, chat, and optional topic IDs.',
  );
  await service.access(service.db, actor, input.projectId, ['owner']);
  return service.db.transaction(async (tx) => {
    const m = await one(
      tx,
      'SELECT 1 FROM build_memberships WHERE organization_id=$1 AND user_id=$2 AND active=true',
      [actor.organizationId, input.userId],
    );
    check(m, 400, 'Choose an active team member.');
    const existing = await one(
      tx,
      'SELECT organization_id FROM build_telegram_identities WHERE bot_id=$1 AND sender_id=$2',
      [botId, input.senderId],
    );
    check(
      !existing || existing.organization_id === actor.organizationId,
      409,
      'This Telegram identity belongs to another workspace.',
    );
    const route = await one(
      tx,
      'SELECT organization_id FROM build_telegram_routes WHERE bot_id=$1 AND chat_id=$2 AND thread_id=$3',
      [botId, input.chatId, input.threadId || ''],
    );
    check(
      !route || route.organization_id === actor.organizationId,
      409,
      'This chat belongs to another workspace.',
    );
    await tx.query(
      'INSERT INTO build_telegram_identities(bot_id,sender_id,organization_id,user_id) VALUES($1,$2,$3,$4) ON CONFLICT(bot_id,sender_id) DO UPDATE SET user_id=EXCLUDED.user_id',
      [botId, input.senderId, actor.organizationId, input.userId],
    );
    await tx.query(
      'INSERT INTO build_telegram_routes(bot_id,chat_id,thread_id,organization_id,project_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(bot_id,chat_id,thread_id) DO UPDATE SET project_id=EXCLUDED.project_id',
      [
        botId,
        input.chatId,
        input.threadId || '',
        actor.organizationId,
        input.projectId,
      ],
    );
    return { linked: true };
  });
}
