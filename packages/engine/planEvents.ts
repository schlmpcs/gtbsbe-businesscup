// Plan events: one-tap defaults from area data, expansion into simulate() primitives, and the payment
// breakdowns the event panel shows. Task MP4 (#164). Stubs until then: signatures are final, bodies throw.
import type {
  BuyHomeBreakdown, ExpandedEvent, ExpenseFinancingBreakdown, PlanEvent, PlanEventContext, PlanEventOf, PlanEventType,
} from '@lifeguessr/types';

/** What "Add event" creates in one tap; every amount carries a source or `isEstimate`. */
export function defaultEvent<T extends PlanEventType>(_type: T, _ctx: PlanEventContext): PlanEventOf<T> {
  throw new Error('not implemented: defaultEvent (MP4)');
}

/** A macro event as LifeEvents, new Debts and assets. A disabled event expands to nothing. */
export function expandEvent(_event: PlanEvent, _ctx: PlanEventContext): ExpandedEvent {
  throw new Error('not implemented: expandEvent (MP4)');
}

/** Monthly cost of a home purchase: principal and interest, property tax, insurance, total. */
export function buyHomeBreakdown(_event: PlanEventOf<'buyHome'>): BuyHomeBreakdown {
  throw new Error('not implemented: buyHomeBreakdown (MP4)');
}

/** The loan behind a financed expense; null when the event has no `financing`. */
export function expenseFinancingBreakdown(_event: PlanEventOf<'expense'>): ExpenseFinancingBreakdown | null {
  throw new Error('not implemented: expenseFinancingBreakdown (MP4)');
}
