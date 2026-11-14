// TwoFuturesHero: the What if? presets played one after another on the SAMPLE life (profileDemo),
// for a hero on S1. Same engine path as /what-if (compareFutures, rules forecast); the comparisons
// are computed once per page load. Not wired into a page yet.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { profileDemo } from '@/fixtures';
import type { TwoFuturesHeroVM } from './types';
import { PRESETS, chartVM, choiceVM, compare, presetSides, resultVM } from './whatIfVm';

/** Seconds per preset; the brief asks for about four. */
export const HERO_INTERVAL_MS = 4_000;

type Slide = Omit<TwoFuturesHeroVM, 'index' | 'count' | 'select' | 'href'>;

let slides: Slide[] | null = null;

/** Every preset compared on the sample life (cached: the inputs are fixtures). */
export function heroSlides(thisYear: number): Slide[] {
  if (slides) return slides;
  slides = PRESETS.map((preset) => {
    const sides = presetSides(preset, profileDemo);
    const cmp = compare(profileDemo, sides.A.scenario, sides.B.scenario, null);
    return {
      presetId: preset.id,
      A: choiceVM('A', sides.A, profileDemo, cmp.A),
      B: choiceVM('B', sides.B, profileDemo, cmp.B),
      chart: chartVM(cmp, sides.A.scenario, sides.B.scenario, null),
      result: resultVM(cmp, thisYear),
    };
  });
  return slides;
}

export function useTwoFuturesHero(opts: { intervalMs?: number; autoplay?: boolean } = {}): TwoFuturesHeroVM {
  const { intervalMs = HERO_INTERVAL_MS, autoplay = true } = opts;
  const all = useMemo(() => heroSlides(new Date().getFullYear()), []);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!autoplay || paused || all.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % all.length), intervalMs);
    return () => clearInterval(id);
  }, [all.length, autoplay, intervalMs, paused]);

  const select = useCallback((i: number) => {
    setIndex(((i % all.length) + all.length) % all.length);
    setPaused(true); // the viewer took over: stop cycling
  }, [all.length]);

  return { ...all[index]!, index, count: all.length, select, href: '/what-if' };
}
