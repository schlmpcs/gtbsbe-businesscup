// "Your own numbers" rules shared by S5, S6, /future and /afford (JF1–JF3): whose spending the
// profile holds, the life built from the person's own "About you" answers, and the mixed-profile
// warning (typed pay next to a sample family's spending). Pure functions; the engine does the math.
import { cardToProfile, lifeCardFromFacts, OWN_LIFE_CARD_ID, scaleSpendingTo } from '@lifeguessr/engine';
import { areaData } from '@lifeguessr/data/areas';
import {
  COST_CATEGORIES, type AreaData, type CategoryTotals, type Estimate, type HouseholdFacts, type Money, type Profile,
} from '@lifeguessr/types';
import { profileDemo } from '@/fixtures';
import { areaForZip } from '@/lib/areas';

export { OWN_LIFE_CARD_ID };

/** Where "About you" starts before the person answers: one adult, a 1-bedroom, a car, no kids. */
export const DEFAULT_HOUSEHOLD: HouseholdFacts = { adults: 1, kids: [], bedrooms: 1, hasCar: true };

const SPENDING = COST_CATEGORIES.filter((c) => c !== 'debtPayments');

/** A five-digit ZIP. */
export const isZip = (zip: string): boolean => /^\d{5}$/.test(zip);

/**
 * The area data for a typed ZIP: that ZIP's own (`exact`), else a ZIP we cover with the same first three
 * digits (the same local postal area, `exact: false`, said on screen), else null.
 */
export function ownArea(zip: string): { area: AreaData; exact: boolean } | null {
  if (!isZip(zip)) return null;
  const exact = areaForZip(zip);
  if (exact) return { area: exact, exact: true };
  const near = areaData.find((a) => a.zip.slice(0, 3) === zip.slice(0, 3));
  return near ? { area: near, exact: false } : null;
}

/**
 * The profile the current one started from, for telling typed values from inherited ones: the demo
 * profile while no life was picked (its values are measured, but they are the sample family's, not
 * the person's), else null (a picked or built life starts with every value an estimate).
 */
export function startingProfile(closestCardId: string | null): Profile | null {
  return closestCardId === null ? profileDemo : null;
}

/** A value the person gave: measured, and not just the starting profile's own measured value. */
const typed = (e: Estimate<number>, base: Estimate<number> | undefined): boolean =>
  !e.isEstimate && (!base || base.isEstimate || e.value !== base.value);

/** The spending is the person's own: a statement was imported, or at least one category was typed. */
export function spendingIsOwn(profile: Profile, statementMonths: readonly CategoryTotals[], base: Profile | null): boolean {
  return statementMonths.length > 0 || SPENDING.some((c) => typed(profile.spending[c], base?.spending[c]));
}

/** The take-home pay is the person's own (typed, or detected from their statement). */
export function payIsOwn(profile: Profile, base: Profile | null): boolean {
  return typed(profile.takeHomePay, base?.takeHomePay);
}

/** What a month costs: every spending category (not the informational debtPayments) + minimum debt payments. */
export function monthlyCost(profile: Profile): Money {
  return SPENDING.reduce((sum, c) => sum + profile.spending[c].value, 0) + profile.debts.reduce((sum, d) => sum + d.minPayment.value, 0);
}

/**
 * The starting life built from "About you" (engine lifeCardFromFacts → cardToProfile), keeping every
 * scalar the person typed (age, pay, cash, retirement, savings share; judged against `start`, the
 * profile they started from, so the demo family's measured values don't pass as theirs) and, with
 * `keepOwn`, their debts and life events. `zip` is the typed ZIP (the area may be a nearby one).
 */
export function ownLifeProfile(
  current: Profile, facts: HouseholdFacts, zip: string, area: AreaData, keepOwn: boolean, start: Profile | null,
): Profile {
  const built = cardToProfile(lifeCardFromFacts(facts, area), area);
  const keep = <K extends 'age' | 'takeHomePay' | 'cash' | 'retirement' | 'retirementShare'>(k: K): Profile[K] =>
    typed(current[k], start?.[k]) ? current[k] : built[k];
  const profile: Profile = {
    ...built,
    age: keep('age'),
    takeHomePay: keep('takeHomePay'),
    cash: keep('cash'),
    retirement: keep('retirement'),
    retirementShare: keep('retirementShare'),
    debts: keepOwn ? current.debts : built.debts,
    householdFacts: { ...facts, kids: [...facts.kids] },
    zip,
  };
  if (keepOwn && current.events) profile.events = current.events;
  return profile;
}

/**
 * The mixed-profile warning: the pay is the person's own but the spending is still a sample life's
 * (the demo family or a picked sample card), so a forecast would mix the two. Not shown once the
 * spending is theirs (statement or typed), built from their own household, or already scaled to their guess.
 */
export function mixedProfileWarning(s: {
  profile: Profile;
  selfGuess: Money | null;
  closestCardId: string | null;
  statementMonths: readonly CategoryTotals[];
}): { guess: Money | null } | null {
  const base = startingProfile(s.closestCardId);
  if (!payIsOwn(s.profile, base)) return null;
  if (spendingIsOwn(s.profile, s.statementMonths, base)) return null;
  if (s.closestCardId === OWN_LIFE_CARD_ID) return null;
  if (s.selfGuess !== null && Math.abs(monthlyCost(s.profile) - s.selfGuess) < 1) return null;
  return { guess: s.selfGuess };
}

/** The sample spending scaled (engine scaleSpendingTo) so the month costs the guess: spending + minimum payments = guess. */
export function spendingScaledToGuess(profile: Profile, guess: Money): Profile {
  const debtPayments = profile.debts.reduce((sum, d) => sum + d.minPayment.value, 0);
  return { ...profile, spending: scaleSpendingTo(profile.spending, guess - debtPayments) };
}
