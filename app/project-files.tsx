'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from './build-client';

export default function ProjectFiles({
  projectId,
  attachments,
  onChange,
  canEdit = true,
}: {
  projectId: string;
  attachments: string[];
  onChange: (ids: string[]) => void;
  canEdit?: boolean;
}) {
  const [files, setFiles] = useState<
      { id: string; name: string; mime: string; size: number }[]
    >([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(
    () =>
      api<{ id: string; name: string; mime: string; size: number }[]>(
        `/projects/${projectId}/files`,
      )
        .then(setFiles)
        .catch((e) => setError(e.message)),
    [projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="build-scope-files">
      <div className="build-manual-toolbar">
        <strong>Project files</strong>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={15} /> Add file
        </Button>
      </div>
      <p className="build-help">
        Select the files to include in the next published proposal.
      </p>
      <input
        type="file"
        hidden
        ref={input}
        accept="image/png,image/jpeg,image/webp,application/pdf,audio/ogg"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          setError('');
          try {
            if (f.size > 10485760)
              throw new Error('Files must be 10 MB or smaller.');
            const response = await fetch(
              `/api/build/projects/${projectId}/files`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': f.type,
                  'X-File-Name': encodeURIComponent(f.name),
                },
                body: f,
              },
            );
            const r = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(r.error);
            await load();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {files.map((f) => (
        <div className="build-team-member" key={f.id}>
          <a href={`/api/build/files/${f.id}`} target="_blank" rel="noreferrer">
            {f.name}
          </a>
          <label>
            <Checkbox
              disabled={!canEdit}
              aria-label={`Include ${f.name} in proposal`}
              checked={attachments.includes(f.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...attachments, f.id]
                    : attachments.filter((id) => id !== f.id),
                )
              }
            />{' '}
            Include in proposal
          </label>
        </div>
      ))}
      {error && (
        <p className="build-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
