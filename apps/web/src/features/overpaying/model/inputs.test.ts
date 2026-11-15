import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import {
  DEFAULT_ADULTS, DEFAULT_BEDROOMS, KIDS_PER_BAND_MAX, clampAdults, clampBedrooms, clampKidCount, emptyInputs,
  initialDraft, parseZip, sameZip, toCheckInput, toToolState,
} from './inputs';

describe('parseZip', () => {
  it('reads a ZIP typed any of the usual ways', () => {
    for (const text of ['75206', ' 75206 ', '752 06', '75206-1234', '752061234', '75206 1234', '75206–1234']) {
      expect(parseZip(text), JSON.stringify(text)).toEqual({ kind: 'zip', zip: '75206' });
    }
  });
  it('blank is empty, not invalid', () => {
    expect(parseZip('')).toEqual({ kind: 'empty' });
    expect(parseZip('   ')).toEqual({ kind: 'empty' });
  });
  it('rejects anything that is not a US ZIP', () => {
    // 4 digits, 6 digits, ZIP+4 cut short, a UK and a Canadian postcode, letters, Cyrillic, Arabic-Indic digits.
    for (const text of ['7520', '752066', '75206-12', 'SW1A 1AA', 'M5V 2T6', '7520a', 'Москва', '٧٥٢٠٦']) {
      expect(parseZip(text), JSON.stringify(text)).toEqual({ kind: 'invalid' });
    }
  });
});

describe('sameZip', () => {
  it('is the same ZIP however it was typed, and different otherwise', () => {
    expect(sameZip('75206', ' 75206-1234 ')).toBe(true);
    expect(sameZip('752 06', '752061234')).toBe(true);
    expect(sameZip('', '   ')).toBe(true); // both empty
    expect(sameZip('abc', 'SW1A 1AA')).toBe(true); // both not a ZIP: nothing was chosen for either
    expect(sameZip('75206', '75216')).toBe(false);
    expect(sameZip('75206', '7520')).toBe(false); // deleting a digit is a change
    expect(sameZip('', '75206')).toBe(false);
    expect(sameZip('99999', 'abc')).toBe(false);
  });
});

describe('clamps', () => {
  it('keep the household inside what the data and the engine take', () => {
    expect(clampBedrooms(6)).toBe(4); // above the data's range counts as 4
    expect(clampBedrooms(-1)).toBe(0);
    expect(clampBedrooms(2.7)).toBe(2);
    expect(clampBedrooms(Number.NaN)).toBe(DEFAULT_BEDROOMS);
    expect(clampAdults(0)).toBe(1);
    expect(clampAdults(9)).toBe(4);
    expect(clampAdults(2.9)).toBe(2);
    expect(clampAdults(Number.NaN)).toBe(DEFAULT_ADULTS);
    expect(clampKidCount(-3)).toBe(0);
    expect(clampKidCount(99)).toBe(KIDS_PER_BAND_MAX);
    expect(clampKidCount(Number.NaN)).toBe(0);
  });
});

describe('initialDraft', () => {
  it('the person’s transactions (monthly averages) fill rent, groceries and childcare first, tagged as such', () => {
    const profile = cloneProfileDemo();
    const { draft, prefill } = initialDraft(profile, undefined, null, { rentUtilities: 2012.4, groceries: 611.6, eatingOut: 300 });
    expect(draft.inputs.amounts).toMatchObject({ rent: 2012, groceries: 612, carInsurance: null });
    expect(prefill.amounts).toMatchObject({ rent: 'ledger', groceries: 'ledger', carInsurance: null });
    // Without a profile, the transactions still fill what they can (no ZIP).
    const cold = initialDraft(null, undefined, null, { groceries: 480 });
    expect(cold.draft.inputs.amounts.groceries).toBe(480);
    expect(cold.prefill).toMatchObject({ zip: false, amounts: { groceries: 'ledger', rent: null } });
  });

  it('without a profile or saved inputs: asks for nothing but defaults', () => {
    const { draft, prefill } = initialDraft(null, undefined);
    expect(draft.inputs).toEqual(emptyInputs());
    expect(draft.inputs).toEqual({
      zip: '',
      bedrooms: 2,
      adults: 1,
      kids: { infant: 0, toddler: 0, preschool: 0, schoolAge: 0 },
      amounts: { rent: null, carInsurance: null, groceries: null, childcare: null },
    });
    expect(draft.metro).toBeNull();
    expect(draft.tier).toBeNull();
    expect(prefill).toEqual({ zip: false, amounts: { rent: null, carInsurance: null, groceries: null, childcare: null } });
  });

  it('fills the ZIP and the matching spending lines from profile.demo.json', () => {
    // profile.demo.json: zip 75206; rentUtilities 1950 (measured); groceries 520 (estimate); childcare 0; car 310 is running costs, not insurance.
    const { draft, prefill } = initialDraft(cloneProfileDemo(), undefined);
    expect(draft.inputs.zip).toBe('75206');
    expect(draft.inputs.amounts).toEqual({ rent: 1950, carInsurance: null, groceries: 520, childcare: null });
    expect(prefill).toEqual({ zip: true, amounts: { rent: 'profile', carInsurance: null, groceries: 'profileEstimate', childcare: null } });
  });

  it('saved inputs win over the profile, field for field, blanks included', () => {
    const stored = { zip: '10013', bedrooms: 1, adults: 2, kids: ['infant' as const, 'infant' as const, 'schoolAge' as const], rent: 3000, metro: 'Dallas-Fort Worth, TX', tier: 'mid' as const };
    const { draft, prefill } = initialDraft(cloneProfileDemo(), stored);
    expect(draft.inputs).toEqual({
      zip: '10013',
      bedrooms: 1,
      adults: 2,
      kids: { infant: 2, toddler: 0, preschool: 0, schoolAge: 1 },
      amounts: { rent: 3000, carInsurance: null, groceries: null, childcare: null }, // groceries stays blank: the profile's 520 does not come back
    });
    expect(draft.metro).toBe('Dallas-Fort Worth, TX');
    expect(draft.tier).toBe('mid');
    expect(prefill).toEqual({ zip: false, amounts: { rent: null, carInsurance: null, groceries: null, childcare: null } });
  });

  it('"About you" fills the household and the ZIP; a household typed in the tool still wins', () => {
    const household = { facts: { adults: 2 as const, kids: ['toddler' as const], bedrooms: 3 as const, hasCar: true }, zip: '78704' };
    const { draft, prefill } = initialDraft(null, undefined, household);
    expect(draft.inputs).toMatchObject({ zip: '78704', bedrooms: 3, adults: 2, kids: { infant: 0, toddler: 1, preschool: 0, schoolAge: 0 } });
    expect(draft.householdEntered).toBe(true);
    expect(prefill.zip).toBe(true);
    const typed = initialDraft(null, { zip: '10013', bedrooms: 1, adults: 1, kids: [] }, household);
    expect(typed.draft.inputs).toMatchObject({ zip: '10013', bedrooms: 1, adults: 1 });
  });

  it('caps what a damaged save could hold', () => {
    const { draft } = initialDraft(null, { bedrooms: 9, adults: 0, kids: Array(8).fill('toddler') });
    expect(draft.inputs.bedrooms).toBe(4);
    expect(draft.inputs.adults).toBe(1);
    expect(draft.inputs.kids.toddler).toBe(KIDS_PER_BAND_MAX);
  });
});

describe('toCheckInput', () => {
  it('lists the kids by age band, youngest first, and keeps only the amounts entered', () => {
    const inputs = {
      ...emptyInputs(),
      bedrooms: 3 as const,
      adults: 2 as const,
      kids: { infant: 1, toddler: 0, preschool: 2, schoolAge: 1 },
      amounts: { rent: 1950, carInsurance: null, groceries: 800, childcare: null },
    };
    expect(toCheckInput(inputs)).toEqual({
      bedrooms: 3,
      adults: 2,
      kids: ['infant', 'preschool', 'preschool', 'schoolAge'],
      rent: 1950,
      groceries: 800,
    });
  });
});

describe('toToolState', () => {
  it('keeps the last inputs in the shape the store takes', () => {
    const draft = {
      inputs: {
        zip: ' 75206-1234 ',
        bedrooms: 3 as const,
        adults: 2 as const,
        kids: { infant: 1, toddler: 0, preschool: 2, schoolAge: 0 },
        amounts: { rent: 1950, carInsurance: 0, groceries: null, childcare: 800 },
      },
      metro: 'Dallas-Fort Worth, TX',
      tier: 'mid' as const,
    };
    expect(toToolState(draft)).toEqual({
      zip: '75206', // normalized
      metro: 'Dallas-Fort Worth, TX',
      tier: 'mid',
      bedrooms: 3,
      adults: 2,
      kids: ['infant', 'preschool', 'preschool'],
      rent: 1950,
      childcare: 800, // an amount of 0 is not kept
    });
  });

  it('leaves out a ZIP that is not one, and a metro nobody chose', () => {
    const state = toToolState({ inputs: { ...emptyInputs(), zip: 'SW1A 1AA' }, metro: null, tier: null });
    expect(state).toEqual({ bedrooms: 2, adults: 1, kids: [] });
    expect('zip' in state).toBe(false);
  });
});
