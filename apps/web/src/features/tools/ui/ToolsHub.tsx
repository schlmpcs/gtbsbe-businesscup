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

const ORDER: ToolKey[] = ['afford', 'loan', 'decide', 'checkin', 'subscriptions', 'overpaying', 'exact', 'together'];
const ART: Record<ToolKey, ArtName> = {
  afford: 'afford-crane',
  loan: 'coins',
  decide: 'home-family',
  checkin: 'house-crane',
  subscriptions: 'streaming',
  overpaying: 'calendar',
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
        <h1 className="font-display text-5xl font-extrabold leading-display tracking-tight sm:text-7xl">{t.title}</h1>
        <p className="text-xl text-text-muted">{t.lead}</p>
      </header>
      <ul className="mt-2xl grid gap-xl sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((key) => {
          const item = t.items[key];
          return (
            <li key={key}>
              <Link
                href={hrefs[key]}
                className="group flex h-full flex-col gap-md rounded-xl bg-surface p-xl shadow-md transition-transform hover:-translate-y-xs"
              >
                <Art name={ART[key]} className="mx-auto flex h-40 w-40 items-center" />
                <span className="font-display text-3xl font-extrabold leading-tight">{item.question}</span>
                <span className="text-text-muted">{item.line}</span>
                <span className="mt-auto font-bold text-primary group-hover:underline">
                  {t.open} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
