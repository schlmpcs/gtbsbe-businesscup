// Turn anything thrown by the engine or an API call into a VMError the UI can map to copy.
import { NotImplementedError } from '@lifeguessr/engine';
import { ApiError } from '@/lib/api/http';
import type { Loadable, VMError } from './types';

export function toVMError(err: unknown): VMError {
  // `name` check too: a mocked or duplicated engine module has its own class identity.
  if (err instanceof NotImplementedError || (err instanceof Error && err.name === 'NotImplementedError')) {
    return { kind: 'notImplemented', task: (err as Partial<NotImplementedError>).task ?? '' };
  }
  if (err instanceof ApiError) {
    if (err.invalid) return { kind: 'invalidResponse' };
    // /api/ai/* error codes ({ ok: false, error: { code, missing? } }).
    if (err.code === 'nothing_found') return { kind: 'nothingFound' };
    if (err.code === 'incomplete') {
      const missing = (err.body as { error?: { missing?: unknown } }).error?.missing;
      return { kind: 'incomplete', missing: Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [] };
    }
    if (err.status === 404 || err.status === 405 || err.status === 501 || err.status === 503) return { kind: 'unavailable' };
    if (err.status === 409) return { kind: 'alreadyGuessed' };
    if (err.status === 400 || err.status === 422) return { kind: 'badInput' };
    if (err.status === 429) return { kind: 'rateLimited' };
    return { kind: 'network', status: err.status || undefined };
  }
  return { kind: 'unknown', message: err instanceof Error ? err.message : String(err) };
}

/** Run a synchronous engine call and wrap the outcome (engine pieces in progress throw NotImplemented). */
export function runEngine<T>(fn: () => T): Loadable<T> {
  try {
    return { status: 'ready', data: fn() };
  } catch (err) {
    return { status: 'error', error: toVMError(err) };
  }
}
