'use client';

// P8 /plan (with P9 ?view=compare and P10 ?view=chance): presentational. Props in (the plan view-models),
// events out; the route wires the hooks and the URL. Every number is formatted by the hooks.
import { plan as copy } from '@/copy';
import { Button, PageHeader, cx } from '@/ui-kit';
import type {
  AiLineVM, AssumptionsVM, ChanceOfSuccessVM, CompareVM, EventCatalogVM, EventEditorVM, PlanMovesVM, PlanVM, ScenariosVM,
} from '../model/types';
import { AssumptionsPanel } from './AssumptionsPanel';
import { ChanceView } from './ChanceView';
import { CompareView } from './CompareView';
import { EventEditor } from './EventEditor';
import { EventIcon } from './EventIcon';
import { KpiRow } from './KpiRow';
import { NetWorthChart } from './NetWorthChart';
import { NextMoves } from './NextMoves';
import { PlanDetails } from './PlanDetails';

export const PLAN_VIEWS = ['plan', 'compare', 'chance'] as const;
export type PlanViewId = (typeof PLAN_VIEWS)[number];

export type PlanScreenProps = {
  view: PlanViewId;
  onViewChange: (view: PlanViewId) => void;
  plan: PlanVM;
  scenarios: ScenariosVM;
  catalog: EventCatalogVM;
  editor: EventEditorVM;
  assumptions: AssumptionsVM;
  moves: PlanMovesVM;
  aiLine: AiLineVM;
  compare: CompareVM;
  compareWithId: string | null;
  onCompareWith: (id: string) => void;
  chance: ChanceOfSuccessVM;
};

export function PlanScreen(props: PlanScreenProps) {
  const { view, onViewChange, plan, scenarios, catalog, editor } = props;
  const t = copy.screen;

  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-2xl">
      <div className="flex flex-col gap-xl">
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          intro={t.intro}
          aside={
            plan.status === 'ready' ? (
              <span role="status" className="text-xs text-text-muted" data-save-state={plan.saveState}>
                {plan.saveLabel}
              </span>
            ) : undefined
          }
        />

        <ViewSwitch view={view} onChange={onViewChange} />
        <ScenarioBar vm={scenarios} />

        {plan.status !== 'ready' ? (
          <p role="alert" className="rounded-lg bg-surface p-xl text-sm">
            {t.notFound}
          </p>
        ) : view === 'compare' ? (
          <CompareView vm={props.compare} scenarios={scenarios} compareWithId={props.compareWithId} onCompareWith={props.onCompareWith} />
        ) : view === 'chance' ? (
          <ChanceView vm={props.chance} />
        ) : (
          <>
            <KpiRow kpis={plan.kpis} />
            <div className="grid gap-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
              <div className="flex min-w-0 flex-col gap-xl">
                <NetWorthChart
                  chart={plan.chart}
                  aiLine={props.aiLine}
                  display={plan.display}
                  onDisplayChange={plan.setDisplay}
                  onOpenEvent={catalog.openEditor}
                  onMoveEvent={plan.moveEvent}
                />
                <PlanDetails events={plan.tables.events} cashFlow={plan.tables.cashFlow} accounts={plan.tables.accounts} catalog={catalog} />
              </div>
              <div className="flex min-w-0 flex-col gap-xl">
                <NextMoves vm={props.moves} />
                <AssumptionsPanel vm={props.assumptions} />
              </div>
            </div>
            <EventEditor open={catalog.openEventId !== null} editor={editor} onClose={catalog.closeEditor} />
          </>
        )}
      </div>
    </main>
  );
}

function ViewSwitch({ view, onChange }: { view: PlanViewId; onChange: (v: PlanViewId) => void }) {
  const t = copy.screen.views;
  return (
    <nav aria-label={t.label}>
      <ul className="flex w-full gap-xs rounded-md bg-surface p-xs sm:w-fit">
        {PLAN_VIEWS.map((v) => (
          <li key={v} className="flex-1 sm:flex-none">
            <button
              type="button"
              aria-current={v === view ? 'page' : undefined}
              onClick={() => onChange(v)}
              className={cx(
                'min-h-11 w-full rounded-sm px-sm text-sm font-semibold sm:px-lg',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                v === view ? 'bg-ink text-on-primary' : 'text-text-muted hover:text-text',
              )}
            >
              {t[v]}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ScenarioBar({ vm }: { vm: ScenariosVM }) {
  const t = copy.screen.scenarios;
  return (
    <section aria-label={t.label} className="flex flex-wrap items-center gap-sm">
      <ul className="flex min-w-0 flex-wrap gap-sm">
        {vm.items.map((s) => (
          <li key={s.id} className="flex items-center">
            <button
              type="button"
              aria-pressed={s.active}
              onClick={() => vm.select(s.id)}
              className={cx(
                'flex min-h-11 max-w-60 items-center gap-xs rounded-full border px-md text-sm font-semibold',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                s.active ? 'border-primary bg-primary-soft text-text' : 'border-border bg-surface text-text-muted hover:text-text',
              )}
            >
              <EventIcon id={s.icon} className="size-md" />
              <span className="truncate">{s.name}</span>
            </button>
            {s.active && vm.canRemove && (
              <button
                type="button"
                aria-label={t.remove(s.name)}
                onClick={() => vm.remove(s.id)}
                className="min-h-11 min-w-11 text-text-muted hover:text-negative"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" onClick={() => vm.add()}>
        + {t.add}
      </Button>
    </section>
  );
}
