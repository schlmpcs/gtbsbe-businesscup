// Server-only: free text → typed input (ProfilePatch / Purchase / LoanInput) for /api/ai/parse.
//
// The model only transcribes numbers the user wrote; it computes nothing. Its JSON is validated
// with the canonical zod schemas, plus a check that rates came back as decimals. On a validation
// failure we ask once more with the problems listed, then give up with a typed error so the UI
// falls back to the manual form. Parsed values are inputs: the user confirms them in the UI.
import {
  COST_CATEGORIES, LoanInputSchema, ProfilePatchSchema, PurchaseSchema,
  type LoanInput, type ProfilePatch, type Purchase,
} from '@lifeguessr/types';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { type z } from 'zod';
import { devLog, llmModel, responseText, type LlmClient } from './client';
import { extractNumbers, tokenMatches, type NumberToken } from './numbers';
import { WIRE_SCHEMAS, type ParseKind, type ParseRequest, type WireOutput } from './schemas';

export type ParsedValue = {
  life: ProfilePatch;
  purchase: Purchase;
  loan: LoanInput;
};

export type ParseErrorCode =
  | 'unavailable'     // no ANTHROPIC_API_KEY: use the manual form
  | 'nothing_found'   // the text holds nothing we can use
  | 'incomplete'      // a required value (e.g. APR) isn't in the text; `missing` lists it
  | 'invalid_output'  // still invalid after one retry
  | 'upstream_error'; // the provider failed or declined

export type ParseOutcome =
  | {
      ok: true;
      kind: ParseKind;
      value: ParsedValue[ParseKind];
      /** Paths of values not written literally in the text (e.g. "5-year" → termMonths 60). */
      inferred: string[];
    }
  | { ok: false; code: ParseErrorCode; issues?: string[]; missing?: string[] };

const MAX_ATTEMPTS = 2; // the first try plus one retry

// ----- prompts -------------------------------------------------------------------------------

const BASE_RULES = `You turn a US adult's short description into JSON for an educational budget simulator.
Rules:
- Copy only numbers the text states. You may expand unit words ("$1.2k" → 1200, "5-year loan" → 60 months) but do no other arithmetic: if the text gives an amount for a different period than the field (weekly, yearly), use null.
- Use null for anything the text does not state. Never guess or fill in typical values.
- Money is in US dollars.
- Rates are decimals per year: 6.9% → 0.069, 24% → 0.24, 0.5% → 0.005. Never write a percent number such as 6.9 for a rate.
- Do not give advice and do not compute results.`;

const KIND_RULES: Record<ParseKind, string> = {
  life: `Extract monthly spending per category (rentUtilities = rent plus utilities; car = insurance, fuel and upkeep, not loan payments; eatingOut = restaurants and takeout), the share of surplus saved for retirement, and changes to the user's debts.
Only use debt ids from the list given with the text; if no list is given, return an empty debts array.`,
  purchase: `Extract one purchase: a short label, the price per occurrence, whether it repeats (none, monthly or yearly), and how it is paid: "loan" only if financing is mentioned (then fill loan), "card" for a credit card, otherwise "cash".`,
  loan: `Extract one loan: the amount (price before any down payment), APR, term in months, fees rolled into the loan, down payment and any extra monthly payment.`,
};

function systemPrompt(kind: ParseKind): string {
  return `${BASE_RULES}\n\n${KIND_RULES[kind]}`;
}

function userPrompt(req: ParseRequest): string {
  const debts = req.kind === 'life' && req.debts?.length
    ? `\n\nThe user's debts (id: kind): ${req.debts.map((d) => `${d.id}: ${d.kind}`).join(', ')}`
    : '';
  // The text is data, not instructions; fence it so it can't pose as part of the prompt.
  return `Text to read:\n<text>\n${req.text}\n</text>${debts}`;
}

function retryPrompt(req: ParseRequest, previous: string, issues: string[]): string {
  return `${userPrompt(req)}

Your previous answer was:
${previous}

It failed validation:
${issues.map((i) => `- ${i}`).join('\n')}

Return corrected JSON. Remember: rates are decimals (6.9% → 0.069) and unknown values are null.`;
}

const formats = new Map<ParseKind, { type: 'json_schema'; schema: Record<string, unknown> }>();
export function outputFormat(kind: ParseKind) {
  let format = formats.get(kind);
  if (!format) {
    // zodOutputFormat converts the zod schema to the JSON schema structured outputs accept.
    const { type, schema } = zodOutputFormat(WIRE_SCHEMAS[kind] as z.ZodType);
    format = { type, schema };
    formats.set(kind, format);
  }
  return format;
}

// ----- wire → contract -----------------------------------------------------------------------

type Converted<K extends ParseKind> =
  | { value: ParsedValue[K] }
  | { missing: string[] }
  | { issues: string[] }
  | { empty: true };

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as {
    [P in keyof T]?: Exclude<T[P], null>;
  };

function loanFromWire(w: WireOutput<'loan'>, prefix = ''): { value: LoanInput } | { missing: string[] } {
  const missing = (['amount', 'apr', 'termMonths'] as const).filter((k) => w[k] === null).map((k) => prefix + k);
  if (missing.length > 0) return { missing };
  return { value: defined(w) as LoanInput };
}

function convert<K extends ParseKind>(kind: K, wire: unknown, req: ParseRequest): Converted<K> {
  if (kind === 'loan') {
    const w = wire as WireOutput<'loan'>;
    if (Object.values(w).every((v) => v === null)) return { empty: true };
    return loanFromWire(w) as Converted<K>;
  }

  if (kind === 'purchase') {
    const w = wire as WireOutput<'purchase'>;
    if (w.amount === null) return { missing: ['amount'] };
    let payWith: Purchase['payWith'];
    if (w.payWith === 'loan') {
      if (!w.loan) return { missing: ['payWith.loan'] };
      const loan = loanFromWire(w.loan, 'payWith.loan.');
      if ('missing' in loan) return loan;
      payWith = { loan: loan.value };
    } else {
      payWith = w.payWith;
    }
    const value: Purchase = {
      label: w.label.trim(),
      amount: w.amount,
      recurring: w.recurring === 'none' ? false : w.recurring,
      payWith,
    };
    return { value } as Converted<K>;
  }

  // life
  const w = wire as WireOutput<'life'>;
  const issues: string[] = [];
  const spending = defined(w.spending);
  const knownIds = new Set((req.debts ?? []).map((d) => d.id));
  const debts: NonNullable<ProfilePatch['debts']> = [];
  for (const d of w.debts) {
    if (d.apr === null && d.extraPayment === null) continue;
    if (!knownIds.has(d.id)) {
      issues.push(`debts: id "${d.id}" is not one of the listed debt ids`);
      continue;
    }
    debts.push({ id: d.id, ...defined({ apr: d.apr, extraPayment: d.extraPayment }) });
  }
  if (issues.length > 0) return { issues };
  const patch: ProfilePatch = {};
  if (Object.keys(spending).length > 0) patch.spending = spending;
  if (debts.length > 0) patch.debts = debts;
  if (w.retirementShare !== null) patch.retirementShare = w.retirementShare;
  if (Object.keys(patch).length === 0) return { empty: true };
  return { value: patch } as Converted<K>;
}

// ----- checks on the contract value ----------------------------------------------------------

type Leaf = { path: string; value: number; unit: 'money' | 'rate' | 'months' };

function numericLeaves(kind: ParseKind, value: ParsedValue[ParseKind]): Leaf[] {
  const leaves: Leaf[] = [];
  const loanLeaves = (l: LoanInput, prefix: string) => {
    leaves.push({ path: `${prefix}amount`, value: l.amount, unit: 'money' });
    leaves.push({ path: `${prefix}apr`, value: l.apr, unit: 'rate' });
    leaves.push({ path: `${prefix}termMonths`, value: l.termMonths, unit: 'months' });
    for (const k of ['fees', 'downPayment', 'extraPayment'] as const) {
      const v = l[k];
      if (v !== undefined) leaves.push({ path: `${prefix}${k}`, value: v, unit: 'money' });
    }
  };
  if (kind === 'loan') loanLeaves(value as LoanInput, '');
  if (kind === 'purchase') {
    const p = value as Purchase;
    leaves.push({ path: 'amount', value: p.amount, unit: 'money' });
    if (typeof p.payWith === 'object') loanLeaves(p.payWith.loan, 'payWith.loan.');
  }
  if (kind === 'life') {
    const p = value as ProfilePatch;
    for (const c of COST_CATEGORIES) {
      const v = p.spending?.[c];
      if (v !== undefined) leaves.push({ path: `spending.${c}`, value: v, unit: 'money' });
    }
    p.debts?.forEach((d, i) => {
      if (d.apr !== undefined) leaves.push({ path: `debts.${i}.apr`, value: d.apr, unit: 'rate' });
      if (d.extraPayment !== undefined) leaves.push({ path: `debts.${i}.extraPayment`, value: d.extraPayment, unit: 'money' });
    });
    if (p.retirementShare !== undefined) leaves.push({ path: 'retirementShare', value: p.retirementShare, unit: 'rate' });
  }
  return leaves;
}

/** A rate equal to a percent written in the text (6.9% → 6.9) was not converted to a decimal. */
function percentIssues(leaves: Leaf[], tokens: NumberToken[]): string[] {
  return leaves
    .filter((l) => l.unit === 'rate' && l.value > 0)
    .filter((l) => tokens.some((t) => t.percent && Math.abs(t.value - l.value) < 1e-9))
    .map((l) => `${l.path}: ${l.value} is a percent; write it as a decimal (${l.value}% → ${l.value / 100})`);
}

/** Leaves whose value isn't written in the text in any form (as is, as a percent, in years). */
function inferredPaths(leaves: Leaf[], tokens: NumberToken[]): string[] {
  return leaves
    .filter((l) => {
      const forms = [l.value];
      if (l.unit === 'rate') forms.push(l.value * 100);
      if (l.unit === 'months') forms.push(l.value / 12);
      return !tokens.some((t) => forms.some((f) => tokenMatches(t, f)));
    })
    .map((l) => l.path);
}

const CONTRACT_SCHEMAS: { [K in ParseKind]: z.ZodType<ParsedValue[K]> } = {
  life: ProfilePatchSchema,
  purchase: PurchaseSchema,
  loan: LoanInputSchema,
};

const formatIssues = (error: z.ZodError) =>
  error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);

/** Checks one model answer: a final outcome, or the issues to send back for the retry. */
function validate(
  req: ParseRequest,
  text: string,
  tokens: NumberToken[],
): { outcome: ParseOutcome } | { issues: string[] } {
  const { kind } = req;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { issues: ['the answer is not valid JSON'] };
  }
  const wire = WIRE_SCHEMAS[kind].safeParse(json);
  if (!wire.success) return { issues: formatIssues(wire.error) };

  const converted = convert(kind, wire.data, req);
  if ('empty' in converted) return { outcome: { ok: false, code: 'nothing_found' } };
  if ('missing' in converted) return { outcome: { ok: false, code: 'incomplete', missing: converted.missing } };
  if ('issues' in converted) return { issues: converted.issues };

  const checked = CONTRACT_SCHEMAS[kind].safeParse(converted.value);
  if (!checked.success) return { issues: formatIssues(checked.error) };

  const leaves = numericLeaves(kind, checked.data);
  const percent = percentIssues(leaves, tokens);
  if (percent.length > 0) return { issues: percent };

  return { outcome: { ok: true, kind, value: checked.data, inferred: inferredPaths(leaves, tokens) } };
}

// ----- main ----------------------------------------------------------------------------------

export async function parseText(req: ParseRequest, client: LlmClient | null): Promise<ParseOutcome> {
  if (!client) return { ok: false, code: 'unavailable' };
  const { kind } = req;
  const tokens = extractNumbers(req.text);
  const system = systemPrompt(kind);

  let issues: string[] = [];
  let previous = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const content = attempt === 1 ? userPrompt(req) : retryPrompt(req, previous, issues);
    devLog('ai/parse', `prompt (attempt ${attempt})`, { system, content });

    let response;
    try {
      response = await client.messages.create({
        model: llmModel(),
        max_tokens: 2048, // adaptive thinking counts toward this; the JSON itself is short
        output_config: { effort: 'low', format: outputFormat(kind) },
        system,
        messages: [{ role: 'user', content }],
      });
    } catch (error) {
      devLog('ai/parse', 'provider error', String(error));
      return { ok: false, code: 'upstream_error' };
    }
    const text = responseText(response);
    devLog('ai/parse', `response (attempt ${attempt})`, { stop_reason: response.stop_reason, text });

    if (response.stop_reason === 'refusal') return { ok: false, code: 'upstream_error' };

    const checked = response.stop_reason === 'max_tokens'
      ? { issues: ['the answer was cut off; return only the JSON'] }
      : validate(req, text, tokens);
    if ('outcome' in checked) return checked.outcome;
    previous = text;
    issues = checked.issues;
  }

  return { ok: false, code: 'invalid_output', issues };
}
