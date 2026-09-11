'use client';

import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Compass,
  Layers,
  MessageSquare,
  Send,
  Sprout,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import LandMap from './land-map';
import { ClientInvestment } from './plan-presentation';
import { calculatePlan } from './plan-model';
import { pixelPoint, siteSources } from './site-data';
import { money, type Job, type Project } from './data';

const designLenses = [
  {
    name: 'Landform',
    icon: Compass,
    title: 'Let the land set the pattern.',
    text: 'Read ridges, valleys, changes in slope, and existing vegetation before deciding where new work belongs.',
    next: 'Confirm the contour survey, soil conditions, keypoints, and field levels.',
  },
  {
    name: 'Water & access',
    icon: Waves,
    title: 'Plan water and movement together.',
    text: 'Consider catchments, water storage, safe overflow routes, and access as connected parts of the property.',
    next: 'Verify catchment behavior, outlet levels, route grades, and permit requirements before earthworks.',
  },
  {
    name: 'Living systems',
    icon: Sprout,
    title: 'Establish a landscape that can be cared for.',
    text: 'Coordinate planting with water, access, species needs, and the time available for establishment and ongoing care.',
    next: 'Design and survey planting alignments; confirm species, spacing, irrigation, and maintenance access.',
  },
];

const dependencies: Record<string, string> = {
  pond: 'Confirm bank condition, water levels, ecological constraints, and any required approvals before work.',
  trees:
    'Confirm species, surveyed row alignment, soil preparation, irrigation, and planting season.',
  path: 'Confirm route, gradients, drainage crossings, surfacing, and equipment access.',
  area: 'Confirm site conditions, boundaries, dimensions, and the detailed work specification.',
};

export type ClientProposalProps = {
  job: Job;
  project: Project;
  onApprove: () => void;
  onRequest: () => void;
  onComment: (text: string) => void;
  onUpdate: (text: string) => void;
  onScope: () => void;
};

export default function ClientProposal({
  job,
  project,
  onApprove,
  onRequest,
  onComment,
  onScope,
}: ClientProposalProps) {
  const [selected, setSelected] = useState('pond');
  const [mapLayer, setMapLayer] = useState('plan');
  const [vision, setVision] = useState('aerial');
  const [lens, setLens] = useState('Landform');
  const [comment, setComment] = useState('');
  const shared = job.shared;
  const plan = shared
    ? calculatePlan(shared.rows, shared.features, shared.planning)
    : null;
  const chosen = plan?.phases.find((p) => p.id === selected) || plan?.phases[0];
  const idea = designLenses.find((d) => d.name === lens)!;
  const source = shared?.site;
  const aligned = !!source && shared?.image === source.hillshadeUrl;
  const aerial = aligned ? source.imageryUrl : shared?.image;
  const baseImage =
    mapLayer === 'terrain' && aligned ? source.contourUrl : aerial;
  const sampleImage = shared?.image === '/property-aerial.png';
  const validProfile =
    source?.profile.filter((p) => p.elevationFt !== null) || [];
  const sampleLevels = validProfile.map((p) => p.elevationFt!);
  const terrainRange = sampleLevels.length
    ? `${Math.round(Math.min(...sampleLevels))}–${Math.round(Math.max(...sampleLevels))} ft`
    : 'Survey needed';
  const terrainDatum = [
    ...new Set(validProfile.map((p) => p.datum).filter(Boolean)),
  ].join(' / ');
  const sourceDate = [
    ...new Set(validProfile.map((p) => p.acquired).filter(Boolean)),
  ].join(' / ');

  return (
    <section className="proposal-shell">
      <div className="proposal-preview">
        <span>
          CLIENT TEMPLATE <b>Preview for {project.client}</b>
        </span>
        <Button variant="ghost" onClick={onScope}>
          Edit scope <ArrowRight size={14} />
        </Button>
      </div>
      <div className="proposal-paper">
        <header className="proposal-masthead">
          <a href="#proposal-cover" className="proposal-wordmark">
            <Sprout size={28} />
            <span>
              OJAI
              <br />
              <b>PERMACULTURE</b>
            </span>
          </a>
          <nav aria-label="Proposal sections">
            <a href="#landscape-plan">The land</a>
            <a href="#landscape-vision">The vision</a>
            <a href="#project-work">The scope</a>
            <a href="#landscape-investment">Investment</a>
          </nav>
          <span className="proposal-edition">CONNOR / LANDSCAPE PLANNING</span>
        </header>
        <div className="proposal-cover" id="proposal-cover">
          <div className="proposal-kicker">
            A WHOLE-PROPERTY VISION{' '}
            <span>
              {project.id} · REV{' '}
              {String(shared?.revision || job.revision).padStart(2, '0')}
            </span>
          </div>
          <div className="proposal-cover-title">
            <h1>{project.name}</h1>
            <p>
              Water, trees, and a plan
              <br />
              that grows with your land.
            </p>
          </div>
          <div className="proposal-cover-meta">
            <span>{project.location}</span>
            <span>Prepared for {project.client}</span>
            <span>
              {shared
                ? 'Concept proposal · For review'
                : 'Proposal in preparation'}
            </span>
          </div>
        </div>
        {!shared || !plan ? (
          <div className="proposal-awaiting">
            <Layers />
            <h2>Your property plan is taking shape.</h2>
            <p>
              Connor’s shared aerial plan, scope, and investment schedule will
              appear here when a proposal revision is ready.
            </p>
            <Button onClick={onScope}>
              Prepare proposal <ArrowRight size={16} />
            </Button>
          </div>
        ) : (
          <>
            <section className="proposal-land" id="landscape-plan">
              <div className="proposal-section-top">
                <span className="proposal-number">01 / THE LAND</span>
                <Tabs
                  value={mapLayer}
                  onValueChange={(v) => setMapLayer(String(v))}
                >
                  <TabsList aria-label="Property presentation">
                    <TabsTrigger value="plan">Proposed plan</TabsTrigger>
                    <TabsTrigger value="aerial">Aerial view</TabsTrigger>
                    {aligned && (
                      <TabsTrigger value="terrain">Contours</TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              </div>
              <div className="proposal-map-frame">
                <LandMap
                  fit="contain"
                  features={
                    mapLayer === 'plan'
                      ? shared.features.filter((f) =>
                          plan.phases.some((p) => p.id === f.id),
                        )
                      : []
                  }
                  selected={chosen?.id || ''}
                  onSelect={setSelected}
                  boundary={true}
                  planting={true}
                  scale={shared.scale}
                  spacing={shared.spacing}
                  image={baseImage || shared.image}
                  imageHeight={shared.imageHeight}
                  interactive={false}
                  revision={shared.revision}
                  parcelRings={
                    aligned
                      ? source.parcel.rings.map((r) =>
                          r.map((p) => pixelPoint(p, source.bounds)),
                        )
                      : undefined
                  }
                  imageLabel={
                    source
                      ? 'Public GIS · Concept work areas'
                      : sampleImage
                        ? 'Fictional example · Concept work areas'
                        : 'Supplied image · Concept work areas'
                  }
                />
                <span className="proposal-map-badge">
                  {mapLayer === 'plan'
                    ? 'CONCEPT MASTERPLAN'
                    : mapLayer === 'terrain'
                      ? 'USGS CONTOUR LAYER'
                      : 'BASE AERIAL'}{' '}
                  /{' '}
                  {source
                    ? 'PUBLIC GIS'
                    : sampleImage
                      ? 'ILLUSTRATIVE PROPERTY'
                      : 'SUPPLIED IMAGE'}
                </span>
              </div>
              <div className="proposal-map-caption">
                <p>
                  {source
                    ? 'County parcel outline and USGS imagery. Public GIS is a planning reference; site verification is required.'
                    : sampleImage
                      ? 'Fictional aerial used to demonstrate the proposal template. Work areas and quantities are illustrative.'
                      : 'Client-supplied base image. Image date, orientation, and field dimensions require confirmation.'}{' '}
                  {mapLayer === 'plan' &&
                    'Select a work area to see its scope below.'}
                </p>
                <span>DRAWING 01 / REV {shared.revision}</span>
              </div>
              <div className="proposal-land-facts">
                <div>
                  <span>PROPERTY AREA</span>
                  <strong>
                    {source
                      ? source.parcel.acres?.toLocaleString() || '—'
                      : project.acres.toLocaleString()}{' '}
                    <small>acres</small>
                  </strong>
                  <p>
                    {source
                      ? 'County GIS attribute'
                      : 'Illustrative project record'}
                  </p>
                </div>
                <div>
                  <span>LAND RECORD</span>
                  <strong>{source ? source.parcel.apn : 'Site review'}</strong>
                  <p>
                    {source
                      ? source.jurisdiction
                      : 'Survey and title not supplied'}
                  </p>
                </div>
                <div>
                  <span>DELIVERY WINDOW</span>
                  <strong>
                    {shared.planning.months} <small>months</small>
                  </strong>
                  <p>Proposed installation schedule</p>
                </div>
                <div>
                  <span>DESIGN STATUS</span>
                  <strong>Concept</strong>
                  <p>Buildable area & grades unverified</p>
                </div>
              </div>
              {plan.phases.length > 0 && (
                <div
                  className="proposal-area-picker"
                  aria-label="Select a work area"
                >
                  {plan.phases.map((p) => (
                    <Button
                      key={p.id}
                      variant="outline"
                      aria-pressed={chosen?.id === p.id}
                      onClick={() => setSelected(p.id)}
                    >
                      {String(p.number).padStart(2, '0')} / {p.name}
                      {!p.funded && ' · Deferred'}
                    </Button>
                  ))}
                </div>
              )}
              {chosen && (
                <div className="proposal-selected-work">
                  <span className="proposal-selected-icon">
                    {chosen.kind === 'pond' ? (
                      <Waves />
                    ) : chosen.kind === 'trees' ? (
                      <Sprout />
                    ) : (
                      <Compass />
                    )}
                  </span>
                  <div>
                    <span className="proposal-number">
                      WORK AREA {String(chosen.number).padStart(2, '0')} /{' '}
                      {chosen.funded ? 'IN THIS INVESTMENT' : 'FUTURE SCOPE'}
                    </span>
                    <h3>{chosen.name}</h3>
                    <p>{chosen.description}</p>
                  </div>
                  <div className="proposal-selected-quantity">
                    <b>
                      {chosen.quantity.toLocaleString()} {chosen.unit}
                    </b>
                    <span>{money(chosen.allowance)} incl. contingency</span>
                    <a href={`#work-${chosen.id}`}>
                      View work package <ChevronRight size={15} />
                    </a>
                  </div>
                </div>
              )}
            </section>

            <section
              className="proposal-design"
              aria-labelledby="design-heading"
            >
              <div className="proposal-section-heading">
                <div>
                  <span className="proposal-number">THE DESIGN APPROACH</span>
                  <h2 id="design-heading">
                    Read the land.
                    <br />
                    <em>Then shape the plan.</em>
                  </h2>
                </div>
                <p>
                  A keyline-informed brief starts with landform and water, then
                  considers access, planting, and long-term care.
                </p>
              </div>
              <div className="proposal-terrain-facts">
                <div>
                  <span>TOPOGRAPHIC BASIS</span>
                  <b>
                    {source?.sourceStatus.terrain
                      ? 'USGS public terrain'
                      : 'Field survey required'}
                  </b>
                  <p>
                    {sourceDate
                      ? `Acquisition: ${sourceDate}`
                      : 'No surveyed levels supplied'}
                  </p>
                </div>
                <div>
                  <span>SAMPLED ELEVATION SPAN</span>
                  <b>{terrainRange}</b>
                  <p>
                    {sampleLevels.length
                      ? `${sampleLevels.length} valid transect samples · ${terrainDatum || 'datum not reported'}`
                      : 'No parcel elevation claim'}
                  </p>
                </div>
                <div>
                  <span>WATER & SOIL</span>
                  <b>Site assessment needed</b>
                  <p>Infiltration, catchment flow, and storage capacity</p>
                </div>
                <div>
                  <span>PLANTING ALIGNMENT</span>
                  <b>Detailed design needed</b>
                  <p>Keypoints, grades, species, and surveyed set-out</p>
                </div>
              </div>
              {source && (
                <p className="proposal-source-note">
                  Elevation span is from the sampled cross-section, including
                  land outside the parcel; it is not the parcel’s minimum and
                  maximum.{' '}
                  <a
                    href={siteSources.elevation}
                    target="_blank"
                    rel="noreferrer"
                  >
                    USGS terrain source ↗
                  </a>
                </p>
              )}
              <div className="proposal-design-grid">
                <Tabs value={lens} onValueChange={(v) => setLens(String(v))}>
                  <TabsList aria-label="Design considerations">
                    {designLenses.map((d, i) => (
                      <TabsTrigger key={d.name} value={d.name}>
                        <d.icon size={20} />
                        <span>0{i + 1}</span>
                        {d.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="proposal-design-note">
                  <h3>{idea.title}</h3>
                  <p>{idea.text}</p>
                  <div>
                    <span>BEFORE DETAILED DESIGN</span>
                    <p>{idea.next}</p>
                  </div>
                </div>
              </div>
              <p className="proposal-source-note">
                This is a design brief, not a calculated keyline layout.
                Contours inform the next design step; planting grades and
                waterworks require survey and detailed design.{' '}
                <a
                  href="https://www.regrarians.org/manna-hill-estate"
                  target="_blank"
                  rel="noreferrer"
                >
                  Manna Hill reference ↗
                </a>{' '}
                <a
                  href="https://keyline.com.au/detail01.htm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Keyline planning principles ↗
                </a>
              </p>
            </section>

            <section className="proposal-vision" id="landscape-vision">
              <div className="proposal-section-heading">
                <div>
                  <span className="proposal-number">02 / THE VISION</span>
                  <h2>A landscape to grow into.</h2>
                </div>
                <p>
                  Use these visual references to discuss the feel of the
                  landscape before commissioning a render of your exact design.
                </p>
              </div>
              <Tabs value={vision} onValueChange={(v) => setVision(String(v))}>
                <TabsList aria-label="Landscape visualizations">
                  <TabsTrigger value="aerial">Aerial concept</TabsTrigger>
                  <TabsTrigger value="established">
                    Established landscape
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {(['aerial', 'established'] as const).map((render) => (
                <figure
                  key={render}
                  className={`proposal-render ${vision !== render ? 'render-inactive' : ''}`}
                >
                  <img
                    src={
                      render === 'aerial'
                        ? '/keyline-aerial-concept.png'
                        : '/keyline-established-vision.png'
                    }
                    alt={
                      render === 'aerial'
                        ? 'Illustrative Ojai landscape render with curved orchard rows, meadow, a small pond, and foothills'
                        : 'Illustrative established orchard and meadow beside a gravel path in an Ojai-like landscape'
                    }
                    width="1672"
                    height="941"
                    loading="lazy"
                  />
                  <span>DESIGN DIRECTION / AI-GENERATED REFERENCE</span>
                  <figcaption>
                    <b>
                      {render === 'aerial'
                        ? 'The pattern across the property'
                        : 'The experience on the ground'}
                    </b>
                    <p>
                      {render === 'aerial'
                        ? 'Curving planting structure, connected access, open meadow, and water considered together.'
                        : 'An established planting palette and a walkable landscape with shade, habitat, and room for care.'}{' '}
                      Illustrative scene; not this parcel, a surveyed layout, or
                      a promised future outcome.
                    </p>
                  </figcaption>
                </figure>
              ))}
            </section>

            <section className="proposal-work" id="project-work">
              <div className="proposal-section-heading">
                <div>
                  <span className="proposal-number">03 / THE SCOPE</span>
                  <h2>
                    One vision.
                    <br />
                    <em>Clear steps forward.</em>
                  </h2>
                </div>
                <p>
                  {plan.funded.length} funded work packages within your{' '}
                  {money(shared.planning.budget)} installation budget. Deferred
                  work remains visible for a future investment.
                </p>
              </div>
              <div className="proposal-work-list">
                {plan.phases.map((p) => (
                  <article
                    id={`work-${p.id}`}
                    key={p.id}
                    className={`proposal-work-card ${p.funded ? '' : 'is-deferred'}`}
                  >
                    <div className="proposal-work-index">
                      {String(p.number).padStart(2, '0')}
                      <span>{p.funded ? `BY MONTH ${p.month}` : 'LATER'}</span>
                    </div>
                    <div className="proposal-work-body">
                      <span className="proposal-number">
                        {p.kind === 'pond'
                          ? 'WATER & HABITAT'
                          : p.kind === 'trees'
                            ? 'PLANTING & ESTABLISHMENT'
                            : p.kind === 'path'
                              ? 'ACCESS & MOVEMENT'
                              : 'SITE IMPROVEMENTS'}
                      </span>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                      <details>
                        <summary>Scope dependencies & cost basis</summary>
                        <p>{dependencies[p.kind]}</p>
                        <p>
                          {p.quantity.toLocaleString()} {p.unit} ×{' '}
                          {money(p.rate)} = {money(p.total)} installation, plus{' '}
                          {money(p.reserve)} contingency. Sample rates; final
                          quote required.
                        </p>
                      </details>
                    </div>
                    <div className="proposal-work-price">
                      <span>{p.funded ? 'INCLUDED' : 'DEFERRED'}</span>
                      <strong>{money(p.allowance)}</strong>
                      <p>
                        {p.quantity.toLocaleString()} {p.unit}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="proposal-delivery-note">
                <Check size={19} />
                <p>
                  Sequence and dates are planning allowances. Connor will
                  confirm design, approvals, contractors, and the appropriate
                  season before scheduling fieldwork.
                </p>
              </div>
            </section>

            <section
              className="proposal-investment-section"
              id="landscape-investment"
            >
              <div className="proposal-section-heading">
                <div>
                  <span className="proposal-number">
                    04 / INVESTMENT & TIME
                  </span>
                  <h2>
                    The work is the beginning.
                    <br />
                    <em>Care carries it forward.</em>
                  </h2>
                </div>
                <p>
                  Installation, contingency, and establishment care are shown
                  separately, with a five-year view of the selected plan.
                </p>
              </div>
              <ClientInvestment shared={shared} project={project} />
            </section>

            <section className="proposal-evidence">
              <div>
                <span className="proposal-number">
                  THE BASIS OF THIS PROPOSAL
                </span>
                <h2>
                  What we know.
                  <br />
                  What comes next.
                </h2>
              </div>
              <dl>
                <div>
                  <dt>Base imagery & parcel</dt>
                  <dd>
                    {source ? (
                      <>
                        County GIS + USGS. Retrieved{' '}
                        {new Date(source.retrievedAt).toLocaleDateString(
                          'en-US',
                        )}
                        .{' '}
                        <a
                          href={siteSources.parcels}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Parcel source ↗
                        </a>
                      </>
                    ) : sampleImage ? (
                      'Fictional demonstration property and aerial.'
                    ) : (
                      'Supplied image; source and acquisition date need confirmation.'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Topography & keyline layout</dt>
                  <dd>
                    {source ? 'Public terrain reference available. ' : ''}
                    Detailed topographic survey, keypoints, planting grades, and
                    set-out remain to be confirmed.
                  </dd>
                </div>
                {source && (
                  <div>
                    <dt>Mapped planning context</dt>
                    <dd>
                      {source.jurisdiction}.{' '}
                      {source.zoning.length
                        ? `County zones: ${source.zoning
                            .map((z) => z.ZONE)
                            .filter(Boolean)
                            .join(', ')}. `
                        : 'Zoning requires authority confirmation. '}
                      {source.overlays.length
                        ? `Mapped overlays: ${source.overlays
                            .map((z) => z.OVERLAY_NA || z.OVERLAY_ZO)
                            .filter(Boolean)
                            .join(', ')}. `
                        : ''}
                      <a
                        href={siteSources.zoning}
                        target="_blank"
                        rel="noreferrer"
                      >
                        County zoning source ↗
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Permissions & boundaries</dt>
                  <dd>
                    Legal lot status, setbacks, easements, utilities, and
                    permits require review. Mapped acreage is not a development
                    allowance.
                  </dd>
                </div>
                <div>
                  <dt>Investment & outcomes</dt>
                  <dd>
                    Sample rates and proposed schedule. Tree care only; no
                    modeled yield, water savings, or financial return. Concept
                    images are visual references.
                  </dd>
                </div>
              </dl>
            </section>

            <section className="proposal-review" id="proposal-review">
              <div>
                <span className="proposal-number">
                  YOUR NEXT STEP / REVISION {shared.revision}
                </span>
                <h2>
                  {shared.status === 'Approved'
                    ? 'A shared direction.'
                    : shared.status === 'Changes requested'
                      ? 'Let’s refine the details.'
                      : 'Make the plan yours.'}
                </h2>
                <p>
                  {shared.status === 'Approved'
                    ? 'Your review response is recorded for this proposal revision in the demo.'
                    : 'Review the work, timing, and allowances. Leave Connor a note or confirm this proposal as the direction to develop.'}
                </p>
                <span className="proposal-review-status">{shared.status}</span>
              </div>
              <div className="proposal-review-actions">
                <strong>{money(plan.allowance)}</strong>
                <span>Funded installation + contingency</span>
                <Button
                  className="primary-action"
                  onClick={onApprove}
                  disabled={shared.status === 'Approved'}
                >
                  <CheckCheck size={17} />
                  {shared.status === 'Approved'
                    ? 'Proposal approved'
                    : 'Approve proposal'}
                </Button>
                <Button
                  variant="outline"
                  onClick={onRequest}
                  disabled={shared.status === 'Changes requested'}
                >
                  <MessageSquare size={16} />
                  Request changes
                </Button>
                <Button variant="ghost" onClick={() => window.print()}>
                  <ArrowDownToLine size={16} />
                  Print / save proposal
                </Button>
              </div>
            </section>

            <section className="proposal-conversation">
              <div>
                <span className="proposal-number">
                  A CONVERSATION WITH CONNOR
                </span>
                <h2>
                  Questions, ideas,
                  <br />
                  and the next chapter.
                </h2>
                <p>
                  Demo responses stay in this browser session. Nothing is sent
                  externally.
                </p>
                <div className="proposal-contact">
                  <span>C</span>
                  <div>
                    <b>Connor</b>
                    <p>Ojai Permaculture · Project lead</p>
                  </div>
                </div>
              </div>
              <div>
                {job.comments.map((c, i) => (
                  <article className="proposal-comment" key={i}>
                    <b>
                      {c.author}
                      <small>REV {c.revision}</small>
                    </b>
                    <p>{c.text}</p>
                  </article>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (comment.trim()) {
                      onComment(comment.trim());
                      setComment('');
                    }
                  }}
                >
                  <Textarea
                    aria-label="Client comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={2000}
                    placeholder="What would you like Connor to know?"
                  />
                  <Button
                    type="submit"
                    className="primary-action"
                    disabled={!comment.trim()}
                  >
                    <Send size={15} />
                    Add note
                  </Button>
                </form>
                <details className="proposal-history">
                  <summary>Project history</summary>
                  {job.activity.slice(0, 5).map((a, i) => (
                    <p key={i}>{a}</p>
                  ))}
                </details>
              </div>
            </section>
          </>
        )}
        <footer className="proposal-footer">
          <span>OJAI PERMACULTURE</span>
          <p>Prepared by Connor · {project.id} · Concept proposal</p>
          <a href="#proposal-cover">Back to the plan ↑</a>
        </footer>
      </div>
    </section>
  );
}
