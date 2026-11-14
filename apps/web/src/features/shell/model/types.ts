// View-model contract of the app shell (MP14): sidebar on desktop, bottom tabs + "More" sheet on a phone.
import type { ComponentType, ReactNode } from 'react';

export type ShellLinkKey =
  | 'home' | 'plan' | 'accounts' | 'transactions' | 'cashflow' | 'budget' | 'recurring' | 'goals'
  | 'future' | 'whatIf' | 'play' | 'pro';

export type ShellIcon =
  | 'home' | 'plan' | 'accounts' | 'transactions' | 'cashflow' | 'budget' | 'recurring' | 'goals'
  | 'future' | 'whatIf' | 'play' | 'pro' | 'more';

export type ShellLinkVM = {
  key: ShellLinkKey;
  href: string;
  icon: ShellIcon;
  /** The current page is this link or one of its subpages (rendered as aria-current="page"). */
  active: boolean;
};

export type ShellGroupVM = { key: 'planner' | 'tools'; links: ShellLinkVM[] };

export type ShellVM = {
  /** Sidebar (md and up): every page, in groups. */
  sidebar: ShellGroupVM[];
  /** Go Pro, under the sidebar groups and in the phone's top bar and More sheet. */
  pro: ShellLinkVM;
  /** Phone bottom tabs (Home, Plan, Play, What if?); "More" comes after them. */
  tabs: ShellLinkVM[];
  /** The rest of the pages, in the phone's More sheet. */
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
