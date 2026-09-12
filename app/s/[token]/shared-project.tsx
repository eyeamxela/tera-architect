'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BuildService } from '../../../server/service';
import ClientProposal from '../../client-proposal';
import { BrandProvider } from '../../brand';
import { api, SignIn } from '../../build-client';
import { Button } from '@/components/ui/button';

export default function SharedProject({ token }: { token: string }) {
  const [data, setData] = useState<Awaited<
      ReturnType<BuildService['share']>
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [signin, setSignin] = useState(false),
    [revision, setRevision] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const id = ++sequence.current;
    try {
      const next = await api<Awaited<ReturnType<BuildService['share']>>>(
        `/shares/${token}${revision ? `?revision=${encodeURIComponent(revision)}` : ''}`,
      );
      if (id === sequence.current) {
        setData(next);
        setError('');
      }
    } catch (e) {
      if (id === sequence.current) setError((e as Error).message);
    }
  }, [token, revision]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const respond = async (kind: string, text = '') => {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      await api(`/shares/${token}/responses`, {
        method: 'POST',
        body: { kind, text, revisionId: data.revisionId },
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  if (signin)
    return (
      <SignIn
        title="Join the project conversation."
        onSignedIn={() => {
          setSignin(false);
          void load();
        }}
      />
    );
  if (!data)
    return (
      <section className="build-access">
        <div className="build-access-card">
          <div className="build-wordmark">TERA</div>
          <h1>
            {error ? 'This proposal is unavailable.' : 'Opening the proposal…'}
          </h1>
          {error && <p role="alert">{error}</p>}
        </div>
      </section>
    );
  return (
    <BrandProvider value={data.brand}>
      <div className="build-portal-access">
        <span>
          {data.isLatest
            ? 'Current published proposal'
            : 'Earlier published revision'}{' '}
          · {data.project.name}
        </span>
        <div>
          <select
            aria-label="Proposal revision"
            value={revision || data.revisionId}
            onChange={(e) => {
              setData(null);
              setRevision(e.target.value);
            }}
          >
            {data.revisions.map((r) => (
              <option key={r.id} value={r.id}>
                Revision {r.number}
              </option>
            ))}
          </select>
          {!data.canRespond && data.isLatest ? (
            <Button variant="ghost" onClick={() => setSignin(true)}>
              Client sign in
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={async () => {
                await api('/auth/logout', { method: 'POST' });
                void load();
              }}
            >
              Sign out
            </Button>
          )}
        </div>
        {error && (
          <p className="build-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <ClientProposal
        key={data.revisionId}
        project={data.project}
        job={data.job}
        mode="client"
        canRespond={data.canRespond}
        busy={busy}
        onApprove={() => {
          void respond('approved').catch(() => {});
        }}
        onRequest={() => {
          void respond('changes_requested').catch(() => {});
        }}
        onComment={(text) => respond('comment', text)}
        onUpdate={() => {}}
        onScope={() => {}}
      />
    </BrandProvider>
  );
}
