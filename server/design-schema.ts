import { z } from 'zod';
import {
  definitions,
  disciplineIds,
  type Discipline,
  type Field,
  type Values,
} from '../app/design-model.ts';
const nullableNumber = z.number().finite().min(0).max(1_000_000).nullable();
const week = z.number().int().min(0).max(520).nullable();
const values = z.record(
  z.string(),
  z.union([z.string().max(6000), nullableNumber]),
);
const section = z
  .object({
    brief: values,
    entries: z
      .array(z.object({ id: z.string().min(1).max(100), values }).strict())
      .max(100),
    costs: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            name: z.string().trim().min(1).max(200),
            quantity: nullableNumber,
            unit: z.string().trim().min(1).max(30),
            rate: z.number().finite().min(0).max(10_000_000).nullable(),
            included: z.boolean(),
            basis: z.enum(['allowance', 'quote', 'actual']),
            taxable: z.boolean(),
            reference: z.string().max(6000),
          })
          .strict(),
      )
      .max(100),
    stages: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(200),
            included: z.boolean(),
            status: z.enum(['planned', 'in_progress', 'ready', 'approved']),
            owner: z.string().max(200),
          })
          .strict(),
      )
      .max(30),
    startWeek: week,
    durationWeeks: week,
    leadWeeks: week,
    dependsOn: z.array(z.enum(disciplineIds)).max(3),
    exclusions: z.string().max(6000),
  })
  .strict();
export const designSchema = z
  .object({
    version: z.literal(1),
    enabled: z.array(z.enum(disciplineIds)).min(1).max(4),
    taxPercent: z.number().min(0).max(100),
    sections: z
      .object({
        land: section,
        architecture: section,
        interiors: section,
        furniture: section,
      })
      .strict(),
  })
  .strict()
  .superRefine((scope, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if (new Set(scope.enabled).size !== scope.enabled.length)
      issue('Disciplines must be unique.');
    const validateValues = (v: Values, fields: Field[]) => {
      for (const [key, value] of Object.entries(v)) {
        const field = fields.find((f) => f.key === key);
        if (
          !field ||
          (value !== null &&
            (field.type === 'number'
              ? typeof value !== 'number'
              : typeof value !== 'string'))
        )
          issue(`Invalid specification field: ${key}`);
      }
    };
    for (const id of disciplineIds) {
      const s = scope.sections[id];
      validateValues(s.brief, definitions[id].fields);
      s.entries.forEach((e) =>
        validateValues(e.values, definitions[id].entryFields),
      );
      if (
        new Set(s.entries.map((e) => e.id)).size !== s.entries.length ||
        new Set(s.costs.map((c) => c.id)).size !== s.costs.length
      )
        issue(`${id}: duplicate item IDs.`);
      if (
        s.dependsOn.includes(id) ||
        new Set(s.dependsOn).size !== s.dependsOn.length
      )
        issue(`${id}: invalid dependency.`);
    }
    // Validate the complete dependency graph, including saved inactive modules.
    const seen = new Set<Discipline>(),
      active = new Set<Discipline>();
    const visit = (id: Discipline): boolean => {
      if (active.has(id)) return false;
      if (seen.has(id)) return true;
      active.add(id);
      if (!scope.sections[id].dependsOn.every(visit)) return false;
      active.delete(id);
      seen.add(id);
      return true;
    };
    if (!disciplineIds.every(visit)) issue('Circular schedule dependency.');
  });
