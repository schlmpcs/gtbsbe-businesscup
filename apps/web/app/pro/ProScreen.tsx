'use client';

import { usePaywall, type CheckoutReturnParams } from '@/features/pro/model/usePaywall';
import { Paywall } from '@/features/pro/ui/Paywall';

/** S15: view-model → presentational paywall. */
export function ProScreen({ checkoutReturn }: { checkoutReturn?: CheckoutReturnParams }) {
  return <Paywall {...usePaywall({ checkoutReturn })} />;
}
