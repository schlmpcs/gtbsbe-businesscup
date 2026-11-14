// @vitest-environment jsdom
// The 2-minute tour: real routes only, the promo code from the server's Pro status, and the sheet.
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tour as t } from '@/copy';
import { SCREEN_ROUTES } from '@/lib/screens';
import { resetClientState } from '@/test/clientState';
import { fakeProAdapter, resetProState, statusInfo } from '@/test/pro';
import { TOUR_STEPS, useTour, useTourStore } from './model/useTour';
import { TourSheet, TourSteps } from './ui/TourSheet';

beforeEach(() => {
  resetClientState();
  resetProState();
  useTourStore.setState({ open: false });
});

function A({ href, children, onClick, ...rest }: { href: string; children?: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

describe('tour model', () => {
  it('links every stop to a built screen, never a /preview route', () => {
    const routes = new Set<string>([...Object.values(SCREEN_ROUTES), '/what-if']);
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['play', 'sample', 'whatIf', 'upload', 'afford', 'loan', 'pro']);
    for (const step of TOUR_STEPS) {
      expect(routes.has(step.href.split('?')[0]!)).toBe(true);
      expect(step.href).not.toMatch(/preview/);
    }
    expect(TOUR_STEPS.find((s) => s.id === 'sample')?.href).toBe('/future?sample=1');
  });

  it('shows the promo code the server accepts, and none when the promo is off', async () => {
    resetProState(fakeProAdapter(statusInfo(undefined, { demo: { enabled: true, code: 'JURY-DEMO' } })));
    const on = renderHook(useTour);
    await waitFor(() => expect(on.result.current.promoCode).toBe('JURY-DEMO'));
    on.unmount();

    resetProState(fakeProAdapter(statusInfo(undefined, { demo: { enabled: false } })));
    const off = renderHook(useTour);
    await act(async () => {});
    expect(off.result.current.promoCode).toBeNull();
  });

  it('opens and closes through the shared store', () => {
    act(() => useTourStore.getState().show());
    expect(useTourStore.getState().open).toBe(true);
    act(() => useTourStore.getState().close());
    expect(useTourStore.getState().open).toBe(false);
  });
});

describe('TourSheet', () => {
  it('lists numbered stops with links, the promo code and the honest preview line; following a link closes it', async () => {
    const onClose = vi.fn();
    render(
      <TourSheet open onClose={onClose}>
        <TourSteps vm={{ steps: [...TOUR_STEPS], promoCode: 'JURY-DEMO' }} Link={A} onFollow={onClose} />
      </TourSheet>,
    );
    const list = screen.getByRole('list', { name: t.stepsLabel });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(within(items[0]!).getByRole('link', { name: t.steps.play.title })).toHaveAttribute('href', '/play');
    expect(within(items[6]!).getByRole('link', { name: t.steps.pro.title })).toHaveAttribute('href', '/pro');
    expect(screen.getByTestId('tour-promo')).toHaveTextContent(t.steps.pro.code('JURY-DEMO'));
    expect(screen.getByText(t.preview)).toBeInTheDocument();
    await userEvent.setup().click(within(items[1]!).getByRole('link'));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides the code line when there is no code', () => {
    render(
      <TourSheet open onClose={() => {}}>
        <TourSteps vm={{ steps: [...TOUR_STEPS], promoCode: null }} Link={A} onFollow={() => {}} />
      </TourSheet>,
    );
    expect(screen.queryByTestId('tour-promo')).not.toBeInTheDocument();
  });
});
