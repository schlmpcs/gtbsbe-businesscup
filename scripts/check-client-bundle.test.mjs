import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bundleRules, scanChunks, tokenPattern } from './check-client-bundle.mjs';

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A fake `.next/static` with the given chunk files (path → contents). */
function staticDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-check-'));
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

const HTTP_CLIENT = 'postJson(`${base}/api/daily/guess`,{anonId:e})';
const HTTP_DUEL_CLIENT = 'postJson(`${n}/api/daily/pick`,{anonId:r,date:t,round:e,choice:a})';
/** The fixture duel client's chunk: what a build with the default NEXT_PUBLIC_DUEL_SOURCE=fixtures has. */
const FIXTURE_DUEL_CLIENT = 'const D="lifeguessr.fixtureDuel";const r=`fixture-duel-${t}-${u}`;';
/** What a default build (duel in the browser, GAME_MODE unset so the slider ships too) must contain to be trusted. */
const DEFAULT_BUILD = `${HTTP_CLIENT};${FIXTURE_DUEL_CLIENT}`;

describe('check-client-bundle', () => {
  const rules = bundleRules({ duelSource: 'fixtures' }); // the default build

  it('reads every catalog card and both fixture client markers from the sources', () => {
    const labels = rules.forbidden.map((r) => r.label);
    expect(labels.filter((l) => l.startsWith('catalog card ')).length).toBeGreaterThanOrEqual(50); // 50 daily + the packs
    expect(labels).toContain('catalog card lc-001');
    expect(labels).toContain('fixture game client (FIXTURE_LOG_KEY)');
    expect(labels).toContain('fixture game client (its error message)');
    expect(labels).not.toContain('fixture duel client (its result id prefix)'); // the duel plays in the browser by default
    const api = bundleRules({ duelSource: 'api' });
    expect(api.forbidden.map((r) => r.label)).toContain('fixture duel client (its result id prefix)');
    expect(api.forbidden.filter((r) => r.label.startsWith('duel sample card ')).length).toBeGreaterThanOrEqual(10);
    expect(api.forbidden.map((r) => r.label)).toContain('duel sample card sample-duel-01');
    expect(labels).not.toContain('duel sample card sample-duel-01');
    expect(api.required.map((r) => r.label)).toEqual(['HTTP game client (/api/daily/guess)', 'HTTP duel client (/api/daily/pick)']);
    expect(rules.required.map((r) => r.label)).toEqual(['HTTP game client (/api/daily/guess)', 'fixture duel client (its result id prefix)']);
  });

  it('production (NEXT_PUBLIC_GAME_MODE=duel, duel against the server): the slider game has no chunk, so only the HTTP duel client is required', () => {
    const production = bundleRules({ duelSource: 'api', gameMode: 'duel' });
    expect(production.required.map((r) => r.label)).toEqual(['HTTP duel client (/api/daily/pick)']);
    expect(scanChunks(staticDir({ 'chunks/app/duel.js': HTTP_DUEL_CLIENT }), production)).toEqual([]);
    // A build that lost the duel client (or the wrong folder) is not trusted.
    expect(scanChunks(staticDir({ 'chunks/app/other.js': 'console.log(1)' }), production)).toEqual([
      'HTTP duel client (/api/daily/pick) is in no chunk: is this the right build?',
    ]);
    // The slider's HTTP client is required again with GAME_MODE=slider (the rollback build), and when the mode is unset.
    for (const gameMode of ['slider', undefined]) {
      expect(bundleRules({ duelSource: 'api', gameMode }).required.map((r) => r.label)).toContain('HTTP game client (/api/daily/guess)');
    }
    // The answers rules do not depend on the mode.
    expect(production.forbidden.map((r) => r.label)).toContain('catalog card lc-001');
    expect(production.forbidden.map((r) => r.label)).toContain('fixture duel client (its result id prefix)');
  });

  it('passes an API build: HTTP client present, sample lives allowed, no catalog card, no fixture client', () => {
    const dir = staticDir({
      'chunks/app/play.js': DEFAULT_BUILD,
      'chunks/app/me/closest.js': 'JSON.parse(\'[{"id":"sample-01-single-nocar-cheap","zip":"75216"}]\')',
    });
    expect(scanChunks(dir, rules)).toEqual([]);
  });

  it('finds a catalog card, as JSON or inside a string, and names the chunk', () => {
    const dir = staticDir({
      'chunks/a.js': DEFAULT_BUILD,
      'chunks/b.js': 'JSON.parse(\'[{"id":"lc-017","slot":2}]\')',
      'chunks/c.js': 'var x={id:"nyc25-3"}',
    });
    const problems = scanChunks(dir, rules);
    expect(problems).toEqual([
      expect.stringMatching(/^catalog card lc-017 is in chunks\/b\.js$/),
      expect.stringMatching(/^catalog card nyc25-3 is in chunks\/c\.js$/),
    ]);
  });

  it('finds the fixture game client', () => {
    const dir = staticDir({
      'chunks/a.js': DEFAULT_BUILD,
      'chunks/fixture.js': 'const K="lifeguessr.fixtureGame";throw new o(`No fixture data for card ${t}`,404)',
    });
    expect(scanChunks(dir, rules)).toEqual([
      'fixture game client (FIXTURE_LOG_KEY) is in chunks/fixture.js',
      'fixture game client (its error message) is in chunks/fixture.js',
    ]);
  });

  it('finds the fixture duel client when the duel plays against the server (NEXT_PUBLIC_DUEL_SOURCE=api)', () => {
    const dir = staticDir({
      'chunks/a.js': HTTP_CLIENT,
      'chunks/duel.js': 'const D="lifeguessr.fixtureDuel";const r=`fixture-duel-${t}-${u}`;',
    });
    expect(scanChunks(dir, bundleRules({ duelSource: 'api' }))).toEqual([
      'fixture duel client (its result id prefix) is in chunks/duel.js',
      'HTTP duel client (/api/daily/pick) is in no chunk: is this the right build?',
    ]);
    // By default (NEXT_PUBLIC_DUEL_SOURCE=fixtures) the duel plays in the browser on purpose.
    expect(scanChunks(dir, bundleRules({ duelSource: 'fixtures' }))).toEqual([]);
  });

  it('in a duel API build: passes with the HTTP duel client, fails on a duel sample card', () => {
    const api = bundleRules({ duelSource: 'api' });
    expect(scanChunks(staticDir({ 'chunks/a.js': HTTP_CLIENT, 'chunks/duel.js': HTTP_DUEL_CLIENT }), api)).toEqual([]);
    const leaky = staticDir({
      'chunks/a.js': HTTP_CLIENT,
      'chunks/duel.js': HTTP_DUEL_CLIENT,
      'chunks/ladder.js': 'JSON.parse(\'[{"id":"sample-duel-07","zip":"60629"}]\')',
    });
    expect(scanChunks(leaky, api)).toEqual(['duel sample card sample-duel-07 is in chunks/ladder.js']);
    // The default build plays the duel in the browser on those cards, on purpose.
    const fixtureBuild = staticDir({
      'chunks/a.js': DEFAULT_BUILD,
      'chunks/ladder.js': 'JSON.parse(\'[{"id":"sample-duel-07","zip":"60629"}]\')',
    });
    expect(scanChunks(fixtureBuild, bundleRules({ duelSource: 'fixtures' }))).toEqual([]);
  });

  it("fails a scan it can't trust: no build, no chunks, none of the game's clients", () => {
    expect(scanChunks(join(tmpdir(), 'no-such-next-static'), rules)[0]).toMatch(/does not exist/);
    expect(scanChunks(staticDir({ 'chunks/a.css': 'body{}' }), rules)).toEqual([expect.stringMatching(/no \.js chunks/)]);
    expect(scanChunks(staticDir({ 'chunks/a.js': 'console.log(1)' }), rules)).toEqual([
      expect.stringMatching(/^HTTP game client .* is in no chunk/),
      expect.stringMatching(/^fixture duel client .* is in no chunk/),
    ]);
  });

  it('matches ids as whole tokens only', () => {
    const p = tokenPattern('lc-001');
    expect(p.test('"lc-001"')).toBe(true);
    expect(p.test("id:'lc-001',")).toBe(true);
    expect(p.test('"lc-0010"')).toBe(false);
    expect(p.test('"xlc-001"')).toBe(false);
    expect(p.test('"my-lc-001"')).toBe(false);
  });
});
