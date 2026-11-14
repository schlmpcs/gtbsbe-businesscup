'use client';

import { useGuessYourself } from '@/features/ladder/model/useGuessYourself';
import { useLadderProgress } from '@/features/ladder/model/useLadderProgress';
import { GuessYourself } from '@/features/ladder/ui/GuessYourself';

// S5 Guess yourself (ladder, Y9).
export default function GuessYourselfPage() {
  return <GuessYourself vm={useGuessYourself()} progress={useLadderProgress()} />;
}
