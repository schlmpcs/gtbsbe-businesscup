// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { tools } from '@/copy';
import { ToolsHub } from './ui/ToolsHub';

afterEach(cleanup);

const A = ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

const hrefs = {
  afford: '/afford',
  loan: '/loan',
  decide: '/decide',
  checkin: '/checkin',
  subscriptions: '/tools/subscriptions',
  overpaying: '/tools/overpaying',
  exact: '/me/upload',
  bills: '/tools/bills',
  spend: '/spend',
  together: '/together',
};

const q = (s: string) => new RegExp(s.replace(/[?]/g, '\\?'));

describe('ToolsHub (What if?)', () => {
  it('lists every tool as its question, each linking to its screen', () => {
    render(<ToolsHub hrefs={hrefs} Link={A} />);
    expect(screen.getByRole('heading', { level: 1, name: tools.hub.title })).toBeInTheDocument();
    for (const [key, href] of Object.entries(hrefs)) {
      const question = tools.hub.items[key as keyof typeof hrefs].question;
      expect(screen.getByRole('link', { name: q(question) })).toHaveAttribute('href', href);
    }
  });

  it('puts the statement import first: the other tools answer better with your own numbers', () => {
    render(<ToolsHub hrefs={hrefs} Link={A} />);
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/me/upload');
  });

  it('groups the tools: Big decisions, This month, Find money, Together', () => {
    render(<ToolsHub hrefs={hrefs} Link={A} />);
    const groups = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(groups).toEqual(['Big decisions', 'This month', 'Find money', 'Together']);
    const big = screen.getByRole('region', { name: 'Big decisions' });
    expect(within(big).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/afford', '/loan', '/decide']);
    const month = screen.getByRole('region', { name: 'This month' });
    expect(within(month).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/checkin', '/tools/bills', '/spend']);
    const money = screen.getByRole('region', { name: 'Find money' });
    expect(within(money).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/tools/subscriptions', '/tools/overpaying']);
  });

  it('shows the next bill as a live teaser only when the view-model knows it', () => {
    const { rerender } = render(<ToolsHub hrefs={hrefs} vm={{ nextBillInDays: 6 }} Link={A} />);
    expect(screen.getByRole('link', { name: q(tools.hub.items.bills.question) })).toHaveTextContent('Next bill in 6 days');
    rerender(<ToolsHub hrefs={hrefs} vm={{ nextBillInDays: null }} Link={A} />);
    expect(screen.queryByText(/Next bill/)).toBeNull();
    rerender(<ToolsHub hrefs={hrefs} vm={{ nextBillInDays: 0 }} Link={A} />);
    expect(screen.getByText('Next bill due today')).toBeInTheDocument();
  });
});
