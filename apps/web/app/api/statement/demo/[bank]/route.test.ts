import { readSyntheticStatement } from '@lifeguessr/data/fixtures/node';
import { describe, expect, it } from 'vitest';
import { DEMO_BANKS } from '@/features/bankDemo/model/banks';
import { GET, generateStaticParams } from './route';

const call = (bank: string) => GET(new Request(`http://x/api/statement/demo/${bank}`), { params: Promise.resolve({ bank }) });

describe('GET /api/statement/demo/<bank>', () => {
  it('serves each demo bank its synthetic statement, unchanged, as CSV', async () => {
    for (const b of DEMO_BANKS) {
      const res = await call(b.id);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      // Bytes, not res.text(): that drops a BOM the file keeps.
      expect(Buffer.from(await res.arrayBuffer()).toString('utf8')).toBe(readSyntheticStatement(b.statement));
    }
  });

  it('404s an unknown bank and prebuilds every known one', async () => {
    expect((await call('chase')).status).toBe(404);
    expect(generateStaticParams().map((p) => p.bank)).toEqual(DEMO_BANKS.map((b) => b.id));
  });
});
