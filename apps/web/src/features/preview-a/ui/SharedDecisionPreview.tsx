// S29 Shared decision /d/[id] (design preview). Spec: docs/design/USER-JOURNEY.md → After the cut
// line. What a partner sees from a Loan Lab link: Path A vs Path B, no login. The loan numbers come
// from the engine on the demo profile (see ../model/samples.ts).
import { previewA } from '@/copy';
import { buttonClassName, Card, formatMoney, formatRate, Money, Tag } from '@/ui-kit';
import type { DecisionPath, SharedDecisionPreviewProps } from '../model/types';
import { Pill, PreviewHeader, PreviewMain } from './shared';

const t = previewA.shared;

function PathCard({ path, highlight }: { path: DecisionPath; highlight?: string }) {
  return (
    <Card as="section" aria-label={t.pathLabel(path.id)} className="flex flex-col gap-lg" data-testid={`path-${path.id}`}>
      <div className="flex flex-col gap-xs">
        <Pill tone="ink">{t.pathLabel(path.id)}</Pill>
        <h2 className="font-display text-3xl font-extrabold leading-tight">{t.terms(path.termMonths, formatRate(path.apr))}</h2>
        {highlight && <p className="text-sm font-semibold text-positive">{highlight}</p>}
      </div>
      <dl className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <dt className="text-sm text-text-muted">{t.monthly}</dt>
          <dd className="font-display text-4xl font-extrabold leading-tight">
            <Money value={path.monthly} />
          </dd>
        </div>
        <div className="flex flex-col gap-xs">
          <dt className="text-sm text-text-muted">{t.interest}</dt>
          <dd className="text-2xl font-bold">
            <Money value={path.totalInterest} />
          </dd>
        </div>
        <div className="flex flex-col gap-xs">
          <dt className="text-sm text-text-muted">{t.effect}</dt>
          <dd className="text-2xl font-bold">
            <Money value={path.effect10y} signed />
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export function SharedDecisionPreview({ amount, downPayment, paths, monthlySaving, interestSaving, ctaHref }: SharedDecisionPreviewProps) {
  const [a, b] = paths;
  return (
    <PreviewMain>
      <PreviewHeader eyebrow={t.eyebrow} title={t.title} intro={t.intro} />
      <div className="flex flex-col gap-sm">
        <Tag>{t.inputs(formatMoney(amount), formatMoney(downPayment))}</Tag>
        <p role="note" data-testid="no-login" className="rounded-lg bg-surface-strong px-lg py-md text-sm">
          {t.noLogin}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-xl sm:grid-cols-2">
        <PathCard path={a} highlight={interestSaving > 0 ? t.lowerInterest(formatMoney(interestSaving)) : undefined} />
        <PathCard path={b} highlight={monthlySaving > 0 ? t.lowerMonthly(formatMoney(monthlySaving)) : undefined} />
      </div>
      <p className="text-sm text-text-muted">{t.effectHint}</p>

      <Card tone="arena" className="flex flex-col items-start gap-md">
        <a href={ctaHref} className={buttonClassName({ variant: 'dark', size: 'lg', fullWidth: true })}>
          <span>
            {t.cta} <span aria-hidden="true">→</span>
          </span>
        </a>
        <p className="text-sm text-text-muted">{t.ctaHint}</p>
      </Card>
    </PreviewMain>
  );
}
