// Web Worker for /plan's Monte Carlo (monteCarloRun.ts), so a run of up to 5,000 paths never freezes
// the page. One request per worker: monteCarloJob.ts starts a worker per run and terminates it when
// the run is cancelled (settings or plan changed) or done. Bundled by Next from
// `new Worker(new URL('./monteCarlo.worker.ts', import.meta.url))`; no config needed.
import { runMonteCarloRequest, type MonteCarloRequest, type MonteCarloResponse } from './monteCarloRun';

/** What the worker answers for one message (exported for tests). */
export function handleMonteCarloMessage(data: MonteCarloRequest): MonteCarloResponse {
  return runMonteCarloRequest(data);
}

type WorkerScope = { onmessage: ((e: MessageEvent<MonteCarloRequest>) => void) | null; postMessage: (msg: MonteCarloResponse) => void };

// Only inside a worker (a test importing this module leaves its window alone).
if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined') {
  const scope = globalThis as unknown as WorkerScope;
  scope.onmessage = (e) => scope.postMessage(handleMonteCarloMessage(e.data));
}
