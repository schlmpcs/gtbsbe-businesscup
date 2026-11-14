import { defineConfig } from 'vitest/config';

// `pnpm test` runs every workspace project: packages/* (engine, types, data), apps/web (utils) and
// the root scripts' own tests (scripts/*.test.mjs, e.g. the browser-bundle check).
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web', { test: { name: 'scripts', include: ['scripts/**/*.test.mjs'], environment: 'node' } }],
  },
});
