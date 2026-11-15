'use client';
// The hub's view-model: one cheap live teaser (the next bill, from the bills calendar's own hook).
// No other tool is computed here: a tile shows a number only when a screen already has it at hand.
import { useNextBill } from '@/features/bills/model/useBills';
import type { ToolsHubVM } from './types';

export function useToolsHub(opts: { now?: Date } = {}): ToolsHubVM {
  const next = useNextBill(opts.now);
  return { nextBillInDays: next ? next.inDays : null };
}
