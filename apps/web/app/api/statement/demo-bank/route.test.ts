import { DEMO_BANKS, demoBankAccount } from '@lifeguessr/data/demoBanks';
import { readSyntheticStatement } from '@lifeguessr/data/fixtures/node';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

const get = (q: string) => GET(new Request(`http://x/api/statement/demo-bank?${q}`));

describe('GET /api/statement/demo-bank', () => {
  it("serves the bank's n-th invented customer's statement, unchanged", async () => {
    for (const b of DEMO_BANKS) for (const n of [0, 1, b.accounts.length]) {
      const res = get(`bank=${b.id}&n=${n}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      // Response.text() drops a UTF-8 BOM (the online-bank layout has one).
      expect(await res.text()).toBe(readSyntheticStatement(demoBankAccount(b, n).file).replace(/^\uFEFF/, ''));
    }
  });

  it('answers 404 for an unknown bank and survives a junk n', async () => {
    expect(get('bank=meridian').status).toBe(404);
    expect(get('bank=../x').status).toBe(404);
    expect(get('bank=chase&n=abc').status).toBe(200);
  });
});
