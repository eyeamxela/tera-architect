'use client';
import { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import WorkspaceShell from './workspace-shell';
import SiteCheck from './site-check';
import BuildSettings from './build-settings';
import { feetPerPixel, type SiteAssessment } from './site-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ProjectList } from './views';
import { TemplateSelect, emptyArchitectDraft } from './design-workbench';
import type { useWorkspace } from './use-workspace';

export default function WorkspaceDashboard({
  workspace,
  embedded = false,
  mode,
  view,
  projectId,
  onNavigate,
  onOpen,
  onLogout,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  embedded?: boolean;
  mode: string;
  view: string;
  projectId?: string;
  onNavigate: (view: string) => void;
  onOpen: (id: string, view?: string) => void;
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
  const startSite = async (site: SiteAssessment) => {
    setBusy(true);
    setError('');
    try {
      const id = await workspace.create({
        name: site.parcel.situs || 'Parcel ' + site.parcel.apn,
        client: 'Client to be assigned',
        location: site.jurisdiction,
        acres: site.parcel.acres || 0,
        template: 'landscape',
        draft: {
          ...emptyArchitectDraft('land'),
          site,
          scale: feetPerPixel(site.bounds),
          image: site.hillshadeUrl,
        },
      });
      onOpen(id, 'workspace');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const content = (
    <>
      {error && !creating && (
        <p className="tera-dashboard-error" role="alert">
          {error}
        </p>
      )}
      <TabsContent value="projects" className="tab-panel">
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
      </TabsContent>
      {!embedded && (
        <>
          <TabsContent value="site" className="tab-panel">
            <SiteCheck onStart={(site) => void startSite(site)} />
          </TabsContent>
          {workspace.actor.role === 'owner' && (
            <TabsContent value="settings" className="tab-panel">
              <BuildSettings
                workspace={workspace}
                projectId={projectId || ''}
                onSaved={() =>
                  void workspace.reload().catch((e) => setError(e.message))
                }
              />
            </TabsContent>
          )}
          {['planning', 'workspace', 'scope', 'client'].map((tab) => (
            <TabsContent value={tab} className="tab-panel" key={tab}>
              <div className="empty-state tera-project-required">
                <Layers size={28} />
                <h2>Select a project to continue.</h2>
                <p>
                  Each project has its own plan, scope, files, and client
                  portal.
                </p>
                <Button
                  variant="outline"
                  onClick={() => onNavigate('projects')}
                >
                  Open dashboard
                </Button>
                {canCreate && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus size={15} /> New project
                  </Button>
                )}
              </div>
            </TabsContent>
          ))}
        </>
      )}
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
    </>
  );
  return embedded ? (
    content
  ) : (
    <WorkspaceShell
      workspace={workspace}
      mode={mode}
      view={view}
      projectId={projectId}
      onView={onNavigate}
      onInbox={() => onNavigate('intake')}
      onLogout={onLogout}
    >
      {content}
    </WorkspaceShell>
  );
}
