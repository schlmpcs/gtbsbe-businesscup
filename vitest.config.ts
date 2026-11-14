import { defineConfig } from 'vitest/config';

// `pnpm test` runs every workspace project: packages/* (engine, types, data) and apps/web (utils).
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web'],
  },
});
