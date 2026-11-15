// The app shell (MP14, docs/ARCHITECTURE.md → Screens). Desktop (md and up): a calm left sidebar
// (logo, Dashboard, Plan and What if?, the "Money" screens, Play with its "Daily" tag, and a Go Pro card at the
// foot). Phone: a slim top bar (logo, Go Pro), fixed bottom tabs (Dashboard, Plan, What if?, Play,
// More) and a "More" sheet with the rest. The page content is padded by --shell-sidebar-w /
// --shell-tabbar-h (globals.css) so nothing hides under the sidebar or the tab bar.
// On a bare route (the landing and the onboarding story) none of the chrome renders: the page is
// full-screen, with only the footer under it.
// Presentational: links and state come from ShellVM; the route's Link comes in as a prop.
import type { ReactNode } from 'react';
import { common } from '@/copy';
import { cx, Sheet } from '@/ui-kit';
import type { ShellGroupVM, ShellLinkComponent, ShellLinkVM, ShellVM } from '../model/types';
import { ShellIcon, ShellLogo } from './ShellIcon';

const t = common.shell;

export type AppShellProps = {
  vm: ShellVM;
  Link: ShellLinkComponent;
  /** Notices at the top of the content (e.g. the sample banner). Not shown on bare routes. */
  banner?: ReactNode;
  /** Under the page (the disclaimer). */
  footer?: ReactNode;
  children: ReactNode;
};

const CONTENT_ID = 'content';

export function AppShell({ vm, Link, banner, footer, children }: AppShellProps) {
  if (vm.bare) {
    return (
      <div data-testid="shell-bare" className="flex min-h-dvh flex-col">
        <div id={CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
          {children}
        </div>
        {footer}
      </div>
    );
  }
  return (
    <>
      <a
        href={`#${CONTENT_ID}`}
        className="sr-only z-50 rounded-lg bg-surface px-lg py-sm font-semibold shadow-md focus:not-sr-only focus:fixed focus:top-sm focus:left-sm"
      >
        {t.skipToContent}
      </a>
      <Sidebar vm={vm} Link={Link} />
      <div className="flex min-h-dvh flex-col pb-(--shell-tabbar-h) md:pl-(--shell-sidebar-w)">
        <TopBar vm={vm} Link={Link} />
        {banner}
        <div id={CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
          {children}
        </div>
        {footer}
      </div>
      <BottomTabs vm={vm} Link={Link} />
      <MoreSheet vm={vm} Link={Link} />
    </>
  );
}

function Logo({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <Link href={vm.homeHref} aria-label={t.home} className="flex min-h-11 shrink-0 items-center gap-sm rounded-md">
      <ShellLogo />
      <span className="font-display text-xl font-extrabold lowercase">{common.appName}</span>
    </Link>
  );
}

function DailyBadge({ badge }: { badge: ShellLinkVM['badge'] }) {
  if (!badge) return null;
  return (
    <span aria-hidden="true" className="ml-auto rounded-full bg-primary-soft px-sm py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-primary">
      {t.badges[badge]}
    </span>
  );
}

const SIDE_LINK = 'flex min-h-10 items-center gap-md rounded-full px-md text-sm transition-colors duration-150';

function SideLink({ link, Link }: { link: ShellLinkVM; Link: ShellLinkComponent }) {
  return (
    <Link
      href={link.href}
      aria-current={link.active ? 'page' : undefined}
      className={cx(
        SIDE_LINK,
        link.active
          ? 'bg-primary-soft font-semibold text-text'
          : 'font-medium text-text-muted hover:bg-surface-strong hover:text-text',
      )}
    >
      <ShellIcon name={link.icon} className={cx('size-5 shrink-0', link.active && 'text-primary')} />
      {t.links[link.key]}
      <DailyBadge badge={link.badge} />
    </Link>
  );
}

function Group({ group, Link }: { group: ShellGroupVM; Link: ShellLinkComponent }) {
  const heading = t.groups[group.key];
  const id = `shell-group-${group.key}`;
  return (
    <div className={cx('flex flex-col gap-xs', group.key === 'game' && 'border-t border-border pt-lg')}>
      {heading && (
        <p id={id} className="px-md pb-xs text-[0.6875rem] font-bold uppercase tracking-wider text-text-muted">
          {heading}
        </p>
      )}
      <ul aria-labelledby={heading ? id : undefined} className="flex flex-col gap-0.5">
        {group.links.map((l) => (
          <li key={l.key}>
            <SideLink link={l} Link={Link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProCard({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <Link
      href={vm.pro.href}
      aria-current={vm.pro.active ? 'page' : undefined}
      className={cx(
        'group flex flex-col gap-xs rounded-(--card-radius) border p-md transition-colors duration-150',
        vm.pro.active ? 'border-primary bg-primary-soft' : 'border-border bg-bg hover:border-primary',
      )}
    >
      <span className="flex items-center gap-sm font-display text-base font-extrabold text-text">
        <ShellIcon name="pro" className="size-5 shrink-0 text-primary" />
        {t.links.pro}
      </span>
      <span className="text-xs leading-snug text-text-muted">{t.proLine}</span>
    </Link>
  );
}

function Sidebar({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <aside
      data-testid="shell-sidebar"
      className="fixed inset-y-0 left-0 z-30 hidden w-(--shell-sidebar-w) flex-col gap-xl overflow-y-auto border-r border-border bg-surface px-md py-lg md:flex"
    >
      <div className="px-sm">
        <Logo vm={vm} Link={Link} />
      </div>
      <nav aria-label={t.sidebarLabel} className="flex flex-col gap-lg">
        {vm.sidebar.map((g) => (
          <Group key={g.key} group={g} Link={Link} />
        ))}
      </nav>
      <div className="mt-auto">
        <ProCard vm={vm} Link={Link} />
      </div>
    </aside>
  );
}

/** Phone only: the logo and Go Pro (the tabs carry the rest). */
function TopBar({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <header className="flex items-center justify-between gap-lg px-lg pt-sm md:hidden">
      <Logo vm={vm} Link={Link} />
      <Link
        href={vm.pro.href}
        aria-current={vm.pro.active ? 'page' : undefined}
        className="inline-flex min-h-11 items-center gap-xs rounded-full px-md text-sm font-semibold text-primary hover:bg-primary-soft"
      >
        <ShellIcon name="pro" className="size-4 shrink-0" />
        {t.links.pro}
      </Link>
    </header>
  );
}

const TAB = 'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg py-xs text-[0.6875rem] leading-tight';

function BottomTabs({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <nav
      aria-label={t.tabsLabel}
      data-testid="shell-tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-(--container-lg) grid-cols-5 items-center px-xs">
        {vm.tabs.map((l) => (
          <li key={l.key} className="flex">
            <Link
              href={l.href}
              aria-current={l.active ? 'page' : undefined}
              className={cx(TAB, l.active ? 'font-bold text-primary' : 'font-medium text-text-muted hover:text-text')}
            >
              <span className={cx('flex h-7 w-12 items-center justify-center rounded-full', l.active && 'bg-primary-soft')}>
                <ShellIcon name={l.icon} className="size-5 shrink-0" />
              </span>
              {t.links[l.key]}
            </Link>
          </li>
        ))}
        <li className="flex">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={vm.moreOpen}
            onClick={vm.openMore}
            className={cx(TAB, vm.moreActive ? 'font-bold text-primary' : 'font-medium text-text-muted hover:text-text')}
          >
            <span className={cx('flex h-7 w-12 items-center justify-center rounded-full', vm.moreActive && 'bg-primary-soft')}>
              <ShellIcon name="more" className="size-5 shrink-0" />
            </span>
            {t.more}
          </button>
        </li>
      </ul>
    </nav>
  );
}

function MoreSheet({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <Sheet open={vm.moreOpen} onClose={vm.closeMore} title={t.moreTitle} description={t.moreDescription}>
      <nav aria-label={t.moreLabel}>
        <ul className="grid grid-cols-2 gap-sm">
          {vm.more.map((l) => (
            <li key={l.key} className={cx(l.key === 'pro' && 'col-span-2')}>
              <Link
                href={l.href}
                onClick={vm.closeMore}
                aria-current={l.active ? 'page' : undefined}
                className={cx(
                  'flex min-h-14 items-center gap-md rounded-(--card-radius) px-md text-sm',
                  l.active
                    ? 'bg-primary-soft font-semibold text-primary'
                    : l.key === 'pro'
                      ? 'border border-primary font-semibold text-primary'
                      : 'border border-border bg-surface font-medium text-text',
                )}
              >
                <ShellIcon name={l.icon} className="size-5 shrink-0" />
                {l.key === 'pro' ? (
                  <span className="flex flex-col">
                    {t.links.pro}
                    <span className="text-xs font-normal text-text-muted">{t.proLine}</span>
                  </span>
                ) : (
                  t.links[l.key]
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Sheet>
  );
}
