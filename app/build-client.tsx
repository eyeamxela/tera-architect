'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Job, Project } from './data';
import type { Brand } from './brand';

export type WorkspaceData = {
  brand: Brand;
  actor: {
    id: string;
    name: string;
    role: 'owner' | 'lead' | 'crew' | 'client';
    organizationId: string;
  };
  projects: Project[];
  jobs: Record<string, Job>;
  versions: Record<string, number>;
  shares: Record<string, string | null>;
};
export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; key?: string } = {},
): Promise<T> {
  const response = await fetch(`/api/build${path}`, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.method && options.method !== 'GET'
        ? { 'Idempotency-Key': options.key || crypto.randomUUID() }
        : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'The server returned an unreadable response.' }));
  if (!response.ok)
    throw new RequestError(
      response.status,
      data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'string'
        ? data.error
        : 'The request failed.',
    );
  return data as T;
}

export function SignIn({
  onSignedIn,
  title = 'Your projects, all in one place.',
}: {
  onSignedIn: () => void;
  title?: string;
}) {
  const [options, setOptions] = useState<{
    mode: string;
    accounts: { id: string; name: string }[];
  } | null>(null);
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    api<{ mode: string; accounts: { id: string; name: string }[] }>(
      '/auth/options',
    )
      .then(setOptions)
      .catch((e) => setError(e.message));
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="build-access">
      <div className="build-access-card">
        <div className="build-wordmark">
          TERA<span>PROJECTS & CLIENTS</span>
        </div>
        <h1>{title}</h1>
        <p>Scopes, plans, and the work ahead.</p>
        {options?.mode === 'local' ? (
          <>
            <div className="build-local-label">LOCAL TEST WORKSPACE</div>
            <p className="build-help">
              Example accounts with different project permissions. Work is saved
              in the local database.
            </p>
            <div className="build-account-list">
              {options.accounts.map((a) => (
                <Button
                  key={a.id}
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api('/auth/local', {
                        method: 'POST',
                        body: { userId: a.id },
                      });
                      onSignedIn();
                    })
                  }
                >
                  {a.name}
                </Button>
              ))}
            </div>
          </>
        ) : options ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (sent) {
                  await api('/auth/verify', {
                    method: 'POST',
                    body: { email, code },
                  });
                  onSignedIn();
                } else {
                  await api('/auth/email', { method: 'POST', body: { email } });
                  setSent(true);
                }
              });
            }}
          >
            <label htmlFor="build-client-field-1">
              Email
              <Input
                id="build-client-field-1"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            {sent && (
              <label htmlFor="build-client-field-2">
                Email code
                <Input
                  id="build-client-field-2"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Please wait…' : sent ? 'Continue' : 'Send sign-in code'}
            </Button>
            {sent && (
              <p className="build-help">
                Check your email for the code. Access is limited to invited
                clients and team members.
              </p>
            )}
          </form>
        ) : (
          <p>Connecting to your workspace…</p>
        )}
        {error && (
          <p role="alert" className="build-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

export function WorkspaceGate({
  children,
}: {
  children: (
    initial: WorkspaceData,
    mode: string,
    logout: () => Promise<void>,
  ) => ReactNode;
}) {
  const [data, setData] = useState<WorkspaceData | null>(null),
    [mode, setMode] = useState(''),
    [signin, setSignin] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const session = await api<{ mode: string }>('/auth/session');
      setMode(session.mode);
      const workspace = await api<WorkspaceData>('/workspace');
      setData(workspace);
      setSignin(false);
      setError('');
    } catch (e) {
      if ((e as RequestError).status === 401) setSignin(true);
      else setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (signin) return <SignIn onSignedIn={() => void load()} />;
  if (error)
    return (
      <section className="build-access">
        <div className="build-access-card">
          <div className="build-wordmark">TERA</div>
          <h1>Let’s reconnect.</h1>
          <p role="alert">{error}</p>
          <Button onClick={() => void load()}>Try again</Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await api('/auth/logout', { method: 'POST' });
              setData(null);
              setError('');
              setSignin(true);
            }}
          >
            Switch account
          </Button>
        </div>
      </section>
    );
  if (!data)
    return (
      <section className="build-access">
        <div className="build-access-card">
          <div className="build-wordmark">TERA</div>
          <p>Opening your projects…</p>
        </div>
      </section>
    );
  if (!data.projects.length)
    return (
      <EmptyWorkspace
        workspace={data}
        onCreated={() => void load()}
        onLogout={async () => {
          await api('/auth/logout', { method: 'POST' });
          setData(null);
          setSignin(true);
        }}
      />
    );
  return children(data, mode, async () => {
    await api('/auth/logout', { method: 'POST' });
    setData(null);
    setSignin(true);
  });
}

function EmptyWorkspace({
  workspace,
  onCreated,
  onLogout,
}: {
  workspace: WorkspaceData;
  onCreated: () => void;
  onLogout: () => Promise<void>;
}) {
  const [name, setName] = useState(''),
    [client, setClient] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section className="build-access">
      <div className="build-access-card">
        <div className="build-wordmark">TERA</div>
        <h1>Your first project starts here.</h1>
        {workspace.actor.role === 'owner' ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api('/projects', {
                  method: 'POST',
                  body: {
                    name,
                    client,
                    location: '',
                    acres: 0,
                    template: 'general',
                  },
                });
                onCreated();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="build-client-field-3">
              Project name
              <Input
                id="build-client-field-3"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label htmlFor="build-client-field-4">
              Client name
              <Input
                id="build-client-field-4"
                required
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </label>
            <Button disabled={busy}>Create project</Button>
          </form>
        ) : (
          <p>
            Your workspace owner can assign you to a project. Assigned projects
            will appear here.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <Button variant="ghost" onClick={() => void onLogout()}>
          Sign out
        </Button>
      </div>
    </section>
  );
}
