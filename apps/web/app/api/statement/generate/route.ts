// GET /api/statement/generate?zip=78744&household=family&pay=steady&style=typical&seed=1[&asOf=2026-11-14]
//   → 200 text/csv: a generated three-month bank statement (packages/data/statementGen.ts) built
//     from the public area data for that ZIP. Onboarding's "Generate a life like yours" reads it
//     through the same in-browser reader, masking and categorizer as an upload.
//   400 { ok: false, error: { code: 'bad_request' } } for an unknown ZIP or option.
// Pure and seeded: the same query gives the same file. `asOf` defaults to today in New York.
import { areaData } from '@lifeguessr/data';
import { GEN_HOUSEHOLDS, GEN_PAY_BANDS, GEN_STYLES, generateStatement } from '@lifeguessr/data/statementGen';
import { z } from 'zod';
import { usEasternDate } from '@/lib/dates';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  zip: z.string().refine((zip) => areaData.some((a) => a.zip === zip)),
  household: z.enum(GEN_HOUSEHOLDS),
  pay: z.enum(GEN_PAY_BANDS),
  style: z.enum(GEN_STYLES),
  seed: z.coerce.number().int().min(0).max(1_000_000).default(1),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function GET(req: Request): Response {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return Response.json({ ok: false, error: { code: 'bad_request' } }, { status: 400 });
  const { asOf, ...spec } = parsed.data;
  const g = generateStatement({ ...spec, asOf: asOf ?? usEasternDate() });
  return new Response(g.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="statement.generated.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
