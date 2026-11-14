// /screens: every screen the app links to, for judges and reviewers. Not linked from the landing.
// Presentational only: the route page passes the list and the link component.
import { forecast as t, screenTitles, type ScreenId } from '@/copy';
import type { LinkComponent } from './shared';

export type ScreensIndexProps = {
  /** `title` overrides the screen's default title (S2/S3 when /play is the duel). */
  screens: { id: ScreenId; href: string; title?: string }[];
  Link: LinkComponent;
};

export function ScreensIndex({ screens, Link }: ScreensIndexProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <h1 className="font-display text-3xl font-extrabold leading-tight">{t.today.allScreens}</h1>
      <p className="mt-sm mb-xl text-sm text-text-muted">{t.today.allScreensIntro}</p>
      <nav aria-label={t.today.allScreens}>
        <ul className="flex flex-wrap gap-xs">
          {screens.map(({ id, href, title }) => (
            <li key={id}>
              <Link
                href={href}
                data-screen={id}
                className="inline-flex min-h-11 items-center gap-xs rounded-full bg-surface px-md py-xs text-sm shadow-sm hover:bg-primary-soft"
              >
                <span className="font-mono text-text-muted">{id}</span>
                <span>{title ?? screenTitles[id]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
