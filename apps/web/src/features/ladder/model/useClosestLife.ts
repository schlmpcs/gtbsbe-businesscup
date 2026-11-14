// S6 Closest life: start the profile from one of today's homes (or a sample life if the game
// wasn't played), preselecting the one whose cost is nearest the user's own guess.
import { cardToProfile, costOfLife } from '@lifeguessr/engine';
import type { CostBreakdown, LifeCard } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { cardsSample } from '@/fixtures/cards';
import { areaForZip } from '@/lib/areas';
import { track } from '@/lib/events';
import { useAppReady, useAppStore, useGameStore } from '@/state';
import type { ClosestLifeVM, DifferentiatorVM, LifeCandidateVM } from './types';

/** Rent differs by at least this share from same-size cards before we call the area pricier/cheaper. */
const AREA_GAP = 0.1;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length === 0 ? 0 : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const sumOf = (c: Pick<LifeCandidateVM, 'items'>, category: LifeCandidateVM['items'][number]['category']) =>
  c.items.filter((i) => i.category === category).reduce((t, i) => t + i.amount, 0);

/**
 * 1–2 chips per card that explain its price next to the others: the car (or no car), childcare, and
 * the neighborhood tier (rent vs. the median of cards with the same bedrooms). Largest gap first;
 * every amount is one of the card's own cost lines.
 */
export function differentiatorsFor(
  list: readonly Pick<LifeCandidateVM, 'available' | 'bedrooms' | 'carPrice' | 'items'>[],
): DifferentiatorVM[][] {
  const live = list.filter((c) => c.available);
  const carMedian = median(live.map((c) => sumOf(c, 'car')));
  return list.map((c) => {
    if (!c.available) return [];
    const car = sumOf(c, 'car');
    const carChip: [DifferentiatorVM, number] =
      c.carPrice === null || car === 0 ? [{ kind: 'noCar' }, carMedian] : [{ kind: 'car', amount: car }, Math.abs(car - carMedian)];
    const chips: [DifferentiatorVM, number][] = [carChip];
    const childcare = sumOf(c, 'childcare');
    if (childcare > 0) chips.push([{ kind: 'childcare', amount: childcare }, childcare]);
    const peers = live.filter((o) => o.bedrooms === c.bedrooms);
    if (peers.length >= 2) {
      const rent = sumOf(c, 'rentUtilities');
      const m = median(peers.map((o) => sumOf(o, 'rentUtilities')));
      if (m > 0 && Math.abs(rent - m) >= AREA_GAP * m) {
        chips.push([{ kind: rent > m ? 'pricierArea' : 'cheaperArea', amount: rent }, Math.abs(rent - m)]);
      }
    }
    const ranked = chips.filter(([, gap]) => gap > 0).sort((a, b) => b[1] - a[1]).map(([d]) => d);
    return (ranked.length > 0 ? ranked : [carChip[0]]).slice(0, 2);
  });
}

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
        items: breakdown
          ? breakdown.items
              .map((i, n) => ({
                id: `${i.category}-${n}`,
                category: i.category,
                amount: i.amount,
                source: i.source,
                isEstimate: i.isEstimate,
              }))
              .sort((a, b) => b.amount - a.amount)
          : [],
        fromToday,
        isNearest: false,
        differentiators: [],
        available: area !== null && breakdown !== null,
      };
    });
    const chips = differentiatorsFor(list);
    list.forEach((c, i) => (c.differentiators = chips[i]!));
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
      track({ name: 'closest_life_chosen', props: { fromToday: source.fromToday } }, { once: 'closest_life_chosen' });
    },
    [sources, chooseClosestLife],
  );

  const nearestCardId = candidates.find((c) => c.isNearest)?.cardId ?? null;
  return {
    status: ready ? 'ready' : 'loading',
    selfGuess,
    candidates,
    nearestCardId,
    chosenCardId,
    selectedCardId:
      (candidates.some((c) => c.cardId === chosenCardId && c.available) ? chosenCardId : null) ??
      nearestCardId ?? candidates.find((c) => c.available)?.cardId ?? null,
    choose,
  };
}
