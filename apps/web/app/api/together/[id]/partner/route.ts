// PUT /api/together/<id>/partner { partner, goal? } → 200 { ok: true, plan } or 404.
// Spec: src/server/together/http.ts.
import { setPartner } from '@/server/together/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return setPartner(req, id);
}
