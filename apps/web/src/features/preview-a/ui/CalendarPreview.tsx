'use client';

// S28 Money calendar (design preview). Spec: docs/design/USER-JOURNEY.md → After the cut line.
// "Add to calendar" marks the row locally; the real version builds an .ics file in the browser.
import { useId, useState, type FormEvent } from 'react';
import { previewA } from '@/copy';
import { Button, Card, cx } from '@/ui-kit';
import type { CalendarPreviewProps, MoneyMoment } from '../model/types';
import { Pill, PreviewHeader, PreviewMain, PreviewStatus } from './shared';

const t = previewA.calendar;

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
/** 'YYYY-MM-DD' from a date input → "June 30, 2027" (display only). */
const showDate = (iso: string) => DATE_FORMAT.format(new Date(`${iso}T00:00:00Z`));

const INPUT =
  'w-full rounded-md border border-border bg-bg p-md text-base focus-visible:outline-2 focus-visible:outline-primary';

function MomentRow({ moment, added, onAdd }: { moment: MoneyMoment; added: boolean; onAdd: () => void }) {
  return (
    <li>
      <div className="flex flex-col gap-md rounded-xl bg-surface p-lg shadow-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <h2 className="text-xl font-bold leading-tight">{moment.title}</h2>
            {moment.userDate && <Pill tone="soft">{t.yourDate}</Pill>}
          </div>
          <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
            <span>{moment.dateLabel}</span>
            {moment.isEstimate && <Pill tone="outline">{t.estimate}</Pill>}
          </p>
          {moment.action && (
            <a href={moment.action.href} className="w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline">
              {moment.action.label} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
        <Button
          variant={added ? 'ghost' : 'secondary'}
          onClick={onAdd}
          aria-pressed={added}
          aria-label={t.addLabel(moment.title)}
          className={cx('shrink-0', added && 'text-positive')}
        >
          {added ? t.added : t.add}
        </Button>
      </div>
    </li>
  );
}

export function CalendarPreview({ moments: initial }: CalendarPreviewProps) {
  const [moments, setMoments] = useState<MoneyMoment[]>(initial);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const dateId = useId();
  const errorId = useId();

  const add = (id: string) => {
    setAdded((s) => new Set(s).add(id));
    setStatus(previewA.noAction);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t.nameMissing);
    if (!date) return setError(t.dateMissing);
    setError(null);
    setMoments((m) => [...m, { id: `own-${m.length}`, title: name.trim(), dateLabel: showDate(date), userDate: true }]);
    setName('');
    setDate('');
  };

  return (
    <PreviewMain narrow>
      <PreviewHeader title={t.title} intro={t.intro} />

      <div className="flex flex-col gap-xs">
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            setAdded(new Set(moments.map((m) => m.id)));
            setStatus(previewA.noAction);
          }}
        >
          {t.addAll}
        </Button>
        <PreviewStatus>{status}</PreviewStatus>
      </div>

      <ul aria-label={t.listLabel} className="flex flex-col gap-lg" data-testid="calendar-moments">
        {moments.map((m) => (
          <MomentRow key={m.id} moment={m} added={added.has(m.id)} onAdd={() => add(m.id)} />
        ))}
      </ul>

      <Card title={t.formTitle} data-testid="calendar-own">
        <form onSubmit={submit} noValidate className="flex flex-col gap-lg">
          <p className="text-sm text-text-muted">{t.formIntro}</p>
          <div className="flex flex-col gap-xs">
            <label htmlFor={nameId} className="text-sm font-medium">
              {t.nameLabel}
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={60}
              aria-describedby={error ? errorId : undefined}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor={dateId} className="text-sm font-medium">
              {t.dateLabel}
            </label>
            <input
              id={dateId}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-describedby={error ? errorId : undefined}
              className={INPUT}
            />
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-text-muted">
              {error}
            </p>
          )}
          <Button type="submit" variant="dark" size="lg" fullWidth>
            {t.submit}
          </Button>
        </form>
      </Card>
    </PreviewMain>
  );
}
