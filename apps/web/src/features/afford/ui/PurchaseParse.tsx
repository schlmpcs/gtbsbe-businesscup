'use client';

import { afford as t } from '@/copy';
import { Button, Card, cx, formatMoney, formatRate, Row, Stack } from '@/ui-kit';
import { useId } from 'react';
import type { ParseConfirmVM, Purchase, VMError } from '../model/types';

function errorText(error: VMError | null): string {
  switch (error?.kind) {
    case 'unavailable':
    case 'notImplemented':
      return t.parse.errors.unavailable;
    case 'nothingFound':
      return t.parse.errors.nothingFound;
    case 'rateLimited':
      return t.parse.errors.rateLimited;
    case 'badInput':
      return t.parse.errors.badInput;
    case 'invalidResponse':
      return t.parse.errors.invalidResponse;
    case 'network':
      return t.parse.errors.network;
    case 'incomplete':
      return t.parse.errors.incomplete;
    default:
      return t.parse.errors.other;
  }
}

function recurringText(r: Purchase['recurring']): string {
  return r === false ? t.form.recurringOptions.once : t.form.recurringOptions[r];
}

/** The parsed purchase as label/value rows; values the parser inferred are highlighted. */
function ParsedPurchase({ purchase, inferred }: { purchase: Purchase; inferred: readonly string[] }) {
  const loan = typeof purchase.payWith === 'object' ? purchase.payWith.loan : null;
  const rows: { path: string; label: string; value: string }[] = [
    { path: 'label', label: t.parse.fields.label, value: purchase.label },
    { path: 'amount', label: t.parse.fields.amount, value: formatMoney(purchase.amount, { cents: true }) },
    { path: 'recurring', label: t.parse.fields.recurring, value: recurringText(purchase.recurring) },
    {
      path: 'payWith',
      label: t.parse.fields.payWith,
      value: loan ? t.form.payWithOptions.loan : t.form.payWithOptions[purchase.payWith as 'cash' | 'card'],
    },
    ...(loan
      ? [
          { path: 'payWith.loan.apr', label: t.parse.fields.apr, value: formatRate(loan.apr, 2) },
          { path: 'payWith.loan.termMonths', label: t.parse.fields.termMonths, value: t.parse.termMonths(loan.termMonths) },
        ]
      : []),
  ];
  const isInferred = (path: string) => inferred.some((p) => p === path || p.startsWith(`${path}.`) || path.endsWith(`.${p}`));
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-lg gap-y-xs text-sm">
      {rows.map((r) => (
        <div key={r.path} className="contents">
          <dt className="text-text-muted">{r.label}</dt>
          <dd className={cx('font-medium tabular-nums', isInferred(r.path) && 'rounded-sm bg-surface-strong px-xs')}>
            {r.value}
            {isInferred(r.path) && <span className="ml-xs text-xs font-normal text-text-muted">({t.parse.guessed})</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Free text → parsed purchase → user confirms → fills the form. Falls back to the form on any error. */
export function PurchaseParse({ parse }: { parse: ParseConfirmVM<Purchase> }) {
  const inputId = useId();
  const busy = parse.status === 'parsing';
  return (
    <Card title={t.parse.title} tone="muted">
      <Stack gap="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            parse.submit();
          }}
          className="flex flex-col gap-sm"
        >
          <label htmlFor={inputId} className="text-sm font-medium">
            {t.parse.label}
          </label>
          <textarea
            id={inputId}
            name="purchaseText"
            rows={2}
            value={parse.text}
            onChange={(e) => parse.setText(e.target.value)}
            placeholder={t.parse.placeholder}
            className="w-full resize-y rounded-md border border-border bg-bg px-md py-sm text-base"
          />
          <Row>
            <Button type="submit" variant="secondary" disabled={busy || parse.text.trim() === ''} aria-busy={busy || undefined}>
              {busy ? t.parse.parsing : t.parse.submit}
            </Button>
          </Row>
        </form>

        <div aria-live="polite">
          {parse.status === 'confirming' && parse.parsed && (
            <section aria-label={t.parse.confirmTitle} className="flex flex-col gap-md rounded-md border border-border bg-bg p-lg">
              <h3 className="text-base font-semibold">{t.parse.confirmTitle}</h3>
              <p className="text-xs text-text-muted">{t.parse.confirmNote}</p>
              <ParsedPurchase purchase={parse.parsed} inferred={parse.inferred} />
              {parse.inferred.length > 0 && <p className="text-xs text-text-muted">{t.parse.inferredNote}</p>}
              <Row>
                <Button onClick={parse.confirm}>{t.parse.confirm}</Button>
                <Button variant="ghost" onClick={parse.cancel}>
                  {t.parse.cancel}
                </Button>
              </Row>
            </section>
          )}
          {parse.status === 'error' && (
            <div role="alert" className="flex flex-col gap-sm rounded-md border border-border bg-bg p-lg">
              <p className="text-sm">{errorText(parse.error)}</p>
              <Row>
                <Button variant="ghost" size="sm" onClick={parse.cancel}>
                  {t.parse.useForm}
                </Button>
              </Row>
            </div>
          )}
        </div>
      </Stack>
    </Card>
  );
}
