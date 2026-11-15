// One color per kind of bill, shared by the grid chips, the lists, the legend and the split bar.
import type { BillKindVM } from '../model/types';

/** A solid dot / bar segment. */
export const KIND_DOT: Record<BillKindVM, string> = {
  rent: 'bg-primary',
  debt: 'bg-chart-5',
  subscription: 'bg-chart-2',
};

/** A soft chip with readable text. */
export const KIND_CHIP: Record<BillKindVM, string> = {
  rent: 'bg-primary/15 text-text',
  debt: 'bg-chart-5/15 text-text',
  subscription: 'bg-chart-2/15 text-text',
};

export const KINDS: readonly BillKindVM[] = ['rent', 'debt', 'subscription'];
