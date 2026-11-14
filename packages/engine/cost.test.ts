// Y1: costOfLife + cardToProfile. Expected numbers are worked out by hand from the fixtures
// (areaData.sample.json, cards.sample.json) and the assumptions they use:
//   estimateSpread 0.15, monthlyGallons 45, kidGroceryFactor 0.7, weeksPerMonth 4.33, avgMealPrice $18;
//   Closest Life: subscriptions $90, other $350/adult + $150/kid, pay = outflow / 0.9, cash = 2 × outflow.
import { describe, expect, it } from 'vitest';
import { areaByZip } from '@lifeguessr/data/fixtures';
import { cardById, cardsSample } from '@lifeguessr/data/fixtures/cards';
import { COST_CATEGORIES, ProfileSchema, type AreaData, type CostBreakdown, type LifeCard } from '@lifeguessr/types';
import {
  ageDefault, assumptionSource, avgMealPrice, cardSpendingShareOfTakeHome, cashBufferMonthsDefault,
  estimateSpread, kidGroceryFactor, lifeCardLoanSource, monthlyGallons, otherPerAdultMonthly,
  otherPerKidMonthly, retirementBalanceDefault, subscriptionsMonthlyDefault, weeksPerMonth,
} from './assumptions';
import { cardToProfile, costOfLife } from './cost';

const GROCERIES = 367.95; // USDA moderate plan, per adult, all fixture ZIPs
const FUEL = 3.408 * 45; // EIA TX gas × monthlyGallons = 153.36
const INSURANCE = 150; // TX average, isEstimate in the fixtures

const sumBy = (cost: CostBreakdown, category: string) =>
  cost.items.filter((i) => i.category === category).reduce((s, i) => s + i.amount, 0);

const sample = (id: string) => {
  const card = cardById(id);
  return { card, area: areaByZip(card.zip) };
};

/** A fixture card with a few fields changed (the fixtures are frozen). */
const variant = (id: string, patch: Partial<LifeCard>): LifeCard => ({ ...cardById(id), ...patch });

describe('assumptions used by these hand-checked numbers', () => {
  it('match the values the expected numbers were worked out with', () => {
    expect(estimateSpread.value).toBe(0.15);
    expect(monthlyGallons.value).toBe(45);
    expect(kidGroceryFactor.value).toBe(0.7);
    expect(weeksPerMonth.value).toBe(4.33);
    expect(avgMealPrice.value).toBe(18);
    expect(subscriptionsMonthlyDefault.value).toBe(90);
    expect(otherPerAdultMonthly.value).toBe(350);
    expect(otherPerKidMonthly.value).toBe(150);
    expect(cardSpendingShareOfTakeHome.value).toBe(0.9);
    expect(cashBufferMonthsDefault.value).toBe(2);
  });
});

describe('costOfLife', () => {
  it('sample-01: single, no car, 1 bedroom in 75216', () => {
    const { card, area } = sample('sample-01-single-nocar-cheap');
    const cost = costOfLife(card, area);
    // rent 1100 (±15%: no rentRangeRatio) + groceries 367.95 (sourced) + eating out 1 × 4.33 × 18 = 77.94 (±15%)
    expect(cost.total.mid).toBeCloseTo(1545.89, 9);
    expect(cost.total.low).toBeCloseTo(935 + 367.95 + 66.249, 9); // 1369.199
    expect(cost.total.high).toBeCloseTo(1265 + 367.95 + 89.631, 9); // 1722.581
    expect(cost.items.map((i) => i.category)).toEqual(['rentUtilities', 'groceries', 'eatingOut']);
    expect(sumBy(cost, 'car')).toBe(0);
    expect(sumBy(cost, 'childcare')).toBe(0);
  });

  it('sample-03: couple + toddler, used car on a loan, 2 bedrooms in 75216', () => {
    const { card, area } = sample('sample-03-couple-toddler');
    const cost = costOfLife(card, area);
    // car loan: $16,000 at 8.9% for 60 months → 331.3577 (fixed: the card's own terms)
    expect(sumBy(cost, 'car')).toBeCloseTo(331.3576915 + INSURANCE + FUEL, 6);
    expect(sumBy(cost, 'rentUtilities')).toBe(1300); // HUD FMR is gross rent: no utilities added
    expect(sumBy(cost, 'childcare')).toBe(780); // one toddler
    expect(sumBy(cost, 'groceries')).toBeCloseTo(2 * GROCERIES + 0.7 * GROCERIES, 9); // 735.9 + 257.565
    expect(sumBy(cost, 'eatingOut')).toBeCloseTo(2 * 4.33 * 18, 9); // 155.88

    // mid 3864.0627; spread: rent ±15%, insurance/fuel/kid groceries/eating out ±15%, the rest fixed.
    expect(cost.total.mid).toBeCloseTo(3864.0626915, 6);
    expect(cost.total.low).toBeCloseTo(3561.5419415, 6);
    expect(cost.total.high).toBeCloseTo(4166.5834415, 6);
  });

  it('sample-04: family of four, new SUV, 3 bedrooms in suburban 75024', () => {
    const { card, area } = sample('sample-04-family-schoolage-carloan');
    const cost = costOfLife(card, area);
    // car loan: $34,000 at 6.9% for 72 months → 578.0350
    expect(sumBy(cost, 'car')).toBeCloseTo(578.0349718 + INSURANCE + FUEL, 6);
    expect(sumBy(cost, 'rentUtilities')).toBe(3030);
    expect(sumBy(cost, 'childcare')).toBe(2 * 702); // Collin County school-age rate, two kids
    expect(sumBy(cost, 'groceries')).toBeCloseTo(2 * GROCERIES + 2 * 0.7 * GROCERIES, 9); // 735.9 + 515.13
    expect(sumBy(cost, 'eatingOut')).toBeCloseTo(3 * 4.33 * 18, 9); // 233.82
    expect(cost.total.mid).toBeCloseTo(6800.2449718, 6);
    expect(cost.total.low).toBeCloseTo(6187.8984718, 6);
    expect(cost.total.high).toBeCloseTo(7412.5914718, 6);
  });

  it('car loan payment checked by hand: $28,000 financed at 6.9% for 36 months = $863.28', () => {
    const card = variant('sample-05-single-luxury-car', {
      car: { price: 30_000, downPayment: 2_000, apr: 0.069, termMonths: 36 },
    });
    const loan = costOfLife(card, areaByZip(card.zip)).items.find((i) => i.source === lifeCardLoanSource);
    expect(loan?.amount).toBeCloseTo(863.28, 2); // 863.279…, ENGINEERING.md → Loan amortization
    expect(loan?.isEstimate).toBe(false);
  });

  it('a 0% APR car loan is price / term; a car paid in cash has no loan line', () => {
    const zeroApr = variant('sample-05-single-luxury-car', {
      car: { price: 12_000, downPayment: 0, apr: 0, termMonths: 48 },
    });
    expect(sumBy(costOfLife(zeroApr, areaByZip(zeroApr.zip)), 'car')).toBeCloseTo(250 + INSURANCE + FUEL, 9);

    const cash = variant('sample-05-single-luxury-car', {
      car: { price: 9_000, downPayment: 9_000, apr: 0.07, termMonths: 36 },
    });
    const cost = costOfLife(cash, areaByZip(cash.zip));
    expect(cost.items.filter((i) => i.category === 'car')).toHaveLength(2); // insurance + fuel
    expect(sumBy(cost, 'car')).toBeCloseTo(INSURANCE + FUEL, 9);
  });

  it('uses rentRangeRatio on the card’s own bedroom FMR when present', () => {
    const { card, area } = sample('sample-01-single-nocar-cheap');
    const withRatio: AreaData = {
      ...area,
      rentRangeRatio: { low: 0.8, high: 1.25, source: { name: 'ACS B25063 test ratio', year: 2024 } },
    };
    const cost = costOfLife(card, withRatio);
    expect(cost.total.mid).toBeCloseTo(1545.89, 9);
    expect(cost.total.low).toBeCloseTo(1100 * 0.8 + 367.95 + 66.249, 9); // 1314.199
    expect(cost.total.high).toBeCloseTo(1100 * 1.25 + 367.95 + 89.631, 9); // 1832.581
  });

  it('clamps the range so low ≤ mid ≤ high even with an odd rent ratio', () => {
    const { card, area } = sample('sample-01-single-nocar-cheap');
    const odd: AreaData = {
      ...area,
      rentRangeRatio: { low: 1.3, high: 0.7, source: { name: 'malformed ratio', year: 2024 } },
    };
    const { total } = costOfLife(card, odd);
    expect(total.low).toBeLessThanOrEqual(total.mid);
    expect(total.mid).toBeLessThanOrEqual(total.high);
  });

  it('low ≤ mid ≤ high and mid = Σ items for every fixture card', () => {
    for (const card of cardsSample) {
      const { total, items } = costOfLife(card, areaByZip(card.zip));
      expect(total.low, card.id).toBeLessThanOrEqual(total.mid);
      expect(total.mid, card.id).toBeLessThanOrEqual(total.high);
      expect(total.low, card.id).toBeLessThan(total.high); // rent always carries a range
      expect(total.mid, card.id).toBeCloseTo(items.reduce((s, i) => s + i.amount, 0), 9);
    }
  });

  it('every item carries a source and an honest isEstimate', () => {
    const { card, area } = sample('sample-03-couple-toddler');
    for (const item of costOfLife(card, area).items) {
      expect(item.source.name.length).toBeGreaterThan(0);
      expect(item.source.year).toBeGreaterThan(1900);
      expect(item.amount).toBeGreaterThan(0);
    }
    const expected: [string, number, boolean][] = [
      ['rentUtilities', 1300, false], // HUD SAFMR
      ['car', 331.3576915, false], // the card's own loan terms
      ['car', 150, true], // insurance: isEstimate in the area data
      ['car', 153.36, true], // fuel: EIA price × assumed gallons
      ['childcare', 780, false], // DOL NDCP
      ['groceries', 735.9, false], // USDA, adults
      ['groceries', 257.565, true], // kids: × assumed kidGroceryFactor
      ['eatingOut', 155.88, true], // assumed avgMealPrice
    ];
    const items = costOfLife(card, area).items;
    expect(items.map((i) => [i.category, i.isEstimate])).toEqual(expected.map(([c, , e]) => [c, e]));
    items.forEach((item, k) => expect(item.amount, item.category).toBeCloseTo(expected[k]![1], 6));
    const eatingOut = costOfLife(card, area).items.find((i) => i.category === 'eatingOut');
    expect(eatingOut?.source).toEqual(assumptionSource);
  });

  it('throws when a card has kids but the area has no childcare prices', () => {
    const { card, area } = sample('sample-03-couple-toddler');
    const { childcareMonthly: _omit, ...noChildcare } = area;
    expect(() => costOfLife(card, noChildcare)).toThrow(/childcareMonthly/);
  });

  it('is deterministic and does not mutate its inputs (fixtures are frozen)', () => {
    const { card, area } = sample('sample-06-family-infant-preschool');
    expect(costOfLife(card, area)).toEqual(costOfLife(card, area));
  });
});

describe('cardToProfile (Closest Life)', () => {
  it('sample-03: items → spending, car loan → auto debt, defaults from named assumptions', () => {
    const { card, area } = sample('sample-03-couple-toddler');
    const p = cardToProfile(card, area);
    expect(p.spending.rentUtilities.value).toBe(1300);
    expect(p.spending.car.value).toBeCloseTo(INSURANCE + FUEL, 9); // 303.36: no loan payment
    expect(p.spending.childcare.value).toBe(780);
    expect(p.spending.groceries.value).toBeCloseTo(993.465, 9);
    expect(p.spending.eatingOut.value).toBeCloseTo(155.88, 9);
    expect(p.spending.subscriptions.value).toBe(90);
    expect(p.spending.other.value).toBe(2 * 350 + 150); // 850
    expect(p.spending.debtPayments.value).toBe(0); // informational only; payments live in debts

    expect(p.debts).toHaveLength(1);
    const auto = p.debts[0]!;
    expect(auto.kind).toBe('auto');
    expect(auto.balance).toBe(16_000);
    expect(auto.apr).toBe(0.089);
    expect(auto.minPayment.value).toBeCloseTo(331.3576915, 6);

    // outflow = spending 4472.705 + loan 331.3577 = 4804.0627
    expect(p.takeHomePay.value).toBeCloseTo(4804.0626915 / 0.9, 6); // 5337.8474
    expect(p.cash.value).toBeCloseTo(4804.0626915 * 2, 6); // 9608.1254
    expect(p.age.value).toBe(ageDefault.value);
    expect(p.retirement.value).toBe(retirementBalanceDefault.value);
    expect(p.retirementShare.value).toBe(0);
    expect(p.zip).toBe('75216');
    expect(p.doneMoveIds).toEqual([]);
  });

  it('spending + loan payment equals the card cost, plus the defaulted subscriptions and other', () => {
    for (const card of cardsSample) {
      const area = areaByZip(card.zip);
      const p = cardToProfile(card, area);
      const spending = COST_CATEGORIES.reduce((s, c) => s + p.spending[c].value, 0);
      const loanPayments = p.debts.reduce((s, d) => s + d.minPayment.value, 0);
      const defaults = 90 + 350 * card.adults + 150 * card.kids.length;
      expect(spending + loanPayments, card.id).toBeCloseTo(costOfLife(card, area).total.mid + defaults, 6);
    }
  });

  it('marks every field as an estimate and passes the Profile schema, for every fixture card', () => {
    for (const card of cardsSample) {
      const p = cardToProfile(card, areaByZip(card.zip));
      expect(() => ProfileSchema.parse(p), card.id).not.toThrow();
      const fields = [p.age, p.takeHomePay, p.cash, p.retirement, p.retirementShare, ...Object.values(p.spending)];
      expect(fields.every((f) => f.isEstimate), card.id).toBe(true);
      expect(Object.keys(p.spending).sort()).toEqual([...COST_CATEGORIES].sort());
      expect(p.debts.every((d) => d.minPayment.isEstimate), card.id).toBe(true);
      expect(p.debts.length, card.id).toBe(card.car ? 1 : 0);
    }
  });

  it('a card without a car loan has no debts and no car spending', () => {
    const { card, area } = sample('sample-02-single-nocar-mid');
    const p = cardToProfile(card, area);
    expect(p.debts).toEqual([]);
    expect(p.spending.car.value).toBe(0);
    expect(p.spending.childcare.value).toBe(0);
    // studio 1840 + groceries 367.95 + eating out 5 × 4.33 × 18 = 389.7, + subscriptions 90 + other 350
    expect(p.takeHomePay.value).toBeCloseTo((1840 + 367.95 + 389.7 + 90 + 350) / 0.9, 9);
  });
});
