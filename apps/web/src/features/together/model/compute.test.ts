import { cardAprDefault, cardMinPaymentFor, combineProfiles, forecast, profileOfPartner } from '@lifeguessr/engine';
import { TogetherPartnerSchema, type TogetherPartner, type TogetherPlan } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, togetherPartnerSample } from '@/fixtures';
import { profilePartner, quickPartner, togetherResult } from './compute';
import { EMPTY_QUICK } from './usePartnerForm';

const p2 = (): TogetherPartner => structuredClone(togetherPartnerSample) as TogetherPartner;
const plan = (goal: TogetherPlan['goal'] = null): TogetherPlan & { partner2: TogetherPartner } => ({
  id: 'AAAAAAAAAAAAAAAAAAAAAA',
  partner1: profilePartner(cloneProfileDemo(), 'Jo'),
  partner2: p2(),
  goal,
  createdAt: '2026-11-14T12:00:00.000Z',
  expiresAt: '2026-12-14T12:00:00.000Z',
});

describe('quickPartner', () => {
  it('turns the quick inputs into a valid partner: typed values are not estimates, blanks are 0', () => {
    const partner = quickPartner({ ...EMPTY_QUICK, takeHomePay: 4000, rentUtilities: 1200, groceries: 300 }, ' Kai ');
    expect(TogetherPartnerSchema.parse(partner)).toEqual(partner);
    expect(partner.nickname).toBe('Kai');
    expect(partner.takeHomePay).toEqual({ value: 4000, isEstimate: false });
    expect(partner.spending.rentUtilities).toEqual({ value: 1200, isEstimate: false });
    expect(partner.spending.childcare.value).toBe(0);
    expect(partner.debts).toEqual([]);
    expect(quickPartner(EMPTY_QUICK, '')).not.toHaveProperty('nickname');
  });

  it('a debt with no APR or payment uses the sourced card APR and the card minimum, tagged as estimates', () => {
    const partner = quickPartner({ ...EMPTY_QUICK, takeHomePay: 4000, debtBalance: 5000 }, '');
    expect(partner.debts).toEqual([
      {
        id: 'd1', kind: 'card', balance: 5000, apr: cardAprDefault.value,
        minPayment: { value: cardMinPaymentFor(5000, cardAprDefault.value), isEstimate: true },
      },
    ]);
    const typed = quickPartner({ ...EMPTY_QUICK, takeHomePay: 4000, debtBalance: 5000, debtApr: 0.1, debtPayment: 300 }, '');
    expect(typed.debts[0]).toMatchObject({ apr: 0.1, minPayment: { value: 300, isEstimate: false } });
  });
});

describe('togetherResult', () => {
  it('splits shared bills by income and shows the household month from the engine', () => {
    const r = togetherResult(plan());
    // Jo 5,200 and Sam 3,800 take-home; shared: rent 1,950 + 1,100, groceries 520 + 380.
    expect(r.split.total).toBe(3950);
    expect(r.split.p1).toBeCloseTo(3950 * (5200 / 9000), 6);
    expect(r.split.p2).toBeCloseTo(3950 * (3800 / 9000), 6);
    expect(r.split.evenEach).toBe(1975);
    expect(r.split.basis).toBe('income');
    expect(r.month.takeHome).toBe(9000);
    expect(r.partners.map((p) => p.label)).toEqual(['Jo', 'Sam']);
    expect(r.future.source).toBe('rules');
    expect(r.split.modes.income).toEqual({ p1: r.split.p1, p2: r.split.p2, p1Share: r.split.p1Share });
    expect(r.split.modes.even).toEqual({ p1: 1975, p2: 1975, p1Share: 0.5 });
  });

  it('"Us in 10 years" is the rules forecast of the combined profile, in today\'s dollars', () => {
    const p = plan();
    const combined = combineProfiles(profileOfPartner(p.partner1), profileOfPartner(p.partner2));
    expect(togetherResult(p).future.mid).toBeCloseTo(forecast(combined, 10, { todaysDollars: true }).in10y.mid, 6);
    const points = togetherResult(p).future.points;
    expect(points.map((pt) => pt.month)).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]);
    expect(points[10]!.mid).toBeCloseTo(togetherResult(p).future.mid, 6);
    expect(points[0]!.mid).toBeCloseTo(togetherResult(p).future.today, 6);
    expect(togetherResult(p).future.today).toBeCloseTo(3800 + 5200 + 14500 + 9000 - 6400 - 17800 - 21000, 6);
  });

  it('gives the shared goal a verdict, and none without a goal', () => {
    expect(togetherResult(plan()).goal).toBeNull();
    const g = togetherResult(plan({ target: 1, years: 5 })).goal;
    expect(g).toMatchObject({ target: 1, years: 5, verdict: 'onTrack' });
  });
});
