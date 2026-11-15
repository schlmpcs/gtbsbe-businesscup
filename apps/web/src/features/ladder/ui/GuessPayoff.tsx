// The S5 guess paid off on a later step (S9 once a statement is applied, S8): "You guessed $X. You
// actually spend $Y", and how far off it was. While the spending is still the typical month for the
// person's household it says so, with one estimate tag, and points at what makes it real.
import { ladder } from '@/copy';
import { EstimateTag, formatMoney, Sticker } from '@/ui-kit';
import type { GuessPayoffVM } from '../model/types';

const t = ladder.guess;

export function GuessPayoff({ payoff: p, tone = 'surface' }: { payoff: GuessPayoffVM; tone?: 'surface' | 'ink' }) {
  const gap = formatMoney(Math.abs(p.difference));
  const verdict = Math.abs(p.difference) < 1 ? t.revealExact : p.difference > 0 ? t.revealMore(gap) : t.revealLess(gap);
  const ink = tone === 'ink';
  return (
    <section
      aria-label={t.payoffTitle}
      data-testid="guess-payoff"
      data-estimate={p.isEstimate ? 'true' : 'false'}
      className={
        ink
          ? 'flex flex-col gap-sm rounded-xl bg-ink p-xl text-on-primary shadow-md'
          : 'flex flex-col gap-sm rounded-xl bg-surface p-xl shadow-md'
      }
    >
      <h2 className="flex flex-wrap items-center gap-sm text-xs font-bold uppercase tracking-wide text-primary">
        {t.payoffTitle}
        {p.isEstimate && <EstimateTag className={ink ? 'bg-surface text-text' : undefined} />}
      </h2>
      <p className="text-lg font-semibold tabular-nums">
        {p.isEstimate
          ? t.payoffEstimate(formatMoney(p.guess), formatMoney(p.actual))
          : t.reveal(formatMoney(p.guess), formatMoney(p.actual))}
      </p>
      <Sticker tone={ink ? 'white' : 'ink'} tilt={-2} className="self-start text-sm">
        {verdict}
      </Sticker>
      {p.isEstimate && <p className={ink ? 'text-sm text-on-primary/60' : 'text-sm text-text-muted'}>{t.payoffEstimateNote}</p>}
    </section>
  );
}
