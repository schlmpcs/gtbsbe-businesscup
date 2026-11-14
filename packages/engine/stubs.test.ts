// Smoke tests for the shared engine pieces. Each task adds its own test file
// (cost.test.ts, forecast.test.ts, ...) instead of editing this one.
import { describe, expect, it } from 'vitest';
import { NotImplementedError, assumptions, notImplemented } from './index';

describe('assumptions', () => {
  it('each carries a source or assumption: true', () => {
    for (const [id, a] of Object.entries(assumptions)) {
      const ok = ('source' in a && a.source !== undefined) || ('assumption' in a && a.assumption === true);
      expect(ok, id).toBe(true);
    }
  });

  it('stores rates as decimals, not percents', () => {
    expect(assumptions.cardAprDefault.value).toBeLessThan(1);
    expect(assumptions.returnAnnualNominal.value).toBeLessThan(1);
  });
});

describe('notImplemented', () => {
  it('names the task', () => {
    const e = notImplemented('Y1');
    expect(e).toBeInstanceOf(NotImplementedError);
    expect(e.task).toBe('Y1');
    expect(e.message).toContain('Y1');
  });
});
