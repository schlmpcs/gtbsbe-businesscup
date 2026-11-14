import { describe, expect, it } from 'vitest';
import { AREA_TIERS } from '@lifeguessr/types';
import { areaData, findArea, getArea, parseAreas } from './areas';
import { areaDataSample } from './fixtures';
import report from './out/incomplete-data-report.json';

const metros = [...new Set(areaData.map((a) => a.metro))];

describe('areas.json (T2 pipeline output)', () => {
  it('covers 60 ZIPs: 15 metros with one ZIP per tier', () => {
    expect(areaData).toHaveLength(60);
    expect(metros).toHaveLength(15);
    for (const metro of metros) {
      const tiers = areaData.filter((a) => a.metro === metro).map((a) => a.tier).sort();
      expect(tiers, metro).toEqual([...AREA_TIERS].sort());
    }
  });

  it('gives every value a source; only defaulted values are estimates', () => {
    for (const a of areaData) {
      const values = [...Object.values(a.rentByBedrooms), a.groceriesPerAdult, a.gasPerGallon, a.carInsuranceMonthly, a.cpiYoY];
      for (const v of values) {
        expect(v.source.url, `${a.zip} ${v.source.name}`).toMatch(/^https:\/\//);
        expect(v.source.year).toBeGreaterThanOrEqual(2018);
      }
      // Rents are HUD values, never defaulted; car insurance is a state average, always an estimate.
      for (const rent of Object.values(a.rentByBedrooms)) expect(rent.isEstimate).toBeUndefined();
      expect(rent0Name(a.zip)).toContain('HUD');
      expect(a.carInsuranceMonthly.isEstimate).toBe(true);
      if (a.childcareMonthly) expect(a.childcareMonthly.source.url).toMatch(/^https:\/\//);
      if (a.rentRangeRatio) expect(a.rentRangeRatio.source.name).toContain('B25063');
    }
  });

  it('has rent rising with bedrooms, and tiers that agree with HUD rents', () => {
    for (const a of areaData) {
      const rents = ([0, 1, 2, 3, 4] as const).map((b) => a.rentByBedrooms[b].value);
      expect(rents, a.zip).toEqual([...rents].sort((x, y) => x - y));
      expect(rents[0]).toBeGreaterThan(500);
    }
    for (const metro of metros) {
      const twoBed = (tier: string) => areaData.find((a) => a.metro === metro && a.tier === tier)!.rentByBedrooms[2].value;
      expect(twoBed('cheap'), metro).toBeLessThan(twoBed('mid'));
      expect(twoBed('mid'), metro).toBeLessThan(twoBed('expensive'));
    }
  });

  it('keeps every fixture ZIP, with the same metro, county, state and tier', () => {
    for (const f of areaDataSample) {
      const a = getArea(f.zip);
      expect({ metro: a.metro, county: a.county, state: a.state, tier: a.tier }).toEqual({
        metro: f.metro, county: f.county, state: f.state, tier: f.tier,
      });
    }
  });

  it('has plausible ranges for the derived values', () => {
    for (const a of areaData) {
      if (a.rentRangeRatio) {
        expect(a.rentRangeRatio.low).toBeLessThan(1);
        expect(a.rentRangeRatio.high).toBeGreaterThan(1);
      }
      expect(a.childcareMonthly, `${a.zip} childcare`).toBeDefined();
      expect(a.gasPerGallon.value).toBeGreaterThan(2);
      expect(a.gasPerGallon.value).toBeLessThan(8);
      expect(Math.abs(a.cpiYoY.value)).toBeLessThan(0.1);
    }
  });

  it('records its coverage in the report', () => {
    expect(report.areas).toBe(areaData.length);
    expect(report.coverage.map((c) => c.zip)).toEqual(areaData.map((a) => a.zip));
    expect(report.summary.rentFromHud).toMatch(/^60\/60/);
  });

  it('looks areas up by ZIP', () => {
    expect(findArea('75206')?.tier).toBe('mid');
    expect(findArea('99999')).toBeNull();
    expect(findArea(undefined)).toBeNull();
    expect(() => getArea('99999')).toThrow(/99999/);
    expect(Object.isFrozen(getArea('75206').rentByBedrooms)).toBe(true);
  });

  it('rejects duplicate ZIPs and rows that break the contract', () => {
    const one = structuredClone(getArea('75206'));
    expect(() => parseAreas([one, one])).toThrow(/appears twice/);
    expect(() => parseAreas([{ ...one, cpiYoY: { ...one.cpiYoY, value: 3 } }])).toThrow();
    expect(() => parseAreas([])).toThrow();
  });
});

function rent0Name(zip: string): string {
  return getArea(zip).rentByBedrooms[0].source.name;
}
