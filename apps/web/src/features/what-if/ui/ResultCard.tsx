import type { ReactNode } from 'react';
import { whatIf as t } from '@/copy';
import { cx, formatMoney } from '@/ui-kit';
import type { Letter, ResultVM } from '../model/types';
import { LETTER_BG, LETTER_TEXT } from './ChoiceCard';

export type ResultCardProps = { result: ResultVM; children?: ReactNode };

/** The headline sentence and its split: "B leaves you $33,000 ahead in 2036." */
export function ResultHeadline({ result, size = 'lg' }: { result: ResultVM; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl';
  if (!result.winner) {
    return <p className={cx('font-display font-extrabold leading-tight', cls)}>{t.result.tie}</p>;
  }
  const amount = formatMoney(result.aheadBy);
  return (
    <p data-testid="what-if-ahead" className={cx('font-display font-extrabold leading-tight text-balance', cls)}>
      {t.result.aheadBefore(result.winner)}
      <span className={cx('tabular-nums', LETTER_TEXT[result.winner])}>{amount}</span>
      {t.result.aheadAfter(result.endYear)}
    </p>
  );
}

function Bar({ letter, value, max, axis }: { letter: Letter; value: number; max: number; axis: ResultVM['barAxis'] }) {
  const share = Math.round(Math.min(1, Math.abs(value) / max) * 1000) / 1000; // rounded: same on server and browser
  const fill = <span className={cx('block h-full rounded-full', LETTER_BG[letter])} style={{ width: `${share * 100}%` }} />;
  if (axis === 'left') {
    return <div className="flex h-md border-l-2 border-border">{value > 0 && fill}</div>;
  }
  // Costs grow to the right of the axis; savings (negative) to the left. Never red: color = side.
  return (
    <div className="grid grid-cols-[1fr_1fr] items-center">
      <div className="flex h-md justify-end">{value < 0 && fill}</div>
      <div className="flex h-md justify-start border-l-2 border-border">{value > 0 && fill}</div>
    </div>
  );
}

export function ResultCard({ result, children }: ResultCardProps) {
  return (
    <section aria-label={t.result.monthlyTitle} className="flex flex-col gap-xl rounded-xl bg-surface p-lg shadow-md sm:p-2xl">
      <div className="flex flex-col gap-md">
        <ResultHeadline result={result} />
        {result.decidedBy && (
          <p className="text-base text-text sm:text-lg">
            <span className="font-bold">{t.result.decidedBy}</span>{' '}
            {t.result.decided(result.decidedBy.term, result.decidedBy.winner, formatMoney(result.decidedBy.gap))}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <h3 className="text-lg font-bold">{t.result.monthlyTitle}</h3>
          <p className="text-sm text-text-muted">{t.result.monthlyHint}</p>
        </div>
        {result.bars.length === 0 ? (
          <p className="text-sm text-text-muted">{t.result.noMonthly}</p>
        ) : (
          <ul className="flex flex-col gap-lg">
            {result.bars.map((b) => (
              <li key={b.term} className="grid grid-cols-1 gap-sm sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:items-center sm:gap-lg">
                <span className="text-sm font-semibold">{t.result.termLabel(b.term)}</span>
                <div className="flex flex-col gap-xs">
                  {(['A', 'B'] as const).map((l) => (
                    <div key={l} className="grid grid-cols-[1.25rem_1fr_6rem] items-center gap-sm">
                      <span className={cx('text-xs font-extrabold', LETTER_TEXT[l])}>{l}</span>
                      <Bar letter={l} value={b[l]} max={result.barMax} axis={result.barAxis} />
                      <span className={cx('text-right text-sm font-semibold tabular-nums', b[l] === 0 ? 'text-text-muted' : 'text-text')}>
                        {formatMoney(b[l], { signed: true })}
                        <span className="text-xs font-normal text-text-muted">{t.result.perMonth}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </section>
  );
}
