// GET /api/statement/sample → 200 text/csv: the sample bank statement
// (packages/data/fixtures/statement.sample.csv, a made-up Chase-style export, Jul–Nov 2026).
//
// "Try with sample statement" on S9 downloads it and hands it to the same in-browser reader as a
// file the user picks (parse, mask names, categorize through /api/statement/categorize), so its
// numbers come from exactly the same path as a real upload. The file is fixed, so the response is
// built once at build time.
import { readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(readStatementSampleCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="statement.sample.csv"',
    },
  });
}
