'use client';

import { loan as t } from '@/copy';
import { Button, Card, cx, formatMoney, formatRate, Row, Stack } from '@/ui-kit';
import { useId } from 'react';
import type { LoanInput, ParseConfirmVM, VMError } from '../model/types';

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

function ParsedLoan({ input, inferred }: { input: LoanInput; inferred: readonly string[] }) {
  const rows: { path: keyof LoanInput; label: string; value: string }[] = [
    { path: 'amount', label: t.parse.fields.amount, value: formatMoney(input.amount, { cents: true }) },
    { path: 'apr', label: t.parse.fields.apr, value: formatRate(input.apr, 2) },
    { path: 'termMonths', label: t.parse.fields.termMonths, value: t.parse.termMonths(input.termMonths) },
    ...(input.downPayment !== undefined
      ? [{ path: 'downPayment' as const, label: t.parse.fields.downPayment, value: formatMoney(input.downPayment, { cents: true }) }]
      : []),
    ...(input.fees !== undefined ? [{ path: 'fees' as const, label: t.parse.fields.fees, value: formatMoney(input.fees, { cents: true }) }] : []),
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-lg gap-y-xs text-sm">
      {rows.map((r) => {
        const guessed = inferred.includes(r.path);
        return (
          <div key={r.path} className="contents">
            <dt className="text-text-muted">{r.label}</dt>
            <dd className={cx('font-medium tabular-nums', guessed && 'rounded-sm bg-surface-strong px-xs')}>
              {r.value}
              {guessed && <span className="ml-xs text-xs font-normal text-text-muted">({t.parse.guessed})</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Free text → parsed loan → user confirms → added as an offer (or replaces the selected one when full). */
export function LoanParse({ parse, canAddOffer }: { parse: ParseConfirmVM<LoanInput>; canAddOffer: boolean }) {
  const inputId = useId();
  const busy = parse.status === 'parsing';
  return (
    <Card title={t.parse.title}>
      <Stack gap="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            parse.submit();
          }}
          className="flex flex-col gap-sm"
        >
          <label htmlFor={inputId} className="sr-only">
            {t.parse.label}
          </label>
          <textarea
            id={inputId}
            name="loanText"
            rows={2}
            value={parse.text}
            onChange={(e) => parse.setText(e.target.value)}
            placeholder={t.parse.placeholder}
            className="w-full resize-y rounded-lg bg-bg px-md py-md text-lg font-semibold placeholder:font-normal placeholder:text-text-muted"
          />
          <Row>
            <Button type="submit" variant="secondary" disabled={busy || parse.text.trim() === ''} aria-busy={busy || undefined}>
              {busy ? t.parse.parsing : t.parse.submit}
            </Button>
          </Row>
        </form>

        <div aria-live="polite">
          {parse.status === 'confirming' && parse.parsed && (
            <section aria-label={t.parse.confirmTitle} className="flex flex-col gap-md rounded-lg bg-bg p-lg">
              <h3 className="text-base font-semibold">{t.parse.confirmTitle}</h3>
              <ParsedLoan input={parse.parsed} inferred={parse.inferred} />
              <Row>
                <Button onClick={parse.confirm}>{canAddOffer ? t.parse.confirmAdd : t.parse.confirmReplace}</Button>
                <Button variant="ghost" onClick={parse.cancel}>
                  {t.parse.cancel}
                </Button>
              </Row>
            </section>
          )}
          {parse.status === 'error' && (
            <div role="alert" className="flex flex-col gap-sm rounded-lg bg-bg p-lg">
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
