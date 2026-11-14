// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { common } from '@/copy';
import { isActive, SHELL_ROUTES, shellNav } from './model/nav';
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
  it('links every planner route, the tools, the game and Go Pro', () => {
    expect(SHELL_ROUTES).toEqual([
      '/', '/plan', '/accounts', '/transactions', '/cashflow', '/budget', '/recurring', '/goals',
      '/future', '/tools', '/play', '/pro',
    ]);
  });

  it('phone: four tabs (Home, Plan, Play, What if?) and the rest in More, My future and Go Pro included', () => {
    const nav = shellNav('/');
    expect(nav.tabs.map((l) => l.href)).toEqual(['/', '/plan', '/play', '/tools']);
    expect(nav.more.map((l) => l.href)).toEqual(['/accounts', '/transactions', '/cashflow', '/budget', '/recurring', '/goals', '/future', '/pro']);
  });

  it('marks the current page, its subpages and related routes as active; More lights up for its pages', () => {
    expect(isActive('/', { href: '/' })).toBe(true);
    expect(isActive('/plan', { href: '/' })).toBe(false);
    expect(shellNav('/plan').tabs.find((l) => l.key === 'plan')?.active).toBe(true);
    expect(shellNav('/afford').tabs.find((l) => l.key === 'whatIf')?.active).toBe(true);
    expect(shellNav('/duel').tabs.find((l) => l.key === 'play')?.active).toBe(true);
    expect(shellNav('/accounts/a1').moreActive).toBe(true);
    expect(shellNav('/planner').tabs.some((l) => l.active)).toBe(false);
    expect(shellNav('/play').moreActive).toBe(false);
  });
});

describe('AppShell', () => {
  it('renders the sidebar and the bottom tabs as labeled landmarks with aria-current on the page', () => {
    render(
      <AppShell vm={vm('/budget')} Link={A}>
        <main>page</main>
      </AppShell>,
    );
    const side = screen.getByRole('navigation', { name: t.sidebarLabel });
    expect(within(side).getByRole('link', { name: t.links.budget })).toHaveAttribute('aria-current', 'page');
    expect(within(side).getByRole('link', { name: t.links.home })).not.toHaveAttribute('aria-current');
    for (const key of ['plan', 'accounts', 'transactions', 'cashflow', 'recurring', 'goals', 'future', 'whatIf', 'play'] as const) {
      expect(within(side).getByRole('link', { name: t.links[key] })).toBeInTheDocument();
    }
    const tabs = screen.getByRole('navigation', { name: t.tabsLabel });
    expect(within(tabs).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/plan', '/play', '/tools']);
    expect(within(tabs).getByRole('button', { name: t.more })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('link', { name: t.links.pro })[0]).toHaveAttribute('href', '/pro');
    expect(screen.getByRole('link', { name: t.skipToContent })).toHaveAttribute('href', '#content');
  });

  it('More opens a sheet with the other pages', async () => {
    const openMore = vi.fn();
    const { rerender } = render(
      <AppShell vm={vm('/', { openMore })} Link={A}>
        <main>page</main>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: t.more }));
    expect(openMore).toHaveBeenCalled();
    act(() => {
      rerender(
        <AppShell vm={vm('/', { moreOpen: true })} Link={A}>
          <main>page</main>
        </AppShell>,
      );
    });
    const sheet = screen.getByRole('navigation', { name: t.moreLabel });
    expect(within(sheet).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/accounts', '/transactions', '/cashflow', '/budget', '/recurring', '/goals', '/future', '/pro',
    ]);
  });
});
