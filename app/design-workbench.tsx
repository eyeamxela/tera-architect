'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Plus,
  X,
  Layers,
  Map,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  definitions,
  disciplineIds,
  presets,
  toggleDiscipline,
  applyDesignPreset,
  designPresetId,
  designInvestment,
  designIssues,
  costTotal,
  type Discipline,
  type DesignScope,
  type DesignSection,
  type Field,
  type Values,
} from './design-model';
import { scopeRows, money, type Job, type Project } from './data';
import type { Planning } from './plan-model';

export function TemplateSelect({
  value,
  onChange,
  label = 'Starting template',
  hint = 'You can combine disciplines inside the project.',
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <label className="tera-field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {value === 'custom' && (
          <option value="custom" disabled>
            Custom combination
          </option>
        )}
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {hint && <small>{hint}</small>}
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  max = 1_000_000,
  step = 'any',
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
  step?: string;
}) {
  return (
    <label className="tera-field">
      {label}
      <input
        type="number"
        min="0"
        max={max}
        step={step}
        placeholder="To confirm"
        value={value ?? ''}
        onChange={(e) => {
          const n = e.target.value === '' ? null : Number(e.target.value);
          if (
            n === null ||
            (Number.isFinite(n) &&
              n >= 0 &&
              n <= max &&
              (step !== '1' || Number.isInteger(n)))
          )
            onChange(n);
        }}
      />
    </label>
  );
}
function Fields({
  fields,
  values,
  onChange,
}: {
  fields: Field[];
  values: Values;
  onChange: (v: Values) => void;
}) {
  return (
    <div className="tera-fields">
      {fields.map((field) => (
        <div
          key={field.key}
          className={field.type === 'long' ? 'tera-wide' : ''}
        >
          {field.type === 'number' ? (
            <NumberField
              label={`${field.label}${field.unit ? ` (${field.unit})` : ''}`}
              value={
                typeof values[field.key] === 'number'
                  ? (values[field.key] as number)
                  : null
              }
              onChange={(v) => onChange({ ...values, [field.key]: v })}
            />
          ) : (
            <label className="tera-field">
              {field.label}
              {field.type === 'long' ? (
                <textarea
                  rows={3}
                  maxLength={6000}
                  value={values[field.key] ?? ''}
                  onChange={(e) =>
                    onChange({ ...values, [field.key]: e.target.value })
                  }
                />
              ) : (
                <input
                  maxLength={6000}
                  value={values[field.key] ?? ''}
                  onChange={(e) =>
                    onChange({ ...values, [field.key]: e.target.value })
                  }
                />
              )}
              {field.hint && <small>{field.hint}</small>}
            </label>
          )}
        </div>
      ))}
    </div>
  );
}
export function InvestmentSummary({
  scope,
  rows,
  planning,
}: {
  scope: DesignScope;
  rows: ReturnType<typeof scopeRows>;
  planning: Planning;
}) {
  const p = designInvestment(
    scope,
    rows,
    planning.contingency,
    planning.budget,
  );
  const max = Math.max(1, p.subtotal);
  return (
    <div className="tera-investment-summary">
      <div className="tera-stat-grid">
        <div>
          <small>
            {p.missing.length ? 'PRICED PORTION' : 'PROJECT INVESTMENT'}
          </small>
          <strong>{money(p.total)}</strong>
          <span>
            {p.missing.length
              ? `${p.missing.length} unpriced ${p.missing.length === 1 ? 'line' : 'lines'} still open`
              : 'Scope + entered tax + contingency'}
          </span>
        </div>
        <div>
          <small>CLIENT BUDGET</small>
          <strong>{money(planning.budget)}</strong>
          <span>
            {p.gap
              ? `${money(p.gap)} above budget`
              : `${money(p.remaining)} remaining${p.missing.length ? ' before open costs' : ''}`}
          </span>
        </div>
        <div>
          <small>PLANNED COMPLETION</small>
          <strong>
            {p.finishWeek === null ? 'To confirm' : `Week ${p.finishWeek}`}
          </strong>
          <span>From project kickoff · overlapping work allowed</span>
        </div>
      </div>
      <div className="tera-investment-grid">
        <div className="tera-breakdown">
          {p.byDiscipline.map(({ id, total }) => (
            <div key={id}>
              <div>
                <span>{definitions[id].name}</span>
                <b>{money(total)}</b>
              </div>
              <div className="tera-meter">
                <i style={{ width: `${(total / max) * 100}%` }} />
              </div>
            </div>
          ))}
          {p.common !== 0 && (
            <div>
              <span>Common work packages</span>
              <b>{money(p.common)}</b>
            </div>
          )}
        </div>
        <dl className="tera-totals">
          <div>
            <dt>Priced scope</dt>
            <dd>{money(p.subtotal)}</dd>
          </div>
          <div>
            <dt>Tax · marked lines only ({scope.taxPercent}%)</dt>
            <dd>{money(p.tax)}</dd>
          </div>
          <div>
            <dt>Contingency · scope only ({planning.contingency}%)</dt>
            <dd>{money(p.reserve)}</dd>
          </div>
          <div className="tera-total">
            <dt>
              {p.missing.length ? 'Known investment' : 'Total investment'}
            </dt>
            <dd>{money(p.total)}</dd>
          </div>
        </dl>
      </div>
      <p className="tera-note">
        USD. Rates and taxable items are entered by the project team.
        Contingency is applied once to the priced scope, before tax. Common and
        mapped land work is tax-inclusive. A budget gap remains visible; work is
        only removed when explicitly excluded.
      </p>
    </div>
  );
}
export function DeliverySummary({ scope }: { scope: DesignScope }) {
  const p = designInvestment(scope, [], 0, 0),
    horizon = Math.max(1, ...p.schedule.map((s) => s.end ?? 0));
  return (
    <div className="tera-timeline">
      {p.schedule.map((s) => (
        <div key={s.id} className="tera-timeline-row">
          <div>
            <b>{definitions[s.id].short}</b>
            <span>
              {s.end === null
                ? 'Timing to confirm'
                : `Week ${s.start}–${s.end} · work begins ${s.workStart}`}
            </span>
          </div>
          <div className="tera-track">
            {s.end !== null && (
              <i
                style={{
                  marginLeft: `${(s.start! / horizon) * 100}%`,
                  width: `${Math.max(0.5, ((s.end - s.start!) / horizon) * 100)}%`,
                  maxWidth: `${100 - (s.start! / horizon) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      ))}
      <p className="tera-note">
        Each dependency finishes before the next discipline’s lead time begins.
        Weeks are relative planning allowances, not booked dates. Stage status
        is recorded by the team.
      </p>
    </div>
  );
}
export default function DesignWorkbench({
  job,
  project,
  onChange,
  onDesignChange,
  onMap,
  onShare,
}: {
  job: Job;
  project: Project;
  onChange: (p: Planning) => void;
  onDesignChange: (s: DesignScope) => void;
  onMap: () => void;
  onShare: () => void;
}) {
  const scope = job.designScope!;
  const [tab, setTab] = useState('brief');
  const [selected, setSelected] = useState<Discipline>(scope.enabled[0]);
  const id = scope.enabled.includes(selected) ? selected : scope.enabled[0],
    def = definitions[id],
    section = scope.sections[id];
  const rows = scopeRows(
      job.features,
      job.scale,
      job.spacing,
      job.items,
      scope,
    ),
    issues = designIssues(scope);
  const setSection = (patch: Partial<DesignSection>) =>
    onDesignChange({
      ...scope,
      sections: { ...scope.sections, [id]: { ...section, ...patch } },
    });
  const cost = (
    index: number,
    patch: Partial<DesignSection['costs'][number]>,
  ) =>
    setSection({
      costs: section.costs.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      ),
    });
  const stage = (
    index: number,
    patch: Partial<DesignSection['stages'][number]>,
  ) =>
    setSection({
      stages: section.stages.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  return (
    <section className="tera-design">
      <header className="planning-title tera-planning-title">
        <div>
          <span className="eyebrow">PROJECT PLANNING</span>
          <h2>A clear path from scope to delivery.</h2>
          <p>Adjust the scope, budget, and schedule for {project.name}.</p>
        </div>
        <Button onClick={onShare}>
          Review client plan <ArrowUpRight size={16} />
        </Button>
      </header>
      <div className="tera-template-toolbar">
        <TemplateSelect
          label="Project template"
          value={designPresetId(scope)}
          onChange={(preset) =>
            onDesignChange(applyDesignPreset(scope, preset))
          }
          hint="Switch templates here, or add and remove scopes below. Your project details stay saved."
        />
      </div>
      <div className="tera-discipline-picker" aria-label="Included disciplines">
        {disciplineIds.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={scope.enabled.includes(d)}
            disabled={scope.enabled.length === 1 && scope.enabled[0] === d}
            onClick={() => onDesignChange(toggleDiscipline(scope, d))}
          >
            <span>
              {scope.enabled.includes(d) ? (
                <Check size={14} />
              ) : (
                <Plus size={14} />
              )}
            </span>
            {definitions[d].name}
          </button>
        ))}
      </div>
      <p className="tera-note">
        Select one discipline or combine them. Deselected work stays saved and
        is excluded from this proposal.
      </p>
      <InvestmentSummary scope={scope} rows={rows} planning={job.planning} />
      <nav className="tera-view-tabs" aria-label="Plan views">
        {[
          ['brief', '01 / Scope & specifications'],
          ['investment', '02 / Investment'],
          ['delivery', '03 / Delivery'],
        ].map(([key, title]) => (
          <button
            type="button"
            key={key}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === 'investment' && (
        <div className="tera-panel">
          <div className="tera-panel-heading">
            <h3>The project allowance</h3>
            <p>Test the budget before committing to the work.</p>
          </div>
          <div className="tera-fields">
            <NumberField
              label="Client budget (USD)"
              value={job.planning.budget}
              max={10_000_000}
              onChange={(v) => onChange({ ...job.planning, budget: v ?? 0 })}
            />
            <NumberField
              label="Contingency (%)"
              value={job.planning.contingency}
              max={100}
              onChange={(v) =>
                onChange({ ...job.planning, contingency: v ?? 0 })
              }
            />
            <NumberField
              label="Tax on marked estimate lines (%)"
              value={scope.taxPercent}
              max={100}
              onChange={(v) => onDesignChange({ ...scope, taxPercent: v ?? 0 })}
            />
          </div>
        </div>
      )}
      {tab === 'delivery' && (
        <div className="tera-panel">
          <h3>A connected delivery plan</h3>
          <DeliverySummary scope={scope} />
        </div>
      )}
      <div className="tera-workbench-grid">
        <aside className="tera-module-nav">
          {scope.enabled.map((d) => (
            <button
              key={d}
              type="button"
              aria-current={id === d ? 'page' : undefined}
              onClick={() => setSelected(d)}
            >
              <span>{definitions[d].name}</span>
              <ArrowRight size={14} />
            </button>
          ))}
          <small>
            Separate briefs.
            <br />
            One client plan.
          </small>
          {scope.enabled.includes('land') && (
            <Button variant="outline" onClick={onMap}>
              <Map size={14} /> Property workspace
            </Button>
          )}
        </aside>
        <div className="tera-module-body">
          <div className="tera-panel-heading">
            <span className="eyebrow">
              {tab === 'brief'
                ? 'THE BRIEF'
                : tab === 'investment'
                  ? 'THE ESTIMATE'
                  : 'THE DELIVERY'}{' '}
              / {def.short.toUpperCase()}
            </span>
            <h3>{def.name}</h3>
            <p>{def.intro}</p>
          </div>
          {tab === 'brief' && (
            <>
              <Fields
                fields={def.fields}
                values={section.brief}
                onChange={(brief) => setSection({ brief })}
              />
              <div className="tera-section-divider">
                <div>
                  <h4>{def.entryName} schedule</h4>
                  <p>
                    Specifications describe the work. Enter its pricing
                    separately in Investment.
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={section.entries.length >= 100}
                  onClick={() =>
                    setSection({
                      entries: [
                        ...section.entries,
                        { id: crypto.randomUUID(), values: {} },
                      ],
                    })
                  }
                >
                  <Plus size={14} /> Add {def.entryName.toLowerCase()}
                </Button>
              </div>
              {!section.entries.length && (
                <div className="tera-empty">
                  <Layers size={22} />
                  <p>No {def.entryName.toLowerCase()}s added yet.</p>
                </div>
              )}
              {section.entries.map((entry, i) => (
                <details className="tera-entry" key={entry.id} open>
                  <summary>
                    {String(entry.values.name || `${def.entryName} ${i + 1}`)}
                  </summary>
                  <Fields
                    fields={def.entryFields}
                    values={entry.values}
                    onChange={(values) =>
                      setSection({
                        entries: section.entries.map((e) =>
                          e.id === entry.id ? { ...e, values } : e,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setSection({
                        entries: section.entries.filter(
                          (e) => e.id !== entry.id,
                        ),
                      })
                    }
                  >
                    Remove {def.entryName.toLowerCase()}
                  </Button>
                </details>
              ))}
              <label className="tera-field tera-exclusions">
                Exclusions, assumptions & responsibilities
                <textarea
                  rows={3}
                  maxLength={6000}
                  placeholder="Clarify who owns each scope and what is outside this proposal."
                  value={section.exclusions}
                  onChange={(e) => setSection({ exclusions: e.target.value })}
                />
              </label>
            </>
          )}
          {tab === 'investment' && (
            <>
              <p className="tera-note">
                Start with these editable allowances, add quantity × rate lines,
                or exclude work. An empty rate is unpriced; an explicit zero
                means no charge. Mapped land items and common work packages are
                included separately—do not repeat them here.
              </p>
              {section.costs.map((c, i) => (
                <article
                  key={c.id}
                  className={`tera-cost ${c.included ? '' : 'tera-excluded'}`}
                >
                  <div className="tera-cost-heading">
                    <label>
                      <input
                        type="checkbox"
                        checked={c.included}
                        onChange={(e) =>
                          cost(i, { included: e.target.checked })
                        }
                      />{' '}
                      Include
                    </label>
                    <strong>
                      {costTotal(c) === null
                        ? 'Unpriced'
                        : money(costTotal(c)!)}
                    </strong>
                    <button
                      type="button"
                      aria-label={`Remove ${c.name}`}
                      onClick={() =>
                        setSection({
                          costs: section.costs.filter((_, n) => n !== i),
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <label className="tera-field">
                    Work package
                    <input
                      maxLength={200}
                      value={c.name}
                      onChange={(e) => cost(i, { name: e.target.value })}
                    />
                  </label>
                  <div className="tera-cost-grid">
                    <NumberField
                      label="Quantity"
                      value={c.quantity}
                      onChange={(v) => cost(i, { quantity: v })}
                    />
                    <label className="tera-field">
                      Unit
                      <input
                        maxLength={30}
                        value={c.unit}
                        onChange={(e) => cost(i, { unit: e.target.value })}
                      />
                    </label>
                    <NumberField
                      label="Unit rate (USD)"
                      max={10_000_000}
                      value={c.rate}
                      onChange={(v) => cost(i, { rate: v })}
                    />
                    <label className="tera-field">
                      Price basis
                      <select
                        value={c.basis}
                        onChange={(e) =>
                          cost(i, { basis: e.target.value as typeof c.basis })
                        }
                      >
                        <option value="allowance">Allowance</option>
                        <option value="quote">Supplier quote</option>
                        <option value="actual">Actual cost</option>
                      </select>
                    </label>
                  </div>
                  <div className="tera-cost-footer">
                    <label className="tera-field">
                      Quote / invoice reference, scope notes
                      <input
                        maxLength={6000}
                        value={c.reference}
                        onChange={(e) => cost(i, { reference: e.target.value })}
                      />
                    </label>
                    <label className="tera-check">
                      <input
                        type="checkbox"
                        checked={c.taxable}
                        onChange={(e) => cost(i, { taxable: e.target.checked })}
                      />{' '}
                      Apply entered tax
                    </label>
                  </div>
                </article>
              ))}
              <Button
                variant="outline"
                disabled={section.costs.length >= 100}
                onClick={() =>
                  setSection({
                    costs: [
                      ...section.costs,
                      {
                        id: crypto.randomUUID(),
                        name: 'New work package',
                        quantity: null,
                        unit: 'each',
                        rate: null,
                        included: true,
                        basis: 'allowance',
                        taxable: false,
                        reference: '',
                      },
                    ],
                  })
                }
              >
                <Plus size={14} /> Add estimate line
              </Button>
            </>
          )}
          {tab === 'delivery' && (
            <>
              <div className="tera-fields">
                <NumberField
                  label="Earliest start (week from kickoff)"
                  step="1"
                  max={520}
                  value={section.startWeek}
                  onChange={(v) => setSection({ startWeek: v })}
                />
                <NumberField
                  label="Procurement / approval lead time (weeks)"
                  step="1"
                  max={520}
                  value={section.leadWeeks}
                  onChange={(v) => setSection({ leadWeeks: v })}
                />
                <NumberField
                  label="Work duration after lead time (weeks)"
                  step="1"
                  max={520}
                  value={section.durationWeeks}
                  onChange={(v) => setSection({ durationWeeks: v })}
                />
              </div>
              <fieldset className="tera-dependencies">
                <legend>Begins after these disciplines finish</legend>
                {disciplineIds
                  .filter((d) => d !== id)
                  .map((d) => (
                    <label key={d}>
                      <input
                        type="checkbox"
                        checked={section.dependsOn.includes(d)}
                        onChange={(e) =>
                          setSection({
                            dependsOn: e.target.checked
                              ? [...section.dependsOn, d]
                              : section.dependsOn.filter((x) => x !== d),
                          })
                        }
                      />
                      {definitions[d].short}
                      {!scope.enabled.includes(d) && ' (not selected)'}
                    </label>
                  ))}
              </fieldset>
              <h4>Deliverables & review gates</h4>
              <p className="tera-note">
                Adjust the included services to your agreement. Attach drawings,
                renders, schedules and samples in Files before sharing the
                proposal.
              </p>
              {section.stages.map((s, i) => (
                <div key={s.name} className="tera-stage">
                  <label>
                    <input
                      type="checkbox"
                      checked={s.included}
                      onChange={(e) => stage(i, { included: e.target.checked })}
                    />
                    {s.name}
                  </label>
                  <label className="tera-field">
                    Responsible person
                    <input
                      maxLength={200}
                      value={s.owner}
                      onChange={(e) => stage(i, { owner: e.target.value })}
                    />
                  </label>
                  <label className="tera-field">
                    Recorded status
                    <select
                      value={s.status}
                      onChange={(e) =>
                        stage(i, { status: e.target.value as typeof s.status })
                      }
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In progress</option>
                      <option value="ready">Ready for review</option>
                      <option value="approved">Approval recorded</option>
                    </select>
                  </label>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      {!!issues.length && (
        <details className="tera-readiness">
          <summary>{issues.length} items to resolve before publishing</summary>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
      <footer className="tera-design-footer">
        <span>
          Changes save to this project. Clients see only the published revision.
        </span>
        <Button onClick={onShare}>
          Review & share <ArrowUpRight size={15} />
        </Button>
      </footer>
    </section>
  );
}
export { emptyArchitectDraft } from './design-model';
