'use client';
import { useState } from 'react';
import { Sprout, LayoutDashboard, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { BrandProvider } from './brand';
import { ProjectList } from './views';
import { TemplateSelect, emptyArchitectDraft } from './design-workbench';
import type { useWorkspace } from './use-workspace';

export default function WorkspaceDashboard({
  workspace,
  mode,
  onOpen,
  onLogout,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  mode: string;
  onOpen: (id: string) => void;
  onLogout: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(''),
    [client, setClient] = useState('');
  const [template, setTemplate] = useState('architecture');
  const [location, setLocation] = useState(''),
    [acres, setAcres] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const canCreate = workspace.actor.role === 'owner';
  const { brand } = workspace;
  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      await workspace.flushAll();
      await onLogout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <BrandProvider value={brand}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brandmark">
              <Sprout size={28} />
            </div>
            <div>
              <strong>{brand.name}</strong>
              <span>{brand.descriptor}</span>
            </div>
          </div>
          <div className="workspace-name">
            {brand.studio}
            <span className="studio-divider" />
            {brand.lead}
          </div>
          <div className="topbar-right">
            <button
              className="avatar"
              title="Sign out"
              aria-label="Sign out"
              disabled={busy}
              onClick={() => void logout()}
            >
              {workspace.actor.name[0]}
            </button>
          </div>
        </header>
        <nav className="tera-dashboard-nav" aria-label="Workspace">
          <span aria-current="page">
            <LayoutDashboard size={16} /> Dashboard
          </span>
          <span>{brand.studio}</span>
        </nav>
        {error && !creating && (
          <p className="tera-dashboard-error" role="alert">
            {error}
          </p>
        )}
        <ProjectList
          projects={workspace.projects}
          jobs={workspace.jobs}
          onOpen={onOpen}
          onNew={() => {
            setError('');
            setCreating(true);
          }}
          canCreate={canCreate}
        />
        <footer className="app-footer">
          <span>{brand.studio}</span>
          <span>Land · Architecture · Interiors · Furniture</span>
          <span>{mode === 'local' ? 'LOCAL WORKSPACE' : 'WORKSPACE'}</span>
        </footer>
        <Dialog
          open={creating}
          onOpenChange={(open) => {
            if (!busy) setCreating(open);
          }}
        >
          <DialogContent className="ground-dialog">
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Choose a starting scope. You can combine disciplines inside the
                project.
              </DialogDescription>
            </DialogHeader>
            <form
              className="dialog-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!canCreate || busy) return;
                setBusy(true);
                setError('');
                try {
                  const id = await workspace.create({
                    name: name.trim(),
                    client: client.trim(),
                    location: location.trim(),
                    acres: Number(acres) || 0,
                    template:
                      template === 'land' || template === 'all'
                        ? 'landscape'
                        : 'general',
                    draft: emptyArchitectDraft(template),
                  });
                  setCreating(false);
                  onOpen(id);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Project name
                <Input
                  autoFocus
                  required
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Client name
                <Input
                  required
                  maxLength={200}
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </label>
              <TemplateSelect value={template} onChange={setTemplate} />
              <div className="form-pair">
                <label>
                  Location
                  <Input
                    maxLength={500}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City or property address"
                  />
                </label>
                <label>
                  Land area, if applicable (acres)
                  <Input
                    type="number"
                    min="0"
                    max="1000000"
                    step="any"
                    value={acres}
                    onChange={(e) => setAcres(e.target.value)}
                  />
                </label>
              </div>
              {error && (
                <p role="alert" className="build-error">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="primary-action wide"
                disabled={busy || !name.trim() || !client.trim()}
              >
                <Plus size={15} /> {busy ? 'Creating…' : 'Create project'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </BrandProvider>
  );
}
