// Home "Life line" hero (variant A of the demo): drag one decision (when to buy a home) and the plan to
// the end age redraws. Every number arrives formatted from features/lifeline/model.
const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`;
/** "2 fewer years" / "1 more year". */
const yearsMore = (n: number, more: boolean) => `${n} ${more ? 'more' : 'fewer'} ${n === 1 ? 'year' : 'years'}`;

export const lifeline = {
  teaser: {
    eyebrow: 'Try it · a sample life',
    hint: 'Drag “Buy a home” along the years',
  },
  /** The landing's road: the same plan as the chart, laid along the illustration. */
  road: {
    label: 'A sample life from today to 90: move when the home is bought',
    eyebrow: 'Try it · a sample life',
    today: (age: number) => `${age} · Today`,
    home: (age: number) => `${age} · Buy a home`,
    retire: (age: number) => `${age} · Retire`,
    end: (age: number) => `${age}`,
    sooner: 'Buy the home a year sooner',
    later: 'Buy the home a year later',
    chanceCaption: (endAge: number) => `chance the money lasts to ${endAge}`,
    hint: 'Tap the arrows to move the home',
  },
  sticker: 'Your whole life · one line',
  headingId: 'lifeline-heading',
  lead: {
    later: (n: number) => `Wait ${years(n)} to buy a home`,
    sooner: (n: number) => `Buy a home ${years(n)} sooner`,
    same: 'When should you buy a home?',
    /** The plan's own year already runs out of cash: say the age, the payoff says the rest. */
    sameShort: (age: number) => `Buy a home at ${age}`,
  },
  payoff: {
    chance: (from: string, to: string) => `chance of success ${from} → ${to}`,
    lasts: (endAge: number) => `your money lasts past ${endAge}`,
    runsOut: (age: number) => `you run out of cash at ${age}`,
    /** `amount` is the size of the difference vs the plan at retirement, never a balance. */
    atRetirement: (amount: string, more: boolean) => `${amount} ${more ? 'more' : 'less'} at retirement`,
  },
  /** Why the move changes net worth at retirement: the home-equity part and the rest (savings), from plan(). */
  why: {
    lead: 'Why: ',
    equity: (n: number, later: boolean, amount: string, more: boolean, age: number) =>
      `${yearsMore(n, !later)} of owning leaves ${amount} ${more ? 'more' : 'less'} home equity at ${age}`,
    savings: (n: number, later: boolean, renting: boolean, amount: string, more: boolean) =>
      `${yearsMore(n, later)} ${renting ? 'of renting' : 'before buying'} leaves ${amount} ${more ? 'more' : 'less'} in savings`,
    join: '; ',
    end: '.',
  },
  sub: (paths: string, endAge: number) =>
    `Drag the year. Your plan to age ${endAge} redraws in real time: ${paths} simulated lives, your area's prices, no bank login.`,
  kpi: {
    atRetirement: (age: number) => `Net worth at ${age}`,
    chance: 'Chance of success',
    runsOut: 'Money runs out',
    never: 'Never',
    atAge: (age: number) => `at ${age}`,
    was: 'was',
    measuring: 'Measuring…',
    unavailable: 'Not available',
    pts: (signed: string) => `${signed} pts`,
    fixed: 'fixed',
    same: 'same as your plan',
    broken: 'new',
  },
  chart: {
    title: (endAge: number) => `Net worth, today → age ${endAge}`,
    selected: (age: number) => `Buy at ${age}`,
    before: (age: number) => `Buy at ${age} (before)`,
    band: (paths: string) => `80% of ${paths} paths`,
    runsOut: (age: number) => `Out of cash at ${age}`,
    atRetirement: (value: string, age: number) => `${value} at ${age}`,
    was: (value: string) => `was ${value}`,
    marker: { home: 'Buy a home', kid: 'Kid', retire: 'Retire' },
    dragHint: 'drag',
    ariaLabel: 'Net worth by age for the year picked, compared with the year in your plan',
  },
  slider: {
    eyebrow: (place: string | null) => (place ? `Decision · Buy a home in ${place}` : 'Decision · Buy a home'),
    title: (age: number) => `Buy at age ${age}`,
    titleNot: (age: number) => `, not ${age}`,
    label: 'Age you buy a home',
    value: (age: number) => `Age ${age}`,
    homePrice: (v: string) => `Home ${v}`,
    downPayment: (v: string, pct: string) => `Down payment ${pct}: ${v}`,
    payment: (v: string) => `Payment ${v}/mo with tax and insurance`,
    estimate: 'Area prices are estimates',
    origin: (inPlan: boolean) => (inPlan ? 'Your plan buys a home' : 'A typical home in your area'),
    yourPlan: (age: number) => `your plan: ${age}`,
    chances: 'Chance of success by age you buy',
    chanceAt: (age: number, pct: string) => `Buy at ${age}: ${pct}`,
  },
  house: { built: 'Plan on track', building: 'Plan still under construction' },
  apply: { cta: (age: number) => `Put "buy at ${age}" in my plan`, done: 'In your plan', open: 'Open the full plan' },
  disclaimer: 'Educational simulation, not financial advice. Values in today’s dollars; Chance of success from seeded simulations.',
};
