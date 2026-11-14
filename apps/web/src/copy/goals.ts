// Strings for Goals (MP11). "Pay down" reuses the Loan Lab and payoff planner copy (copy/loan.ts).
export const goals = {
  title: 'Goals',
  tabs: { saveUp: 'Save up', payDown: 'Pay down' },
  statuses: { onTrack: 'On track', atRisk: 'At risk', completed: 'Completed' },
  add: 'Add goal',
  allocate: 'Add a transaction to this goal',
  remove: 'Remove goal',
  monthlyToStayOnTrack: 'Extra saving per month to stay on track',
  unreachable: 'Not reachable with your take-home pay.',
  invalid: 'Enter a name, a positive target and a whole number of years from 1 to 30.',
  estimate: 'Rules-based estimate. Educational simulation, not financial advice.',
} as const;
