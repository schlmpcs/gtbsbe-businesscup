// The shell's routes (docs/ARCHITECTURE.md → Screens): the sidebar holds Dashboard, Plan, the Money
// screens (Accounts, Transactions, Cash flow, Budget, Recurring, Goals) and Play; the phone's bottom
// tabs hold four and "More" the rest. Pure: the hook in useShell.ts adds the pathname and the More
// sheet's state.
// Routes that still exist but are not in the nav (reached from inside other screens): /future,
// /tools and its tools, /afford and /loan (from /plan), /decide, /checkin, /spend, /together. They
// light up the nav link they belong to (`match`) so the person still sees where they are.
import type { ShellGroupVM, ShellLinkKey, ShellLinkVM } from './types';

type NavDef = {
  key: ShellLinkKey;
  href: string;
  /** Other routes that light this link up. */
  match?: readonly string[];
  badge?: ShellLinkVM['badge'];
};

const D = {
  dashboard: { key: 'dashboard', href: '/dashboard' },
  plan: { key: 'plan', href: '/plan', match: ['/future', '/afford', '/loan', '/decide', '/checkin', '/together'] },
  accounts: { key: 'accounts', href: '/accounts' },
  transactions: { key: 'transactions', href: '/transactions', match: ['/spend'] },
  cashflow: { key: 'cashflow', href: '/cashflow', match: ['/cash-flow'] },
  budget: { key: 'budget', href: '/budget' },
  recurring: { key: 'recurring', href: '/recurring', match: ['/tools/bills', '/tools/subscriptions', '/tools/overpaying'] },
  goals: { key: 'goals', href: '/goals' },
  // The daily game; the challenge link (/duel) is the same game.
  play: { key: 'play', href: '/play', match: ['/duel'], badge: 'daily' },
  pro: { key: 'pro', href: '/pro' },
} as const satisfies Record<ShellLinkKey, NavDef>;

const SIDEBAR: { key: ShellGroupVM['key']; links: ShellLinkKey[] }[] = [
  { key: 'main', links: ['dashboard', 'plan'] },
  { key: 'money', links: ['accounts', 'transactions', 'cashflow', 'budget', 'recurring', 'goals'] },
  { key: 'game', links: ['play'] },
];
const TABS: ShellLinkKey[] = ['dashboard', 'plan', 'play', 'accounts'];
const MORE: ShellLinkKey[] = ['transactions', 'cashflow', 'budget', 'recurring', 'goals', 'pro'];

/**
 * Routes shown without the shell's chrome: the landing (exactly `/`) and the onboarding story
 * (each prefix and its subpaths).
 */
export const BARE_ROUTES: readonly string[] = ['/', '/me', '/start'];

export function isBareRoute(pathname: string): boolean {
  return BARE_ROUTES.some((r) => (r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(`${r}/`)));
}

/** Every route the shell links to, in sidebar order then Go Pro (for tests and the docs). */
export const SHELL_ROUTES: readonly string[] = [...SIDEBAR.flatMap((g) => g.links.map((k) => D[k].href)), D.pro.href];

export function isActive(pathname: string, def: Pick<NavDef, 'href' | 'match'>): boolean {
  return [def.href, ...(def.match ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

function link(key: ShellLinkKey, pathname: string): ShellLinkVM {
  const def: NavDef = D[key];
  const vm: ShellLinkVM = { key, href: def.href, icon: key, active: isActive(pathname, def) };
  if (def.badge) vm.badge = def.badge;
  return vm;
}

export function shellNav(pathname: string) {
  const more = MORE.map((k) => link(k, pathname));
  return {
    bare: isBareRoute(pathname),
    sidebar: SIDEBAR.map((g) => ({ key: g.key, links: g.links.map((k) => link(k, pathname)) })),
    pro: link('pro', pathname),
    homeHref: D.dashboard.href,
    tabs: TABS.map((k) => link(k, pathname)),
    more,
    moreActive: more.some((l) => l.active),
  };
}
