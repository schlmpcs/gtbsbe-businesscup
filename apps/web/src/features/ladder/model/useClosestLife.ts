// S6 "About you" + your starting life (JF2, JF3): age, take-home pay and household (adults, kids,
// bedrooms, car, ZIP) right after the guess. The starting life is built from those answers through
// the engine (lifeCardFromFacts → costOfLife → cardToProfile) for the person's own area, not picked
// from sample lives, and is preselected. When the spending came from a statement, the starting life
// is skipped: only "About you" is asked, and the statement's numbers stay.
import { costOfLife, lifeCardFromFacts } from '@lifeguessr/engine';
import { KID_AGES, type HouseholdFacts, type KidAge, type Money, type Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { cardsSample } from '@/fixtures/cards';
import { track } from '@/lib/events';
import { useAppReady, useAppStore, useGameStore, useProfile } from '@/state';
import { BALANCE_FIELD_BOUNDS } from './constants';
import { clampField } from './useBalanceSheet';
import { debtsChanged, startingDebts } from './useLadderProgress';
import {
  DEFAULT_HOUSEHOLD, isZip, OWN_LIFE_CARD_ID, ownArea, ownLifeProfile, spendingIsOwn, startingProfile, typed,
} from './ownLife';
import type { AboutYouNumberVM, AboutYouVM, ClosestLifeVM, DifferentiatorVM, LifeCandidateVM } from './types';

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

/** Most children per age band on the form. */
export const KIDS_PER_BAND_MAX = 5;

const whole = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min);

const countKids = (kids: readonly KidAge[]): Record<KidAge, number> => {
  const counts = { infant: 0, toddler: 0, preschool: 0, schoolAge: 0 } satisfies Record<KidAge, number>;
  for (const k of kids) counts[k] += 1;
  return counts;
};
const expandKids = (counts: Record<KidAge, number>): KidAge[] => KID_AGES.flatMap((k) => Array.from({ length: counts[k] }, () => k));

type AboutNumber = 'age' | 'takeHomePay';
type Touched = Record<AboutNumber, boolean>;

/**
 * An age or pay box: the person's value (typed, or the statement's pay), else empty with our typical
 * value as its placeholder. `touched`: typed on this screen just now, even when it equals the sample
 * family's value (which `typed` alone can't tell from an inherited one).
 */
export function aboutNumber(profile: Profile, field: AboutNumber, start: Profile | null, touched: boolean): AboutYouNumberVM {
  const own = touched || typed(profile[field], start?.[field]);
  return { value: own ? profile[field].value : null, estimate: profile[field].value, isEstimate: !own, bounds: BALANCE_FIELD_BOUNDS[field] };
}

/** The starting profile with the fields typed on this screen counted as the person's (see `aboutNumber`). */
function startWithTouched(start: Profile | null, touched: Touched): Profile | null {
  if (!start) return null;
  const out = { ...start };
  for (const f of ['age', 'takeHomePay'] as const) if (touched[f]) out[f] = { ...start[f], isEstimate: true };
  return out;
}

/** The starting life as a card on screen (cost lines largest first, each with its source). */
function candidateOf(facts: HouseholdFacts, zip: string): LifeCandidateVM | null {
  const found = ownArea(zip);
  if (!found) return null;
  const card = lifeCardFromFacts(facts, found.area);
  const cost = costOfLife(card, found.area);
  const life: LifeCandidateVM = {
    cardId: OWN_LIFE_CARD_ID,
    metro: found.area.metro,
    caption: card.caption,
    adults: card.adults,
    kids: [...card.kids],
    bedrooms: card.bedrooms,
    // A car here has no loan: price 0 means "has a car" (insurance + fuel), null means no car.
    carPrice: facts.hasCar ? 0 : null,
    monthly: { ...cost.total },
    items: cost.items
      .map((i, n) => ({ id: `${i.category}-${n}`, category: i.category, amount: i.amount, source: i.source, isEstimate: i.isEstimate }))
      .sort((a, b) => b.amount - a.amount),
    fromToday: false,
    isNearest: true,
    differentiators: [],
    available: true,
  };
  life.differentiators = differentiatorsFor([life])[0]!;
  return life;
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
  const [touched, setTouched] = useState<Touched>({ age: false, takeHomePay: false });
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
    age: aboutNumber(profile, 'age', startingProfile(chosenCardId), touched.age),
    takeHomePay: aboutNumber(profile, 'takeHomePay', startingProfile(chosenCardId), touched.takeHomePay),
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
    const start = startWithTouched(startingProfile(chosenCardId), touched);
    chooseClosestLife(OWN_LIFE_CARD_ID, ownLifeProfile(profile, facts, zip, found.area, keepOwn, start));
    track({ name: 'closest_life_chosen', props: { fromToday: false } }, { once: 'closest_life_chosen' });
  }, [zip, spendingFromStatement, reveals, chosenCardId, profile, facts, chooseClosestLife, touched]);

  return {
    status: ready ? 'ready' : 'loading',
    selfGuess,
    about,
    setAge: (age: number) => {
      const v = clampField('age', age);
      if (v === null) return;
      setField('age', v);
      setTouched((t) => (t.age ? t : { ...t, age: true }));
    },
    setTakeHomePay: (pay: Money) => {
      const v = clampField('takeHomePay', pay);
      if (v === null) return;
      setField('takeHomePay', v);
      setTouched((t) => (t.takeHomePay ? t : { ...t, takeHomePay: true }));
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
    selectedCardId: candidate?.cardId ?? null,
    choose,
  };
}
