'use client';

import { useStart } from '@/features/start/model/useStart';
import { StartScreen } from '@/features/start/ui/StartScreen';

// /start: onboarding without typing. A statement (generated from public data, a ready-made life's,
// or the user's own CSV) → read in the browser → the guess and the measured month → the plan.
export default function StartPage() {
  return <StartScreen vm={useStart()} />;
}
