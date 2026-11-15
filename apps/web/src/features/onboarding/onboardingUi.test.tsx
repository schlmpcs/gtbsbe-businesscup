// @vitest-environment jsdom
// The landing's modes (the onboarding itself is features/welcome at /start).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { onboarding } from '@/copy';
import type { LandingVM } from './model/types';
import { Landing } from './ui/Landing';

const Link = ({ href, children, ...rest }: { href: string; className?: string; children: ReactNode; onClick?: () => void }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

const landing = (over: Partial<LandingVM> = {}): LandingVM => ({
  mode: 'fresh',
  redirectTo: '/dashboard',
  startHref: '/start',
  restartHref: '/start',
  resumeChapter: null,
  sampleHref: '/plan',
  playHref: '/play',
  sampleFacts: [{ id: 'age', value: '32' }, { id: 'cash', value: '$3,800' }],
  seeSample: vi.fn(),
  ...over,
});

describe('landing', () => {
  it('a first visit: Start, the sample plan link, and what the product is', async () => {
    const vm = landing();
    render(<Landing vm={vm} Link={Link} homeHref="/" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(onboarding.landing.title);
    expect(screen.getAllByRole('link', { name: onboarding.landing.start }).map((a) => a.getAttribute('href'))).toEqual(['/start', '/start']);
    await userEvent.setup().click(screen.getByRole('link', { name: onboarding.landing.sample }));
    expect(vm.seeSample).toHaveBeenCalled();
    // The page says what the product is: four facts, the sample life's own numbers, six steps, the FAQ.
    expect(within(screen.getByRole('region', { name: onboarding.landing.statsLabel })).getAllByRole('listitem')).toHaveLength(4);
    expect(within(screen.getByTestId('landing-sample-facts')).getByText('$3,800')).toBeTruthy();
    expect(within(screen.getByTestId('landing-steps')).getAllByRole('listitem')).toHaveLength(6);
    expect(within(screen.getByTestId('landing-faq')).getAllByRole('group')).toHaveLength(onboarding.landing.faq.items.length);
    expect(screen.getByRole('link', { name: onboarding.landing.nav.play }).getAttribute('href')).toBe('/play');
  });

  it('a story in progress: Continue; a finished one: only the redirect frame', () => {
    const { unmount } = render(<Landing vm={landing({ mode: 'continue', resumeChapter: 3, startHref: '/start?ch=3' })} Link={Link} homeHref="/" />);
    expect(screen.getAllByRole('link', { name: onboarding.landing.continue(3) })[0]!.getAttribute('href')).toBe('/start?ch=3');
    unmount();
    render(<Landing vm={landing({ mode: 'redirect' })} Link={Link} homeHref="/" />);
    expect(screen.getByRole('status').textContent).toBe(onboarding.landing.redirecting);
    expect(screen.queryByRole('link', { name: onboarding.landing.start })).toBeNull();
  });
});

