// Server-only: the one error a store operation throws when the store cannot be used. Routes map
// it to 503 (`storeErrorResponse` in ./http.ts); every other error is a bug and propagates.

export type StoreUnavailableReason =
  /** STORE_URL is unset in production, or is not a postgres:// URL. */
  | 'not_configured'
  /** The database cannot be reached, refused the login, or dropped the connection. */
  | 'unreachable'
  /** A schema migration failed, or one already applied was edited afterwards. */
  | 'migration_failed';

export class StoreUnavailableError extends Error {
  readonly reason: StoreUnavailableReason;

  constructor(reason: StoreUnavailableReason, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StoreUnavailableError';
    this.reason = reason;
  }
}

// SQLSTATE classes that mean "the database is not usable right now", not "this query is wrong":
// 08 connection exception, 28 invalid authorization, 3D invalid catalog (no such database),
// 53 insufficient resources, 57 operator intervention (shutdown, cancel), 58 system error.
const UNAVAILABLE_SQLSTATE = /^(08|28|3D|53|57|58)[0-9A-Z]{3}$/;

// Node socket errors, and the messages node-postgres uses for a lost or timed-out connection.
const UNAVAILABLE_NODE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
]);
const UNAVAILABLE_MESSAGES = [
  'timeout exceeded when trying to connect',
  'Connection terminated',
  'Client has encountered a connection error',
  'Query read timeout',
];

/** True for an error that means the database is unavailable (as opposed to a bad query). */
export function isUnavailable(err: unknown): boolean {
  if (err instanceof StoreUnavailableError) return true;
  if (err instanceof AggregateError && err.errors.some(isUnavailable)) return true;
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && (UNAVAILABLE_NODE_CODES.has(code) || UNAVAILABLE_SQLSTATE.test(code))) return true;
  return UNAVAILABLE_MESSAGES.some((m) => err.message.includes(m));
}

/** `err` as a StoreUnavailableError when it means the database is unavailable; otherwise `err` itself. */
export function asStoreError(err: unknown): unknown {
  if (err instanceof StoreUnavailableError || !isUnavailable(err)) return err;
  const code = (err as { code?: unknown }).code;
  const detail = typeof code === 'string' ? ` (${code})` : '';
  return new StoreUnavailableError('unreachable', `the store is unreachable${detail}`, { cause: err });
}
