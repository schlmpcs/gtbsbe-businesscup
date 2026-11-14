// Runs once when the Next.js server starts (https://nextjs.org/docs/app/guides/instrumentation).
// In production on Node it asks the model for the demo profile's 10-year forecast in the
// background, so the demo path finds it in the cache (src/server/ai/prewarm.ts). It does not hold
// up the start: the server answers requests meanwhile, and a request for the same forecast joins
// the call in flight.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;
  const { prewarmDemoForecast } = await import('./src/server/ai/prewarm');
  void prewarmDemoForecast();
}
