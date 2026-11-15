// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { common } from '@/copy';
import { isActive, isBareRoute, SHELL_ROUTES, shellNav } from './model/nav';
import type { ShellVM } from './model/types';
import { AppShell } from './ui/AppShell';

const t = common.shell;

afterEach(cleanup);

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function vm(pathname: string, over: Partial<ShellVM> = {}): ShellVM {
  return { ...shellNav(pathname), moreOpen: false, openMore: vi.fn(), closeMore: vi.fn(), ...over };
}

describe('shellNav', () => {
  it('links Dashboard, Plan, the Money screens, Play and Go Pro, and nothing else', () => {
    expect(SHELL_ROUTES).toEqual([
      '/dashboard', '/plan', '/accounts', '/transactions', '/cashflow', '/budget', '/recurring', '/goals', '/play', '/pro',
    ]);
    for (const gone of ['/future', '/tools', '/together', '/checkin', '/decide', '/spend', '/tools/bills']) {
      expect(SHELL_ROUTES).not.toContain(gone);
    }
  });

  it('groups the sidebar: Dashboard and Plan, then Money, then Play (tagged Daily) on its own', () => {
    const nav = shellNav('/dashboard');
    expect(nav.sidebar.map((g) => [g.key, g.links.map((l) => l.key)])).toEqual([
      ['main', ['dashboard', 'plan']],
      ['money', ['accounts', 'transactions', 'cashflow', 'budget', 'recurring', 'goals']],
      ['game', ['play']],
    ]);
    expect(nav.sidebar[2]!.links[0]!.badge).toBe('daily');
    expect(nav.homeHref).toBe('/dashboard');
  });

  it('phone: four tabs (Dashboard, Plan, Play, Accounts) and the rest in More, Go Pro last', () => {
    const nav = shellNav('/dashboard');
    expect(nav.tabs.map((l) => l.href)).toEqual(['/dashboard', '/plan', '/play', '/accounts']);
    expect(nav.more.map((l) => l.href)).toEqual(['/transactions', '/cashflow', '/budget', '/recurring', '/goals', '/pro']);
  });

  it('marks the current page, its subpages and related routes as active; More lights up for its pages', () => {
    expect(shellNav('/plan').tabs.find((l) => l.key === 'plan')?.active).toBe(true);
    expect(shellNav('/afford').tabs.find((l) => l.key === 'plan')?.active).toBe(true);
    expect(shellNav('/loan').tabs.find((l) => l.key === 'plan')?.active).toBe(true);
    expect(shellNav('/duel').tabs.find((l) => l.key === 'play')?.active).toBe(true);
    expect(shellNav('/accounts/a1').tabs.find((l) => l.key === 'accounts')?.active).toBe(true);
    expect(shellNav('/budget').moreActive).toBe(true);
    expect(shellNav('/tools/bills').more.find((l) => l.key === 'recurring')?.active).toBe(true);
    expect(shellNav('/planner').tabs.some((l) => l.active)).toBe(false);
    expect(shellNav('/tools').tabs.some((l) => l.active) || shellNav('/tools').moreActive).toBe(false);
    expect(shellNav('/play').moreActive).toBe(false);
    expect(isActive('/plans', { href: '/plan' })).toBe(false);
  });

  it('is bare (no chrome) on the landing and the onboarding story only', () => {
    for (const r of ['/', '/me', '/me/guess', '/me/upload', '/start', '/start/1']) expect(isBareRoute(r)).toBe(true);
    for (const r of ['/dashboard', '/plan', '/tools', '/afford', '/loan', '/play', '/mean', '/starter']) {
      expect(isBareRoute(r)).toBe(false);
    }
    expect(shellNav('/').bare).toBe(true);
    expect(shellNav('/plan').bare).toBe(false);
  });
});

describe('AppShell', () => {
  it('renders the sidebar and the bottom tabs as labeled landmarks with aria-current on the page', () => {
    render(
      <AppShell vm={vm('/budget')} Link={A} banner={<p>banner</p>}>
        <main>page</main>
      </AppShell>,
    );
    const side = screen.getByRole('navigation', { name: t.sidebarLabel });
    expect(within(side).getByRole('link', { name: t.links.budget })).toHaveAttribute('aria-current', 'page');
    expect(within(side).getByRole('link', { name: t.links.dashboard })).not.toHaveAttribute('aria-current');
    for (const key of ['plan', 'accounts', 'transactions', 'cashflow', 'recurring', 'goals', 'play'] as const) {
      expect(within(side).getByRole('link', { name: t.links[key] })).toBeInTheDocument();
    }
    expect(within(side).getByText(t.groups.money)).toBeInTheDocument();
    expect(within(side).queryByRole('link', { name: 'My future' })).toBeNull();
    expect(within(side).queryByRole('link', { name: 'What if?' })).toBeNull();
    const tabs = screen.getByRole('navigation', { name: t.tabsLabel });
    expect(within(tabs).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/dashboard', '/plan', '/play', '/accounts']);
    expect(within(tabs).getByRole('button', { name: t.more })).toHaveAttribute('aria-expanded', 'false');
    // Go Pro: a card at the foot of the sidebar (with its line) and a link in the phone's top bar.
    const pro = screen.getAllByRole('link', { name: new RegExp(`^${t.links.pro}`) });
    expect(pro.length).toBeGreaterThanOrEqual(2);
    for (const a of pro) expect(a).toHaveAttribute('href', '/pro');
    expect(screen.getByText(t.proLine)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.skipToContent })).toHaveAttribute('href', '#content');
    expect(screen.getByText('banner')).toBeInTheDocument();
  });

  it('on a bare route renders only the page and the footer: no nav, no banner', () => {
    render(
      <AppShell vm={vm('/me/guess')} Link={A} banner={<p>banner</p>} footer={<footer>disclaimer</footer>}>
        <main>story</main>
      </AppShell>,
    );
    expect(screen.getByText('story')).toBeInTheDocument();
    expect(screen.getByText('disclaimer')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText('banner')).toBeNull();
  });

  it('More opens a sheet with the other pages', async () => {
    const openMore = vi.fn();
    const { rerender } = render(
      <AppShell vm={vm('/dashboard', { openMore })} Link={A}>
        <main>page</main>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: t.more }));
    expect(openMore).toHaveBeenCalled();
    act(() => {
      rerender(
        <AppShell vm={vm('/dashboard', { moreOpen: true })} Link={A}>
          <main>page</main>
        </AppShell>,
      );
    });
    const sheet = screen.getByRole('navigation', { name: t.moreLabel });
    expect(within(sheet).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/transactions', '/cashflow', '/budget', '/recurring', '/goals', '/pro',
    ]);
  });
});
