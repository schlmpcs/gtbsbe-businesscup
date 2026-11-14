import { describe, expect, it } from 'vitest';
import { evalEnvFrom } from './evalEnv';

describe('evalEnvFrom', () => {
  it('merges the files in order, a later file winning', () => {
    const env = evalEnvFrom(
      [{ ANTHROPIC_API_KEY: 'from-env', ANTHROPIC_MODEL: 'm1' }, { ANTHROPIC_API_KEY: 'from-local' }],
      {},
    );
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'from-local', ANTHROPIC_MODEL: 'm1' });
  });

  it('leaves out what the shell already sets, so the shell wins', () => {
    const env = evalEnvFrom([{ ANTHROPIC_API_KEY: 'from-file', EVAL_RUNS: '9' }], { ANTHROPIC_API_KEY: 'from-shell' });
    expect(env).toEqual({ EVAL_RUNS: '9' });
  });

  it('treats an empty or blank shell value as unset, so it does not hide the file value', () => {
    for (const blank of ['', '   ', '\t']) {
      const env = evalEnvFrom([{ ANTHROPIC_API_KEY: 'from-file' }], { ANTHROPIC_API_KEY: blank });
      expect(env, JSON.stringify(blank)).toEqual({ ANTHROPIC_API_KEY: 'from-file' });
    }
  });

  it('skips names the files declare without a value', () => {
    expect(evalEnvFrom([{ A: undefined, B: 'b' }], {})).toEqual({ B: 'b' });
  });

  it('gives nothing when there are no files', () => {
    expect(evalEnvFrom([], { ANTHROPIC_API_KEY: 'from-shell' })).toEqual({});
  });
});
