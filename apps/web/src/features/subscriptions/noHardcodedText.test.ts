// Every word and glyph a person sees comes from src/copy (CLAUDE.md: all copy in `src/copy.ts`; the UI
// rule keeps it presentational). A source scan over the ui files for the literals a review found:
// unit suffixes, currency prefix, dashes and arrows, ticks and crosses, and a bare "to" for screen readers.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('./ui/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'));

/** The code of a file without its comments (a comment may say what it likes). */
const codeOf = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const LITERALS: [string, RegExp][] = [
  ['a unit suffix like "/mo"', /(['"`])\/(mo|yr|qtr)\1/],
  ['a currency prefix', /prefix="\$"/],
  ['an em dash used as a value', /(['"`])—\1/],
  ['a tick or cross glyph', /[✓✕]/],
  ['an arrow glyph', /→/],
  ['a bare "to" for screen readers', />\s*to\s*</],
];

describe('the subscription audit UI has no hard-coded text', () => {
  it('scans every ui file', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(LITERALS)('no %s', (_what, pattern) => {
    for (const file of files) {
      expect(codeOf(readFileSync(`${dir}${file}`, 'utf8')), file).not.toMatch(pattern);
    }
  });
});
