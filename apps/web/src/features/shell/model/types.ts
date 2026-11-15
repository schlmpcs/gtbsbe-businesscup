// View-model contract of the app shell (MP14): sidebar on desktop, bottom tabs + "More" sheet on a phone.
import type { ComponentType, ReactNode } from 'react';

export type ShellLinkKey =
  | 'dashboard' | 'plan' | 'whatif' | 'accounts' | 'transactions' | 'cashflow' | 'budget' | 'recurring' | 'goals'
  | 'play' | 'pro';

export type ShellIcon = ShellLinkKey | 'more';

export type ShellLinkVM = {
  key: ShellLinkKey;
  href: string;
  icon: ShellIcon;
  /** The current page is this link or one of its subpages (rendered as aria-current="page"). */
  active: boolean;
  /** A small tag next to the label ("Daily" on Play). */
  badge?: 'daily';
};

/**
 * Sidebar groups: `main` (Dashboard, Plan, What if?; no heading), `money` (Accounts … Goals, headed "Money"),
 * `game` (Play, set apart under a divider).
 */
export type ShellGroupVM = { key: 'main' | 'money' | 'game'; links: ShellLinkVM[] };

export type ShellVM = {
  /**
   * No chrome on this route (the landing `/` and the onboarding story, /me/*, /start/*): no sidebar,
   * tabs, top bar or banner; the page is full-screen and brings its own logo link and "Skip".
   */
  bare: boolean;
  /** Sidebar (md and up): every page, in groups. */
  sidebar: ShellGroupVM[];
  /** Go Pro: the card at the foot of the sidebar, the phone's top bar and the More sheet. */
  pro: ShellLinkVM;
  /** Where the logo goes (the dashboard). */
  homeHref: string;
  /** Phone bottom tabs (Dashboard, Plan, What if?, Play); "More" comes after them. */
  tabs: ShellLinkVM[];
  /** The rest of the pages, in the phone's More sheet (Go Pro last). */
  more: ShellLinkVM[];
  /** The current page is one of the More sheet's (the More tab shows as active). */
  moreActive: boolean;
  moreOpen: boolean;
  openMore: () => void;
  closeMore: () => void;
};

/** The route's Link component (next/link), passed in so ui/ stays framework-free. */
export type ShellLinkComponent = ComponentType<{
  href: string;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  'aria-current'?: 'page';
  'aria-label'?: string;
}>;
