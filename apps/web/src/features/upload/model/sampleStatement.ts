// "Try with sample statement" (S9): download the sample statement fixture
// (packages/data/fixtures/statement.sample.csv, served by GET /api/statement/sample) as a File, so
// it goes through readStatementFile exactly like a file the user picks: parsed and masked in the
// browser, labels categorized by /api/statement/categorize. No numbers are special-cased.
import { ApiError } from '@/lib/api/http';

export const SAMPLE_STATEMENT_URL = '/api/statement/sample';
export const SAMPLE_STATEMENT_FILE_NAME = 'statement.sample.csv';

export async function fetchSampleStatement(opts: { signal?: AbortSignal } = {}): Promise<File> {
  let res: Response;
  try {
    res = await fetch(SAMPLE_STATEMENT_URL, { signal: opts.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('Could not download the sample statement', 0);
  }
  if (!res.ok) throw new ApiError(`GET ${SAMPLE_STATEMENT_URL} answered ${res.status}`, res.status);
  return new File([await res.text()], SAMPLE_STATEMENT_FILE_NAME, { type: 'text/csv' });
}
