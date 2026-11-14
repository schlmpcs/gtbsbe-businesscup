// Vitest config of the live forecast eval only: `pnpm eval:forecast` (root package.json). It is not
// a workspace project (the root `projects` list takes `vitest.config.ts`), so `pnpm test` never runs
// it. The eval calls the real model: see evals/forecast.eval.ts.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(webRoot, '../..');

/**
 * Vitest does not put `.env` files into `process.env`, and the app's client reads the key there
 * (`getLlmClient`). So the repo root's `.env`, then `.env.local` (which wins), are read here and
 * handed to the tests as `test.env`, the way Vite's `loadEnv('', repoRoot, '')` would. A variable
 * already set in the environment wins over the files. Nothing is printed. (`node:util`'s parser
 * rather than `loadEnv`: `vite` is not a dependency of apps/web, and under pnpm it can't be
 * imported from here.)
 */
function loadRepoEnv(): Record<string, string> {
  const fromFiles: Record<string, string | undefined> = {};
  for (const name of ['.env', '.env.local']) {
    const file = resolve(repoRoot, name);
    if (existsSync(file)) Object.assign(fromFiles, parseEnv(readFileSync(file, 'utf8')));
  }
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(fromFiles)) {
    if (value !== undefined && process.env[name] === undefined) env[name] = value;
  }
  return env;
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
