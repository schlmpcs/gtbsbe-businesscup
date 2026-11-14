#!/usr/bin/env node
// Checks a built web app's browser chunks (apps/web/.next/static) for game answers. Run it on a
// build made with NEXT_PUBLIC_GAME_SOURCE=api (production's setting); CI does, right after the
// build. It fails when a browser chunk contains:
// - a life-card catalog id (packages/data/cards/cards.json): the API game's answers live only on
//   the server;
// - the fixture game client (apps/web/src/features/game/model/fixtureClient.ts), which plays the
//   sample cards in the browser. client.ts loads it with a dynamic import() that an API build
//   drops, so it must have no chunk at all.
// - in a build with NEXT_PUBLIC_DUEL_SOURCE=api (the duel against the server): the fixture duel
//   client (duelFixtureClient.ts, loaded by duelClient.ts the same way) and the duel sample cards
//   it plays (packages/data/fixtures/cards.duel.sample.json, ids sample-duel-*). In a build with
//   the default NEXT_PUBLIC_DUEL_SOURCE=fixtures the duel plays in the browser on those made-up
//   cards (no catalog card), so they ship on purpose there (production until #120).
// It also fails when the scan can't be trusted: no chunks, no chunk with the HTTP game client, or
// in a duel API build no chunk with the HTTP duel client (proof that the game code was scanned).
//
// The sample cards themselves (packages/data/fixtures/cards.ts, not the duel's) may ship: S6
// Closest life and the ladder show them openly as sample lives, the /kit showcase uses one, and
// they share no card with the catalog (eslint.config.mjs, SAMPLE_CARD_MODULES).
//
// Usage: node scripts/check-client-bundle.mjs [path/to/.next]   (default apps/web/.next)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CATALOG_PATH = join(root, 'packages/data/cards/cards.json');
const FIXTURE_CLIENT_PATH = join(root, 'apps/web/src/features/game/model/fixtureClient.ts');
const HTTP_CLIENT_PATH = join(root, 'apps/web/src/features/game/model/client.ts');
const FIXTURE_DUEL_CLIENT_PATH = join(root, 'apps/web/src/features/game/model/duelFixtureClient.ts');
const HTTP_DUEL_CLIENT_PATH = join(root, 'apps/web/src/features/game/model/duelClient.ts');
const DUEL_SAMPLE_PATH = join(root, 'packages/data/fixtures/cards.duel.sample.json');

/** The duel's data source the build was made with (same rule as apps/web/src/lib/config.ts duelSource). */
const envDuelSource = () => (process.env.NEXT_PUBLIC_DUEL_SOURCE === 'api' ? 'api' : 'fixtures');

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
 * - forbidden: every catalog card id, two string literals of the fixture game client (its
 *   storage key and an error message no other module has) and, when the duel plays against the
 *   server (`duelSource: 'api'`), the fixture duel client's result id prefix and every duel
 *   sample card id;
 * - required: the HTTP game client's guess route and, in a duel API build, the HTTP duel
 *   client's pick route.
 */
export function bundleRules({ duelSource = envDuelSource() } = {}) {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('packages/data/cards/cards.json: expected a non-empty array of cards');
  const fixtureSource = readFileSync(FIXTURE_CLIENT_PATH, 'utf8');
  const logKey = /export const FIXTURE_LOG_KEY = '([^']+)'/.exec(fixtureSource)?.[1];
  if (!logKey) throw new Error('fixtureClient.ts: FIXTURE_LOG_KEY not found: update scripts/check-client-bundle.mjs');
  // The duel log's storage key is shared with S1 Today (duelProgress.ts), so the duel client's own
  // marker is the result id prefix only it writes.
  const duelMarker = literalIn(FIXTURE_DUEL_CLIENT_PATH, 'fixture-duel-');
  const duelSamples = JSON.parse(readFileSync(DUEL_SAMPLE_PATH, 'utf8'));
  if (!Array.isArray(duelSamples) || duelSamples.length === 0) throw new Error('cards.duel.sample.json: expected a non-empty array of cards');
  return {
    forbidden: [
      ...catalog.map((card) => ({ label: `catalog card ${card.id}`, pattern: tokenPattern(card.id) })),
      { label: 'fixture game client (FIXTURE_LOG_KEY)', pattern: new RegExp(escapeRe(logKey)) },
      {
        label: 'fixture game client (its error message)',
        pattern: new RegExp(escapeRe(literalIn(FIXTURE_CLIENT_PATH, 'No fixture data for card'))),
      },
      ...(duelSource === 'api'
        ? [
            { label: 'fixture duel client (its result id prefix)', pattern: new RegExp(escapeRe(duelMarker)) },
            ...duelSamples.map((card) => ({ label: `duel sample card ${card.id}`, pattern: tokenPattern(card.id) })),
          ]
        : []),
    ],
    required: [
      { label: 'HTTP game client (/api/daily/guess)', pattern: new RegExp(escapeRe(literalIn(HTTP_CLIENT_PATH, '/api/daily/guess'))) },
      ...(duelSource === 'api'
        ? [{ label: 'HTTP duel client (/api/daily/pick)', pattern: new RegExp(escapeRe(literalIn(HTTP_DUEL_CLIENT_PATH, '/api/daily/pick'))) }]
        : []),
    ],
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
    console.error('Build with NEXT_PUBLIC_GAME_SOURCE=api (and run this with the build\'s NEXT_PUBLIC_DUEL_SOURCE) for this check. See scripts/check-client-bundle.mjs.');
    process.exit(1);
  }
  const count = listChunks(staticDir).length;
  const ids = rules.forbidden.filter((r) => r.label.startsWith('catalog card ')).length;
  const duel = envDuelSource() === 'api'
    ? `no fixture game or duel client, no duel sample card (${rules.forbidden.filter((r) => r.label.startsWith('duel sample card ')).length} ids), HTTP duel client present`
    : 'no fixture game client (the duel plays in the browser: NEXT_PUBLIC_DUEL_SOURCE=fixtures)';
  console.log(`OK: ${count} browser chunks, no catalog card (${ids} ids) and ${duel}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
