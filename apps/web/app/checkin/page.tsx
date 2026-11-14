'use client';

// S14 Monthly check-in (T11 mock): the view-model (fixtures + engine) feeds the screen.
import { useCheckin } from '@/features/mocks/model/useMocks';
import { CheckinScreen } from '@/features/mocks/ui/CheckinScreen';

export default function CheckinPage() {
  return <CheckinScreen vm={useCheckin()} />;
}
