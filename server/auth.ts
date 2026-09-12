import { randomBytes } from 'node:crypto';
import { check } from './contracts.ts';
import { hash, type BuildService, type Actor } from './service.ts';
import { one } from './db.ts';
import { localAccounts } from './seed.ts';

export type Config = {
  mode: 'local' | 'production';
  appOrigin: string;
  shareSecret: string;
  workerSecret: string;
  workerOrganizationId: string;
  proxySecret: string;
  telegramSecret: string;
  telegramBotId: string;
  telegramToken: string;
  supabaseUrl: string;
  supabaseKey: string;
  supabaseServiceKey: string;
  storageBucket: string;
  dataDir: string;
};
export const cookies = (request: Request) =>
  Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .filter((s) => s.includes('='))
      .map((s) => {
        const i = s.indexOf('=');
        return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
      }),
  );
export const sessionCookie = (token: string, c: Config, maxAge = 3600) =>
  `build_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${c.mode === 'production' ? '; Secure' : ''}`;

async function verifiedSupabaseUser(token: string, c: Config) {
  check(
    c.supabaseUrl && c.supabaseKey,
    503,
    'Sign-in has not been configured.',
  );
  const response = await fetch(`${c.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: c.supabaseKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  check(response.ok, 401, 'Your session expired. Sign in again.');
  const user = (await response.json()) as {
    id: string;
    email: string;
    email_confirmed_at: string;
  };
  check(
    user.id && user.email && user.email_confirmed_at,
    401,
    'Verify your email before continuing.',
  );
  return user;
}

export async function authenticate(
  request: Request,
  service: BuildService,
  c: Config,
): Promise<Actor> {
  const token = cookies(request).build_session;
  check(token, 401, 'Sign in to continue.');
  if (c.mode === 'local') {
    const session = await one(
      service.db,
      'SELECT user_id FROM build_sessions WHERE token_hash=$1 AND expires_at>now()',
      [hash(token)],
    );
    check(session, 401, 'Your local session expired.');
    return service.actor(session.user_id);
  }
  const user = await verifiedSupabaseUser(token, c);
  let person = await one(
    service.db,
    'SELECT id FROM build_people WHERE auth_subject=$1',
    [user.id],
  );
  if (!person) {
    person = await one(
      service.db,
      'UPDATE build_people SET auth_subject=$1 WHERE lower(email)=$2 AND auth_subject IS NULL RETURNING id',
      [user.id, user.email.toLowerCase()],
    );
  }
  check(
    person,
    403,
    'You have not been invited to a TERA workspace or project.',
  );
  return service.actor(person.id);
}

export async function localSignIn(
  userId: string,
  service: BuildService,
  c: Config,
) {
  check(c.mode === 'local', 404, 'Not found.');
  check(
    localAccounts.some((a) => a.id === userId),
    403,
    'Choose a local test account.',
  );
  const actor = await service.actor(userId);
  const token = Buffer.from(randomBytes(32)).toString('base64url');
  await service.db.query(
    "INSERT INTO build_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [hash(token), actor.id],
  );
  return { actor, cookie: sessionCookie(token, c, 43200) };
}

export async function sendCode(email: string, c: Config) {
  check(
    c.mode === 'production' && c.supabaseUrl && c.supabaseKey,
    503,
    'Email sign-in is not configured in local mode.',
  );
  check(
    typeof email === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      email.length <= 254,
    400,
    'Enter a valid email.',
  );
  const response = await fetch(`${c.supabaseUrl}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: c.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true }),
    signal: AbortSignal.timeout(15000),
  });
  check(
    response.ok,
    400,
    'The sign-in code could not be sent. Try again shortly.',
  );
}

export async function verifyCode(email: string, code: string, c: Config) {
  check(c.mode === 'production', 404, 'Not found.');
  check(
    typeof email === 'string' &&
      email.length <= 254 &&
      typeof code === 'string' &&
      /^\d{6,10}$/.test(code),
    400,
    'Enter the email code.',
  );
  const response = await fetch(`${c.supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: c.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token: code, type: 'email' }),
    signal: AbortSignal.timeout(15000),
  });
  check(response.ok, 401, 'This code is invalid or expired.');
  const result = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  check(result.access_token, 401, 'Sign-in was unsuccessful.');
  return sessionCookie(
    result.access_token,
    c,
    Math.min(result.expires_in || 3600, 3600),
  );
}
