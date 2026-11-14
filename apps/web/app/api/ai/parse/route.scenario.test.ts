// POST /api/ai/parse with kind 'scenario' ("What if…"): the model extracts fields, code maps places
// to our ZIPs and validates; the rules reader answers without a key or when the model fails.
import { takeHomeFromGrossRaise } from '@lifeguessr/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiRateLimiter } from '@/server/ai/http';
import { postRequest, reply } from '@/server/ai/testUtils';
import { POST } from './route';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const post = (body: unknown) => POST(postRequest('/api/ai/parse', body));
const wire = (over: Record<string, unknown>) => reply(JSON.stringify({
  kind: 'none', place: null, placeTier: null, kidAge: null, startsInMonths: null, incomeAmount: null,
  incomeDirection: null, incomePeriod: null, incomeTakeHome: null, rentMonthly: null, purchase: null, ...over,
}));

beforeEach(() => {
  create.mockReset();
  aiRateLimiter.reset();
  vi.stubEnv('ANTHROPIC_MODEL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/ai/parse kind scenario, no API key: the rules reader', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', ''));

  it.each([
    ['we have a baby next year', { kind: 'kid', age: 'infant', inMonths: 12 }],
    ['I move to Austin', { kind: 'move', zip: '78704' }],
    ['I get a $10k raise', { kind: 'income', monthlyDelta: takeHomeFromGrossRaise(10_000), grossYearly: 10_000 }],
    ['I buy a $35k car on a 60-month loan at 6.9%', {
      kind: 'purchase', category: 'car',
      purchase: { label: 'Car', amount: 35_000, recurring: false, payWith: { loan: { amount: 35_000, apr: 0.069, termMonths: 60 } } },
    }],
  ])('%s', async (text, value) => {
    const res = await post({ kind: 'scenario', text });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, kind: 'scenario', needsConfirmation: true, parsedBy: 'rules' });
    expect(body.value).toEqual(value);
    expect(create).not.toHaveBeenCalled();
  });

  it('uses the home ZIP for "the suburbs", and says which value is missing for a city we have no data for', async () => {
    const res = await post({ kind: 'scenario', text: 'we move to the suburbs', homeZip: '75206' });
    expect((await res.json()).value).toEqual({ kind: 'move', zip: '75024' });
    const unknown = await post({ kind: 'scenario', text: 'I move to Boise' });
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toEqual({ ok: false, error: { code: 'incomplete', missing: ['move.zip'], fallback: 'manualForm' } });
    const nothing = await post({ kind: 'scenario', text: 'hello' });
    expect((await nothing.json()).error.code).toBe('nothing_found');
  });

  it('rejects a bad home ZIP with 400', async () => {
    expect((await post({ kind: 'scenario', text: 'move to the suburbs', homeZip: 'Dallas' })).status).toBe(400);
  });
});

describe('POST /api/ai/parse kind scenario, with the model', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', 'test-key'));

  it('maps the place the model copied to our mid-priced ZIP for that metro (the model never picks a ZIP)', async () => {
    create.mockResolvedValueOnce(wire({ kind: 'move', place: 'Seattle' }));
    const body = await (await post({ kind: 'scenario', text: 'what if we relocate to Seattle for my job' })).json();
    expect(body).toMatchObject({ ok: true, parsedBy: 'ai', value: { kind: 'move', zip: '98103' }, inferred: ['zip'] });
    expect(create.mock.calls[0][0].output_config.format.type).toBe('json_schema');
  });

  it('a percent APR fails validation, is retried once, then the rules reader answers', async () => {
    const purchase = {
      label: 'Car', amount: 35_000, recurring: 'none', payWith: 'loan',
      loan: { amount: 35_000, apr: 6.9, termMonths: 60, fees: null, downPayment: null, extraPayment: null },
    };
    create.mockResolvedValue(wire({ kind: 'purchase', purchase }));
    const body = await (await post({ kind: 'scenario', text: 'I buy a $35k car on a 60-month loan at 6.9%' })).json();
    expect(create).toHaveBeenCalledTimes(2);
    expect(body).toMatchObject({ ok: true, parsedBy: 'rules', value: { purchase: { payWith: { loan: { apr: 0.069 } } } } });
  });

  it('a provider error falls back to the rules reader', async () => {
    create.mockRejectedValueOnce(new Error('boom'));
    const body = await (await post({ kind: 'scenario', text: 'we have a baby next year' })).json();
    expect(body).toMatchObject({ ok: true, parsedBy: 'rules', value: { kind: 'kid', inMonths: 12 } });
  });

  it('a yearly gross raise goes through the engine, not the model', async () => {
    create.mockResolvedValueOnce(wire({ kind: 'income', incomeAmount: 12_000, incomeDirection: 'up', incomePeriod: 'year', incomeTakeHome: false }));
    const body = await (await post({ kind: 'scenario', text: 'I get a 12k raise' })).json();
    expect(body.value).toEqual({ kind: 'income', monthlyDelta: takeHomeFromGrossRaise(12_000), grossYearly: 12_000 });
  });
});
