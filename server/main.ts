import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { connectDatabase, migrate } from './db.ts';
import { BuildService } from './service.ts';
import { createApi } from './api.ts';
import { seedLocal, localOrg } from './seed.ts';
import type { Config } from './auth.ts';

const local = process.env.BUILD_MODE === 'local';
const dataDir = resolve(process.env.BUILD_DATA_DIR || '.build-local');
let localSecret = '';
if (local) {
  await mkdir(dataDir, { recursive: true });
  const path = join(dataDir, 'share-secret');
  try {
    localSecret = await readFile(path, 'utf8');
  } catch {
    localSecret = Buffer.from(randomBytes(32)).toString('hex');
    await writeFile(path, localSecret, { mode: 0o600, flag: 'wx' });
  }
}
const c: Config = {
  mode: local ? 'local' : 'production',
  appOrigin: process.env.BUILD_APP_ORIGIN || 'http://localhost:3000',
  shareSecret: process.env.BUILD_SHARE_SECRET || localSecret,
  workerSecret:
    process.env.BUILD_WORKER_SECRET || (local ? 'local-worker-test-key' : ''),
  workerOrganizationId:
    process.env.BUILD_ORGANIZATION_ID || (local ? localOrg : ''),
  proxySecret: process.env.BUILD_PROXY_SECRET || '',
  telegramSecret:
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    (local ? 'local-webhook-test-key' : ''),
  telegramBotId: process.env.TELEGRAM_BOT_ID || (local ? 'local-test' : ''),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  storageBucket: process.env.BUILD_STORAGE_BUCKET || 'build-files',
  dataDir,
};
if (
  !local &&
  (!process.env.DATABASE_URL ||
    c.shareSecret.length < 32 ||
    c.workerSecret.length < 32 ||
    c.proxySecret.length < 32 ||
    !c.workerOrganizationId ||
    !c.appOrigin.startsWith('https://') ||
    !c.supabaseUrl ||
    !c.supabaseKey)
)
  throw new Error(
    'Production requires DATABASE_URL, Supabase Auth, organization ID, HTTPS app origin, and strong share/worker/proxy secrets.',
  );
const db = await connectDatabase(
  local
    ? { localPath: join(dataDir, 'postgres') }
    : { connectionString: process.env.DATABASE_URL },
);
if (local || process.argv.includes('--migrate')) await migrate(db);
if (process.argv.includes('--migrate') && !local) {
  await db.close();
  process.exit(0);
}
const service = new BuildService(db, c.shareSecret);
if (local) await seedLocal(service);
const api = createApi(service, c);
const port = Number(process.env.BUILD_API_PORT || 4311);
const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 11 * 1024 * 1024) {
        res.writeHead(413);
        res.end('Request too large');
        return;
      }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
    const body = Buffer.concat(chunks);
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method: req.method,
      headers,
      ...(body.length ? { body: body as unknown as BodyInit } : {}),
    });
    const response = await api(request);
    res.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    );
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Request failed.' }));
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    `TERA API: http://127.0.0.1:${port} (${c.mode}; database persisted)`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
