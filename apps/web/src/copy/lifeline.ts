// Home "Life line" hero (variant A of the demo): drag one decision (when to buy a home) and the plan to
// the end age redraws. Every number arrives formatted from features/lifeline/model.
const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`;

export const lifeline = {
  sticker: 'Your whole life · one line',
  headingId: 'lifeline-heading',
  lead: {
    later: (n: number) => `Wait ${years(n)} to buy a home`,
    sooner: (n: number) => `Buy a home ${years(n)} sooner`,
    same: 'When should you buy a home?',
  },
  payoff: {
    chance: (from: string, to: string) => `chance of success ${from} → ${to}`,
    lasts: (endAge: number) => `your money lasts past ${endAge}`,
    runsOut: (age: number) => `your money runs out at ${age}`,
    atRetirement: (signed: string) => `retire with ${signed}`,
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
    broken: 'new',
  },
  chart: {
    title: (endAge: number) => `Net worth, today → age ${endAge}`,
    selected: (age: number) => `Buy at ${age}`,
    before: (age: number) => `Buy at ${age} (before)`,
    band: (paths: string) => `80% of ${paths} paths`,
    runsOut: (age: number) => `Out of money at ${age}`,
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
  },
  house: { built: 'Plan on track', building: 'Plan still under construction' },
  apply: { cta: (age: number) => `Put "buy at ${age}" in my plan`, done: 'In your plan', open: 'Open the full plan' },
  disclaimer: 'Educational simulation, not financial advice. Values in today’s dollars; Chance of success from seeded simulations.',
};
