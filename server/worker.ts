import { z } from 'zod';
import { runOnce, deliverOnce, type WorkerConfig } from './worker-runtime.ts';
const c: WorkerConfig = {
  api: process.env.BUILD_API_ORIGIN || 'http://127.0.0.1:4311',
  secret: process.env.BUILD_WORKER_SECRET || '',
  hermes: process.env.HERMES_API_ORIGIN || 'http://127.0.0.1:8642',
  hermesKey: process.env.HERMES_API_KEY || '',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  transcriptionUrl: process.env.TRANSCRIPTION_URL || '',
  transcriptionKey: process.env.TRANSCRIPTION_API_KEY || '',
  transcriptionModel: process.env.TRANSCRIPTION_MODEL || '',
  sendReplies: process.env.BUILD_SEND_TELEGRAM_REPLIES === 'true',
};
if (!c.secret || !c.hermesKey)
  throw new Error('BUILD_WORKER_SECRET and HERMES_API_KEY are required.');
const capabilities = await fetch(`${c.hermes}/v1/capabilities`, {
  headers: { Authorization: `Bearer ${c.hermesKey}` },
  signal: AbortSignal.timeout(10000),
});
const available = z
  .object({
    features: z
      .object({
        run_submission: z.boolean().optional(),
        run_status: z.boolean().optional(),
        runs_idempotency: z
          .object({ supported: z.boolean(), durable: z.boolean() })
          .optional(),
      })
      .optional(),
  })
  .parse(await capabilities.json());
if (
  !capabilities.ok ||
  available.features?.run_submission !== true ||
  available.features?.run_status !== true ||
  available.features?.runs_idempotency?.supported !== true ||
  available.features?.runs_idempotency?.durable !== true
)
  throw new Error(
    'The configured Hermes runtime must expose the Runs API with durable idempotency.',
  );
let stop = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stop = true;
  });
do {
  await runOnce(c);
  await deliverOnce(c);
  if (process.argv.includes('--once')) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
} while (!stop);
