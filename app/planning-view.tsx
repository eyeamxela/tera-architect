'use client';
import { useState } from 'react';
import {
  InvestmentChart,
  ConceptDrawing,
  ClientInvestment,
} from './plan-presentation';
import { ArrowUpRight, Sprout, Waves, Route, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { Job, Project } from './data';
import { scopeRows, money } from './data';
import { calculatePlan, planPresets, type Planning } from './plan-model';

export default function PlanningView({
  job,
  project,
  onChange,
  onMap,
  onShare,
}: {
  job: Job;
  project: Project;
  onChange: (p: Planning) => void;
  onMap: () => void;
  onShare: () => void;
}) {
  const [year, setYear] = useState(5);
  const p = job.planning;
  const rows = scopeRows(job.features, job.scale, job.spacing, job.items);
  const plan = calculatePlan(rows, job.features, p);
  const outcome = plan.atYear(year);
  const update = (patch: Partial<Planning>) => onChange({ ...p, ...patch });
  if (project.template === 'general')
    return (
      <section className="planning-view">
        <div className="planning-title">
          <div>
            <span className="eyebrow">PROJECT PLANNING</span>
            <h2>A clear path from scope to delivery.</h2>
            <p>
              Adjust the budget and schedule to see which work packages fit.
            </p>
          </div>
          <Button onClick={onShare} disabled={!rows.length}>
            Review & share
          </Button>
        </div>
        <div className="build-planning-inputs">
          <label>
            Installation budget (USD)
            <Input
              type="number"
              min="0"
              max="10000000"
              value={p.budget}
              onChange={(e) =>
                update({
                  budget: Math.max(
                    0,
                    Math.min(10000000, Number(e.target.value)),
                  ),
                })
              }
            />
          </label>
          <label>
            Delivery window (months)
            <Input
              type="number"
              min="1"
              max="60"
              value={p.months}
              onChange={(e) =>
                update({
                  months: Math.max(1, Math.min(60, Number(e.target.value))),
                })
              }
            />
          </label>
          <label>
            Contingency (%)
            <Input
              type="number"
              min="0"
              max="100"
              value={p.contingency}
              onChange={(e) =>
                update({
                  contingency: Math.max(
                    0,
                    Math.min(100, Number(e.target.value)),
                  ),
                })
              }
            />
          </label>
        </div>
        {rows.length ? (
          <ClientInvestment
            project={project}
            shared={{
              ...job,
              rows,
              total: rows.reduce((s, r) => s + r.total, 0),
              status: 'Awaiting review',
            }}
          />
        ) : (
          <div className="empty-state">
            <h2>Start with the scope.</h2>
            <p>
              Add work packages with quantities and rates to compare a plan.
            </p>
            <Button onClick={onMap}>Add work packages</Button>
          </div>
        )}
      </section>
    );
  if (!rows.length)
    return (
      <section className="planning-view">
        <div className="empty-state">
          <Sprout />
          <h2>Your plan starts with the property</h2>
          <p>
            Add work areas and confirm the image scale before comparing
            investment scenarios.
          </p>
          <Button onClick={onMap}>Open property workspace</Button>
        </div>
      </section>
    );
  return (
    <section className="planning-view">
      <div className="planning-title">
        <div>
          <span className="eyebrow">PROJECT PLANNING</span>
          <h2>A plan that grows with the property.</h2>
          <p>
            Compare the investment, sequence the work, and see what’s in place
            over time.
          </p>
        </div>
        <Button
          className="primary-action"
          onClick={onShare}
          disabled={!rows.length}
        >
          <Send size={15} /> Review client plan
        </Button>
      </div>
      <div className="planning-grid">
        <aside className="planning-controls">
          <div className="section-label">01 / SET THE PARAMETERS</div>
          <label className="planning-input">
            <span>
              Installation budget <small>Includes contingency</small>
            </span>
            <Input
              aria-label="Installation budget"
              type="number"
              min={0}
              max={10000000}
              step={500}
              value={p.budget}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 0 && n <= 1e7) update({ budget: n });
              }}
            />
          </label>
          <Slider
            aria-label="Installation budget slider"
            min={0}
            max={Math.max(75000, p.budget)}
            step={500}
            value={[p.budget]}
            onValueChange={(v) =>
              update({ budget: Array.isArray(v) ? v[0] : v })
            }
          />
          <label className="planning-input">
            <span>
              Installation window <small>From project start</small>
            </span>
            <b>{p.months} months</b>
          </label>
          <Slider
            aria-label="Installation window in months"
            min={6}
            max={60}
            step={6}
            value={[p.months]}
            onValueChange={(v) =>
              update({ months: Array.isArray(v) ? v[0] : v })
            }
          />
          <label className="planning-input">
            <span>Start with</span>
            <Select
              value={p.priority}
              onValueChange={(v) =>
                update({ priority: v as Planning['priority'] })
              }
            >
              <SelectTrigger aria-label="Work priority">
                <SelectValue>
                  {
                    {
                      water: 'Water & pond',
                      planting: 'Tree planting',
                      access: 'Site access',
                    }[p.priority]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="water">Water & pond</SelectItem>
                <SelectItem value="planting">Tree planting</SelectItem>
                <SelectItem value="access">Site access</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="planning-small-inputs">
            <label>
              Contingency %
              <Input
                aria-label="Contingency percent"
                type="number"
                min={0}
                max={100}
                value={p.contingency}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 0 && n <= 100) update({ contingency: n });
                }}
              />
            </label>
            <label>
              Care / tree / year
              <Input
                aria-label="Annual care per tree"
                type="number"
                min={0}
                max={10000}
                value={p.carePerTree}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 0 && n <= 10000) update({ carePerTree: n });
                }}
              />
            </label>
          </div>
          <p className="planning-note">
            Sample cost assumptions. Care is an additional allowance, beginning
            after planting. Rates can be changed in Scope of work.
          </p>
          <div className="budget-breakdown">
            <div>
              <span>Funded installation</span>
              <b>{money(plan.install)}</b>
            </div>
            <div>
              <span>Contingency held</span>
              <b>{money(plan.reserve)}</b>
            </div>
            <div>
              <span>Unallocated budget</span>
              <b>{money(plan.remaining)}</b>
            </div>
          </div>
          <Button variant="outline" className="wide" onClick={onMap}>
            Edit the property plan <ArrowUpRight size={15} />
          </Button>
        </aside>
        <div className="planning-results">
          <div className="investment-stats">
            <div>
              <span>INSTALLATION + RESERVE</span>
              <strong>{money(plan.allowance)}</strong>
              <small>
                {plan.funded.length} of {plan.phases.length} work areas funded
              </small>
            </div>
            <div>
              <span>5-YEAR CARE ALLOWANCE</span>
              <strong>{money(plan.atYear(5).care)}</strong>
              <small>Additional to installation budget</small>
            </div>
            <div>
              <span>TOTAL 5-YEAR ALLOWANCE</span>
              <strong>{money(plan.atYear(5).total)}</strong>
              <small>At today’s sample rates</small>
            </div>
          </div>
          <div className="planning-panel">
            <div className="planning-panel-title">
              <div>
                <span className="eyebrow">02 / THE SEQUENCE</span>
                <h3>From a concept to a living landscape</h3>
              </div>
              <span className={`status ${plan.shortfall ? 'amber' : 'mint'}`}>
                {plan.shortfall
                  ? `${money(plan.shortfall)} more for full scope`
                  : 'Full scope fits'}
              </span>
            </div>
            {!rows.length ? (
              <p className="planning-note">
                Draw work areas and set the image scale to start planning.
              </p>
            ) : (
              <div className="phase-list">
                {plan.phases.map((phase) => (
                  <div
                    className={`plan-phase ${!phase.funded ? 'deferred' : ''}`}
                    key={phase.id}
                  >
                    <span className="phase-number">0{phase.number}</span>
                    <div>
                      <b>{phase.name}</b>
                      <p>
                        {phase.quantity.toLocaleString()} {phase.unit} ·{' '}
                        {phase.funded
                          ? `Complete by month ${phase.month}`
                          : 'Awaiting future funding'}
                      </p>
                    </div>
                    <span>
                      <b>{money(phase.allowance)}</b>
                      <small>
                        {phase.funded ? 'Includes reserve' : 'Deferred'}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="planning-note">
              Whole work areas are funded in priority order. Later phases stay
              deferred when the next phase exceeds the budget. Timing is evenly
              spaced across the chosen window; the project team confirms
              dependencies and field dates.
            </p>
          </div>
          <div className="planning-panel">
            <div className="planning-panel-title">
              <div>
                <span className="eyebrow">03 / SEE IT OVER TIME</span>
                <h3>Your property at year {year}</h3>
              </div>
              <div className="year-selector" aria-label="Outcome year">
                {[1, 2, 3, 4, 5].map((y) => (
                  <Button
                    key={y}
                    variant={y === year ? 'default' : 'ghost'}
                    aria-pressed={y === year}
                    onClick={() => setYear(y)}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </div>
            <div className="outcome-grid">
              <div>
                <Sprout />
                <strong>{outcome.trees}</strong>
                <b>Trees planted</b>
                <small>
                  {outcome.trees
                    ? `${outcome.oldestTrees.toFixed(1)} years since earliest planting`
                    : 'Planting not yet delivered'}
                </small>
              </div>
              <div>
                <Waves />
                <strong>
                  {outcome.pond.toLocaleString()} <em>ft</em>
                </strong>
                <b>Pond edge restored</b>
                <small>Planned shoreline work</small>
              </div>
              <div>
                <Route />
                <strong>
                  {outcome.path.toLocaleString()} <em>ft</em>
                </strong>
                <b>Access installed</b>
                <small>Planned path length</small>
              </div>
            </div>
            <InvestmentChart plan={plan} />
            <p className="planning-note">
              These are scheduled quantities and time since planting, not
              guaranteed ecological performance, yield, or financial return.
            </p>
          </div>
        </div>
      </div>
      <div className="scenario-heading">
        <div>
          <span className="eyebrow">COMPARE THE POSSIBILITIES</span>
          <h3>Same property. Different ways forward.</h3>
        </div>
        <p>
          Each option uses your current scope, rates, priority, and care
          assumptions.
        </p>
      </div>
      <div className="scenario-grid">
        {planPresets.map((preset) => {
          const candidate = calculatePlan(rows, job.features, {
            ...p,
            ...preset,
          });
          const fifth = candidate.atYear(5);
          return (
            <article className="scenario-card" key={preset.name}>
              <h3>{preset.name}</h3>
              <p>{preset.description}</p>
              <strong>
                {money(preset.budget)}{' '}
                <small>budget · {preset.months} months</small>
              </strong>
              <dl>
                <div>
                  <dt>Funded work areas</dt>
                  <dd>
                    {candidate.funded.length} / {candidate.phases.length}
                  </dd>
                </div>
                <div>
                  <dt>Year 5 total allowance</dt>
                  <dd>{money(fifth.total)}</dd>
                </div>
                <div>
                  <dt>Trees at year 5</dt>
                  <dd>{fifth.trees}</dd>
                </div>
                <div>
                  <dt>Years since first planting</dt>
                  <dd>{fifth.trees ? fifth.oldestTrees.toFixed(1) : '—'}</dd>
                </div>
              </dl>
              <Button
                variant="outline"
                className="wide"
                onClick={() =>
                  update({ budget: preset.budget, months: preset.months })
                }
              >
                Use this starting point <ArrowUpRight size={14} />
              </Button>
            </article>
          );
        })}
      </div>
      <ConceptDrawing
        project={project}
        features={job.features}
        scale={job.scale}
        spacing={job.spacing}
        imageHeight={job.imageHeight}
        revision={job.revision}
        site={job.site}
        plan={plan}
      />
      <p className="planning-note">
        Concept planning for {project.name} ·{' '}
        {job.site
          ? 'Sourced county parcel; legal buildable area unverified.'
          : 'Fictional demonstration property.'}
        Tax, permits, excavation, irrigation, ongoing pond/path maintenance,
        inflation, and replacements are excluded unless added to the scope.
      </p>
    </section>
  );
}
