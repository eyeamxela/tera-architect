import type { SiteAssessment } from './site-data';
import { defaultPlanning, type Planning } from './plan-model.ts';
import {
  designRows,
  type DesignScope,
  type Discipline,
} from './design-model.ts';
export type Point = [number, number];
export type Feature = {
  id: string;
  name: string;
  kind: 'pond' | 'trees' | 'path' | 'area';
  status: string;
  points: Point[];
  description: string;
  rate: number;
  included: boolean;
};
export type Project = {
  template?: 'landscape' | 'general';
  id: string;
  name: string;
  client: string;
  location: string;
  acres: number;
  stage: string;
  initials: string;
};
export const projects: Project[] = [
  {
    id: 'NC-024',
    name: 'Creekside Homestead',
    client: 'Emma & James Smith',
    location: 'Ojai Valley, CA',
    acres: 42.6,
    stage: 'Scoping',
    initials: 'ES',
  },
  {
    id: 'CO-019',
    name: 'Cedar Hollow',
    client: 'Olivia Chen',
    location: 'Mendocino County, CA',
    acres: 18.4,
    stage: 'Client review',
    initials: 'OC',
  },
  {
    id: 'MR-031',
    name: 'Meadow Ridge',
    client: 'Daniel Rivera',
    location: 'Marin County, CA',
    acres: 67.2,
    stage: 'Fieldwork',
    initials: 'DR',
  },
  {
    id: 'WV-028',
    name: 'Willow Valley',
    client: 'Sophie Williams',
    location: 'Napa County, CA',
    acres: 31.8,
    stage: 'Planning',
    initials: 'SW',
  },
];
export const initialFeatures: Feature[] = [
  {
    id: 'pond',
    name: 'Lower pond',
    kind: 'pond',
    status: 'Existing · Restoration',
    points: [
      [338, 340],
      [347, 317],
      [367, 300],
      [393, 284],
      [407, 301],
      [420, 319],
      [439, 331],
      [464, 339],
      [507, 336],
      [540, 345],
      [560, 365],
      [565, 389],
      [551, 414],
      [522, 433],
      [476, 446],
      [432, 450],
      [393, 438],
      [368, 421],
      [351, 394],
      [339, 367],
    ],
    description:
      'Restore the pond edge, remove invasive vegetation, and establish a native planted buffer. Includes shoreline preparation and erosion control.',
    rate: 8.5,
    included: true,
  },
  {
    id: 'trees',
    name: 'East orchard',
    kind: 'trees',
    status: 'Proposed · Tree planting',
    points: [
      [650, 321],
      [835, 334],
      [820, 520],
      [632, 505],
    ],
    description:
      'Extend the existing orchard with evenly spaced young trees. Includes planting, stakes, guards, and mulch rings.',
    rate: 185,
    included: true,
  },
  {
    id: 'path',
    name: 'Access path',
    kind: 'path',
    status: 'Proposed · Gravel surface',
    points: [
      [138, 240],
      [146, 320],
      [165, 410],
      [188, 491],
      [240, 515],
      [302, 530],
    ],
    description:
      'Prepare and surface an 8-foot-wide gravel access path between the farm entrance and lower pond. Final route subject to a site walk.',
    rate: 22,
    included: true,
  },
];
export const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
export type ScopeRow = {
  discipline?: Discipline;
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
};
export type ManualScopeItem = Omit<ScopeRow, 'total'> & { included: boolean };
export type SharedScope = {
  designScope?: DesignScope;
  attachments?: string[];
  documents?: { id: string; name: string; mime: string; url: string }[];
  site?: SiteAssessment;
  planning: Planning;
  revision: number;
  rows: ScopeRow[];
  features: Feature[];
  scale: number;
  spacing: number;
  image: string;
  imageHeight: number;
  status: 'Awaiting review' | 'Approved' | 'Changes requested';
  total: number;
};
export type Job = {
  designScope?: DesignScope;
  clientActivity?: string[];
  attachments?: string[];
  items?: ManualScopeItem[];
  site?: SiteAssessment;
  planning: Planning;
  features: Feature[];
  scale: number;
  spacing: number;
  image: string;
  imageHeight: number;
  revision: number;
  shared: SharedScope | null;
  comments: { author: string; text: string; revision: number }[];
  activity: string[];
};
export function scopeRows(
  features: Feature[],
  scale: number,
  spacing: number,
  items: ManualScopeItem[] = [],
  designScope?: DesignScope,
): ScopeRow[] {
  const manual = items
    .filter((item) => item.included)
    .map(({ included: _, ...item }) => ({
      ...item,
      total: Math.round(item.quantity * Math.round(item.rate * 100)) / 100,
    }));
  manual.push(...designRows(designScope));
  if (designScope && !designScope.enabled.includes('land')) return manual;
  if (!scale || !Number.isFinite(scale) || scale < 0) return manual;
  return [
    ...features
      .filter((f) => f.included)
      .map((f) => {
        const m = metrics(f.points, scale, f.kind !== 'path');
        const quantity =
          f.kind === 'trees'
            ? plantingPoints(f.points, scale, spacing).length
            : f.kind === 'area'
              ? Math.round(m.area)
              : Math.round(m.perimeter);
        return {
          ...(designScope ? { discipline: 'land' as const } : {}),
          id: f.id,
          name: f.name,
          description: f.description,
          quantity,
          unit:
            f.kind === 'trees'
              ? 'trees'
              : f.kind === 'area'
                ? 'sq ft'
                : 'lin ft',
          rate: f.rate,
          total: Math.round(quantity * Math.round(f.rate * 100)) / 100,
        };
      }),
    ...manual,
  ];
}
export function makeJob(empty = false): Job {
  const features = empty ? [] : structuredClone(initialFeatures);
  const rows = scopeRows(features, 1.2, 25);
  return {
    planning: { ...defaultPlanning },
    features,
    scale: empty ? 0 : 1.2,
    spacing: 25,
    image: '/property-aerial.png',
    imageHeight: 800,
    revision: 3,
    shared: empty
      ? null
      : {
          planning: { ...defaultPlanning },
          revision: 3,
          rows,
          features: structuredClone(features),
          scale: 1.2,
          spacing: 25,
          image: '/property-aerial.png',
          imageHeight: 800,
          status: 'Awaiting review',
          total: rows.reduce((s, r) => s + r.total, 0),
        },
    comments: empty
      ? []
      : [
          {
            author: 'Emma Smith',
            text: 'Please keep a clear walking route around the lower pond.',
            revision: 3,
          },
        ],
    activity: empty
      ? ['Project created']
      : [
          'Scope revision 03 prepared for client review',
          'Three work areas added to the property plan',
          'Aerial image and field notes received',
        ],
  };
}
export function metrics(points: Point[], scale: number, closed = true) {
  let area = 0,
    length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
    if (closed || i < points.length - 1)
      length += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  return {
    area: closed ? Math.abs(area / 2) * scale * scale : 0,
    perimeter: length * scale,
    width: (Math.max(...xs) - Math.min(...xs)) * scale,
    height: (Math.max(...ys) - Math.min(...ys)) * scale,
  };
}
export function inside([x, y]: Point, poly: Point[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
export function plantingPoints(poly: Point[], scale: number, spacing: number) {
  if (!scale || spacing < 5 || !layoutFits(poly, scale, spacing)) return [];
  const gap = spacing / scale;
  const out: Point[] = [];
  const xs = poly.map((p) => p[0]),
    ys = poly.map((p) => p[1]);
  for (let y = Math.min(...ys) + gap / 2; y < Math.max(...ys); y += gap)
    for (let x = Math.min(...xs) + gap / 2; x < Math.max(...xs); x += gap) {
      if (inside([x, y], poly)) out.push([x, y]);
    }
  return out;
}

export function layoutFits(poly: Point[], scale: number, spacing: number) {
  if (!scale) return true;
  if (
    !Number.isFinite(scale) ||
    scale < 0 ||
    !Number.isFinite(spacing) ||
    spacing < 5 ||
    poly.length < 3
  )
    return false;
  const m = metrics(poly, scale);
  return Math.ceil(m.width / spacing) * Math.ceil(m.height / spacing) <= 15000;
}
export function validPolygon(p: Point[]) {
  if (p.length < 3 || p.length > 100 || metrics(p, 1).area < 20) return false;
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      const a = p[i],
        b = p[(i + 1) % p.length],
        c = p[j],
        d = p[(j + 1) % p.length];
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      )
        return false;
    }
  return true;
}
