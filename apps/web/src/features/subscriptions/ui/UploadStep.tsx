'use client';

// Step 1 (JF8: detection first): the S9 look (dashed tile, file picker, "read on this device"), for the audit. Errors reuse the
// S9 messages. Only this step needs the network: the guess, the ticks and the gap work offline.
import { useId } from 'react';
import { ladder, subscriptions as t } from '@/copy';
import { Button, Card, Row, Stack } from '@/ui-kit';
import type { StatementErrorVM, StatementVM } from '../model/types';

const errors = ladder.upload.errors;

function errorText(error: StatementErrorVM | null): string {
  switch (error?.kind) {
    case 'unreadable':
      return errors.unreadable[error.reason];
    case 'badInput':
      return errors.badInput;
    case 'rateLimited':
      return errors.rateLimited;
    case 'network':
      return errors.network;
    default:
      return errors.unknown;
  }
}

/** `onByHand`: the fallback when there is no statement (the tick list). */
export type UploadStepProps = { statement: StatementVM; onByHand?: () => void };

export function UploadStep({ statement, onByHand }: UploadStepProps) {
  const inputId = useId();
  const noteId = useId();
  const reading = statement.status === 'reading';
  return (
    <Card title={t.statement.title} className="border-2 border-dashed border-primary">
      <Stack gap="md">
        <p className="text-sm font-medium">{t.statement.readOnDevice}</p>
        <div className="flex w-full max-w-(--container-sm) flex-col gap-sm">
          <label htmlFor={inputId} className="text-sm font-medium">
            {statement.status === 'done' ? t.statement.replace : t.statement.pickerLabel}
          </label>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            disabled={reading}
            aria-describedby={noteId}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) statement.upload(file);
              e.target.value = '';
            }}
            className="w-full text-sm text-text-muted file:mr-md file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-xl file:py-md file:text-base file:font-bold file:text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p id={noteId} className="text-xs text-text-muted">
            {t.statement.pickerHint} {t.statement.minMonths}
          </p>
        </div>

        {reading && (
          <p role="status" className="rounded-xl bg-surface p-lg text-sm">
            {t.statement.reading}
          </p>
        )}

        {statement.status === 'error' && (
          <div role="alert" className="flex flex-col gap-sm rounded-xl border-2 border-negative bg-surface p-lg">
            <p className="text-sm">{errorText(statement.error)}</p>
            {statement.error?.kind === 'network' && <p className="text-xs text-text-muted">{t.statement.offline}</p>}
            <Row>
              <Button size="sm" variant="ghost" onClick={statement.dismissError}>
                {t.statement.dismiss}
              </Button>
            </Row>
          </div>
        )}

        {onByHand && statement.status !== 'done' && (
          <Row>
            <Button size="sm" variant="ghost" onClick={onByHand}>
              {t.statement.byHand}
            </Button>
          </Row>
        )}
      </Stack>
    </Card>
  );
}
