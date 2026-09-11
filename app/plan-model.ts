import type { Feature, ScopeRow } from './data';

export type Planning = {
  budget: number;
  months: number;
  contingency: number;
  carePerTree: number;
  priority: 'water' | 'planting' | 'access';
};
export const defaultPlanning: Planning = {
  budget: 35000,
  months: 24,
  contingency: 10,
  carePerTree: 35,
  priority: 'water',
};
export const planPresets = [
  {
    name: 'Start with the essentials',
    description: 'Fund the first priorities. Keep later work visible.',
    budget: 18000,
    months: 12,
  },
  {
    name: 'Build in phases',
    description: 'Spread installation across three years.',
    budget: 35000,
    months: 36,
  },
  {
    name: 'Establish sooner',
    description: 'Complete installation within the first year.',
    budget: 45000,
    months: 12,
  },
];
const cents = (n: number) => Math.round(n * 100) / 100;

export function calculatePlan(
  rows: ScopeRow[],
  features: Feature[],
  settings: Planning,
) {
  const { budget, months, contingency, carePerTree, priority } = settings;
  if (
    ![budget, months, contingency, carePerTree].every(Number.isFinite) ||
    budget < 0 ||
    months < 1 ||
    months > 60 ||
    contingency < 0 ||
    contingency > 100 ||
    carePerTree < 0 ||
    !['water', 'planting', 'access'].includes(priority)
  )
    throw new Error('Invalid planning assumptions');
  const orders = {
    water: ['pond', 'trees', 'path', 'area'],
    planting: ['trees', 'pond', 'path', 'area'],
    access: ['path', 'pond', 'trees', 'area'],
  };
  const ordered = rows
    .map((row) => ({
      ...row,
      kind: features.find((f) => f.id === row.id)?.kind || 'area',
    }))
    .sort(
      (a, b) =>
        orders[priority].indexOf(a.kind) - orders[priority].indexOf(b.kind),
    );
  let remaining = cents(budget),
    blocked = false;
  const phases = ordered.map((row, i) => {
    const reserve = cents((row.total * contingency) / 100);
    const allowance = cents(row.total + reserve);
    const funded = !blocked && allowance <= remaining;
    if (funded) remaining = cents(remaining - allowance);
    else blocked = true;
    return {
      ...row,
      reserve,
      allowance,
      funded,
      month: Math.ceil((months * (i + 1)) / ordered.length),
      number: i + 1,
    };
  });
  const atYear = (year: number) => {
    const complete = phases.filter((p) => p.funded && p.month <= year * 12);
    const install = cents(complete.reduce((s, p) => s + p.allowance, 0));
    const care = cents(
      complete
        .filter((p) => p.kind === 'trees')
        .reduce(
          (s, p) =>
            s +
            (p.quantity * carePerTree * Math.max(0, year * 12 - p.month)) / 12,
          0,
        ),
    );
    const trees = complete
      .filter((p) => p.kind === 'trees')
      .reduce((s, p) => s + p.quantity, 0);
    const pond = complete
      .filter((p) => p.kind === 'pond')
      .reduce((s, p) => s + p.quantity, 0);
    const path = complete
      .filter((p) => p.kind === 'path')
      .reduce((s, p) => s + p.quantity, 0);
    const treePhases = complete.filter((p) => p.kind === 'trees');
    const oldestTrees = treePhases.length
      ? Math.max(...treePhases.map((p) => (year * 12 - p.month) / 12))
      : 0;
    return {
      year,
      complete,
      install,
      care,
      total: cents(install + care),
      trees,
      pond,
      path,
      oldestTrees,
    };
  };
  const funded = phases.filter((p) => p.funded);
  const install = cents(funded.reduce((s, p) => s + p.total, 0));
  const reserve = cents(funded.reduce((s, p) => s + p.reserve, 0));
  const required = cents(phases.reduce((s, p) => s + p.allowance, 0));
  return {
    phases,
    funded,
    install,
    reserve,
    required,
    remaining,
    shortfall: Math.max(0, cents(required - budget)),
    allowance: cents(install + reserve),
    years: [0, 1, 2, 3, 4, 5].map(atYear),
    atYear,
  };
}
export type PlanResult = ReturnType<typeof calculatePlan>;
