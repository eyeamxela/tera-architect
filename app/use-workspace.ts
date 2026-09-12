'use client';
import { useEffect, useRef, useState } from 'react';
import { api, RequestError, type WorkspaceData } from './build-client';
import type { BuildService } from '../server/service';
import { draftFromJob } from '../server/contracts';
import type { Job } from './data';

export function useWorkspace(initial: WorkspaceData) {
  const [data, setData] = useState(initial),
    [status, setStatus] = useState('Saved'),
    [error, setError] = useState('');
  const current = useRef(initial),
    dirty = useRef(new Set<string>()),
    running = useRef(new Map<string, Promise<void>>()),
    timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const attempts = useRef(
    new Map<
      string,
      {
        key: string;
        body: {
          expectedVersion: number;
          draft: ReturnType<typeof draftFromJob>;
        };
      }
    >(),
  );
  const update = (next: WorkspaceData) => {
    current.current = next;
    setData(next);
  };
  async function flush(id: string): Promise<void> {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    const active = running.current.get(id);
    if (active) {
      await active;
      if (dirty.current.has(id)) return flush(id);
      return;
    }
    if (!dirty.current.has(id)) return;
    const task = (async () => {
      setStatus('Saving…');
      setError('');
      try {
        while (dirty.current.has(id)) {
          let attempt = attempts.current.get(id);
          if (!attempt) {
            attempt = {
              key: crypto.randomUUID(),
              body: {
                expectedVersion: current.current.versions[id],
                draft: draftFromJob(current.current.jobs[id]),
              },
            };
            attempts.current.set(id, attempt);
          }
          const result = await api<{ version: number }>(
            `/projects/${id}/draft`,
            { method: 'PUT', body: attempt.body, key: attempt.key },
          );
          update({
            ...current.current,
            versions: { ...current.current.versions, [id]: result.version },
          });
          attempts.current.delete(id);
          if (
            JSON.stringify(attempt.body.draft) ===
            JSON.stringify(draftFromJob(current.current.jobs[id]))
          )
            dirty.current.delete(id);
        }
        setStatus(dirty.current.size ? 'Unsaved changes' : 'Saved');
      } catch (e) {
        if (e instanceof RequestError && e.status >= 400 && e.status < 500)
          attempts.current.delete(id);
        setStatus('Not saved');
        setError((e as Error).message);
        throw e;
      }
    })();
    running.current.set(id, task);
    try {
      await task;
    } finally {
      running.current.delete(id);
    }
  }
  const editJob = (id: string, fn: (j: Job) => Job) => {
    if (current.current.actor.role === 'crew') {
      setError(
        'Your role can add field updates and files. A project lead manages the scope.',
      );
      return;
    }
    const next = fn(current.current.jobs[id]);
    const shared = current.current.jobs[id].shared;
    update({
      ...current.current,
      jobs: {
        ...current.current.jobs,
        [id]: {
          ...next,
          shared,
          comments: current.current.jobs[id].comments,
          activity: current.current.jobs[id].activity,
          revision: shared ? shared.revision + 1 : 1,
        },
      },
    });
    dirty.current.add(id);
    setStatus('Unsaved changes');
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        void flush(id).catch(() => {});
      }, 600),
    );
  };
  const refreshProject = async (id: string) => {
    await flush(id);
    const baseline = current.current.versions[id];
    const record = await api<Awaited<ReturnType<BuildService['record']>>>(
      `/projects/${id}`,
    );
    if (current.current.versions[id] !== baseline) return;
    const local = dirty.current.has(id) || running.current.has(id);
    update({
      ...current.current,
      jobs: {
        ...current.current.jobs,
        [id]: local
          ? {
              ...current.current.jobs[id],
              shared: record.job.shared,
              comments: record.job.comments,
              activity: record.job.activity,
            }
          : record.job,
      },
      versions: {
        ...current.current.versions,
        [id]: local ? baseline : record.version,
      },
      shares: { ...current.current.shares, [id]: record.sharePath },
    });
  };
  const flushAll = async () => {
    for (const id of dirty.current) await flush(id);
  };
  const reload = async () => {
    for (const t of timers.current.values()) clearTimeout(t);
    await Promise.allSettled(running.current.values());
    const saved = await api<WorkspaceData>('/workspace');
    dirty.current.clear();
    attempts.current.clear();
    update(saved);
    setError('');
    setStatus('Saved');
  };
  const create = async (input: unknown) => {
    await flushAll();
    const result = await api<{ id: string }>('/projects', {
      method: 'POST',
      body: input,
    });
    update(await api<WorkspaceData>('/workspace'));
    return result.id;
  };
  useEffect(() => {
    const pendingTimers = timers.current;
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current.size) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('beforeunload', unload);
      for (const t of pendingTimers.values()) clearTimeout(t);
    };
  }, []);
  return {
    ...data,
    status,
    error,
    editJob,
    flush,
    flushAll,
    refreshProject,
    reload,
    create,
    getVersion: (id: string) => current.current.versions[id],
  };
}
