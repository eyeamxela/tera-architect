import { z } from 'zod';
import type { Job } from '../app/data.ts';

const money = z.number().min(0).max(10_000_000);
const coordinate = z.number().min(-100_000).max(100_000);
const image = z
  .string()
  .max(3000)
  .refine((value) => {
    if (
      [
        '/property-aerial.png',
        '/keyline-aerial-concept.png',
        '/keyline-established-vision.png',
        '',
      ].includes(value)
    )
      return true;
    if (/^\/api\/build\/files\/[a-f0-9-]{36}$/.test(value)) return true;
    try {
      const u = new URL(value);
      return (
        u.protocol === 'https:' &&
        [
          'elevation.nationalmap.gov',
          'basemap.nationalmap.gov',
          'gis.ventura.org',
          'maps.venturacounty.gov',
        ].includes(u.hostname)
      );
    } catch {
      return false;
    }
  }, 'Use an uploaded image or a supported map source.');
const item = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    description: z.string().max(6000),
    quantity: z.number().min(0).max(1_000_000),
    unit: z.string().min(1).max(30),
    rate: money,
    included: z.boolean(),
  })
  .strict();
export const draftSchema = z
  .object({
    planning: z
      .object({
        budget: money,
        months: z.number().int().min(1).max(60),
        contingency: z.number().min(0).max(100),
        carePerTree: money,
        priority: z.enum(['water', 'planting', 'access']),
      })
      .strict(),
    features: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            name: z.string().min(1).max(200),
            kind: z.enum(['pond', 'trees', 'path', 'area']),
            status: z.string().max(200),
            points: z
              .array(z.tuple([coordinate, coordinate]))
              .min(2)
              .max(500),
            description: z.string().max(6000),
            rate: money,
            included: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    items: z.array(item).max(100).default([]),
    attachments: z.array(z.uuid()).max(30).default([]),
    scale: z.number().min(0).max(10000),
    spacing: z.number().min(10).max(1000),
    image,
    imageHeight: z.number().min(1).max(20000),
    site: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = [...value.features, ...value.items].map((x) => x.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Work item IDs must be unique.',
      });
  });
export type Draft = z.infer<typeof draftSchema>;
export const draftFromJob = (job: Job) => ({
  planning: job.planning,
  features: job.features,
  items: job.items || [],
  attachments: job.attachments || [],
  scale: job.scale,
  spacing: job.spacing,
  image: job.image,
  imageHeight: job.imageHeight,
  ...(job.site ? { site: job.site } : {}),
});
export const projectSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    client: z.string().trim().min(1).max(200),
    location: z.string().trim().max(500),
    acres: z.number().min(0).max(1_000_000),
    template: z.enum(['landscape', 'general']).default('general'),
    draft: draftSchema.optional(),
  })
  .strict();
export const saveSchema = z
  .object({ expectedVersion: z.number().int().positive(), draft: draftSchema })
  .strict();
export const publishSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const updateSchema = z
  .object({
    text: z.string().trim().min(1).max(10000),
    visibility: z.enum(['internal', 'client']).default('internal'),
  })
  .strict();
export const responseSchema = z
  .object({
    revisionId: z.uuid(),
    kind: z.enum(['approved', 'changes_requested', 'comment']),
    text: z.string().trim().max(6000).default(''),
  })
  .strict();
export const proposalSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('capture_update'),
      text: z.string().trim().min(1).max(10000),
    })
    .strict(),
  z
    .object({
      action: z.literal('propose_scope'),
      expectedVersion: z.number().int().positive(),
      draft: draftSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('needs_input'),
      question: z.string().trim().min(1).max(2000),
    })
    .strict(),
]);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function check(
  ok: unknown,
  status: number,
  message: string,
): asserts ok {
  if (!ok) throw new ApiError(status, message);
}
