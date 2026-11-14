// S7 "Describe your life": free text → /api/ai/parse → the parsed values for the user to confirm
// (inferred ones highlighted). On any error the copy explains why and points at the sliders.
import { useId } from 'react';
import { common, ladder } from '@/copy';
import { Button, Card, cx, formatMoney, formatRate, Row, Stack } from '@/ui-kit';
import type { ParsedRowVM, QuickSlidersVM } from '../model/types';

const t = ladder.sliders.describe;

export type DescribeLifeProps = { parse: QuickSlidersVM['parse']; rows: ParsedRowVM[] };

const show = (row: Pick<ParsedRowVM, 'unit'>, value: number) =>
  row.unit === 'rate' ? formatRate(value) : formatMoney(value);

function rowLabel(row: ParsedRowVM): string {
  const target = row.target;
  switch (target.kind) {
    case 'spending':
      return common.categories[target.category];
    case 'retirementShare':
      return t.rowLabel.retirementShare;
    case 'debtApr':
      return t.rowLabel.debtApr(target.debtKind ? ladder.balance.debtKinds[target.debtKind] : t.rowLabel.unknownDebt);
    case 'debtExtraPayment':
      return t.rowLabel.debtExtraPayment(
        target.debtKind ? ladder.balance.debtKinds[target.debtKind] : t.rowLabel.unknownDebt,
      );
  }
}

export function DescribeLife({ parse, rows }: DescribeLifeProps) {
  const textId = useId();
  const hintId = useId();
  const busy = parse.status === 'parsing';
  const errorText = parse.error ? (t.errors[parse.error.kind] ?? t.errors.unknown) : null;

  return (
    <Card title={t.title}>
      <Stack gap="md">
        <form
          className="flex flex-col gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            parse.submit();
          }}
        >
          <label htmlFor={textId} className="text-sm font-medium">
            {t.label}
          </label>
          <textarea
            id={textId}
            aria-describedby={hintId}
            value={parse.text}
            onChange={(e) => parse.setText(e.target.value)}
            placeholder={t.placeholder}
            rows={3}
            disabled={busy || parse.status === 'confirming'}
            className="w-full rounded-md border border-border bg-bg px-md py-sm text-base disabled:bg-surface"
          />
          <p id={hintId} className="text-xs text-text-muted">
            {t.hint}
          </p>
          <Row>
            <Button type="submit" variant="secondary" disabled={busy || parse.status === 'confirming' || !parse.text.trim()}>
              {busy ? t.parsing : t.submit}
            </Button>
          </Row>
        </form>

        {busy && (
          <p role="status" className="text-sm text-text-muted">
            {t.parsing}
          </p>
        )}

        {parse.status === 'error' && errorText && (
          <div role="alert" className="flex flex-col gap-sm rounded-md border border-warning bg-surface p-md">
            <p className="text-sm">{errorText}</p>
            <Row>
              <Button size="sm" variant="ghost" onClick={parse.cancel}>
                {t.dismiss}
              </Button>
            </Row>
          </div>
        )}

        {parse.status === 'confirming' && (
          <section aria-label={t.confirmTitle} className="flex flex-col gap-md rounded-md bg-surface p-md">
            <h3 className="text-base font-semibold">{t.confirmTitle}</h3>
            <p className="text-sm text-text-muted">{t.confirmNote}</p>
            <ul className="flex flex-col gap-sm">
              {rows.map((row) => (
                <li
                  key={row.path}
                  data-inferred={row.inferred ? 'true' : 'false'}
                  className={cx(
                    'flex flex-wrap items-baseline justify-between gap-sm rounded-md px-md py-sm',
                    row.inferred ? 'border border-dashed border-warning bg-bg' : 'bg-bg',
                  )}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-sm text-sm">
                    {rowLabel(row)}
                    {row.inferred && (
                      <span
                        title={t.inferredHint}
                        className="rounded-full border border-warning px-sm text-xs font-medium text-warning"
                      >
                        {t.inferred}
                        <span className="sr-only">: {t.inferredHint}</span>
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="text-base font-semibold tabular-nums">{show(row, row.value)}</span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {row.current !== null ? t.was(show(row, row.current)) : t.wasUnknown}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Row gap="sm">
              <Button onClick={parse.confirm}>{t.confirm}</Button>
              <Button variant="secondary" onClick={parse.cancel}>
                {t.discard}
              </Button>
            </Row>
          </section>
        )}
      </Stack>
    </Card>
  );
}
