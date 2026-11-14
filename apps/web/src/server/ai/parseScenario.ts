// Server-only: a "What if…" sentence → one ScenarioChange for /api/ai/parse (kind 'scenario').
//
// The model only extracts fields (which kind of change, the place as written, the numbers as
// written); code maps the place to one of our ZIPs, converts units and validates with
// ScenarioChangeSchema. With no API key, or when the model fails or its answer does not validate,
// the rules reader (./scenarioRules) reads the sentence instead. Either way the user confirms the
// change before it is used. Nothing is stored.
import { takeHomeFromGrossRaise } from '@lifeguessr/engine';
import { AREA_TIERS, KID_AGES, PurchaseSchema, ScenarioChangeSchema, ZipSchema, type Purchase, type ScenarioChange } from '@lifeguessr/types';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { devLog, llmModel, responseText, type LlmClient } from './client';
import { MAX_PARSE_TEXT, WIRE_SCHEMAS } from './schemas';
import { parseScenarioRules, resolvePlace, type ScenarioParse } from './scenarioRules';

export const ScenarioParseRequestSchema = z.object({
  kind: z.literal('scenario'),
  text: z.string().trim().min(1, 'text is empty').max(MAX_PARSE_TEXT, `text is longer than ${MAX_PARSE_TEXT} characters`),
  /** The user's ZIP, so "we move to the suburbs" can mean their own metro's suburbs. */
  homeZip: ZipSchema.optional(),
});
export type ScenarioParseRequest = z.infer<typeof ScenarioParseRequestSchema>;

export const ScenarioWireSchema = z.object({
  kind: z.enum(['move', 'kid', 'income', 'rent', 'purchase', 'none'])
    .describe('The one change the sentence describes; "none" if it describes no change of these kinds.'),
  place: z.string().nullable().describe('move: the city or ZIP as written (e.g. "Austin"), or null.'),
  placeTier: z.enum(AREA_TIERS).nullable()
    .describe('move: "suburb" for the suburbs, "expensive" for downtown or a pricier area, "cheap" for a cheaper area; else null.'),
  kidAge: z.enum(KID_AGES).nullable().describe('kid: infant for a baby, else the age band stated; null if not a kid.'),
  startsInMonths: z.number().nullable().describe('When it starts, in months from now: "next year" → 12, "in 2 years" → 24, "now" → 0; null if not stated.'),
  incomeAmount: z.number().nullable().describe('income: the amount of the raise or cut as written, positive, in dollars; null otherwise.'),
  incomeDirection: z.enum(['up', 'down']).nullable(),
  incomePeriod: z.enum(['month', 'year']).nullable().describe('income: whether the amount is per month or per year; null if not stated.'),
  incomeTakeHome: z.boolean().nullable().describe('income: true if the amount is after tax (take-home), false if before tax, null if not stated.'),
  rentMonthly: z.number().nullable().describe('rent: the new monthly rent in dollars; null otherwise.'),
  purchase: WIRE_SCHEMAS.purchase.nullable().describe('purchase: what is bought and how it is paid; null otherwise.'),
});
type ScenarioWire = z.infer<typeof ScenarioWireSchema>;

const SYSTEM = `You turn one "What if…" sentence from a US adult into JSON for an educational budget simulator.
Rules:
- Copy only what the text states. You may convert units ("$10k" → 10000, "5-year loan" → 60 months, "next year" → 12 months) but do no other arithmetic.
- Use null for anything the text does not state. Never guess typical values.
- Rates are decimals per year: 6.9% → 0.069. Never write a percent number such as 6.9.
- For a place, copy the city or ZIP as written; do not pick a ZIP yourself.
- Do not give advice and do not compute results.`;

const CAR_RE = /\b(car|truck|suv|sedan|minivan|van|pickup|vehicle)\b/i;

type Converted = ScenarioParse | { retry: string[] };

function convert(w: ScenarioWire, req: ScenarioParseRequest): Converted {
  const start = w.startsInMonths !== null && w.startsInMonths > 0 ? Math.round(w.startsInMonths) : undefined;
  let value: ScenarioChange;
  const inferred: string[] = [];
  switch (w.kind) {
    case 'none':
      return { ok: false, code: 'nothing_found' };
    case 'move': {
      const place = resolvePlace(w.place, w.placeTier, req.homeZip);
      if (place === null || 'unknown' in place) return { ok: false, code: 'incomplete', missing: ['move.zip'] };
      value = { kind: 'move', zip: place.zip };
      if (!w.place || !/\d{5}/.test(w.place)) inferred.push('zip');
      break;
    }
    case 'kid':
      value = { kind: 'kid', age: w.kidAge ?? 'infant', ...(start !== undefined && { inMonths: start }) };
      if (w.startsInMonths === null) inferred.push('inMonths');
      break;
    case 'income': {
      if (w.incomeAmount === null) return { ok: false, code: 'incomplete', missing: ['income.monthlyDelta'] };
      const signed = (w.incomeDirection === 'down' ? -1 : 1) * Math.abs(w.incomeAmount);
      if (w.incomePeriod === 'month') value = { kind: 'income', monthlyDelta: signed };
      else if (w.incomeTakeHome === true) {
        value = { kind: 'income', monthlyDelta: signed / 12 };
        inferred.push('monthlyDelta');
      } else {
        value = { kind: 'income', monthlyDelta: takeHomeFromGrossRaise(signed), grossYearly: signed };
        inferred.push('monthlyDelta');
      }
      break;
    }
    case 'rent':
      if (w.rentMonthly === null) return { ok: false, code: 'incomplete', missing: ['rent.monthly'] };
      value = { kind: 'rent', monthly: w.rentMonthly };
      break;
    case 'purchase': {
      const p = w.purchase;
      if (!p || p.amount === null) return { ok: false, code: 'incomplete', missing: ['purchase.amount'] };
      let payWith: Purchase['payWith'] = p.payWith === 'loan' ? 'cash' : p.payWith;
      if (p.payWith === 'loan') {
        const l = p.loan;
        const missing = !l ? ['payWith.loan.apr', 'payWith.loan.termMonths'] : [
          ...(l.apr === null ? ['payWith.loan.apr'] : []), ...(l.termMonths === null ? ['payWith.loan.termMonths'] : []),
        ];
        if (missing.length > 0) return { ok: false, code: 'incomplete', missing };
        payWith = {
          loan: {
            amount: l!.amount ?? p.amount, apr: l!.apr!, termMonths: l!.termMonths!,
            ...(l!.downPayment !== null && { downPayment: l!.downPayment }),
            ...(l!.fees !== null && { fees: l!.fees }),
          },
        };
      }
      const purchase = { label: p.label.trim() || 'Purchase', amount: p.amount, recurring: p.recurring === 'none' ? false : p.recurring, payWith };
      const checked = PurchaseSchema.safeParse(purchase);
      if (!checked.success) return { retry: checked.error.issues.slice(0, 6).map((i) => `purchase.${i.path.join('.')}: ${i.message}`) };
      value = {
        kind: 'purchase', purchase: checked.data,
        ...(CAR_RE.test(p.label) && { category: 'car' as const }),
        ...(start !== undefined && { inMonths: start }),
      };
      break;
    }
  }
  const checked = ScenarioChangeSchema.safeParse(value);
  if (!checked.success) return { retry: checked.error.issues.slice(0, 6).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  return { ok: true, value: checked.data, inferred };
}

export type ScenarioOutcome = (ScenarioParse & { ok: true; parsedBy: 'ai' | 'rules' }) | (ScenarioParse & { ok: false });

let format: { type: 'json_schema'; schema: Record<string, unknown> } | null = null;
function outputFormat() {
  if (!format) {
    const { type, schema } = zodOutputFormat(ScenarioWireSchema as z.ZodType);
    format = { type, schema };
  }
  return format;
}

/** The model's reading when it works and validates, otherwise the rules reader's. */
export async function parseScenario(req: ScenarioParseRequest, client: LlmClient | null): Promise<ScenarioOutcome> {
  const rules = (): ScenarioOutcome => {
    const r = parseScenarioRules(req.text, req.homeZip);
    return r.ok ? { ...r, parsedBy: 'rules' } : r;
  };
  if (!client) return rules();

  let content = `Sentence to read:\n<text>\n${req.text}\n</text>`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string;
    try {
      const response = await client.messages.create({
        model: llmModel(),
        max_tokens: 2048,
        output_config: { effort: 'low', format: outputFormat() },
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      });
      if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return rules();
      text = responseText(response);
    } catch (error) {
      devLog('ai/parse', 'scenario provider error', String(error));
      return rules();
    }
    devLog('ai/parse', `scenario response (attempt ${attempt})`, text);
    let wire: ScenarioWire;
    try {
      const parsed = ScenarioWireSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return rules();
      wire = parsed.data;
    } catch {
      return rules();
    }
    const out = convert(wire, req);
    if (!('retry' in out)) {
      // The model found nothing: the rules reader may still know the phrasing.
      if (!out.ok && out.code === 'nothing_found') return rules();
      return out.ok ? { ...out, parsedBy: 'ai' } : out;
    }
    content = `Sentence to read:\n<text>\n${req.text}\n</text>\n\nYour previous answer was:\n${text}\n\nIt failed validation:\n${out.retry.map((i) => `- ${i}`).join('\n')}\n\nReturn corrected JSON. Rates are decimals (6.9% → 0.069).`;
  }
  return rules();
}
