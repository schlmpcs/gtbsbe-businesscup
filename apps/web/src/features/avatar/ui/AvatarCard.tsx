import { avatar as t } from '@/copy';
import { formatMoney, formatRate } from '@/ui-kit';
import type { AvatarPreview } from '../model/types';
/** The same fields and formatting for a draft preview and its saved public payload. */
export function AvatarCard({ preview }: { preview: AvatarPreview }) {
  const p = preview.payload;
  const rows = [
    ['ageBand', p.ageBand],
    ['metro', p.metro || t.none],
    ['netWorth', t.about(formatMoney(p.netWorth))],
    ['monthlyCost', t.about(formatMoney(p.monthlyCost))],
    ['rentShare', p.rentShare === null ? t.none : formatRate(p.rentShare)],
    ['debtTotal', t.about(formatMoney(p.debtTotal))],
    ['facts.hasCar', p.facts.hasCar ? t.yes : t.no],
    ['facts.kids', p.facts.kids === 3 ? '3+' : String(p.facts.kids)],
    ['facts.householdAdults', String(p.facts.householdAdults)],
  ] as const;
  return (
    <div data-testid="avatar-payload">
      <p className="font-bold">{t.stamp[p.stamp]}</p>
      <dl className="grid grid-cols-2 gap-sm">
        {rows.map(([field, value]) => (
          <div key={field}>
            <dt className="text-sm text-text-muted">{t.fields[field]}</dt>
            <dd>
              {value}
              {preview.estimatedFields.includes(field) && (
                <span className="text-xs text-text-muted"> · {t.estimate}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
