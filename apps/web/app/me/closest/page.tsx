'use client';

import { useClosestLife } from '@/features/ladder/model/useClosestLife';
import { useLadderProgress } from '@/features/ladder/model/useLadderProgress';
import { ClosestLife } from '@/features/ladder/ui/ClosestLife';

// S6 Closest life (ladder, Y9).
export default function ClosestLifePage() {
  return <ClosestLife vm={useClosestLife()} progress={useLadderProgress()} />;
}
