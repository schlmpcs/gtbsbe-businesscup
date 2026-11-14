import { describe, expect, it } from 'vitest';
import { AREA_TIERS, COST_CATEGORIES, type CostCategory } from '@lifeguessr/types';
import {
  areaByZip, areaDataSample, cardsSample, leaseScenarioFixture, LeaseScenarioFixtureSchema, leaseScenarioSample, LeaseScenarioSchema, loanOffersSample, profileDemo, statementTotalsSample,
} from './index';
import { readStatementSampleCsv } from './node';

describe('fixtures', () => {
  it('cover every area tier once', () => {
    expect(areaDataSample.map((a) => a.tier).sort()).toEqual([...AREA_TIERS].sort());
  });

  it('give every non-estimate data value a source with a URL', () => {
    for (const a of areaDataSample) {
      const sourced = [
        ...Object.values(a.rentByBedrooms), a.groceriesPerAdult, a.gasPerGallon, a.carInsuranceMonthly, a.cpiYoY,
      ];
      for (const s of sourced) {
        if (!s.isEstimate) expect(s.source.url, `${a.zip} ${s.source.name}`).toMatch(/^https:\/\//);
      }
      if (a.childcareMonthly) expect(a.childcareMonthly.source.url).toMatch(/^https:\/\//);
    }
  });

  it('have rent rising with bedrooms in every ZIP', () => {
    for (const a of areaDataSample) {
      const rents = ([0, 1, 2, 3, 4] as const).map((b) => a.rentByBedrooms[b].value);
      expect(rents).toEqual([...rents].sort((x, y) => x - y));
    }
  });

  it('keep card captions free of clue facts (household, kids, car, food habits, neighborhood)', () => {
    // The caption is visible before any clue is paid for (docs/PRODUCT.md → Game design), so it must
    // not give away what a clue room shows. The layout (bedrooms) and metro are public anyway.
    const clueWords =
      /\b(kids?|child(ren)?|babies|baby|toddlers?|preschool(er)?s?|daycare|after-school|sons?|daughters?|family|parents?|couple|married|wife|husband|partner|roommates?|alone|single|cars?|sedan|suv|coupe|truck|bus|bikes?|transit|takeout|delivery|dinner out|eats? out|restaurants?|cooks?|taco|zip|neighborhood|suburb(an)?|downtown|highland park|greenville)\b/i;
    for (const c of cardsSample) expect(c.caption, c.id).not.toMatch(clueWords);
  });

  it('only use ZIPs that exist in the area fixtures, and have unique card ids', () => {
    for (const c of cardsSample) expect(() => areaByZip(c.zip)).not.toThrow();
    expect(new Set(cardsSample.map((c) => c.id)).size).toBe(cardsSample.length);
    expect(cardsSample.length).toBeGreaterThanOrEqual(5);
  });

  it('include a demo profile with a card debt, an auto loan and estimated fields', () => {
    expect(profileDemo.debts.map((d) => d.kind).sort()).toEqual(['auto', 'card']);
    expect(Object.values(profileDemo.spending).some((s) => s.isEstimate)).toBe(true);
    expect(() => {
      (profileDemo as { doneMoveIds: string[] }).doneMoveIds.push('x');
    }).toThrow();
  });

  it('include three loan offers', () => {
    expect(loanOffersSample).toHaveLength(3);
  });

  it('include a statement with at least 4 full months, paychecks and person-to-person lines', () => {
    const lines = readStatementSampleCsv().trim().split('\n');
    expect(lines[0]).toBe('Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #');
    const months = new Set(lines.slice(1).map((l) => l.split(',')[1]!.slice(0, 2)));
    expect(months.size).toBeGreaterThanOrEqual(5); // Jul–Oct full + Nov partial
    expect(lines.some((l) => l.includes('PAYROLL'))).toBe(true);
    expect(lines.some((l) => /Zelle payment (to|from) [A-Z][a-z]+ [A-Z][a-z]+/.test(l))).toBe(true);
    expect(lines.some((l) => /VENMO/i.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('AMAZON PRIME'))).toBe(true);
  });

  it('include an illustrative lease, every value sourced and an estimate, and reject a bad one', () => {
    for (const [field, v] of Object.entries(leaseScenarioFixture)) {
      expect(v.isEstimate).toBe(true);
      expect(v.source.name).toMatch(/illustrative/i);
      expect(leaseScenarioSample[field as keyof typeof leaseScenarioSample]).toBe(v.value);
    }
    expect(leaseScenarioSample.termMonths).toBeGreaterThan(0);
    const bad = { ...leaseScenarioFixture, termMonths: { ...leaseScenarioFixture.termMonths, value: 0 } };
    expect(LeaseScenarioFixtureSchema.safeParse(bad).success).toBe(false);
    const unsourced = { ...leaseScenarioFixture, monthly: { value: 400, isEstimate: true } };
    expect(LeaseScenarioFixtureSchema.safeParse(unsourced).success).toBe(false);
    expect(LeaseScenarioSchema.safeParse({ ...leaseScenarioSample, termMonths: 0 }).success).toBe(false);
    expect(LeaseScenarioSchema.safeParse({ ...leaseScenarioSample, monthly: -1 }).success).toBe(false);
  });

  it('have statement totals equal to the sample CSV categorized with a fixed merchant table', () => {
    // First match wins. 'pay' = detectedPay; 'skip' = not spending (transfers, money in) or a one-off.
    const rules: [string, CostCategory | 'pay' | 'skip'][] = [
      ['PAYROLL', 'pay'], ['Online Transfer to SAV', 'skip'], ['Zelle payment from', 'skip'], ['VENMO PAYMENT', 'skip'],
      ['AMAZON PRIME', 'skip'], ['ANIMAL HOSPITAL', 'skip'],
      ['OAKWOOD APTS', 'rentUtilities'], ['TXU ENERGY', 'rentUtilities'], ['ATMOS ENERGY', 'rentUtilities'], ['SPECTRUM', 'rentUtilities'],
      ['SHELL OIL', 'car'], ['EXXON', 'car'], ['QT ', 'car'], ['PROGRESSIVE', 'car'],
      ['TOM THUMB', 'groceries'], ['ALDI', 'groceries'], ['KROGER', 'groceries'], ['WALMART SUPERCENTER', 'groceries'],
      ['WHATABURGER', 'eatingOut'], ['TACO BELL', 'eatingOut'], ['STARBUCKS', 'eatingOut'], ['UBER *EATS', 'eatingOut'],
      ['DOORDASH', 'eatingOut'], ['CHIPOTLE', 'eatingOut'], ['HOPDODDY', 'eatingOut'],
      ['SPOTIFY', 'subscriptions'], ['NETFLIX', 'subscriptions'], ['APPLE.COM/BILL', 'subscriptions'], ['PLANET FITNESS', 'subscriptions'],
      ['TOYOTA FINANCIAL', 'debtPayments'], ['CAPITAL ONE', 'debtPayments'],
      ['TARGET', 'other'], ['CVS', 'other'], ['AMAZON MKTPL', 'other'], ['HOME DEPOT', 'other'],
      ['ATM WITHDRAWAL', 'other'], ['Zelle payment to', 'other'], ['VENMO *', 'other'],
    ];
    const months = new Map<string, { totals: Record<CostCategory, number>; pay: number }>();
    for (const line of readStatementSampleCsv().trim().split('\n').slice(1)) {
      const [, date, description, amount] = line.split(',');
      const [mm, , yyyy] = date!.split('/');
      const month = `${yyyy}-${mm}`;
      if (month >= '2026-11') continue; // November is partial
      const rule = rules.find(([key]) => description!.includes(key));
      expect(rule, description).toBeDefined();
      let m = months.get(month);
      if (!m) {
        m = { totals: Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>, pay: 0 };
        months.set(month, m);
      }
      const out = -Number(amount); // CSV: negative = money out
      if (rule![1] === 'pay') m.pay -= out;
      else if (rule![1] !== 'skip') m.totals[rule![1]] += out;
    }
    expect(statementTotalsSample.map((m) => m.month)).toEqual([...months.keys()].sort());
    for (const m of statementTotalsSample) {
      const expected = months.get(m.month)!;
      for (const c of COST_CATEGORIES) expect(m.totals[c], `${m.month} ${c}`).toBeCloseTo(expected.totals[c], 2);
      expect(m.detectedPay).toBeCloseTo(expected.pay, 2);
      expect(m.oneOffs).toEqual([]);
    }
  });
});
