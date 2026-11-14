// MP2: the planner functions are exported from the engine barrel with their final signatures and
// throw until their task lands. When a task implements one, it deletes that function's row here.
import { describe, expect, it } from 'vitest';
import * as engine from './index';

const stubs: [name: keyof typeof engine, task: string][] = [
  ['plan', 'MP3'],
  ['monteCarlo', 'MP5'],
  ['defaultEvent', 'MP4'],
  ['expandEvent', 'MP4'],
  ['buyHomeBreakdown', 'MP4'],
  ['expenseFinancingBreakdown', 'MP4'],
  ['accountsToProfile', 'MP8'],
  ['profileToAccounts', 'MP8'],
  ['netWorthSummary', 'MP8'],
];

describe('planner stubs', () => {
  it.each(stubs)('%s is exported and throws "not implemented" (%s)', (name, task) => {
    const fn = engine[name];
    expect(typeof fn).toBe('function');
    expect(() => (fn as (...args: unknown[]) => unknown)()).toThrow(`not implemented: ${name} (${task})`);
  });
});
