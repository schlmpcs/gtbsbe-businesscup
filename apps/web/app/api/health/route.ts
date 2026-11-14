// GET /api/health → 200 { ok: true, store: { status: 'ok' | 'unavailable', backend, reason? },
//                         build: { gameMode, gameSource, duelSource } }
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
//
// `build` is which game this image serves: the public NEXT_PUBLIC_* flags it was built with (Next
// inlines them, so this is what the browser bundle does too, whatever the container's run-time
// env says). Production is `duel` / `api` / `api`; `gameMode: "slider"` is the rollback. The
// post-deploy smoke check (deploy/README.md) and CI's deploy dry run read it, since the flags
// reach the image only at build time and nothing else shows them.
import { duelSource, gameMode, gameSource } from '@/lib/config';
import { storeHealth } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const store = await storeHealth();
  const build = { gameMode: gameMode(), gameSource: gameSource(), duelSource: duelSource() };
  return Response.json({ ok: true, store, build }, { headers: { 'Cache-Control': 'no-store' } });
}
