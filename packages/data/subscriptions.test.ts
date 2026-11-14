import { expect,it } from 'vitest';
import { KnownServiceSchema } from '@lifeguessr/types';
import { findService, knownServices, parseKnownServices, serviceById, tickList } from './subscriptions';
it('validates and freezes a sourced catalogue with forty defaults',()=>{
 expect(knownServices.length).toBeGreaterThanOrEqual(60);
 expect(tickList()).toHaveLength(40);
 expect(Object.isFrozen(knownServices[0]!.plans)).toBe(true);
 for(const service of knownServices) {
  expect(KnownServiceSchema.safeParse(service).success).toBe(true);
  expect(service.source.url).toMatch(/^https:/);
  expect(service.priceYear).toBe(2026);
  expect(serviceById(service.id)).toBe(service);
  for(const matcher of service.matchers) expect(findService(matcher)?.id).toBe(service.id);
 }
});
it('recognizes fixture descriptors without resolving an ambiguous marketplace',()=>{
 expect(findService('SPOTIFY USA #')?.id).toBe('spotify');
 expect(findService('NETFLIX.COM')?.id).toBe('netflix');
 expect(findService('PLANET FITNESS CLUB FEES')?.id).toBe('planet-fitness');
 expect(findService('APPLE.COM/BILL #')?.ambiguous).toBe(true);
 expect(findService('AMAZON PRIME*[ref] Amzn.com/bill WA')?.id).toBe('amazon-prime');
 expect(findService('[ref]')).toBeNull();expect(findService('NOTNETFLIX')).toBeNull();
 expect(findService('NETFLIX SPOTIFY')).toBeNull();
});
it('rejects malformed prices, duplicate ids and matcher collisions',()=>{
 const service=knownServices[0]!;
 expect(()=>parseKnownServices([service,service])).toThrow();
 expect(()=>parseKnownServices([service,{...service,id:'different'}])).toThrow();
 expect(KnownServiceSchema.safeParse({...service,plans:[{...service.plans[0],price:NaN}]}).success).toBe(false);
 expect(KnownServiceSchema.safeParse({...service,matchers:['']} ).success).toBe(false);
});
