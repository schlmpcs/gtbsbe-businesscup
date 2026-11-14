'use client';

// "Use this in my plan": the one place a tool writes into the profile. It lists exactly what changes,
// from and to, with estimate and measured tags. Cancel is the default focus; nothing changes until Update.
import { subscriptions as t } from '@/copy';
import { Button, EstimateTag, formatMoney, Row, Sheet, Stack, Tag } from '@/ui-kit';
import type { ApplyVM, EstimatedMoney } from '../model/types';

export type UseInPlanSheetProps = { open: boolean; apply: ApplyVM; onClose: () => void; onConfirm: () => void };

function Value({ value }: { value: EstimatedMoney }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-xs">
      <span className="font-semibold tabular-nums">{formatMoney(value.value, { cents: true })}</span>
      {value.isEstimate ? <EstimateTag /> : <Tag>{t.apply.measured}</Tag>}
    </span>
  );
}

export function UseInPlanSheet({ open, apply, onClose, onConfirm }: UseInPlanSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.apply.title}
      description={t.apply.description}
      footer={
        <Row gap="sm">
          <Button variant="secondary" data-autofocus onClick={onClose}>
            {t.apply.cancel}
          </Button>
          <Button onClick={onConfirm}>{t.apply.confirm}</Button>
        </Row>
      }
    >
      <Stack gap="sm">
        <p className="text-sm text-text-muted">{t.apply.field}</p>
        <p className="flex flex-wrap items-center gap-sm text-base">
          <Value value={apply.from} />
          <span aria-hidden="true">→</span>
          <span className="sr-only">to</span>
          <Value value={apply.to} />
        </p>
        <p className="text-xs text-text-muted">{apply.to.isEstimate ? t.apply.toNote.estimate : t.apply.toNote.measured}</p>
      </Stack>
    </Sheet>
  );
}
