import { spawn } from 'node:child_process';
const commands = [
  [
    '--experimental-strip-types',
    '--env-file-if-exists=.env.local',
    'server/main.ts',
  ],
  [
    'node_modules/vinext/bin/vinext.mjs',
    'dev',
    '--host',
    '127.0.0.1',
    '--port',
    '3010',
  ],
];
// Use the installed executable entry instead of assuming a global Node/npm.
const { readFile } = await import('node:fs/promises');
const pkg = JSON.parse(
  await readFile(
    new URL('../node_modules/vinext/package.json', import.meta.url),
    'utf8',
  ),
);
commands[1][0] =
  'node_modules/vinext/' +
  (typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vinext);
const children = commands.map((args) =>
  spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, BUILD_MODE: process.env.BUILD_MODE || 'local' },
  }),
);
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const child of children)
  child.on('exit', (code) => {
    stop();
    if (code) process.exitCode = code;
  });
