'use client';

import { useLadderProgress } from '@/features/ladder/model/useLadderProgress';
import { useQuickSliders } from '@/features/ladder/model/useQuickSliders';
import { QuickSliders } from '@/features/ladder/ui/QuickSliders';

// S7 Quick sliders (ladder, Y9).
export default function QuickSlidersPage() {
  return <QuickSliders vm={useQuickSliders()} progress={useLadderProgress()} />;
}
