// S2 Explore the home, S3 Reveal, S4 Streamer mode: one hook for /play (S3 and S4 are its states).
// Client components only (it reads localStorage-backed stores and timers).

import { CLUE_IDS, type ClueId, type Money } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usEasternDate } from '@/lib/dates';
import { toVMError } from '@/lib/model/errors';
import { logScale, logSliderVM, snap } from '@/lib/model/slider';
import type { VMError } from '@/lib/model/types';
import { useAppReady, useGameStore } from '@/state';
import { createGameClient, type GameClient } from './client';
import { GUESS_DEFAULT, GUESS_MAX, GUESS_MIN, GUESS_STEP, STREAMER_COUNTDOWN_SECONDS } from './constants';
import { buildReveal, buildSummary, clueMultiplier } from './derive';
import type { ClueVM, ExploreCardVM, PlayVM, StreamerVM } from './types';

export type UsePlayOptions = {
  /** S4: big type, countdown, answer hidden until the guess is locked in (`/play?stream=1`). */
  streamer?: boolean;
  /** Data source override (tests). Default: NEXT_PUBLIC_GAME_SOURCE. */
  client?: GameClient;
  /** Streamer countdown length in seconds. */
  countdownSeconds?: number;
};

const guessScale = logScale(GUESS_MIN, GUESS_MAX);
const clampGuess = (v: Money) => snap(v, GUESS_MIN, GUESS_MAX, GUESS_STEP);

export function usePlay(opts: UsePlayOptions = {}): PlayVM {
  const ready = useAppReady();
  const defaultClient = useMemo(() => createGameClient(), []);
  const client = opts.client ?? defaultClient;
  const streamerOn = opts.streamer ?? false;
  const countdownTotal = opts.countdownSeconds ?? STREAMER_COUNTDOWN_SECONDS;

  const date = useGameStore((s) => s.date);
  const cards = useGameStore((s) => s.cards);
  const storedIndex = useGameStore((s) => s.index);
  const guesses = useGameStore((s) => s.guesses);
  const clues = useGameStore((s) => s.clues);
  const reveals = useGameStore((s) => s.reveals);

  // Outcome of the latest daily() call, tagged with the attempt it belongs to (set only async).
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; error: VMError | null } | null>(null);
  const [opening, setOpening] = useState<Record<string, true>>({});
  const [clueErrors, setClueErrors] = useState<Record<string, VMError>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [guessErrors, setGuessErrors] = useState<Record<string, VMError>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load today's set once the saved progress is known. A saved set for today is reused, but the
  // source is still asked so the fixture log / server session is in place for clues and guesses.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const today = usEasternDate();
    client.daily(today).then(
      (set) => {
        if (cancelled) return;
        useGameStore.getState().startDay(set.date, set.cards);
        setLoaded({ attempt, error: null });
      },
      (err: unknown) => {
        if (!cancelled) setLoaded({ attempt, error: toVMError(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ready, client, attempt]);

  const total = cards.length;
  const index = Math.min(storedIndex, total);
  const current = index < total ? cards[index]! : null;
  const currentReveal = current ? reveals[current.id] : undefined;
  const guessedCount = cards.filter((c) => reveals[c.id]).length;
  const allGuessed = total > 0 && guessedCount === total;
  const phase: PlayVM['phase'] = current === null && allGuessed ? 'summary' : currentReveal ? 'reveal' : 'explore';

  const guessValue = current ? (guesses[current.id] ?? GUESS_DEFAULT) : GUESS_DEFAULT;

  // ----- actions -----

  const openClue = useCallback(
    (clue: ClueId) => {
      if (!current) return;
      const key = `${current.id}:${clue}`;
      const already = (useGameStore.getState().clues[current.id] ?? []).some((c) => c.clue === clue);
      if (already || opening[key] || useGameStore.getState().reveals[current.id]) return;
      setOpening((o) => ({ ...o, [key]: true }));
      setClueErrors(({ [key]: _drop, ...rest }) => rest);
      client.clue(current.id, clue).then(
        (reveal) => useGameStore.getState().addClue(reveal),
        (err: unknown) => {
          if (mounted.current) setClueErrors((e) => ({ ...e, [key]: toVMError(err) }));
        },
      ).finally(() => {
        if (mounted.current) setOpening(({ [key]: _done, ...rest }) => rest);
      });
    },
    [client, current, opening],
  );

  const setGuess = useCallback(
    (value: Money) => {
      if (current && !useGameStore.getState().reveals[current.id]) useGameStore.getState().setGuess(current.id, clampGuess(value));
    },
    [current],
  );
  const setGuessPosition = useCallback((position: number) => setGuess(guessScale.fromPosition(position)), [setGuess]);

  const submitGuess = useCallback(() => {
    if (!current || submitting) return;
    const state = useGameStore.getState();
    if (state.reveals[current.id]) return;
    const value = state.guesses[current.id] ?? GUESS_DEFAULT;
    if (state.guesses[current.id] === undefined) state.setGuess(current.id, value);
    setSubmitting(current.id);
    setGuessErrors(({ [current.id]: _drop, ...rest }) => rest);
    client.guess(current.id, value).then(
      (reveal) => useGameStore.getState().setReveal(current.id, reveal),
      (err: unknown) => {
        if (mounted.current) setGuessErrors((e) => ({ ...e, [current.id]: toVMError(err) }));
      },
    ).finally(() => {
      if (mounted.current) setSubmitting(null);
    });
  }, [client, current, submitting]);

  const next = useCallback(() => {
    const s = useGameStore.getState();
    const card = s.cards[s.index];
    if (card && s.reveals[card.id]) s.setIndex(s.index + 1); // only past a guessed card
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  // ----- streamer countdown -----

  // The countdown belongs to one card: another card (or none) means a fresh, stopped countdown.
  const currentId = current?.id ?? null;
  const [timer, setTimer] = useState<{ cardId: string | null; deadline: number | null; secondsLeft: number }>({
    cardId: null, deadline: null, secondsLeft: countdownTotal,
  });
  const countdown = timer.cardId === currentId ? timer : { cardId: currentId, deadline: null, secondsLeft: countdownTotal };
  const submitRef = useRef(submitGuess);
  useEffect(() => {
    submitRef.current = submitGuess;
  });

  useEffect(() => {
    const { deadline, cardId } = countdown;
    if (deadline === null) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimer({ cardId, deadline: left === 0 ? null : deadline, secondsLeft: left });
      if (left === 0) submitRef.current(); // time's up: lock in the current guess
    }, 250);
    return () => clearInterval(id);
  }, [countdown.deadline, countdown.cardId]); // eslint-disable-line react-hooks/exhaustive-deps -- countdown is rebuilt each render

  const locked = current !== null && (submitting === current.id || currentReveal !== undefined);
  const startCountdown = useCallback(() => {
    if (!locked && countdown.deadline === null && countdown.secondsLeft > 0) {
      setTimer({ cardId: currentId, deadline: Date.now() + countdown.secondsLeft * 1000, secondsLeft: countdown.secondsLeft });
    }
  }, [locked, countdown.deadline, countdown.secondsLeft, currentId]);
  const stopCountdown = useCallback(() => {
    setTimer((t) => (t.cardId === currentId ? { ...t, deadline: null } : t));
  }, [currentId]);
  const resetCountdown = useCallback(() => {
    setTimer({ cardId: currentId, deadline: null, secondsLeft: countdownTotal });
  }, [currentId, countdownTotal]);

  // ----- view-model -----

  const card: ExploreCardVM | null = useMemo(() => {
    if (!current) return null;
    const opened = clues[current.id] ?? [];
    const clueVMs: ClueVM[] = CLUE_IDS.map((id) => {
      const key = `${current.id}:${id}`;
      const reveal = opened.find((c) => c.clue === id) ?? null;
      const error = clueErrors[key] ?? null;
      const status = reveal ? 'open' : opening[key] ? 'opening' : error ? 'error' : 'closed';
      return { id, status, reveal, error };
    });
    return {
      id: current.id,
      metro: current.metro,
      layout: current.layout,
      caption: current.caption,
      decor: current.decor,
      clues: clueVMs,
      openedCount: opened.length,
      multiplier: clueMultiplier(opened.length),
      nextMultiplier: clueMultiplier(opened.length + 1),
      guess: logSliderVM(guessValue, GUESS_MIN, GUESS_MAX, GUESS_STEP),
      submitting: submitting === current.id,
      guessError: guessErrors[current.id] ?? null,
      guessed: currentReveal !== undefined,
    };
  }, [current, clues, clueErrors, opening, guessValue, submitting, guessErrors, currentReveal]);

  const reveal = useMemo(
    () => (current && currentReveal ? buildReveal(currentReveal, guesses[current.id] ?? guessValue, client.source, index === total - 1) : null),
    [current, currentReveal, guesses, guessValue, client.source, index, total],
  );

  const summary = useMemo(
    () => (phase === 'summary' ? buildSummary(date, cards, reveals, guesses, client.source) : null),
    [phase, date, cards, reveals, guesses, client.source],
  );

  const streamer: StreamerVM | null = streamerOn
    ? {
        countdown: { total: countdownTotal, secondsLeft: countdown.secondsLeft, running: countdown.deadline !== null },
        startCountdown,
        stopCountdown,
        resetCountdown,
        locked,
        lockIn: submitGuess,
      }
    : null;

  const latest = loaded?.attempt === attempt ? loaded : null;
  const haveCards = total > 0 && (date === usEasternDate() || (latest !== null && latest.error === null));
  const status: PlayVM['status'] = !ready ? 'loading' : haveCards ? 'ready' : latest?.error ? 'error' : 'loading';
  return {
    status,
    error: status === 'error' ? (latest?.error ?? null) : null,
    retry,
    source: client.source,
    date,
    phase,
    progress: { index, total, guessed: guessedCount },
    card: status === 'ready' && phase !== 'summary' ? card : null,
    reveal: status === 'ready' ? reveal : null,
    summary: status === 'ready' ? summary : null,
    streamer,
    openClue,
    setGuess,
    setGuessPosition,
    submitGuess,
    next,
  };
}
