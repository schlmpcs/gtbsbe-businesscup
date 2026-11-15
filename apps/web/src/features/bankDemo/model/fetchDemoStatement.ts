// Downloads a demo bank's statement (GET /api/statement/demo/<id>, a static CSV). A plain GET: no
// credentials, no profile, nothing about the person is sent.
import { ApiError } from '@/lib/api/http';
import { demoStatementUrl, type DemoBankId } from './banks';

export async function fetchDemoStatement(id: DemoBankId, opts: { signal?: AbortSignal } = {}): Promise<string> {
  const url = demoStatementUrl(id);
  let res: Response;
  try {
    res = await fetch(url, { signal: opts.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('Could not download the demo statement', 0);
  }
  if (!res.ok) throw new ApiError(`GET ${url} answered ${res.status}`, res.status);
  return res.text();
}
