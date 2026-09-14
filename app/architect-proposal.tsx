'use client';
import { useState } from 'react';
import { ArrowUpRight, ArrowDownToLine, Layers, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBrand } from './brand';
import LandMap from './land-map';
import {
  definitions,
  designInvestment,
  type Field,
  type Values,
} from './design-model';
import { InvestmentSummary, DeliverySummary } from './design-workbench';
import { money } from './data';
import { pixelPoint } from './site-data';
import type { ClientProposalProps } from './client-proposal';
function Specs({ fields, values }: { fields: Field[]; values: Values }) {
  const entered = fields.filter(
    (f) =>
      values[f.key] !== null &&
      values[f.key] !== undefined &&
      values[f.key] !== '',
  );
  return entered.length ? (
    <dl className="tera-specs">
      {entered.map((f) => (
        <div key={f.key}>
          <dt>
            {f.label}
            {f.unit ? ` (${f.unit})` : ''}
          </dt>
          <dd>{String(values[f.key])}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p className="tera-note">
      Detailed specifications to be confirmed with the project team.
    </p>
  );
}
export default function ArchitectProposal({
  job,
  project,
  onApprove,
  onRequest,
  onComment,
  onScope,
  mode = 'preview',
  canRespond = false,
  busy = false,
}: ClientProposalProps) {
  const brand = useBrand(),
    shared = job.shared,
    scope = shared?.designScope;
  const [comment, setComment] = useState(''),
    [error, setError] = useState('');
  const source = shared?.site,
    aligned = !!source && shared?.image === source.hillshadeUrl;
  const estimate =
    scope && shared
      ? designInvestment(
          scope,
          shared.rows,
          shared.planning.contingency,
          shared.planning.budget,
        )
      : null;
  return (
    <section className="proposal-shell">
      {mode === 'preview' && (
        <div className="proposal-preview">
          <span>
            CLIENT TEMPLATE <b>Preview for {project.client}</b>
          </span>
          <Button variant="ghost" onClick={onScope}>
            Edit plan <ArrowUpRight size={14} />
          </Button>
        </div>
      )}
      <div className="proposal-paper">
        <header className="proposal-masthead">
          <div className="proposal-wordmark">
            <Layers size={25} />
            <span>
              TERA
              <br />
              <b>{brand.studio}</b>
            </span>
          </div>
          <span className="proposal-edition">ARCHITECT EDITION</span>
          {shared && (
            <Button
              className="tera-print-button"
              variant="ghost"
              onClick={() => window.print()}
            >
              <ArrowDownToLine size={15} /> Print / save PDF
            </Button>
          )}
        </header>
        <div className="proposal-cover">
          <div className="proposal-kicker">
            A CONSIDERED PROJECT
            <span>
              {project.id}
              {shared ? ` · REV ${shared.revision}` : ''}
            </span>
          </div>
          <div className="proposal-cover-title">
            <h1>{project.name}</h1>
            <p>
              From the whole
              <br />
              to the smallest detail.
            </p>
          </div>
          <div className="proposal-cover-meta">
            <span>{project.location || 'Location to confirm'}</span>
            <span>Prepared for {project.client}</span>
            <span>{shared ? shared.status : 'Proposal in preparation'}</span>
          </div>
        </div>
        {!shared || !scope || !estimate ? (
          <div className="proposal-awaiting">
            <Layers />
            <h2>A plan made for this project.</h2>
            <p>
              Select disciplines, prepare the brief and estimate, then publish a
              client revision.
            </p>
            {mode === 'preview' && (
              <Button onClick={onScope}>Prepare proposal</Button>
            )}
          </div>
        ) : (
          <div className="tera-client-content">
            <div className="tera-client-disciplines">
              {scope.enabled.map((id) => (
                <span key={id}>{definitions[id].name}</span>
              ))}
            </div>
            <InvestmentSummary
              scope={scope}
              rows={shared.rows}
              planning={shared.planning}
            />
            <section className="tera-client-section">
              <span className="eyebrow">01 / DELIVERY & OUTCOMES</span>
              <h2>A shared path forward.</h2>
              <DeliverySummary scope={scope} />
              <p className="tera-note">
                The plan describes the work and intended outcomes. Costs and
                lead times are project estimates; no property appreciation,
                return on investment, or legal development capacity is inferred.
              </p>
            </section>
            {scope.enabled.includes('land') && shared.image && (
              <section className="tera-client-section">
                <span className="eyebrow">THE LAND / PLANNING REFERENCE</span>
                <h2>The setting for the work.</h2>
                <div className="tera-client-map">
                  <LandMap
                    fit="contain"
                    features={shared.features.filter((f) => f.included)}
                    selected=""
                    onSelect={() => {}}
                    boundary
                    planting
                    scale={shared.scale}
                    spacing={shared.spacing}
                    image={aligned ? source!.imageryUrl : shared.image}
                    imageHeight={shared.imageHeight}
                    interactive={false}
                    revision={shared.revision}
                    parcelRings={
                      aligned
                        ? source!.parcel.rings.map((r) =>
                            r.map((p) => pixelPoint(p, source!.bounds)),
                          )
                        : undefined
                    }
                    imageLabel={
                      source
                        ? 'Public GIS · concept work areas'
                        : 'Supplied image · field verification required'
                    }
                  />
                </div>
                <p className="tera-note">
                  {source
                    ? `Public GIS retrieved ${new Date(source.retrievedAt).toLocaleDateString()}. ${source.jurisdiction}. `
                    : ''}
                  Confirm boundaries, levels, services, setbacks and permissions
                  with the appropriate surveyor, designer and authority. This is
                  a concept scope, not a construction drawing.
                </p>
              </section>
            )}
            {scope.enabled.map((id, i) => {
              const s = scope.sections[id],
                def = definitions[id],
                disciplineRows = shared.rows.filter((r) => r.discipline === id);
              return (
                <section key={id} className="tera-client-section">
                  <span className="eyebrow">
                    {String(i + 2).padStart(2, '0')} / SCOPE OF WORK
                  </span>
                  <h2>{def.name}</h2>
                  <p className="tera-note">{def.intro}</p>
                  <Specs fields={def.fields} values={s.brief} />
                  {!!s.entries.length && (
                    <>
                      <h3>{def.entryName} schedule</h3>
                      {s.entries.map((entry, n) => (
                        <div key={entry.id} className="tera-client-entry">
                          <h4>
                            {String(
                              entry.values.name || `${def.entryName} ${n + 1}`,
                            )}
                          </h4>
                          <Specs
                            fields={def.entryFields.filter(
                              (f) => f.key !== 'name',
                            )}
                            values={entry.values}
                          />
                        </div>
                      ))}
                    </>
                  )}
                  <h3>Included services & deliverables</h3>
                  {s.stages
                    .filter((stage) => stage.included)
                    .map((stage) => (
                      <div className="tera-client-stage" key={stage.name}>
                        <b>{stage.name}</b>
                        <span>
                          {stage.status.replaceAll('_', ' ')}
                          {stage.owner ? ` · ${stage.owner}` : ''}
                        </span>
                      </div>
                    ))}
                  <h3>Estimate</h3>
                  {disciplineRows.map((row) => (
                    <div className="tera-client-cost" key={row.id}>
                      <div>
                        {row.name.replace(`${def.short} · `, '')}
                        <small>
                          {row.quantity.toLocaleString()} {row.unit} ×{' '}
                          {money(row.rate)} · {row.description}
                        </small>
                      </div>
                      <strong>{money(row.total)}</strong>
                    </div>
                  ))}
                  {!!s.costs.filter((c) => !c.included).length && (
                    <p className="tera-note">
                      Excluded estimate lines:{' '}
                      {s.costs
                        .filter((c) => !c.included)
                        .map((c) => c.name)
                        .join('; ')}
                      .
                    </p>
                  )}
                  {s.exclusions && (
                    <>
                      <h3>Assumptions, exclusions & responsibilities</h3>
                      <p
                        style={{
                          whiteSpace: 'pre-wrap',
                          fontSize: 13,
                          lineHeight: 1.7,
                        }}
                      >
                        {s.exclusions}
                      </p>
                    </>
                  )}
                </section>
              );
            })}
            {shared.rows.some(
              (r) => !r.discipline && !r.id.startsWith('design:'),
            ) && (
              <section className="tera-client-section">
                <h2>Common work packages</h2>
                {shared.rows
                  .filter((r) => !r.discipline && !r.id.startsWith('design:'))
                  .map((r) => (
                    <div className="tera-client-cost" key={r.id}>
                      <div>
                        {r.name}
                        <small>
                          {r.description} · {r.quantity} {r.unit} ×{' '}
                          {money(r.rate)}
                        </small>
                      </div>
                      <b>{money(r.total)}</b>
                    </div>
                  ))}
              </section>
            )}
            <section className="tera-client-section">
              <span className="eyebrow">DRAWINGS / RENDERS / REFERENCES</span>
              <h2>The visual brief.</h2>
              {shared.documents?.length ? (
                <div className="tera-client-documents">
                  {shared.documents.map((file) => (
                    <a
                      className="tera-client-document"
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {file.mime.startsWith('image/') && (
                        <img src={file.url} alt={file.name} loading="lazy" />
                      )}
                      <span>{file.name} ↗</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="tera-note">
                  Drawings, renders and material references have not been
                  attached to this revision.
                </p>
              )}
            </section>
            {!!job.activity.length && (
              <section className="tera-client-section">
                <h2>Project updates</h2>
                {job.activity.map((text, i) => (
                  <p className="tera-comment" key={i}>
                    {text}
                  </p>
                ))}
              </section>
            )}
            <section className="tera-client-response">
              <span className="eyebrow">
                YOUR NEXT STEP / REVISION {shared.revision}
              </span>
              <h2>
                {shared.status === 'Approved'
                  ? 'A shared direction.'
                  : 'Review the scope together.'}
              </h2>
              <p>
                This revision includes{' '}
                {scope.enabled
                  .map((id) => definitions[id].short.toLowerCase())
                  .join(', ')}{' '}
                at {money(estimate.total)}, including the entered tax and
                contingency.{' '}
                {estimate.gap > 0
                  ? `It is ${money(estimate.gap)} above the stated client budget.`
                  : ''}
              </p>
              <p>
                Proposal acceptance records agreement with this scope. It does
                not approve permit documents, shop drawings, construction safety
                or fabrication release.
              </p>
              <div className="tera-response-actions">
                <Button
                  disabled={!canRespond || busy || shared.status === 'Approved'}
                  onClick={onApprove}
                >
                  <Check size={15} />
                  {shared.status === 'Approved'
                    ? 'Approved'
                    : 'Approve this scope'}
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !canRespond || busy || shared.status === 'Changes requested'
                  }
                  onClick={onRequest}
                >
                  Request changes
                </Button>
              </div>
              {!canRespond && (
                <p>
                  {mode === 'preview'
                    ? 'Clients respond through their secure project link.'
                    : 'Sign in as an invited client to respond.'}
                </p>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  setError('');
                  try {
                    await onComment(comment.trim());
                    setComment('');
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                <label className="tera-field">
                  Message for the project team
                  <Textarea
                    maxLength={6000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="A question, detail or requested change…"
                    disabled={!canRespond || busy}
                  />
                </label>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!canRespond || busy || !comment.trim()}
                >
                  Add comment
                </Button>
                {error && <p role="alert">{error}</p>}
              </form>
              {job.comments.map((c, i) => (
                <div key={i} className="tera-comment">
                  <b>
                    {c.author} · revision {c.revision}
                  </b>
                  <p>{c.text}</p>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
