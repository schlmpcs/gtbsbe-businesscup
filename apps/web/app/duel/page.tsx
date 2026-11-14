'use client';

// /duel: today's five "Which life costs more?" duels. `?c={resultId}` = opened from a friend's
// challenge link: the screen reads their score (GET /api/daily/challenge, or this browser's own day
// on fixtures) and sets it against yours.
import { use } from 'react';
import { DuelView } from './DuelView';

export default function DuelPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  const { c } = use(searchParams);
  return <DuelView challengeId={typeof c === 'string' ? c : undefined} />;
}
