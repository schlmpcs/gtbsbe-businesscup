import { FORECAST_HORIZONS, MOVE_KINDS, type ExplainRequest, type LoanResult, type Move } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { z } from 'zod';
import { yearsPhrase } from '@/copy';
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
// The same two answers for a move whose 10-year number is the model's estimate.
const GOOD_AI = 'Putting an extra $250 a month on your credit card clears the most expensive debt first. Our AI estimate is that it adds about $48,214 to your net worth in 10 years.';
const INVENTED_AI = 'Putting an extra $250 a month on your card saves you $3,100 in interest. Our AI estimate is that it adds about $48,214 to your net worth in 10 years.';

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
    expectTypeOf<z.infer<typeof ExplainRequestSchema>['horizon']>().toEqualTypeOf<ExplainRequest['horizon']>();
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
    ['no source', undefined],
    ['source rules', 'rules'],
  ] as const)('keeps the simulation wording for a move with %s', async (_name, source) => {
    create.mockResolvedValueOnce(reply(GOOD));
    const body = await (await post({ move: { ...move, ...(source ? { source } : {}) } })).json();
    expect(body).toEqual({ text: GOOD, source: 'ai' });
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    const content = params.messages[0].content as string;
    expect(content).toContain('Change in net worth after 10 years: +$48,214');
    expect(content).not.toMatch(/AI estimate/i);
    expect(params.system).toMatch(/come from the simulation/);
    expect(params.system).not.toMatch(/AI estimate/i);
  });

  it('sends the model the system prompt and facts it always sent when there is no source, or the rules source', async () => {
    create.mockResolvedValue(reply(GOOD));
    await post({ move });
    await post({ move: { ...move, source: 'rules' } });
    const [withNone, withRules] = [create.mock.calls[0][0], create.mock.calls[1][0]];
    expect(withNone.system).toBe(`You explain one result of an educational budget simulator to a US adult in plain words.
Rules:
- Write exactly two short sentences, plain text, no lists or markdown.
- Use only the numbers in the facts you are given, written as given. Do not compute, round differently, add, compare or invent any other number, date, rate or duration.
- Explain what the move or loan means for the person; the numbers come from the simulation.
- Never name or recommend a lender, bank, card issuer, investment, fund, stock or other security, and give no tax advice.
- This is an educational simulation, not financial advice; don't promise outcomes.`);
    expect(withNone.messages[0].content).toBe(`Facts:
- Move: This move puts your extra money toward your credit card balance first.
- Change in net worth after 10 years: +$48,214
- Extra monthly payment on a debt: $250`);
    expect(withRules.system).toBe(withNone.system);
    expect(withRules.messages).toEqual(withNone.messages);
  });

  describe('a move whose number is an AI estimate', () => {
    const aiMove = { ...move, source: 'ai' as const };

    it('tells the model the 10-year figure is an AI estimate, not a simulation result', async () => {
      create.mockResolvedValueOnce(reply(GOOD_AI));
      const res = await post({ move: aiMove });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ text: GOOD_AI, source: 'ai' });

      const params = create.mock.calls[0][0];
      const content = params.messages[0].content as string;
      expect(content).toContain('Change in net worth after 10 years (AI estimate, checked against our rules): +$48,214');
      expect(params.system).toMatch(/AI estimate/);
      expect(params.system).not.toMatch(/come from the simulation/i);
      expect(params.system).toMatch(/exactly two/i); // the rest of the rules are unchanged
      expect(params.system).toMatch(/educational simulation, not financial advice/); // golden rule 7
    });

    it('rejects an answer that credits the simulation, retries once and accepts the AI wording', async () => {
      create.mockResolvedValueOnce(reply(GOOD)).mockResolvedValueOnce(reply(GOOD_AI));
      const res = await post({ move: aiMove });
      expect(await res.json()).toEqual({ text: GOOD_AI, source: 'ai' });
      expect(create).toHaveBeenCalledTimes(2);
      expect(create.mock.calls[1][0].messages[0].content).toContain('AI estimate');
      expect(create.mock.calls[1][0].messages[0].content).toMatch(/simulation/);
    });

    it.each([
      'In our simulation it adds about $48,214 to your net worth in 10 years. That is the main benefit.',
      'The simulation says it adds about $48,214 to your net worth in 10 years. That is the main benefit.',
      'This simulation shows it adds about $48,214 to your net worth in 10 years. That is the main benefit.',
    ])('falls back to the AI-worded template when the answer keeps crediting the simulation: %s', async (text) => {
      create.mockResolvedValue(reply(text));
      const body = await (await post({ move: aiMove })).json();
      expect(body).toEqual({ text: templateExplanation({ move: aiMove }), source: 'template' });
      expect(body.text).toContain('Our AI estimate');
      expect(body.text).not.toMatch(/simulation/i);
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('still rejects a number that is not in the facts', async () => {
      create.mockResolvedValueOnce(reply(INVENTED_AI)).mockResolvedValueOnce(reply(GOOD_AI));
      const body = await (await post({ move: aiMove })).json();
      expect(body).toEqual({ text: GOOD_AI, source: 'ai' });
      expect(create.mock.calls[1][0].messages[0].content).toContain('these numbers are not in the facts: 3,100');

      create.mockReset();
      create.mockResolvedValue(reply(INVENTED_AI));
      const fallback = await (await post({ move: aiMove })).json();
      expect(fallback).toEqual({ text: templateExplanation({ move: aiMove }), source: 'template' });
    });

    it('still applies the other guards (sentence count, lenders, advice)', async () => {
      for (const text of [
        `${GOOD_AI} Keep it up.`,
        'Refinancing with SoFi lowers your rate. Our AI estimate is that it adds about $48,214 in 10 years.',
        'Put the money in an index fund instead. Our AI estimate is that it adds about $48,214 in 10 years.',
        'The interest is tax deductible. Our AI estimate is that it adds about $48,214 in 10 years.',
      ]) {
        create.mockReset();
        create.mockResolvedValue(reply(text));
        expect((await (await post({ move: aiMove })).json()).source).toBe('template');
        expect(create).toHaveBeenCalledTimes(2);
      }
    });

    it('uses the AI-worded template without an API key and never calls the provider', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      const body = await (await post({ move: aiMove })).json();
      expect(body.source).toBe('template');
      expect(body.text).toContain('Our AI estimate');
      expect(body.text).toContain('$48,214');
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('a move explained at a horizon', () => {
    // The 10-year number of the move; the horizon's own number is what the sentence may use.
    const horizonMove: Move = { ...move, effect10y: 10_772.6 };
    const at3 = { years: 3, effect: 3_232 } as const;
    const GOOD_3 = 'Putting an extra $250 a month on your credit card clears the most expensive debt first. In our simulation that adds about $3,232 to your net worth in 3 years.';
    const GOOD_3_AI = 'Putting an extra $250 a month on your credit card clears the most expensive debt first. Our AI estimate is that it adds about $3,232 to your net worth in 3 years.';
    const TEN_YEAR_NUMBER = 'Putting an extra $250 a month on your credit card clears the most expensive debt first. In our simulation that adds about $10,773 to your net worth in 3 years.';

    it('names the horizon and its effect in the template, not 10 years', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      const body = await (await post({ move: horizonMove, horizon: at3 })).json();
      expect(body.source).toBe('template');
      expect(body.text).toContain('$3,232');
      expect(body.text).toContain('in 3 years');
      expect(body.text).not.toContain('10 years');
      expect(body.text).not.toContain('10,773');
      expect(body.text).toMatch(/ In our simulation it adds about \$3,232 to your net worth in 3 years\.$/);
      expect(create).not.toHaveBeenCalled();
    });

    it.each([
      [1, 'in 1 year.'],
      [3, 'in 3 years.'],
      [5, 'in 5 years.'],
      [10, 'in 10 years.'],
    ] as const)('says "%s" correctly in the template (singular for 1)', async (years, tail) => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      const body = await (await post({ move: horizonMove, horizon: { years, effect: 3_232 } })).json();
      expect(body.text.endsWith(tail)).toBe(true);
      expect(body.text).not.toContain('1 years');
    });

    it('words a loss at the horizon, and an AI estimate at the horizon', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      const loss = await (await post({ move: horizonMove, horizon: { years: 1, effect: -250.4 } })).json();
      expect(loss.text).toMatch(/ In our simulation it lowers your net worth by about \$250 in 1 year\.$/);
      const ai = await (await post({ move: { ...horizonMove, source: 'ai' }, horizon: at3 })).json();
      expect(ai.text).toMatch(/ Our AI estimate is that it adds about \$3,232 to your net worth in 3 years\.$/);
      expect(ai.text).not.toMatch(/simulation/i);
    });

    it('tells the model the horizon in the facts and uses the horizon effect, not the 10-year one', async () => {
      create.mockResolvedValueOnce(reply(GOOD_3));
      const res = await post({ move: horizonMove, horizon: at3 });
      expect(await res.json()).toEqual({ text: GOOD_3, source: 'ai' });
      expect(create).toHaveBeenCalledTimes(1);
      const params = create.mock.calls[0][0];
      expect(params.messages[0].content).toBe(`Facts:
- Move: This move puts your extra money toward your credit card balance first.
- Change in net worth after 3 years: +$3,232
- Extra monthly payment on a debt: $250`);
      expect(params.system).not.toMatch(/10-year/);
    });

    it('says "1 year" in the facts', async () => {
      create.mockResolvedValueOnce(reply(GOOD_3.replace('$3,232', '$1,000').replace('3 years', '1 year')));
      const body = await (await post({ move: horizonMove, horizon: { years: 1, effect: 1_000 } })).json();
      expect(body.source).toBe('ai');
      expect(create.mock.calls[0][0].messages[0].content).toContain('- Change in net worth after 1 year: +$1,000');
    });

    it('names the horizon in the AI-estimate rule, and keeps the source label', async () => {
      create.mockResolvedValueOnce(reply(GOOD_3_AI));
      const res = await post({ move: { ...horizonMove, source: 'ai' }, horizon: at3 });
      expect(await res.json()).toEqual({ text: GOOD_3_AI, source: 'ai' });
      const params = create.mock.calls[0][0];
      expect(params.messages[0].content).toContain('- Change in net worth after 3 years (AI estimate, checked against our rules): +$3,232');
      expect(params.system).toContain("The move's 3-year change in net worth is an AI estimate that we checked against our rules");
      expect(params.system).not.toMatch(/10-year/);
      expect(params.system).not.toMatch(/come from the simulation/i);
    });

    it('rejects an answer that credits the simulation for an AI estimate at the horizon, naming the horizon', async () => {
      create.mockResolvedValueOnce(reply(GOOD_3)).mockResolvedValueOnce(reply(GOOD_3_AI));
      const body = await (await post({ move: { ...horizonMove, source: 'ai' }, horizon: at3 })).json();
      expect(body).toEqual({ text: GOOD_3_AI, source: 'ai' });
      expect(create.mock.calls[1][0].messages[0].content).toContain('the 3-year figure is an AI estimate');
    });

    it('rejects the 10-year number, retries once and accepts the horizon number', async () => {
      create.mockResolvedValueOnce(reply(TEN_YEAR_NUMBER)).mockResolvedValueOnce(reply(GOOD_3));
      const body = await (await post({ move: horizonMove, horizon: at3 })).json();
      expect(body).toEqual({ text: GOOD_3, source: 'ai' });
      expect(create).toHaveBeenCalledTimes(2);
      expect(create.mock.calls[1][0].messages[0].content).toContain('these numbers are not in the facts: 10,773');
    });

    it('falls back to the horizon template when the 10-year number is named twice', async () => {
      create.mockResolvedValue(reply(TEN_YEAR_NUMBER));
      const body = await (await post({ move: horizonMove, horizon: at3 })).json();
      expect(body).toEqual({ text: templateExplanation({ move: horizonMove, horizon: at3 }), source: 'template' });
      expect(body.text).toContain('in 3 years');
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('rejects "10 years" for a move explained at 3 years', async () => {
      create.mockResolvedValue(reply(GOOD_3.replace('3 years', '10 years')));
      const body = await (await post({ move: horizonMove, horizon: at3 })).json();
      expect(body.source).toBe('template');
      expect(create.mock.calls[1][0].messages[0].content).toContain('these numbers are not in the facts: 10');
    });

    it('ignores a horizon with no move: the loan stays at 10 years', async () => {
      const text = 'This loan costs $553 a month and is paid off in 5 years. In 10 years your net worth is about $9,413 lower.';
      create.mockResolvedValueOnce(reply(text));
      const body = await (await post({ loanResult, horizon: at3 })).json();
      expect(body).toEqual({ text, source: 'ai' });
      const content = create.mock.calls[0][0].messages[0].content as string;
      expect(content).toContain('Change in net worth after 10 years: −$9,413');
      expect(content).not.toContain('3 years');
      expect(content).not.toContain('3,232');
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      expect((await (await post({ loanResult, horizon: at3 })).json()).text).toBe(templateExplanation({ loanResult }));
    });

    it('with a move and a loan, the move is at the horizon and the loan stays at 10 years', async () => {
      const text = 'Putting an extra $250 a month on your card adds about $3,232 in 3 years. The loan costs $553 a month and lowers your net worth by about $9,413 in 10 years.';
      create.mockResolvedValueOnce(reply(text));
      const body = await (await post({ move: horizonMove, loanResult, horizon: at3 })).json();
      expect(body).toEqual({ text, source: 'ai' });
      const content = create.mock.calls[0][0].messages[0].content as string;
      expect(content).toContain('- Change in net worth after 3 years: +$3,232');
      expect(content).toContain('- Change in net worth after 10 years: −$9,413');
      expect(content).not.toContain('10,773');
    });

    it('accepts every picker horizon and rejects any other year or shape', async () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      for (const years of FORECAST_HORIZONS) {
        expect((await post({ move: horizonMove, horizon: { years, effect: 5 } })).status).toBe(200);
      }
      for (const horizon of [
        { years: 7, effect: 1 },
        { years: 0, effect: 1 },
        { years: '3', effect: 1 },
        { years: 3, effect: '1' },
        { years: 3 },
        { effect: 1 },
        { years: 3, effect: 1, extra: true },
        null,
        3,
      ]) {
        const res = await post({ move: horizonMove, horizon });
        expect(res.status, JSON.stringify(horizon)).toBe(400);
        expect((await res.json()).error.code).toBe('bad_request');
      }
      expect(create).not.toHaveBeenCalled();
    });

    it('a horizon alone is not a request', async () => {
      expect((await post({ horizon: at3 })).status).toBe(400);
    });
  });

  it('accepts a body with and without a source, and rejects a source that is neither ai nor rules', async () => {
    create.mockResolvedValue(reply(GOOD));
    expect((await post({ move })).status).toBe(200);
    expect((await post({ move: { ...move, source: 'ai' } })).status).toBe(200);
    expect((await post({ move: { ...move, source: 'rules' } })).status).toBe(200);
    for (const source of ['model', 'AI', '', null, 1]) {
      const res = await post({ move: { ...move, source } });
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('bad_request');
    }
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

  it.each(MOVE_KINDS)('the %s template for an AI estimate says so, in two sentences with only input numbers', (kind) => {
    for (const effect10y of [48_213.77, -1_250.4]) {
      const m = { ...move, kind, category: 'eatingOut' as const, effect10y, source: 'ai' as const };
      const text = templateExplanation({ move: m });
      expect(explanationIssues(text, allowedForms([effect10y, 10]), 'ai')).toEqual([]);
      expect(text).toContain('AI estimate');
      expect(text).not.toMatch(/simulation/i);
    }
  });

  it('words a gain and a loss by source, and keeps the simulation sentence for rules and no source', () => {
    const gain = { ...move, effect10y: 48_213.77 };
    const loss = { ...move, effect10y: -1_250.4 };
    expect(templateExplanation({ move: { ...gain, source: 'ai' } })).toMatch(
      / Our AI estimate is that it adds about \$48,214 to your net worth in 10 years\.$/,
    );
    expect(templateExplanation({ move: { ...loss, source: 'ai' } })).toMatch(
      / Our AI estimate is that it lowers your net worth by about \$1,250 in 10 years\.$/,
    );
    for (const source of [undefined, 'rules'] as const) {
      expect(templateExplanation({ move: { ...gain, ...(source ? { source } : {}) } })).toMatch(
        / In our simulation it adds about \$48,214 to your net worth in 10 years\.$/,
      );
      expect(templateExplanation({ move: { ...loss, ...(source ? { source } : {}) } })).toMatch(
        / In our simulation it lowers your net worth by about \$1,250 in 10 years\.$/,
      );
    }
  });

  it('only an AI estimate may not credit the simulation (D5)', () => {
    const allowed = allowedForms([48_213.77, 10]);
    const text = 'It helps. In our simulation it adds about $48,214 in 10 years.';
    expect(explanationIssues(text, allowed)).toEqual([]);
    expect(explanationIssues(text, allowed, 'rules')).toEqual([]);
    expect(explanationIssues(text, allowed, 'ai')).toHaveLength(1);
    expect(explanationIssues('It helps. This simulation adds about $48,214 in 10 years.', allowed, 'ai')).toHaveLength(1);
    expect(explanationIssues('It helps. The simulation adds about $48,214 in 10 years.', allowed, 'ai')).toHaveLength(1);
    // Other uses of the word are not "the number comes from the simulation".
    expect(explanationIssues('It helps. Our AI estimate is $48,214 in 10 years, not a promise from a simulator.', allowed, 'ai')).toEqual([]);
  });

  it.each(MOVE_KINDS)('the %s template at each horizon is two sentences with only the horizon numbers', (kind) => {
    for (const years of FORECAST_HORIZONS) {
      for (const effect of [3_232.4, -250.4]) {
        for (const source of [undefined, 'ai'] as const) {
          const m: Move = { ...move, kind, category: 'eatingOut', ...(source ? { source } : {}) };
          const text = templateExplanation({ move: m, horizon: { years, effect } });
          expect(explanationIssues(text, allowedForms([effect, years]), source, years)).toEqual([]);
          expect(text).toContain(`in ${yearsPhrase(years)}.`);
          if (years !== 10) expect(text).not.toContain('10 years');
        }
      }
    }
  });

  it('yearsPhrase is singular for 1 and plural otherwise', () => {
    expect(yearsPhrase(1)).toBe('1 year');
    for (const years of [3, 5, 10]) expect(yearsPhrase(years)).toBe(`${years} years`);
  });

  it('the issue about crediting the simulation names the horizon, and says 10-year by default', () => {
    const allowed = allowedForms([3_232, 3]);
    const text = 'It helps. In our simulation it adds about $3,232 in 3 years.';
    expect(explanationIssues(text, allowed, 'ai', 3)).toEqual([
      'the 3-year figure is an AI estimate, so do not credit the simulation for it; say it is an AI estimate',
    ]);
    expect(explanationIssues(text, allowed, 'ai')).toEqual([
      'the 10-year figure is an AI estimate, so do not credit the simulation for it; say it is an AI estimate',
    ]);
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
