// Vitest config of the live forecast eval only: `pnpm eval:forecast` (root package.json). It is not
// a workspace project (the root `projects` list takes `vitest.config.ts`), so `pnpm test` never runs
// it. The eval calls the real model: see evals/forecast.eval.ts.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';
import { evalEnvFrom } from './src/server/ai/evalEnv.ts';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(webRoot, '../..');

/**
 * Vitest does not put `.env` files into `process.env`, and the app's client reads the key there
 * (`getLlmClient`). So the repo root's `.env`, then `.env.local` (which wins), are read here and
 * handed to the tests as `test.env`, the way Vite's `loadEnv('', repoRoot, '')` would. A variable
 * the shell sets (non-blank) wins over the files: see `evalEnvFrom`. Nothing is printed.
 * (`node:util`'s parser rather than `loadEnv`: `vite` is not a dependency of apps/web, and under
 * pnpm it can't be imported from here.)
 */
function loadRepoEnv(): Record<string, string> {
  const files = ['.env', '.env.local']
    .map((name) => resolve(repoRoot, name))
    .filter((file) => existsSync(file))
    .map((file) => parseEnv(readFileSync(file, 'utf8')));
  return evalEnvFrom(files, process.env);
}

export default defineConfig({
  // `vitest run --config apps/web/vitest.eval.config.ts` is run from the repo root, whose cwd would
  // otherwise be the root here.
  root: webRoot,
  resolve: {
    alias: { '@': resolve(webRoot, 'src') },
  },
  test: {
    name: 'web-eval',
    // The server code under test; no DOM and no vitest.setup.ts (jest-dom, jsdom shims).
    environment: 'node',
    include: ['evals/**/*.eval.ts'],
    env: loadRepoEnv(),
    // A live call takes seconds; the eval sets its own, longer timeout from the run count.
    testTimeout: 15 * 60_000,
  },
});
