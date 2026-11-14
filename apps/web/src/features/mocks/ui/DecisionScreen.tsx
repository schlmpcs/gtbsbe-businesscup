'use client';

// S13 Decision: the car. Path A vs Path B against keeping the car you have. Presentational: every
// number comes from useDecision(), which calls the engine (canAfford, loan, forecast).
import type { ReactNode } from 'react';
import { mocks } from '@/copy';
import {
  Button, Card, Choice, cx, EstimateTag, Field, ForecastChart, formatMoney, formatRate, Money, NumberInput, Stack, Tabs,
} from '@/ui-kit';
import type {
  CarPathForm, DecisionPathId, DecisionPathResultVM, DecisionPathVM, DecisionVM, KeepCarVM,
} from '../model/types';
import { ErrorNote, Loading, ScreenHeader, type LinkComponent } from './shared';

const t = mocks.decision;

export type DecisionLinks = { loan: string; afford: string };

export type DecisionScreenProps = { vm: DecisionVM; links: DecisionLinks; Link: LinkComponent };

export function DecisionScreen({ vm, links, Link }: DecisionScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <Stack gap="xl">
        <ScreenHeader title={mocks.screens.S13} intro={t.intro} pro={vm.pro} Link={Link} />
        <DecisionKinds kinds={vm.kinds} />
        {vm.status === 'loading' ? (
          <Loading />
        ) : (
          <>
            <Leader vm={vm} />
            <Compare vm={vm} />
            <Chart vm={vm} />
            <PathEditor paths={vm.paths} setPath={vm.setPath} resetPaths={vm.resetPaths} />
            <Assumptions />
            <NextSteps links={links} Link={Link} />
          </>
        )}
      </Stack>
    </main>
  );
}

/** F10's decisions: the car is built, the rest come with Pro. */
function DecisionKinds({ kinds }: { kinds: DecisionVM['kinds'] }) {
  return (
    <nav aria-label={t.kindsLabel}>
      <ul className="flex flex-wrap gap-xs">
        {kinds.map((k) => (
          <li key={k.id}>
            {k.available ? (
              <span
                aria-current="page"
                className="inline-flex items-center rounded-full bg-primary px-md py-xs text-sm font-semibold text-on-primary"
              >
                {t.kinds[k.id]}
              </span>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-xs rounded-full border border-dashed border-border px-md py-xs text-sm text-text-muted"
              >
                {t.kinds[k.id]}
                <span className="text-xs">· {t.comingWithPro}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

const pathName = (id: DecisionPathId) => t.pathName(id);

/** Which path leaves more in 10 years. */
function Leader({ vm }: { vm: DecisionVM }) {
  const c = vm.comparison;
  if (!c) return null;
  return (
    <Card tone="arena" data-testid="decision-leader" data-leader={c.leader}>
      <p className="font-display text-2xl font-extrabold leading-tight">
        {c.leader === 'tie' ? t.tie : t.leader(pathName(c.leader), formatMoney(c.gap10y))}
      </p>
      <p className="mt-sm text-sm text-text-muted">{t.leaderHint}</p>
    </Card>
  );
}

function verdictText(r: DecisionPathResultVM): string {
  if (r.verdict === 'wait') return t.verdicts.wait(r.waitMonths ?? 1);
  return t.verdicts[r.verdict];
}

const VERDICT_TONE = { fits: 'text-positive', wait: 'text-warning', no: 'text-negative' } as const;

type Column = { key: string; name: string; path: DecisionPathVM | null };
type RowDef = {
  key: string;
  label: string;
  hint?: string;
  keep: (k: KeepCarVM) => ReactNode;
  path: (r: DecisionPathResultVM, id: DecisionPathId) => ReactNode;
};

const none = <span className="text-text-muted">{t.compare.none}</span>;

const ROWS: RowDef[] = [
  {
    key: 'verdict',
    label: t.compare.rows.verdict,
    keep: () => none,
    path: (r, id) => (
      <span data-testid={`decision-verdict-${id}`} data-verdict={r.verdict} className={cx('font-semibold', VERDICT_TONE[r.verdict])}>
        {verdictText(r)}
      </span>
    ),
  },
  {
    key: 'monthly',
    label: t.compare.rows.monthly,
    keep: () => none,
    path: (r) => (r.monthly === null ? t.compare.noPayment : <Money value={r.monthly} />),
  },
  {
    key: 'totalCost',
    label: t.compare.rows.totalCost,
    hint: t.compare.totalCostHint,
    keep: () => none,
    path: (r) => <Money value={r.totalCost} />,
  },
  { key: 'totalInterest', label: t.compare.rows.totalInterest, keep: () => none, path: (r) => <Money value={r.totalInterest} /> },
  {
    key: 'payoff',
    label: t.compare.rows.payoff,
    keep: () => none,
    path: (r) =>
      r.monthly === null ? (
        none
      ) : r.payoffMonth === null ? (
        <span className="font-semibold text-negative">{t.compare.never}</span>
      ) : (
        t.compare.payoffMonths(r.payoffMonth)
      ),
  },
  { key: 'debtLoad', label: t.compare.rows.debtLoad, keep: (k) => formatRate(k.debtLoad.value), path: (r) => formatRate(r.debtLoad.value) },
  {
    key: 'in10y',
    label: t.compare.rows.in10y,
    keep: (k) => <Money value={k.in10y.mid} />,
    path: (r) => <Money value={r.in10y.mid} />,
  },
  {
    key: 'vsKeep',
    label: t.compare.rows.vsKeep,
    keep: () => none,
    path: (r) => (
      <span className={r.vsKeep10y < 0 ? 'text-negative' : 'text-positive'}>{formatMoney(r.vsKeep10y, { signed: true })}</span>
    ),
  },
];

function Compare({ vm }: { vm: DecisionVM }) {
  const columns: Column[] = [
    { key: 'keep', name: t.keepName, path: null },
    ...vm.paths.map((p) => ({ key: p.id, name: pathName(p.id), path: p })),
  ];
  const keep = vm.keep;
  const reasons = vm.paths.flatMap((p) =>
    p.result?.status === 'ready' && p.result.data.failsOn ? [{ id: p.id, r: p.result.data }] : [],
  );
  const baselineFails = vm.paths.some((p) => p.result?.status === 'ready' && p.result.data.baselineFails);
  const errors = [keep, ...vm.paths.map((p) => p.result)].filter((r) => r?.status === 'error');

  return (
    <Card
      title={t.compare.title}
      action={vm.forecastIsEstimate || vm.debtLoadIsEstimate ? <EstimateTag /> : undefined}
    >
      {errors[0]?.status === 'error' && <ErrorNote error={errors[0].error} className="mb-md" />}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm" data-testid="decision-compare">
          <caption className="sr-only">{t.compare.caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-1/4 py-xs pr-sm text-left text-xs font-medium text-text-muted">
                <span className="sr-only">{t.compare.metric}</span>
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="py-xs pr-xs text-right align-bottom font-semibold">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <th scope="row" className="py-sm pr-sm text-left align-top text-xs font-normal text-text-muted">
                  {row.label}
                  {row.hint && <span className="sr-only">. {row.hint}</span>}
                </th>
                {columns.map((c) => (
                  <td key={c.key} className="py-sm pr-xs text-right align-top tabular-nums">
                    {c.path === null ? (
                      keep.status === 'ready' ? row.keep(keep.data) : none
                    ) : c.path.result?.status === 'ready' ? (
                      row.path(c.path.result.data, c.path.id)
                    ) : (
                      <span className="text-xs text-text-muted">
                        {c.path.invalidFields.length > 0 ? t.compare.fix : c.path.result?.status === 'error' ? t.compare.failed : ''}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-sm text-xs text-text-muted">{t.compare.totalCostHint}</p>
      {(reasons.length > 0 || baselineFails) && (
        <ul className="mt-md flex flex-col gap-xs text-sm" data-testid="decision-reasons">
          {baselineFails && <li className="text-text-muted">{t.baselineFails}</li>}
          {reasons.map(({ id, r }) => (
            <li key={id}>
              <span className="font-semibold">{pathName(id)}: </span>
              {r.failsOn === 'cushion'
                ? t.failsOn.cushion(t.cushionMonths(vm.rules.cushionMonths))
                : r.failsOn === 'debtLoad'
                  ? t.failsOn.debtLoad(formatRate(vm.rules.debtLoadRed))
                  : t.failsOn.cardRevolves}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Chart({ vm }: { vm: DecisionVM }) {
  const [a, b] = vm.paths;
  if (a.result?.status !== 'ready' || b.result?.status !== 'ready') return null;
  return (
    <Card>
      <ForecastChart
        title={t.chartTitle}
        series={{ label: pathName('A'), points: a.result.data.points }}
        compare={{ label: pathName('B'), points: b.result.data.points }}
        showBand={vm.forecastIsEstimate}
        footnote={t.chartFootnote}
      />
    </Card>
  );
}

function PathFields({ path, setPath }: { path: DecisionPathVM; setPath: DecisionVM['setPath'] }) {
  const e = t.edit;
  const f = path.form;
  const error = (field: string) => (path.invalidFields.includes(field) ? e.errors[field] : undefined);
  const set = (patch: Partial<CarPathForm>) => setPath(path.id, patch);
  // An emptied required field becomes null so the view-model flags it as invalid.
  return (
    <Stack gap="md">
      <p className="text-sm text-text-muted">{t.pathHint[path.id]}</p>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Field label={e.price} error={error('price')}>
          <NumberInput name={`price-${path.id}`} prefix="$" value={f.price} onValueChange={(v) => set({ price: v })} />
        </Field>
        <Choice
          legend={e.payWith}
          name={`payWith-${path.id}`}
          value={f.payWith}
          options={[
            { value: 'loan', label: e.payWithOptions.loan },
            { value: 'cash', label: e.payWithOptions.cash },
          ]}
          onChange={(payWith) => set({ payWith })}
        />
        {f.payWith === 'loan' && (
          <>
            <Field label={e.downPayment} error={error('downPayment')}>
              <NumberInput
                name={`downPayment-${path.id}`}
                prefix="$"
                value={f.downPayment}
                onValueChange={(v) => set({ downPayment: v ?? 0 })}
              />
            </Field>
            <Field label={e.apr} hint={e.aprHint} error={error('apr')}>
              <NumberInput
                name={`apr-${path.id}`}
                percent
                max={1}
                suffix="%"
                value={f.apr}
                onValueChange={(v) => set({ apr: v })}
              />
            </Field>
            <Field label={e.termMonths} error={error('termMonths')}>
              <NumberInput
                name={`termMonths-${path.id}`}
                maxFractionDigits={0}
                max={600}
                suffix={e.termSuffix}
                value={f.termMonths}
                onValueChange={(v) => set({ termMonths: v })}
              />
            </Field>
            <Field label={e.fees} hint={e.feesHint} error={error('fees')}>
              <NumberInput name={`fees-${path.id}`} prefix="$" value={f.fees} onValueChange={(v) => set({ fees: v ?? 0 })} />
            </Field>
          </>
        )}
      </div>
      {path.invalidFields.length > 0 && <p className="text-sm text-negative">{e.fix}</p>}
    </Stack>
  );
}

function PathEditor({ paths, setPath, resetPaths }: Pick<DecisionVM, 'paths' | 'setPath' | 'resetPaths'>) {
  return (
    <Card
      title={t.editTitle}
      action={
        <Button size="sm" variant="ghost" onClick={resetPaths}>
          {t.edit.reset}
        </Button>
      }
    >
      <Tabs
        label={t.editTitle}
        fullWidth
        tabs={paths.map((p) => ({ id: p.id, label: pathName(p.id), panel: <PathFields path={p} setPath={setPath} /> }))}
      />
    </Card>
  );
}

function Assumptions() {
  return (
    <Card title={t.assumptionsTitle} tone="muted" headingLevel={2}>
      <ul className="flex list-disc flex-col gap-xs pl-lg text-sm text-text-muted">
        {t.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </Card>
  );
}

function NextSteps({ links, Link }: { links: DecisionLinks; Link: LinkComponent }) {
  const items = [
    { href: links.loan, ...t.next.loan },
    { href: links.afford, ...t.next.afford },
  ];
  return (
    <section aria-labelledby="decision-next">
      <h2 id="decision-next" className="text-lg font-semibold">
        {t.nextTitle}
      </h2>
      <ul className="mt-md grid gap-md sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="flex h-full flex-col gap-xs rounded-lg border border-border bg-bg p-lg shadow-sm hover:bg-surface"
            >
              <span className="font-semibold text-primary">{i.title}</span>
              <span className="text-sm text-text-muted">{i.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
