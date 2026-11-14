// MP2: the planner functions are exported from the engine barrel with their final signatures and
// throw until their task lands. When a task implements one, it deletes that function's row here.
import { describe, expect, it } from 'vitest';
import * as engine from './index';

const stubs: [name: keyof typeof engine, task: string][] = [
];

describe('planner stubs', () => {
  // An empty table would leave the file without tests (a vitest error).
  if (stubs.length === 0) it.skip('none left: every MP2 planner function has landed', () => {});
  it.each(stubs)('%s is exported and throws "not implemented" (%s)', (name, task) => {
    const fn = engine[name];
    expect(typeof fn).toBe('function');
    expect(() => (fn as (...args: unknown[]) => unknown)()).toThrow(`not implemented: ${name} (${task})`);
  });
});
