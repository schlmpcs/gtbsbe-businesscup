import { readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/statement/sample', () => {
  it('serves the sample statement fixture, unchanged, as CSV', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(await res.text()).toBe(readStatementSampleCsv());
  });
});
