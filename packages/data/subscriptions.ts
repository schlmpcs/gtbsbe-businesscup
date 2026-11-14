import { KnownServiceSchema, type KnownService } from '@lifeguessr/types';
import json from './subscriptions.json';

// Same normalization as merchantKey, kept data-only to avoid a data → engine dependency.
const keyOf=(label:string)=>label.toUpperCase().replace(/\[[A-Z#]*\]/g,' ').replace(/[^A-Z]+/g,' ').trim().replace(/\s+/g,' ');
const matches=(key:string,matcher:string)=>` ${key} `.includes(` ${matcher} `);
function freeze<T>(value:T):T {
  if(value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
/** Validate IDs, plans and cross-service matcher collisions before publishing a catalogue. */
export function parseKnownServices(raw:unknown):KnownService[] {
  const services=KnownServiceSchema.array().min(1).parse(raw);
  if(new Set(services.map(s=>s.id)).size!==services.length) throw new Error('Duplicate service id');
  for(const service of services) {
    if(new Set(service.plans.map(p=>p.id)).size!==service.plans.length) throw new Error('Duplicate plan id');
    for(const other of services) for(const matcher of service.matchers) {
      if(service.id!==other.id && other.matchers.some(m=>matches(matcher,m)||matches(m,matcher))) {
        throw new Error(`Matcher collision: ${service.id}, ${other.id}`);
      }
    }
  }
  return services;
}
/** Dated manual catalogue; a catalogue amount is an estimate unless explicitly verified. */
export const knownServices:readonly KnownService[]=freeze(parseKnownServices(json));
const byId=new Map(knownServices.map(s=>[s.id,s]));
/** Service by stable slug, or null. */
export function serviceById(id:string):KnownService|null {return byId.get(id)??null;}
/** Whole-word recognition; ambiguous marketplace descriptors always require user confirmation. */
export function findService(label:string):KnownService|null {
  const key=keyOf(label);
  const found=knownServices.filter(s=>s.matchers.some(m=>matches(key,m)));
  return found.length===1 ? found[0]! : null;
}
/** Forty common, unambiguous services with their default plan, for an editable cold-start list. */
export function tickList():{service:KnownService;plan:KnownService['plans'][number]}[] {
  return knownServices.filter(s=>!s.ambiguous).slice(0,40).map(service=>({service,plan:service.plans[0]!}));
}
