// The 2-minute tour for judges: a sheet with numbered stops, each a real route. The sheet's open
// state is shared so both the site header and S1 can open it.
import { create } from 'zustand';
import { SCREEN_ROUTES } from '@/lib/screens';
import { usePro } from '@/state';
import type { TourOpenVM, TourStepVM, TourVM } from './types';

/** The stops, in order. Every href is a built screen (no /preview routes). */
export const TOUR_STEPS: readonly TourStepVM[] = [
  { id: 'play', href: SCREEN_ROUTES.S2 },
  { id: 'sample', href: `${SCREEN_ROUTES.S10}?sample=1` },
  { id: 'whatIf', href: '/what-if' },
  { id: 'upload', href: SCREEN_ROUTES.S9 },
  { id: 'afford', href: SCREEN_ROUTES.S11 },
  { id: 'loan', href: SCREEN_ROUTES.S12 },
  { id: 'pro', href: SCREEN_ROUTES.S15 },
];

export const useTourStore = create<TourOpenVM>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));

/** Open state of the tour sheet. */
export function useTourOpen(): TourOpenVM {
  return useTourStore();
}

/**
 * The tour's content. Call it only while the sheet is open: it asks the server for the Pro status
 * (the promo code comes from there, so the tour never shows a code the server would refuse).
 */
export function useTour(): TourVM {
  const pro = usePro();
  const promoCode = (pro.demo.enabled && pro.demo.code) || null;
  return { steps: [...TOUR_STEPS], promoCode };
}
