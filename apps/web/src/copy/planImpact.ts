// "What it does to your plan": the block a What if? tool shows under its answer (ui-kit PlanImpactPanel).
// Every number in it is the engine's plan() run with and without the change, on the active /plan scenario.

export const planImpact = {
  title: 'What it does to your plan',
  in10y: (year: number) => `Net worth by ${year}`,
  atRetirement: (age: number) => `At retirement (${age})`,
  hint: (scenario: string) => `Your plan “${scenario}”, with this change minus without it. Today’s dollars.`,
  source: 'Rules-based',
  sample: 'Measured on the sample plan. Enter your own numbers to see yours.',
  tooSmall: 'Too small to move your plan (under $1).',
  error: 'Your plan could not be measured right now.',
  add: 'Add to my plan',
  update: 'Update in my plan',
  outdated: 'Your plan has an older version of this. Update it to match.',
  added: 'Added to your plan',
  open: 'Open plan',
  remove: 'Take it off my plan',
} as const;
