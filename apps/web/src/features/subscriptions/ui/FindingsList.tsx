'use client';

// Step 5: what the statement holds, grouped Active, To confirm and Stopped, with the ticked services
// the statement did not show. "Counted" is visible: a charge to confirm or a stopped one is in no total.
// A charge found but not ticked gets a kind "forgot this one?" tag. Each flag has a word, not a colour.
import type { ComponentType, ReactNode } from 'react';
import { subscriptions as t } from '@/copy';
import { Button, Card, cx, EstimateTag, formatMoney, formatMonth, Row, Stack, Tag } from '@/ui-kit';
import { CountUp, CYCLE, KpiStrip, MOTION, TONE_BG } from '@/ui-kit/reports';
import type { FindingVM, FindingsVM, PlanImpactVM, PlanVM, StatementVM } from '../model/types';
import { CancelEffect } from './CancelEffect';

export type FindingsListProps = {
  findings: FindingsVM;
  statement: StatementVM;
  /** There is something counted to make a plan from. */
  canPlan: boolean;
  onPlan: () => void;
  /** The cancel plan: ticks on the active findings, its saving and what it does to the plan. */
  plan?: PlanVM;
  impact?: PlanImpactVM;
  Link?: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const whole = (n: number) => formatMoney(n);

/** Each counted finding's yearly cost as a horizontal bar (the model lists them costliest first). */
function YearlyBars({ findings }: { findings: FindingVM[] }) {
  if (findings.length === 0) return null;
  const max = Math.max(...findings.map((f) => f.yearly), 1);
  const parts = findings.map((f) => t.findings.chartPart(f.name, whole(f.yearly))).join(', ');
  return (
    <figure className="flex flex-col gap-sm" data-testid="subs-chart">
      <figcaption className="text-sm font-semibold">{t.findings.chartTitle}</figcaption>
      <ul role="img" aria-label={t.findings.chartLabel(parts)} className="flex flex-col gap-sm">
        {findings.map((f, i) => (
          <li key={f.id} aria-hidden="true" className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-sm sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
            <span className="truncate text-sm">{f.name}</span>
            <span className="h-3 overflow-hidden rounded-full bg-surface-strong">
              <span
                className={cx('block h-full rounded-full', TONE_BG[CYCLE[i % CYCLE.length]!], MOTION.growX, f.markedCancel && 'opacity-40')}
                style={{ width: `${(f.yearly / max) * 100}%` }}
              />
            </span>
            <span className="text-sm font-semibold tabular-nums">{t.findings.perYearShort(whole(f.yearly))}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function FindingsList({ findings, statement, canPlan, onPlan, plan, impact, Link }: FindingsListProps) {
  const none = findings.active.length + findings.toConfirm.length + findings.stopped.length === 0;
  const onMark = plan ? (f: FindingVM) => (f.markedCancel ? plan.unmarkCancel(f.id) : plan.markCancel(f.id)) : undefined;
  return (
    <Card title={t.findings.title}>
      <Stack gap="xl">
        <div className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
          <Tag>{statement.fromLedger ? t.findings.fromLedger : t.findings.fromStatement}</Tag>
          <span>{t.findings.headline(findings.found, findings.ticked)}</span>
        </div>
        <KpiStrip
          data-testid="subs-kpis"
          aria-label={t.findings.kpi.label}
          items={[
            { id: 'monthly', label: t.findings.kpi.monthly, value: <CountUp value={findings.monthly} format={whole} /> },
            { id: 'yearly', label: t.findings.kpi.yearly, value: <CountUp value={findings.yearly} format={whole} />, dot: 'primary' },
            { id: 'found', label: t.findings.kpi.found, value: String(findings.found), hint: t.findings.kpi.foundHint(findings.found) },
            { id: 'flagged', label: t.findings.kpi.flagged, value: String(findings.flagged), hint: t.findings.kpi.flaggedHint, tone: findings.flagged > 0 ? 'warning' : 'default' },
          ]}
        />
        <p className="text-xs text-text-muted">{t.findings.countedNote}</p>

        {statement.isShort && (
          <p role="note" className="rounded-lg bg-surface-strong p-md text-sm">
            {t.findings.short}
          </p>
        )}
        {none && <p className="text-sm">{t.findings.none}</p>}

        <YearlyBars findings={findings.active} />

        {plan && findings.active.length > 0 && (
          <div className="flex flex-col gap-xs">
            <h3 className="text-base font-semibold">{t.findings.reviewTitle}</h3>
            <p className="text-sm text-text-muted">{t.findings.reviewLead}</p>
          </div>
        )}
        <Group title={t.findings.groups.active} findings={findings.active} onMark={onMark} />
        {plan && impact && <CancelEffect plan={plan} impact={impact} Link={Link} />}
        <Group title={t.findings.groups.toConfirm} findings={findings.toConfirm} onConfirm={findings.confirm} onDismiss={findings.dismiss} />
        <Group title={t.findings.groups.stopped} findings={findings.stopped} />
        <Group title={t.findings.groups.tickedOnly} note={t.findings.tickedOnlyNote} findings={findings.tickedOnly} />

        {findings.dismissedCount > 0 && (
          <Row gap="sm">
            <p className="text-sm text-text-muted">{t.findings.dismissed(findings.dismissedCount)}</p>
            <Button size="sm" variant="ghost" onClick={findings.restoreDismissed}>
              {t.findings.restore}
            </Button>
          </Row>
        )}

        <Stack gap="xs">
          <Row gap="sm">
            <Button size="lg" disabled={!canPlan} onClick={onPlan}>
              {t.findings.next}
            </Button>
          </Row>
          {!canPlan && !none && <p className="text-xs text-text-muted">{t.findings.planWaits}</p>}
        </Stack>
      </Stack>
    </Card>
  );
}

type GroupProps = {
  title: string;
  note?: string;
  findings: FindingVM[];
  onConfirm?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMark?: (finding: FindingVM) => void;
};

function Group({ title, note, findings, onConfirm, onDismiss, onMark }: GroupProps) {
  if (findings.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-sm">
      <h3 className="text-base font-semibold">
        {title} <span className="font-normal text-text-muted">({findings.length})</span>
      </h3>
      {note && <p className="text-xs text-text-muted">{note}</p>}
      <ul className="flex flex-col gap-sm">
        {findings.map((f) => (
          <FindingRow key={f.id} finding={f} onConfirm={onConfirm} onDismiss={onDismiss} onMark={onMark} />
        ))}
      </ul>
    </section>
  );
}

/** One flag as a short phrase. */
function flagTexts(f: FindingVM): string[] {
  const money = (n: number) => formatMoney(n, { cents: true });
  return f.flags.map((flag) => {
    switch (flag) {
      case 'priceUp':
        return t.findings.flag.priceUp(money(f.previousAmount ?? f.amount), money(f.amount));
      case 'introEnded':
        return t.findings.flag.introEnded;
      case 'overlap':
        return t.findings.flag.overlap(f.overlapCount);
      case 'seenOnce':
        return t.findings.flag.seenOnce(f.cadence, f.lastCharge ? formatMonth(f.lastCharge.month) : t.findings.unknownMonth);
    }
  });
}

function FindingRow({
  finding: f, onConfirm, onDismiss, onMark,
}: { finding: FindingVM; onConfirm?: (id: string) => void; onDismiss?: (id: string) => void; onMark?: (finding: FindingVM) => void }) {
  const money = (n: number) => formatMoney(n, { cents: true });
  return (
    <li className={cx('flex flex-col gap-sm rounded-lg border-2 bg-surface p-md transition-colors', f.markedCancel ? 'border-ink' : 'border-border')}>
      <Row gap="md" justify="between" align="start" wrap={false}>
        {onMark && f.counted ? (
          <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-md">
            <input
              type="checkbox"
              checked={f.markedCancel}
              onChange={() => onMark(f)}
              aria-label={t.plan.mark(f.name)}
              className="size-5 shrink-0 accent-primary"
            />
            <span className={cx('min-w-0 break-words text-base font-medium', f.markedCancel && 'line-through decoration-2')}>{f.name}</span>
          </label>
        ) : (
          <p className="min-w-0 break-words text-base font-medium">{f.name}</p>
        )}
        <p className="shrink-0 text-right text-sm tabular-nums">
          {money(f.amount)} <span className="text-text-muted">{t.findings.every[f.cadence]}</span>
        </p>
      </Row>
      <div className="flex flex-wrap items-center gap-xs">
        {f.isEstimate ? <EstimateTag /> : <Tag>{t.findings.measured}</Tag>}
        {flagTexts(f).map((text) => (
          <Tag key={text}>{text}</Tag>
        ))}
        {f.status === 'stopped' && f.lastCharge && <Tag>{t.findings.stoppedSince(formatMonth(f.lastCharge.month))}</Tag>}
        {f.forgotten && (
          <Tag variant="dashed" title={t.findings.forgotNote}>
            {t.findings.forgot}
          </Tag>
        )}
        {!f.counted && f.status === 'active' && <Tag variant="dashed">{t.findings.notCounted}</Tag>}
      </div>
      {f.origin === 'statement' && (
        <p className="text-xs text-text-muted">
          {t.findings.chargesSeen(f.chargesSeen)}
          {f.nextExpected && ` · ${t.findings.nextExpected(formatMonth(f.nextExpected.month, f.nextExpected.day))}`}
        </p>
      )}
      {onConfirm && onDismiss && (
        <Row gap="sm">
          <p className="text-sm">{t.findings.toConfirmQuestion}</p>
          <Button size="sm" variant="secondary" onClick={() => onConfirm(f.id)} aria-label={`${t.findings.yes}: ${f.name}`}>
            {t.findings.yes}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss(f.id)} aria-label={`${t.findings.no}: ${f.name}`}>
            {t.findings.no}
          </Button>
        </Row>
      )}
    </li>
  );
}
