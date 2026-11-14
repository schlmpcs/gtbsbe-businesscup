import { togetherPartnerSample } from '@lifeguessr/data/fixtures';
import {
  TOGETHER_MAX_BODY_BYTES, TogetherErrorResponseSchema, TogetherResponseSchema, type TogetherPartner,
} from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, setStoreForTests, StoreUnavailableError, type Store } from '@/server/store';
import { TOGETHER_RATE_LIMITS, togetherRateLimiter } from '@/server/together/http';
import { PUT } from './[id]/partner/route';
import { GET } from './[id]/route';
import { POST } from './route';

let store: Store;
beforeEach(() => {
  store = createMemoryStore();
  setStoreForTests(store);
  togetherRateLimiter.reset();
});
afterEach(() => {
  setStoreForTests(null);
  vi.restoreAllMocks();
});

const partner = (nickname?: string): TogetherPartner => ({
  ...(structuredClone(togetherPartnerSample) as TogetherPartner),
  ...(nickname !== undefined ? { nickname } : { nickname: undefined }),
});
let ip = 0;
const headers = (ipAddress = `10.9.0.${++ip % 250}`) => ({ 'content-type': 'application/json', 'x-forwarded-for': ipAddress });
const create = (body: unknown, ipAddress?: string) =>
  POST(new Request('http://localhost/api/together', { method: 'POST', headers: headers(ipAddress), body: typeof body === 'string' ? body : JSON.stringify(body) }));
const read = (id: string) => GET(new Request(`http://localhost/api/together/${id}`, { headers: headers() }), { params: Promise.resolve({ id }) });
const put = (id: string, body: unknown) =>
  PUT(new Request(`http://localhost/api/together/${id}/partner`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const planOf = async (res: Response) => {
  expect(res.headers.get('cache-control')).toBe('no-store');
  return TogetherResponseSchema.parse(await res.json()).plan;
};
const errorOf = async (res: Response) => TogetherErrorResponseSchema.parse(await res.json()).error;

describe('/api/together', () => {
  it('creates a plan, reads it back by link, adds partner 2 and the goal, with no sign-up', async () => {
    const res = await create({ partner: partner('Jo'), goal: { target: 40_000, years: 4 } });
    expect(res.status).toBe(201);
    const plan = await planOf(res);
    expect(plan.partner1.nickname).toBe('Jo');
    expect(plan.partner2).toBeNull();
    expect(await planOf(await read(plan.id))).toEqual(plan);

    const updated = await planOf(await put(plan.id, { partner: partner('Alex') }));
    expect(updated.partner2?.nickname).toBe('Alex');
    expect(updated.goal).toEqual({ target: 40_000, years: 4 });
    expect(await planOf(await read(plan.id))).toEqual(updated);
  });

  it('refuses fields the plan does not hold (names, ZIP, statements) and out-of-bounds numbers', async () => {
    for (const extra of [{ name: 'Jordan Smith' }, { zip: '75206' }, { statement: 'raw csv' }, { age: { value: 30, isEstimate: false } }]) {
      const res = await create({ partner: { ...partner(), ...extra } });
      expect(res.status).toBe(400);
      expect((await errorOf(res)).code).toBe('bad_request');
    }
    const huge = partner();
    huge.takeHomePay = { value: 1e12, isEstimate: false };
    expect((await create({ partner: huge })).status).toBe(400);
    expect((await create({ partner: partner('<script>') })).status).toBe(400);
    expect((await create('not json')).status).toBe(400);
  });

  it('caps the body size', async () => {
    const res = await create(JSON.stringify({ partner: partner(), pad: 'x'.repeat(TOGETHER_MAX_BODY_BYTES) }));
    expect(res.status).toBe(413);
    expect((await errorOf(res)).code).toBe('too_large');
  });

  it('answers 404 for unknown and malformed ids', async () => {
    expect((await read('AAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404);
    expect((await read('../../etc')).status).toBe(404);
    expect((await put('AAAAAAAAAAAAAAAAAAAAAA', { partner: partner() })).status).toBe(404);
  });

  it('rate-limits creates per IP', async () => {
    const limit = TOGETHER_RATE_LIMITS.create.ip.limit;
    for (let i = 0; i < limit; i++) expect((await create({ partner: partner() }, '10.8.8.8')).status).toBe(201);
    const res = await create({ partner: partner() }, '10.8.8.8');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('answers 503 when the store is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(store.together, 'create').mockRejectedValue(new StoreUnavailableError('unreachable', 'down'));
    const res = await create({ partner: partner() });
    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe('unavailable');
  });
});
