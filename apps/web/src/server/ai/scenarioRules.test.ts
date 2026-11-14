import { takeHomeFromGrossRaise } from '@lifeguessr/engine';
import { describe, expect, it } from 'vitest';
import { parseScenarioRules, resolvePlace } from './scenarioRules';

const ok = (text: string, homeZip?: string) => {
  const r = parseScenarioRules(text, homeZip);
  if (!r.ok) throw new Error(`${text}: ${JSON.stringify(r)}`);
  return r.value;
};

describe('parseScenarioRules: the common What if… phrasings', () => {
  it('a baby, now or later', () => {
    expect(ok('we have a baby next year')).toEqual({ kind: 'kid', age: 'infant', inMonths: 12 });
    expect(ok('What if we have a baby now?')).toEqual({ kind: 'kid', age: 'infant' });
    expect(ok('a baby in two years')).toEqual({ kind: 'kid', age: 'infant', inMonths: 24 });
    expect(ok('we adopt a toddler in 6 months')).toEqual({ kind: 'kid', age: 'toddler', inMonths: 6 });
    expect(parseScenarioRules('we have a baby').ok && parseScenarioRules('we have a baby')).toMatchObject({ inferred: ['inMonths'] });
  });

  it('a move to a metro we have: its mid-priced ZIP; a tier of the home metro; an unknown city is incomplete', () => {
    expect(ok('I move to Austin')).toEqual({ kind: 'move', zip: '78704' });
    expect(ok('what if we moved to Chicago next year')).toEqual({ kind: 'move', zip: '60618' });
    expect(ok('move to NYC')).toEqual({ kind: 'move', zip: '11385' });
    expect(ok('we move to downtown Austin')).toEqual({ kind: 'move', zip: '78703' });
    expect(ok('we move to the suburbs', '75206')).toEqual({ kind: 'move', zip: '75024' });
    expect(ok('move to 98103')).toEqual({ kind: 'move', zip: '98103' });
    expect(parseScenarioRules('I move to Boise')).toEqual({ ok: false, code: 'incomplete', missing: ['move.zip'] });
    expect(parseScenarioRules('we move to the suburbs')).toEqual({ ok: false, code: 'incomplete', missing: ['move.zip'] });
  });

  it('a raise: yearly before tax goes through the engine; monthly is take-home as stated', () => {
    expect(ok('I get a $10k raise')).toEqual({ kind: 'income', monthlyDelta: takeHomeFromGrossRaise(10_000), grossYearly: 10_000 });
    expect(ok('I earn $500 more a month')).toEqual({ kind: 'income', monthlyDelta: 500 });
    expect(ok('a $6,000 pay cut')).toEqual({ kind: 'income', monthlyDelta: takeHomeFromGrossRaise(-6_000), grossYearly: -6_000 });
  });

  it('a car on a loan, with the rate as a decimal and the term in months', () => {
    expect(ok('I buy a $35k car on a 60-month loan at 6.9%')).toEqual({
      kind: 'purchase', category: 'car',
      purchase: { label: 'Car', amount: 35_000, recurring: false, payWith: { loan: { amount: 35_000, apr: 0.069, termMonths: 60 } } },
    });
    const v = ok('buy a used truck for $22,000 at 8.9% for 5 years with $2k down');
    expect(v).toMatchObject({
      kind: 'purchase', category: 'car',
      purchase: { amount: 22_000, payWith: { loan: { amount: 22_000, apr: 0.089, termMonths: 60, downPayment: 2_000 } } },
    });
    expect(parseScenarioRules('I buy a $35k car on a loan')).toEqual({
      ok: false, code: 'incomplete', missing: ['payWith.loan.apr', 'payWith.loan.termMonths'],
    });
    expect(ok('I buy a $1,200 laptop on my card')).toMatchObject({ purchase: { label: 'Laptop', amount: 1_200, payWith: 'card' } });
    expect(ok('a $90 gym membership every month')).toMatchObject({ purchase: { amount: 90, recurring: 'monthly', payWith: 'cash' } });
  });

  it('new rent', () => {
    expect(ok('my rent goes up to $2,400')).toEqual({ kind: 'rent', monthly: 2_400 });
    expect(ok('rent goes from $1,900 to $2,150')).toEqual({ kind: 'rent', monthly: 2_150 });
  });

  it('nothing to read', () => {
    expect(parseScenarioRules('hello there')).toEqual({ ok: false, code: 'nothing_found' });
  });

  it('resolvePlace knows our metros only', () => {
    expect(resolvePlace('Philly', null)).toEqual({ zip: '19125' });
    expect(resolvePlace('Boise', null)).toEqual({ unknown: 'Boise' });
    expect(resolvePlace(null, null)).toBeNull();
  });
});
