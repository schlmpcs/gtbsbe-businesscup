// CSV text → rows of cells (RFC 4180 with the leniency real bank exports need). Browser and
// server safe: no I/O. Ported from #55 (apps/web/src/lib/csv.ts) and extended: the delimiter is
// detected (comma, semicolon or tab), and a stray quote inside an unquoted cell is kept as text
// instead of failing the whole file (`5" TV MOUNT`). An unclosed quoted cell is still an error,
// because everything after it would be misread.

export class CsvSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvSyntaxError';
  }
}

export type Delimiter = ',' | ';' | '\t';
const DELIMITERS: readonly Delimiter[] = [',', ';', '\t'];

/** Counts each delimiter outside quotes on the first lines and picks the one used consistently. */
export function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '').slice(0, 20);
  let best: Delimiter = ',';
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const counts = lines.map((line) => {
      let n = 0;
      let quoted = false;
      for (const c of line) {
        if (c === '"') quoted = !quoted;
        else if (c === d && !quoted) n++;
      }
      return n;
    });
    // Lines that use it, weighted by how often: a header + rows with 3+ cells beats a stray `;`.
    const score = counts.filter((n) => n > 0).length * Math.min(...counts.filter((n) => n > 0), 99);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** Splits CSV text into rows. Blank lines are dropped; a leading BOM is ignored. */
export function rowsOf(text: string, delimiter?: Delimiter): string[][] {
  return numberedRowsOf(text, delimiter).map((r) => r.cells);
}

/** rowsOf, with the 1-based line of the file each row starts on. */
export function numberedRowsOf(text: string, delimiter: Delimiter = detectDelimiter(text)): { line: number; cells: string[] }[] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: { line: number; cells: string[] }[] = [];
  let line = 1;
  let rowLine = 1;
  let row: string[] = [];
  let cell = '';
  // plain: in an unquoted cell · quoted: inside quotes · closed: just after a closing quote
  let state: 'plain' | 'quoted' | 'closed' = 'plain';
  let cellStart = true;

  const endCell = () => {
    row.push(cell);
    cell = '';
    state = 'plain';
    cellStart = true;
  };
  const endRow = () => {
    endCell();
    if (row.some((v) => v.trim() !== '')) rows.push({ line: rowLine, cells: row });
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (state === 'quoted') {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          state = 'closed';
        }
      } else {
        cell += c;
        if (c === '\n' || (c === '\r' && src[i + 1] !== '\n')) line++;
      }
      continue;
    }
    if (c === delimiter) {
      endCell();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else if (c === '"' && cellStart && cell.trim() === '') {
      cell = ''; // spaces before an opening quote are padding
      state = 'quoted';
      cellStart = false;
    } else {
      // Text after a closing quote, or a quote inside an unquoted cell: keep it as text.
      cell += c;
      if (state === 'closed') state = 'plain';
      if (c.trim() !== '') cellStart = false;
    }
  }
  if (state === 'quoted') throw new CsvSyntaxError('A quoted cell is never closed.');
  endRow();
  return rows;
}
