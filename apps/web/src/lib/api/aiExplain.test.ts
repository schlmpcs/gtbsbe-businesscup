import { loan } from '@lifeguessr/engine';
import type { ExplainRequest, Move, Profile } from '@lifeguessr/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { ExplainRequestSchema } from '@/server/ai/schemas';
import { explainResult } from './aiExplain';
import { ApiError } from './http';

afterEach(() => vi.unstubAllGlobals());

const move: Move = {
  id: 'payCardFirst:card-1', kind: 'payCardFirst', level: 1, effect10y: 4321.5,
  patch: { debts: [{ id: 'card-1', extraPayment: 250 }] },
};

/** The demo profile with other debts and take-home pay. */
function profileWith(debts: Profile['debts'], takeHome: number): Profile {
  const p = cloneProfileDemo();
  return { ...p, debts, takeHomePay: { value: takeHome, isEstimate: false } };
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('explainResult', () => {
  it('posts only the contract fields of the move and returns the text', async () => {
    const fetchMock = stubFetch(200, { text: 'One. Two.', source: 'ai' });
    const res = await explainResult({ move: { ...move, isCommitted: true } as Move }, { anonId: 'a' });
    expect(res).toEqual({ text: 'One. Two.', source: 'ai' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/ai/explain');
    expect(JSON.parse(init.body as string)).toEqual({ move });
    expect(new Headers(init.headers).get('x-anon-id')).toBe('a');
  });

  it('posts the forecast source of a move when it is ai or rules', async () => {
    const fetchMock = stubFetch(200, { text: 'One. Two.', source: 'template' });
    for (const source of ['ai', 'rules'] as const) {
      await explainResult({ move: { ...move, source, isCommitted: true } as Move & { source: typeof source } });
      const posted = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
      expect(posted).toEqual({ move: { ...move, source } });
      expect(posted.move.source).toBe(source);
    }
  });

  it('posts no source key for a null source or none', async () => {
    const fetchMock = stubFetch(200, { text: 'One. Two.', source: 'template' });
    await explainResult({ move: { ...move, source: null } });
    await explainResult({ move });
    for (const [, init] of fetchMock.mock.calls) {
      const posted = JSON.parse(init.body as string);
      expect(posted).toEqual({ move });
      expect('source' in posted.move).toBe(false);
    }
  });

  it('drops the loan schedule', async () => {
    const fetchMock = stubFetch(200, { text: 'One. Two.', source: 'template' });
    await explainResult({
      loanResult: {
        monthly: 863.28, totalInterest: 3078, totalCost: 31078, payoffMonth: 36, debtLoadBefore: 0.1,
        debtLoadAfter: 0.27, effect10y: -5000, schedule: [{ month: 1, interest: 1, principal: 1, balance: 1 }],
      } as never,
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string).loanResult.schedule).toBeUndefined();
  });

  it('sends a debt load with no take-home pay (the engine’s Infinity) as null, not as a number', async () => {
    const fetchMock = stubFetch(200, { text: 'One. Two.', source: 'template' });
    const noPay = loan(profileWith([], 0), { amount: 12_000, apr: 0.09, termMonths: 36 });
    expect(noPay.debtLoadAfter).toBe(Number.POSITIVE_INFINITY);
    await explainResult({ loanResult: noPay });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as ExplainRequest;
    expect(sent.loanResult).toMatchObject({ debtLoadBefore: 0, debtLoadAfter: null, monthly: noPay.monthly });
    // …and the server accepts exactly that body.
    expect(ExplainRequestSchema.safeParse(sent).success).toBe(true);
    expect(ExplainRequestSchema.safeParse(JSON.parse(JSON.stringify({ loanResult: { ...noPay, schedule: undefined } }))).success)
      .toBe(true);
  });

  it('refuses a debt load that is not a number at all', async () => {
    stubFetch(200, { text: 'One. Two.', source: 'template' });
    const base = loan(profileWith([], 5_200), { amount: 12_000, apr: 0.09, termMonths: 36 });
    await expect(explainResult({ loanResult: { ...base, debtLoadAfter: Number.NaN } })).rejects.toBeInstanceOf(RangeError);
  });

  it('throws an ApiError on a 429 and on a broken body', async () => {
    stubFetch(429, { ok: false, error: { code: 'rate_limited' } });
    await expect(explainResult({ move })).rejects.toMatchObject({ status: 429 });
    stubFetch(200, { text: '' });
    await expect(explainResult({ move })).rejects.toBeInstanceOf(ApiError);
  });
});
