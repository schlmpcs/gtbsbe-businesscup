// Starts one Monte Carlo request in its own Web Worker (monteCarlo.worker.ts) and calls back with the
// answer; the returned function cancels it by terminating the worker, so a stale run stops using the
// CPU at once. Where there is no Worker (the server, jsdom tests) the same request runs in a
// microtask instead, with the same answer: it is the same function either way (monteCarloRun.ts).
import { runMonteCarloRequest, type MonteCarloRequest, type MonteCarloResponse } from './monteCarloRun';

export type CancelJob = () => void;

export function startMonteCarloJob(request: MonteCarloRequest, onDone: (res: MonteCarloResponse) => void): CancelJob {
  let live = true;
  const finish = (res: MonteCarloResponse) => {
    if (!live) return;
    live = false;
    onDone(res);
  };

  if (typeof Worker === 'undefined') {
    void Promise.resolve().then(() => {
      if (live) finish(runMonteCarloRequest(request));
    });
    return () => {
      live = false;
    };
  }

  const worker = new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<MonteCarloResponse>) => {
    worker.terminate();
    finish(e.data);
  };
  worker.onerror = (e) => {
    e.preventDefault();
    worker.terminate();
    finish({ kind: 'error', message: e.message || 'Monte Carlo worker failed' });
  };
  worker.postMessage(request);
  return () => {
    live = false;
    worker.terminate();
  };
}
