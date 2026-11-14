// "What if?" hub (/tools): every tool on one page, each as the question it answers. Presentational:
// the route passes the hrefs and its Link component.
import type { ComponentType, ReactNode } from 'react';
import { tools as copy } from '@/copy';
import { Art, type ArtName, Sticker } from '@/ui-kit';

export type ToolKey = keyof typeof copy.hub.items;

export type ToolsHubProps = {
  hrefs: Record<ToolKey, string>;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

// Your own numbers first (JF6): every other tool answers better once a statement replaced the estimates.
const ORDER: ToolKey[] = ['exact', 'afford', 'loan', 'decide', 'checkin', 'subscriptions', 'overpaying', 'bills', 'together'];
const ART: Record<ToolKey, ArtName> = {
  afford: 'afford-crane',
  loan: 'coins',
  decide: 'home-family',
  checkin: 'house-crane',
  subscriptions: 'streaming',
  overpaying: 'home-suburb',
  bills: 'calendar',
  exact: 'little-things',
  together: 'duel-houses',
};

export function ToolsHub({ hrefs, Link }: ToolsHubProps) {
  const t = copy.hub;
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl">
      <header className="flex max-w-(--container-2xl) flex-col items-start gap-md">
        <Sticker tone="ink" tilt={-2}>
          {t.eyebrow}
        </Sticker>
        <h1 className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-7xl">{t.title}</h1>
        <p className="text-lg text-text-muted sm:text-xl">{t.lead}</p>
      </header>
      <ul className="mt-2xl grid gap-xl sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((key) => {
          const item = t.items[key];
          return (
            <li key={key}>
              <Link
                href={hrefs[key]}
                className="group flex h-full flex-row items-center gap-md rounded-xl bg-surface p-lg shadow-md transition-transform hover:-translate-y-xs sm:flex-col sm:items-stretch sm:p-xl"
              >
                {/* A phone gets a compact row (small art beside the question), so all nine fit in a few screens. */}
                <Art name={ART[key]} className="flex size-20 shrink-0 items-center sm:mx-auto sm:size-40" />
                <span className="flex min-w-0 flex-1 flex-col gap-xs sm:gap-md">
                  <span className="font-display text-xl font-extrabold leading-tight sm:text-3xl">{item.question}</span>
                  <span className="text-sm text-text-muted sm:text-base">{item.line}</span>
                  <span className="mt-auto hidden font-bold text-primary group-hover:underline sm:inline">
                    {t.open} <span aria-hidden="true">→</span>
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-xl font-bold text-primary sm:hidden">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
