// Fact chip text for a choice card or the confirm box (copy only; numbers come from the view-model).
import { whatIf as t } from '@/copy';
import { formatMoney, formatRate } from '@/ui-kit';
import type { ChoiceFactVM } from '../model/types';

const money = (n: number) => formatMoney(n);

export function factText(f: ChoiceFactVM): string {
  switch (f.kind) {
    case 'price': return t.facts.price(money(f.amount));
    case 'loan': return `${t.facts.loan(formatRate(f.apr), f.termMonths)} · ${t.facts.loanMonthly(money(f.monthly))}`;
    case 'down': return t.facts.down(money(f.amount));
    case 'payWith': return f.way === 'cash' ? t.facts.cash : t.facts.card;
    case 'recurring': return t.facts.recurring(money(f.amount), f.per);
    case 'place': return t.facts.place(f.metro, f.tier);
    case 'kid': return f.childcare !== null && f.childcare > 0
      ? `${t.facts.kid(f.age, f.inMonths)} · ${t.facts.childcare(money(f.childcare))}`
      : t.facts.kid(f.age, f.inMonths);
    case 'income': return f.grossYearly !== null
      ? t.facts.grossRaise(formatMoney(f.grossYearly, { signed: true }))
      : t.facts.income(formatMoney(f.monthlyDelta, { signed: true }));
    case 'rent': return t.facts.rent(money(f.monthly));
    case 'payDebt': return f.amount === null ? t.facts.noDebt : t.facts.payDebt(money(f.amount));
    case 'keep': return t.facts.keep;
    case 'asItIs': return t.facts.asItIs;
    case 'afford': return f.verdict === 'wait' ? t.facts.afford.wait(f.waitMonths ?? 1) : t.facts.afford[f.verdict];
  }
}
