// Strings for the "What it does to your plan" card the What if? tools share (/afford, /loan):
// the engine's previewEvent on the active scenario, and the "Add to my plan" action.
// Functions take numbers already formatted by the UI.
export const toolPlan = {
  title: 'What it does to your plan',
  /** Under the title: which scenario it is measured on. */
  on: (scenario: string) => `Measured on your “${scenario}” plan, with it vs without it.`,
  atRetirement: (age: number) => `Net worth at ${age}`,
  atEnd: (age: number) => `Net worth at ${age}`,
  moneyLasts: 'Money lasts',
  lastsTo: (age: number) => `Past ${age}`,
  runsOut: (age: number) => `Runs short at ${age}`,
  /** The change against the plan without it ("−$42K vs without"). */
  vsWithout: (delta: string) => `${delta} vs without`,
  noChange: 'No change',
  causesShortfall: (age: number) => `With this, your plan runs short at ${age}.`,
  display: { today: 'In today’s dollars.', future: 'In future dollars.' },
  add: 'Add to my plan',
  adding: 'Adding…',
  added: 'Added to your plan',
  open: 'Open plan',
  /** What the event will be on /plan; `what` is a short description from the tool. */
  willAdd: (what: string) => `Adds “${what}” to your plan’s timeline.`,
  error: 'We couldn’t measure this on your plan.',
  source: 'Rules-based',
} as const;
