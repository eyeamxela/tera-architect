/** Shared specification and estimate model. No market rates or inferred compliance. */
export const disciplineIds = [
  'land',
  'architecture',
  'interiors',
  'furniture',
] as const;
export type Discipline = (typeof disciplineIds)[number];
export type Field = {
  key: string;
  label: string;
  type?: 'number' | 'long';
  unit?: string;
  hint?: string;
};
export type Values = Record<string, string | number | null>;
export type Cost = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  rate: number | null;
  included: boolean;
  basis: 'allowance' | 'quote' | 'actual';
  taxable: boolean;
  reference: string;
};
export type Stage = {
  name: string;
  included: boolean;
  status: 'planned' | 'in_progress' | 'ready' | 'approved';
  owner: string;
};
export type DesignSection = {
  brief: Values;
  entries: { id: string; values: Values }[];
  costs: Cost[];
  stages: Stage[];
  startWeek: number | null;
  durationWeeks: number | null;
  leadWeeks: number | null;
  dependsOn: Discipline[];
  exclusions: string;
};
export type DesignScope = {
  version: 1;
  enabled: Discipline[];
  taxPercent: number;
  sections: Record<Discipline, DesignSection>;
};
export const definitions: Record<
  Discipline,
  {
    name: string;
    short: string;
    intro: string;
    fields: Field[];
    entryName: string;
    entryFields: Field[];
    stages: string[];
    costs: string[];
  }
> = {
  land: {
    name: 'Land development',
    short: 'Land',
    intro:
      'Start with the ground. Water, access, earthworks, and living systems.',
    fields: [
      { key: 'intent', label: 'Land use & desired outcome', type: 'long' },
      { key: 'survey', label: 'Boundary / topographic survey reference' },
      { key: 'area', label: 'Work area', type: 'number', unit: 'sq ft' },
      {
        key: 'soil',
        label: 'Soil, geotechnical & infiltration findings',
        type: 'long',
      },
      {
        key: 'water',
        label: 'Catchment, water storage & safe overflow',
        type: 'long',
      },
      {
        key: 'keyline',
        label: 'Keyline / contour design basis',
        hint: 'Surveyed levels, keypoints and proposed grades; GIS is a reference.',
      },
      { key: 'access', label: 'Access, slope & equipment constraints' },
      {
        key: 'utilities',
        label: 'Utilities, easements & ecological constraints',
      },
      {
        key: 'planting',
        label: 'Species, spacing, irrigation & establishment',
        type: 'long',
      },
      {
        key: 'jurisdiction',
        label: 'Planning authority & permit review reference',
      },
    ],
    entryName: 'Work area',
    entryFields: [
      { key: 'name', label: 'Work area name' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'unit', label: 'Unit (sq ft, lin ft, trees, cu yd)' },
      {
        key: 'spec',
        label: 'Preparation, materials & maintenance',
        type: 'long',
      },
    ],
    stages: [
      'Survey & site assessment',
      'Water, access & keyline concept',
      'Detailed design & permit review',
      'Earthworks & installation',
      'Establishment & handover',
    ],
    costs: [
      'Survey & land design',
      'Unmapped land works',
      'Establishment & maintenance allowance',
    ],
  },
  architecture: {
    name: 'Architecture',
    short: 'Architecture',
    intro:
      'Turn the brief into a coordinated building, from concept to handover.',
    fields: [
      {
        key: 'intent',
        label: 'Project brief & success criteria',
        type: 'long',
      },
      {
        key: 'type',
        label: 'Building type / new build / addition / renovation',
      },
      {
        key: 'grossArea',
        label: 'Gross floor area',
        type: 'number',
        unit: 'sq ft',
      },
      {
        key: 'existingArea',
        label: 'Existing area retained',
        type: 'number',
        unit: 'sq ft',
      },
      { key: 'storeys', label: 'Number of storeys', type: 'number' },
      { key: 'occupancy', label: 'Intended occupancy, users & room program' },
      { key: 'construction', label: 'Structural system & envelope approach' },
      {
        key: 'performance',
        label: 'Energy, comfort & sustainability targets',
        type: 'long',
      },
      {
        key: 'consultants',
        label: 'Structural / MEP / civil / energy consultants',
      },
      {
        key: 'jurisdiction',
        label: 'Authority, zoning & code review reference',
        hint: 'Record verified setbacks, height, lot coverage and constraints; no automatic entitlement.',
      },
      { key: 'accessibility', label: 'Accessibility scope & reviewer' },
      {
        key: 'delivery',
        label: 'Delivery method & construction administration scope',
      },
    ],
    entryName: 'Space',
    entryFields: [
      { key: 'name', label: 'Space / zone' },
      { key: 'area', label: 'Net area', type: 'number', unit: 'sq ft' },
      { key: 'count', label: 'Count', type: 'number' },
      {
        key: 'requirements',
        label: 'Adjacencies, services & performance',
        type: 'long',
      },
    ],
    stages: [
      'Brief & feasibility',
      'Schematic design',
      'Design development & coordination',
      'Construction documents',
      'Bidding / procurement',
      'Construction administration & handover',
    ],
    costs: [
      'Architect design & documentation fee',
      'Consultant services',
      'Construction works excluding other disciplines',
      'Authority fees & surveys',
      'Construction administration',
    ],
  },
  interiors: {
    name: 'Interior design',
    short: 'Interiors',
    intro:
      'Shape the spaces people use. Finishes, lighting, fixtures, and furnishings.',
    fields: [
      { key: 'intent', label: 'Design direction & experience', type: 'long' },
      {
        key: 'area',
        label: 'Interior work area',
        type: 'number',
        unit: 'sq ft',
      },
      { key: 'occupancy', label: 'Users, accessibility & operational needs' },
      { key: 'retain', label: 'Existing elements retained / removed' },
      {
        key: 'lighting',
        label: 'Lighting, electrical & reflected ceiling coordination',
        type: 'long',
      },
      { key: 'wet', label: 'Wet areas, plumbing & waterproofing scope' },
      {
        key: 'performance',
        label: 'Acoustics, durability, indoor air & maintenance targets',
      },
      { key: 'procurement', label: 'Who purchases, receives & installs FF&E?' },
      {
        key: 'furnitureOwnership',
        label: 'Furniture cost boundary',
        hint: 'Keep bespoke pieces in Custom furniture; specify exclusions here to avoid counting them twice.',
      },
      {
        key: 'jurisdiction',
        label: 'Permit / code / accessibility reviewer & reference',
      },
    ],
    entryName: 'Room',
    entryFields: [
      { key: 'name', label: 'Room name / number' },
      { key: 'area', label: 'Area', type: 'number', unit: 'sq ft' },
      {
        key: 'ceilingHeight',
        label: 'Ceiling height',
        type: 'number',
        unit: 'ft',
      },
      {
        key: 'finishes',
        label: 'Floor, wall, ceiling finish codes',
        type: 'long',
      },
      {
        key: 'fixtures',
        label: 'Lighting, hardware, fixtures & FF&E codes',
        type: 'long',
      },
      {
        key: 'reference',
        label: 'Drawing / finish sample / supplier reference',
      },
    ],
    stages: [
      'Brief, measure & space plan',
      'Concept & material palette',
      'Drawings, finish & FF&E schedules',
      'Samples & client selections',
      'Procurement & installation',
      'Snagging & care handover',
    ],
    costs: [
      'Interior design & documentation',
      'Interior finishes & installation',
      'Lighting, fixtures & standard FF&E',
      'Procurement & receiving',
      'Delivery, installation & styling',
    ],
  },
  furniture: {
    name: 'Custom furniture',
    short: 'Furniture',
    intro:
      'Resolve each piece, its materials, its fabrication, and its place in the project.',
    fields: [
      { key: 'intent', label: 'Collection brief & intended use', type: 'long' },
      { key: 'maker', label: 'Fabricator / maker & contact reference' },
      {
        key: 'environment',
        label: 'Indoor / outdoor use, humidity & site conditions',
      },
      {
        key: 'performance',
        label: 'Load, durability & testing requirements',
        hint: 'Product-specific testing or certification must be confirmed by the maker.',
      },
      {
        key: 'joinery',
        label: 'Joinery, tolerances, fixing & assembly strategy',
      },
      {
        key: 'samples',
        label: 'Shop drawing, sample & prototype approvals required',
      },
      {
        key: 'delivery',
        label: 'Delivery access, protection, storage & installation',
      },
      { key: 'warranty', label: 'Warranty, care & repair commitments' },
    ],
    entryName: 'Piece',
    entryFields: [
      { key: 'name', label: 'Piece name / drawing number' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'width', label: 'Width', type: 'number' },
      { key: 'depth', label: 'Depth', type: 'number' },
      { key: 'height', label: 'Height', type: 'number' },
      { key: 'dimensionUnit', label: 'Dimension unit (in / mm)' },
      { key: 'material', label: 'Species, core, grade & material quantity' },
      { key: 'finish', label: 'Finish / sheen / approved sample' },
      { key: 'hardware', label: 'Hardware, upholstery & supplier codes' },
      {
        key: 'fabricationHours',
        label: 'Fabrication hours per piece',
        type: 'number',
        unit: 'hr',
      },
      {
        key: 'leadWeeks',
        label: 'Supplier lead time',
        type: 'number',
        unit: 'weeks',
      },
      { key: 'reference', label: 'Measured / approved drawing revision' },
    ],
    stages: [
      'Brief & verified field dimensions',
      'Design & shop drawings',
      'Material samples / prototype approval',
      'Fabrication & quality review',
      'Delivery & installation',
      'Care & warranty handover',
    ],
    costs: [
      'Furniture design & shop drawings',
      'Materials, hardware & upholstery',
      'Fabrication & finishing labor',
      'Prototype / testing allowance',
      'Packing, freight & installation',
    ],
  },
};
export const presets: { id: string; name: string; enabled: Discipline[] }[] = [
  { id: 'architecture', name: 'Architecture', enabled: ['architecture'] },
  { id: 'interiors', name: 'Interior design', enabled: ['interiors'] },
  { id: 'furniture', name: 'Custom furniture', enabled: ['furniture'] },
  { id: 'land', name: 'Land development', enabled: ['land'] },
  { id: 'all', name: 'Whole project · all four', enabled: [...disciplineIds] },
];
export function makeDesignScope(
  enabled: Discipline[] = ['architecture'],
): DesignScope {
  const section = (id: Discipline): DesignSection => ({
    brief: {},
    entries: [],
    exclusions: '',
    startWeek: null,
    durationWeeks: null,
    leadWeeks: null,
    dependsOn: [],
    stages: definitions[id].stages.map((name) => ({
      name,
      included: true,
      status: 'planned',
      owner: '',
    })),
    costs: definitions[id].costs.map((name, i) => ({
      id: `${id}-${i}`,
      name,
      quantity: 1,
      unit: 'allowance',
      rate: null,
      included: true,
      basis: 'allowance',
      taxable: false,
      reference: '',
    })),
  });
  return {
    version: 1,
    enabled: [...enabled],
    taxPercent: 0,
    sections: {
      land: section('land'),
      architecture: section('architecture'),
      interiors: section('interiors'),
      furniture: section('furniture'),
    },
  };
}

/** A template selects disciplines without replacing any saved project work. */
export function designPresetId(scope: DesignScope): string {
  return (
    presets.find(
      (p) =>
        p.enabled.length === scope.enabled.length &&
        p.enabled.every((id) => scope.enabled.includes(id)),
    )?.id || 'custom'
  );
}
export function applyDesignPreset(
  scope: DesignScope,
  presetId: string,
): DesignScope {
  const preset = presets.find((p) => p.id === presetId);
  return preset ? { ...scope, enabled: [...preset.enabled] } : scope;
}
export function toggleDiscipline(
  scope: DesignScope,
  id: Discipline,
): DesignScope {
  const enabled = scope.enabled.includes(id)
    ? scope.enabled.filter((x) => x !== id)
    : [...scope.enabled, id];
  return enabled.length ? { ...scope, enabled } : scope;
}
export const costTotal = (c: Cost) =>
  c.quantity === null || c.rate === null
    ? null
    : Math.round(c.quantity * Math.round(c.rate * 100)) / 100;
export function designRows(scope?: DesignScope) {
  if (!scope) return [];
  return scope.enabled.flatMap((id) =>
    scope.sections[id].costs
      .filter((c) => c.included && costTotal(c) !== null)
      .map((c) => ({
        id: `design:${id}:${c.id}`,
        name: `${definitions[id].short} · ${c.name}`,
        description: `${c.basis}${c.reference ? ` · ${c.reference}` : ''}`,
        quantity: c.quantity!,
        unit: c.unit,
        rate: c.rate!,
        total: costTotal(c)!,
        discipline: id,
      })),
  );
}
export function designIssues(scope: DesignScope): string[] {
  const issues: string[] = [];
  for (const id of scope.enabled) {
    const s = scope.sections[id],
      name = definitions[id].short;
    if (!s.costs.some((c) => c.included))
      issues.push(
        `${name}: include at least one estimate line, even if its confirmed cost is zero.`,
      );
    for (const c of s.costs.filter((c) => c.included)) {
      if (costTotal(c) === null)
        issues.push(`${name}: price “${c.name}” or exclude it.`);
      if (c.basis !== 'allowance' && !c.reference.trim())
        issues.push(
          `${name}: add the quote or actual-cost reference for “${c.name}”.`,
        );
    }
    if (
      s.startWeek === null ||
      s.durationWeeks === null ||
      s.leadWeeks === null
    )
      issues.push(
        `${name}: confirm start, work duration and lead time (zero is allowed).`,
      );
    for (const dep of s.dependsOn)
      if (!scope.enabled.includes(dep))
        issues.push(
          `${name}: enable ${definitions[dep].short} or remove that dependency.`,
        );
  }
  try {
    designSchedule(scope);
  } catch {
    issues.push('Remove the circular schedule dependency.');
  }
  return issues;
}
/** Dependencies finish before procurement begins. Independent disciplines overlap. */
export function designSchedule(scope: DesignScope) {
  const results = new Map<
    Discipline,
    {
      id: Discipline;
      start: number | null;
      workStart: number | null;
      end: number | null;
    }
  >();
  const visiting = new Set<Discipline>();
  const visit = (
    id: Discipline,
  ): {
    id: Discipline;
    start: number | null;
    workStart: number | null;
    end: number | null;
  } => {
    if (visiting.has(id)) throw new Error('Circular schedule dependency.');
    const saved = results.get(id);
    if (saved) return saved;
    visiting.add(id);
    const s = scope.sections[id];
    const deps = s.dependsOn.map((dep) =>
      scope.enabled.includes(dep) ? visit(dep).end : null,
    );
    const known =
      s.startWeek !== null &&
      s.durationWeeks !== null &&
      s.leadWeeks !== null &&
      deps.every((end) => end !== null);
    const start = known ? Math.max(s.startWeek!, ...(deps as number[])) : null;
    const workStart = start === null ? null : start + s.leadWeeks!;
    const result = {
      id,
      start,
      workStart,
      end: workStart === null ? null : workStart + s.durationWeeks!,
    };
    results.set(id, result);
    visiting.delete(id);
    return result;
  };
  return scope.enabled.map(visit);
}
export function designInvestment(
  scope: DesignScope,
  rows: { id: string; total: number; discipline?: Discipline }[],
  contingencyPercent: number,
  budget: number,
) {
  const subtotalCents = rows.reduce(
    (sum, r) => sum + Math.round(r.total * 100),
    0,
  );
  const taxableCents = scope.enabled
    .flatMap((id) => scope.sections[id].costs)
    .filter((c) => c.included && c.taxable)
    .reduce((sum, c) => sum + Math.round((costTotal(c) ?? 0) * 100), 0);
  const taxCents = Math.round((taxableCents * scope.taxPercent) / 100);
  const reserveCents = Math.round((subtotalCents * contingencyPercent) / 100);
  const total = (subtotalCents + taxCents + reserveCents) / 100;
  let schedule: ReturnType<typeof designSchedule> = [];
  try {
    schedule = designSchedule(scope);
  } catch {
    /* Draft can show the validation issue without crashing. */
  }
  const missing = scope.enabled.flatMap((id) =>
    scope.sections[id].costs.filter((c) => c.included && costTotal(c) === null),
  );
  const byDiscipline = scope.enabled.map((id) => ({
    id,
    total:
      rows
        .filter((r) => r.discipline === id)
        .reduce((sum, r) => sum + Math.round(r.total * 100), 0) / 100,
  }));
  const assigned = byDiscipline.reduce(
    (sum, r) => sum + Math.round(r.total * 100),
    0,
  );
  return {
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    reserve: reserveCents / 100,
    total,
    gap: Math.max(0, total - budget),
    remaining: Math.max(0, budget - total),
    missing,
    byDiscipline,
    common: (subtotalCents - assigned) / 100,
    schedule,
    finishWeek:
      schedule.length && schedule.every((s) => s.end !== null)
        ? Math.max(...schedule.map((s) => s.end!))
        : null,
  };
}

export function emptyArchitectDraft(preset = 'architecture') {
  return {
    designScope: makeDesignScope(presets.find((p) => p.id === preset)?.enabled),
    planning: {
      budget: 0,
      months: 12,
      contingency: 0,
      carePerTree: 0,
      priority: 'water' as const,
    },
    features: [],
    items: [],
    attachments: [],
    scale: 0,
    spacing: 25,
    image: '',
    imageHeight: 800,
  };
}

/** Strip saved but unselected work from the client-facing snapshot. */
export function publicDesignScope(scope: DesignScope): DesignScope {
  const result = structuredClone(scope);
  for (const id of disciplineIds)
    if (!scope.enabled.includes(id))
      result.sections[id] = {
        brief: {},
        entries: [],
        costs: [],
        stages: [],
        startWeek: null,
        durationWeeks: null,
        leadWeeks: null,
        dependsOn: [],
        exclusions: '',
      };
  return result;
}
