// "What if?" hub (/tools): every tool as the question it answers, as large illustrated tiles in four
// groups (Big decisions, This month, Find money, Together). A slim strip on top sends you to import a
// statement: every answer gets better with your own numbers (JF6). Presentational: the route passes the
// hrefs, the view-model (live teasers) and its Link component.
import type { ComponentType, ReactNode } from 'react';
import { tools as copy } from '@/copy';
import { Art, type ArtName, Sticker, ToolTile, type ToolTileTone } from '@/ui-kit';
import type { ToolsHubVM } from '../model/types';

export type ToolKey = keyof typeof copy.hub.items;
type GroupKey = keyof typeof copy.hub.groups;

export type ToolsHubProps = {
  hrefs: Record<ToolKey, string>;
  vm?: ToolsHubVM;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const GROUPS: { key: GroupKey; tools: ToolKey[] }[] = [
  { key: 'big', tools: ['afford', 'loan', 'decide'] },
  { key: 'month', tools: ['checkin', 'bills', 'spend'] },
  { key: 'money', tools: ['subscriptions', 'overpaying'] },
  { key: 'together', tools: ['together'] },
];

/** Art and stage colour of each tile (decorative only). */
export const TOOL_ART: Record<ToolKey, { art: ArtName; tone: ToolTileTone }> = {
  afford: { art: 'afford-crane', tone: 'primary' },
  loan: { art: 'coins', tone: 'warm' },
  decide: { art: 'loan', tone: 'positive' },
  checkin: { art: 'checkin', tone: 'positive' },
  bills: { art: 'calendar', tone: 'primary' },
  spend: { art: 'coffee', tone: 'warm' },
  subscriptions: { art: 'streaming', tone: 'primary' },
  overpaying: { art: 'home-suburb', tone: 'positive' },
  together: { art: 'duel-houses', tone: 'warm' },
  exact: { art: 'upload', tone: 'warm' },
};

function teaser(key: ToolKey, vm: ToolsHubVM | undefined): string | null {
  if (key === 'bills' && vm && vm.nextBillInDays !== null) return copy.hub.teasers.nextBill(vm.nextBillInDays);
  return null;
}

export function ToolsHub({ hrefs, vm, Link }: ToolsHubProps) {
  const t = copy.hub;
  let index = 0;
  return (
    <main className="page flex flex-col gap-2xl">
      <header className="animate-enter flex max-w-(--container-2xl) flex-col items-start gap-md">
        <Sticker tone="ink" tilt={-2}>
          {t.eyebrow}
        </Sticker>
        <h1 className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-6xl">{t.title}</h1>
        <p className="text-lg text-text-muted">{t.lead}</p>
      </header>

      <Link
        href={hrefs.exact}
        className="card animate-enter group flex min-h-11 items-center gap-md p-md transition-colors hover:border-primary"
      >
        <Art name={TOOL_ART.exact.art} className="w-14 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold">{t.items.exact.question}</span>
          <span className="text-sm text-text-muted">{t.items.exact.line}</span>
        </span>
        <span className="hidden shrink-0 font-semibold text-primary group-hover:underline sm:inline">
          {t.exactCta} <span aria-hidden="true">→</span>
        </span>
      </Link>

      {GROUPS.map((g) => {
        const group = t.groups[g.key];
        const id = `tools-group-${g.key}`;
        return (
          <section key={g.key} aria-labelledby={id} className="flex flex-col gap-lg">
            <div className="flex flex-col gap-xs">
              <h2 id={id} className="font-display text-2xl font-extrabold leading-tight">
                {group.title}
              </h2>
              <p className="text-sm text-text-muted">{group.line}</p>
            </div>
            <ul className="grid grid-cols-1 gap-lg min-[480px]:grid-cols-2 lg:grid-cols-3">
              {g.tools.map((key) => {
                const item = t.items[key];
                return (
                  <li key={key}>
                    <ToolTile
                      href={hrefs[key]}
                      art={TOOL_ART[key].art}
                      tone={TOOL_ART[key].tone}
                      title={item.question}
                      line={item.line}
                      teaser={teaser(key, vm)}
                      index={index++}
                      Link={Link}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
