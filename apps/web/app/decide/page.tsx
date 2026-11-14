'use client';

// S13 Decision, car example (T11 mock): the view-model (demo profile + engine) feeds the screen.
import { useDecide } from '@/features/mocks/model/useMocks';
import { DecideScreen } from '@/features/mocks/ui/DecideScreen';

export default function DecidePage() {
  return <DecideScreen vm={useDecide()} />;
}
