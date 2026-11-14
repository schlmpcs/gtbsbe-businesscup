// Typed JSON fetch for the app's own routes: every response is validated with zod, every failure
// becomes an ApiError with the HTTP status, so view-models can map it to a VMError kind.
import type { z } from 'zod';

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response. `invalid` = the body broke the contract. */
  readonly status: number;
  readonly invalid: boolean;
  /** The parsed JSON error body, when the server sent one (e.g. `{ ok: false, error: { code } }`). */
  readonly body: unknown;

  constructor(message: string, status: number, invalid = false, body: unknown = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.invalid = invalid;
    this.body = body;
  }

  /** `error.code` from an `{ ok: false, error: { code } }` body, if any. */
  get code(): string | undefined {
    const err = (this.body as { error?: { code?: unknown } } | undefined)?.error;
    return typeof err?.code === 'string' ? err.code : undefined;
  }
}

/** Header that carries the anonymous id (never put it in a URL). */
export const ANON_ID_HEADER = 'x-anon-id';

type RequestOptions = { anonId?: string; signal?: AbortSignal };

async function request<S extends z.ZodType>(
  url: string,
  init: RequestInit,
  schema: S,
  opts: RequestOptions,
): Promise<z.output<S>> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (opts.anonId) headers.set(ANON_ID_HEADER, opts.anonId);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: opts.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(`Network error for ${url}`, 0);
  }
  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = undefined;
    }
    throw new ApiError(`${init.method ?? 'GET'} ${url} → ${res.status}`, res.status, false, errorBody);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`${url}: response is not JSON`, res.status, true);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(`${url}: response does not match the contract`, res.status, true);
  return parsed.data;
}

export function getJson<S extends z.ZodType>(url: string, schema: S, opts: RequestOptions = {}): Promise<z.output<S>> {
  return request(url, { method: 'GET' }, schema, opts);
}

export function postJson<S extends z.ZodType>(
  url: string,
  body: unknown,
  schema: S,
  opts: RequestOptions = {},
): Promise<z.output<S>> {
  return request(
    url,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    schema,
    opts,
  );
}
