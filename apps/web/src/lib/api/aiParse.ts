// Client for POST /api/ai/parse (Y12, apps/web/app/api/ai/parse/route.ts):
//   { kind: 'life' | 'purchase' | 'loan' | 'spend', text, debts? }
//   → 200 { ok: true, kind, value, needsConfirmation: true, inferred: string[] }
//   → 4xx/5xx { ok: false, error: { code, missing? }, fallback: 'manualForm' }
// `value` is validated with the contract's zod schema here as well. It holds parsed *inputs* the
// user must confirm before they are applied, never results.
import {
  DEBT_KINDS, LoanInputSchema, ProfilePatchSchema, PurchaseSchema, SpendItemSchema, WhatIfParseSchema,
  type Debt, type LoanInput, type ProfilePatch, type Purchase, type SpendItem, type WhatIfParse,
} from '@lifeguessr/types';
import { z } from 'zod';
import { postJson } from './http';

export type ParseKind = 'life' | 'purchase' | 'loan' | 'spend';
export type ParseValueOf = { life: ProfilePatch; purchase: Purchase; loan: LoanInput; spend: SpendItem[] };
export type ParseResult<K extends ParseKind> = {
  value: ParseValueOf[K];
  /** Paths not written literally in the text (e.g. 'termMonths', 'spending.eatingOut'). */
  inferred: string[];
};

const valueSchemas = { life: ProfilePatchSchema, purchase: PurchaseSchema, loan: LoanInputSchema, spend: z.array(SpendItemSchema) } as const;

function responseSchema<K extends ParseKind>(kind: K) {
  return z.object({
    ok: z.literal(true),
    kind: z.literal(kind),
    value: valueSchemas[kind] as unknown as z.ZodType<ParseValueOf[K]>,
    inferred: z.array(z.string()).default([]),
  });
}

/** True when a parse found nothing to apply (an empty ProfilePatch). */
export function isEmptyParse(kind: ParseKind, value: unknown): boolean {
  if (kind === 'spend') return (value as SpendItem[]).length === 0;
  if (kind !== 'life') return false;
  const p = value as ProfilePatch;
  return Object.keys(p.spending ?? {}).length === 0 && (p.debts ?? []).length === 0 && p.retirementShare === undefined;
}

export type ParseOptions = {
  anonId?: string;
  signal?: AbortSignal;
  /** kind 'life': the profile's debts (ids and kinds only) so "my card is at 24%" maps to an id. */
  debts?: Pick<Debt, 'id' | 'kind'>[];
};

export async function parseText<K extends ParseKind>(kind: K, text: string, opts: ParseOptions = {}): Promise<ParseResult<K>> {
  const debts = kind === 'life' && opts.debts?.length
    ? opts.debts.filter((d) => (DEBT_KINDS as readonly string[]).includes(d.kind)).map(({ id, kind: k }) => ({ id, kind: k }))
    : undefined;
  const res = await postJson('/api/ai/parse', { kind, text, ...(debts ? { debts } : {}) }, responseSchema(kind), {
    anonId: opts.anonId,
    signal: opts.signal,
  });
  return { value: res.value, inferred: res.inferred };
}

// ----- kind 'plan': the /plan what-if field -------------------------------------------------------
// → 200 { ok: true, kind: 'plan', value: WhatIfParse, needsConfirmation: true, inferred }
// → 4xx/5xx { ok: false, error: { code } } (503 unavailable, 422 nothing_found / invalid_output, 429, 502).
// The value holds event types, years, labels and a metro (amounts only when written): the engine
// (whatIfEvents) computes every number from them.
const whatIfResponseSchema = z.object({
  ok: z.literal(true),
  kind: z.literal('plan'),
  value: WhatIfParseSchema,
  inferred: z.array(z.string()).default([]),
});

export async function parseWhatIf(
  text: string,
  opts: Pick<ParseOptions, 'anonId' | 'signal'> = {},
): Promise<{ value: WhatIfParse; inferred: string[] }> {
  const res = await postJson('/api/ai/parse', { kind: 'plan', text }, whatIfResponseSchema, opts);
  return { value: res.value, inferred: res.inferred };
}
