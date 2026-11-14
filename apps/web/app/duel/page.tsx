'use client';

// /duel: today's five "Which life costs more?" duels. `?c={resultId}` = opened from a friend's
// challenge link (fixture mode can't look up their score yet; the server route will).
import { use } from 'react';
import { DuelView } from './DuelView';

export default function DuelPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  const { c } = use(searchParams);
  return <DuelView challenged={typeof c === 'string' && c.length > 0} />;
}
