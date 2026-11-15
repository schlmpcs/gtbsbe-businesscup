// Chapter 1: three practice rounds of "Which life costs more?". Tap the life you think costs more,
// put a number on it (the game's log slider), then the reveal: both monthly totals and their top
// categories, all from the engine (./practiceDuel). After the third round, the average error.
// Nothing is sent or scored on the server, and the daily five are untouched.
import type { DuelLetter, Money } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { GUESS_DEFAULT, GUESS_MAX, GUESS_MIN, GUESS_STEP } from '@/features/game/model/constants';
import { logSliderVM, snap } from '@/lib/model/slider';
import { practiceCard, practicePairs, practiceSummary, scorePractice, type PracticePair } from './practiceDuel';
import type { PracticeResultVM, PracticeVM } from './types';

const clamp = (v: Money) => snap(v, GUESS_MIN, GUESS_MAX, GUESS_STEP);

type State = { index: number; choice: DuelLetter | null; guess: Money; results: PracticeResultVM[]; revealed: boolean };
const START: State = { index: 0, choice: null, guess: GUESS_DEFAULT, results: [], revealed: false };

export function usePracticeDuel(opts: { pairs?: readonly PracticePair[]; onFinish?: (summary: PracticeVM['summary']) => void } = {}): PracticeVM {
  const pairs = useMemo(() => opts.pairs ?? practicePairs(), [opts.pairs]);
  const [s, setS] = useState<State>(START);
  const { onFinish } = opts;

  const pair = pairs[Math.min(s.index, pairs.length - 1)]!;
  const finished = s.index >= pairs.length;
  const summary = useMemo(() => (finished ? practiceSummary(s.results) : null), [finished, s.results]);

  const pick = useCallback((letter: DuelLetter) => setS((x) => (x.revealed ? x : { ...x, choice: letter })), []);
  const setGuess = useCallback((v: Money) => setS((x) => (x.revealed ? x : { ...x, guess: clamp(v) })), []);
  const reveal = useCallback(() => {
    setS((x) => {
      if (x.revealed || x.choice === null) return x;
      const p = pairs[x.index];
      if (!p) return x;
      return { ...x, revealed: true, results: [...x.results, scorePractice(p, x.choice, x.guess)] };
    });
  }, [pairs]);
  const next = useCallback(() => {
    if (!s.revealed) return;
    const last = s.index + 1 >= pairs.length;
    if (last) onFinish?.(practiceSummary(s.results));
    setS(last ? { ...s, index: pairs.length } : { ...START, index: s.index + 1, results: s.results });
  }, [s, pairs.length, onFinish]);
  const restart = useCallback(() => setS(START), []);

  const revealed = s.revealed && !finished;
  const phase: PracticeVM['phase'] = finished ? 'summary' : revealed ? 'revealed' : s.choice ? 'guess' : 'pick';
  const cards: PracticeVM['cards'] = [
    practiceCard(pair, 'A', { revealed, picked: s.choice === 'A' }),
    practiceCard(pair, 'B', { revealed, picked: s.choice === 'B' }),
  ];

  return {
    phase,
    round: Math.min(s.index, pairs.length - 1) + 1,
    rounds: pairs.length,
    cards,
    choice: s.choice,
    guess: logSliderVM(s.guess, GUESS_MIN, GUESS_MAX, GUESS_STEP),
    result: revealed ? (s.results[s.results.length - 1] ?? null) : null,
    summary: finished ? summary : null,
    pick,
    setGuess,
    reveal,
    next,
    restart,
  };
}
