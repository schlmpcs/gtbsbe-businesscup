import { ToolsStateSchema, type ToolsState } from '@lifeguessr/types';
/** Salvage each independent tool on corrupt or older storage; never reset a profile or sibling. */
export function restoreTools(raw:unknown):ToolsState {
  if(!raw || typeof raw!=='object') return {};
  const result:ToolsState={};
  for(const key of ['subscriptions','overpaying','payoff'] as const) {
    const value=ToolsStateSchema.shape[key].safeParse((raw as Record<string,unknown>)[key]);
    if(value.success && value.data!==undefined) Object.assign(result,{[key]:value.data});
  }
  return result;
}
