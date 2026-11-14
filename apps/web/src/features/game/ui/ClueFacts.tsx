import { game as t } from '@/copy';
import { cx, formatMoney, formatRate } from '@/ui-kit';
import type { ClueFactVM } from '../model/types';

function factText(f: ClueFactVM): string {
  switch (f.kind) {
    case 'noCar':
      return t.facts.noCar;
    case 'car':
      return f.financed
        ? t.facts.carFinanced(formatMoney(f.price), f.termMonths, formatRate(f.apr))
        : t.facts.car(formatMoney(f.price));
    case 'kids':
      return f.ages.length === 0 ? t.facts.noKids : t.facts.kids(f.ages);
    case 'eatingOut':
      return t.facts.eatingOut(f.perWeek);
    case 'household':
      return t.facts.household(f.adults, f.kids);
    case 'zip':
      return f.tier ? t.facts.zipTier(f.zip, f.tier) : t.facts.zip(f.zip);
  }
}

/** The facts a clue room (or the revealed card) shows, one per line. */
export function ClueFacts({ facts, className }: { facts: readonly ClueFactVM[]; className?: string }) {
  if (facts.length === 0) return null;
  return (
    <ul className={cx('flex flex-col gap-xs', className)}>
      {facts.map((f, i) => (
        <li key={`${f.kind}-${i}`}>{factText(f)}</li>
      ))}
    </ul>
  );
}
