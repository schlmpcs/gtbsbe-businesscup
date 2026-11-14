import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeConfig } from './config';
import { asStoreError, isUnavailable, StoreUnavailableError } from './errors';
import { createMemoryStore, getStore, setStoreForTests } from './index';

afterEach(() => {
  setStoreForTests(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('storeConfig', () => {
  it('uses Postgres for a postgres:// or postgresql:// STORE_URL', () => {
    expect(storeConfig({ STORE_URL: 'postgres://u:p@postgres:5432/db', NODE_ENV: 'production' })).toEqual({
      kind: 'postgres',
      url: 'postgres://u:p@postgres:5432/db',
    });
    expect(storeConfig({ STORE_URL: ' postgresql://u@h/db ', NODE_ENV: 'development' }).kind).toBe('postgres');
  });

  it('falls back to memory only outside production', () => {
    expect(storeConfig({ NODE_ENV: 'test' })).toEqual({ kind: 'memory' });
    expect(storeConfig({ STORE_URL: '  ', NODE_ENV: 'test' })).toEqual({ kind: 'memory' });
    expect(storeConfig({ NODE_ENV: 'production' }).kind).toBe('missing');
  });

  it('never treats a URL of another kind as a store, in any environment', () => {
    expect(storeConfig({ STORE_URL: 'mysql://u@h/db', NODE_ENV: 'test' }).kind).toBe('missing');
    expect(storeConfig({ STORE_URL: 'file:///data/store.json', NODE_ENV: 'production' }).kind).toBe('missing');
  });
});

describe('getStore', () => {
  it('refuses in production without STORE_URL (no silent memory fallback)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STORE_URL', '');
    expect(() => getStore()).toThrow(StoreUnavailableError);
    try {
      getStore();
    } catch (err) {
      expect((err as StoreUnavailableError).reason).toBe('not_configured');
    }
  });

  it('gives one memory store per process in dev and tests', () => {
    vi.stubEnv('STORE_URL', '');
    const store = getStore();
    expect(store.backend).toBe('memory');
    expect(getStore()).toBe(store);
  });

  it('builds a Postgres store for STORE_URL without connecting yet', () => {
    vi.stubEnv('STORE_URL', 'postgres://u:p@127.0.0.1:1/none');
    const store = getStore();
    expect(store.backend).toBe('postgres');
    expect(store.db).not.toBeNull();
    expect(getStore()).toBe(store);
  });

  it('returns the test override when one is set', () => {
    const memory = createMemoryStore();
    setStoreForTests(memory);
    expect(getStore()).toBe(memory);
  });
});

describe('errors', () => {
  const withCode = (code: string, message = 'x') => Object.assign(new Error(message), { code });

  it.each([
    ['refused connection', withCode('ECONNREFUSED')],
    ['admin shutdown', withCode('57P01')],
    ['bad password', withCode('28P01')],
    ['no such database', withCode('3D000')],
    ['too many connections', withCode('53300')],
    ['connect timeout', new Error('timeout exceeded when trying to connect')],
    ['lost connection', new Error('Connection terminated unexpectedly')],
    ['several addresses refused', new AggregateError([withCode('ECONNREFUSED')])],
  ])('treats %s as the store being unavailable', (_name, err) => {
    expect(isUnavailable(err)).toBe(true);
    const wrapped = asStoreError(err);
    expect(wrapped).toBeInstanceOf(StoreUnavailableError);
    expect((wrapped as StoreUnavailableError).reason).toBe('unreachable');
    expect((wrapped as Error).cause).toBe(err);
  });

  it.each([
    ['a unique violation', withCode('23505')],
    ['a syntax error', withCode('42601')],
    ['a plain bug', new TypeError('x is undefined')],
  ])('leaves %s alone (a bug, not an outage)', (_name, err) => {
    expect(isUnavailable(err)).toBe(false);
    expect(asStoreError(err)).toBe(err);
  });
});
