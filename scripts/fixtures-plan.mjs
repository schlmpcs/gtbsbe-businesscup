// `pnpm fixtures:plan`: regenerates packages/data/fixtures/plan.demo.json from plan() (MP3, #163).
// The golden test in packages/engine/plan.test.ts builds the fixture; with PLAN_FIXTURE_WRITE=1 it
// writes it before comparing, so the generator and the check can never disagree.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'packages/engine/plan.test.ts', '-t', 'golden snapshot'],
  { stdio: 'inherit', env: { ...process.env, PLAN_FIXTURE_WRITE: '1' }, shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
