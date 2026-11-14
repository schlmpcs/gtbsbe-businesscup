// Client for POST /api/ai/parse (Y12, apps/web/app/api/ai/parse/route.ts):
//   { kind: 'life' | 'purchase' | 'loan', text, debts? }
//   → 200 { ok: true, kind, value, needsConfirmation: true, inferred: string[] }
//   → 4xx/5xx { ok: false, error: { code, missing? }, fallback: 'manualForm' }
// `value` is validated with the contract's zod schema here as well. It holds parsed *inputs* the
// user must confirm before they are applied, never results.
import {
  DEBT_KINDS, LoanInputSchema, ProfilePatchSchema, PurchaseSchema, ScenarioChangeSchema,
  type Debt, type LoanInput, type ProfilePatch, type Purchase, type ScenarioChange,
} from '@lifeguessr/types';
import { z } from 'zod';
import { postJson } from './http';

export type ParseKind = 'life' | 'purchase' | 'loan';
export type ParseValueOf = { life: ProfilePatch; purchase: Purchase; loan: LoanInput };
export type ParseResult<K extends ParseKind> = {
  value: ParseValueOf[K];
  /** Paths not written literally in the text (e.g. 'termMonths', 'spending.eatingOut'). */
  inferred: string[];
};

const valueSchemas = { life: ProfilePatchSchema, purchase: PurchaseSchema, loan: LoanInputSchema } as const;

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

// ----- kind 'scenario' ("What if…") ------------------------------------------------------------

export type ScenarioParseResult = {
  value: ScenarioChange;
  inferred: string[];
  /** Who read the sentence: the model, or the rules reader (no API key, or the model failed). */
  parsedBy: 'ai' | 'rules';
};

const ScenarioResponseSchema = z.object({
  ok: z.literal(true),
  kind: z.literal('scenario'),
  value: ScenarioChangeSchema,
  inferred: z.array(z.string()).default([]),
  parsedBy: z.enum(['ai', 'rules']),
});

export type ScenarioParseOptions = { anonId?: string; signal?: AbortSignal; homeZip?: string };

/** A "What if…" sentence → one ScenarioChange for the user to confirm. `homeZip` lets "the suburbs" mean theirs. */
export async function parseScenarioText(text: string, opts: ScenarioParseOptions = {}): Promise<ScenarioParseResult> {
  const res = await postJson(
    '/api/ai/parse',
    { kind: 'scenario', text, ...(opts.homeZip ? { homeZip: opts.homeZip } : {}) },
    ScenarioResponseSchema,
    { anonId: opts.anonId, signal: opts.signal },
  );
  return { value: res.value, inferred: res.inferred, parsedBy: res.parsedBy };
}
