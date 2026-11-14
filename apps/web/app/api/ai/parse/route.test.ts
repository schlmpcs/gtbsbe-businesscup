import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiRateLimiter, AI_RATE_LIMITS } from '@/server/ai/http';
import { outputFormat } from '@/server/ai/parse';
import { postRequest, reply } from '@/server/ai/testUtils';
import { POST } from './route';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const post = (body: unknown, headers?: Record<string, string>) => POST(postRequest('/api/ai/parse', body, headers));
const replyJson = (value: unknown) => reply(JSON.stringify(value));
const loanWire = (over: Record<string, unknown> = {}) => ({
  amount: 28_000, apr: 0.069, termMonths: 60, fees: null, downPayment: 1_000, extraPayment: null, ...over,
});
const sentContent = (call: number) => create.mock.calls[call][0].messages[0].content as string;

beforeEach(() => {
  create.mockReset();
  aiRateLimiter.reset();
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_MODEL', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/ai/parse', () => {
  it('parses a loan into a validated LoanInput the user must confirm', async () => {
    create.mockResolvedValueOnce(replyJson(loanWire()));
    const res = await post({ kind: 'loan', text: 'Car loan, $28,000 at 6.9% APR for 5 years, $1,000 down' });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      ok: true,
      kind: 'loan',
      value: { amount: 28_000, apr: 0.069, termMonths: 60, downPayment: 1_000 },
      needsConfirmation: true,
      inferred: [], // 60 months = "5 years"; every value is in the text
    });
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe('claude-haiku-5-5');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params).not.toHaveProperty('temperature');
  });

  it('uses ANTHROPIC_MODEL when set', async () => {
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
    create.mockResolvedValueOnce(replyJson(loanWire()));
    await post({ kind: 'loan', text: '$28,000 at 6.9% for 60 months, $1,000 down' });
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-5-5');
  });

  it('parses a purchase paid with a loan, and flags values not in the text', async () => {
    create.mockResolvedValueOnce(replyJson({
      label: 'Used car', amount: 18_000, recurring: 'none', payWith: 'loan',
      loan: { amount: 18_000, apr: 0.089, termMonths: 72, fees: null, downPayment: null, extraPayment: null },
    }));
    const res = await post({ kind: 'purchase', text: 'Used car for $18k, financed at 8.9% for 6 years' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.value).toEqual({
      label: 'Used car', amount: 18_000, recurring: false,
      payWith: { loan: { amount: 18_000, apr: 0.089, termMonths: 72 } },
    });
    expect(body.inferred).toEqual([]);

    create.mockResolvedValueOnce(replyJson({
      label: 'Used car', amount: 18_000, recurring: 'none', payWith: 'loan',
      loan: { amount: 18_000, apr: 0.089, termMonths: 72, fees: null, downPayment: null, extraPayment: null },
    }));
    const res2 = await post({ kind: 'purchase', text: 'Used car for $18k, financed at 8.9%, long term' });
    expect((await res2.json()).inferred).toEqual(['payWith.loan.termMonths']);
  });

  it('parses life text into a ProfilePatch, mapping debts to the listed ids', async () => {
    create.mockResolvedValueOnce(replyJson({
      spending: {
        rentUtilities: 1_850, car: null, childcare: null, groceries: 600,
        eatingOut: null, subscriptions: null, debtPayments: null, other: null,
      },
      retirementShare: 0.1,
      debts: [{ id: 'card-1', apr: 0.249, extraPayment: null }],
    }));
    const res = await post({
      kind: 'life',
      text: 'Rent is $1,850 with utilities, groceries $600, I save 10% for retirement, my card is 24.9%',
      debts: [{ id: 'card-1', kind: 'card' }],
    });
    expect(res.status).toBe(200);
    expect((await res.json()).value).toEqual({
      spending: { rentUtilities: 1_850, groceries: 600 },
      debts: [{ id: 'card-1', apr: 0.249 }],
      retirementShare: 0.1,
    });
    expect(sentContent(0)).toContain('card-1: card');
  });

  it('rejects a percent rate (6.9 instead of 0.069), retries once and accepts the decimal', async () => {
    create
      .mockResolvedValueOnce(replyJson(loanWire({ apr: 6.9 })))
      .mockResolvedValueOnce(replyJson(loanWire()));
    const res = await post({ kind: 'loan', text: '$28,000 at 6.9% APR for 60 months, $1,000 down' });

    expect(res.status).toBe(200);
    expect((await res.json()).value.apr).toBe(0.069);
    expect(create).toHaveBeenCalledTimes(2);
    expect(sentContent(1)).toMatch(/apr/);
    expect(sentContent(1)).toMatch(/decimal/);
  });

  it('catches a small percent copied as is (0.5% → 0.5), which the schema alone would accept', async () => {
    const wire = { amount: 5_000, apr: 0.5, termMonths: 12, fees: null, downPayment: null, extraPayment: null };
    create
      .mockResolvedValueOnce(replyJson(wire))
      .mockResolvedValueOnce(replyJson({ ...wire, apr: 0.005 }));
    const res = await post({ kind: 'loan', text: 'Borrow $5,000 at 0.5% for 12 months' });

    expect(res.status).toBe(200);
    expect((await res.json()).value.apr).toBe(0.005);
    expect(sentContent(1)).toContain('apr: 0.5 is a percent');
  });

  it('retries once on invalid output, then returns a typed error for the manual form', async () => {
    create
      .mockResolvedValueOnce(reply('not json'))
      .mockResolvedValueOnce(replyJson(loanWire({ termMonths: -3 })));
    const res = await post({ kind: 'loan', text: '$28,000 at 6.9% for 5 years' });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('invalid_output');
    expect(body.error.fallback).toBe('manualForm');
    expect(body.error.issues.join(' ')).toMatch(/termMonths/);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries when the model invents a debt id', async () => {
    const life = (id: string) => ({
      spending: Object.fromEntries(['rentUtilities', 'car', 'childcare', 'groceries', 'eatingOut',
        'subscriptions', 'debtPayments', 'other'].map((c) => [c, null])),
      retirementShare: null,
      debts: [{ id, apr: null, extraPayment: 200 }],
    });
    create
      .mockResolvedValueOnce(replyJson(life('visa')))
      .mockResolvedValueOnce(replyJson(life('card-1')));
    const res = await post({
      kind: 'life', text: 'I can put an extra $200 a month on my card', debts: [{ id: 'card-1', kind: 'card' }],
    });
    expect(res.status).toBe(200);
    expect((await res.json()).value).toEqual({ debts: [{ id: 'card-1', extraPayment: 200 }] });
    expect(sentContent(1)).toContain('"visa" is not one of the listed debt ids');
  });

  it('reports missing required values instead of guessing them', async () => {
    create.mockResolvedValueOnce(replyJson(loanWire({ apr: null })));
    const res = await post({ kind: 'loan', text: 'A $28,000 car loan for 5 years' });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toEqual({ code: 'incomplete', missing: ['apr'], fallback: 'manualForm' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reports nothing_found for text without usable values', async () => {
    create.mockResolvedValueOnce(replyJson(loanWire({ amount: null, apr: null, termMonths: null, downPayment: null })));
    const res = await post({ kind: 'loan', text: 'hello there' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('nothing_found');
  });

  it('returns a typed upstream_error when the provider fails', async () => {
    create.mockRejectedValueOnce(new Error('overloaded'));
    const res = await post({ kind: 'loan', text: '$28,000 at 6.9% for 5 years' });
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('upstream_error');
  });

  it('returns unavailable without an API key and never calls the provider', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await post({ kind: 'loan', text: '$28,000 at 6.9% for 5 years' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: { code: 'unavailable', fallback: 'manualForm' } });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown kind', { kind: 'house', text: 'x' }],
    ['a missing kind', { text: '$28,000 loan' }],
    ['empty text', { kind: 'loan', text: '   ' }],
    ['text over 1,000 characters', { kind: 'loan', text: 'a'.repeat(1_001) }],
    ['a non-object body', [1, 2, 3]],
    ['malformed JSON', '{"kind": "loan",'],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_request');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a body over the size limit with 413', async () => {
    const res = await post({ kind: 'loan', text: 'a'.repeat(20_000) });
    expect(res.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it('rate-limits per anonId with 429 and Retry-After', async () => {
    create.mockResolvedValue(replyJson(loanWire()));
    const headers = { 'x-anon-id': '0f8e2b4c-1d2e-4f5a-9b8c-7d6e5f4a3b2c' };
    for (let i = 0; i < AI_RATE_LIMITS.perAnonId.limit; i++) {
      expect((await post({ kind: 'loan', text: '$28,000 at 6.9% for 60 months, $1,000 down' }, headers)).status).toBe(200);
    }
    const res = await post({ kind: 'loan', text: '$28,000 at 6.9% for 60 months' }, headers);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await res.json()).error.code).toBe('rate_limited');
  });

  it('rate-limits per IP even when the anonId changes', async () => {
    create.mockResolvedValue(replyJson(loanWire()));
    const ip = { 'x-forwarded-for': '203.0.113.7' };
    for (let i = 0; i < AI_RATE_LIMITS.perIp.limit; i++) {
      await post({ kind: 'loan', text: 'x' }, { ...ip, 'x-anon-id': `anon-${String(i).padStart(8, '0')}` });
    }
    const res = await post({ kind: 'loan', text: 'x' }, { ...ip, 'x-anon-id': 'anon-fresh-0001' });
    expect(res.status).toBe(429);
  });
});

describe('structured output schemas', () => {
  // Structured outputs need every object closed (additionalProperties: false) with every
  // property required; our wire schemas use null for "not stated" instead of optional fields.
  const walk = (node: unknown, visit: (o: Record<string, unknown>) => void) => {
    if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
    else if (node && typeof node === 'object') {
      visit(node as Record<string, unknown>);
      Object.values(node).forEach((n) => walk(n, visit));
    }
  };

  it.each(['life', 'purchase', 'loan'] as const)('%s: closed objects, all properties required', (kind) => {
    const { schema } = outputFormat(kind);
    walk(schema, (o) => {
      if (o.type === 'object' && o.properties) {
        expect(o.additionalProperties).toBe(false);
        expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties).sort());
      }
    });
  });
});
