// ESLint flat config for the whole monorepo (`pnpm lint` runs `eslint .` from the root).
import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

// docs/ARCHITECTURE.md → Import rule: files in apps/web/src/features/*/ui/** are presentational
// and may import only @/ui-kit/**, @/copy, their feature's ../model/types, React, and sibling
// files in the same ui/ folder (./Foo). Everything else (engine, fixtures, APIs, model hooks,
// next/*, other features) is an error.
const UI_ALLOWED_IMPORT = String.raw`react|react/.+|@/ui-kit|@/ui-kit/.+|@/copy|\.\./model/types|\./[^/]+`;

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/next-env.d.ts',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/coverage/**',
    'docs/**',
  ]),

  js.configs.recommended,
  ...nextVitals,
  ...nextTs,

  {
    // React lives in apps/web, not at the root, so "detect" can't find it from here.
    settings: { next: { rootDir: 'apps/web/' }, react: { version: '19.3' } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },

  // Node scripts and config files.
  {
    files: ['scripts/**/*.mjs', '**/*.config.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },

  // Presentational UI: the import rule.
  {
    files: ['apps/web/src/features/*/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `^(?!(?:${UI_ALLOWED_IMPORT})$)`,
              message:
                'features/*/ui is presentational: import only @/ui-kit/**, @/copy and ../model/types (props in, events out). Move logic to ../model.',
            },
          ],
        },
      ],
    },
  },

  // The engine is pure: no I/O, no clock, no randomness, no AI, no framework.
  {
    files: ['packages/engine/**/*.ts'],
    ignores: ['packages/engine/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'The engine is pure: no I/O.' },
        { name: 'Date', message: 'The engine is pure: pass dates/months in as arguments.' },
        { name: 'process', message: 'The engine is pure: no environment access.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'The engine is deterministic: no unseeded randomness.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(node:|fs$|path$|react|next|@anthropic-ai/|@lifeguessr/data)',
              message: 'The engine is pure: no Node APIs, frameworks, AI clients or data loading (fixtures are for tests only).',
            },
          ],
        },
      ],
    },
  },
]);
