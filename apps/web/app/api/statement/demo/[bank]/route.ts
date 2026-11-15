// GET /api/statement/demo/<bank> → 200 text/csv: the statement a made-up demo bank "holds" (one of the
// synthetic statements in packages/data/fixtures/synthetic-statements), or 404 for an unknown bank.
//
// The demo bank link (features/bankDemo) is a DEMO, labelled so: there is no bank API. Its "Use these
// transactions" hands this file to the same in-browser CSV reader as an upload (parse, mask names,
// categorize through /api/statement/categorize), so its numbers come from the same path. The files are
// fixed, so every response is built once at build time.
import { readDemoStatementCsv } from '@lifeguessr/data/fixtures/node';
import { DEMO_BANK_IDS, demoBank, isDemoBankId } from '@/features/bankDemo/model/banks';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { bank: string }[] {
  return DEMO_BANK_IDS.map((bank) => ({ bank }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ bank: string }> }): Promise<Response> {
  const { bank } = await ctx.params;
  const csv = isDemoBankId(bank) ? readDemoStatementCsv(demoBank(bank).statement) : null;
  if (csv === null) return new Response('Not found', { status: 404 });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `inline; filename="${bank}-demo-statement.csv"`,
    },
  });
}
