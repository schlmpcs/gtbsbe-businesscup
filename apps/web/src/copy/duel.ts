// Strings for the duel game (S2 Duel round, S3 Reveal, S3 Day result): "Which life costs more?".
// Functions here only pick words; every number arrives already computed (and formatted).
// The fixed lesson and blind-spot templates live here too: code fills them, never an LLM.
import type { DuelLessonId } from '@lifeguessr/engine';
import type { AreaData, CostCategory, DuelLetter } from '@lifeguessr/types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type DuelTileColor = 'green' | 'yellow' | 'ink';
export type DuelShareStatus = 'idle' | 'sharing' | 'shared' | 'copied' | 'failed';
export type DuelCopyStatus = 'idle' | 'copied' | 'failed';

export const duel = {
  title: 'Which life costs more?',
  subtitle: 'Tap the life you think costs more each month.',
  loading: 'Loading today’s duels…',
  round: (n: number, total: number) => `Round ${n} of ${total}`,
  roundDots: {
    label: 'Rounds',
    dot: (n: number, state: string) => `Round ${n}: ${state}`,
    state: { current: 'now', upcoming: 'to play', green: 'right', yellow: 'right with a hint', ink: 'missed' },
  },
  challenged: 'A friend challenged you. Beat their score on today’s five.',

  card: {
    life: (letter: DuelLetter) => `Life ${letter}`,
    composite: 'Composite',
    compositeHint: 'A composite of real costs, not a real person.',
    pick: (letter: DuelLetter, metro: string) => `Life ${letter} costs more: ${metro}`,
    picking: 'Locking in…',
    yourPick: 'Your pick',
    costsMore: 'Costs more',
    perMonth: '/mo',
    factsLabel: 'What we know',
    hintFact: 'Hint',
  },
  vs: 'VS',

  hint: {
    offer: (cost: string) => `Hint: 1 more fact each, −${cost} points`,
    used: (points: string) => `Hint used · now worth ${points} points`,
    opening: 'Opening the hint…',
    error: 'The hint didn’t open. Tap to try again.',
    worth: (points: string) => `Worth ${points} points`,
  },

  pickError: 'Your pick didn’t go through. Tap a life to try again.',

  reveal: {
    right: (points: string) => `Right! +${points} points`,
    wrong: 'Not this time · 0 points',
    headline: (letter: DuelLetter, amount: string) => `${letter} costs ${amount} more a month.`,
    same: 'They cost the same each month.',
    totalLabel: (letter: DuelLetter) => `Life ${letter} a month`,
    breakdownLabel: (letter: DuelLetter) => `Life ${letter}: monthly costs by category`,
    decidedHeading: 'What decided it',
    decidedLine: (category: string, amount: string) => `${category}: ${amount} a month`,
    decidedVs: (letter: DuelLetter, amount: string) => `vs ${amount} for ${letter}`,
    crowd: (share: string, letter: DuelLetter, total: string) => `${share} picked ${letter}, from ${total} picks`,
    crowdNone: 'Not enough picks yet',
    sources: 'Sources →',
    sourceShort: (name: string, year: number) => `${name}, ${year}`,
    next: 'Next round →',
    finish: 'See my day →',
    disclaimer: 'Educational simulation, not financial advice.',
  },

  summary: {
    heading: 'Your day',
    score: (right: number, total: number) => `${right} of ${total}`,
    scoreLabel: 'Right picks',
    points: (points: string) => `${points} points`,
    pointsLabel: 'Total points',
    gridLabel: 'Your five rounds',
    tile: { green: 'right', yellow: 'right with a hint', ink: 'missed' } satisfies Record<DuelTileColor, string>,
    tileLabel: (round: number, result: string) => `Round ${round}: ${result}`,
    blindSpotHeading: 'Your blind spot',
    noBlindSpot: 'No blind spot today: every round right.',
    copyChallenge: (right: number, total: number) => `Copy challenge link · Beat my ${right}/${total}`,
    copyStatus: {
      idle: '',
      copied: 'Challenge link copied. Send it to a friend.',
      failed: 'Couldn’t copy. Here is the link:',
    } satisfies Record<DuelCopyStatus, string>,
    challengeLinkLabel: 'Challenge link',
    share: 'Share',
    shareStatus: {
      idle: '',
      sharing: 'Opening share…',
      shared: 'Shared!',
      copied: 'Copied your result to the clipboard.',
      failed: 'Couldn’t share. Copy the challenge link instead.',
    } satisfies Record<DuelShareStatus, string>,
    cta: 'Price my own month →',
    ctaLead: 'You can read strangers’ lives. How about yours?',
    nextIn: (hours: number, minutes: number) => `Next five in ${hours}h ${minutes}m`,
  },

  share: {
    header: (date: string) => `LifeGuessr · Which life costs more? ${date}`,
    tiles: { green: '🟩', yellow: '🟨', ink: '⬛' } satisfies Record<DuelTileColor, string>,
    score: (right: number, total: number, points: string) => `${right}/${total} · ${points} points`,
  },

  // ----- what the source (server or fixture client) writes onto the public cards -----

  household: (adults: number, kids: number, bedrooms: number) =>
    [
      plural(adults, 'adult', 'adults'),
      kids > 0 ? plural(kids, 'kid', 'kids') : 'no kids',
      bedrooms === 0 ? 'studio' : plural(bedrooms, 'bedroom', 'bedrooms'),
    ].join(' · '),
  facts: {
    noCar: 'No car',
    economyCar: 'Economy car',
    midCar: '1 car',
    luxuryCar: 'Luxury car',
    daycare: 'Daycare',
    schoolKids: 'School-age kids',
    noKids: 'No kids',
    cooksAtHome: 'Cooks at home',
    eatsOutSometimes: 'Eats out sometimes',
    eatsOutOften: 'Eats out often',
    eatsOutMostDays: 'Eats out most days',
    rents: 'Rents',
  },
  /** The hint: the neighborhood tier of each life's ZIP. */
  hintFacts: {
    cheap: 'Lower-cost neighborhood',
    mid: 'Mid-priced neighborhood',
    expensive: 'Pricey neighborhood',
    suburb: 'Suburb',
  } satisfies Record<AreaData['tier'], string>,
  hintUnknown: 'Neighborhood unknown',

  /** What decided a round, as one plain lesson (fixed table; engine scoreDuelPick picks the id). */
  lessons: {
    childcareOverRent: 'Childcare often costs more than rent.',
    childcare: 'Childcare can cost as much as rent.',
    rentUtilities: 'Where you live and how many bedrooms usually decide the month.',
    car: 'A financed car can outweigh a bigger home.',
    groceries: 'More mouths at home move the grocery bill more than you think.',
    eatingOut: 'Eating out a few times a week adds up to a bill of its own.',
    subscriptions: 'Small monthly charges add up.',
    debtPayments: 'Debt payments take a fixed bite every month.',
    other: 'The everyday extras add up.',
  } satisfies Record<DuelLessonId, string>,

  /** The day's blind spot, from the categories that decided the missed rounds. */
  blindSpots: {
    rentUtilities: 'You underestimate rent.',
    car: 'You underestimate what a car costs.',
    childcare: 'You underestimate childcare.',
    groceries: 'You underestimate groceries.',
    eatingOut: 'You underestimate eating out.',
    subscriptions: 'You underestimate subscriptions.',
    debtPayments: 'You underestimate debt payments.',
    other: 'You underestimate the everyday extras.',
  } satisfies Record<CostCategory, string>,

  errors: {
    title: 'We couldn’t load today’s duels',
    retry: 'Try again',
  },
} as const;
