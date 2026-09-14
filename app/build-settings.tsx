'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, type WorkspaceData } from './build-client';

type TeamMember = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  active: boolean;
};
type Inbox = {
  telegramConfigured: boolean;
  items: {
    id: string;
    display_name: string;
    project_id: string;
    status: string;
    delivery_status: string | null;
  }[];
};

export default function BuildSettings({
  workspace,
  projectId,
  onSaved,
}: {
  workspace: WorkspaceData;
  projectId: string;
  onSaved: () => void;
}) {
  const hasProject = workspace.projects.some((p) => p.id === projectId);
  const [brand, setBrand] = useState(workspace.brand),
    [team, setTeam] = useState<TeamMember[]>([]),
    [inbox, setInbox] = useState<Inbox | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [teamName, setTeamName] = useState(''),
    [teamEmail, setTeamEmail] = useState(''),
    [teamRole, setTeamRole] = useState('crew');
  const [member, setMember] = useState(''),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [senderId, setSenderId] = useState(''),
    [chatId, setChatId] = useState(''),
    [threadId, setThreadId] = useState('');
  useEffect(() => {
    Promise.all([api<TeamMember[]>('/team'), api<Inbox>('/inbox')])
      .then(([t, i]) => {
        setTeam(t);
        setMember(t[0]?.id || '');
        setInbox(i);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="build-settings">
      <article>
        <h2>Your workspace</h2>
        <p>
          Branding applies to new proposals. Published revisions retain their
          original presentation.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api('/settings/brand', { method: 'PUT', body: brand });
              onSaved();
            }, 'Workspace details saved.');
          }}
        >
          <label htmlFor="build-settings-field-1">
            Business name
            <Input
              id="build-settings-field-1"
              value={brand.studio}
              onChange={(e) => setBrand({ ...brand, studio: e.target.value })}
              required
            />
          </label>
          <label htmlFor="build-settings-field-2">
            Prepared by
            <Input
              id="build-settings-field-2"
              value={brand.lead}
              onChange={(e) => setBrand({ ...brand, lead: e.target.value })}
              required
            />
          </label>
          <label htmlFor="build-settings-field-3">
            Descriptor
            <Input
              id="build-settings-field-3"
              value={brand.descriptor}
              onChange={(e) =>
                setBrand({ ...brand, descriptor: e.target.value })
              }
              required
            />
          </label>
          <Button disabled={busy}>Save details</Button>
        </form>
      </article>
      <article>
        <h2>Project team</h2>
        <p>
          {hasProject
            ? `Assign team members to ${workspace.projects.find((p) => p.id === projectId)?.name}.`
            : 'Add your team now. Assign members after creating a project.'}
        </p>
        {team.map((m) => (
          <div key={m.id} className="build-team-member">
            <span>
              {m.display_name}
              <small> · {m.email}</small>
            </span>
            <span>
              {m.role}
              {!m.active ? ' · inactive' : ''}
              {m.role !== 'owner' && m.active && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`/team/${m.id}`, { method: 'DELETE' });
                      setTeam(await api<TeamMember[]>('/team'));
                    }, 'Team access removed.')
                  }
                >
                  Remove access
                </Button>
              )}
            </span>
          </div>
        ))}
        {hasProject && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api(`/projects/${projectId}/assign`, {
                    method: 'POST',
                    body: { userId: member },
                  }),
                'Team member assigned.',
              );
            }}
          >
            <label>
              Team member
              <select
                value={member}
                onChange={(e) => setMember(e.target.value)}
              >
                {team
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name} · {m.role}
                    </option>
                  ))}
              </select>
            </label>
            <Button disabled={busy || !member}>Assign to project</Button>
          </form>
        )}
      </article>
      <article>
        <h2>Add a team member</h2>
        <p>
          Grant access by email, then assign projects. This does not send an
          invitation.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api('/team', {
                method: 'POST',
                body: { name: teamName, email: teamEmail, role: teamRole },
              });
              setTeam(await api<TeamMember[]>('/team'));
              setTeamName('');
              setTeamEmail('');
            }, 'Team member added. Assign them to a project above.');
          }}
        >
          <label htmlFor="build-settings-field-4">
            Name
            <Input
              id="build-settings-field-4"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </label>
          <label htmlFor="build-settings-field-5">
            Email
            <Input
              id="build-settings-field-5"
              required
              type="email"
              value={teamEmail}
              onChange={(e) => setTeamEmail(e.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={teamRole}
              onChange={(e) => setTeamRole(e.target.value)}
            >
              <option value="crew">Crew · field updates and files</option>
              <option value="lead">
                Project lead · drafts and client updates
              </option>
            </select>
          </label>
          <Button disabled={busy}>Add team member</Button>
        </form>
      </article>
      <article>
        <h2>Client access</h2>
        <p>
          Allow this client to comment and approve the current project after
          verifying their email. No invitation message is sent here.
        </p>
        {hasProject && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api(`/projects/${projectId}/invite`, {
                    method: 'POST',
                    body: { name, email },
                  }),
                'Client access granted. Share the project link when ready.',
              );
            }}
          >
            <label htmlFor="build-settings-field-6">
              Client name
              <Input
                id="build-settings-field-6"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label htmlFor="build-settings-field-7">
              Client email
              <Input
                id="build-settings-field-7"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <Button disabled={busy}>Grant client access</Button>
          </form>
        )}
        <Button
          variant="ghost"
          disabled={busy || !hasProject}
          onClick={() =>
            void run(async () => {
              if (!hasProject) return;
              await api(`/projects/${projectId}/revoke`, { method: 'POST' });
              onSaved();
            }, 'Old share links revoked. Publish again to create a new link.')
          }
        >
          Revoke this project’s share link
        </Button>
      </article>
      <article>
        <h2>Telegram field inbox</h2>
        <p>
          {inbox?.telegramConfigured
            ? 'Bot credentials are configured. Verify webhook delivery before field use.'
            : 'Telegram is not connected. The receiver and worker can be tested locally.'}
        </p>
        {hasProject && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api('/integrations/telegram', {
                    method: 'POST',
                    body: {
                      userId: member,
                      projectId,
                      senderId,
                      chatId,
                      threadId,
                    },
                  }),
                'Telegram identity and project route saved.',
              );
            }}
          >
            <label htmlFor="build-settings-field-8">
              Telegram sender ID
              <Input
                id="build-settings-field-8"
                required
                inputMode="numeric"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
              />
            </label>
            <label htmlFor="build-settings-field-9">
              Chat ID
              <Input
                id="build-settings-field-9"
                required
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              />
            </label>
            <label htmlFor="build-settings-field-10">
              Topic ID, if used
              <Input
                id="build-settings-field-10"
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
              />
            </label>
            <p>
              Links the team member selected above to this project. Membership
              is checked for every action.
            </p>
            <Button disabled={busy}>Save Telegram route</Button>
          </form>
        )}
        {inbox?.items?.map((i) => (
          <div className="build-team-member" key={i.id}>
            <span>
              {i.display_name} · {i.project_id || 'Project needed'}
            </span>
            <span>
              {i.status}
              {i.delivery_status ? ` / ${i.delivery_status}` : ''}
            </span>
          </div>
        ))}
      </article>
      {message && <output>{message}</output>}
    </section>
  );
}
