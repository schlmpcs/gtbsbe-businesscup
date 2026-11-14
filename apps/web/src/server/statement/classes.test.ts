import { expect,it,vi } from 'vitest';
import type { StatementItem } from '@lifeguessr/types';
import { StatementCategorizeResponseSchema } from '@lifeguessr/types';
import { reply } from '../ai/testUtils';
import { type LlmClient } from '../ai/client';
import { categorizeStatement } from './categorize';
const items:StatementItem[]=['NETFLIX','SPOTIFY USA','PLANET FITNESS','AMAZON PRIME','[ref]'].map(label=>({label,amount:20,month:'2026-01',day:1}));
it('adds distinct masked rule classes, excluding masks, without changing totals',async()=>{
 const result=await categorizeStatement(items,null);
 for(const label of items.slice(0,4).map(i=>i.label)) expect(result.classes).toContainEqual({label,class:'subscriptions'});
 expect(result.classes).toHaveLength(4);
 expect(StatementCategorizeResponseSchema.safeParse({ok:true,...result}).success).toBe(true);
 const {classes:_classes,...old}=result;
 expect(StatementCategorizeResponseSchema.safeParse({ok:true,...old}).success).toBe(true);
});
it.each(['ai','mixed'] as const)('returns %s classes from the same classifications used by totals',async(mode)=>{
 const create=vi.fn().mockResolvedValue(reply(JSON.stringify({labels:[{id:1,class:'subscriptions',oneOff:false},...(mode==='ai'?[{id:2,class:'groceries',oneOff:false}]:[])]})));
 const client={messages:{create}} as unknown as LlmClient;
 const result=await categorizeStatement(items.slice(0,2),client);
 expect(result.categorizedBy).toBe(mode);
 expect(result.classes).toContainEqual({label:'NETFLIX',class:'subscriptions'});
 expect(result.classes).toContainEqual({label:'SPOTIFY USA',class:mode==='ai'?'groceries':'subscriptions'});
 expect(result.months[0]!.totals.subscriptions).toBe(mode==='ai'?20:40);
});
