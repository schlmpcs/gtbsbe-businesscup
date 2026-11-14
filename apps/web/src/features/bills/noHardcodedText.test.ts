// Every word and glyph on the bills screen comes from src/copy: a source scan of the ui files.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('the bills UI has no hard-coded glyphs', () => {
  const dir = fileURLToPath(new URL('./ui/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'));
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  it.each([
    ['a dollar amount', /\$\d/],
    ['an arrow or chevron glyph', /[→‹›]/],
    ['a unit suffix', /(['"`])\/(mo|yr)\1/],
  ])('no %s', (_what, pattern) => {
    for (const f of files) expect(code(readFileSync(`${dir}${f}`, 'utf8')), f).not.toMatch(pattern);
  });
});
