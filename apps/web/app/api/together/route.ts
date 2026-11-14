// POST /api/together { partner, goal? } → 201 { ok: true, plan }. Spec: src/server/together/http.ts.
import { createPlan } from '@/server/together/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => createPlan(req);
