export const goal = {
  title: 'Your net worth goal',
  /** Card headline once a goal is set (`target` is formatted). */
  summary: (target: string, years: number) => `Your goal: ${target} in ${years} ${years === 1 ? 'year' : 'years'}`,
  edit: 'Change goal',
  makeExact: 'Make it exact',
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
  /** The verdict sticker. */
  verdictLabel: {
    onTrack: 'On track',
    withinRange: 'Within range',
    behind: 'Behind',
  },
  /** The line under the sticker. */
  verdict: {
    onTrack: 'Even the low end of your range reaches the target.',
    withinRange: 'Your range spans the target: the result depends on the estimates in your numbers.',
    behind: 'Even the high end of your range falls short.',
  },
  moveShare: 'Top moves: share of the gap closed',
  combined: 'All moves together',
  noGap: 'No positive gap to close',
  rules:
    'Goals use the rules forecast in today’s dollars. On track means the low end reaches the target; behind means even the high end falls short; otherwise the target is within range. With no estimated inputs the band is zero. Extra saving is a constant amount in today’s dollars, added to the usual simulated surplus and split by the profile’s retirement share after any purchase-card payoff. The solve ignores taxes and is capped at take-home pay. Move effects are recomputed at the chosen horizon; combined effects include their interactions.',
} as const;
