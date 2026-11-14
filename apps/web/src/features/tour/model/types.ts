// View-model types for the 2-minute tour. ui/ may import only this file, @/ui-kit/** and @/copy.

export type TourStepId = 'play' | 'sample' | 'upload' | 'afford' | 'loan' | 'pro';

/** One stop of the tour: copy comes from `id`, `href` is a real route. */
export type TourStepVM = { id: TourStepId; href: string };

export type TourVM = {
  steps: TourStepVM[];
  /**
   * The promo code the server accepts for Pro (shown on the Pro screen on purpose, for the jury), or
   * null while the Pro status loads or when the promo is switched off.
   */
  promoCode: string | null;
};

/** Whether the tour sheet is open (the header and S1 both open it). */
export type TourOpenVM = { open: boolean; show: () => void; close: () => void };
