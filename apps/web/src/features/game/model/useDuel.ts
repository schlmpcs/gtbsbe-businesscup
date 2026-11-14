// S2 Duel round, S3 Reveal, S3 Day result: one hook for the duel ("Which life costs more?").
// Client components only (localStorage, timers). The source (./duelClient) holds the answers and
// the picks; this hook keeps which round is on screen (localStorage, per day) and builds the VM.
import { DUEL_ROUND_COUNT } from '@lifeguessr/engine';
import { DUEL_ROUNDS, type DuelLetter, type DuelRound } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usEasternDate } from '@/lib/dates';
import { track, useTrackOnce } from '@/lib/events';
import { toVMError } from '@/lib/model/errors';
import type { VMError } from '@/lib/model/types';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import { createDuelClient, type DuelClient, type DuelDay, type DuelProgress } from './duelClient';
import { buildDuelCards, buildDuelDots, buildDuelHint, buildDuelReveal, buildDuelSummary } from './duelDerive';
import { shareOrCopy, type ShareOutcome } from './share';
import type { DuelCopyStatus, DuelShareStatus, DuelVM } from './types';

/** Which round is on screen, per day (the picks themselves live with the source). */
export const DUEL_VIEW_KEY = 'lifeguessr.duelView';

export type UseDuelOptions = {
  /** Data source override (tests). Default: NEXT_PUBLIC_GAME_SOURCE. */
  client?: DuelClient;
  /** Opened from a friend's challenge link (/duel?c=…). */
  challenged?: boolean;
  /** Clock override (tests). */
  now?: () => Date;
  /** Share implementation override (tests). Default: Web Share API, else clipboard. */
  share?: (text: string) => Promise<ShareOutcome>;
  /** Clipboard override (tests). Resolves true when the text was copied. */
  copy?: (text: string) => Promise<boolean>;
  /** Origin for the challenge link (tests). Default: window.location.origin. */
  origin?: string;
};

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const firstOpenIndex = (picks: DuelProgress['picks']) => {
  const i = DUEL_ROUNDS.findIndex((r) => !picks[r]);
  return i === -1 ? DUEL_ROUND_COUNT : i;
};

function readViewIndex(date: string): number | null {
  try {
    const saved = JSON.parse(readStorage(DUEL_VIEW_KEY) ?? 'null') as { date?: unknown; index?: unknown } | null;
    return saved && saved.date === date && typeof saved.index === 'number' ? saved.index : null;
  } catch {
    return null;
  }
}

export function useDuel(opts: UseDuelOptions = {}): DuelVM {
  const defaultClient = useMemo(() => createDuelClient(), []);
  const client = opts.client ?? defaultClient;
  const nowFn = opts.now;
  const clock = useCallback(() => (nowFn ? nowFn() : new Date()), [nowFn]);

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; day: DuelDay | null; error: VMError | null } | null>(null);
  const [progress, setProgress] = useState<DuelProgress>({ picks: {}, hints: {} });
  const [index, setIndexState] = useState(0);
  const [picking, setPicking] = useState<DuelLetter | null>(null);
  const [pickError, setPickError] = useState<VMError | null>(null);
  const [hintStatus, setHintStatus] = useState<'idle' | 'opening' | 'error'>('idle');
  const [copyStatus, setCopyStatus] = useState<DuelCopyStatus>('idle');
  const [shareStatus, setShareStatus] = useState<DuelShareStatus>('idle');
  const [now, setNow] = useState<Date | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load today's five (and what this player already did today).
  useEffect(() => {
    let cancelled = false;
    client.daily(usEasternDate(clock())).then(
      (day) => {
        if (cancelled) return;
        const open = firstOpenIndex(day.progress.picks);
        const saved = readViewIndex(day.date);
        setProgress(day.progress);
        setIndexState(saved === null ? open : Math.max(0, Math.min(saved, open)));
        setLoaded({ attempt, day, error: null });
      },
      (err: unknown) => {
        if (!cancelled) setLoaded({ attempt, day: null, error: toVMError(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, attempt, clock]);

  const latest = loaded?.attempt === attempt ? loaded : null;
  const day = latest?.day ?? null;
  const status: DuelVM['status'] = day ? 'ready' : latest?.error ? 'error' : 'loading';
  const date = day?.date ?? null;

  const total = day?.duels.length ?? DUEL_ROUND_COUNT;
  const allPicked = day !== null && day.duels.every((d) => progress.picks[d.round]);
  const viewIndex = Math.min(index, total);
  const duel = day && viewIndex < total ? day.duels[viewIndex]! : null;
  const round: DuelRound | null = duel?.round ?? null;
  const currentPick = round ? progress.picks[round] : undefined;
  const phase: DuelVM['phase'] = duel === null && allPicked ? 'summary' : currentPick ? 'reveal' : 'round';

  const setIndex = useCallback(
    (next: number) => {
      setIndexState(next);
      if (date) writeStorage(DUEL_VIEW_KEY, JSON.stringify({ date, index: next }));
    },
    [date],
  );

  // ----- actions -----

  const pick = useCallback(
    (letter: DuelLetter) => {
      if (!day || !round || picking || progress.picks[round]) return;
      setPicking(letter);
      setPickError(null);
      client.pick(round, letter, day.date).then(
        (result) => {
          const picks = { ...progress.picks, [round]: { choice: letter, result } };
          track({ name: 'duel_picked', props: { round, correct: result.correct } }, { once: `duel_pick:${day.date}:${round}` });
          if (day.duels.every((d) => picks[d.round])) {
            track({ name: 'game_finished', props: { homes: day.duels.length } }, { once: `duel_finished:${day.date}` });
          }
          if (!mounted.current) return;
          setProgress((p) => ({ ...p, picks: { ...p.picks, [round]: { choice: letter, result } } }));
          setIndex(viewIndex); // a reload shows this reveal, not the next round
        },
        (err: unknown) => {
          if (mounted.current) setPickError(toVMError(err));
        },
      ).finally(() => {
        if (mounted.current) setPicking(null);
      });
    },
    [client, day, round, picking, progress.picks, viewIndex, setIndex],
  );

  const openHint = useCallback(() => {
    if (!day || !round || hintStatus === 'opening' || progress.hints[round] || progress.picks[round] || picking) return;
    setHintStatus('opening');
    client.hint(round, day.date).then(
      (hint) => {
        if (!mounted.current) return;
        setProgress((p) => ({ ...p, hints: { ...p.hints, [round]: hint } }));
        setHintStatus('idle');
        track({ name: 'hint_opened', props: { round } }, { once: `duel_hint:${day.date}:${round}` });
      },
      () => {
        if (mounted.current) setHintStatus('error');
      },
    );
  }, [client, day, round, hintStatus, progress.hints, progress.picks, picking]);

  const next = useCallback(() => {
    if (round && progress.picks[round]) {
      setIndex(viewIndex + 1);
      setHintStatus('idle');
      setPickError(null);
    }
  }, [round, progress.picks, viewIndex, setIndex]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  // ----- day result: countdown to the next five -----

  useEffect(() => {
    if (phase !== 'summary') return;
    const id = setInterval(() => setNow(clock()), 30_000);
    return () => clearInterval(id);
  }, [phase, clock]);

  const origin = opts.origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  const summary = useMemo(
    () => (phase === 'summary' && date ? buildDuelSummary(date, progress.picks, origin, now ?? clock()) : null),
    [phase, date, progress.picks, origin, now, clock],
  );

  const copyImpl = opts.copy ?? copyToClipboard;
  const challengeUrl = summary?.challengeUrl ?? null;
  const copyChallenge = useCallback(() => {
    if (!challengeUrl) return;
    copyImpl(challengeUrl).then(
      (ok) => {
        if (ok) track({ name: 'challenge_copied' }, { once: `duel_challenge:${date}` });
        if (mounted.current) setCopyStatus(ok ? 'copied' : 'failed');
      },
      () => {
        if (mounted.current) setCopyStatus('failed');
      },
    );
  }, [challengeUrl, copyImpl, date]);

  const shareImpl = opts.share ?? shareOrCopy;
  const shareText = summary?.shareText ?? null;
  const share = useCallback(() => {
    if (!shareText || shareStatus === 'sharing') return;
    setShareStatus('sharing');
    shareImpl(shareText).then(
      (outcome) => {
        if (outcome === 'shared' || outcome === 'copied') track({ name: 'result_shared', props: { via: outcome === 'shared' ? 'share' : 'copy' } });
        if (mounted.current) setShareStatus(outcome === 'cancelled' ? 'idle' : outcome);
      },
      () => {
        if (mounted.current) setShareStatus('failed');
      },
    );
  }, [shareImpl, shareText, shareStatus]);


  // ----- view-model -----

  const cards = useMemo(
    () => (duel ? buildDuelCards(duel, currentPick, progress.hints[duel.round], picking) : null),
    [duel, currentPick, progress.hints, picking],
  );
  const reveal = useMemo(() => (round && currentPick ? buildDuelReveal(round, currentPick) : null), [round, currentPick]);
  const hint = round && !currentPick ? buildDuelHint(Boolean(progress.hints[round]), hintStatus) : null;

  useTrackOnce(status === 'ready' && phase !== 'summary', `duel_play_started:${date}`, { name: 'play_started' });

  return {
    status,
    error: status === 'error' ? (latest?.error ?? null) : null,
    retry,
    source: client.source,
    date,
    phase,
    round,
    totalRounds: total,
    dots: status === 'ready' ? buildDuelDots(progress.picks, round) : [],
    cards: status === 'ready' ? cards : null,
    hint: status === 'ready' ? hint : null,
    pickError,
    reveal: status === 'ready' ? reveal : null,
    summary: status === 'ready' ? summary : null,
    challenged: opts.challenged ?? false,
    pick,
    openHint,
    next,
    guessOwn: () => track({ name: 'own_guess_started' }, { once: `duel_own_guess:${date}` }),
    copyChallenge,
    copyStatus,
    share,
    shareStatus,
  };
}
