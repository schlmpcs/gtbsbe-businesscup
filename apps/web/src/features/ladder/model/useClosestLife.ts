// S6 Closest life: start the profile from one of today's homes (or a sample life if the game
// wasn't played), preselecting the one whose cost is nearest the user's own guess.
import { cardToProfile, costOfLife } from '@lifeguessr/engine';
import type { CostBreakdown, LifeCard } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { cardsSample } from '@/fixtures';
import { areaForZip } from '@/lib/areas';
import { useAppReady, useAppStore, useGameStore } from '@/state';
import type { ClosestLifeVM, LifeCandidateVM } from './types';

type Source = { card: LifeCard; cost: CostBreakdown | null; fromToday: boolean };

export function useClosestLife(): ClosestLifeVM {
  const ready = useAppReady();
  const selfGuess = useAppStore((s) => s.selfGuess);
  const chosenCardId = useAppStore((s) => s.closestCardId);
  const chooseClosestLife = useAppStore((s) => s.chooseClosestLife);
  const cards = useGameStore((s) => s.cards);
  const reveals = useGameStore((s) => s.reveals);

  const sources: Source[] = useMemo(() => {
    const played = cards.map((c) => reveals[c.id]).filter((r) => r !== undefined);
    if (played.length > 0) return played.map((r) => ({ card: r.card, cost: r.cost, fromToday: true }));
    return cardsSample.map((card) => ({ card, cost: null, fromToday: false }));
  }, [cards, reveals]);

  const candidates = useMemo(() => {
    const list = sources.map(({ card, cost, fromToday }): LifeCandidateVM => {
      const area = areaForZip(card.zip);
      const breakdown = cost ?? (area ? costOfLife(card, area) : null);
      return {
        cardId: card.id,
        metro: card.metro,
        caption: card.caption,
        adults: card.adults,
        kids: [...card.kids],
        bedrooms: card.bedrooms,
        carPrice: card.car?.price ?? null,
        monthly: breakdown ? { ...breakdown.total } : { low: Number.NaN, mid: Number.NaN, high: Number.NaN },
        fromToday,
        isNearest: false,
        available: area !== null && breakdown !== null,
      };
    });
    if (selfGuess === null) return list;
    // Nearest in ratio terms (log distance), like the game's scoring.
    const distance = (c: LifeCandidateVM) => (c.available ? Math.abs(Math.log(c.monthly.mid / selfGuess)) : Number.POSITIVE_INFINITY);
    const sorted = [...list].sort((a, b) => distance(a) - distance(b));
    if (sorted[0]?.available) sorted[0] = { ...sorted[0], isNearest: true };
    return sorted;
  }, [sources, selfGuess]);

  const choose = useCallback(
    (cardId: string) => {
      const source = sources.find((s) => s.card.id === cardId);
      const area = source ? areaForZip(source.card.zip) : null;
      if (!source || !area) return;
      chooseClosestLife(cardId, cardToProfile(source.card, area));
    },
    [sources, chooseClosestLife],
  );

  return {
    status: ready ? 'ready' : 'loading',
    selfGuess,
    candidates,
    nearestCardId: candidates.find((c) => c.isNearest)?.cardId ?? null,
    chosenCardId,
    choose,
  };
}
