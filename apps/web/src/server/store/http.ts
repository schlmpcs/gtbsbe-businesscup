// Server-only: what a route answers when the store cannot be used.
import { json } from '@/server/ai/http';
import { StoreUnavailableError } from './errors';

/**
 * 503 `{ ok: false, error: { code: 'unavailable', reason } }` for a StoreUnavailableError
 * (STORE_URL missing in production, database down, migration failed). Any other error is a bug
 * and is re-thrown, so it surfaces as a 500 and in the logs.
 */
export function storeErrorResponse(err: unknown, route: string): Response {
  if (!(err instanceof StoreUnavailableError)) throw err;
  console.error(`[${route}] store unavailable (${err.reason}): ${err.message}`);
  return json({ ok: false, error: { code: 'unavailable', reason: err.reason } }, 503, { 'Retry-After': '5' });
}
