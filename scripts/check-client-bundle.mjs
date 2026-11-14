#!/usr/bin/env node
// Checks a built web app's browser chunks (apps/web/.next/static) for game answers. Run it on a
// build made with NEXT_PUBLIC_GAME_SOURCE=api (production's setting); CI does, right after the
// build. It fails when a browser chunk contains:
// - a life-card catalog id (packages/data/cards/cards.json): the API game's answers live only on
//   the server;
// - the fixture game client (apps/web/src/features/game/model/fixtureClient.ts), which plays the
//   sample cards in the browser. client.ts loads it with a dynamic import() that an API build
//   drops, so it must have no chunk at all.
// It also fails when the scan can't be trusted: no chunks, or no chunk with the HTTP game client
// (proof that the game code was scanned).
//
// The sample cards themselves may ship: S6 Closest life and the ladder show them openly as sample
// lives, the /kit showcase uses one, and they share no card with the catalog (eslint.config.mjs,
// SAMPLE_CARD_MODULES).
//
// Usage: node scripts/check-client-bundle.mjs [path/to/.next]   (default apps/web/.next)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CATALOG_PATH = join(root, 'packages/data/cards/cards.json');
const FIXTURE_CLIENT_PATH = join(root, 'apps/web/src/features/game/model/fixtureClient.ts');
const HTTP_CLIENT_PATH = join(root, 'apps/web/src/features/game/model/client.ts');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for `text` as a whole token: not part of a longer id such as lc-0010 or my-lc-001. */
export const tokenPattern = (text) => new RegExp(`(?<![\\w-])${escapeRe(text)}(?![\\w-])`);

/** Every .js file under `dir`, recursively. */
export function listChunks(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listChunks(path));
    else if (name.endsWith('.js')) out.push(path);
  }
  return out;
}

/** A string literal the source file must contain; throws if it doesn't (the check would go stale). */
function literalIn(path, literal) {
  if (!readFileSync(path, 'utf8').includes(literal)) {
    throw new Error(`${relative(root, path)} no longer contains ${JSON.stringify(literal)}: update scripts/check-client-bundle.mjs`);
  }
  return literal;
}

/**
 * What must not ship and what must, read from the sources so the check follows them:
 * - forbidden: every catalog card id, and two string literals of the fixture game client (its
 *   storage key and an error message no other module has);
 * - required: the HTTP game client's guess route.
 */
export function bundleRules() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('packages/data/cards/cards.json: expected a non-empty array of cards');
  const fixtureSource = readFileSync(FIXTURE_CLIENT_PATH, 'utf8');
  const logKey = /export const FIXTURE_LOG_KEY = '([^']+)'/.exec(fixtureSource)?.[1];
  if (!logKey) throw new Error('fixtureClient.ts: FIXTURE_LOG_KEY not found: update scripts/check-client-bundle.mjs');
  return {
    forbidden: [
      ...catalog.map((card) => ({ label: `catalog card ${card.id}`, pattern: tokenPattern(card.id) })),
      { label: 'fixture game client (FIXTURE_LOG_KEY)', pattern: new RegExp(escapeRe(logKey)) },
      {
        label: 'fixture game client (its error message)',
        pattern: new RegExp(escapeRe(literalIn(FIXTURE_CLIENT_PATH, 'No fixture data for card'))),
      },
    ],
    required: [{ label: 'HTTP game client (/api/daily/guess)', pattern: new RegExp(escapeRe(literalIn(HTTP_CLIENT_PATH, '/api/daily/guess'))) }],
  };
}

/**
 * Scans the chunks in `staticDir`. Returns the problems found: each forbidden rule with the chunks
 * that match it, each required rule no chunk matches, and an empty scan.
 */
export function scanChunks(staticDir, { forbidden, required }) {
  if (!existsSync(staticDir)) return [`${staticDir} does not exist: build the app first (pnpm build)`];
  const chunks = listChunks(staticDir).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  if (chunks.length === 0) return [`no .js chunks under ${staticDir}`];
  const problems = [];
  for (const rule of forbidden) {
    const hits = chunks.filter((c) => rule.pattern.test(c.text)).map((c) => relative(staticDir, c.path));
    if (hits.length > 0) problems.push(`${rule.label} is in ${hits.join(', ')}`);
  }
  for (const rule of required) {
    if (!chunks.some((c) => rule.pattern.test(c.text))) problems.push(`${rule.label} is in no chunk: is this the right build?`);
  }
  return problems;
}

function main() {
  const nextDir = resolve(process.argv[2] ?? join(root, 'apps/web/.next'));
  const staticDir = join(nextDir, 'static');
  const rules = bundleRules();
  const problems = scanChunks(staticDir, rules);
  if (problems.length > 0) {
    console.error(`Browser chunks in ${relative(root, staticDir) || staticDir} leak game answers or can't be checked:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('Build with NEXT_PUBLIC_GAME_SOURCE=api for this check. See scripts/check-client-bundle.mjs.');
    process.exit(1);
  }
  const count = listChunks(staticDir).length;
  console.log(`OK: ${count} browser chunks, no catalog card (${rules.forbidden.length - 2} ids) and no fixture game client.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
