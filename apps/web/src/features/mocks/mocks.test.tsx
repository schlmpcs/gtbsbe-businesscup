// @vitest-environment jsdom
// S13 / S14 mock screens: the view-models come from fixtures + engine, and the screens render them.
import { forecast, payoffOrder } from '@lifeguessr/engine';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mocks } from '@/copy';
import { cloneProfileDemo } from '@/fixtures';
import { formatMoney } from '@/ui-kit';
import CheckinPage from '../../../app/checkin/page';
import DecidePage from '../../../app/decide/page';
import { buildCheckinVM, MOCK_CARD_PROGRESS } from './model/checkin';
import { buildDecideVM } from './model/decide';

describe('S13 decision (mock)', () => {
  it('builds both paths from the engine forecast on the demo profile', () => {
    const vm = buildDecideVM();
    const profile = cloneProfileDemo();
    const auto = profile.debts.find((d) => d.kind === 'auto')!;
    expect(vm.keep.netWorth10y).toBeCloseTo(forecast(profile, 10, { todaysDollars: true }).in10y.mid, 6);
    expect(vm.keep.monthsLeft).toBe(payoffOrder([auto], 0, 'avalanche').payoffMonth);
    expect(vm.keepAdvantage10y).toBeCloseTo(vm.keep.netWorth10y - vm.lease.netWorth10y, 6);
    expect(vm.betterBy10y).toBeGreaterThanOrEqual(0);
    expect(vm.todaysDollars).toBe(true);
  });

  it('renders the two paths, the VS and the result, marked as a preview', () => {
    render(<DecidePage />);
    expect(screen.getByRole('heading', { level: 1, name: mocks.decide.title })).toBeTruthy();
    expect(screen.getByRole('region', { name: mocks.decide.keep.title })).toBeTruthy();
    expect(screen.getByRole('region', { name: mocks.decide.lease.title })).toBeTruthy();
    expect(screen.getByText(mocks.preview.sticker)).toBeTruthy();
    const vm = buildDecideVM();
    const score = screen.getByLabelText(mocks.decide.scoreLabel);
    expect(within(score).getByText(formatMoney(vm.betterBy10y, { signed: true }))).toBeTruthy();
  });
});

describe('S14 check-in (mock)', () => {
  it('uses the labelled sample month while monthEnd has no average, and payoffOrder for the card', () => {
    const vm = buildCheckinVM();
    expect(vm.average).toBeCloseTo(vm.projected - vm.difference, 6);
    const card = cloneProfileDemo().debts.find((d) => d.kind === 'card')!;
    expect(vm.move.paid).toBe(card.balance - MOCK_CARD_PROGRESS.balanceNow);
    expect(vm.move.progress).toBeGreaterThan(0);
    expect(vm.move.progress).toBeLessThanOrEqual(1);
    expect(vm.uploadHref).toBe('/me/upload');
  });

  it('renders the headline, the score bar, the drift tiles and the committed move', () => {
    render(<CheckinPage />);
    const vm = buildCheckinVM();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByLabelText(mocks.checkin.scoreLabel)).toBeTruthy();
    const drift = screen.getByRole('heading', { name: mocks.checkin.driftTitle }).closest('section')!;
    expect(within(drift).getAllByRole('listitem')).toHaveLength(vm.drifts.length + vm.onTrack.length);
    expect(screen.getByRole('progressbar', { name: mocks.checkin.move.progressLabel })).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(mocks.checkin.addStatement(vm.nextStatementMonthName)) }).getAttribute('href')).toBe(
      '/me/upload',
    );
    expect(screen.getByText(mocks.preview.sticker)).toBeTruthy();
  });
});
