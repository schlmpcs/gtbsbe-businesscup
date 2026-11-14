// GET /api/health → 200 { ok: true, store: { status: 'ok' | 'unavailable', backend, reason? } }
//
// Liveness, for the container healthcheck (deploy/compose.yaml): it answers 200 whenever the app
// process serves requests, even when the store is down. A database blip must not mark the app
// unhealthy: Docker would not restart it anyway, a deploy would roll back to a previous image that
// uses the same database, and every route that does not need the store keeps working (the store
// routes answer 503 by themselves).
//
// `store` is the readiness half, read by deploy/remote.sh right after a deploy: if the new image
// cannot use the store (bad migration, bad STORE_URL handling) the deploy is rolled back. It is
// checked with a short timeout and without details, since this route is public.
import { storeHealth } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const store = await storeHealth();
  return Response.json({ ok: true, store }, { headers: { 'Cache-Control': 'no-store' } });
}
