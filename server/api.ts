import { timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { BuildService, hash } from './service.ts';
import { one } from './db.ts';
import { ApiError, check } from './contracts.ts';
import {
  authenticate,
  cookies,
  localSignIn,
  sendCode,
  verifyCode,
  sessionCookie,
  type Config,
} from './auth.ts';
import { localAccounts } from './seed.ts';
import { uploadFile, readProjectFile } from './files.ts';
import {
  ingestTelegram,
  claimJob,
  prepareJob,
  leasedJob,
  jobContext,
  applyProposal,
  bindTelegram,
} from './jobs.ts';

const equal = (a: string, b: string) =>
  !!a &&
  !!b &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
export function createApi(service: BuildService, c: Config) {
  const rateLimits = new Map<string, { count: number; until: number }>();
  const throttle = (key: string, limit = 10) => {
    const now = Date.now();
    for (const [k, v] of rateLimits) if (v.until < now) rateLimits.delete(k);
    const r = rateLimits.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    check(r.count++ < limit, 429, 'Too many attempts. Please try again later.');
    if (!rateLimits.has(key) && rateLimits.size >= 2000)
      rateLimits.delete(rateLimits.keys().next().value!);
    rateLimits.set(key, r);
  };
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url),
        path =
          url.pathname.replace(/^\/api\/build/, '').replace(/\/$/, '') || '/';
      const parts = path.split('/').filter(Boolean),
        method = request.method;
      const worker = path.startsWith('/worker/');
      const webhook = path === '/webhooks/telegram';
      if (worker)
        check(
          equal(
            request.headers.get('authorization') || '',
            `Bearer ${c.workerSecret}`,
          ),
          401,
          'Worker authentication required.',
        );
      else if (c.mode === 'production')
        check(
          equal(
            request.headers.get('x-build-proxy-secret') || '',
            c.proxySecret,
          ),
          403,
          'Use the application API.',
        );
      if (!['GET', 'HEAD'].includes(method) && !worker && !webhook) {
        const origin = request.headers.get('origin');
        check(
          origin === c.appOrigin ||
            (c.mode === 'local' &&
              ['http://localhost:3000', 'http://127.0.0.1:3000'].includes(
                origin || '',
              )),
          403,
          'This request did not originate from TERA.',
        );
      }
      const body = async () => {
        check(
          Number(request.headers.get('content-length') || 0) <= 500_000,
          413,
          'Request too large.',
        );
        const text = await request.text();
        check(text.length <= 500_000, 413, 'Request too large.');
        try {
          return JSON.parse(text || '{}');
        } catch {
          throw new ApiError(400, 'Invalid JSON.');
        }
      };
      const actor = () => authenticate(request, service, c);
      const key = request.headers.get('idempotency-key') || '';
      if (path === '/health' && method === 'GET') {
        await service.db.query('SELECT 1');
        return json({ ok: true, mode: c.mode });
      }
      if (path === '/auth/options' && method === 'GET')
        return json({
          mode: c.mode,
          accounts: c.mode === 'local' ? localAccounts : [],
        });
      if (path === '/auth/local' && method === 'POST') {
        const input = await body();
        const result = await localSignIn(input.userId, service, c);
        return json({ actor: result.actor }, 200, {
          'Set-Cookie': result.cookie,
        });
      }
      if (path === '/auth/session' && method === 'GET')
        return json({ actor: await actor(), mode: c.mode });
      if (path === '/auth/email' && method === 'POST') {
        throttle(
          'source:' + (request.headers.get('x-build-client-ip') || 'local'),
          60,
        );
        const b = await body();
        check(
          typeof b.email === 'string' && b.email.length <= 320,
          400,
          'Enter your email.',
        );
        throttle('send:' + b.email.trim().toLowerCase());
        const person = await one(
          service.db,
          'SELECT id FROM build_people WHERE email=$1',
          [b.email.toLowerCase().trim()],
        );
        if (person) await sendCode(b.email, c);
        return json({
          message:
            'If you have project access, a sign-in code will arrive shortly.',
        });
      }
      if (path === '/auth/verify' && method === 'POST') {
        throttle(
          'source:' + (request.headers.get('x-build-client-ip') || 'local'),
          60,
        );
        const b = await body();
        throttle('verify:' + String(b.email).trim().toLowerCase());
        const cookie = await verifyCode(b.email, b.code, c);
        return json({ ok: true }, 200, { 'Set-Cookie': cookie });
      }
      if (path === '/auth/logout' && method === 'POST') {
        const token = cookies(request).build_session;
        if (token && c.mode === 'local')
          await service.db.query(
            'DELETE FROM build_sessions WHERE token_hash=$1',
            [hash(token)],
          );
        return json({ ok: true }, 200, {
          'Set-Cookie': sessionCookie('', c, 0),
        });
      }
      if (webhook && method === 'POST') {
        check(
          equal(
            request.headers.get('x-telegram-bot-api-secret-token') || '',
            c.telegramSecret,
          ),
          401,
          'Webhook authentication failed.',
        );
        return json(
          await ingestTelegram(service, c.telegramBotId, await body()),
        );
      }
      if (worker) {
        const org = c.workerOrganizationId;
        if (path === '/worker/claim' && method === 'POST') {
          const job = await claimJob(service, org);
          if (!job) return json({ job: null });
          try {
            return json({ job, context: await jobContext(service, job) });
          } catch {
            await service.db.query(
              "UPDATE build_jobs SET status='failed',error='Project membership or access is no longer active' WHERE id=$1",
              [job.id],
            );
            return json({ job: null, rejected: true });
          }
        }
        if (parts[1] === 'jobs' && parts[2]) {
          if (parts[3] === 'media' && method === 'POST') {
            const job = await leasedJob(
              service,
              service.db,
              parts[2],
              request.headers.get('x-job-lease') || '',
              org,
            );
            check(
              job.project_id,
              400,
              'Select a project before storing media.',
            );
            const who = await service.actor(job.user_id);
            check(who.organizationId === org, 403, 'Project access changed.');
            return json(
              await uploadFile(
                service,
                c,
                who,
                job.project_id,
                new Uint8Array(await request.arrayBuffer()),
                request.headers.get('content-type') || '',
                decodeURIComponent(
                  request.headers.get('x-file-name') || 'field-upload',
                ),
                `telegram:${job.id}`,
                (tx) => leasedJob(service, tx, job.id, job.lease_token, org),
              ),
            );
          }
          const b = await body(),
            id = parts[2];
          if (parts[3] === 'prepare')
            return json(
              await prepareJob(service, id, b.leaseToken, org, b.request),
            );
          if (parts[3] === 'apply')
            return json(
              await applyProposal(service, id, b.leaseToken, org, b.proposal),
            );
          if (
            parts[3] === 'heartbeat' ||
            parts[3] === 'run' ||
            parts[3] === 'fail'
          ) {
            await service.db.transaction(async (tx) => {
              await leasedJob(service, tx, id, b.leaseToken, org);
              if (parts[3] === 'run') {
                check(
                  typeof b.runId === 'string' && b.runId.length < 200,
                  400,
                  'Invalid run ID.',
                );
                await tx.query(
                  'UPDATE build_jobs SET run_id=$1,updated_at=now() WHERE id=$2',
                  [b.runId, id],
                );
              } else if (parts[3] === 'fail')
                await tx.query(
                  "UPDATE build_jobs SET status='failed',error=$1,updated_at=now() WHERE id=$2",
                  [
                    String(b.error || 'Assistant processing failed').slice(
                      0,
                      1000,
                    ),
                    id,
                  ],
                );
              else
                await tx.query(
                  "UPDATE build_jobs SET lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=$1",
                  [id],
                );
            });
            return json({ ok: true });
          }
        }
        if (path === '/worker/outbox/claim' && method === 'POST') {
          const message = await service.db.transaction(async (tx) => {
            await tx.query(
              "UPDATE build_outbox SET status='uncertain',updated_at=now() WHERE status='sending' AND updated_at<now()-interval '5 minutes' AND job_id IN(SELECT id FROM build_inbox WHERE organization_id=$1)",
              [org],
            );
            const item = await one(
              tx,
              "SELECT o.* FROM build_outbox o JOIN build_inbox i ON i.id=o.job_id WHERE i.organization_id=$1 AND o.status='queued' ORDER BY o.created_at FOR UPDATE OF o SKIP LOCKED LIMIT 1",
              [org],
            );
            if (!item) return null;
            const claimToken = Buffer.from(randomBytes(24)).toString(
              'base64url',
            );
            await tx.query(
              "UPDATE build_outbox SET status='sending',claim_token=$1,updated_at=now() WHERE id=$2",
              [claimToken, item.id],
            );
            return { ...item, claim_token: claimToken };
          });
          return json({ message });
        }
        if (path === '/worker/outbox/result' && method === 'POST') {
          const b = await body();
          check(
            ['sent', 'uncertain', 'failed'].includes(b.status),
            400,
            'Invalid delivery state.',
          );
          const changed = await one(
            service.db,
            "UPDATE build_outbox SET status=$1,provider_message_id=$2,updated_at=now() WHERE id=$3 AND status='sending' AND claim_token=$4 AND job_id IN(SELECT id FROM build_inbox WHERE organization_id=$5) RETURNING id",
            [
              b.status,
              b.messageId ? String(b.messageId) : null,
              b.id,
              b.claimToken,
              org,
            ],
          );
          check(changed, 409, 'Delivery claim is no longer active.');
          return json({ ok: true });
        }
        throw new ApiError(404, 'Worker route not found.');
      }
      if (parts[0] === 'shares' && parts[1]) {
        if (parts[2] === 'files' && parts[3] && method === 'GET')
          return readProjectFile(
            service,
            c,
            parts[3],
            undefined,
            parts[1],
            url.searchParams.get('revision') || undefined,
          );
        if (parts[2] === 'responses' && method === 'POST')
          return json(
            await service.respond(await actor(), parts[1], await body(), key),
          );
        if (parts.length === 2 && method === 'GET') {
          let who;
          try {
            who = await actor();
          } catch {}
          return json(
            await service.share(
              parts[1],
              who,
              url.searchParams.get('revision') || undefined,
            ),
          );
        }
      }
      const who = await actor();
      if (path === '/workspace' && method === 'GET')
        return json(await service.workspace(who));
      if (path === '/projects' && method === 'POST')
        return json(await service.createProject(who, await body(), key), 201);
      if (parts[0] === 'projects' && parts[1]) {
        const id = parts[1];
        if (parts.length === 2 && method === 'GET')
          return json(await service.record(who, id));
        if (parts[2] === 'draft' && method === 'PUT')
          return json(await service.saveDraft(who, id, await body(), key));
        if (parts[2] === 'publish' && method === 'POST')
          return json(await service.publish(who, id, await body(), key));
        if (parts[2] === 'updates' && method === 'POST')
          return json(await service.captureUpdate(who, id, await body(), key));
        if (parts[2] === 'revoke' && method === 'POST')
          return json(await service.revoke(who, id, key));
        if (parts[2] === 'assign' && method === 'POST')
          return json(
            await service.assign(who, id, (await body()).userId, key),
          );
        if (parts[2] === 'invite' && method === 'POST') {
          const b = await body();
          return json(await service.invite(who, id, b.email, b.name, key));
        }
        if (parts[2] === 'files') {
          if (method === 'GET') {
            await service.access(service.db, who, id);
            return json(
              (
                await service.db.query(
                  'SELECT id,name,mime,size,created_at FROM build_files WHERE organization_id=$1 AND project_id=$2 ORDER BY created_at DESC',
                  [who.organizationId, id],
                )
              ).rows,
            );
          }
          if (method === 'POST') {
            check(
              Number(request.headers.get('content-length') || 0) <=
                10 * 1024 * 1024,
              413,
              'Files must be 10 MB or smaller.',
            );
            return json(
              await uploadFile(
                service,
                c,
                who,
                id,
                new Uint8Array(await request.arrayBuffer()),
                request.headers.get('content-type') || '',
                decodeURIComponent(
                  request.headers.get('x-file-name') || 'upload',
                ),
              ),
              201,
            );
          }
        }
      }
      if (parts[0] === 'files' && parts[1] && method === 'GET')
        return readProjectFile(service, c, parts[1], who);
      if (path === '/team' && method === 'GET')
        return json(await service.team(who));
      if (path === '/team' && method === 'POST')
        return json(await service.addMember(who, await body(), key), 201);
      if (parts[0] === 'team' && parts[1] && method === 'DELETE')
        return json(await service.deactivateMember(who, parts[1], key));
      if (path === '/settings/brand' && method === 'PUT') {
        await service.owner(service.db, who);
        const brand = z
          .object({
            name: z.literal('TERA'),
            descriptor: z.string().min(1).max(60),
            studio: z.string().min(1).max(120),
            lead: z.string().min(1).max(120),
          })
          .strict()
          .parse(await body());
        await service.db.query(
          'UPDATE build_organizations SET name=$1,brand=$2 WHERE id=$3',
          [brand.studio, JSON.stringify(brand), who.organizationId],
        );
        return json({ brand });
      }
      if (path === '/integrations/telegram' && method === 'POST')
        return json(
          await bindTelegram(service, who, c.telegramBotId, await body()),
        );
      if (path === '/inbox' && method === 'GET') {
        await service.owner(service.db, who);
        const jobs = await service.db.query(
          'SELECT i.id,i.project_id,i.received_at,j.status,j.error,o.status AS delivery_status,p.display_name FROM build_inbox i JOIN build_jobs j ON j.id=i.id JOIN build_people p ON p.id=i.user_id LEFT JOIN build_outbox o ON o.job_id=j.id WHERE i.organization_id=$1 ORDER BY i.received_at DESC LIMIT 30',
          [who.organizationId],
        );
        return json({
          mode: c.mode,
          telegramConfigured: !!c.telegramToken,
          items: jobs.rows,
        });
      }
      throw new ApiError(404, 'Not found.');
    } catch (error) {
      if (error instanceof z.ZodError)
        return json(
          {
            error: error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; '),
          },
          400,
        );
      if (error instanceof ApiError)
        return json({ error: error.message }, error.status);
      console.error(
        'TERA API request failed:',
        error instanceof Error ? error.name : 'Unknown error',
      );
      return json(
        {
          error:
            'The request could not be completed. Your last saved data is unchanged.',
        },
        500,
      );
    }
  };
}
