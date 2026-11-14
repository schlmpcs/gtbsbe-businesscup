import Link from 'next/link';
import { common, screenTitles } from '@/copy';
import { SCREEN_IDS, SCREEN_ROUTES } from '@/lib/screens';
import { ScreenPage } from './_components/ScreenPage';

// S1 Today (forecast). Placeholder + nav to every screen until Y10 lands.
export default function TodayPage() {
  return (
    <ScreenPage id="S1">
      <nav aria-label={common.nav.title} className="mt-xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{common.nav.title}</h2>
        <ul className="mt-sm divide-y divide-border rounded-md border border-border">
          {SCREEN_IDS.map((id) => (
            <li key={id}>
              <Link
                href={SCREEN_ROUTES[id]}
                className="flex items-baseline gap-md px-lg py-md hover:bg-surface"
                data-screen={id}
              >
                <span className="w-10 shrink-0 font-mono text-xs text-text-muted">{id}</span>
                <span>{screenTitles[id]}</span>
                <span className="ml-auto font-mono text-xs text-text-muted">{SCREEN_ROUTES[id]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </ScreenPage>
  );
}
