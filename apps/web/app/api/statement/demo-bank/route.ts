// GET /api/statement/demo-bank?bank=chase&n=0 → 200 text/csv: the statement behind the simulated
// "Connect your bank" on /start. Nothing connects to a bank: the file is the bank's n-th invented
// customer's export from packages/data/fixtures/synthetic-statements (packages/data/demoBanks.ts),
// and the app reads it through the same in-browser reader and categorizer as an upload.
//   404 { ok: false, error: { code: 'not_found' } } for an unknown bank.
import { demoBankAccount, findDemoBank } from '@lifeguessr/data/demoBanks';
import { readSyntheticStatement } from '@lifeguessr/data/fixtures/node';

export const runtime = 'nodejs';

export function GET(req: Request): Response {
  const params = new URL(req.url).searchParams;
  const bank = findDemoBank(params.get('bank') ?? '');
  if (!bank) return Response.json({ ok: false, error: { code: 'not_found' } }, { status: 404 });
  const n = Number(params.get('n') ?? 0);
  const account = demoBankAccount(bank, Number.isFinite(n) ? n : 0);
  return new Response(readSyntheticStatement(account.file), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `inline; filename="${bank.id}-checking.csv"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
