'use client';

// P8 /plan (with P9 ?view=compare and P10 ?view=chance): presentational. Props in (the plan view-models),
// events out; the route wires the hooks, the URL and its Link. Every number is formatted by the hooks.
//
// Layout: a header row (title, scenario chips, view tabs, "Add event" and "Assumptions"), the view's
// cards in the main column, and a right-hand panel on wide screens (≥1280px) with the Assumptions (Plan,
// Compare) or the simulation settings (Chance of success). Below 1280px the panel opens as a sheet.
import { useState } from 'react';
import { plan as copy } from '@/copy';
import { Button, Sheet, cx } from '@/ui-kit';
import type {
  AiLineVM, AssumptionsVM, ChanceOfSuccessVM, CompareVM, EventCatalogVM, EventEditorVM, PlanMovesVM, PlanVM, ScenariosVM,
} from '../model/types';
import { AssumptionsPanel } from './AssumptionsPanel';
import { ChanceSettings, ChanceView } from './ChanceView';
import { CompareView } from './CompareView';
import { EventEditor } from './EventEditor';
import { EventBadge, EventIcon } from './EventIcon';
import { NetWorthChart } from './NetWorthChart';
import { NextMoves, type PlanLinkComponent } from './NextMoves';
import { PlanDetails } from './PlanDetails';

export const PLAN_VIEWS = ['plan', 'compare', 'chance'] as const;
export type PlanViewId = (typeof PLAN_VIEWS)[number];
export type { PlanLinkComponent } from './NextMoves';

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
  /** The route's Link (client navigation to /afford and /loan); a plain <a> when left out. */
  Link?: PlanLinkComponent;
};

export function PlanScreen(props: PlanScreenProps) {
  const { view, onViewChange, plan, scenarios, catalog, editor } = props;
  const t = copy.screen;
  const [panelOpen, setPanelOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const panelTitle = view === 'chance' ? t.chance.settingsTitle : t.assumptions.title;
  const panel = view === 'chance' ? <ChanceSettings vm={props.chance} /> : <AssumptionsPanel vm={props.assumptions} />;

  return (
    <main className="page flex flex-col gap-lg">
      {/* Header row */}
      <header className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div className="flex min-w-0 items-baseline gap-md">
            <h1 className="text-3xl leading-tight sm:text-4xl">{t.title}</h1>
            {plan.status === 'ready' && (
              <span role="status" className="text-xs text-text-muted" data-save-state={plan.saveState}>
                {plan.saveLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-sm">
            <Button variant="secondary" size="sm" className="min-h-11 xl:hidden" onClick={() => setPanelOpen(true)} aria-haspopup="dialog">
              <SlidersGlyph />
              {view === 'chance' ? t.header.settings : t.header.assumptions}
            </Button>
            <Button size="sm" className="min-h-11" onClick={() => setCatalogOpen(true)} aria-haspopup="dialog">
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              {t.header.addEvent}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
          <ScenarioBar vm={scenarios} />
          <ViewSwitch view={view} onChange={onViewChange} />
        </div>
      </header>

      <div className="grid gap-lg xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-lg">
          {plan.status !== 'ready' ? (
            <p role="alert" className="card card-pad text-sm">
              {t.notFound}
            </p>
          ) : view === 'compare' ? (
            <CompareView vm={props.compare} scenarios={scenarios} compareWithId={props.compareWithId} onCompareWith={props.onCompareWith} />
          ) : view === 'chance' ? (
            <ChanceView vm={props.chance} />
          ) : (
            <>
              <NetWorthChart
                kpis={plan.kpis}
                chart={plan.chart}
                aiLine={props.aiLine}
                display={plan.display}
                onDisplayChange={plan.setDisplay}
                onOpenEvent={catalog.openEditor}
                onMoveEvent={plan.moveEvent}
              />
              <PlanDetails events={plan.tables.events} cashFlow={plan.tables.cashFlow} accounts={plan.tables.accounts} onOpenEvent={catalog.openEditor} />
              <NextMoves vm={props.moves} {...(props.Link ? { Link: props.Link } : {})} />
            </>
          )}
        </div>

        {/* Right-hand panel (wide screens). */}
        <aside aria-label={panelTitle} className="card card-pad hidden xl:sticky xl:top-lg xl:block xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
          <h2 className="mb-sm text-lg font-bold">{panelTitle}</h2>
          {panel}
        </aside>
      </div>

      <Sheet
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={panelTitle}
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setPanelOpen(false)}>{t.header.panelClose}</Button>
          </div>
        }
      >
        {panelOpen ? panel : null}
      </Sheet>

      <EventCatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} catalog={catalog} />
      <EventEditor open={catalog.openEventId !== null} editor={editor} onClose={catalog.closeEditor} />
    </main>
  );
}

function SlidersGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-md" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 7h10 M18 7h2 M4 17h4 M12 17h8 M16 5v4 M10 15v4" />
    </svg>
  );
}

function ViewSwitch({ view, onChange }: { view: PlanViewId; onChange: (v: PlanViewId) => void }) {
  const t = copy.screen.views;
  return (
    <nav aria-label={t.label} className="w-full md:w-auto">
      <ul className="flex w-full gap-xs rounded-full bg-surface-strong p-xs md:w-fit">
        {PLAN_VIEWS.map((v) => (
          <li key={v} className="flex-1 md:flex-none">
            <button
              type="button"
              aria-current={v === view ? 'page' : undefined}
              onClick={() => onChange(v)}
              className={cx(
                'min-h-11 w-full whitespace-nowrap rounded-full px-sm text-sm font-semibold transition-colors sm:px-lg',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                v === view ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
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
    <section aria-label={t.label} className="flex min-w-0 flex-wrap items-center gap-sm">
      <ul className="flex min-w-0 flex-wrap gap-sm">
        {vm.items.map((s) => (
          <li key={s.id} className={cx('flex items-center rounded-full border', s.active ? 'border-primary bg-primary-soft' : 'border-border bg-surface')}>
            <button
              type="button"
              aria-pressed={s.active}
              onClick={() => vm.select(s.id)}
              className={cx(
                'flex min-h-11 max-w-56 items-center gap-xs rounded-full pl-md text-sm font-semibold',
                s.active && vm.canRemove ? 'pr-xs' : 'pr-md',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                s.active ? 'text-text' : 'text-text-muted hover:text-text',
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
                className="min-h-11 min-w-11 rounded-full text-text-muted hover:text-negative"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => vm.add()}
        aria-label={t.add}
        title={t.add}
        className="flex min-h-11 items-center gap-xs rounded-full border border-dashed border-text-muted px-md text-sm font-semibold text-text-muted hover:border-primary hover:text-primary"
      >
        <span aria-hidden="true" className="text-lg leading-none">+</span>
        {t.addShort}
      </button>
    </section>
  );
}

function EventCatalogSheet({ open, onClose, catalog }: { open: boolean; onClose: () => void; catalog: EventCatalogVM }) {
  const t = copy.screen.events;
  return (
    <Sheet open={open} onClose={onClose} title={t.catalogTitle} description={t.catalogIntro}>
      <ul className="grid gap-sm sm:grid-cols-2">
        {catalog.entries.map((e) => (
          <li key={e.type}>
            <button
              type="button"
              disabled={!e.enabled}
              onClick={() => {
                onClose();
                catalog.add(e.type);
              }}
              className={cx(
                'flex h-full min-h-11 w-full items-start gap-md rounded-md border border-border bg-bg p-md text-left transition-colors',
                'hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <EventBadge id={e.icon} className="mt-xs" />
              <span className="flex min-w-0 flex-col gap-xs">
                <span className="font-semibold">{e.title}</span>
                <span className="text-sm text-text-muted">{e.enabled ? e.description : t.onlyOne}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
