'use client';
import { useState } from 'react';
import ManualScopeItems from './manual-scope-items';
import type { ManualScopeItem } from './data';
import { useBrand } from './brand';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock3,
  FileText,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sprout,
  Users,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Feature, Job, Project, money, scopeRows } from './data';

export function ProjectList({
  projects,
  jobs,
  onOpen,
  onNew,
}: {
  projects: Project[];
  jobs: Record<string, Job>;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('All stages');
  const filtered = projects.filter(
    (p) =>
      (p.name + ' ' + p.client + ' ' + p.location)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (stage === 'All stages' || p.stage === stage),
  );
  return (
    <section className="projects-view">
      <div className="view-heading">
        <div>
          <div className="eyebrow">YOUR PRACTICE, IN VIEW</div>
          <h1>Clients & projects</h1>
          <p>Every project. Every next step.</p>
        </div>
        <Button className="primary-action" onClick={onNew}>
          <Plus size={16} /> New project
        </Button>
      </div>
      <div className="project-stats">
        <div>
          <span>Active projects</span>
          <b>{projects.length.toString().padStart(2, '0')}</b>
        </div>
        <div>
          <span>Acres under planning</span>
          <b>{projects.reduce((s, p) => s + p.acres, 0).toFixed(1)}</b>
        </div>
        <div>
          <span>Awaiting client review</span>
          <b>
            {projects
              .filter((p) => jobs[p.id]?.shared?.status === 'Awaiting review')
              .length.toString()
              .padStart(2, '0')}
          </b>
        </div>
        <div>
          <span>Draft scope value</span>
          <b>
            {money(
              Object.values(jobs).reduce(
                (s, j) =>
                  s +
                  scopeRows(j.features, j.scale, j.spacing, j.items).reduce(
                    (a, r) => a + r.total,
                    0,
                  ),
                0,
              ),
            )}
          </b>
        </div>
      </div>
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties or clients…"
          />
        </div>
        <Select value={stage} onValueChange={(v) => setStage(String(v))}>
          <SelectTrigger aria-label="Filter by project stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              'All stages',
              'Planning',
              'Scoping',
              'Client review',
              'Fieldwork',
            ].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>{filtered.length} projects</span>
      </div>
      <div className="project-table">
        <Table className="desktop-project-table">
          <TableHeader>
            <TableRow>
              <TableHead>PROJECT / CLIENT</TableHead>
              <TableHead>LOCATION</TableHead>
              <TableHead>STAGE</TableHead>
              <TableHead>SCOPE VALUE</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <button className="project-link" onClick={() => onOpen(p.id)}>
                    <span className="project-thumb">
                      <img src="/property-aerial.png" alt="" />
                      <span>{p.initials}</span>
                    </span>
                    <span>
                      <b>{p.name}</b>
                      <small>{p.client}</small>
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <span className="location-cell">
                    {p.location}
                    <small>
                      {p.template !== 'general' ? `${p.acres} acres · ` : ''}
                      {p.id}
                    </small>
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`status ${p.stage === 'Fieldwork' ? 'mint' : 'amber'}`}
                  >
                    {p.stage}
                  </span>
                </TableCell>
                <TableCell className="money-cell">
                  {money(
                    scopeRows(
                      jobs[p.id]?.features || [],
                      jobs[p.id]?.scale || 0,
                      jobs[p.id]?.spacing || 25,
                      jobs[p.id]?.items || [],
                    ).reduce((s, r) => s + r.total, 0),
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    onClick={() => onOpen(p.id)}
                    aria-label={`Open ${p.name}`}
                  >
                    <ArrowUpRight size={18} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mobile-project-list">
          {filtered.map((p) => (
            <button
              key={p.id}
              className="mobile-project-card"
              onClick={() => onOpen(p.id)}
              aria-label={`Open ${p.name}`}
            >
              <span
                className={`status ${p.stage === 'Fieldwork' ? 'mint' : 'amber'}`}
              >
                {p.stage}
              </span>
              <strong>{p.name}</strong>
              <span className="mobile-project-client">{p.client}</span>
              <span className="mobile-project-location">
                <MapPin size={14} /> {p.location}
              </span>
              <span className="mobile-project-meta">
                {p.template !== 'general' ? `${p.acres} acres · ` : ''}
                {p.id}
              </span>
              <span className="mobile-project-bottom">
                <span>
                  <small>SCOPE VALUE</small>
                  <b>
                    {money(
                      scopeRows(
                        jobs[p.id]?.features || [],
                        jobs[p.id]?.scale || 0,
                        jobs[p.id]?.spacing || 25,
                        jobs[p.id]?.items || [],
                      ).reduce((sum, row) => sum + row.total, 0),
                    )}
                  </b>
                </span>
                <span className="mobile-project-open">
                  Open project <ArrowUpRight size={18} />
                </span>
              </span>
            </button>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search />
            <h3>No matching projects</h3>
            <p>Try a different property name or clear the stage filter.</p>
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setStage('All stages');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
      <div className="practice-note">
        <span>
          <i /> PROJECT WORKSPACE
        </span>
        <p>
          Explore a project, mark up the property, and prepare a scope for the
          client.
        </p>
      </div>
    </section>
  );
}

export function ScopeView({
  job,
  project,
  onUpdate,
  onShare,
  onMap,
  onItemsChange,
}: {
  job: Job;
  project: Project;
  onUpdate: (id: string, patch: Partial<Feature>) => void;
  onShare: () => void;
  onMap: () => void;
  onItemsChange: (items: ManualScopeItem[]) => void;
}) {
  const brand = useBrand();
  const rows = scopeRows(job.features, job.scale, job.spacing, job.items);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const draft = job.shared?.revision !== job.revision;
  return (
    <section className="scope-layout">
      <div className="scope-document">
        <div className="document-masthead">
          <span className="eyebrow">{brand.studio}</span>
          <span>
            PROPOSAL · {project.id} / {String(job.revision).padStart(2, '0')}
          </span>
        </div>
        <div className="document-title">
          <div>
            <h1>Scope of work</h1>
            <p>
              {project.name} <span>Prepared for {project.client}</span>
            </p>
          </div>
          <span className={`status ${draft ? 'amber' : 'mint'}`}>
            {draft ? 'Draft revision' : 'Shared for review'}
          </span>
        </div>
        <div className="document-context">
          <div>
            <span>PROJECT</span>
            <b>
              {project.template === 'general'
                ? 'Project scope'
                : 'Landscape & land'}
            </b>
          </div>
          <div>
            <span>PREPARED</span>
            <b>Draft for review</b>
          </div>
          <div>
            <span>ESTIMATE BASIS</span>
            <b>Desktop planning quantities</b>
          </div>
        </div>
        <div className="document-section-label">
          <span>01</span> Proposed improvements
        </div>
        <p className="document-intro">
          A coordinated scope with clear deliverables, quantities, and
          allowances. Select the work to include in this proposal.
        </p>
        <ManualScopeItems items={job.items || []} onChange={onItemsChange} />
        <div className="scope-items">
          {!!job.features.length && !job.scale && (
            <p className="scale-required-note">
              Set the image scale in the property workspace before calculating
              quantities.
            </p>
          )}
          {job.features.map((f, i) => {
            const row = scopeRows([f], job.scale, job.spacing)[0];
            return (
              <article
                key={f.id}
                className={`scope-item ${!f.included ? 'excluded' : ''}`}
              >
                <div className="scope-item-top">
                  <Checkbox
                    aria-label={`Include ${f.name}`}
                    checked={f.included}
                    onCheckedChange={(checked) =>
                      onUpdate(f.id, { included: checked })
                    }
                  />
                  <span className="item-number">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3>{f.name}</h3>
                  <span
                    className={`status ${f.kind === 'pond' ? 'blue' : 'mint'}`}
                  >
                    {f.kind === 'pond'
                      ? 'Restoration'
                      : f.kind === 'trees'
                        ? 'Planting'
                        : f.kind === 'path'
                          ? 'Access'
                          : 'Work area'}
                  </span>
                </div>
                <Textarea
                  aria-label={`${f.name} scope description`}
                  value={f.description}
                  onChange={(e) =>
                    onUpdate(f.id, { description: e.target.value })
                  }
                  className="scope-description"
                />
                <div className="scope-pricing">
                  <span>
                    <small>QUANTITY</small>
                    <b>
                      {job.scale ? (row?.quantity ?? '—') : '—'}{' '}
                      <em>{row?.unit || 'excluded'}</em>
                    </b>
                  </span>
                  <label>
                    <small>UNIT RATE</small>
                    <span className="rate-field">
                      $
                      <Input
                        type="number"
                        aria-label={`${f.name} unit rate`}
                        min="0"
                        max="1000000"
                        step="0.5"
                        value={f.rate}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n >= 0 && n <= 1e6)
                            onUpdate(f.id, { rate: n });
                        }}
                      />
                    </span>
                  </label>
                  <span className="line-total">
                    <small>LINE TOTAL</small>
                    <b>{money(row?.total || 0)}</b>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
        {!job.features.length && !job.items?.length && (
          <div className="empty-state">
            <FileText />
            <h3>Define the first work package</h3>
            <p>
              Add a work package above, or draw a work area to calculate
              quantities from a plan.
            </p>
            <Button onClick={onMap}>Open property workspace</Button>
          </div>
        )}
        <div className="document-section-label">
          <span>02</span> Assumptions & exclusions
        </div>
        <ul className="assumptions">
          <li>
            Confirm deliverables, quantities, rates, and exclusions before
            publishing.
          </li>
          <li>
            Taxes, permits, and work not explicitly described require separate
            agreement.
          </li>
          <li>
            Dates and costs are planning allowances until confirmed by the
            project team.
          </li>
          {project.template === 'landscape' && (
            <li>
              Mapped dimensions and planting positions require field
              verification. Pond volumes and legal development rights are not
              established by this plan.
            </li>
          )}
        </ul>
        <div className="document-signoff">
          <span>
            Prepared with care.
            <br />
            <b>
              {brand.lead} · {brand.studio}
            </b>
          </span>
          <span>
            {project.id} · REV {String(job.revision).padStart(2, '0')}
          </span>
        </div>
      </div>
      <aside className="scope-summary">
        <div className="section-label">PROPOSAL SUMMARY</div>
        <div className="summary-value">
          <small>Full scope before contingency</small>
          <strong>{rows.length ? money(total) : '—'}</strong>
          <span>USD · entered rates</span>
        </div>
        <div className="summary-lines">
          {rows.map((r) => (
            <div key={r.id}>
              <span>{r.name}</span>
              <b>{money(r.total)}</b>
            </div>
          ))}
        </div>
        <div className="summary-total">
          <span>Subtotal</span>
          <b>{money(total)}</b>
        </div>
        <div className="scope-review-note">
          <CheckCheck size={18} />
          <p>Review your quantities and rates before sharing this revision.</p>
        </div>
        <Button
          className="primary-action wide"
          disabled={
            !rows.length || (job.features.some((f) => f.included) && !job.scale)
          }
          onClick={onShare}
        >
          <Send size={15} /> Review & share
        </Button>
        <Button
          variant="outline"
          className="wide secondary-action"
          onClick={() => window.print()}
        >
          <ArrowDownToLine size={15} /> Print / save PDF
        </Button>
        <small className="session-explainer">
          Publishing creates a fixed proposal revision at your client link.
          Draft changes remain private until you publish again.
        </small>
        <div className="detail-divider" />
        <div className="section-label">REVISION HISTORY</div>
        <div className="revision-item">
          <span className="timeline-dot" />
          <div>
            <b>Revision {String(job.revision).padStart(2, '0')}</b>
            <small>
              {draft ? 'Current working draft' : 'Current shared proposal'}
            </small>
          </div>
        </div>
        {job.shared && draft && (
          <div className="revision-item">
            <span className="timeline-dot muted" />
            <div>
              <b>Revision {String(job.shared.revision).padStart(2, '0')}</b>
              <small>{job.shared.status} · client copy</small>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}

export { default as ClientView } from './client-proposal';
