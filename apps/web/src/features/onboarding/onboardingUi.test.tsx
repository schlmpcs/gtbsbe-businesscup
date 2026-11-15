// @vitest-environment jsdom
// The story's screens: the practice duel played through (real hook, engine numbers), the landing's
// modes, and chapter 3's reveal from a hand-made view-model.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { onboarding } from '@/copy';
import { formatMoney } from '@/ui-kit';
import type { LandingVM, MonthRevealVM, QuickSlidersVM, StatementUploadVM } from './model/types';
import { usePracticeDuel } from './model/usePracticeDuel';
import { ChapterMonth } from './ui/ChapterMonth';
import { ChapterPractice } from './ui/ChapterPractice';
import { Landing } from './ui/Landing';

const Link = ({ href, children, ...rest }: { href: string; className?: string; children: ReactNode; onClick?: () => void }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

function Practice({ onDone, onFinish }: { onDone: () => void; onFinish: (e: number) => void }) {
  const vm = usePracticeDuel({ onFinish: (s) => s && onFinish(s.averageError) });
  return <ChapterPractice vm={vm} onDone={onDone} dailyHref="/play" />;
}

describe('chapter 1: practice duel', () => {
  it('plays 3 rounds: pick, guess, reveal both totals, then the average error', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const onFinish = vi.fn();
    render(<Practice onDone={onDone} onFinish={onFinish} />);
    expect(screen.getByText(onboarding.practice.note)).toBeTruthy();
    for (let round = 1; round <= 3; round++) {
      expect(screen.getByText(onboarding.practice.round(round, 3))).toBeTruthy();
      // No totals before the pick is revealed.
      expect(screen.queryByTestId('practice-total-A')).toBeNull();
      expect(screen.queryByRole('button', { name: onboarding.practice.reveal })).toBeNull();
      await user.click(screen.getByRole('button', { name: /^Life A costs more/ }));
      expect(screen.getByRole('slider', { name: onboarding.practice.guessLabel('A') })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: onboarding.practice.reveal }));
      for (const letter of ['A', 'B']) {
        expect(screen.getByTestId(`practice-total-value-${letter}`).getAttribute('data-value')).toMatch(/^\$[\d,]+$/);
      }
      expect(screen.getByTestId('practice-result')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: round === 3 ? onboarding.practice.finish : onboarding.practice.next }));
    }
    const avg = screen.getByTestId('practice-average');
    expect(avg.textContent).toMatch(/^You were off by \d+% on average\.$/);
    expect(within(screen.getByRole('list', { name: onboarding.practice.stripLabel })).getAllByRole('listitem')).toHaveLength(3);
    expect(onFinish).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: onboarding.practice.onward }));
    expect(onDone).toHaveBeenCalledOnce();
  });
});

const landing = (over: Partial<LandingVM> = {}): LandingVM => ({
  mode: 'fresh',
  redirectTo: '/dashboard',
  startHref: '/start',
  restartHref: '/start',
  resumeChapter: null,
  sampleHref: '/plan',
  seeSample: vi.fn(),
  ...over,
});

describe('landing', () => {
  it('a first visit: one Start, the sample plan link, the three chapters', async () => {
    const vm = landing();
    render(<Landing vm={vm} Link={Link} homeHref="/" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(onboarding.landing.title);
    expect(screen.getByRole('link', { name: onboarding.landing.start }).getAttribute('href')).toBe('/start');
    await userEvent.setup().click(screen.getByRole('link', { name: onboarding.landing.sample }));
    expect(vm.seeSample).toHaveBeenCalled();
    expect(within(screen.getByRole('region', { name: onboarding.landing.chaptersLabel })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('a story in progress: Continue; a finished one: only the redirect frame', () => {
    const { unmount } = render(<Landing vm={landing({ mode: 'continue', resumeChapter: 3, startHref: '/start?ch=3' })} Link={Link} homeHref="/" />);
    expect(screen.getByRole('link', { name: onboarding.landing.continue(3) }).getAttribute('href')).toBe('/start?ch=3');
    unmount();
    render(<Landing vm={landing({ mode: 'redirect' })} Link={Link} homeHref="/" />);
    expect(screen.getByRole('status').textContent).toBe(onboarding.landing.redirecting);
    expect(screen.queryByRole('link', { name: onboarding.landing.start })).toBeNull();
  });
});

describe('chapter 3: the month', () => {
  const reveal: MonthRevealVM = {
    guess: 3_000,
    actual: 4_200,
    difference: 1_200,
    differenceShare: 0.4,
    direction: 'more',
    guessShare: 3_000 / 4_200,
    actualShare: 1,
    isEstimate: false,
    from: 'statement',
    categories: [
      { category: 'rentUtilities', amount: 2_200, share: 2_200 / 4_200 },
      { category: 'groceries', amount: 2_000, share: 2_000 / 4_200 },
    ],
  };
  const upload = (over: Partial<StatementUploadVM> = {}) =>
    ({ status: 'idle', readFile: vi.fn(), trySample: vi.fn(), apply: vi.fn(), discard: vi.fn(), summary: null, lastRead: null, ...over }) as unknown as StatementUploadVM;
  const sliders = { sliders: [], monthlyCost: 4_200, ownsHome: false, setSpending: vi.fn() } as unknown as QuickSlidersVM;

  it('the sample statement under review: Use these numbers applies it, then the reveal shows the gap', async () => {
    const user = userEvent.setup();
    const vm = upload({ status: 'review', summary: { averageMonth: 4_200, fullMonths: 2 } });
    render(<ChapterMonth upload={vm} sliders={sliders} reveal={reveal} onDone={vi.fn()} />);
    expect(screen.getByTestId('statement-summary').textContent).toContain(formatMoney(4_200));
    await user.click(screen.getByRole('button', { name: onboarding.month.use }));
    expect(vm.apply).toHaveBeenCalledOnce();
    expect(screen.getByTestId('reveal-guess').getAttribute('data-value')).toBe(formatMoney(3_000));
    expect(screen.getByTestId('reveal-actual').getAttribute('data-value')).toBe(formatMoney(4_200));
    expect(screen.getByTestId('reveal-verdict').textContent).toBe(onboarding.month.more(formatMoney(1_200), '40%'));
    expect(within(screen.getByRole('list', { name: onboarding.month.breakdownLabel })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('choosing the sample statement reads it through the upload view-model', async () => {
    const vm = upload();
    render(<ChapterMonth upload={vm} sliders={sliders} reveal={reveal} onDone={vi.fn()} />);
    await userEvent.setup().click(screen.getByTestId('month-sample'));
    expect(vm.trySample).toHaveBeenCalledOnce();
  });
});
