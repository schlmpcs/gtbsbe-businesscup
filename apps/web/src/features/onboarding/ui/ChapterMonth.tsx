// Chapter 3, "Let's find out.": pick how to count the month (import a CSV, try the sample statement, or
// set it with sliders), then the BIG REVEAL: "Your guess $X" vs "Your real month $Y" as two growing bars
// with the gap in dollars and percent, and where the month goes. The statement review keeps the S9
// fixes: the summary and "Use these numbers" sit on top, and going on applies a pending statement
// (nothing read is dropped). Every number comes from the view-models (useStatementUpload,
// useQuickSliders, useMonthReveal).
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { common, ladder, onboarding } from '@/copy';
import { Art, Button, cx, EstimateTag, formatMoney, formatRate, Slider, Tag } from '@/ui-kit';
import type { MonthRevealVM, QuickSlidersVM, StatementUploadError, StatementUploadVM } from '../model/types';
import { Count } from './Count';

const t = onboarding.month;
const u = ladder.upload;
const COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6', 'bg-text-muted', 'bg-ink'] as const;

type Step = 'choose' | 'statement' | 'sliders' | 'reveal';

export type ChapterMonthProps = {
  upload: StatementUploadVM;
  sliders: QuickSlidersVM;
  reveal: MonthRevealVM;
  onDone: () => void;
};

function errorText(error: StatementUploadError | null): string {
  switch (error?.kind) {
    case 'unreadable':
      return u.errors.unreadable[error.reason];
    case 'badInput':
      return u.errors.badInput;
    case 'rateLimited':
      return u.errors.rateLimited;
    case 'network':
      return u.errors.network;
    default:
      return u.errors.unknown;
  }
}

export function ChapterMonth({ upload, sliders, reveal, onDone }: ChapterMonthProps) {
  // A statement already under review (e.g. after a reload of this chapter) opens on its review.
  const [step, setStep] = useState<Step>(upload.status === 'review' || upload.status === 'reading' ? 'statement' : 'choose');
  const toReveal = () => {
    // Going on with a statement under review uses its numbers, as "Use these numbers" does.
    if (upload.status === 'review') upload.apply();
    setStep('reveal');
  };
  return (
    <div key={step} className="ob-enter flex flex-col gap-xl">
      {step === 'choose' && (
        <Choose
          upload={upload}
          onFile={(file) => {
            upload.readFile?.(file);
            setStep('statement');
          }}
          onSample={() => {
            upload.trySample();
            setStep('statement');
          }}
          onSliders={() => setStep('sliders')}
        />
      )}
      {step === 'statement' && (
        <Statement
          vm={upload}
          onBack={() => {
            if (upload.status === 'review' || upload.status === 'error') upload.discard();
            setStep('choose');
          }}
          onUse={toReveal}
        />
      )}
      {step === 'sliders' && <Sliders vm={sliders} onBack={() => setStep('choose')} onNext={toReveal} />}
      {step === 'reveal' && <Reveal vm={reveal} onChange={() => setStep('choose')} onDone={onDone} />}
    </div>
  );
}

function OptionCard({
  title,
  body,
  badge,
  art,
  children,
  onClick,
  testId,
}: {
  title: string;
  body: string;
  badge?: string;
  art?: 'upload' | 'little-things' | 'coins';
  children?: ReactNode;
  onClick?: () => void;
  testId: string;
}) {
  const inner = (
    <>
      {art && <Art name={art} className="w-20 shrink-0" imgClassName="aspect-square" loading="eager" />}
      <span className="flex min-w-0 flex-1 flex-col gap-xs text-left">
        {badge && <Tag className="self-start border-primary font-bold text-primary">{badge}</Tag>}
        <span className="font-display text-xl font-extrabold leading-tight">{title}</span>
        <span className="text-sm text-text-muted">{body}</span>
        {children}
      </span>
    </>
  );
  const cls = 'ob-press flex w-full items-center gap-md rounded-xl bg-surface p-lg text-text shadow-md transition-shadow hover:shadow-lg';
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} data-testid={testId}>
      {inner}
    </button>
  ) : (
    <div className={cx(cls, 'border-2 border-dashed border-primary')} data-testid={testId}>
      {inner}
    </div>
  );
}

function Choose({
  upload,
  onFile,
  onSample,
  onSliders,
}: {
  upload: StatementUploadVM;
  onFile: (file: File) => void;
  onSample: () => void;
  onSliders: () => void;
}) {
  const inputId = useId();
  const o = t.options;
  const canRead = upload.readFile !== null && upload.status !== 'loading';
  return (
    <div className="flex flex-col gap-md">
      <h2 className="font-display text-2xl font-extrabold">{t.chooseTitle}</h2>
      <OptionCard title={o.csv.title} body={canRead ? o.csv.body : u.pickerUnavailable} badge={o.csv.badge} art="upload" testId="month-csv">
        <label htmlFor={inputId} className="sr-only">
          {u.pickerLabel}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          disabled={!canRead}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
          className="mt-xs w-full text-sm text-text-muted file:mr-md file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-ink file:px-lg file:text-base file:font-bold file:text-on-primary disabled:opacity-60"
        />
      </OptionCard>
      {upload.readFile !== null && <OptionCard title={o.sample.title} body={o.sample.body} art="little-things" onClick={onSample} testId="month-sample" />}
      <OptionCard title={o.sliders.title} body={o.sliders.body} art="coins" onClick={onSliders} testId="month-sliders" />
    </div>
  );
}

function Statement({ vm, onBack, onUse }: { vm: StatementUploadVM; onBack: () => void; onUse: () => void }) {
  return (
    <div className="flex flex-col gap-lg">
      {(vm.status === 'reading' || vm.status === 'loading') && (
        <p role="status" className="flex items-center gap-md rounded-xl bg-surface p-xl text-lg font-semibold shadow-md">
          <span aria-hidden="true" className="size-4 animate-ping rounded-full bg-primary" />
          {t.reading}
        </p>
      )}
      {vm.status === 'error' && (
        <div role="alert" className="flex flex-col gap-sm rounded-xl border-2 border-negative bg-surface p-lg">
          <p>{errorText(vm.error)}</p>
        </div>
      )}
      {vm.status === 'review' && (
        <div className="ob-pop flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md" data-testid="statement-summary">
          {vm.lastRead && <p className="text-sm text-text-muted">{u.readSummary(vm.lastRead.transactions, vm.lastRead.from, vm.lastRead.to)}</p>}
          {vm.summary && (
            <p className="font-display text-3xl font-extrabold leading-tight tabular-nums">
              {u.averageMonth(formatMoney(vm.summary.averageMonth), vm.summary.fullMonths)}
            </p>
          )}
          <p className="text-xs text-text-muted">{u.excludedNote}</p>
          <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <Button variant="ghost" size="lg" onClick={onBack}>
              {t.discard}
            </Button>
            <Button size="lg" onClick={onUse} className="ob-press">
              {t.use}
            </Button>
          </div>
        </div>
      )}
      {vm.status !== 'review' && (
        <button type="button" onClick={onBack} className="min-h-11 self-start text-base font-semibold hover:text-primary">
          {t.otherWay}
        </button>
      )}
    </div>
  );
}

function Sliders({ vm, onBack, onNext }: { vm: QuickSlidersVM; onBack: () => void; onNext: () => void }) {
  const allEstimates = vm.sliders.length > 0 && vm.sliders.every((s) => s.isEstimate);
  return (
    <div className="flex flex-col gap-lg">
      <div className="sticky top-0 z-10 flex items-baseline justify-between gap-md rounded-xl bg-ink p-lg text-on-primary shadow-md">
        <span className="text-sm">{t.slidersTotal}</span>
        <span className="font-display text-3xl font-extrabold tabular-nums text-primary" data-testid="month-cost">
          {formatMoney(vm.monthlyCost)}
        </span>
      </div>
      <div className="rounded-xl bg-surface p-lg shadow-md sm:p-xl">
        <h2 className="font-display text-2xl font-extrabold">{t.slidersTitle}</h2>
        <p className="mb-lg flex flex-wrap items-center gap-sm text-sm text-text-muted">
          {allEstimates && <EstimateTag />}
          {t.slidersNote}
        </p>
        <ul className="flex flex-col gap-lg">
          {vm.sliders.map((s, i) => (
            <li key={s.category}>
              <Slider
                label={
                  <span className="inline-flex items-center gap-sm text-base font-semibold">
                    <span aria-hidden="true" className={cx('size-sm shrink-0 rounded-full', COLORS[i % COLORS.length])} />
                    {s.category === 'rentUtilities' && vm.ownsHome ? common.ownerHousing : common.categories[s.category]}
                  </span>
                }
                value={s.value}
                min={s.min}
                max={s.max}
                step={s.step}
                isEstimate={s.isEstimate && !allEstimates}
                hideBounds
                formatValue={(v) => formatMoney(v)}
                onValueChange={(v) => vm.setSpending(s.category, v)}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col-reverse items-stretch gap-md sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="min-h-11 text-left text-base font-semibold hover:text-primary">
          {t.otherWay}
        </button>
        <Button size="lg" onClick={onNext} className="ob-press">
          {t.showMe}
        </Button>
      </div>
    </div>
  );
}

function Reveal({ vm, onChange, onDone }: { vm: MonthRevealVM; onChange: () => void; onDone: () => void }) {
  const gap = vm.difference === null ? null : formatMoney(Math.abs(vm.difference));
  const share = vm.differenceShare === null ? '' : formatRate(vm.differenceShare, 0);
  const verdict =
    vm.direction === null ? t.noGuess : vm.direction === 'exact' ? t.exact : vm.direction === 'more' ? t.more(gap!, share) : t.less(gap!, share);
  return (
    <div className="flex flex-col gap-xl" data-testid="month-reveal" data-from={vm.from}>
      <div className="flex flex-col gap-lg rounded-xl bg-ink p-xl text-on-primary shadow-md">
        <h2 className="flex flex-wrap items-center gap-sm text-xs font-bold uppercase tracking-wide text-primary">
          {t.revealTitle}
          {vm.isEstimate && <EstimateTag className="bg-surface text-text" />}
        </h2>
        {vm.guess !== null && (
          <RevealBar label={t.yourGuess} value={vm.guess} share={vm.guessShare} tone="muted" delay={0} testId="reveal-guess" />
        )}
        <RevealBar
          label={vm.isEstimate ? t.typicalMonth : t.yourMonth}
          value={vm.actual}
          share={vm.actualShare}
          tone="primary"
          delay={350}
          testId="reveal-actual"
        />
        <p className="ob-pop font-display text-2xl font-extrabold leading-tight tabular-nums sm:text-3xl" style={{ '--ob-delay': '900ms' } as CSSProperties} data-testid="reveal-verdict">
          {verdict}
        </p>
        <p className="text-sm text-on-primary/70">{t.from[vm.from]}</p>
      </div>

      <section aria-labelledby="month-breakdown" className="flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md">
        <h2 id="month-breakdown" className="font-display text-2xl font-extrabold">
          {t.breakdownTitle}
        </h2>
        <ul aria-label={t.breakdownLabel} className="flex flex-col gap-sm">
          {vm.categories.map((c, i) => (
            <li key={c.category} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-sm text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
              <span className="truncate">{common.categories[c.category]}</span>
              <span className="block h-3 overflow-hidden rounded-full bg-bg" aria-hidden="true">
                <span
                  className={cx('ob-grow-x block h-full rounded-full', COLORS[i % COLORS.length])}
                  style={{ width: `${Math.max(2, c.share * 100)}%`, '--ob-delay': `${i * 70}ms` } as CSSProperties}
                />
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(c.amount)} <span className="text-xs font-normal text-text-muted">({formatRate(c.share, 0)})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col-reverse items-stretch gap-md sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onChange} className="min-h-11 text-left text-base font-semibold hover:text-primary">
          {t.change}
        </button>
        <Button size="lg" onClick={onDone} className="ob-press">
          {t.onward}
        </Button>
      </div>
    </div>
  );
}

function RevealBar({
  label,
  value,
  share,
  tone,
  delay,
  testId,
}: {
  label: string;
  value: number;
  share: number;
  tone: 'muted' | 'primary';
  delay: number;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-baseline justify-between gap-md">
        <span className={tone === 'primary' ? 'text-base font-bold' : 'text-base text-on-primary/70'}>{label}</span>
        <Count
          value={value}
          format={(v) => formatMoney(v)}
          delay={delay}
          className={cx('font-display font-extrabold', tone === 'primary' ? 'text-4xl text-primary sm:text-5xl' : 'text-2xl sm:text-3xl')}
          data-testid={testId}
        />
      </div>
      <span className="block h-5 w-full overflow-hidden rounded-full bg-on-primary/10" aria-hidden="true">
        <span
          className={cx('ob-grow-x block h-full rounded-full', tone === 'primary' ? 'bg-primary' : 'bg-on-primary/50')}
          style={{ width: `${share * 100}%`, '--ob-delay': `${delay}ms` } as CSSProperties}
        />
      </span>
    </div>
  );
}
