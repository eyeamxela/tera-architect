'use client';
import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  Layers3,
  Map,
  FileText,
  Users,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  MapPin,
  Plus,
  Send,
  Sprout,
  Waves,
  Ruler,
  Check,
  CircleDot,
  Upload,
  MessageSquare,
  Clock3,
  X,
  ImagePlus,
  ArrowLeft,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import LandMap from './land-map';
import PlanningView from './planning-view';
import { calculatePlan } from './plan-model';
import { ProjectList, ScopeView, ClientView } from './views';
import {
  projects as sampleProjects,
  Feature,
  Job,
  Point,
  metrics,
  plantingPoints,
  makeJob,
  scopeRows,
  money,
  layoutFits,
  validPolygon,
} from './data';

type DialogMode =
  | 'new'
  | 'scale'
  | 'share'
  | 'draw'
  | 'intake'
  | 'update'
  | null;
function FeatureIcon({ kind, size = 17 }: { kind: string; size?: number }) {
  return kind === 'pond' ? (
    <Waves size={size} />
  ) : kind === 'trees' ? (
    <Sprout size={size} />
  ) : (
    <Ruler size={size} />
  );
}

export default function Home() {
  const [view, setView] = useState('planning');
  const [projects, setProjects] = useState(sampleProjects);
  const [projectId, setProjectId] = useState('NC-024');
  const [jobs, setJobs] = useState<Record<string, Job>>(() =>
    Object.fromEntries(sampleProjects.map((p) => [p.id, makeJob()])),
  );
  const [selected, setSelected] = useState('pond');
  const [boundary, setBoundary] = useState(true);
  const [planting, setPlanting] = useState(true);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [notice, setNotice] = useState('');
  const [fieldNote, setFieldNote] = useState(
    'Restore the lower pond and extend the orchard east. Keep access clear for the planting crew.',
  );
  const [newName, setNewName] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAcres, setNewAcres] = useState('');
  const [calibration, setCalibration] = useState<Point[]>([]);
  const [distance, setDistance] = useState('100');
  const [scaleError, setScaleError] = useState('');
  const [drawn, setDrawn] = useState<Point[]>([]);
  const [featureName, setFeatureName] = useState('');
  const [featureKind, setFeatureKind] = useState<Feature['kind']>('area');
  const [updateText, setUpdateText] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRequest = useRef(0);
  const job = jobs[projectId];
  const project = projects.find((p) => p.id === projectId)!;
  const f = job.features.find((f) => f.id === selected) || job.features[0];
  const m = f ? metrics(f.points, job.scale, f.kind !== 'path') : null;
  const rows = scopeRows(job.features, job.scale, job.spacing);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const dirty = job.shared?.revision !== job.revision;
  const investment = calculatePlan(rows, job.features, job.planning);
  const notify = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4500);
  };
  const patchJob = (fn: (j: Job) => Job, id = projectId) =>
    setJobs((all) => ({ ...all, [id]: fn(all[id]) }));
  const edit = (fn: (j: Job) => Job) =>
    patchJob((j) => ({
      ...fn(j),
      revision: j.shared?.revision === j.revision ? j.revision + 1 : j.revision,
    }));
  const updateFeature = (id: string, patch: Partial<Feature>) =>
    edit((j) => ({
      ...j,
      features: j.features.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  const openProject = (id: string) => {
    fileRequest.current++;
    setProjectId(id);
    setSelected(jobs[id]?.features[0]?.id || '');
    setView('planning');
  };
  const approve = () => {
    patchJob((j) =>
      j.shared
        ? {
            ...j,
            shared: { ...j.shared, status: 'Approved' },
            activity: [
              `Client approved revision ${String(j.shared.revision).padStart(2, '0')}`,
              ...j.activity,
            ],
          }
        : j,
    );
    notify('Client approval recorded in this demo.');
  };
  const requestChanges = () => {
    patchJob((j) =>
      j.shared
        ? {
            ...j,
            shared: { ...j.shared, status: 'Changes requested' },
            activity: [
              `Client requested changes to revision ${j.shared.revision}`,
              ...j.activity,
            ],
          }
        : j,
    );
    notify('Change request recorded. Add the details in a note below.');
  };
  const share = () => {
    if (!job.scale || !rows.length) return;
    patchJob((j) => ({
      ...j,
      shared: {
        planning: { ...j.planning },
        revision: j.revision,
        features: structuredClone(j.features),
        rows: scopeRows(j.features, j.scale, j.spacing),
        scale: j.scale,
        spacing: j.spacing,
        image: j.image,
        imageHeight: j.imageHeight,
        total,
        status: 'Awaiting review',
      },
      activity: [
        `Scope revision ${String(j.revision).padStart(2, '0')} shared for review`,
        ...j.activity,
      ],
    }));
    setDialog(null);
    notify(`Revision ${job.revision} is available in the demo client portal.`);
  };
  const scaleModal = () => {
    setCalibration([]);
    setScaleError('');
    setDialog('scale');
  };
  const addComment = (text: string) => {
    patchJob((j) => ({
      ...j,
      comments: [
        ...j.comments,
        {
          author: project.client.split('&')[0].trim(),
          text,
          revision: j.shared?.revision || j.revision,
        },
      ],
    }));
    notify('Note added to the project conversation.');
  };
  const addUpdate = (text: string) =>
    patchJob((j) => ({ ...j, activity: [text, ...j.activity] }));
  const changeSpacing = (spacing: number) => {
    if (
      job.features.some(
        (f) => f.kind === 'trees' && !layoutFits(f.points, job.scale, spacing),
      )
    ) {
      notify(
        'This layout is too dense for the demo. Use wider spacing or a smaller area.',
      );
      return;
    }
    edit((j) => ({ ...j, spacing }));
  };
  const readRef = useRef({ project, job, view, total, edit, setView });
  readRef.current = { project, job, view, total, edit, setView };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            t: unknown,
            o: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'get_land_workspace',
        title: 'Read land workspace',
        description:
          'Read the current demo property, scope revision, measurements, and client review status. No external systems are connected.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: (input: unknown) => {
          if (!input || typeof input !== 'object' || Object.keys(input).length)
            throw Error('Expected an empty object.');
          const { project, job, view, total } = readRef.current;
          return {
            demo: true,
            property: project.name,
            view,
            revision: job.revision,
            scaleFeetPerPixel: job.scale,
            treeSpacingFeet: job.spacing,
            features: job.features.map((f) => ({
              id: f.id,
              name: f.name,
              measurements: job.scale
                ? metrics(f.points, job.scale, f.kind !== 'path')
                : null,
            })),
            total,
            planning: job.planning,
            investment: calculatePlan(
              scopeRows(job.features, job.scale, job.spacing),
              job.features,
              job.planning,
            ).years,
            sharedPlanning: job.shared?.planning,
            clientStatus: job.shared?.status || 'Not shared',
          };
        },
      },
      {
        name: 'set_demo_investment_plan',
        title: 'Set demo investment budget and timeline',
        description:
          'Set the visible draft installation budget and window. Recalculates funded work and five-year allowances. Does not alter the shared client copy or send messages.',
        inputSchema: {
          type: 'object',
          properties: {
            budget: { type: 'number', minimum: 0, maximum: 10000000 },
            months: { type: 'integer', minimum: 6, maximum: 60, multipleOf: 6 },
          },
          required: ['budget', 'months'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          const i = input as { budget: number; months: number };
          if (
            !i ||
            typeof i !== 'object' ||
            Object.keys(i).some((k) => !['budget', 'months'].includes(k)) ||
            !Number.isFinite(i.budget) ||
            i.budget < 0 ||
            i.budget > 1e7 ||
            !Number.isInteger(i.months) ||
            i.months < 6 ||
            i.months > 60 ||
            i.months % 6 !== 0
          )
            throw Error(
              'Provide budget 0–10000000 and months 6–60 in six-month increments.',
            );
          flushSync(() => {
            readRef.current.edit((j) => ({
              ...j,
              planning: { ...j.planning, budget: i.budget, months: i.months },
            }));
            readRef.current.setView('planning');
          });
          const j = readRef.current.job;
          const p = calculatePlan(
            scopeRows(j.features, j.scale, j.spacing),
            j.features,
            j.planning,
          );
          return {
            demo: true,
            revision: j.revision,
            planning: j.planning,
            funded: p.funded.map((f) => f.name),
            fiveYearAllowance: p.atYear(5).total,
          };
        },
      },
      {
        name: 'set_demo_tree_spacing',
        title: 'Set proposed tree spacing',
        description:
          'Update the visible demo planting layout and draft scope quantities. Does not share the draft or send a message.',
        inputSchema: {
          type: 'object',
          properties: { feet: { type: 'number', minimum: 10, maximum: 60 } },
          required: ['feet'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          const i = input as { feet?: number };
          if (
            !i ||
            typeof i !== 'object' ||
            Object.keys(i).some((k) => k !== 'feet') ||
            typeof i.feet !== 'number' ||
            !Number.isFinite(i.feet) ||
            i.feet < 10 ||
            i.feet > 60
          )
            throw Error('feet must be a number between 10 and 60.');
          if (
            readRef.current.job.features.some(
              (f) =>
                f.kind === 'trees' &&
                !layoutFits(f.points, readRef.current.job.scale, i.feet!),
            )
          )
            throw Error('Layout too dense. Use wider spacing.');
          flushSync(() =>
            readRef.current.edit((j) => ({ ...j, spacing: i.feet! })),
          );
          return {
            demo: true,
            spacingFeet: readRef.current.job.spacing,
            revision: readRef.current.job.revision,
          };
        },
      },
    ];
    for (const t of tools) {
      try {
        Promise.resolve(
          context.registerTool(t, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand brand-button"
          onClick={() => setView('projects')}
          aria-label="Ojai Permaculture projects"
        >
          <div className="brandmark">
            <Layers3 size={22} />
          </div>
          <div>
            <strong>OJAI</strong>
            <span>PERMACULTURE</span>
          </div>
        </button>
        <div className="workspace-name">
          Ojai Permaculture <span className="studio-divider" /> Workspace
        </div>
        <div className="topbar-right">
          <button
            className="field-inbox-button"
            onClick={() => setDialog('intake')}
          >
            <Send size={15} />
            <span>Field inbox</span>
            <b>1</b>
          </button>
          <span className="demo-badge">
            <i /> INTERACTIVE DEMO
          </span>
          <span className="avatar">C</span>
        </div>
      </header>
      <Tabs
        value={view}
        onValueChange={(v) => setView(String(v))}
        className="app-tabs"
      >
        <div className="nav-row">
          <TabsList className="main-tabs">
            <TabsTrigger value="projects">
              <Users size={16} /> Projects
            </TabsTrigger>
            <TabsTrigger value="planning">
              <Sprout size={16} /> Plan & investment
            </TabsTrigger>
            <TabsTrigger value="workspace">
              <Map size={16} /> Property workspace
            </TabsTrigger>
            <TabsTrigger value="scope">
              <FileText size={16} /> Scope of work{' '}
              <span className="tab-count">{rows.length}</span>
            </TabsTrigger>
            <TabsTrigger value="client">
              <ArrowUpRight size={16} /> Client portal
            </TabsTrigger>
          </TabsList>
          <span className="nav-meta">SAMPLE DATA · SESSION ONLY</span>
        </div>
        <TabsContent value="projects" className="tab-panel">
          <ProjectList
            projects={projects}
            jobs={jobs}
            onOpen={openProject}
            onNew={() => setDialog('new')}
          />
        </TabsContent>
        {view !== 'projects' && view !== 'client' && (
          <div className="project-heading">
            <div>
              <div className="breadcrumb">
                <button onClick={() => setView('projects')}>PROJECTS</button>
                <ChevronRight size={12} />
                <Select
                  value={projectId}
                  onValueChange={(v) => openProject(String(v))}
                >
                  <SelectTrigger
                    className="property-picker"
                    aria-label="Select property"
                  >
                    <SelectValue>{project.name}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="title-row">
                <h1>{project.name}</h1>
                <span className={`status ${dirty ? 'amber' : 'mint'}`}>
                  {dirty
                    ? 'Draft updates'
                    : job.shared?.status === 'Approved'
                      ? 'Client approved'
                      : job.shared
                        ? 'Ready for client review'
                        : 'Planning'}
                </span>
              </div>
              <p>
                <MapPin size={14} />
                {project.location}
                <span>·</span>
                {project.acres} acres<span>·</span>
                {project.client}
              </p>
            </div>
            <div className="heading-actions">
              <Button
                variant="outline"
                className="secondary-action"
                onClick={() => setDialog('update')}
              >
                <Plus size={14} /> Add update
              </Button>
              <Button
                className="primary-action"
                onClick={() => setView('client')}
              >
                <ArrowUpRight size={15} /> Preview client portal
              </Button>
            </div>
          </div>
        )}
        <TabsContent value="planning" className="tab-panel">
          <PlanningView
            job={job}
            project={project}
            onChange={(planning) => edit((j) => ({ ...j, planning }))}
            onMap={() => setView('workspace')}
            onShare={() => setDialog('share')}
          />
        </TabsContent>
        <TabsContent value="workspace" className="tab-panel">
          <div className="workspace-grid">
            <aside className="left-panel">
              <div className="section-label">
                PROJECT OVERVIEW <span>{project.id}</span>
              </div>
              <div className="overview-stat">
                <span>Planned improvements</span>
                <strong>
                  {String(job.features.length).padStart(2, '0')}{' '}
                  <small>work areas</small>
                </strong>
              </div>
              <div className="mini-stats">
                <div>
                  <span>Phase</span>
                  <b>{project.stage}</b>
                </div>
                <div>
                  <span>Next review</span>
                  <b>Sep 18</b>
                </div>
              </div>
              <div className="section-label spaced">
                MAP FEATURES{' '}
                <span>{String(job.features.length).padStart(2, '0')}</span>
              </div>
              {job.features.map((x, i) => (
                <button
                  key={x.id}
                  className={`feature-row ${f?.id === x.id ? 'selected' : ''}`}
                  onClick={() => setSelected(x.id)}
                >
                  <span
                    className={`feature-icon ${x.kind === 'pond' ? 'blue' : x.kind === 'trees' ? 'green' : 'gold'}`}
                  >
                    <FeatureIcon kind={x.kind} />
                  </span>
                  <span>
                    <b>{x.name}</b>
                    <small>{x.status}</small>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
              {!job.features.length && (
                <p className="muted-copy">
                  Use Draw area on the map to add the first work area.
                </p>
              )}
              <div className="section-label spaced">LAYERS</div>
              <label className="layer-row">
                <span>
                  <i className="legend mint" /> Property boundary
                </span>
                <Switch
                  checked={boundary}
                  onCheckedChange={setBoundary}
                  aria-label="Property boundary"
                  disabled={job.image !== '/property-aerial.png'}
                />
              </label>
              <label className="layer-row">
                <span>
                  <i className="legend gold" /> Proposed planting
                </span>
                <Switch
                  checked={planting}
                  onCheckedChange={setPlanting}
                  aria-label="Proposed planting"
                />
              </label>
              <button
                className="field-note"
                onClick={() => setDialog('intake')}
              >
                <Send size={16} />
                <div>
                  <b>
                    From the field <ArrowUpRight size={12} />
                  </b>
                  <p>“Restore the lower pond and extend the orchard east.”</p>
                  <small>Telegram intake · Demo</small>
                </div>
              </button>
              <Button
                variant="outline"
                className="wide upload-button"
                onClick={() => uploadRef.current?.click()}
              >
                <Upload size={14} /> Replace aerial
              </Button>
              <input
                ref={uploadRef}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (
                    !['image/png', 'image/jpeg', 'image/webp'].includes(
                      file.type,
                    ) ||
                    file.size > 10 * 1024 * 1024
                  ) {
                    notify('Choose a JPG, PNG or WebP image under 10 MB.');
                    return;
                  }
                  const request = ++fileRequest.current;
                  const targetId = projectId;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const url = String(reader.result);
                    const image = new window.Image();
                    image.onload = () => {
                      if (request !== fileRequest.current) return;
                      patchJob(
                        (j) => ({
                          ...j,
                          image: url,
                          imageHeight: (1200 * image.height) / image.width,
                          features: [],
                          scale: 0,
                          revision: j.revision + 1,
                          activity: [
                            'A new aerial image was added',
                            ...j.activity,
                          ],
                        }),
                        targetId,
                      );
                      setSelected('');
                      notify(
                        'Image replaced. Set the scale, then draw your work areas.',
                      );
                    };
                    image.onerror = () =>
                      notify(
                        'That image could not be opened. Try another file.',
                      );
                    image.src = url;
                  };
                  reader.onerror = () => notify('That file could not be read.');
                  reader.readAsDataURL(file);
                }}
              />
            </aside>
            <LandMap
              key={projectId + job.image.slice(0, 80)}
              features={job.features}
              selected={f?.id || ''}
              onSelect={setSelected}
              boundary={boundary}
              planting={planting}
              scale={job.scale}
              spacing={job.spacing}
              image={job.image}
              imageHeight={job.imageHeight}
              revision={job.revision}
              onMeasure={scaleModal}
              onDraw={(points) => {
                if (!validPolygon(points)) {
                  notify(
                    'Draw a clear boundary with at least three corners and no crossing edges.',
                  );
                  return;
                }
                setDrawn(points);
                setFeatureName('');
                setFeatureKind('area');
                setDialog('draw');
              }}
            />
            <aside className="detail-panel">
              {f && m ? (
                <>
                  <div className="section-label">
                    SELECTED FEATURE{' '}
                    <span>
                      {String(job.features.indexOf(f) + 1).padStart(2, '0')} /{' '}
                      {String(job.features.length).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="detail-title">
                    <span
                      className={`feature-icon ${f.kind === 'pond' ? 'blue' : f.kind === 'trees' ? 'green' : 'gold'}`}
                    >
                      <FeatureIcon kind={f.kind} size={22} />
                    </span>
                    <h2>{f.name}</h2>
                  </div>
                  <label className="include-row">
                    <span className={`status ${f.included ? 'mint' : 'amber'}`}>
                      {f.included ? 'Included in scope' : 'Excluded from scope'}
                    </span>
                    <Switch
                      checked={f.included}
                      onCheckedChange={(included) =>
                        updateFeature(f.id, { included })
                      }
                      aria-label={`Include ${f.name} in scope`}
                    />
                  </label>
                  <div className="detail-divider" />
                  <div className="section-label">
                    MEASUREMENTS{' '}
                    <button
                      onClick={scaleModal}
                      aria-label="Edit measurement scale"
                    >
                      <Ruler size={14} />
                    </button>
                  </div>
                  <div className="measurement-main">
                    <strong>
                      {!job.scale
                        ? '—'
                        : f.kind === 'trees'
                          ? plantingPoints(f.points, job.scale, job.spacing)
                              .length
                          : f.kind === 'path'
                            ? Math.round(m.perimeter)
                            : (m.area / 43560).toFixed(2)}
                    </strong>
                    <span>
                      {f.kind === 'trees'
                        ? 'trees proposed'
                        : f.kind === 'path'
                          ? 'ft · path length'
                          : 'acres · plan area'}
                    </span>
                  </div>
                  {f.kind === 'trees' ? (
                    <>
                      <label className="spacing-control">
                        <span>Tree spacing</span>
                        <Select
                          value={String(job.spacing)}
                          onValueChange={(v) => changeSpacing(Number(v))}
                        >
                          <SelectTrigger aria-label="Tree spacing">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[10, 15, 20, 25, 30, 40, 50, 60].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n} ft
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <div className="measure-grid">
                        <div>
                          <small>Planting area</small>
                          <b>
                            {job.scale ? (m.area / 43560).toFixed(2) : '—'}{' '}
                            <span>ac</span>
                          </b>
                        </div>
                        <div>
                          <small>Layout</small>
                          <b className="method">Square grid</b>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="measure-grid">
                      <div>
                        <small>East–west extent</small>
                        <b>
                          {job.scale ? Math.round(m.width) : '—'}{' '}
                          <span>ft</span>
                        </b>
                      </div>
                      <div>
                        <small>North–south extent</small>
                        <b>
                          {job.scale ? Math.round(m.height) : '—'}{' '}
                          <span>ft</span>
                        </b>
                      </div>
                      <div>
                        <small>
                          {f.kind === 'path' ? 'Path length' : 'Perimeter'}
                        </small>
                        <b>
                          {job.scale ? Math.round(m.perimeter) : '—'}{' '}
                          <span>ft</span>
                        </b>
                      </div>
                      <div>
                        <small>Method</small>
                        <b className="method">Image trace</b>
                      </div>
                    </div>
                  )}
                  <div className="estimate-note">
                    <CircleDot size={14} />
                    <span>
                      {job.scale
                        ? 'Desktop estimate. Verify on site.'
                        : 'Set an image scale to get dimensions.'}
                    </span>
                  </div>
                  <div className="detail-divider" />
                  <div className="section-label">PROPOSED WORK</div>
                  <p className="work-description">{f.description}</p>
                  <div className="task-check">
                    <Check size={14} />{' '}
                    {f.kind === 'pond'
                      ? 'Shoreline preparation'
                      : f.kind === 'trees'
                        ? 'Tree positions inside planting area'
                        : 'Field verification required'}
                  </div>
                  <div className="task-check">
                    <Check size={14} />{' '}
                    {f.kind === 'pond'
                      ? 'Native buffer planting'
                      : f.kind === 'trees'
                        ? 'Spacing adjusts planting quantities'
                        : 'Quantities linked to the scope'}
                  </div>
                  <Button
                    className="scope-button"
                    onClick={() => setView('scope')}
                  >
                    <FileText size={16} /> Open scope of work{' '}
                    <ArrowUpRight size={15} />
                  </Button>
                  <div className="detail-foot">
                    <span className="avatar small">C</span>
                    <span>
                      Prepared by Connor
                      <br />
                      <small>Ojai Permaculture</small>
                    </span>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">
                  <Map size={28} />
                  <h2>Start with the land</h2>
                  <p>
                    Set a known distance, then draw a pond or planting area on
                    the map.
                  </p>
                  <Button onClick={scaleModal}>Set image scale</Button>
                </div>
              )}
            </aside>
          </div>
          <div className="workspace-activity">
            <Clock3 size={14} />
            <span>{job.activity[0]}</span>
            <span>Revision {String(job.revision).padStart(2, '0')}</span>
          </div>
        </TabsContent>
        <TabsContent value="scope" className="tab-panel">
          <ScopeView
            job={job}
            project={project}
            onUpdate={updateFeature}
            onShare={() => setDialog('share')}
            onMap={() => setView('workspace')}
          />
        </TabsContent>
        <TabsContent value="client" className="tab-panel">
          <ClientView
            job={job}
            project={project}
            onApprove={approve}
            onRequest={requestChanges}
            onComment={addComment}
            onUpdate={addUpdate}
            onScope={() => setView('scope')}
          />
        </TabsContent>
      </Tabs>
      <footer className="app-footer">
        <span>
          <i />{' '}
          {view === 'projects'
            ? 'OJAI PERMACULTURE'
            : project.name.toUpperCase() + ' · ' + project.id}
        </span>
        <span>Planning → Scope → Client review → Fieldwork</span>
        <span>DEMO · NO LIVE CONNECTIONS</span>
      </footer>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          className={`ground-dialog ${dialog === 'scale' ? 'calibration-dialog' : ''}`}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === 'new'
                ? 'A new place to begin'
                : dialog === 'scale'
                  ? 'Set a known distance'
                  : dialog === 'share'
                    ? 'Share this proposal'
                    : dialog === 'draw'
                      ? 'Name your work area'
                      : dialog === 'intake'
                        ? 'Field inbox'
                        : 'Add a project update'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'new'
                ? 'Create a client property in this demo workspace.'
                : dialog === 'scale'
                  ? 'Click two points on the image, then enter the real distance between them. Use a top-down image.'
                  : dialog === 'share'
                    ? `Review revision ${job.revision} before making it visible in the demo client portal.`
                    : dialog === 'draw'
                      ? 'Your traced geometry will calculate the quantities.'
                      : dialog === 'intake'
                        ? 'Preview how field notes from Telegram enter a project. Hermes is not connected.'
                        : 'Keep your client informed about the work on their property.'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'new' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newName.trim() || !newClient.trim()) return;
                const id = `GW-${Date.now().toString().slice(-6)}`;
                const p = {
                  id,
                  name: newName.trim(),
                  client: newClient.trim(),
                  location: newLocation.trim() || 'Location to be confirmed',
                  acres: Number(newAcres) || 0,
                  stage: 'Planning',
                  initials: newClient
                    .split(' ')
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase(),
                };
                setProjects((ps) => [...ps, p]);
                setJobs((js) => ({ ...js, [id]: makeJob(true) }));
                setProjectId(id);
                setSelected('');
                setView('workspace');
                setDialog(null);
                setNewName('');
                setNewClient('');
                setNewLocation('');
                setNewAcres('');
                notify('Project created. Add an aerial image to begin.');
              }}
              className="dialog-form"
            >
              <label>
                Property name
                <Input
                  autoFocus
                  value={newName}
                  maxLength={80}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. North Creek Farm"
                />
              </label>
              <label>
                Client name
                <Input
                  value={newClient}
                  maxLength={80}
                  onChange={(e) => setNewClient(e.target.value)}
                  required
                  placeholder="Client or family name"
                />
              </label>
              <div className="form-pair">
                <label>
                  Location
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="County, state"
                  />
                </label>
                <label>
                  Property size (acres)
                  <Input
                    type="number"
                    min="0"
                    max="1000000"
                    step=".1"
                    value={newAcres}
                    onChange={(e) => setNewAcres(e.target.value)}
                    placeholder="0.0"
                  />
                </label>
              </div>
              <Button type="submit" className="primary-action wide">
                <Plus size={15} /> Create project
              </Button>
            </form>
          )}
          {dialog === 'scale' && (
            <>
              <svg
                viewBox={`0 0 1200 ${job.imageHeight}`}
                className="calibration-image"
                onClick={(e) => {
                  const s = e.currentTarget,
                    p = s.createSVGPoint();
                  p.x = e.clientX;
                  p.y = e.clientY;
                  const mat = s.getScreenCTM();
                  if (!mat) return;
                  const q = p.matrixTransform(mat.inverse());
                  if (q.x < 0 || q.y < 0 || q.x > 1200 || q.y > job.imageHeight)
                    return;
                  setCalibration((c) =>
                    c.length >= 2 ? [[q.x, q.y]] : [...c, [q.x, q.y]],
                  );
                  setScaleError('');
                }}
              >
                <image href={job.image} width="1200" height={job.imageHeight} />
                {calibration.length === 2 && (
                  <line
                    x1={calibration[0][0]}
                    y1={calibration[0][1]}
                    x2={calibration[1][0]}
                    y2={calibration[1][1]}
                    stroke="#e4fbc0"
                    strokeWidth="4"
                  />
                )}
                {calibration.map(([x, y], i) => (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r="9"
                      fill="#c7e3a5"
                      stroke="#112419"
                      strokeWidth="3"
                    />
                    <text x={x + 15} y={y - 12} fill="white" fontSize="24">
                      {i === 0 ? 'A' : 'B'}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="calibration-instruction">
                {calibration.length === 0
                  ? '1. Click the first reference point'
                  : calibration.length === 1
                    ? '2. Click the second reference point'
                    : '3. Enter the real-world distance below'}
              </div>
              <form
                className="dialog-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (calibration.length !== 2) return;
                  const pixels = Math.hypot(
                    calibration[0][0] - calibration[1][0],
                    calibration[0][1] - calibration[1][1],
                  );
                  const feet = Number(distance);
                  if (pixels < 10 || !Number.isFinite(feet) || feet <= 0) {
                    setScaleError(
                      'Use reference points farther apart and a positive distance.',
                    );
                    return;
                  }
                  if (
                    job.features.some(
                      (f) =>
                        f.kind === 'trees' &&
                        !layoutFits(f.points, feet / pixels, job.spacing),
                    )
                  ) {
                    setScaleError(
                      'This scale creates too many planting points. Use a closer aerial or wider spacing first.',
                    );
                    return;
                  }
                  edit((j) => ({ ...j, scale: feet / pixels }));
                  setDialog(null);
                  notify(
                    'Scale updated. Map quantities and draft scope recalculated.',
                  );
                }}
              >
                <label>
                  Distance between A and B (feet)
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    max="100000"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    required
                  />
                </label>
                {scaleError && (
                  <p role="alert" className="form-error">
                    {scaleError}
                  </p>
                )}
                <Button
                  className="primary-action wide"
                  type="submit"
                  disabled={calibration.length !== 2}
                >
                  <Check size={15} /> Confirm scale
                </Button>
              </form>
            </>
          )}
          {dialog === 'draw' && (
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!featureName.trim() || drawn.length < 3) return;
                if (
                  featureKind === 'trees' &&
                  !layoutFits(drawn, job.scale, job.spacing)
                ) {
                  notify(
                    'This planting layout is too dense. Use a smaller area or wider spacing.',
                  );
                  return;
                }
                const id = `feature-${Date.now()}`;
                const feat: Feature = {
                  id,
                  name: featureName.trim(),
                  kind: featureKind,
                  status:
                    featureKind === 'pond'
                      ? 'Existing · Restoration'
                      : featureKind === 'trees'
                        ? 'Proposed · Tree planting'
                        : 'Proposed · Work area',
                  points: drawn,
                  description:
                    featureKind === 'trees'
                      ? 'Prepare this area and establish new trees at the selected spacing.'
                      : 'Prepare the selected work area. Confirm site conditions and final work requirements before scheduling.',
                  rate:
                    featureKind === 'trees'
                      ? 185
                      : featureKind === 'pond'
                        ? 8.5
                        : 1.5,
                  included: true,
                };
                edit((j) => ({ ...j, features: [...j.features, feat] }));
                setSelected(id);
                setDialog(null);
                notify('Work area added to the property and draft scope.');
              }}
            >
              <label>
                Feature name
                <Input
                  value={featureName}
                  onChange={(e) => setFeatureName(e.target.value)}
                  autoFocus
                  required
                  maxLength={60}
                  placeholder="e.g. West planting area"
                />
              </label>
              <label>
                Work type
                <Select
                  value={featureKind}
                  onValueChange={(v) => setFeatureKind(v as Feature['kind'])}
                >
                  <SelectTrigger aria-label="Work type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="area">General work area</SelectItem>
                    <SelectItem value="pond">Pond restoration</SelectItem>
                    <SelectItem value="trees">Tree planting</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="dialog-summary">
                <span>{drawn.length} boundary points</span>
                <b>
                  {job.scale
                    ? `${Math.round(metrics(drawn, job.scale).area).toLocaleString()} sq ft`
                    : 'Set scale to calculate area'}
                </b>
              </div>
              <Button type="submit" className="primary-action wide">
                <Plus size={15} /> Add to project
              </Button>
            </form>
          )}
          {dialog === 'share' && (
            <>
              <div className="share-recipient">
                <span className="avatar">{project.initials}</span>
                <div>
                  <b>{project.client}</b>
                  <span>{project.name} · Client portal</span>
                </div>
              </div>
              <div className="share-lines">
                {rows.map((r) => (
                  <div key={r.id}>
                    <span>
                      {r.name}
                      <small>
                        {r.quantity} {r.unit}
                      </small>
                    </span>
                    <b>{money(r.total)}</b>
                  </div>
                ))}
              </div>
              <div className="dialog-summary">
                <span>
                  Revision {job.revision} · {rows.length} work areas
                </span>
                <b>{money(total)} full base scope</b>
              </div>
              <div className="share-planning">
                <div>
                  <span>Funded work + contingency</span>
                  <b>{money(investment.allowance)}</b>
                </div>
                <div>
                  <span>Five-year tree care</span>
                  <b>{money(investment.atYear(5).care)}</b>
                </div>
                <div>
                  <span>Installation window</span>
                  <b>{job.planning.months} months</b>
                </div>
                <p>
                  {investment.funded.length} of {investment.phases.length} work
                  areas funded. Deferred work stays outside the funded proposal.
                </p>
              </div>
              <p className="muted-copy">
                This freezes the drawing, budget, schedule, and assumptions for
                the client. Later edits stay in your draft until you share
                again.
              </p>
              <Button
                className="primary-action wide"
                onClick={share}
                disabled={!job.scale || !rows.length}
              >
                <Send size={15} /> Share to demo portal
              </Button>
              <small className="session-explainer">
                No email or Telegram message will be sent.
              </small>
            </>
          )}
          {dialog === 'intake' && (
            <>
              <div className="telegram-message">
                <span className="avatar">C</span>
                <div>
                  <b>
                    Connor · Field notes <small>9:41 AM</small>
                  </b>
                  <p>{fieldNote}</p>
                  <div className="attachment-pill">
                    <ImagePlus size={15} /> north-creek-aerial.jpg
                  </div>
                </div>
              </div>
              <form
                className="dialog-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!fieldNote.trim()) return;
                  addUpdate(`Field note: ${fieldNote.trim()}`);
                  setDialog(null);
                  notify('Field note added to the demo project.');
                }}
              >
                <label>
                  Field note
                  <Textarea
                    value={fieldNote}
                    maxLength={2000}
                    onChange={(e) => setFieldNote(e.target.value)}
                    required
                  />
                </label>
                <div className="dialog-summary">
                  <span>Route to project</span>
                  <b>{project.name}</b>
                </div>
                <Button className="primary-action wide" type="submit">
                  <Plus size={15} /> Add note to project
                </Button>
              </form>
            </>
          )}
          {dialog === 'update' && (
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!updateText.trim()) return;
                addUpdate(updateText.trim());
                setUpdateText('');
                setDialog(null);
                notify('Update added to the client project timeline.');
              }}
            >
              <label>
                Client-visible update
                <Textarea
                  autoFocus
                  value={updateText}
                  maxLength={2000}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="e.g. Site walk complete. Pond edge is marked and ready for preparation."
                  required
                />
              </label>
              <Button className="primary-action wide" type="submit">
                <Plus size={15} /> Add project update
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {notice && (
        <div className="toast-message" role="status">
          <Check size={16} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
