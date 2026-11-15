// The add-account form's words per account type: the money field's label, the yearly change field's
// placeholder and hint (its default comes from the engine constants the plan uses), the form title.
import { describe, expect, it } from 'vitest';
import { accounts as t } from '@/copy';
import type { AccountGroup } from '@lifeguessr/types';
import { buildForm, emptyForm, formTitle, parsePercent, toFields, type FormState } from './addForm';

const field = (group: AccountGroup, id: string, form: FormState = emptyForm()) => toFields(group, form, false).find((f) => f.id === id);

describe('money field label', () => {
  it.each(['vehicle', 'realEstate', 'otherAsset'] as const)('%s asks for its value today', (group) => {
    expect(field(group, 'balance')?.labelKey).toBe('value');
    expect(t.fields.value).toBe('Value today');
  });

  it.each(['cash', 'investments', 'retirement', 'creditCard', 'loan', 'mortgage'] as const)('%s keeps "Balance"', (group) => {
    expect(field(group, 'balance')?.labelKey).toBe('balance');
  });
});

describe('yearly change field', () => {
  it('is labelled as optional and has no APR hint', () => {
    expect(t.fields.growth).toBe('How its value changes per year (optional)');
    for (const g of ['investments', 'retirement', 'realEstate', 'vehicle', 'otherAsset'] as const) {
      expect(field(g, 'growth')?.hint).not.toBe(t.form.aprHint);
    }
  });

  it('a vehicle shows the plan default of −15% (vehicleDepreciationAnnual −0.15)', () => {
    const f = field('vehicle', 'growth');
    expect(f?.placeholder).toBe('−15');
    expect(f?.hint).toBe('Leave blank to use a typical −15% a year (cars lose value). Use a minus for a loss.');
  });

  it.each(['investments', 'retirement'] as const)('%s shows the plan default of 6% (returnAnnualNominal 0.06)', (group) => {
    const f = field(group, 'growth');
    expect(f?.placeholder).toBe('6');
    expect(f?.hint).toBe('Leave blank to use a typical 6% a year (before inflation). Use a minus for a loss.');
  });

  it("real estate names the area's home price growth, without a number", () => {
    const f = field('realEstate', 'growth');
    expect(f?.placeholder).toBeNull();
    expect(f?.hint).toBe("Leave blank to use your area's typical home price growth. Use a minus for a loss.");
  });

  it('other assets keep pace with prices, without a number', () => {
    const f = field('otherAsset', 'growth');
    expect(f?.placeholder).toBeNull();
    expect(f?.hint).toBe('Leave blank to have it keep pace with prices (inflation). Use a minus for a loss.');
  });

  it('cash has no yearly change field', () => {
    expect(field('cash', 'growth')).toBeUndefined();
  });
});

describe('other hints', () => {
  it.each(['creditCard', 'loan', 'mortgage'] as const)('%s keeps the APR hint on its rate', (group) => {
    expect(field(group, 'apr')?.hint).toBe(t.form.aprHint);
    expect(t.form.aprHint).toBe('Per year, in percent (22.8 means 22.8%).');
  });

  it("a card's blank minimum payment says it is filled in", () => {
    expect(field('creditCard', 'minPayment')?.hint).toBe(t.form.defaultedHint);
    expect(field('creditCard', 'minPayment', { values: { minPayment: '50' }, estimates: {} })?.hint).toBeNull();
  });

  it('name and money fields have no hint and no placeholder of their own', () => {
    expect(field('vehicle', 'name')?.hint).toBeNull();
    expect(field('vehicle', 'balance')?.hint).toBeNull();
    expect(field('vehicle', 'balance')?.placeholder).toBeNull();
  });
});

describe('form title', () => {
  it('names the side and the type', () => {
    expect(formTitle('vehicle')).toBe('Add asset: Vehicle');
    expect(formTitle('cash')).toBe('Add asset: Cash');
    expect(formTitle('creditCard')).toBe('Add liability: Credit card');
  });
});

describe('growth on submit', () => {
  const car = (growth?: string): FormState => ({ values: { name: 'Car', balance: '18,000', ...(growth === undefined ? {} : { growth }) }, estimates: {} });

  it('a blank growth stores no override', () => {
    expect(buildForm('vehicle', car())?.growth).toBeNull();
    expect(buildForm('vehicle', car('  '))?.growth).toBeNull();
  });

  it('a typed growth overrides, negative allowed, typographic minus too', () => {
    expect(buildForm('vehicle', car('-10'))?.growth).toBeCloseTo(-0.1, 12);
    expect(buildForm('vehicle', car('−10'))?.growth).toBeCloseTo(-0.1, 12);
    expect(buildForm('investments', car('7.5'))?.growth).toBeCloseTo(0.075, 12);
  });

  it('parsePercent reads the typographic minus the placeholder shows', () => {
    expect(parsePercent('−15')).toBeCloseTo(-0.15, 12);
    expect(parsePercent('abc')).toBeNaN();
  });
});
