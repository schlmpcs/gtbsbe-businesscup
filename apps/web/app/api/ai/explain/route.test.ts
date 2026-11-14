import { MOVE_KINDS, type ExplainRequest, type LoanResult, type Move } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { z } from 'zod';
import { explanationIssues, templateExplanation } from '@/server/ai/explain';
import { aiRateLimiter } from '@/server/ai/http';
import { allowedForms } from '@/server/ai/numbers';
import type { ExplainRequestSchema } from '@/server/ai/schemas';
import { postRequest, reply } from '@/server/ai/testUtils';
import { POST } from './route';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const post = (body: unknown) => POST(postRequest('/api/ai/explain', body));

const move: Move = {
  id: 'payCardFirst:card-1',
  kind: 'payCardFirst',
  level: 1,
  effect10y: 48_213.77,
  patch: { debts: [{ id: 'card-1', extraPayment: 250 }] },
};

const loanResult: LoanResult = {
  monthly: 553.12,
  totalInterest: 5_187.2,
  totalCost: 33_187.2,
  payoffMonth: 60,
  debtLoadBefore: 0.12,
  debtLoadAfter: 0.21,
  effect10y: -9_412.5,
  schedule: [{ month: 1, interest: 161, principal: 392.12, balance: 27_607.88 }],
};

const GOOD = 'Putting an extra $250 a month on your credit card clears the most expensive debt first. In our simulation that adds about $48,214 to your net worth in 10 years.';
const INVENTED = 'Putting an extra $250 a month on your card saves you $3,100 in interest. In our simulation that adds about $48,214 to your net worth in 10 years.';

beforeEach(() => {
  create.mockReset();
  aiRateLimiter.reset();
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/ai/explain', () => {
  it('validates the shared ExplainRequest contract (checked by typecheck)', () => {
    expectTypeOf<ExplainRequest>().toExtend<z.input<typeof ExplainRequestSchema>>();
    expectTypeOf<z.infer<typeof ExplainRequestSchema>>().toExtend<ExplainRequest>();
  });

  it('returns the model sentence when it passes every guard', async () => {
    create.mockResolvedValueOnce(reply(GOOD));
    const res = await post({ move });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ text: GOOD, source: 'ai' });

    const params = create.mock.calls[0][0];
    const content = params.messages[0].content as string;
    expect(content).toContain('+$48,214');
    expect(content).toContain('$250');
    expect(params.system).toMatch(/exactly two/i);
  });

  it('rejects an invented number, retries once and accepts a clean answer', async () => {
    create.mockResolvedValueOnce(reply(INVENTED)).mockResolvedValueOnce(reply(GOOD));
    const res = await post({ move });
    expect(await res.json()).toEqual({ text: GOOD, source: 'ai' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[0].content).toContain('these numbers are not in the facts: 3,100');
  });

  it('falls back to the template when the retry also invents a number', async () => {
    create.mockResolvedValue(reply(INVENTED));
    const res = await post({ move });
    expect(await res.json()).toEqual({ text: templateExplanation({ move }), source: 'template' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['three sentences', `${GOOD} Keep it up.`],
    ['one sentence', 'In our simulation this adds about $48,214 to your net worth in 10 years.'],
    ['a named lender', 'Refinancing with SoFi lowers your rate. In our simulation that adds about $48,214 in 10 years.'],
    ['investment advice', 'Put the money in an index fund instead. In our simulation that adds about $48,214 in 10 years.'],
    ['tax advice', 'The interest is tax deductible. In our simulation that adds about $48,214 in 10 years.'],
  ])('rejects %s', async (_name, text) => {
    create.mockResolvedValue(reply(text));
    const body = await (await post({ move })).json();
    expect(body.source).toBe('template');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('explains a loan result, accepting months shown as years and rates as percents', async () => {
    const text = 'This loan costs $553 a month and is paid off in 5 years. Your debt payments go from 12% to 21% of your take-home pay.';
    create.mockResolvedValueOnce(reply(text));
    const res = await post({ loanResult });
    expect(await res.json()).toEqual({ text, source: 'ai' });
    // The schedule is not forwarded to the model.
    expect(create.mock.calls[0][0].messages[0].content).not.toContain('27,607');
  });

  it('explains a loan for a profile with no take-home pay: the debt load is said in words, not as a number', async () => {
    const noPay = { ...loanResult, debtLoadBefore: 0, debtLoadAfter: null };
    const text = 'This loan costs $553 a month and is paid off in 5 years. With no take-home pay in your profile, the payment has no income to come out of.';
    create.mockResolvedValueOnce(reply(text));
    const res = await post({ loanResult: noPay });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text, source: 'ai' });
    const content = create.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain('Take-home pay: none');
    expect(content).toContain('0% before, not measurable (no take-home pay) after');
    expect(content).not.toMatch(/Infinity|∞|NaN|null/);
  });

  it('does not let the model put a number on a debt load it was not given', async () => {
    const noPay = { ...loanResult, debtLoadBefore: null, debtLoadAfter: null };
    create.mockResolvedValue(reply('This loan costs $553 a month and is paid off in 5 years. Your debt payments would be 100% of your income.'));
    const body = await (await post({ loanResult: noPay })).json();
    expect(body.source).toBe('template');
    expect(create.mock.calls[1][0].messages[0].content).toContain('these numbers are not in the facts: 100%');
  });

  it('works without an API key for a profile with no take-home pay', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await post({ loanResult: { ...loanResult, debtLoadBefore: null, debtLoadAfter: null, schedule: undefined } });
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe(
      templateExplanation({ loanResult: { ...loanResult, debtLoadBefore: null, debtLoadAfter: null } }),
    );
  });

  it('uses the template without an API key and never calls the provider', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await post({ loanResult: { ...loanResult, payoffMonth: null } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('template');
    expect(body.text).toContain('$553');
    expect(body.text).toContain('never goes down');
    expect(create).not.toHaveBeenCalled();
  });

  it('uses the template when the provider fails', async () => {
    create.mockRejectedValueOnce(new Error('overloaded'));
    const body = await (await post({ move })).json();
    expect(body).toEqual({ text: templateExplanation({ move }), source: 'template' });
  });

  it.each([
    ['an empty body', {}],
    ['an unknown move kind', { move: { ...move, kind: 'buyStocks' } }],
    ['a percent APR in the move patch', { move: { ...move, patch: { debts: [{ id: 'card-1', apr: 22.8 }] } } }],
    ['a non-numeric loan field', { loanResult: { ...loanResult, monthly: '553' } }],
    ['a negative debt load', { loanResult: { ...loanResult, debtLoadAfter: -0.2 } }],
    ['a debt load sent as text', { loanResult: { ...loanResult, debtLoadAfter: 'Infinity' } }],
    ['malformed JSON', '{"move":'],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_request');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('templates', () => {
  // The fallback must itself obey the rules it enforces.
  it.each(MOVE_KINDS)('the %s template is two sentences with only input numbers', (kind) => {
    for (const effect10y of [48_213.77, -1_250.4]) {
      const m: Move = { ...move, kind, category: 'eatingOut', effect10y };
      const text = templateExplanation({ move: m });
      expect(explanationIssues(text, allowedForms([effect10y, 10]))).toEqual([]);
    }
  });

  it('the loan templates are two sentences with only input numbers', () => {
    for (const payoffMonth of [60, null]) {
      const l = { ...loanResult, payoffMonth };
      const text = templateExplanation({ loanResult: l });
      expect(explanationIssues(text, allowedForms([l.monthly, l.totalInterest, payoffMonth ?? 0]))).toEqual([]);
    }
    const both = templateExplanation({ move, loanResult });
    expect(explanationIssues(both, allowedForms([loanResult.monthly]))).toEqual([]);
  });
});
