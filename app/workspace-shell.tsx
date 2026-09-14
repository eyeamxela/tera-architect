'use client';
import { useState, type ReactNode } from 'react';
import {
  Sprout,
  Send,
  Users,
  MapPin,
  Map,
  FileText,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandProvider } from './brand';
import { scopeRows } from './data';
import { definitions } from './design-model';
import type { useWorkspace } from './use-workspace';

export default function WorkspaceShell({
  workspace,
  mode,
  view,
  projectId,
  onView,
  onInbox,
  onLogout,
  children,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  mode: string;
  view: string;
  projectId?: string;
  onView: (view: string) => void;
  onInbox: () => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { brand } = workspace;
  const project = workspace.projects.find((p) => p.id === projectId);
  const job = projectId ? workspace.jobs[projectId] : undefined;
  const count = job
    ? scopeRows(
        job.features,
        job.scale,
        job.spacing,
        job.items,
        job.designScope,
      ).length
    : 0;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
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
          <button
            className="brand brand-button"
            onClick={() => onView('projects')}
            aria-label="TERA dashboard"
          >
            <div className="brandmark">
              <Sprout size={28} />
            </div>
            <div>
              <strong>{brand.name}</strong>
              <span>{brand.descriptor}</span>
            </div>
          </button>
          <div className="workspace-name">
            {brand.studio}
            <span className="studio-divider" />
            {brand.lead}
          </div>
          <div className="topbar-right">
            <button
              className="field-inbox-button"
              aria-label="Open field inbox"
              disabled={!job}
              title={
                job ? 'Field inbox' : 'Select a project to add a field note'
              }
              onClick={onInbox}
            >
              <Send size={15} />
              <span>Field inbox</span>
            </button>
            <span className="demo-badge">
              <i />
              {mode === 'local' ? 'LOCAL WORKSPACE' : 'WORKSPACE'}
            </span>
            <button
              className="avatar"
              title="Sign out"
              aria-label="Sign out"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await workspace.flushAll();
                  await onLogout();
                })
              }
            >
              {workspace.actor.name[0]}
            </button>
          </div>
        </header>
        <div
          className="build-savebar"
          data-error={!!workspace.error || !!error}
        >
          <div>
            <span>{workspace.status}</span>
            <span>
              {mode === 'local' ? 'Local database' : 'Workspace database'}
            </span>
            <span>
              {workspace.actor.name} · {workspace.actor.role}
            </span>
          </div>
          <div>
            {(workspace.error || error) && (
              <>
                <span role="alert">{workspace.error || error}</span>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run(workspace.flushAll)}
                >
                  Retry save
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run(workspace.reload)}
                >
                  Reload saved copy
                </Button>
              </>
            )}
            {projectId && workspace.shares[projectId] && (
              <a
                href={workspace.shares[projectId]!}
                target="_blank"
                rel="noreferrer"
              >
                Open client link ↗
              </a>
            )}
          </div>
        </div>
        <Tabs
          value={view}
          onValueChange={(v) => onView(String(v))}
          className="app-tabs"
        >
          <div className="nav-row">
            <label className="mobile-navigation">
              <span>WORKSPACE</span>
              <select
                aria-label="Workspace section"
                value={view}
                onChange={(e) => onView(e.target.value)}
              >
                <option value="projects">Dashboard</option>
                <option value="site">Site check</option>
                <option value="planning">Plan & investment</option>
                <option value="workspace">Site & plans</option>
                <option value="scope">Scope of work</option>
                {workspace.actor.role === 'owner' && (
                  <option value="settings">Team & setup</option>
                )}
                <option value="client">Client portal</option>
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </label>
            <TabsList className="main-tabs">
              <TabsTrigger value="projects">
                <Users size={16} /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="site">
                <MapPin size={16} /> Site check
              </TabsTrigger>
              <TabsTrigger value="planning">
                <Sprout size={16} /> Plan & investment
              </TabsTrigger>
              <TabsTrigger value="workspace">
                <Map size={16} /> Site & plans
              </TabsTrigger>
              <TabsTrigger value="scope">
                <FileText size={16} /> Scope of work{' '}
                <span className="tab-count">{count}</span>
              </TabsTrigger>
              {workspace.actor.role === 'owner' && (
                <TabsTrigger value="settings">
                  <Users size={16} /> Team & setup
                </TabsTrigger>
              )}
              <TabsTrigger value="client">
                <ArrowUpRight size={16} /> Client portal
              </TabsTrigger>
            </TabsList>
            <span className="nav-meta">
              {job?.designScope
                ? job.designScope.enabled
                    .map((id) => definitions[id].short)
                    .join(' / ')
                : 'PROJECT WORKSPACE'}
            </span>
          </div>
          {children}
        </Tabs>
        <footer className="app-footer">
          <span>
            <i />
            {view === 'projects' || !project
              ? brand.studio.toUpperCase()
              : `${project.name.toUpperCase()} · ${project.id}`}
          </span>
          <span>Planning → Scope → Client review → Fieldwork</span>
          <span>TERA ARCHITECT · PROJECT ESTIMATES</span>
        </footer>
      </div>
    </BrandProvider>
  );
}
