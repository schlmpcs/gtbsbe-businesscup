import { z } from 'zod';
export const AVATAR_ROUND_BALANCE = {
  threshold: 100_000,
  below: 1_000,
  above: 5_000,
} as const;
export const AVATAR_ROUND_MONTHLY = 50;
export const AVATAR_RENT_SHARE_STEP = 0.05;
export const AVATAR_TTL_DAYS = 90;
export const AVATAR_MIN_POOL = 20;
export const AVATAR_MIN_PICKS = 20;
export const AVATAR_BOUNDS = {
  age: { min: 18, max: 100 },
  netWorth: { min: -2_000_000, max: 20_000_000 },
  monthlyCost: { min: 300, max: 50_000 },
  debtTotal: { min: 0, max: 5_000_000 },
} as const;
export const AvatarStampSchema = z.enum(['selfReported', 'statementVerified']);
export type AvatarStamp = z.infer<typeof AvatarStampSchema>;
export const AgeBandSchema = z.enum([
  'under25',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45plus',
]);
export type AgeBand = z.infer<typeof AgeBandSchema>;
export const AvatarFactsSchema = z.strictObject({
  hasCar: z.boolean(),
  kids: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  householdAdults: z.union([z.literal(1), z.literal(2)]),
});
export type AvatarFacts = z.infer<typeof AvatarFactsSchema>;
const money = z.number().finite();
export const AvatarPayloadSchema = z.strictObject({
  kind: z.literal('avatar'),
  stamp: AvatarStampSchema,
  ageBand: AgeBandSchema,
  metro: z.string().max(100),
  netWorth: money,
  monthlyCost: money,
  rentShare: money.nonnegative().nullable(),
  debtTotal: money.nonnegative(),
  facts: AvatarFactsSchema,
});
export type AvatarPayload = z.infer<typeof AvatarPayloadSchema>;
export const AvatarPublicSchema = AvatarPayloadSchema.extend({
  metro: z.string().min(1).max(100),
  avatarId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
}).refine(
  (p) =>
    p.netWorth >= AVATAR_BOUNDS.netWorth.min &&
    p.netWorth <= AVATAR_BOUNDS.netWorth.max &&
    p.monthlyCost >= AVATAR_BOUNDS.monthlyCost.min &&
    p.monthlyCost <= AVATAR_BOUNDS.monthlyCost.max &&
    p.debtTotal <= AVATAR_BOUNDS.debtTotal.max,
);
export type AvatarPublic = z.infer<typeof AvatarPublicSchema>;
export const AvatarFieldSchema = z.enum([
  'age',
  'ageBand',
  'metro',
  'netWorth',
  'monthlyCost',
  'rentShare',
  'debtTotal',
  'facts.hasCar',
  'facts.kids',
  'facts.householdAdults',
]);
export const AvatarBoundsIssueSchema = z.strictObject({
  field: AvatarFieldSchema,
  reason: z.enum(['tooLow', 'tooHigh']),
});
export const AvatarPreviewSchema = z.strictObject({
  payload: AvatarPayloadSchema,
  estimatedFields: z.array(AvatarFieldSchema),
  outOfBounds: z.array(AvatarBoundsIssueSchema),
});
export type AvatarPreview = z.infer<typeof AvatarPreviewSchema>;
export const AvatarStatusSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('none') }),
  z.strictObject({
    state: z.literal('published'),
    publishedOn: z.iso.date(),
    expiresOn: z.iso.date(),
    stamp: AvatarStampSchema,
  }),
]);
export type AvatarStatus = z.infer<typeof AvatarStatusSchema>;
export const AvatarOwnerSchema = z.strictObject({
  status: AvatarStatusSchema,
  published: AvatarPublicSchema.nullable(),
});
export type AvatarOwner = z.infer<typeof AvatarOwnerSchema>;
export const AvatarPreviewResponseSchema = z.strictObject({
  ok: z.literal(true),
  preview: AvatarPreviewSchema,
  token: z.string().regex(/^[0-9a-f]{64}$/),
});
export const AvatarOwnerResponseSchema = AvatarOwnerSchema.extend({
  ok: z.literal(true),
});
