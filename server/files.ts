import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { check } from './contracts.ts';
import { one, type Sql } from './db.ts';
import type { BuildService, Actor } from './service.ts';
import { hash } from './service.ts';
import type { Config } from './auth.ts';

export async function uploadFile(
  service: BuildService,
  c: Config,
  actor: Actor,
  projectId: string,
  bytes: Uint8Array,
  mime: string,
  name: string,
  sourceKey?: string,
  guard?: (tx: Sql) => Promise<unknown>,
) {
  await service.access(service.db, actor, projectId);
  check(
    [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'audio/ogg',
    ].includes(mime),
    400,
    'Upload a PNG, JPEG, WebP, PDF, or Ogg voice note.',
  );
  check(
    bytes.length > 0 && bytes.length <= 10 * 1024 * 1024,
    413,
    'Files must be 10 MB or smaller.',
  );
  check(
    name.length > 0 && name.length <= 240,
    400,
    'Choose a shorter file name.',
  );
  const signature = Buffer.from(bytes.slice(0, 12));
  const valid =
    mime === 'image/png'
      ? signature
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mime === 'image/jpeg'
        ? signature[0] === 255 && signature[1] === 216
        : mime === 'image/webp'
          ? signature.toString('ascii', 0, 4) === 'RIFF' &&
            signature.toString('ascii', 8, 12) === 'WEBP'
          : mime === 'audio/ogg'
            ? signature.toString('ascii', 0, 4) === 'OggS'
            : signature.toString('ascii', 0, 5) === '%PDF-';
  check(valid, 400, 'The file content does not match its type.');
  if (sourceKey) {
    const prior = await service.db.transaction(async (tx) => {
      if (guard) await guard(tx);
      await service.access(tx, actor, projectId);
      return one(
        tx,
        'SELECT id,name,mime FROM build_files WHERE organization_id=$1 AND project_id=$2 AND source_key=$3',
        [actor.organizationId, projectId, sourceKey],
      );
    });
    if (prior) return { ...prior, url: `/api/build/files/${prior.id}` };
  }
  const id = randomUUID(),
    key = `${actor.organizationId}/${projectId}/${id}`;
  if (c.mode === 'local') {
    await mkdir(join(c.dataDir, 'files'), { recursive: true });
    await writeFile(join(c.dataDir, 'files', id), bytes);
  } else {
    check(c.supabaseServiceKey, 503, 'File storage has not been configured.');
    const r = await fetch(
      `${c.supabaseUrl}/storage/v1/object/${c.storageBucket}/${key}`,
      {
        method: 'POST',
        headers: {
          apikey: c.supabaseServiceKey,
          Authorization: `Bearer ${c.supabaseServiceKey}`,
          'Content-Type': mime,
        },
        body: bytes as BodyInit,
        signal: AbortSignal.timeout(30000),
      },
    );
    check(r.ok, 502, 'The file could not be stored.');
  }
  try {
    await service.db.transaction(async (tx) => {
      if (guard) await guard(tx);
      await service.access(tx, actor, projectId);
      await tx.query(
        'INSERT INTO build_files(id,organization_id,project_id,owner_id,name,mime,size,storage_key,source_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          id,
          actor.organizationId,
          projectId,
          actor.id,
          name,
          mime,
          bytes.length,
          key,
          sourceKey || null,
        ],
      );
    });
  } catch (error) {
    if (c.mode === 'local')
      await unlink(join(c.dataDir, 'files', id)).catch(() => {});
    else
      await fetch(`${c.supabaseUrl}/storage/v1/object/${c.storageBucket}`, {
        method: 'DELETE',
        headers: {
          apikey: c.supabaseServiceKey,
          Authorization: `Bearer ${c.supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: [key] }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    throw error;
  }
  return { id, name, mime, url: `/api/build/files/${id}` };
}

export async function readProjectFile(
  service: BuildService,
  c: Config,
  id: string,
  actor?: Actor,
  shareToken?: string,
  revision?: string,
) {
  check(/^[a-f0-9-]{36}$/.test(id), 404, 'File not found.');
  const f = await one(service.db, 'SELECT * FROM build_files WHERE id=$1', [
    id,
  ]);
  check(f, 404, 'File not found.');
  if (shareToken) {
    const portal = await service.share(shareToken, undefined, revision);
    const link = await one(
      service.db,
      'SELECT organization_id,project_id FROM build_shares WHERE token_hash=$1',
      [hash(shareToken)],
    );
    const published = await one(
      service.db,
      'SELECT snapshot FROM build_revisions WHERE id=$1 AND organization_id=$2 AND project_id=$3',
      [portal.revisionId, link?.organization_id, link?.project_id],
    );
    check(
      link &&
        f.organization_id === link.organization_id &&
        f.project_id === link.project_id &&
        (published?.snapshot.shared.image === `/api/build/files/${id}` ||
          published?.snapshot.shared.attachments?.includes(id)),
      404,
      'This file is not part of the published proposal.',
    );
  } else {
    check(actor, 401, 'Sign in to view this file.');
    await service.access(service.db, actor, f.project_id);
    check(f.organization_id === actor.organizationId, 404, 'File not found.');
  }
  let bytes: Uint8Array;
  if (c.mode === 'local') bytes = await readFile(join(c.dataDir, 'files', id));
  else {
    const r = await fetch(
      `${c.supabaseUrl}/storage/v1/object/authenticated/${c.storageBucket}/${f.storage_key}`,
      {
        headers: {
          apikey: c.supabaseServiceKey,
          Authorization: `Bearer ${c.supabaseServiceKey}`,
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    check(r.ok, 502, 'File storage is unavailable.');
    bytes = new Uint8Array(await r.arrayBuffer());
  }
  return new Response(bytes as BodyInit, {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': `${f.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename="${f.name.replace(/[^a-zA-Z0-9._ -]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
