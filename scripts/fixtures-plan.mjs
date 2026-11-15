// `pnpm fixtures:plan`: regenerates packages/data/fixtures/plan.demo.json from plan() (MP3, #163) and
// packages/data/fixtures/monteCarlo.demo.json from monteCarlo() with a fixed seed (MP7b, #167).
// The golden tests in packages/engine/plan.test.ts and monteCarlo.test.ts build the fixtures; with
// PLAN_FIXTURE_WRITE=1 they write them before comparing, so the generator and the check can never
// disagree.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'packages/engine/plan.test.ts', 'packages/engine/monteCarlo.test.ts', '-t', 'golden snapshot'],
  { stdio: 'inherit', env: { ...process.env, PLAN_FIXTURE_WRITE: '1' }, shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
