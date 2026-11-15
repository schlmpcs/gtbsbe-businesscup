// The invite flow in three steps (your numbers → send the link → partner adds theirs). Steps before
// `current` show a check; `current` is highlighted. Presentational.
import { together as t } from '@/copy';
import { cx } from '@/ui-kit';

export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label={t.steps.label} data-testid="together-steps">
      <ol className="grid grid-cols-3 gap-sm">
        {t.steps.items.map((step, i) => {
          const n = i + 1;
          const done = n < current;
          const now = n === current;
          return (
            <li
              key={step.title}
              aria-current={now ? 'step' : undefined}
              className={cx(
                'relative flex min-w-0 flex-col gap-xs rounded-lg border p-sm transition-colors sm:p-md motion-reduce:transition-none',
                now ? 'border-primary bg-primary-soft' : done ? 'border-border bg-surface' : 'border-dashed border-border bg-transparent',
              )}
            >
              <span className="flex items-center gap-xs">
                <span
                  aria-hidden="true"
                  className={cx(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    done ? 'bg-positive text-on-primary' : now ? 'bg-primary text-on-primary' : 'bg-surface-strong text-text-muted',
                  )}
                >
                  {done ? '✓' : n}
                </span>
                <span className="sr-only">{t.steps.current(n)}{done ? `, ${t.steps.done}` : ''}: </span>
                <span className={cx('min-w-0 text-sm font-bold leading-tight', !now && !done && 'text-text-muted')}>{step.title}</span>
              </span>
              <span className="hidden text-xs text-text-muted sm:block">{step.body}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
