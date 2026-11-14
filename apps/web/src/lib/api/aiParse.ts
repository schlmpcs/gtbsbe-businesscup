// Client for POST /api/ai/parse (Y12): `{ kind: 'life' | 'purchase' | 'loan', text }` →
// ProfilePatch / Purchase / LoanInput. The response is validated with the contract's zod schema
// here as well; the values are inputs the user must confirm, never results.
import {
  LoanInputSchema, ProfilePatchSchema, PurchaseSchema,
  type LoanInput, type ProfilePatch, type Purchase,
} from '@lifeguessr/types';
import { z } from 'zod';
import { postJson } from './http';

export type ParseKind = 'life' | 'purchase' | 'loan';
export type ParseResultOf = { life: ProfilePatch; purchase: Purchase; loan: LoanInput };

const schemas = { life: ProfilePatchSchema, purchase: PurchaseSchema, loan: LoanInputSchema } as const;

/** The typed value, bare (the contract) or in a `{ value }` / `{ data }` envelope. */
function responseSchema<K extends ParseKind>(kind: K): z.ZodType<ParseResultOf[K]> {
  const schema = schemas[kind] as unknown as z.ZodType<ParseResultOf[K]>;
  // Envelopes first: ProfilePatchSchema is all-optional and would accept `{ value: ... }` as `{}`.
  return z.union([
    z.object({ value: schema }).transform((r) => r.value),
    z.object({ data: schema }).transform((r) => r.data),
    schema,
  ]) as unknown as z.ZodType<ParseResultOf[K]>;
}

/** True when the parser found nothing to apply (an empty ProfilePatch). */
export function isEmptyParse(kind: ParseKind, value: unknown): boolean {
  if (kind !== 'life') return false;
  const p = value as ProfilePatch;
  return (
    Object.keys(p.spending ?? {}).length === 0 && (p.debts ?? []).length === 0 && p.retirementShare === undefined
  );
}

export function parseText<K extends ParseKind>(
  kind: K,
  text: string,
  opts: { anonId?: string; signal?: AbortSignal; url?: string } = {},
): Promise<ParseResultOf[K]> {
  return postJson(opts.url ?? '/api/ai/parse', { kind, text }, responseSchema(kind), opts);
}
