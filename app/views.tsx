'use client';
import { useState } from 'react';
import { calculatePlan } from './plan-model';
import { ClientInvestment } from './plan-presentation';
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
import LandMap from './land-map';
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
          <p>Every property. Every next step.</p>
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
                  scopeRows(j.features, j.scale, j.spacing).reduce(
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PROPERTY / CLIENT</TableHead>
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
                      {p.acres} acres · {p.id}
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
          <i /> SAMPLE PRACTICE
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
}: {
  job: Job;
  project: Project;
  onUpdate: (id: string, patch: Partial<Feature>) => void;
  onShare: () => void;
  onMap: () => void;
}) {
  const rows = scopeRows(job.features, job.scale, job.spacing);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const draft = job.shared?.revision !== job.revision;
  return (
    <section className="scope-layout">
      <div className="scope-document">
        <div className="document-masthead">
          <span className="eyebrow">OJAI PERMACULTURE</span>
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
            <b>Land restoration & planting</b>
          </div>
          <div>
            <span>PREPARED</span>
            <b>September 11, 2026</b>
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
          A coordinated plan to improve water edges, establish productive
          planting, and make the property easier to access.
        </p>
        <div className="scope-items">
          {!job.scale && (
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
        {!job.features.length && (
          <div className="empty-state">
            <FileText />
            <h3>Your scope starts on the map</h3>
            <p>
              Draw a work area and confirm the scale to calculate quantities.
            </p>
            <Button onClick={onMap}>Open property workspace</Button>
          </div>
        )}
        <div className="document-section-label">
          <span>02</span> Assumptions & exclusions
        </div>
        <ul className="assumptions">
          <li>
            Measurements are preliminary plan estimates and require a site
            check.
          </li>
          <li>
            Pond depth, excavation volumes, permits, and soil conditions are not
            included.
          </li>
          <li>
            Planting quantities use the selected spacing; final positions
            require field confirmation.
          </li>
          <li>
            Rates are sample values for this UI demo. Tax and final scheduling
            are not included.
          </li>
        </ul>
        <div className="document-signoff">
          <span>
            Prepared with care.
            <br />
            <b>Connor · Ojai Permaculture</b>
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
          <strong>{job.scale ? money(total) : '—'}</strong>
          <span>USD · sample rates</span>
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
          disabled={!rows.length || !job.scale}
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
          Sharing updates the demo client portal for this session. Nothing is
          sent externally.
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

export function ClientView({
  job,
  project,
  onApprove,
  onRequest,
  onComment,
  onUpdate,
  onScope,
}: {
  job: Job;
  project: Project;
  onApprove: () => void;
  onRequest: () => void;
  onComment: (text: string) => void;
  onUpdate: (text: string) => void;
  onScope: () => void;
}) {
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState('pond');
  const shared = job.shared;
  const plan = shared
    ? calculatePlan(shared.rows, shared.features, shared.planning)
    : null;
  const sendComment = () => {
    if (comment.trim()) {
      onComment(comment.trim());
      setComment('');
    }
  };
  return (
    <section className="client-view">
      <div className="client-preview-strip">
        <Users size={14} />
        <span>CLIENT PREVIEW</span>
        <span>
          This is what {project.client.split(' ')[0]} sees. Demo actions last
          for this session.
        </span>
        <Button variant="ghost" onClick={onScope}>
          Back to scope <ArrowRight size={14} />
        </Button>
      </div>
      <div className="client-heading">
        <div>
          <div className="eyebrow">OJAI PERMACULTURE / YOUR PROPERTY</div>
          <h1>{project.name}</h1>
          <p>A shared place for your plans, decisions, and progress.</p>
        </div>
        <div className="client-contact">
          <span className="avatar">C</span>
          <div>
            <b>Connor</b>
            <span>Your project lead</span>
          </div>
        </div>
      </div>
      {!shared ? (
        <div className="empty-state">
          <FileText />
          <h2>Your proposal is being prepared</h2>
          <p>
            The property plan and scope will appear here when the developer
            shares a revision.
          </p>
          <Button onClick={onScope}>Prepare a proposal</Button>
        </div>
      ) : (
        <>
          <div className="client-milestones">
            {[
              'Property review',
              'Proposal',
              'Client approval',
              'Fieldwork',
            ].map((s, i) => (
              <div
                key={s}
                className={
                  i < (shared.status === 'Approved' ? 3 : 2)
                    ? 'complete'
                    : i === (shared.status === 'Approved' ? 3 : 2)
                      ? 'current'
                      : ''
                }
              >
                <span>
                  {i < (shared.status === 'Approved' ? 3 : 2) ? (
                    <Check size={13} />
                  ) : (
                    i + 1
                  )}
                </span>
                <b>{s}</b>
                {i < 3 && <i />}
              </div>
            ))}
          </div>
          <div className="client-grid">
            <div className="client-plan">
              <div className="client-section-heading">
                <h2>Your funded work areas</h2>
                <span>REVISION {String(shared.revision).padStart(2, '0')}</span>
              </div>
              <LandMap
                features={shared.features.filter((f) =>
                  plan?.funded.some((p) => p.id === f.id),
                )}
                selected={selected}
                onSelect={setSelected}
                boundary={true}
                planting={true}
                scale={shared.scale}
                spacing={shared.spacing}
                image={shared.image}
                imageHeight={shared.imageHeight}
                interactive={false}
                revision={shared.revision}
              />
              <div className="client-map-legend">
                <span>
                  <i className="blue-dot" /> Pond restoration
                </span>
                <span>
                  <i className="gold-dot" /> Orchard planting
                </span>
                <span>
                  <i /> Access improvements
                </span>
              </div>
            </div>
            <aside className="client-decision">
              <span
                className={`status ${shared.status === 'Approved' ? 'mint' : 'amber'}`}
              >
                {shared.status}
              </span>
              <h2>
                {shared.status === 'Approved'
                  ? 'Your plan is approved.'
                  : shared.status === 'Changes requested'
                    ? 'We’ll refine the plan.'
                    : 'Your next chapter starts here.'}
              </h2>
              <p>
                {shared.status === 'Approved'
                  ? 'Your approval is recorded against this revision. Your project lead will confirm the next steps.'
                  : shared.status === 'Changes requested'
                    ? 'Your project lead can see your request. Add any details in the conversation below.'
                    : 'Review the proposed improvements and let us know what you think.'}
              </p>
              <div className="client-cost">
                <span>Funded installation + contingency</span>
                <strong>{money(plan!.allowance)}</strong>
                <small>Sample estimate · Revision {shared.revision}</small>
              </div>
              {plan!.funded.map((r) => (
                <div className="client-scope-row" key={r.id}>
                  <Check size={14} />
                  <span>
                    {r.name}
                    <small>
                      {r.quantity.toLocaleString()} {r.unit}
                    </small>
                  </span>
                  <b>{money(r.allowance)}</b>
                </div>
              ))}
              <Button
                className="primary-action wide"
                onClick={onApprove}
                disabled={shared.status === 'Approved'}
              >
                <CheckCheck size={16} />
                {shared.status === 'Approved' ? 'Approved' : 'Approve proposal'}
              </Button>
              <Button
                variant="outline"
                className="wide secondary-action"
                onClick={onRequest}
                disabled={shared.status === 'Changes requested'}
              >
                <MessageSquare size={15} /> Request changes
              </Button>
              <Button
                variant="ghost"
                className="wide"
                onClick={() => window.print()}
              >
                <ArrowDownToLine size={15} /> Print proposal
              </Button>
            </aside>
          </div>
          <ClientInvestment shared={shared} project={project} />
          <div className="client-bottom-grid">
            <div className="conversation">
              <div className="client-section-heading">
                <h2>Project conversation</h2>
                <span>{job.comments.length} NOTES</span>
              </div>
              {job.comments.map((c, i) => (
                <div className="comment" key={i}>
                  <span className="avatar small">
                    {c.author
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div>
                    <b>
                      {c.author} <small>· Rev {c.revision}</small>
                    </b>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
              {!job.comments.length && (
                <p className="muted-copy">
                  Questions or ideas? Leave a note for your project lead.
                </p>
              )}
              <form
                className="comment-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendComment();
                }}
              >
                <Textarea
                  aria-label="Client comment"
                  placeholder="Add a question or a note about your property…"
                  value={comment}
                  maxLength={2000}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  className="primary-action"
                  type="submit"
                  disabled={!comment.trim()}
                >
                  <Send size={14} /> Send note
                </Button>
              </form>
            </div>
            <div className="client-activity">
              <div className="client-section-heading">
                <h2>Project updates</h2>
                <Clock3 size={16} />
              </div>
              {job.activity.slice(0, 5).map((a, i) => (
                <div className="activity-entry" key={i}>
                  <span className="timeline-dot" />
                  <div>
                    <p>{a}</p>
                    <small>
                      {i === 0 ? 'Latest update' : 'Project history'}
                    </small>
                  </div>
                </div>
              ))}
              <div className="client-file">
                <FileText size={22} />
                <span>
                  <b>Property proposal</b>
                  <small>
                    Revision {shared.revision} · {shared.rows.length} work areas
                  </small>
                </span>
                <Button
                  variant="ghost"
                  aria-label="Print property proposal"
                  onClick={() => window.print()}
                >
                  <ArrowDownToLine size={17} />
                </Button>
              </div>
            </div>
          </div>
          <div className="client-print-details">
            <h2>Scope details</h2>
            {plan!.funded.map((r) => (
              <div key={r.id}>
                <h3>{r.name}</h3>
                <p>{r.description}</p>
                <p>
                  {r.quantity} {r.unit} × {money(r.rate)} = {money(r.total)}
                </p>
              </div>
            ))}
            <p>
              Desktop planning estimates. Site verification required. Sample
              prices; tax, permits, depth, and excavation volumes excluded.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
