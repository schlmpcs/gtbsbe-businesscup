'use client';

// Step 5: what the statement holds, grouped Active, To confirm and Stopped, with the ticked services
// the statement did not show. "Counted" is visible: a charge to confirm or a stopped one is in no total.
// A charge found but not ticked gets a kind "forgot this one?" tag. Each flag has a word, not a colour.
import { subscriptions as t } from '@/copy';
import { Button, Card, EstimateTag, formatMoney, formatMonth, Money, Row, Stack, Stat, Tag } from '@/ui-kit';
import type { FindingVM, FindingsVM, StatementVM } from '../model/types';

export type FindingsListProps = {
  findings: FindingsVM;
  statement: StatementVM;
  onPlan: () => void;
};

export function FindingsList({ findings, statement, onPlan }: FindingsListProps) {
  const none = findings.active.length + findings.toConfirm.length + findings.stopped.length === 0;
  return (
    <Card title={t.findings.title}>
      <Stack gap="xl">
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Stat
            label={t.findings.headline(findings.found, findings.ticked)}
            value={<Money value={findings.monthly} cents />}
            hint={`${t.findings.perMonth(formatMoney(findings.monthly, { cents: true }))} · ${t.findings.perYear(formatMoney(findings.yearly, { cents: true }))}`}
          />
          <p className="self-end text-xs text-text-muted">{t.findings.countedNote}</p>
        </div>

        {statement.isShort && (
          <p role="note" className="rounded-lg bg-surface-strong p-md text-sm">
            {t.findings.short}
          </p>
        )}
        {none && <p className="text-sm">{t.findings.none}</p>}

        <Group title={t.findings.groups.active} findings={findings.active} />
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

        <Row gap="sm">
          <Button size="lg" onClick={onPlan}>
            {t.findings.next}
          </Button>
        </Row>
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
};

function Group({ title, note, findings, onConfirm, onDismiss }: GroupProps) {
  if (findings.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-sm">
      <h3 className="text-base font-semibold">
        {title} <span className="font-normal text-text-muted">({findings.length})</span>
      </h3>
      {note && <p className="text-xs text-text-muted">{note}</p>}
      <ul className="flex flex-col gap-sm">
        {findings.map((f) => (
          <FindingRow key={f.id} finding={f} onConfirm={onConfirm} onDismiss={onDismiss} />
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
        return t.findings.flag.seenOnce(f.cadence, f.lastCharge ? formatMonth(f.lastCharge.month) : '—');
    }
  });
}

function FindingRow({ finding: f, onConfirm, onDismiss }: { finding: FindingVM; onConfirm?: (id: string) => void; onDismiss?: (id: string) => void }) {
  const money = (n: number) => formatMoney(n, { cents: true });
  return (
    <li className="flex flex-col gap-sm rounded-lg border-2 border-border bg-surface p-md">
      <Row gap="md" justify="between" align="start" wrap={false}>
        <p className="min-w-0 break-words text-base font-medium">{f.name}</p>
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
