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

// The browser-code import rules below don't apply to server routes, server-only modules and tests.
const BROWSER_RULE_IGNORES = ['apps/web/app/api/**', 'apps/web/src/server/**', 'apps/web/**/*.test.{ts,tsx}', 'apps/web/e2e/**'];

const CATALOG_RESTRICTION = {
  name: '@lifeguessr/data/cards',
  message: 'Life cards hold the answers: load them only in server routes (app/api/**) and tests.',
};

// The browser modules that may load the sample cards (packages/data/fixtures/cards.ts):
// - the fixture game client, which plays them (an API build has no chunk for it);
// - S6 Closest life and the ladder progress, which show them openly as "sample lives" when today's
//   game wasn't played. They are not the API game's answers: the API plays the catalog
//   (packages/data/cards), which shares no card with the samples;
// - the /kit showcase (one sample card for the house scene demo);
// - apps/web/src/fixtures/cards.ts, the re-export they import.
const SAMPLE_CARD_MODULES = [
  'apps/web/src/features/game/model/fixtureClient.ts',
  'apps/web/src/features/ladder/model/useClosestLife.ts',
  'apps/web/src/features/ladder/model/useLadderProgress.ts',
  'apps/web/app/kit/samples.ts',
  'apps/web/src/fixtures/cards.ts', // the re-export itself
];

const SAMPLE_CARD_MESSAGE =
  "The sample cards are the fixture game's answers: browser code may load them only in SAMPLE_CARD_MODULES (eslint.config.mjs).";
const SAMPLE_CARD_RESTRICTIONS = [
  { name: '@/fixtures/cards', message: SAMPLE_CARD_MESSAGE },
  { name: '@lifeguessr/data/fixtures/cards', message: SAMPLE_CARD_MESSAGE },
];

const FIXTURE_CLIENT_RESTRICTION = {
  regex: '(^|/)fixtureClient$',
  message:
    'The fixture game client holds the answers: only features/game/model/client.ts loads it, with a dynamic import() that an API build drops. Tests may import it.',
};

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

  // The life-card catalog holds the game's answers: only server routes (app/api), server-only
  // modules (src/server, which the browser never imports) and tests may load it, so it can never
  // end up in a browser bundle. The sample cards are the fixture game's answers: browser code may
  // load them only in SAMPLE_CARD_MODULES, and the fixture game client only through the dynamic
  // import() in features/game/model/client.ts, which an API build drops (CI checks the built
  // chunks: apps/web/scripts/check-client-bundle.mjs). (features/*/ui below is stricter still.)
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ignores: [...BROWSER_RULE_IGNORES, ...SAMPLE_CARD_MODULES],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [CATALOG_RESTRICTION, ...SAMPLE_CARD_RESTRICTIONS], patterns: [FIXTURE_CLIENT_RESTRICTION] },
      ],
    },
  },
  {
    files: SAMPLE_CARD_MODULES,
    rules: {
      'no-restricted-imports': ['error', { paths: [CATALOG_RESTRICTION], patterns: [FIXTURE_CLIENT_RESTRICTION] }],
    },
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
