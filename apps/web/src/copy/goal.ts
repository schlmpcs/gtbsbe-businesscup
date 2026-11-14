export const goal = {
  title: 'Your net worth goal',
  target: 'Target in today’s dollars',
  years: 'Years',
  start: 'Set goal',
  clear: 'Clear goal',
  computed:
    'Computed from your inputs with fixed assumptions. Educational simulation, not financial advice.',
  invalid: 'Enter a positive target and a whole number of years from 1 to 30.',
  error: 'We could not calculate this goal. Check your inputs.',
  loading: 'Loading your goal…',
  projected: 'Projected range',
  gap: 'Gap to the target',
  progress: 'Projected progress',
  saving: 'Extra monthly saving to reach the target',
  unreachable:
    'This target is not projected to be reachable by saving alone within your take-home pay.',
  verdict: {
    onTrack: 'On track: even the low end reaches the target',
    withinRange:
      'Within range: the result depends on the estimates in your inputs',
    behind: 'Behind: even the high end falls short',
  },
  moveShare: 'Top moves: share of the gap closed',
  combined: 'All moves together',
  noGap: 'No positive gap to close',
  rules:
    'Goals use the rules forecast in today’s dollars. On track means the low end reaches the target; behind means even the high end falls short; otherwise the target is within range. With no estimated inputs the band is zero. Extra saving is a constant amount in today’s dollars, added to the usual simulated surplus and split by the profile’s retirement share after any purchase-card payoff. The solve ignores taxes and is capped at take-home pay. Move effects are recomputed at the chosen horizon; combined effects include their interactions.',
} as const;
