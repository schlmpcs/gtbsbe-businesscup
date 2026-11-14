// @vitest-environment jsdom
// S15 wiring: the real view-model and UI together, on a fake Pro adapter (no network).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { pro as copy } from '@/copy';
import { resetClientState } from '@/test/clientState';
import { resetProState } from '@/test/pro';
import { ProScreen } from './ProScreen';

beforeEach(() => {
  resetClientState();
  resetProState();
  window.history.replaceState(null, '', '/pro');
});

describe('ProScreen', () => {
  it('a judge unlocks Pro with the prefilled promo code', async () => {
    const user = userEvent.setup();
    render(<ProScreen />);
    expect(await screen.findByRole('button', { name: copy.checkout.button })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: copy.promo.label })).toHaveValue('JURY2026');
    await user.click(screen.getByRole('button', { name: copy.promo.button }));
    expect(await screen.findByRole('heading', { name: copy.active.successTitle })).toHaveFocus();
    expect(screen.queryByRole('button', { name: copy.checkout.button })).not.toBeInTheDocument();
  });

  it('back from a cancelled checkout: says no charge was made and cleans the URL', async () => {
    window.history.replaceState(null, '', '/pro?checkout=cancelled');
    render(<ProScreen checkoutReturn={{ checkout: 'cancelled' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(copy.cancelled);
    expect(window.location.search).toBe('');
    expect(await screen.findByRole('button', { name: copy.checkout.button })).toBeEnabled();
  });
});
