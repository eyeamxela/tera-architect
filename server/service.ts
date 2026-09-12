import { createHash, createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database, Sql, Row } from './db.ts';
import { one } from './db.ts';
import {
  check,
  draftSchema,
  projectSchema,
  saveSchema,
  publishSchema,
  updateSchema,
  responseSchema,
} from './contracts.ts';
import {
  makeJob,
  scopeRows,
  layoutFits,
  validPolygon,
  type Job,
  type Project,
} from '../app/data.ts';
import { calculatePlan } from '../app/plan-model.ts';
import { PRODUCT_NAME } from '../app/product.ts';

export type Actor = {
  id: string;
  organizationId: string;
  name: string;
  role: 'owner' | 'lead' | 'crew' | 'client';
};
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .filter((k) => (value as Row)[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + canonical((value as Row)[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export const requestHash = (value: unknown) => hash(canonical(value));

export class BuildService {
  db: Database;
  shareSecret: string;
  constructor(db: Database, shareSecret: string) {
    this.db = db;
    this.shareSecret = shareSecret;
  }
  token(id: string) {
    return createHmac('sha256', this.shareSecret)
      .update(id)
      .digest('base64url');
  }

  async actor(userId: string): Promise<Actor> {
    const p = await one(this.db, 'SELECT * FROM build_people WHERE id=$1', [
      userId,
    ]);
    check(p, 401, 'Sign in to continue.');
    const m = await one(
      this.db,
      'SELECT * FROM build_memberships WHERE user_id=$1 AND active=true ORDER BY organization_id LIMIT 1',
      [userId],
    );
    if (m)
      return {
        id: p.id,
        name: p.display_name,
        organizationId: m.organization_id,
        role: m.role,
      };
    const c = await one(
      this.db,
      'SELECT * FROM build_client_access WHERE user_id=$1 AND active=true LIMIT 1',
      [userId],
    );
    check(c, 403, 'Your project access is not active.');
    return {
      id: p.id,
      name: p.display_name,
      organizationId: c.organization_id,
      role: 'client',
    };
  }

  async access(
    tx: Sql,
    actor: Actor,
    projectId: string,
    roles = ['owner', 'lead', 'crew'],
  ) {
    const member = await one(
      tx,
      'SELECT role FROM build_memberships WHERE organization_id=$1 AND user_id=$2 AND active=true',
      [actor.organizationId, actor.id],
    );
    check(
      member && roles.includes(member.role),
      403,
      'You do not have permission for this action.',
    );
    const p = await one(
      tx,
      `SELECT p.* FROM build_projects p WHERE p.organization_id=$1 AND p.id=$2 AND ($3='owner' OR EXISTS(SELECT 1 FROM build_project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=$4))`,
      [actor.organizationId, projectId, member.role, actor.id],
    );
    check(p, 404, 'Project not found.');
    return p;
  }

  async owner(tx: Sql, actor: Actor) {
    const m = await one(
      tx,
      "SELECT 1 FROM build_memberships WHERE organization_id=$1 AND user_id=$2 AND role='owner' AND active=true",
      [actor.organizationId, actor.id],
    );
    check(m, 403, 'Only the workspace owner can do this.');
  }

  async action<T>(
    actor: Actor,
    key: string,
    payload: unknown,
    permission: (tx: Sql) => Promise<unknown>,
    work: (tx: Sql) => Promise<T>,
  ): Promise<T> {
    check(
      typeof key === 'string' && /^[a-zA-Z0-9:_-]{8,160}$/.test(key),
      400,
      'An action key is required.',
    );
    return this.db.transaction(async (tx) => {
      // Serialize mutations within a small beta workspace, including receipt checks.
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        actor.organizationId,
      ]);
      await permission(tx);
      const digest = requestHash(payload);
      const receipt = await one(
        tx,
        'SELECT * FROM build_receipts WHERE organization_id=$1 AND actor_id=$2 AND action_key=$3',
        [actor.organizationId, actor.id, key],
      );
      if (receipt) {
        check(
          receipt.request_hash === digest,
          409,
          'This action key was already used for a different change.',
        );
        return receipt.result as T;
      }
      const result = await work(tx);
      await tx.query(
        'INSERT INTO build_receipts(organization_id,actor_id,action_key,request_hash,result) VALUES($1,$2,$3,$4,$5)',
        [actor.organizationId, actor.id, key, digest, JSON.stringify(result)],
      );
      return result;
    });
  }

  async validateDraft(
    tx: Sql,
    actor: Actor,
    projectId: string,
    input: unknown,
  ) {
    const d = draftSchema.parse(input);
    check(
      JSON.stringify(d).length <= 350_000,
      413,
      'This plan is too large. Upload supporting documents separately.',
    );
    for (const f of d.features) {
      check(
        f.kind === 'path' || validPolygon(f.points),
        400,
        'A work area needs a valid polygon.',
      );
      if (f.kind === 'trees' && d.scale)
        check(
          layoutFits(f.points, d.scale, d.spacing),
          400,
          'Planting layout is too dense.',
        );
    }
    if (d.image.startsWith('/api/build/files/')) {
      const file = await one(
        tx,
        'SELECT id FROM build_files WHERE id=$1 AND organization_id=$2 AND project_id=$3 AND mime LIKE $4',
        [d.image.split('/').pop(), actor.organizationId, projectId, 'image/%'],
      );
      check(file, 400, 'The plan image must belong to this project.');
    }
    for (const id of d.attachments) {
      const file = await one(
        tx,
        'SELECT id FROM build_files WHERE id=$1 AND organization_id=$2 AND project_id=$3',
        [id, actor.organizationId, projectId],
      );
      check(file, 400, 'Proposal attachments must belong to this project.');
    }
    function safeLinks(value: unknown, key = '') {
      if (typeof value === 'string' && /url$|href$|link$/i.test(key))
        check(
          value === '' || value.startsWith('https://'),
          400,
          'Site links must use HTTPS.',
        );
      if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value)) safeLinks(v, k);
    }
    safeLinks(d.site);
    return d;
  }

  async workspace(actor: Actor) {
    check(actor.role !== 'client', 403, 'Use your shared client project link.');
    const org = await one(
      this.db,
      'SELECT * FROM build_organizations WHERE id=$1',
      [actor.organizationId],
    );
    const list = await this.db.query(
      `SELECT p.* FROM build_projects p JOIN build_memberships m ON m.organization_id=p.organization_id AND m.user_id=$2 AND m.active=true WHERE p.organization_id=$1 AND (m.role='owner' OR EXISTS(SELECT 1 FROM build_project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=$2)) ORDER BY p.created_at,p.id`,
      [actor.organizationId, actor.id],
    );
    const records = await Promise.all(
      list.rows.map((p) => this.record(actor, p.id)),
    );
    return {
      brand: { ...org?.brand, name: PRODUCT_NAME },
      actor,
      projects: records.map((r) => r.project),
      jobs: Object.fromEntries(records.map((r) => [r.project.id, r.job])),
      versions: Object.fromEntries(
        records.map((r) => [r.project.id, r.version]),
      ),
      shares: Object.fromEntries(
        records.map((r) => [r.project.id, r.sharePath]),
      ),
    };
  }

  projectDTO(p: Row): Project {
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      location: p.location,
      acres: Number(p.acres),
      stage: p.stage,
      initials: p.client
        .split(/\s+/)
        .slice(0, 2)
        .map((s: string) => s[0])
        .join('')
        .toUpperCase(),
      template: p.template,
    };
  }
  async latest(tx: Sql, org: string, id: string) {
    return one(
      tx,
      'SELECT * FROM build_revisions WHERE organization_id=$1 AND project_id=$2 ORDER BY number DESC LIMIT 1',
      [org, id],
    );
  }
  async responseStatus(tx: Sql, revisionId: string) {
    const r = await one(
      tx,
      "SELECT kind FROM build_responses WHERE revision_id=$1 AND kind<>'comment' ORDER BY created_at DESC,id DESC LIMIT 1",
      [revisionId],
    );
    return r?.kind === 'approved'
      ? 'Approved'
      : r?.kind === 'changes_requested'
        ? 'Changes requested'
        : 'Awaiting review';
  }
  async record(actor: Actor, id: string) {
    const p = await this.access(this.db, actor, id);
    const d = await one(
      this.db,
      'SELECT * FROM build_drafts WHERE organization_id=$1 AND project_id=$2',
      [actor.organizationId, id],
    );
    check(d, 404, 'Project draft not found.');
    const rev = await this.latest(this.db, actor.organizationId, id);
    const updates = await this.db.query(
      'SELECT u.*,p.display_name FROM build_updates u JOIN build_people p ON p.id=u.author_id WHERE u.organization_id=$1 AND u.project_id=$2 ORDER BY created_at DESC',
      [actor.organizationId, id],
    );
    const comments = await this.db.query(
      'SELECT r.*,p.display_name,v.number FROM build_responses r JOIN build_people p ON p.id=r.author_id JOIN build_revisions v ON v.id=r.revision_id WHERE r.organization_id=$1 AND r.project_id=$2 ORDER BY r.created_at',
      [actor.organizationId, id],
    );
    const link = await one(
      this.db,
      'SELECT id FROM build_shares WHERE organization_id=$1 AND project_id=$2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1',
      [actor.organizationId, id],
    );
    const job: Job = {
      ...d.content,
      revision: rev
        ? rev.number + (rev.draft_version === d.version ? 0 : 1)
        : 1,
      shared: rev
        ? {
            ...rev.snapshot.shared,
            status: await this.responseStatus(this.db, rev.id),
          }
        : null,
      comments: comments.rows.map((r) => ({
        author: r.display_name,
        text:
          r.body ||
          (r.kind === 'approved'
            ? 'Approved this proposal.'
            : 'Requested changes.'),
        revision: r.number,
      })),
      activity: updates.rows.map((u) => `${u.display_name} · ${u.body}`),
      clientActivity: updates.rows
        .filter((u) => u.visibility === 'client')
        .map((u) => u.body),
    };
    return {
      project: this.projectDTO(p),
      job,
      version: d.version,
      revisionId: rev?.id,
      sharePath: link ? `/s/${this.token(link.id)}` : null,
    };
  }

  async createProject(actor: Actor, input: unknown, key: string) {
    const p = projectSchema.parse(input);
    return this.action(
      actor,
      key,
      { op: 'create', p },
      (tx) => this.owner(tx, actor),
      async (tx) => {
        const id = 'BLD-' + randomUUID().slice(0, 8).toUpperCase();
        await tx.query(
          'INSERT INTO build_projects(organization_id,id,name,client,location,acres,template) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            actor.organizationId,
            id,
            p.name,
            p.client,
            p.location,
            p.acres,
            p.template,
          ],
        );
        const empty = makeJob(true);
        const initial = p.draft || {
          planning: empty.planning,
          features: [],
          items: [],
          scale: 0,
          spacing: 25,
          image: p.template === 'landscape' ? empty.image : '',
          imageHeight: 800,
        };
        const draft = await this.validateDraft(tx, actor, id, initial);
        await tx.query(
          'INSERT INTO build_drafts(organization_id,project_id,content,updated_by) VALUES($1,$2,$3,$4)',
          [actor.organizationId, id, JSON.stringify(draft), actor.id],
        );
        return { id };
      },
    );
  }

  async saveDraft(actor: Actor, id: string, input: unknown, key: string) {
    const parsed = saveSchema.parse(input);
    return this.action(
      actor,
      key,
      { op: 'save', id, ...parsed },
      (tx) => this.access(tx, actor, id, ['owner', 'lead']),
      async (tx) => {
        const draft = await this.validateDraft(tx, actor, id, parsed.draft);
        const r = await one(
          tx,
          'UPDATE build_drafts SET content=$1,version=version+1,updated_by=$2,updated_at=now() WHERE organization_id=$3 AND project_id=$4 AND version=$5 RETURNING version',
          [
            JSON.stringify(draft),
            actor.id,
            actor.organizationId,
            id,
            parsed.expectedVersion,
          ],
        );
        check(
          r,
          409,
          'Someone else changed this project. Reload the saved version before editing again.',
        );
        return { version: r.version };
      },
    );
  }

  async publish(actor: Actor, id: string, input: unknown, key: string) {
    const p = publishSchema.parse(input);
    return this.action(
      actor,
      key,
      { op: 'publish', id, ...p },
      (tx) => this.access(tx, actor, id, ['owner']),
      async (tx) => {
        const d = await one(
          tx,
          'SELECT * FROM build_drafts WHERE organization_id=$1 AND project_id=$2 FOR UPDATE',
          [actor.organizationId, id],
        );
        check(
          d && d.version === p.expectedVersion,
          409,
          'The draft changed. Review the current version before sharing.',
        );
        const content = await this.validateDraft(tx, actor, id, d.content);
        check(
          !content.features.some((f) => f.included) || content.scale > 0,
          400,
          'Calibrate mapped work before sharing.',
        );
        const rows = scopeRows(
          content.features,
          content.scale,
          content.spacing,
          content.items,
        );
        check(rows.length, 400, 'Include at least one work package.');
        const total = rows.reduce(
          (sum, r) => sum + Math.round(r.total * 100),
          0,
        );
        check(
          Number.isSafeInteger(total),
          400,
          'The scope total is too large.',
        );
        calculatePlan(rows, content.features, content.planning);
        const previous = await this.latest(tx, actor.organizationId, id);
        const number = (previous?.number || 0) + 1;
        const revisionId = randomUUID();
        const project = await one(
          tx,
          'SELECT * FROM build_projects WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, id],
        );
        const org = await one(
          tx,
          'SELECT brand FROM build_organizations WHERE id=$1',
          [actor.organizationId],
        );
        const shared = {
          ...content,
          rows,
          total: total / 100,
          revision: number,
          status: 'Awaiting review',
        };
        const documents = [];
        for (const fileId of content.attachments) {
          const file = await one(
            tx,
            'SELECT id,name,mime FROM build_files WHERE id=$1 AND organization_id=$2 AND project_id=$3',
            [fileId, actor.organizationId, id],
          );
          documents.push({ ...file, url: `/api/build/files/${fileId}` });
        }
        const snapshot = {
          project: this.projectDTO(project!),
          brand: { ...org!.brand, name: PRODUCT_NAME },
          shared: { ...shared, documents },
        };
        await tx.query(
          'INSERT INTO build_revisions(id,organization_id,project_id,number,draft_version,snapshot,snapshot_hash,published_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            revisionId,
            actor.organizationId,
            id,
            number,
            d.version,
            JSON.stringify(snapshot),
            requestHash(snapshot),
            actor.id,
          ],
        );
        await tx.query(
          "UPDATE build_projects SET stage='Client review' WHERE organization_id=$1 AND id=$2",
          [actor.organizationId, id],
        );
        let link = await one(
          tx,
          'SELECT id FROM build_shares WHERE organization_id=$1 AND project_id=$2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1',
          [actor.organizationId, id],
        );
        if (!link) {
          link = { id: randomUUID() };
          await tx.query(
            'INSERT INTO build_shares(id,organization_id,project_id,token_hash) VALUES($1,$2,$3,$4)',
            [link.id, actor.organizationId, id, hash(this.token(link.id))],
          );
        }
        return { revisionId, number, sharePath: `/s/${this.token(link.id)}` };
      },
    );
  }

  async captureUpdate(actor: Actor, id: string, input: unknown, key: string) {
    const p = updateSchema.parse(input);
    return this.action(
      actor,
      key,
      { op: 'update', id, ...p },
      (tx) =>
        this.access(
          tx,
          actor,
          id,
          p.visibility === 'client'
            ? ['owner', 'lead']
            : ['owner', 'lead', 'crew'],
        ),
      async (tx) => {
        const updateId = randomUUID();
        await tx.query(
          'INSERT INTO build_updates(id,organization_id,project_id,author_id,body,visibility) VALUES($1,$2,$3,$4,$5,$6)',
          [updateId, actor.organizationId, id, actor.id, p.text, p.visibility],
        );
        return { id: updateId };
      },
    );
  }

  async share(token: string, actor?: Actor, revisionId?: string) {
    check(/^[a-zA-Z0-9_-]{43}$/.test(token), 404, 'This link is unavailable.');
    const link = await one(
      this.db,
      'SELECT * FROM build_shares WHERE token_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())',
      [hash(token)],
    );
    check(link, 404, 'This link has expired or been revoked.');
    const latest = await this.latest(
      this.db,
      link.organization_id,
      link.project_id,
    );
    const rev = revisionId
      ? await one(
          this.db,
          'SELECT * FROM build_revisions WHERE id=$1 AND organization_id=$2 AND project_id=$3',
          [revisionId, link.organization_id, link.project_id],
        )
      : latest;
    check(rev, 404, 'No published proposal is available.');
    const comments = await this.db.query(
      'SELECT r.*,p.display_name FROM build_responses r JOIN build_people p ON p.id=r.author_id WHERE revision_id=$1 ORDER BY r.created_at',
      [rev.id],
    );
    const updates = await this.db.query(
      "SELECT body FROM build_updates WHERE organization_id=$1 AND project_id=$2 AND visibility='client' ORDER BY created_at DESC",
      [link.organization_id, link.project_id],
    );
    const access = actor
      ? await one(
          this.db,
          'SELECT 1 FROM build_client_access WHERE organization_id=$1 AND project_id=$2 AND user_id=$3 AND active=true',
          [link.organization_id, link.project_id, actor.id],
        )
      : null;
    const shared = structuredClone(rev.snapshot.shared);
    if (shared.image.startsWith('/api/build/files/'))
      shared.image = `/api/build/shares/${token}/files/${shared.image.split('/').pop()}?revision=${rev.id}`;
    shared.documents = (shared.documents || []).map(
      (f: { id: string; name: string; mime: string; url: string }) => ({
        ...f,
        url: `/api/build/shares/${token}/files/${f.id}?revision=${rev.id}`,
      }),
    );
    shared.status = await this.responseStatus(this.db, rev.id);
    const history = await this.db.query(
      'SELECT id,number,published_at FROM build_revisions WHERE organization_id=$1 AND project_id=$2 ORDER BY number DESC',
      [link.organization_id, link.project_id],
    );
    // Deliberately construct a published-only DTO; never spread a current Job.
    return {
      project: rev.snapshot.project,
      brand: rev.snapshot.brand,
      revisionId: rev.id,
      snapshotHash: rev.snapshot_hash,
      isLatest: rev.id === latest?.id,
      canRespond: !!access && rev.id === latest?.id,
      revisions: history.rows,
      job: {
        ...shared,
        shared,
        comments: comments.rows.map((r) => ({
          author: r.display_name,
          text:
            r.body ||
            (r.kind === 'approved'
              ? 'Approved this proposal.'
              : 'Requested changes.'),
          revision: rev.number,
        })),
        activity: updates.rows.map((r) => r.body),
      } as Job,
    };
  }

  async respond(actor: Actor, token: string, input: unknown, key: string) {
    const p = responseSchema.parse(input);
    const link = await one(
      this.db,
      'SELECT * FROM build_shares WHERE token_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())',
      [hash(token)],
    );
    check(link, 404, 'This link is unavailable.');
    const acting = { ...actor, organizationId: link.organization_id };
    return this.action(
      acting,
      key,
      { op: 'response', token, ...p },
      async (tx) => {
        const permission = await one(
          tx,
          'SELECT 1 FROM build_client_access WHERE organization_id=$1 AND project_id=$2 AND user_id=$3 AND active=true',
          [link.organization_id, link.project_id, actor.id],
        );
        check(permission, 403, 'Sign in as a client invited to this project.');
        const active = await one(
          tx,
          'SELECT id FROM build_shares WHERE id=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())',
          [link.id],
        );
        check(active, 404, 'This link is unavailable.');
        const latest = await this.latest(
          tx,
          link.organization_id,
          link.project_id,
        );
        check(
          latest?.id === p.revisionId,
          409,
          'A newer proposal is available. Review it before responding.',
        );
      },
      async (tx) => {
        const rev = await this.latest(
          tx,
          link.organization_id,
          link.project_id,
        );
        const id = randomUUID();
        await tx.query(
          'INSERT INTO build_responses(id,organization_id,project_id,revision_id,author_id,kind,body,snapshot_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            id,
            link.organization_id,
            link.project_id,
            p.revisionId,
            actor.id,
            p.kind,
            p.text,
            rev!.snapshot_hash,
          ],
        );
        return { id };
      },
    );
  }

  async revoke(actor: Actor, id: string, key: string) {
    return this.action(
      actor,
      key,
      { op: 'revoke', id },
      (tx) => this.access(tx, actor, id, ['owner']),
      async (tx) => {
        await tx.query(
          'UPDATE build_shares SET revoked_at=now() WHERE organization_id=$1 AND project_id=$2 AND revoked_at IS NULL',
          [actor.organizationId, id],
        );
        return { revoked: true };
      },
    );
  }

  async team(actor: Actor) {
    await this.owner(this.db, actor);
    return (
      await this.db.query(
        'SELECT p.id,p.email,p.display_name,m.role,m.active FROM build_memberships m JOIN build_people p ON p.id=m.user_id WHERE organization_id=$1 ORDER BY display_name',
        [actor.organizationId],
      )
    ).rows;
  }
  async addMember(actor: Actor, input: unknown, key: string) {
    const p = z
      .object({
        email: z.email().trim().toLowerCase(),
        name: z.string().trim().min(1).max(200),
        role: z.enum(['lead', 'crew']),
      })
      .strict()
      .parse(input);
    return this.action(
      actor,
      key,
      { op: 'addMember', ...p },
      (tx) => this.owner(tx, actor),
      async (tx) => {
        let person = await one(
          tx,
          'SELECT id FROM build_people WHERE email=$1',
          [p.email],
        );
        if (!person) {
          person = { id: randomUUID() };
          await tx.query(
            'INSERT INTO build_people(id,email,display_name) VALUES($1,$2,$3)',
            [person.id, p.email, p.name],
          );
        }
        const existing = await one(
          tx,
          'SELECT organization_id FROM build_memberships WHERE user_id=$1 AND active=true',
          [person.id],
        );
        check(!existing, 409, 'This person already belongs to a workspace.');
        await tx.query(
          'INSERT INTO build_memberships(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=EXCLUDED.role,active=true',
          [actor.organizationId, person.id, p.role],
        );
        return { id: person.id };
      },
    );
  }
  async deactivateMember(actor: Actor, userId: string, key: string) {
    check(userId !== actor.id, 400, 'You cannot remove your own owner access.');
    return this.action(
      actor,
      key,
      { op: 'deactivateMember', userId },
      (tx) => this.owner(tx, actor),
      async (tx) => {
        await tx.query(
          "UPDATE build_memberships SET active=false WHERE organization_id=$1 AND user_id=$2 AND role<>'owner'",
          [actor.organizationId, userId],
        );
        return { deactivated: true };
      },
    );
  }
  async assign(actor: Actor, id: string, userId: string, key: string) {
    return this.action(
      actor,
      key,
      { op: 'assign', id, userId },
      (tx) => this.access(tx, actor, id, ['owner']),
      async (tx) => {
        const m = await one(
          tx,
          'SELECT 1 FROM build_memberships WHERE organization_id=$1 AND user_id=$2 AND active=true',
          [actor.organizationId, userId],
        );
        check(m, 400, 'Choose an active team member.');
        await tx.query(
          'INSERT INTO build_project_members(organization_id,project_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [actor.organizationId, id, userId],
        );
        return { assigned: true };
      },
    );
  }

  async invite(
    actor: Actor,
    id: string,
    email: string,
    name: string,
    key: string,
  ) {
    check(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        name.trim().length > 0 &&
        name.length <= 200,
      400,
      'Enter a client name and email.',
    );
    email = email.trim().toLowerCase();
    return this.action(
      actor,
      key,
      { op: 'invite', id, email, name },
      (tx) => this.access(tx, actor, id, ['owner']),
      async (tx) => {
        let person = await one(
          tx,
          'SELECT id FROM build_people WHERE email=$1',
          [email],
        );
        if (!person) {
          person = { id: randomUUID() };
          await tx.query(
            'INSERT INTO build_people(id,email,display_name) VALUES($1,$2,$3)',
            [person.id, email, name],
          );
        }
        await tx.query(
          'INSERT INTO build_client_access(organization_id,project_id,user_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,project_id,user_id) DO UPDATE SET active=true',
          [actor.organizationId, id, person.id],
        );
        return { granted: true };
      },
    );
  }
}
