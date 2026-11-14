import { generateStatement } from '@lifeguessr/data/statementGen';
import { describe, expect, it } from 'vitest';
import { usEasternDate } from '@/lib/dates';
import { GET } from './route';

const url = (q: string) => new Request(`http://x/api/statement/generate?${q}`);

describe('GET /api/statement/generate', () => {
  it('returns the generator output for the query', async () => {
    const res = GET(url('zip=78744&household=family&pay=steady&style=typical&seed=4&asOf=2026-11-14'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(await res.text()).toBe(generateStatement({ zip: '78744', household: 'family', pay: 'steady', style: 'typical', seed: 4, asOf: '2026-11-14' }).csv);
  });

  it('rejects unknown ZIPs and options', () => {
    expect(GET(url('zip=00000&household=family&pay=steady&style=typical')).status).toBe(400);
    expect(GET(url('zip=78744&household=army&pay=steady&style=typical')).status).toBe(400);
    expect(GET(url('zip=78744&household=solo&pay=steady&style=typical&seed=-1')).status).toBe(400);
  });

  it('dates the statement to today in New York by default', async () => {
    const csv = await GET(url('zip=78744&household=solo&pay=lean&style=saver')).text();
    expect(csv).toBe(generateStatement({ zip: '78744', household: 'solo', pay: 'lean', style: 'saver', seed: 1, asOf: usEasternDate() }).csv);
  });
});
