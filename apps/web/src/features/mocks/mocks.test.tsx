// @vitest-environment jsdom
// S13 screen on their real view-model hooks (the demo profile and the fixtures). Every number
// the tests expect on screen is computed by the engine here, never taken from a constant.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { forecast, mocks } from '@/copy';
import { cloneProfileDemo, leaseScenarioSample } from '@/fixtures';
import { resetClientState } from '@/test/clientState';
import { resetProState } from '@/test/pro';
import { formatMoney } from '@/ui-kit';
import { evaluateDecision, useDecide } from './model/useDecide';
import { DecideScreen } from './ui/DecideScreen';

beforeEach(() => {
  resetClientState();
  resetProState();
});

function A({ href, children, ...rest }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

const NOW = new Date(2026, 10, 14);
const Decide = () => <DecideScreen vm={useDecide({ now: NOW })} Link={A} />;
const d = mocks.decide;

describe('S13 decision', () => {
  it('renders the two paths, the VS and the result from the engine, marked as a preview', async () => {
    render(<Decide />);
    expect(await screen.findByRole('heading', { level: 1, name: d.title })).toBeTruthy();
    expect(screen.getByRole('region', { name: d.keep.title })).toBeTruthy();
    expect(screen.getByRole('region', { name: d.lease.title })).toBeTruthy();
    // A preview, but a free tool: no Pro link on it.
    const note = screen.getByRole('note', { name: mocks.preview.sticker });
    expect(within(note).getByText(mocks.preview.note)).toBeTruthy();
    expect(within(note).queryByRole('link')).toBeNull();
    expect(screen.queryByText(/\bPRO\b/i)).toBeNull();
    const r = evaluateDecision(cloneProfileDemo(), leaseScenarioSample, true);
    const score = screen.getByLabelText(d.scoreLabel);
    expect(within(score).getByText(formatMoney(r.betterBy10y, { signed: true }))).toBeTruthy();
    // The two 10-year numbers come from the rules engine, whatever S10 shows: labeled so.
    expect(screen.getByTestId('decide-forecast-source').textContent).toBe(forecast.source.rules);
    // No "coming soon" chips for decisions that aren't built.
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('editing the lease updates the result; an emptied field is flagged', async () => {
    const user = userEvent.setup();
    render(<Decide />);
    await screen.findByLabelText(d.scoreLabel);
    const monthly = screen.getByRole('textbox', { name: new RegExp(`^${d.edit.monthly}`) });
    await user.clear(monthly);
    expect(screen.getByText(d.edit.errors.monthly!)).toBeTruthy();
    expect(screen.queryByLabelText(d.scoreLabel)).toBeNull();
    await user.type(monthly, '250');
    const r = evaluateDecision(cloneProfileDemo(), { ...leaseScenarioSample, monthly: 250 }, true);
    const score = await screen.findByLabelText(d.scoreLabel);
    expect(within(score).getByText(formatMoney(r.betterBy10y, { signed: true }))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: d.edit.reset }));
    expect((monthly as HTMLInputElement).value).toBe(String(leaseScenarioSample.monthly));
  });
});

