import { expect, it } from 'vitest';
import { areaData, areaForMetro, coveredMetros } from './areas';
it('lists each covered metro/tier exactly once without substituting unknowns',()=>{
  const metros=coveredMetros();
  expect(metros.length).toBe(new Set(areaData.map(a=>a.metro)).size);
  for (const metro of metros) for (const tier of metro.tiers) {
    const area=areaForMetro(metro.metro,tier)!;
    expect(area.metro).toBe(metro.metro);expect(area.tier).toBe(tier);
  }
  expect(areaForMetro('uncovered','mid')).toBeNull();
});
