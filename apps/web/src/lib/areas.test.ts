import { areaData, getArea } from '@lifeguessr/data/areas';
import { describe, expect, it } from 'vitest';
import { infantChildcareFor } from './areas';

describe('infantChildcareFor (the kid shortcut on S10)', () => {
  it('is the area’s infant childcare figure, with its source, for a ZIP we cover', () => {
    const area = getArea('75206');
    expect(infantChildcareFor('75206')).toEqual({
      basis: 'area', monthly: area.childcareMonthly!.infant, source: area.childcareMonthly!.source,
    });
  });

  it.each([undefined, null, '', '99999'])('is the median of our areas’ infant figures for %j, sourced', (zip) => {
    const values = areaData.map((a) => a.childcareMonthly!.infant).sort((a, b) => a - b);
    const mid = values.length / 2;
    const median = values.length % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[Math.floor(mid)]!;
    const result = infantChildcareFor(zip);
    expect(result.basis).toBe('median');
    if (result.basis !== 'median') return;
    expect(result.areaCount).toBe(60);
    expect(result.monthly).toBe(median);
    expect(result.source.name).toContain('median of our 60 areas');
    expect(result.source.url).toBe(areaData[0]!.childcareMonthly!.source.url);
    expect(result.source.year).toBe(areaData[0]!.childcareMonthly!.source.year);
  });
});
