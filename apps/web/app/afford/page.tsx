'use client';

// S11 Can I Afford It? (Y11): the view-model hook feeds the presentational screen.
import { useAfford } from '@/features/afford/model/useAfford';
import { AffordScreen } from '@/features/afford/ui/AffordScreen';

export default function AffordPage() {
  return <AffordScreen vm={useAfford()} />;
}
