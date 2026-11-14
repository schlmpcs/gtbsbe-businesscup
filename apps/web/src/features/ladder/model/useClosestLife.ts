// S6 "About you" + your starting life (JF2, JF3): age, take-home pay and household (adults, kids,
// bedrooms, car, ZIP) right after the guess. The starting life is built from those answers through
// the engine (lifeCardFromFacts → costOfLife → cardToProfile) for the person's own area, not picked
// from sample lives, and is preselected. When the spending came from a statement, the starting life
// is skipped: only "About you" is asked, and the statement's numbers stay.
import { costOfLife, lifeCardFromFacts } from '@lifeguessr/engine';
import { KID_AGES, type HouseholdFacts, type KidAge, type Money } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { cardsSample } from '@/fixtures/cards';
import { track } from '@/lib/events';
import { useAppReady, useAppStore, useGameStore, useProfile } from '@/state';
import { BALANCE_FIELD_BOUNDS } from './constants';
import { clampField } from './useBalanceSheet';
import { debtsChanged, startingDebts } from './useLadderProgress';
import { DEFAULT_HOUSEHOLD, isZip, OWN_LIFE_CARD_ID, ownArea, ownLifeProfile, spendingIsOwn, startingProfile } from './ownLife';
import type { AboutYouVM, ClosestLifeVM, LifeCandidateVM } from './types';

/** Most children per age band on the form. */
export const KIDS_PER_BAND_MAX = 5;

const whole = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min);

const countKids = (kids: readonly KidAge[]): Record<KidAge, number> => {
  const counts = { infant: 0, toddler: 0, preschool: 0, schoolAge: 0 } satisfies Record<KidAge, number>;
  for (const k of kids) counts[k] += 1;
  return counts;
};
const expandKids = (counts: Record<KidAge, number>): KidAge[] => KID_AGES.flatMap((k) => Array.from({ length: counts[k] }, () => k));

/** The starting life as a card on screen (cost lines largest first, each with its source). */
function candidateOf(facts: HouseholdFacts, zip: string): LifeCandidateVM | null {
  const found = ownArea(zip);
  if (!found) return null;
  const card = lifeCardFromFacts(facts, found.area);
  const cost = costOfLife(card, found.area);
  return {
    cardId: OWN_LIFE_CARD_ID,
    metro: found.area.metro,
    caption: card.caption,
    adults: card.adults,
    kids: [...card.kids],
    bedrooms: card.bedrooms,
    carPrice: null,
    monthly: { ...cost.total },
    items: cost.items
      .map((i, n) => ({ id: `${i.category}-${n}`, category: i.category, amount: i.amount, source: i.source, isEstimate: i.isEstimate }))
      .sort((a, b) => b.amount - a.amount),
    fromToday: false,
    isNearest: true,
    available: true,
  };
}

export function useClosestLife(): ClosestLifeVM {
  const ready = useAppReady();
  const profile = useProfile();
  const selfGuess = useAppStore((s) => s.selfGuess);
  const chosenCardId = useAppStore((s) => s.closestCardId);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const chooseClosestLife = useAppStore((s) => s.chooseClosestLife);
  const setHousehold = useAppStore((s) => s.setHousehold);
  const setField = useAppStore((s) => s.setField);
  const reveals = useGameStore((s) => s.reveals);

  // The saved answers, else the defaults. The demo profile's ZIP is not the person's: only a ZIP saved
  // with their answers is shown. `zipDraft` holds what is typed until it is a valid ZIP.
  const facts = profile.householdFacts ?? DEFAULT_HOUSEHOLD;
  const savedZip = profile.householdFacts ? (profile.zip ?? '') : '';
  const [zipDraft, setZipDraft] = useState<string | null>(null);
  const zip = zipDraft ?? savedZip;

  const save = useCallback(
    (next: HouseholdFacts, nextZip: string) => {
      setHousehold(next, isZip(nextZip) ? nextZip : null);
      // Once the person started from their own life, it follows their answers (until the spending is theirs).
      const s = useAppStore.getState();
      const area = ownArea(nextZip);
      if (s.closestCardId !== OWN_LIFE_CARD_ID || !area || spendingIsOwn(s.profile, s.statementMonths, null)) return;
      s.chooseClosestLife(OWN_LIFE_CARD_ID, ownLifeProfile(s.profile, next, nextZip, area.area, true, null));
    },
    [setHousehold],
  );

  const spendingFromStatement = statementMonths.length > 0;
  const candidate = useMemo(() => (spendingFromStatement ? null : candidateOf(facts, zip)), [spendingFromStatement, facts, zip]);

  const found = useMemo(() => ownArea(zip), [zip]);
  const about: AboutYouVM = {
    age: { ...profile.age, bounds: BALANCE_FIELD_BOUNDS.age },
    takeHomePay: { ...profile.takeHomePay, bounds: BALANCE_FIELD_BOUNDS.takeHomePay },
    adults: facts.adults,
    kids: countKids(facts.kids),
    kidsPerBandMax: KIDS_PER_BAND_MAX,
    bedrooms: facts.bedrooms,
    hasCar: facts.hasCar,
    zip,
    zipStatus: zip.trim() === '' ? 'empty' : !isZip(zip) ? 'invalid' : found === null ? 'none' : found.exact ? 'exact' : 'nearby',
    areaZip: found?.area.zip ?? null,
  };

  const edit = (patch: Partial<HouseholdFacts>) => save({ ...facts, ...patch }, zip);

  const choose = useCallback(() => {
    const found = ownArea(zip);
    if (!found || spendingFromStatement) return;
    // The person's own debts and events stay (they built this life before, or changed the starting debts);
    // a sample life's debts don't.
    const cards = [...Object.values(reveals).map((r) => r.card), ...cardsSample];
    const keepOwn = chosenCardId === OWN_LIFE_CARD_ID || debtsChanged(startingDebts(chosenCardId, cards), profile.debts);
    chooseClosestLife(OWN_LIFE_CARD_ID, ownLifeProfile(profile, facts, zip, found.area, keepOwn, startingProfile(chosenCardId)));
    track({ name: 'closest_life_chosen', props: { fromToday: false } }, { once: 'closest_life_chosen' });
  }, [zip, spendingFromStatement, reveals, chosenCardId, profile, facts, chooseClosestLife]);

  return {
    status: ready ? 'ready' : 'loading',
    selfGuess,
    about,
    setAge: (age: number) => {
      const v = clampField('age', age);
      if (v !== null) setField('age', v);
    },
    setTakeHomePay: (pay: Money) => {
      const v = clampField('takeHomePay', pay);
      if (v !== null) setField('takeHomePay', v);
    },
    setAdults: (n: number) => edit({ adults: whole(n, 1, 2) as 1 | 2 }),
    setKidCount: (age: KidAge, n: number) =>
      edit({ kids: expandKids({ ...countKids(facts.kids), [age]: whole(n, 0, KIDS_PER_BAND_MAX) }) }),
    setBedrooms: (n: number) => edit({ bedrooms: whole(n, 0, 4) as HouseholdFacts['bedrooms'] }),
    setHasCar: (hasCar: boolean) => edit({ hasCar }),
    setZip: (next: string) => {
      const clean = next.replace(/\D/g, '').slice(0, 5);
      setZipDraft(clean);
      save(facts, clean);
    },
    candidate,
    spendingFromStatement,
    chosenCardId,
    choose,
  };
}
