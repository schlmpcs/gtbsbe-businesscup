// The app shell (MP14, docs/ARCHITECTURE.md → Screens). Desktop (md and up): a left sidebar with every
// page. Phone: a slim top bar (logo, Go Pro), fixed bottom tabs (Home, Plan, Play, What if?, More) and
// a "More" sheet with the rest. The page content is padded by --shell-sidebar-w / --shell-tabbar-h
// (globals.css) so nothing hides under the sidebar or the tab bar.
// Presentational: links and state come from ShellVM; the route's Link comes in as a prop.
import type { ReactNode } from 'react';
import { common } from '@/copy';
import { buttonClassName, cx, Sheet } from '@/ui-kit';
import type { ShellGroupVM, ShellLinkComponent, ShellLinkVM, ShellVM } from '../model/types';
import { ShellIcon, ShellLogo } from './ShellIcon';

const t = common.shell;

export type AppShellProps = {
  vm: ShellVM;
  Link: ShellLinkComponent;
  /** Notices under the top of the page (e.g. the sample banner). */
  banner?: ReactNode;
  /** Under the page (the disclaimer). */
  footer?: ReactNode;
  children: ReactNode;
};

const CONTENT_ID = 'content';

export function AppShell({ vm, Link, banner, footer, children }: AppShellProps) {
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

function Logo({ Link }: { Link: ShellLinkComponent }) {
  return (
    <Link href="/" aria-label={t.home} className="flex min-h-11 shrink-0 items-center gap-sm">
      <ShellLogo />
      <span className="font-display text-xl font-extrabold lowercase">{common.appName}</span>
    </Link>
  );
}

const SIDE_LINK = 'flex min-h-11 items-center gap-md rounded-lg px-md text-sm transition-colors';

function SideLink({ link, Link }: { link: ShellLinkVM; Link: ShellLinkComponent }) {
  return (
    <Link
      href={link.href}
      aria-current={link.active ? 'page' : undefined}
      className={cx(
        SIDE_LINK,
        link.active ? 'bg-primary-soft font-semibold text-primary' : 'text-text hover:bg-surface-strong',
      )}
    >
      <ShellIcon name={link.icon} className="size-5 shrink-0" />
      {t.links[link.key]}
    </Link>
  );
}

function Group({ group, Link }: { group: ShellGroupVM; Link: ShellLinkComponent }) {
  const id = `shell-group-${group.key}`;
  return (
    <div className="flex flex-col gap-xs">
      <p id={id} className="px-md text-xs font-bold uppercase tracking-wide text-text-muted">
        {t.groups[group.key]}
      </p>
      <ul aria-labelledby={id} className="flex flex-col gap-xs">
        {group.links.map((l) => (
          <li key={l.key}>
            <SideLink link={l} Link={Link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sidebar({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <aside
      data-testid="shell-sidebar"
      className="fixed inset-y-0 left-0 z-30 hidden w-(--shell-sidebar-w) flex-col gap-xl overflow-y-auto border-r border-border bg-surface px-md py-lg md:flex"
    >
      <div className="px-sm">
        <Logo Link={Link} />
      </div>
      <nav aria-label={t.sidebarLabel} className="flex flex-col gap-xl">
        {vm.sidebar.map((g) => (
          <Group key={g.key} group={g} Link={Link} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-xs">
        <Link
          href={vm.pro.href}
          aria-current={vm.pro.active ? 'page' : undefined}
          className={cx(buttonClassName({ variant: vm.pro.active ? 'primary' : 'secondary', size: 'md', fullWidth: true }))}
        >
          <ShellIcon name="pro" className="size-5 shrink-0" />
          {t.links.pro}
        </Link>
        <p className="px-sm text-xs text-text-muted">{t.proLine}</p>
      </div>
    </aside>
  );
}

/** Phone only: the logo and Go Pro (the tabs carry the rest). */
function TopBar({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <header className="flex items-center justify-between gap-lg px-lg pt-sm md:hidden">
      <Logo Link={Link} />
      <Link
        href={vm.pro.href}
        aria-current={vm.pro.active ? 'page' : undefined}
        className={cx(buttonClassName({ variant: 'secondary', size: 'sm' }), 'min-h-11 text-primary')}
      >
        {t.links.pro}
      </Link>
    </header>
  );
}

const TAB = 'flex min-h-11 w-full flex-col items-center justify-center gap-xs rounded-lg py-xs text-xs leading-tight';

function BottomTabs({ vm, Link }: { vm: ShellVM; Link: ShellLinkComponent }) {
  return (
    <nav
      aria-label={t.tabsLabel}
      data-testid="shell-tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-lg md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-(--container-lg) grid-cols-5 items-center px-xs">
        {vm.tabs.map((l) => (
          <li key={l.key} className="flex">
            <Link
              href={l.href}
              aria-current={l.active ? 'page' : undefined}
              className={cx(TAB, l.active ? 'font-bold text-primary' : 'font-medium text-text-muted hover:text-text')}
            >
              <ShellIcon name={l.icon} />
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
            <ShellIcon name="more" />
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
            <li key={l.key}>
              <Link
                href={l.href}
                onClick={vm.closeMore}
                aria-current={l.active ? 'page' : undefined}
                className={cx(
                  'flex min-h-14 items-center gap-md rounded-lg px-md text-sm',
                  l.active
                    ? 'bg-primary-soft font-semibold text-primary'
                    : l.key === 'pro'
                      ? 'border-2 border-primary font-semibold text-primary'
                      : 'bg-surface font-medium text-text shadow-sm',
                )}
              >
                <ShellIcon name={l.icon} className="size-5 shrink-0" />
                {t.links[l.key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Sheet>
  );
}
