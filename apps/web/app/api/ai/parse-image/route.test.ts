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

const DATA = Buffer.from('a fake png that is long enough').toString('base64');
const post = (body: unknown) => POST(postRequest('/api/ai/parse-image', body));
const replyJson = (value: unknown) => reply(JSON.stringify(value));
const debtWire = (over: Record<string, unknown> = {}) => ({
  isFinancialDocument: true, kind: 'card', balance: 4_210.55, apr: 0.2499, minPayment: 126, ...over,
});

beforeEach(() => {
  create.mockReset();
  aiRateLimiter.reset();
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_MODEL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/ai/parse-image', () => {
  it('reads a card statement into balance, APR and minimum, sending the image to the model', async () => {
    create.mockResolvedValueOnce(replyJson(debtWire()));
    const res = await post({ kind: 'debt', mediaType: 'image/png', data: DATA });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true, kind: 'debt', needsConfirmation: true,
      value: { kind: 'card', balance: 4_210.55, apr: 0.2499, minPayment: 126 },
    });
    const content = create.mock.calls[0][0].messages[0].content;
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: DATA } });
  });

  it('sends a PDF as a document block', async () => {
    create.mockResolvedValueOnce(replyJson(debtWire()));
    await post({ kind: 'debt', mediaType: 'application/pdf', data: DATA });
    expect(create.mock.calls[0][0].messages[0].content[0].type).toBe('document');
  });

  it('retries once when the APR comes back as a percent', async () => {
    create.mockResolvedValueOnce(replyJson(debtWire({ apr: 24.99 }))).mockResolvedValueOnce(replyJson(debtWire()));
    const res = await post({ kind: 'debt', mediaType: 'image/jpeg', data: DATA });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages[0].content[1].text).toContain('looks like a percent');
  });

  it('reads a loan offer into a LoanInput', async () => {
    create.mockResolvedValueOnce(replyJson({
      isFinancialDocument: true, amount: 28_000, apr: 0.069, termMonths: 60, fees: 499, downPayment: null,
    }));
    const res = await post({ kind: 'loan', mediaType: 'image/webp', data: DATA });
    expect(await res.json()).toMatchObject({ ok: true, value: { amount: 28_000, apr: 0.069, termMonths: 60, fees: 499 } });
  });

  it('422 nothing_found for a picture that is not a financial document', async () => {
    create.mockResolvedValueOnce(replyJson(debtWire({ isFinancialDocument: false })));
    const res = await post({ kind: 'debt', mediaType: 'image/png', data: DATA });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('nothing_found');
  });

  it('422 incomplete when the loan has no term', async () => {
    create.mockResolvedValueOnce(replyJson({
      isFinancialDocument: true, amount: 28_000, apr: 0.069, termMonths: null, fees: null, downPayment: null,
    }));
    const res = await post({ kind: 'loan', mediaType: 'image/png', data: DATA });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'incomplete', missing: ['termMonths'] });
  });

  it('400 for an unsupported media type, 503 without an API key', async () => {
    expect((await post({ kind: 'debt', mediaType: 'image/tiff', data: DATA })).status).toBe(400);
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await post({ kind: 'debt', mediaType: 'image/png', data: DATA })).status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });
});
