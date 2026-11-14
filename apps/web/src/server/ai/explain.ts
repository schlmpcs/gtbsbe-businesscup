// Server-only: a two-sentence plain-language explanation of an engine result (/api/ai/explain).
//
// The model may only restate numbers we give it. Every number in its answer is checked against
// the input (allowing display rounding such as $48,213.77 → "$48,214" or "$48K"); a sentence
// with any other number, the wrong sentence count, or lender/securities/tax advice is rejected.
// One retry, then the deterministic template from @/copy. The template is also the answer when
// no API key is configured or the provider fails, so the app works without a key.
import { ai as copy } from '@/copy/ai';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { formatMoney, formatRate } from '@/lib/format';
import { devLog, llmModel, responseText, type LlmClient } from './client';
import { allowedForms, unsupportedNumbers } from './numbers';
import { type ExplainRequest } from './schemas';

export type ExplainOutcome = { text: string; source: 'ai' | 'template' };

const MAX_ATTEMPTS = 2;
const MAX_CHARS = 420;
/** The forecast horizon ("in 10 years") is part of what effect10y means, so it may be named. */
const HORIZON_YEARS = 10;

const SYSTEM = `You explain one result of an educational budget simulator to a US adult in plain words.
Rules:
- Write exactly two short sentences, plain text, no lists or markdown.
- Use only the numbers in the facts you are given, written as given. Do not compute, round differently, add, compare or invent any other number, date, rate or duration.
- Explain what the move or loan means for the person; the numbers come from the simulation.
- Never name or recommend a lender, bank, card issuer, investment, fund, stock or other security, and give no tax advice.
- This is an educational simulation, not financial advice; don't promise outcomes.`;

// ----- facts sent to the model ---------------------------------------------------------------

type Facts = { lines: string[]; numbers: number[] };

const signedMoney = (v: number) => formatMoney(v, { signed: true });

function moveFacts(move: NonNullable<ExplainRequest['move']>, facts: Facts) {
  facts.lines.push(`Move: ${copy.moveSummary(move.kind, move.category)}`);
  facts.lines.push(`Change in net worth after 10 years: ${signedMoney(move.effect10y)}`);
  facts.numbers.push(move.effect10y);
  for (const category of COST_CATEGORIES) {
    const amount = move.patch.spending?.[category];
    if (amount === undefined) continue;
    facts.lines.push(`New monthly spending on ${copy.categoryLabels[category]}: ${formatMoney(amount)}`);
    facts.numbers.push(amount);
  }
  for (const debt of move.patch.debts ?? []) {
    if (debt.extraPayment !== undefined) {
      facts.lines.push(`Extra monthly payment on a debt: ${formatMoney(debt.extraPayment)}`);
      facts.numbers.push(debt.extraPayment);
    }
    if (debt.apr !== undefined) {
      facts.lines.push(`New APR on a debt: ${formatRate(debt.apr)}`);
      facts.numbers.push(debt.apr);
    }
  }
  if (move.patch.retirementShare !== undefined) {
    facts.lines.push(`Share of surplus saved for retirement: ${formatRate(move.patch.retirementShare)}`);
    facts.numbers.push(move.patch.retirementShare);
  }
}

function loanFacts(loan: NonNullable<ExplainRequest['loanResult']>, facts: Facts) {
  facts.lines.push(`Loan monthly payment: ${formatMoney(loan.monthly)}`);
  facts.lines.push(`Total interest: ${formatMoney(loan.totalInterest)}`);
  facts.lines.push(`Total cost: ${formatMoney(loan.totalCost)}`);
  facts.lines.push(
    loan.payoffMonth === null
      ? 'Payoff: never (the payment does not cover the interest)'
      : `Paid off after: ${loan.payoffMonth} months`,
  );
  facts.lines.push(`Debt payments as a share of take-home pay: ${formatRate(loan.debtLoadBefore)} before, ${formatRate(loan.debtLoadAfter)} after`);
  facts.lines.push(`Change in net worth after 10 years: ${signedMoney(loan.effect10y)}`);
  facts.numbers.push(loan.monthly, loan.totalInterest, loan.totalCost, loan.debtLoadBefore, loan.debtLoadAfter, loan.effect10y);
  if (loan.payoffMonth !== null) facts.numbers.push(loan.payoffMonth, loan.payoffMonth / 12); // months or years
}

function buildFacts(req: ExplainRequest): Facts {
  const facts: Facts = { lines: [], numbers: [HORIZON_YEARS] };
  if (req.move) moveFacts(req.move, facts);
  if (req.loanResult) loanFacts(req.loanResult, facts);
  return facts;
}

// ----- guards --------------------------------------------------------------------------------

const ADVICE_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /\b(lenders?|banks?|credit unions?|card issuers?)\b/i, why: 'mentions lenders' },
  {
    re: /\b(chase|wells fargo|bank of america|citi(bank)?|capital one|american express|amex|discover|sofi|lightstream|marcus|ally|upstart|lendingclub|navy federal|synchrony|barclays)\b/i,
    why: 'names a financial company',
  },
  {
    re: /\b(stocks?|etfs?|index funds?|mutual funds?|bonds?|crypto(currency)?|bitcoin|ethereum|s&p|nasdaq|securities|brokerage)\b/i,
    why: 'mentions investments',
  },
  { re: /\b(tax(es)? (deductions?|credits?|brackets?|returns?|advice)|deduct(ible|ion)?s?|write[- ]offs?|irs)\b/i, why: 'gives tax advice' },
];

/** Sentence count: ., ! or ? followed by whitespace or the end ("$1.2K" is not a boundary). */
function sentenceCount(text: string): number {
  return (text.match(/[.!?]+(?=\s|$)/g) ?? []).length;
}

export function explanationIssues(text: string, allowed: readonly number[]): string[] {
  const issues: string[] = [];
  if (!text) return ['the answer is empty'];
  if (text.length > MAX_CHARS) issues.push(`the answer is longer than ${MAX_CHARS} characters`);
  if (/[\n*#`]/.test(text)) issues.push('use plain text on one line, no markdown');
  const sentences = sentenceCount(text);
  if (sentences !== 2 || !/[.!?]$/.test(text)) issues.push(`write exactly two sentences (found ${sentences})`);
  const extra = unsupportedNumbers(text, allowed);
  if (extra.length > 0) issues.push(`these numbers are not in the facts: ${extra.join(', ')}`);
  for (const { re, why } of ADVICE_PATTERNS) if (re.test(text)) issues.push(`the answer ${why}`);
  return issues;
}

// ----- template ------------------------------------------------------------------------------

export function templateExplanation(req: ExplainRequest): string {
  const { move, loanResult: loan } = req;
  if (move && loan) return copy.explain.moveAndLoan(move.kind, move.category, formatMoney(loan.monthly));
  if (move) {
    return copy.explain.move(move.kind, move.category, formatMoney(Math.abs(move.effect10y)), move.effect10y >= 0);
  }
  if (loan) {
    return copy.explain.loan(
      formatMoney(loan.monthly),
      formatMoney(loan.totalInterest),
      loan.payoffMonth === null ? null : String(loan.payoffMonth),
    );
  }
  throw new Error('explain request has neither move nor loanResult'); // excluded by ExplainRequestSchema
}

// ----- main ----------------------------------------------------------------------------------

export async function explain(req: ExplainRequest, client: LlmClient | null): Promise<ExplainOutcome> {
  const template = (): ExplainOutcome => ({ text: templateExplanation(req), source: 'template' });
  if (!client) return template();

  const facts = buildFacts(req);
  const allowed = allowedForms(facts.numbers);
  const factsText = `Facts:\n${facts.lines.map((l) => `- ${l}`).join('\n')}`;

  let content = factsText;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    devLog('ai/explain', `prompt (attempt ${attempt})`, { system: SYSTEM, content });
    let response;
    try {
      response = await client.messages.create({
        model: llmModel(),
        max_tokens: 1024, // adaptive thinking counts toward this; the answer is two sentences
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      });
    } catch (error) {
      devLog('ai/explain', 'provider error', String(error));
      return template();
    }
    const text = responseText(response).replace(/\s+/g, ' ').trim();
    devLog('ai/explain', `response (attempt ${attempt})`, { stop_reason: response.stop_reason, text });
    if (response.stop_reason === 'refusal') return template();

    const issues = response.stop_reason === 'max_tokens'
      ? ['the answer was cut off']
      : explanationIssues(text, allowed);
    if (issues.length === 0) return { text, source: 'ai' };

    content = `${factsText}

Your previous answer was:
${text}

It broke these rules:
${issues.map((i) => `- ${i}`).join('\n')}

Write a new answer: exactly two sentences, using only numbers from the facts.`;
  }
  return template();
}
