import { readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';
import { COST_CATEGORIES, type StatementItem } from '@lifeguessr/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../../../app/api/statement/sample/route';
import { ApiError } from '@/lib/api/http';
import { readStatementFile } from './readStatementFile';
import { fetchSampleStatement, SAMPLE_STATEMENT_FILE_NAME, SAMPLE_STATEMENT_URL } from './sampleStatement';

afterEach(() => vi.unstubAllGlobals());

const zeros = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<(typeof COST_CATEGORIES)[number], number>;
const categorize = vi.fn(async (items: readonly StatementItem[]) => ({
  months: [...new Set(items.map((i) => i.month))].sort().map((month) => ({ month, totals: zeros, oneOffs: [] })),
  categorizedBy: 'rules' as const,
}));

describe('fetchSampleStatement', () => {
  it('downloads the sample fixture as a CSV File that reads exactly like the same file picked by the user', async () => {
    const fetch = vi.fn(async () => GET());
    vi.stubGlobal('fetch', fetch);
    const file = await fetchSampleStatement();
    expect(fetch).toHaveBeenCalledWith(SAMPLE_STATEMENT_URL, expect.anything());
    expect(file.name).toBe(SAMPLE_STATEMENT_FILE_NAME);
    expect(await file.text()).toBe(readStatementSampleCsv());

    const picked = new File([readStatementSampleCsv()], 'Chase1234_Activity.CSV', { type: 'text/csv' });
    const fromSample = await readStatementFile(file, { categorize });
    const sentForSample = categorize.mock.calls.at(-1)![0];
    const fromPicked = await readStatementFile(picked, { categorize });
    expect(categorize.mock.calls.at(-1)![0]).toEqual(sentForSample);
    expect(fromSample).toEqual(fromPicked);
    // Same privacy path: names masked before anything leaves the browser.
    expect(JSON.stringify(sentForSample)).not.toMatch(/Tom Becker|Maria Lopez/);
  });

  it('fails as a request error when the download fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    await expect(fetchSampleStatement()).rejects.toBeInstanceOf(ApiError);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(fetchSampleStatement()).rejects.toMatchObject({ status: 0 });
  });
});
