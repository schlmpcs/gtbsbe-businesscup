// The shell's routes (docs/ARCHITECTURE.md → Screens: the sidebar holds Dashboard, Plan, Accounts,
// Transactions, Cash Flow, Budget, Recurring, Goals; the phone's bottom tabs hold a few and "More"
// the rest). Pure: the hook in useShell.ts adds the pathname and the More sheet's state.
import type { ShellGroupVM, ShellIcon, ShellLinkKey, ShellLinkVM } from './types';

type NavDef = { key: ShellLinkKey; href: string; icon: ShellIcon; /** Other routes that light this link up. */ match?: readonly string[] };

const D = {
  home: { key: 'home', href: '/', icon: 'home' },
  plan: { key: 'plan', href: '/plan', icon: 'plan' },
  accounts: { key: 'accounts', href: '/accounts', icon: 'accounts' },
  transactions: { key: 'transactions', href: '/transactions', icon: 'transactions' },
  cashflow: { key: 'cashflow', href: '/cashflow', icon: 'cashflow' },
  budget: { key: 'budget', href: '/budget', icon: 'budget' },
  recurring: { key: 'recurring', href: '/recurring', icon: 'recurring' },
  goals: { key: 'goals', href: '/goals', icon: 'goals' },
  future: { key: 'future', href: '/future', icon: 'future' },
  // The What if? hub and the tools it opens.
  whatIf: {
    key: 'whatIf', href: '/tools', icon: 'whatIf',
    match: ['/afford', '/loan', '/decide', '/checkin', '/spend', '/together'],
  },
  // The daily game; the challenge link (/duel) is the same game.
  play: { key: 'play', href: '/play', icon: 'play', match: ['/duel'] },
  pro: { key: 'pro', href: '/pro', icon: 'pro' },
} as const satisfies Record<ShellLinkKey, NavDef>;

const SIDEBAR: { key: ShellGroupVM['key']; links: ShellLinkKey[] }[] = [
  { key: 'planner', links: ['home', 'plan', 'accounts', 'transactions', 'cashflow', 'budget', 'recurring', 'goals'] },
  { key: 'tools', links: ['future', 'whatIf', 'play'] },
];
const TABS: ShellLinkKey[] = ['home', 'plan', 'play', 'whatIf'];
const MORE: ShellLinkKey[] = ['accounts', 'transactions', 'cashflow', 'budget', 'recurring', 'goals', 'future', 'pro'];

/** Every route the shell links to, in sidebar order then Go Pro (for tests and the docs). */
export const SHELL_ROUTES: readonly string[] = [...SIDEBAR.flatMap((g) => g.links.map((k) => D[k].href)), D.pro.href];

export function isActive(pathname: string, def: NavDef): boolean {
  if (def.href === '/') return pathname === '/';
  return [def.href, ...(def.match ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

function link(key: ShellLinkKey, pathname: string): ShellLinkVM {
  const def: NavDef = D[key];
  return { key, href: def.href, icon: def.icon, active: isActive(pathname, def) };
}

export function shellNav(pathname: string) {
  const more = MORE.map((k) => link(k, pathname));
  return {
    sidebar: SIDEBAR.map((g) => ({ key: g.key, links: g.links.map((k) => link(k, pathname)) })),
    pro: link('pro', pathname),
    tabs: TABS.map((k) => link(k, pathname)),
    more,
    moreActive: more.some((l) => l.active),
  };
}
