'use client';
import { useRef } from 'react';
import { pixelPoint, type SiteAssessment } from './site-data';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  metrics,
  money,
  plantingPoints,
  type Feature,
  type Project,
  type SharedScope,
} from './data';
import { calculatePlan, type PlanResult } from './plan-model';

export function InvestmentChart({ plan }: { plan: PlanResult }) {
  const max = Math.max(1, ...plan.years.map((y) => y.total));
  const x = (year: number) => 55 + year * 138;
  const y = (value: number) => 174 - (value / max) * 138;
  const path = (key: 'install' | 'total') =>
    plan.years
      .map((v, i) => `${i ? 'L' : 'M'} ${x(v.year)} ${y(v[key])}`)
      .join(' ');
  return (
    <div className="investment-chart">
      <div className="chart-header">
        <h4>Cumulative year-end allowances</h4>
        <span>
          <i /> Installation + reserve <i className="care-line" /> Including
          care
        </span>
      </div>
      <svg
        viewBox="0 0 800 218"
        role="img"
        aria-label={`Cumulative allowance at year five: ${money(plan.atYear(5).total)}, including ${money(plan.atYear(5).care)} for tree care.`}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="55"
              y1={y(max * t)}
              x2="745"
              y2={y(max * t)}
              stroke="#c5d0ba"
              strokeDasharray="3 5"
            />
            <text
              x="46"
              y={y(max * t) + 4}
              textAnchor="end"
              fill="#566c4d"
              fontSize="11"
            >
              {money(max * t)}
            </text>
          </g>
        ))}
        <path
          d={path('install')}
          fill="none"
          stroke="#81946e"
          strokeWidth="2"
        />
        <path d={path('total')} fill="none" stroke="#3f6437" strokeWidth="3" />
        {plan.years.map((v) => (
          <g key={v.year}>
            <circle cx={x(v.year)} cy={y(v.total)} r="4" fill="#3f6437" />
            <text
              x={x(v.year)}
              y="202"
              textAnchor="middle"
              fill="#566c4d"
              fontSize="12"
            >
              {v.year ? `Year ${v.year}` : 'Start'}
            </text>
          </g>
        ))}
      </svg>
      <details className="chart-data">
        <summary>View annual allowances</summary>
        <div className="table-scroll">
          <table>
            <caption>
              Cumulative allowances at each year end; installation occurs at
              phase completion.
            </caption>
            <thead>
              <tr>
                <th>Year</th>
                <th>Installation + reserve</th>
                <th>Tree care</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {plan.years.slice(1).map((v) => (
                <tr key={v.year}>
                  <th>{v.year}</th>
                  <td>{money(v.install)}</td>
                  <td>{money(v.care)}</td>
                  <td>{money(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function ConceptDrawing({
  features,
  site,
  scale,
  spacing,
  imageHeight,
  project,
  revision,
  plan,
}: {
  site?: SiteAssessment;
  features: Feature[];
  scale: number;
  spacing: number;
  imageHeight: number;
  project: Project;
  revision: number;
  plan: PlanResult;
}) {
  const drawingRef = useRef<SVGSVGElement>(null);
  const height = Math.max(960, imageHeight + 330);
  const download = () => {
    if (!drawingRef.current) return;
    const blob = new Blob(
      [
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          drawingRef.current.outerHTML,
      ],
      { type: 'image/svg+xml' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}-concept-plan-r${revision}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="concept-section">
      <div className="planning-panel-title">
        <div>
          <span className="eyebrow">THE PLAN, ON PAPER</span>
          <h3>Concept drawing · {project.name}</h3>
        </div>
        <div className="drawing-actions">
          <Button variant="outline" onClick={download}>
            <Download size={14} /> Download drawing
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer size={14} /> Print / PDF
          </Button>
        </div>
      </div>
      <div className="concept-drawing">
        <svg
          ref={drawingRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 1280 ${height}`}
          role="img"
          aria-label="Dimensioned concept drawing with funded and deferred work areas. Not a construction drawing."
        >
          <defs>
            <pattern
              id="drafting-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#bed2d5"
                strokeWidth=".5"
              />
            </pattern>
          </defs>
          <rect width="1280" height={height} fill="#f0f6f4" />
          <rect
            x="20"
            y="20"
            width="1240"
            height={height - 40}
            fill="url(#drafting-grid)"
            stroke="#718f94"
          />
          <g fontFamily="Arial, sans-serif" fill="#1a4650">
            <text x="52" y="69" fontSize="22" fontWeight="bold">
              OJAI PERMACULTURE
            </text>
            <text x="52" y="98" fontSize="15">
              {project.name} · Prepared by Connor
            </text>
            <text x="1228" y="64" textAnchor="end" fontSize="17">
              CONCEPT PLAN / REV {revision}
            </text>
            <text x="1228" y="92" textAnchor="end" fontSize="14">
              Planning estimates · Not for construction
            </text>
            <g transform="translate(40 130)">
              {site && (
                <path
                  d={site.parcel.rings
                    .map(
                      (r) =>
                        'M ' +
                        r
                          .map((p) => pixelPoint(p, site.bounds).join(','))
                          .join(' L ') +
                        ' Z',
                    )
                    .join(' ')}
                  fill="none"
                  stroke="#668981"
                  strokeDasharray="8 6"
                  strokeWidth="2"
                />
              )}
              {features
                .filter((f) => f.included)
                .map((f) => {
                  const phase = plan.phases.find((p) => p.id === f.id);
                  const m = metrics(f.points, scale, f.kind !== 'path');
                  const minX = Math.min(...f.points.map((p) => p[0])),
                    maxX = Math.max(...f.points.map((p) => p[0])),
                    minY = Math.min(...f.points.map((p) => p[1]));
                  const color =
                    f.kind === 'pond'
                      ? '#327f93'
                      : f.kind === 'trees'
                        ? '#547b40'
                        : '#ad7941';
                  return (
                    <g key={f.id} opacity={phase?.funded ? 1 : 0.48}>
                      {f.kind === 'path' ? (
                        <polyline
                          points={f.points.map((p) => p.join(',')).join(' ')}
                          fill="none"
                          stroke={color}
                          strokeWidth="8"
                          strokeDasharray={phase?.funded ? '' : '10 8'}
                        />
                      ) : (
                        <polygon
                          points={f.points.map((p) => p.join(',')).join(' ')}
                          fill={color}
                          fillOpacity=".09"
                          stroke={color}
                          strokeWidth="3"
                          strokeDasharray={phase?.funded ? '' : '10 8'}
                        />
                      )}
                      {f.kind === 'trees' &&
                        plantingPoints(f.points, scale, spacing).map(
                          (pt, i) => (
                            <g key={i} stroke={color}>
                              <circle
                                cx={pt[0]}
                                cy={pt[1]}
                                r="4.5"
                                fill="none"
                              />
                              <path
                                d={`M ${pt[0] - 3} ${pt[1]} h 6 M ${pt[0]} ${pt[1] - 3} v 6`}
                              />
                            </g>
                          ),
                        )}
                      <text
                        x={(minX + maxX) / 2}
                        y={minY - 31}
                        textAnchor="middle"
                        fontSize="16"
                        fontWeight="bold"
                      >
                        {phase?.number}. {f.name}
                      </text>
                      <text
                        x={(minX + maxX) / 2}
                        y={minY - 10}
                        textAnchor="middle"
                        fontSize="13"
                      >
                        {phase?.funded
                          ? `Month ${phase.month}`
                          : 'Deferred · funding needed'}
                      </text>
                      {f.kind !== 'path' && scale > 0 && (
                        <g>
                          <line
                            x1={minX}
                            y1={Math.max(...f.points.map((p) => p[1])) + 25}
                            x2={maxX}
                            y2={Math.max(...f.points.map((p) => p[1])) + 25}
                            stroke="#54757a"
                          />
                          <text
                            x={(minX + maxX) / 2}
                            y={Math.max(...f.points.map((p) => p[1])) + 48}
                            textAnchor="middle"
                            fontSize="14"
                          >
                            {m.width.toFixed(1)} ft wide × {m.height.toFixed(1)}{' '}
                            ft high · image extents
                          </text>
                        </g>
                      )}
                      {f.kind === 'path' && scale > 0 && (
                        <text
                          x={maxX + 14}
                          y={Math.max(...f.points.map((p) => p[1]))}
                          fontSize="14"
                        >
                          {m.perimeter.toFixed(1)} ft route
                        </text>
                      )}
                    </g>
                  );
                })}
              <text x="1100" y="40" fontSize="12" textAnchor="middle">
                IMAGE UP
              </text>
              <path
                d="M1100 108V57M1092 72L1100 57L1108 72"
                fill="none"
                stroke="#1a4650"
                strokeWidth="2"
              />
              {scale > 0 && (
                <g transform={`translate(52 ${imageHeight - 70})`}>
                  <path
                    d={`M0 -8V0H${Math.min(100, scale * 280) / scale}V-8`}
                    fill="none"
                    stroke="#1a4650"
                    strokeWidth="2"
                  />
                  <text x="0" y="23" fontSize="13">
                    {Math.min(100, scale * 280).toFixed(0)} ft · based on image
                    scale
                  </text>
                </g>
              )}
            </g>
            <line
              x1="20"
              x2="1260"
              y1={height - 166}
              y2={height - 166}
              stroke="#718f94"
            />
            <text x="52" y={height - 133} fontSize="15" fontWeight="bold">
              {plan.funded.length} funded work areas · {money(plan.allowance)}{' '}
              installation + reserve · {money(plan.atYear(5).care)} five-year
              tree care
            </text>
            <text x="52" y={height - 103} fontSize="14">
              Solid line: funded work · Dashed line: deferred work · Tree
              spacing: {spacing} ft
            </text>
            <text x="52" y={height - 76} fontSize="13">
              Dimensions are image-axis extents. Orientation, boundaries,
              grades, utilities, and site conditions require field verification.
            </text>
            <text x="52" y={height - 50} fontSize="13">
              {site
                ? 'County GIS parcel. No surveyed boundary, elevations,'
                : 'Fictional demo property. No surveyed boundary, elevations,'}
              engineering details, or excavation depths are represented.
            </text>
          </g>
        </svg>
      </div>
    </section>
  );
}

export function ClientInvestment({
  shared,
  project,
}: {
  shared: SharedScope;
  project: Project;
}) {
  const plan = calculatePlan(shared.rows, shared.features, shared.planning);
  const fifth = plan.atYear(5);
  return (
    <div className="client-investment">
      <div className="planning-panel-title">
        <div>
          <span className="eyebrow">
            YOUR SELECTED PLAN · REVISION {shared.revision}
          </span>
          <h3>How your investment builds over time</h3>
        </div>
        <span className="status mint">
          {shared.planning.months}-month installation window
        </span>
      </div>
      <div className="investment-stats">
        <div>
          <span>FUNDED WORK + RESERVE</span>
          <strong>{money(plan.allowance)}</strong>
          <small>
            Within a {money(shared.planning.budget)} installation budget
          </small>
        </div>
        <div>
          <span>5-YEAR CARE ALLOWANCE</span>
          <strong>{money(fifth.care)}</strong>
          <small>
            {money(shared.planning.carePerTree)} per tree / year after planting
          </small>
        </div>
        <div>
          <span>5-YEAR TOTAL ALLOWANCE</span>
          <strong>{money(fifth.total)}</strong>
          <small>
            Includes {shared.planning.contingency}% installation contingency
          </small>
        </div>
      </div>
      <InvestmentChart plan={plan} />
      <div className="client-growth-years">
        {[1, 3, 5].map((year) => {
          const o = plan.atYear(year);
          return (
            <div key={year}>
              <span>YEAR {year}</span>
              <h4>{o.complete.length} work areas delivered</h4>
              <p>
                {o.trees} trees planted · {o.pond.toLocaleString()} ft pond edge
                · {o.path.toLocaleString()} ft access
              </p>
              <small>
                {o.trees
                  ? `${o.oldestTrees.toFixed(1)} years since earliest planting`
                  : 'Planting not yet delivered'}
              </small>
            </div>
          );
        })}
      </div>
      {plan.phases.some((p) => !p.funded) && (
        <div className="deferred-callout">
          <b>Reserved for a later investment</b>
          <p>
            {plan.phases
              .filter((p) => !p.funded)
              .map((p) => `${p.name} (${money(p.allowance)})`)
              .join(' · ')}
          </p>
          <small>
            These work areas are in the full concept but are outside this funded
            proposal.
          </small>
        </div>
      )}
      <p className="planning-note">
        An illustrative schedule based on sample rates and quantities. Care
        allowance covers trees only. No inflation, yield, or financial return is
        modeled. Site conditions, species, season, and ongoing care affect
        actual results.
      </p>
      <ConceptDrawing
        project={project}
        features={shared.features}
        scale={shared.scale}
        spacing={shared.spacing}
        imageHeight={shared.imageHeight}
        revision={shared.revision}
        site={shared.site}
        plan={plan}
      />
    </div>
  );
}
