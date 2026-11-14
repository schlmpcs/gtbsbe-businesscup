// Server-only: the AI 10-year forecast for /api/ai/forecast (docs/ENGINEERING.md → AI forecast).
//
// One model call answers for the profile as it is (`base`) and for every scenario (a candidate
// move's patch): ten yearly net-worth anchors each, in nominal dollars. The model computes none
// of the plumbing: month 0 is today's balance sheet, exact, and the 121 monthly points are
// interpolated in code (`anchorsToForecast`). Every answer is checked in code before it is used:
// the anchors' structure, the ids, a sanity envelope around the rules forecast of the same
// inputs, and each scenario's own 10-year effect (@lifeguessr/engine `anchors.ts`). A failed
// answer goes back to the model once with the issues listed; after that, or with no key, a
// provider error, a refusal or a timeout, the answer is the rules bundle, labeled `source: 'rules'`.
//
// Time: each call has a timeout and no SDK retry, and the whole request has a deadline that also
// covers the retry, so the user waits a bounded time. The model sees `forecastFacts(profile)`
// only: numbers and estimate flags, no ZIP, no move ids (CLAUDE.md rule 6).
import { createHash } from 'node:crypto';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  anchorIssues, anchorsToForecast, estimateSpread, forecastFacts, forecastSanityIssues, resolveRates,
  rulesBundle, scenarioEffectIssues, simulate,
} from '@lifeguessr/engine';
import type { Forecast, ForecastBundle, Money, Rate, YearAnchor } from '@lifeguessr/types';
import { z } from 'zod';
import { canonicalJson } from '@/lib/canonicalJson';
import { formatMoney } from '@/lib/format';
import { devLog, forecastModel, responseText, type LlmClient } from './client';
import { BASE_FORECAST_ID, type ForecastRequest } from './schemas';

/**
 * Version of the prompt and its payload. Bump it whenever `forecastPrompt` changes what the model
 * is told or sees, so cached answers from an older prompt are not served for the new one.
 * `PROMPT_FINGERPRINT` is a safety net under it for the system prompt and the output schema (it
 * does not cover the request text built in `forecastPrompt` or `retryContent`: bump for those).
 */
export const PROMPT_VERSION = 2;

/** Timeout of the first model call. */
export const FORECAST_CALL_TIMEOUT_MS = 12_000;
/** The whole request, retry included: after this the rules bundle is returned. */
export const FORECAST_DEADLINE_MS = 20_000;
/** A second attempt starts only if at least this much of the deadline is left; it gets all of it as its timeout. */
export const FORECAST_MIN_RETRY_MS = 8_000;

const MAX_ATTEMPTS = 2; // the first try plus one retry
/** Adaptive thinking counts toward this: 9 forecasts of 10 anchors are ~2K tokens of JSON; the rest is headroom. */
const MAX_OUTPUT_TOKENS = 8_192;
/** Issues quoted back to the model in the retry; a wrong-unit answer produces dozens that say the same thing. */
const MAX_ISSUES_IN_PROMPT = 20;

// ----- wire shape ----------------------------------------------------------------------------

// Plain numbers on purpose (no `.int()`): structured outputs would put a safe-integer range in the
// description. Whether the years are 1..10 is checked by `anchorIssues`, which words it for the model.
// No `.describe()` on the arrays: zod would then emit `$defs`/`$ref` instead of inline objects, and
// the descriptions that matter sit on the fields (and in the system prompt).
const WireAnchorSchema = z.object({
  year: z.number().describe('Years from today: 1 for the end of next year, up to 10. Ten anchors per forecast, in order.'),
  low: z.number().describe('Low end of the range: net worth at the end of that year, nominal US dollars.'),
  mid: z.number().describe('Best estimate of net worth at the end of that year, nominal US dollars.'),
  high: z.number().describe('High end of the range: net worth at the end of that year, nominal US dollars.'),
});

const WireForecastSchema = z.object({
  forecasts: z.array(z.object({
    id: z.string().describe('"base" or one of the scenario ids, written exactly as listed; each id exactly once.'),
    anchors: z.array(WireAnchorSchema),
  })),
});

let format: { type: 'json_schema'; schema: Record<string, unknown> } | undefined;
/** The structured-output format the model is held to (built once). */
export function forecastOutputFormat() {
  if (!format) {
    const { type, schema } = zodOutputFormat(WireForecastSchema as z.ZodType);
    format = { type, schema };
  }
  return format;
}

// ----- prompt --------------------------------------------------------------------------------

const SYSTEM = `You are the forecaster inside an educational budget simulator for US adults. You estimate how a person's net worth could develop over the next 10 years. This is an educational simulation, not financial advice: do not recommend lenders, investments or securities, and add no commentary.

Rules:
- Net worth = cash + retirement balance − all debt balances. It can be negative when debts exceed assets. Today's value is given; you forecast the end of each year, years 1 through 10 only. Do not return year 0.
- Use nominal US dollars (not adjusted for inflation), written as plain dollar amounts, never in thousands or millions.
- For every year give low, mid and high, with low ≤ mid ≤ high. mid is your best estimate.
- The range (low to high) is the uncertainty that comes from the inputs marked "isEstimate": true, which are guesses by the person or by the simulator. Inputs marked "isEstimate": false are exact. The more estimated inputs, the wider the range; with no estimated inputs the range is narrow. Do not widen it for market or inflation risk.
- Return a forecast for the id "base" (the situation as given) and one for every scenario id listed, each id exactly once and no other ids. A scenario is the same person with its patch applied from today on. Work out what each patch changes in income, spending, debt interest and payments, and retirement saving, and let its forecast end where that change leads, compared with "base". A scenario that helps ends higher than "base"; do not copy "base" for a scenario unless its patch changes nothing.
- Use the simulator's assumptions given in the request for inflation, take-home pay growth, and returns on cash and retirement.
- Reply with JSON only, matching the schema.`;

/**
 * sha256 of the text the model gets whatever the request is: the system prompt and the structured-output
 * format (the schema with its field descriptions). The key order inside the format does not matter.
 */
export function promptFingerprint(system: string, outputFormat: unknown): string {
  return createHash('sha256').update(canonicalJson({ system, outputFormat })).digest('hex');
}

/**
 * Fingerprint of the system prompt and the output format this process sends, computed once at load.
 * It is part of every cache key (`forecastKey`) next to `PROMPT_VERSION`, so editing either text
 * without a bump still stops cached answers of the old text from being served.
 */
export const PROMPT_FINGERPRINT: string = promptFingerprint(SYSTEM, forecastOutputFormat());

/** A rate as the decimal the data uses, with the percent next to it for the reader: `0.0345 (3.45%)`. */
const rateText = (rate: Rate): string => `${rate} (${+(rate * 100).toFixed(2)}%)`;

/** Today's net worth, exact: the balance sheet at month 0. */
const todayNetWorth = (req: ForecastRequest): Money => simulate(req.profile, 0).path[0]!.netWorth;

/**
 * The system prompt and the request text for the model: the profile's numbers with their estimate
 * flags (`forecastFacts`: no ZIP, no move ids), today's net worth, the simulator's assumptions, and
 * the scenarios to forecast. Change either text → bump `PROMPT_VERSION`.
 */
export function forecastPrompt(req: ForecastRequest): { system: string; content: string } {
  const rates = resolveRates(req.rates);
  const ids = [BASE_FORECAST_ID, ...req.scenarios.map((s) => s.id)];
  const scenarios = req.scenarios.length === 0
    ? 'There are no scenarios: return only "base".'
    : `Scenarios. Each is the situation above with its patch applied from today on. A patch sets spending categories to the given monthly amounts, adds extraPayment dollars a month to the debt with that id, replaces that debt's apr, or sets retirementShare, the share of each month's surplus saved for retirement:
${req.scenarios.map((s) => `- "${s.id}": ${JSON.stringify(s.patch)}`).join('\n')}`;

  const content = `Situation today. Money is in US dollars: amounts are per month, balances are as of today. Rates are decimals per year (0.2436 = 24.36%). "isEstimate": true marks a guess, false an exact value. spending.debtPayments is informational only: debt payments come from "debts" (minPayment plus any extraPayment), so do not count them twice.
${JSON.stringify(forecastFacts(req.profile))}

Net worth today (cash + retirement − debts): ${formatMoney(todayNetWorth(req))}.

The simulator's assumptions, for orientation:
- Inflation ${rateText(rates.inflationAnnual)} a year: prices rise at it.
- Take-home pay grows ${rateText(rates.incomeGrowthAnnual)} a year.
- Cash earns ${rateText(rates.cashYieldAnnual)} a year; retirement savings return ${rateText(rates.returnAnnualNominal)} a year, nominal.
- A shortfall that cash cannot cover goes on a credit card at ${rateText(rates.cardApr)} a year.
- Each debt accrues interest at its apr and is paid its minimum payment plus any extraPayment.
- The simulator builds its own range by moving every estimated input ${+(estimateSpread.value * 100).toFixed(2)}% against the person and ${+(estimateSpread.value * 100).toFixed(2)}% in their favor; yours may differ but should be of that order.

Return forecasts for these ids, each exactly once: ${ids.map((id) => `"${id}"`).join(', ')}.
${scenarios}`;
  return { system: SYSTEM, content };
}

function retryContent(content: string, previous: string | null, issues: readonly string[]): string {
  const shown = issues.slice(0, MAX_ISSUES_IN_PROMPT).map((i) => `- ${i}`);
  if (issues.length > shown.length) shown.push(`- ...and ${issues.length - shown.length} more like these`);
  return `${content}
${previous === null ? '' : `\nYour previous answer was:\n${previous}\n`}
It failed these checks:
${shown.join('\n')}

Return the corrected JSON for every id. Remember: nominal US dollars (not thousands), years 1 to 10 only, low ≤ mid ≤ high, each id exactly once.`;
}

// ----- checks --------------------------------------------------------------------------------

type Checked = { bundle: ForecastBundle } | { issues: string[] };

const describeId = (id: string): string => (id === BASE_FORECAST_ID ? 'base forecast' : `scenario "${id}"`);
const about = (id: string, issues: readonly string[]): string[] => issues.map((i) => `${describeId(id)}: ${i}`);

/**
 * Checks one model answer against the request and the rules bundle: either the AI bundle (labeled
 * with `model`, the one the request was sent to), or every issue found (so the retry can fix them all at once). Throws only if an engine check does, which
 * the caller treats as a failed attempt.
 */
function checkAnswer(req: ForecastRequest, text: string, rules: ForecastBundle, model: string): Checked {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { issues: ['the answer is not valid JSON'] };
  }
  const wire = WireForecastSchema.safeParse(raw);
  if (!wire.success) {
    return { issues: wire.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }

  // Ids: `base` plus each scenario, every one exactly once.
  const wanted = [BASE_FORECAST_ID, ...req.scenarios.map((s) => s.id)];
  const answers = new Map<string, YearAnchor[][]>();
  for (const f of wire.data.forecasts) answers.set(f.id, [...(answers.get(f.id) ?? []), f.anchors]);
  const issues: string[] = [];
  for (const id of wanted) {
    const count = answers.get(id)?.length ?? 0;
    if (count === 0) issues.push(`missing the forecast for id "${id}"`);
    else if (count > 1) issues.push(`the id "${id}" appears ${count} times; each id must appear exactly once`);
  }
  for (const id of answers.keys()) {
    if (!wanted.includes(id)) issues.push(`unknown id "${id}": use only ${wanted.map((w) => `"${w}"`).join(', ')}`);
  }

  // Each forecast on its own: structure, then month 0 and the interpolation, then the envelope.
  const today = todayNetWorth(req);
  const takeHomePay = req.profile.takeHomePay.value;
  const candidates = new Map<string, Forecast>();
  for (const id of wanted) {
    const given = answers.get(id);
    if (given?.length !== 1) continue; // already reported
    const anchors = given[0]!;
    const structure = anchorIssues(anchors);
    if (structure.length > 0) {
      issues.push(...about(id, structure));
      continue;
    }
    const candidate = anchorsToForecast(anchors, today);
    candidates.set(id, candidate);
    issues.push(...about(id, forecastSanityIssues(candidate, referenceOf(rules, id), takeHomePay)));
  }

  // Each scenario's own effect: the yearly envelope is too loose to see a move that does nothing.
  const base = candidates.get(BASE_FORECAST_ID);
  if (base) {
    for (const { id } of req.scenarios) {
      const scenario = candidates.get(id);
      if (!scenario) continue;
      issues.push(...about(id, scenarioEffectIssues(
        { base, scenario },
        { base: rules.base, scenario: referenceOf(rules, id) },
      )));
    }
  }
  if (issues.length > 0) return { issues };

  return {
    bundle: {
      source: 'ai',
      model,
      base: candidates.get(BASE_FORECAST_ID)!,
      scenarios: Object.fromEntries(req.scenarios.map((s) => [s.id, candidates.get(s.id)!])),
    },
  };
}

function referenceOf(rules: ForecastBundle, id: string): Forecast {
  const reference = id === BASE_FORECAST_ID ? rules.base : rules.scenarios[id];
  if (!reference) throw new RangeError(`the rules bundle has no forecast for "${id}"`);
  return reference;
}

// ----- main ----------------------------------------------------------------------------------

/**
 * One line per failed attempt, kept in production logs (`devLog` is development only, so without
 * this a provider outage is invisible). Diagnostics only: where it failed and a coarse why (the
 * error's class and HTTP status, the stop reason, how many checks failed). Never the prompt, the
 * answer, the error's message, or any profile value or id.
 */
function warnFailed(reason: string, detail: Record<string, string | number | undefined> = {}): void {
  const parts = Object.entries(detail).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`);
  console.warn(`[ai/forecast] attempt failed: ${reason}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`);
}

const errorClass = (error: unknown): string => (error instanceof Error ? error.constructor.name || error.name : typeof error);
/** The HTTP status of an SDK APIError (duck-typed: the SDK module is replaced in tests). */
const httpStatus = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
};

/**
 * Up to two attempts at an AI bundle; null when there is none to give (provider error, refusal,
 * two failed answers, out of time). Never throws.
 */
async function attempts(
  req: ForecastRequest,
  client: LlmClient,
  rules: ForecastBundle,
  model: string,
  deadlineAt: number,
  signal: AbortSignal,
): Promise<ForecastBundle | null> {
  try {
    const { system, content: firstContent } = forecastPrompt(req);
    let content = firstContent;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const remaining = deadlineAt - Date.now();
      if (signal.aborted) return null;
      if (attempt > 1 && remaining < FORECAST_MIN_RETRY_MS) return null;
      const timeout = attempt === 1 ? Math.min(FORECAST_CALL_TIMEOUT_MS, remaining) : remaining;

      devLog('ai/forecast', `prompt (attempt ${attempt}, v${PROMPT_VERSION})`, { system, content });
      let response;
      try {
        response = await client.messages.create(
          {
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            output_config: { effort: 'low', format: forecastOutputFormat() },
            system,
            messages: [{ role: 'user', content }],
          },
          // The SDK client retries on its own by default; we own the retry policy and the clock.
          { timeout, maxRetries: 0, signal },
        );
      } catch (error) {
        devLog('ai/forecast', 'provider error', String(error));
        // At the deadline `forecastWithModel` already said so; the abort error is the same event.
        if (!signal.aborted) warnFailed('provider_error', { attempt, error: errorClass(error), status: httpStatus(error) });
        return null;
      }
      const text = responseText(response);
      devLog('ai/forecast', `response (attempt ${attempt})`, { stop_reason: response.stop_reason, text });
      if (response.stop_reason === 'refusal') {
        warnFailed('refusal', { attempt, stop_reason: response.stop_reason });
        return null;
      }

      let checked: Checked;
      let checkError: string | undefined;
      if (response.stop_reason === 'max_tokens') {
        checked = { issues: ['the answer was cut off; return only the JSON'] };
      } else {
        try {
          checked = checkAnswer(req, text, rules, model);
        } catch (error) {
          devLog('ai/forecast', 'check error', String(error));
          checkError = errorClass(error);
          checked = { issues: ['the answer could not be checked; return every value as a finite number of US dollars'] };
        }
      }
      if ('bundle' in checked) return checked.bundle;
      devLog('ai/forecast', `rejected (attempt ${attempt})`, checked.issues);
      warnFailed(checkError ? 'check_error' : 'rejected', {
        attempt, stop_reason: response.stop_reason ?? undefined, issues: checked.issues.length, error: checkError,
      });
      content = retryContent(firstContent, response.stop_reason === 'max_tokens' ? null : text, checked.issues);
    }
  } catch (error) {
    devLog('ai/forecast', 'unexpected error', String(error));
    warnFailed('unexpected', { error: errorClass(error) });
  }
  return null;
}

/**
 * The forecast bundle for a request: the model's answer when it passes every check, otherwise the
 * rules bundle (`source: 'rules'`). The model, its checks and the clock never make this throw; the
 * only thing that can is the rules engine itself rejecting the request, which the schema rules out.
 */
export async function forecastWithModel(req: ForecastRequest, client: LlmClient | null): Promise<ForecastBundle> {
  const startedAt = Date.now();
  // Both the yardstick the answer is checked against and the fallback.
  const rules = rulesBundle(req.profile, req.scenarios, req.rates);
  if (!client) return rules;

  // Read once: the label must name the model this request was sent to, even if the environment changes meanwhile.
  const model = forecastModel();
  const deadlineAt = startedAt + FORECAST_DEADLINE_MS;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A call that ignores its timeout and signal must not hold the request: at the deadline we stop
  // waiting for it and abort it.
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[ai/forecast] attempt failed: deadline (${FORECAST_DEADLINE_MS} ms) reached`);
      controller.abort();
      resolve(null);
    }, Math.max(0, deadlineAt - Date.now()));
  });
  try {
    const ai = await Promise.race([attempts(req, client, rules, model, deadlineAt, controller.signal), expired]);
    return ai ?? rules;
  } finally {
    clearTimeout(timer);
  }
}
