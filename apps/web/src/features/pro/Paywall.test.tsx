// @vitest-environment jsdom
// Render tests for the presentational paywall (S15): each view state from a plain view-model.
// Lives outside ui/ because ui/ may import only ui-kit, copy and model types.
import { PRO_PRICES } from '@lifeguessr/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { common, pro as copy } from '@/copy';
import type { PaywallVM } from './model/types';
import { Paywall } from './ui/Paywall';

function vm(overrides: Partial<PaywallVM> = {}): PaywallVM {
  return {
    view: 'offer',
    plans: [
      { id: 'yearly', ...PRO_PRICES.yearly, isEstimate: true, selected: true },
      { id: 'monthly', ...PRO_PRICES.monthly, isEstimate: true, selected: false },
    ],
    selectPlan: vi.fn(),
    checkoutMode: 'stripe',
    startCheckout: vi.fn(),
    payDemo: vi.fn(),
    promoEnabled: true,
    promoCode: 'JURY2026',
    setPromoCode: vi.fn(),
    redeem: vi.fn(),
    busy: null,
    coolingDown: false,
    cancelled: false,
    error: null,
    retry: null,
    pro: null,
    continueHref: '/afford',
    ...overrides,
  };
}

const checkoutButton = () => screen.getByRole('button', { name: copy.checkout.button });
const statusRegion = () => screen.getByRole('status');

describe('Paywall', () => {
  it('offer: demo label, tagged prices, what is gated vs coming, test card, promo and disclaimer', () => {
    render(<Paywall {...vm()} />);
    expect(screen.getByText(copy.demoBadge.stripe)).toBeInTheDocument();
    const plans = screen.getByRole('group', { name: new RegExp(copy.plans.legend) });
    expect(within(plans).getByRole('radio', { name: /Yearly.*\$39\.99/ })).toBeChecked();
    expect(within(plans).getByRole('radio', { name: /Monthly.*\$6\.99/ })).not.toBeChecked();
    expect(within(plans).getByText(common.estimateTag)).toBeInTheDocument();

    const includes = screen.getByRole('region', { name: copy.includes.title });
    expect(within(includes).getByText(copy.includes.now[0])).toBeInTheDocument();
    expect(within(includes).getByRole('heading', { name: copy.includes.comingTitle })).toBeInTheDocument();

    expect(checkoutButton()).toBeEnabled();
    expect(screen.getByText(copy.checkout.testCardNumber)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: copy.promo.label })).toHaveValue('JURY2026');
    expect(screen.getAllByText(common.disclaimer).length).toBeGreaterThan(0);
  });

  it('sends events: plan, checkout, promo edits and submit', async () => {
    const user = userEvent.setup();
    const props = vm({ promoCode: '' });
    render(<Paywall {...props} />);
    await user.click(screen.getByRole('radio', { name: /Monthly/ }));
    expect(props.selectPlan).toHaveBeenCalledWith('monthly');
    await user.click(checkoutButton());
    expect(props.startCheckout).toHaveBeenCalledTimes(1);
    await user.type(screen.getByRole('textbox', { name: copy.promo.label }), 'J');
    expect(props.setPromoCode).toHaveBeenCalledWith('J');
    await user.type(screen.getByRole('textbox', { name: copy.promo.label }), '{Enter}');
    expect(props.redeem).toHaveBeenCalledTimes(1);
  });

  it('checkout unavailable: the button is off with a note, the promo still works', () => {
    render(<Paywall {...vm({ checkoutMode: 'off' })} />);
    expect(checkoutButton()).toBeDisabled();
    expect(checkoutButton()).toHaveAccessibleDescription(copy.checkout.unavailable);
    expect(screen.queryByText(copy.checkout.testCardNumber)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.promo.button })).toBeEnabled();
  });

  it('while a request runs every control is off', () => {
    render(<Paywall {...vm({ busy: 'promo' })} />);
    expect(checkoutButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.promo.busy })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Monthly/ })).toBeDisabled();
  });

  it('errors map to copy next to their block; status errors offer a retry', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Paywall {...vm({ error: { where: 'promo', key: 'invalidCode', retryAfterSeconds: null } })} />);
    expect(screen.getByRole('textbox', { name: copy.promo.label })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(copy.errors.invalidCode)).toBeInTheDocument();

    rerender(<Paywall {...vm({ error: { where: 'checkout', key: 'rateLimited', retryAfterSeconds: 5 } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors.rateLimitedFor(5));

    const retry = vi.fn();
    rerender(<Paywall {...vm({ error: { where: 'status', key: 'network', retryAfterSeconds: null }, retry })} />);
    expect(statusRegion()).toHaveTextContent(copy.errors.network);
    await user.click(within(statusRegion()).getByRole('button', { name: copy.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('loading, confirming and cancelled are announced in the status region', () => {
    const { rerender } = render(<Paywall {...vm({ view: 'loading' })} />);
    expect(statusRegion()).toHaveTextContent(copy.loading);
    expect(screen.queryByRole('button', { name: copy.checkout.button })).not.toBeInTheDocument();
    rerender(<Paywall {...vm({ view: 'confirming', busy: 'confirm' })} />);
    expect(statusRegion()).toHaveTextContent(copy.confirming);
    rerender(<Paywall {...vm({ cancelled: true })} />);
    expect(statusRegion()).toHaveTextContent(copy.cancelled);
  });

  it('already Pro: source, plan and date, no purchase buttons', () => {
    render(<Paywall {...vm({ view: 'pro', pro: { source: 'stripe_test', plan: 'yearly', sinceLabel: 'Nov 14, 2026' } })} />);
    expect(screen.getByRole('heading', { name: copy.active.title })).toBeInTheDocument();
    expect(screen.getByText(copy.active.sources.stripe_test)).toBeInTheDocument();
    expect(screen.getByText(copy.plans.names.yearly)).toBeInTheDocument();
    expect(screen.getByText('Nov 14, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.checkout.button })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: copy.promo.label })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.active.continue })).toHaveAttribute('href', '/afford');
  });

  describe('simulated checkout', () => {
    const plans = (selected: 'yearly' | 'monthly'): PaywallVM['plans'] => [
      { id: 'yearly', ...PRO_PRICES.yearly, isEstimate: true, selected: selected === 'yearly' },
      { id: 'monthly', ...PRO_PRICES.monthly, isEstimate: true, selected: selected === 'monthly' },
    ];
    const demoVm = (overrides: Partial<PaywallVM> = {}) => vm({ checkoutMode: 'demo', ...overrides });
    const payButton = (price: string) => screen.getByRole('button', { name: `Pay ${price} (demo)` });

    it('says it is simulated, shows the order and a demo card, and has no card field to type into', () => {
      const { container } = render(<Paywall {...demoVm()} />);
      expect(screen.getByText(copy.demoBadge.demo)).toBeInTheDocument();
      expect(screen.queryByText(copy.demoBadge.stripe)).not.toBeInTheDocument();

      const order = screen.getByRole('region', { name: copy.demoCheckout.title });
      expect(within(order).getByText(copy.demoCheckout.orderItem('Yearly'))).toBeInTheDocument();
      expect(within(order).getByText(copy.demoCheckout.card)).toBeInTheDocument();
      expect(within(order).getByText(copy.demoCheckout.note)).toBeInTheDocument();
      expect(payButton('$39.99')).toBeEnabled();

      expect(screen.queryByRole('button', { name: copy.checkout.button })).not.toBeInTheDocument();
      expect(screen.queryByText(copy.checkout.testCardNumber)).not.toBeInTheDocument();
      // The promo code is the only text field: no card number, expiry or CVC to type into.
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
      expect(container.querySelector('input[autocomplete^="cc-"]')).toBeNull();
      expect(screen.getByRole('button', { name: copy.promo.button })).toBeEnabled();
    });

    it('follows the selected plan', () => {
      render(<Paywall {...demoVm({ plans: plans('monthly') })} />);
      expect(screen.getByText(copy.demoCheckout.orderItem('Monthly'))).toBeInTheDocument();
      expect(payButton('$6.99')).toBeInTheDocument();
    });

    it('pays once per click', async () => {
      const user = userEvent.setup();
      const props = demoVm();
      render(<Paywall {...props} />);
      await user.click(payButton('$39.99'));
      expect(props.payDemo).toHaveBeenCalledTimes(1);
      expect(props.startCheckout).not.toHaveBeenCalled();
    });

    it('while the payment runs the button says so and every control is off', () => {
      render(<Paywall {...demoVm({ busy: 'demoCheckout' })} />);
      const button = screen.getByRole('button', { name: copy.demoCheckout.busy });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('radio', { name: /Monthly/ })).toBeDisabled();
    });

    it('a failed payment shows an alert by the button, and the button stays usable', () => {
      render(<Paywall {...demoVm({ error: { where: 'checkout', key: 'unavailable', retryAfterSeconds: null } })} />);
      expect(screen.getByRole('alert')).toHaveTextContent(copy.errors.unavailable);
      expect(payButton('$39.99')).toBeEnabled();
    });

    it('the unlocked screen names the simulated checkout and the plan', () => {
      render(<Paywall {...demoVm({ view: 'success', pro: { source: 'demo_checkout', plan: 'yearly', sinceLabel: 'Nov 14, 2026' } })} />);
      expect(screen.getByRole('heading', { name: copy.active.successTitle })).toHaveFocus();
      expect(screen.getByText(copy.active.sources.demo_checkout)).toBeInTheDocument();
      expect(screen.getByText(copy.plans.names.yearly)).toBeInTheDocument();
    });
  });

  it('just unlocked: success message gets focus', () => {
    render(<Paywall {...vm({ view: 'success', pro: { source: 'demo', plan: null, sinceLabel: 'Nov 14, 2026' } })} />);
    expect(screen.getByRole('heading', { name: copy.active.successTitle })).toHaveFocus();
    expect(screen.getByText(copy.active.sources.demo)).toBeInTheDocument();
    expect(screen.queryByText(copy.active.planLabel)).not.toBeInTheDocument();
  });
});
