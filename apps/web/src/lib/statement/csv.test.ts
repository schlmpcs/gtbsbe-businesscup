// Cases ported from #55 (apps/web/src/lib/csv.test.ts, node:test → Vitest), plus delimiter detection
// and the leniency real exports need.
import { describe, expect, it } from 'vitest';
import { CsvSyntaxError, detectDelimiter, numberedRowsOf, rowsOf } from './csv';

describe('rowsOf', () => {
  it('handles quoted commas, embedded newlines, escaped quotes and CRLF', () => {
    expect(rowsOf('a,b\r\n"one,two","say ""hello""\nagain"\r\n')).toEqual([
      ['a', 'b'],
      ['one,two', 'say "hello"\nagain'],
    ]);
  });

  it('drops a BOM and blank lines, keeps empty cells', () => {
    expect(rowsOf('\uFEFFa,b,c\n\n1,,3\n,,\n')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
  });

  it('handles a lone CR as a line break (old Mac exports)', () => {
    expect(rowsOf('a,b\r1,2\r')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps a stray quote inside an unquoted cell as text', () => {
    expect(rowsOf('a,b\nBEST BUY 5" MOUNT,10')).toEqual([['a', 'b'], ['BEST BUY 5" MOUNT', '10']]);
    expect(rowsOf('a,b\n"x"y,1')).toEqual([['a', 'b'], ['xy', '1']]);
  });

  it('allows spaces before an opening quote', () => {
    expect(rowsOf('a, "b,c"')).toEqual([['a', 'b,c']]);
  });

  it('fails on an unclosed quoted cell', () => {
    expect(() => rowsOf('a,b\n"oops,b')).toThrow(CsvSyntaxError);
  });

  it('reads semicolon and tab separated files', () => {
    expect(rowsOf('Date;Description;Amount\n2026-01-02;"A; B";-5,00')).toEqual([
      ['Date', 'Description', 'Amount'],
      ['2026-01-02', 'A; B', '-5,00'],
    ]);
    expect(rowsOf('Date\tDescription\tAmount\n2026-01-02\tShop, Inc\t-5.00')).toEqual([
      ['Date', 'Description', 'Amount'],
      ['2026-01-02', 'Shop, Inc', '-5.00'],
    ]);
  });
});

describe('numberedRowsOf', () => {
  it('gives the file line each row starts on, counting blank lines and newlines inside quotes', () => {
    expect(numberedRowsOf('a,b\r\n\r\n"x\ny",1\nz,2').map((r) => r.line)).toEqual([1, 3, 5]);
  });
});

describe('detectDelimiter', () => {
  it('picks the separator used on every line, ignoring ones inside quotes', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b;c\n"1,5";2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('Date,Description,Amount\n2026-01-01,"A;B",5')).toBe(',');
  });
});
