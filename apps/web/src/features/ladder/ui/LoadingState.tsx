// Skeleton shown while saved state is being read (view-model status 'loading').
import { ladder } from '@/copy';

export function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{ladder.shell.loading}</span>
      <div aria-hidden="true" className="h-2xl w-1/2 animate-pulse rounded-md bg-surface-strong" />
      <div aria-hidden="true" className="h-3xl animate-pulse rounded-lg bg-surface" />
      <div aria-hidden="true" className="h-3xl animate-pulse rounded-lg bg-surface" />
    </div>
  );
}
