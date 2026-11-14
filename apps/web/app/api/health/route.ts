// Liveness probe for the container healthcheck (deploy/compose.yaml). It checks nothing else on
// purpose: when the store or the LLM provider is down, the app is still up and degrades by itself.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
