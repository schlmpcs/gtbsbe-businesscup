'use client';

// S13 "Keep your car or switch?". Presentational: every number comes from useDecide() (the person's car
// from their accounts and budget, or a labelled example; the engine's carDecision on the planner's
// profile; the plan effect from plan()). Layout: the question, the alternative picker, then the answer
// (verdict + KPI strip, the two-line chart, cost per month) with the inputs in a right-hand panel on
// desktop (under the answer on a phone), "What it does to your plan" and "How we calculate".
import type { ReactNode } from 'react';
import { forecast, mocks } from '@/copy';
import { Button, buttonClassName, cx, EstimateTag, Field, formatMoney, NumberInput, PageHeader, Tag } from '@/ui-kit';
import { CountUp, KpiStrip, MOTION, Panel, Segmented, TONE_BG, type ChartTone } from '@/ui-kit/reports';
import { ToolPlanImpact } from '@/ui-kit/ToolPlanImpact';
import type {
  AlternativeKind, CarCostVM, DecideFieldVM, DecidePlanVM, DecideResultVM, DecideVM, FieldOrigin,
} from '../model/types';
import { ErrorNote, Loading, type LinkComponent } from './shared';
import { TwoLineChart } from './TwoLineChart';

const t = mocks.decide;
const KEEP_TONE: ChartTone = 'c1';
const ALT_TONE: ChartTone = 'primary';
const KINDS: AlternativeKind[] = ['lease', 'buy', 'noCar'];

const money = (v: number) => formatMoney(v);
const compact = (v: number) => formatMoney(v, { compact: true });

export type DecideLinks = { addCarLoan: string; budget: string };

// ----- verdict -------------------------------------------------------------------------------------

function Verdict({ vm, r }: { vm: DecideVM; r: DecideResultVM }) {
  const kind = vm.alternativeKind;
  const pill = r.isClose ? t.pill.close : r.better === 'keep' ? t.pill.keep : t.pill.alternative[kind];
  const subject = r.better === 'keep' ? t.subject.keep : t.subject[kind];
  const diff = r.keepNetWorth - r.alternativeNetWorth;
  return (
    <section aria-label={t.verdictTitle} data-testid="decide-verdict" className={cx('card card-pad flex flex-col gap-lg', MOTION.rise)}>
      <div className="flex flex-col gap-sm">
        <span
          data-testid="decide-pill"
          data-better={r.isClose ? 'close' : r.better}
          className={cx(
            'w-fit rounded-full px-md py-xs text-xs font-bold uppercase tracking-wide',
            r.isClose ? 'bg-surface-strong text-text-muted' : r.better === 'keep' ? 'bg-positive-soft text-positive' : 'bg-primary-soft text-primary',
          )}
        >
          {pill}
        </span>
        <p data-testid="decide-sentence" className="font-display text-3xl font-extrabold leading-tight text-balance sm:text-4xl">
          {r.isClose ? t.sentenceClose(vm.horizonYear) : t.sentence(subject, compact(r.betterBy), vm.horizonYear)}
        </p>
        {r.isClose && <p className="text-sm text-text-muted">{t.sentenceCloseSub}</p>}
        <p className="flex flex-wrap items-center gap-sm text-xs text-text-muted">
          {t.footnote(vm.horizonYear)}
          <Tag data-testid="decide-forecast-source" data-source={r.source}>
            {forecast.source[r.source]}
          </Tag>
          {r.isEstimate && <EstimateTag />}
        </p>
      </div>
      <KpiStrip
        aria-label={t.verdictTitle}
        data-testid="decide-kpis"
        className="shadow-none"
        items={[
          { id: 'keep', dot: KEEP_TONE, label: t.kpi.keep(vm.horizonYear), value: <CountUp value={r.keepNetWorth} format={money} /> },
          {
            id: 'alternative',
            dot: ALT_TONE,
            label: t.kpi.alternative(t.kindsShort[vm.alternativeKind], vm.horizonYear),
            value: <CountUp value={r.alternativeNetWorth} format={money} />,
          },
          {
            id: 'difference',
            label: t.kpi.difference,
            value: <CountUp value={diff} format={(v) => formatMoney(v, { signed: true })} />,
            tone: r.isClose ? 'default' : diff >= 0 ? 'positive' : 'negative',
            hint: t.kpi.differenceHint,
          },
        ]}
      />
    </section>
  );
}

function Chart({ vm, r }: { vm: DecideVM; r: DecideResultVM }) {
  const altLabel = t.kinds[vm.alternativeKind];
  const last = r.years[r.years.length - 1]!;
  return (
    <Panel title={t.chartTitle} subtitle={t.chartSubtitle} delay={80}>
      <TwoLineChart
        years={r.years.map((y) => y.year)}
        series={[
          { id: 'keep', label: t.lineKeep, tone: KEEP_TONE, values: r.years.map((y) => y.keep) },
          { id: 'alternative', label: altLabel, tone: ALT_TONE, values: r.years.map((y) => y.alternative) },
        ]}
        label={t.chartLabel(money(last.keep), money(last.alternative), altLabel, last.year)}
        yearHeader={t.tableYear}
      />
    </Panel>
  );
}

// ----- cost per month ------------------------------------------------------------------------------

const PART_TONE = { payment: 'c1', running: 'c3', signing: 'c5' } as const satisfies Record<string, ChartTone>;
type Part = keyof typeof PART_TONE;

function CostBar({ label, cost, max, noCar }: { label: string; cost: CarCostVM; max: number; noCar?: boolean }) {
  const parts = (['payment', 'running', 'signing'] as Part[]).filter((p) => cost[p] > 0);
  const width = max > 0 ? (cost.total / max) * 100 : 0;
  return (
    <li className="flex flex-col gap-xs">
      <div className="flex items-baseline justify-between gap-md">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-display text-xl font-extrabold tabular-nums">
          <CountUp value={cost.total} format={money} />
        </span>
      </div>
      <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded-full bg-surface-strong">
        <div className="flex h-full" style={{ width: `${Math.min(100, width)}%` }}>
          {parts.map((p) => (
            <div
              key={p}
              className={cx('h-full first:rounded-l-full last:rounded-r-full', TONE_BG[PART_TONE[p]], MOTION.growX)}
              style={{ width: `${(cost[p] / cost.total) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <p className="sr-only">
        {parts.map((p) => `${p === 'running' && noCar ? t.costPartsNoCar : t.costParts[p]}: ${money(cost[p])}`).join(', ')}
      </p>
    </li>
  );
}

function Costs({ vm, r }: { vm: DecideVM; r: DecideResultVM }) {
  const kind = vm.alternativeKind;
  const max = Math.max(r.keepCost.total, r.alternativeCost.total);
  const notes: string[] = [];
  if (r.keepPayoffMonths === 0) notes.push(t.noLoanNote);
  else if (r.keepPayoffMonths === null) notes.push(t.neverPaidOff);
  else notes.push(t.afterPayoff(mocks.checkin.months(r.keepPayoffMonths), money(r.keepCostAfterPayoff.total)));
  if (r.alternativeUpfront > 0) notes.push(t.upfront(money(r.alternativeUpfront)));
  if (r.signings > 0) notes.push(t.signings(r.signings));
  if (r.tradeInEquity > 0) notes.push(t.tradeIn(money(r.tradeInEquity)));
  else if (r.tradeInEquity < 0) notes.push(t.tradeInShort(money(-r.tradeInEquity)));
  const legend = (['payment', 'running', 'signing'] as Part[]).filter((p) => r.keepCost[p] > 0 || r.alternativeCost[p] > 0);
  return (
    <Panel title={t.costTitle} subtitle={t.costSubtitle} delay={140} data-testid="decide-costs">
      <ul className="flex flex-col gap-md">
        <CostBar label={t.costRow.keep} cost={r.keepCost} max={max} />
        <CostBar label={t.costRow[kind]} cost={r.alternativeCost} max={max} noCar={kind === 'noCar'} />
      </ul>
      <ul aria-hidden="true" className="mt-md flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted">
        {legend.map((p) => (
          <li key={p} className="inline-flex items-center gap-xs">
            <span className={cx('size-2 rounded-full', TONE_BG[PART_TONE[p]])} />
            {t.costParts[p]}
          </li>
        ))}
      </ul>
      <ul className="mt-md flex flex-col gap-xs border-t border-border pt-md text-sm text-text-muted">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Panel>
  );
}

// ----- plan ----------------------------------------------------------------------------------------

function PlanCard({ vm, plan, links, Link }: { vm: DecideVM; plan: DecidePlanVM; links: DecideLinks; Link: LinkComponent }) {
  const p = t.plan;
  const picker = (
    <Segmented
      legend={p.choose}
      showLegend
      name="decide-plan-path"
      value={plan.path}
      options={[
        { value: 'keep', label: p.paths.keep },
        { value: 'alternative', label: t.kindsShort[vm.alternativeKind] },
      ]}
      onChange={plan.setPath}
    />
  );
  const what = plan.event
    ? plan.event.kind === 'leaseExpense'
      ? p.what.lease(money(plan.event.amount))
      : p.what.buy(money(plan.event.amount))
    : '';
  return (
    <div className="flex min-w-0 flex-col gap-md" data-testid="decide-plan">
      {picker}
      {plan.event ? (
        <ToolPlanImpact
          scenarioName={plan.tool.scenarioName}
          preview={plan.tool.preview}
          add={plan.tool.add}
          added={plan.tool.added}
          planHref={plan.tool.planHref}
          what={what}
          Link={Link}
        />
      ) : (
        <section className="card card-pad flex flex-col gap-sm" aria-label={p.title}>
          <h2 className="text-lg font-bold leading-tight">{p.title}</h2>
          <p className="text-sm text-text-muted">
            {plan.noEventReason === 'noCar' ? p.noCarNote : p.keepNote}{' '}
            <Link
              href={plan.noEventReason === 'noCar' ? links.budget : plan.tool.planHref}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              {plan.noEventReason === 'noCar' ? p.noCarLink : p.open}
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}

// ----- inputs --------------------------------------------------------------------------------------

function OriginTag({ origin, isEstimate }: { origin: FieldOrigin; isEstimate: boolean }) {
  if (origin === 'typed') return null;
  if (origin === 'example') return <EstimateTag />;
  return (
    <span className="inline-flex flex-wrap items-center gap-xs">
      <Tag>{t.origin[origin]}</Tag>
      {isEstimate && <EstimateTag />}
    </span>
  );
}

function NumberField<K extends string>({
  f,
  label,
  hint,
  name,
  onChange,
}: {
  f: DecideFieldVM<K>;
  label: string;
  hint?: string;
  name: string;
  onChange: (key: K, v: number | null) => void;
}) {
  return (
    <Field
      label={
        <span className="inline-flex flex-wrap items-center gap-xs">
          {label}
          <OriginTag origin={f.origin} isEstimate={f.isEstimate} />
        </span>
      }
      hint={hint}
      error={f.error ? t.errors[f.error] : undefined}
    >
      <NumberInput
        name={name}
        value={f.value}
        onValueChange={(v) => onChange(f.key, v)}
        prefix={f.unit === 'money' || f.unit === 'monthly' ? '$' : undefined}
        suffix={f.unit === 'monthly' ? t.suffix.monthly : f.unit === 'months' ? t.suffix.months : undefined}
        percent={f.unit === 'rate'}
        max={f.max}
        maxFractionDigits={f.unit === 'months' ? 0 : 2}
      />
    </Field>
  );
}

function Inputs({ vm }: { vm: DecideVM }) {
  const kind = vm.alternativeKind;
  const altLabel = (key: string) => (kind === 'noCar' ? t.fields.noCarMonthly : t.fields.alternative[key] ?? key);
  const altHint = (key: string) => (kind === 'noCar' ? t.hints.noCar : key === 'running' ? t.hints.running : key === 'termMonths' && kind === 'lease' ? t.hints.termLease : undefined);
  const reset = (onClick: () => void, label: string) => (
    <Button size="sm" variant="ghost" onClick={onClick} aria-label={`${t.reset}: ${label}`}>
      {t.reset}
    </Button>
  );
  return (
    <div className="flex min-w-0 flex-col gap-xl" data-testid="decide-inputs">
      <Panel title={t.carTitle} action={reset(vm.resetCar, t.carTitle)} delay={60}>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-1">
          {vm.car.map((f) => (
            <NumberField
              key={f.key}
              f={f}
              name={`car-${f.key}`}
              label={t.fields.car[f.key] ?? f.key}
              hint={f.key === 'value' ? t.hints.value : f.key === 'running' ? t.hints.running : undefined}
              onChange={vm.setCar}
            />
          ))}
        </div>
      </Panel>
      <Panel title={t.altTitle[kind]} action={reset(vm.resetAlternative, t.altTitle[kind])} delay={120}>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-1">
          {vm.alternative.map((f) => (
            <NumberField key={`${kind}-${f.key}`} f={f} name={`${kind}-${f.key}`} label={altLabel(f.key)} hint={altHint(f.key)} onChange={vm.setAlternative} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function How() {
  return (
    <details className="card card-pad group" data-testid="decide-how">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-semibold">
        {t.howTitle}
        <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="mt-md flex list-disc flex-col gap-sm pl-lg text-sm text-text-muted">
        {t.how.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

// ----- screen --------------------------------------------------------------------------------------

export function DecideScreen({ vm, links, Link }: { vm: DecideVM; links: DecideLinks; Link: LinkComponent }) {
  const r = vm.result;
  let answer: ReactNode = null;
  if (r?.status === 'ready') {
    answer = (
      <>
        <Verdict vm={vm} r={r.data} />
        <Chart vm={vm} r={r.data} />
        <Costs vm={vm} r={r.data} />
      </>
    );
  } else if (r?.status === 'error') {
    answer = <ErrorNote error={r.error} className="card card-pad" />;
  } else if (r === null) {
    answer = (
      <p role="alert" data-testid="decide-fix" className="card card-pad text-sm text-negative">
        {t.fix}
      </p>
    );
  }
  return (
    <main className="page flex flex-col gap-xl">
      <PageHeader eyebrow={t.kicker} title={t.title} intro={t.lead} />
      {vm.status === 'loading' ? (
        <Loading />
      ) : (
        <>
          <Segmented
            legend={t.compareWith}
            showLegend
            name="decide-alternative"
            value={vm.alternativeKind}
            options={KINDS.map((k) => ({ value: k, label: t.kinds[k] }))}
            onChange={vm.setAlternativeKind}
          />
          {!vm.carFromProfile && (
            <div role="note" data-testid="decide-example-note" className="card flex flex-wrap items-center justify-between gap-md px-lg py-md">
              <p className="min-w-0 flex-1 text-sm text-text-muted">{t.exampleNote}</p>
              <Link href={links.addCarLoan} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                {t.exampleLink}
              </Link>
            </div>
          )}
          <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-xl">
              {answer}
              {r?.status === 'ready' && <PlanCard vm={vm} plan={vm.plan} links={links} Link={Link} />}
            </div>
            <aside className="min-w-0 lg:sticky lg:top-lg">
              <Inputs vm={vm} />
            </aside>
          </div>
          <How />
        </>
      )}
    </main>
  );
}
