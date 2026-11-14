// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { tools } from '@/copy';
import { ToolsHub } from './ui/ToolsHub';

const A = ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

describe('ToolsHub (What if?)', () => {
  it('lists every tool as its question, each linking to its screen', () => {
    const hrefs = { afford: '/afford', loan: '/loan', decide: '/decide', checkin: '/checkin', subscriptions: '/tools/subscriptions', overpaying: '/tools/overpaying', exact: '/me/upload' };
    render(<ToolsHub hrefs={hrefs} Link={A} />);
    expect(screen.getByRole('heading', { level: 1, name: tools.hub.title })).toBeInTheDocument();
    for (const [key, href] of Object.entries(hrefs)) {
      const q = tools.hub.items[key as keyof typeof hrefs].question;
      expect(screen.getByRole('link', { name: new RegExp(q.replace('?', '\\?')) })).toHaveAttribute('href', href);
    }
  });
});
