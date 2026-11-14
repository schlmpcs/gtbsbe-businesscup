import type { Move } from '@lifeguessr/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { explainResult } from './aiExplain';
import { ApiError } from './http';

afterEach(() => vi.unstubAllGlobals());

const move: Move = {
  id: 'payCardFirst:card-1', kind: 'payCardFirst', level: 1, effect10y: 4321.5,
  patch: { debts: [{ id: 'card-1', extraPayment: 250 }] },
};

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

  it('throws an ApiError on a 429 and on a broken body', async () => {
    stubFetch(429, { ok: false, error: { code: 'rate_limited' } });
    await expect(explainResult({ move })).rejects.toMatchObject({ status: 429 });
    stubFetch(200, { text: '' });
    await expect(explainResult({ move })).rejects.toBeInstanceOf(ApiError);
  });
});
