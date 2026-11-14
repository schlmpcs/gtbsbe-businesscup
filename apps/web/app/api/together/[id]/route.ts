// GET /api/together/<id> → 200 { ok: true, plan } or 404. Spec: src/server/together/http.ts.
import { readPlan } from '@/server/together/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return readPlan(req, id);
}
