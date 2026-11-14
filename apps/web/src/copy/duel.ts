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
  subtitle: 'Tap one. Everything in: rent, car, kids, food.',
  loading: 'Loading today’s duels…',
  round: (n: number, total: number) => `Round ${n} of ${total}`,
  /** The ink sticker over the question: the round and what a right pick scores now. */
  roundSticker: (n: number, total: number, points: string) => `Round ${n} of ${total} · ${points} pts`,
  roundDots: {
    label: 'Rounds',
    dot: (n: number, state: string) => `Round ${n}: ${state}`,
    state: { current: 'now', upcoming: 'to play', green: 'right', yellow: 'right with a hint', ink: 'missed' },
  },
  challenged: 'A friend challenged you. Beat their score on today’s five.',
  /** The day on screen ended mid-play (after midnight in New York); these are the new day's duels. */
  newDay: 'A new day started at midnight in New York. Here are today’s five.',
  /** S1's "All screens" list when /play is the duel (S2/S3 are its states). */
  screens: { S2: 'Which life costs more?', S3: 'Duel reveal' },
  /** The small muted footer under the duel: what the lives are, and where the round is scored. */
  footer: {
    composite: 'Composite households, real local prices.',
    /** Only while the duel plays in the browser (NEXT_PUBLIC_DUEL_SOURCE=fixtures). */
    browser: 'Scored in your browser with our cost engine.',
  },

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
    offer: (cost: string) => `Hint: one more fact each · −${cost}`,
    used: (points: string) => `Hint used · now worth ${points}`,
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
    /** The ink band's headline: the deciding category, the costlier life's amount vs the other's. */
    decidedLine: (category: string, amount: string, other: string) =>
      `What decided it: ${category.toLowerCase()}, ${amount} vs ${other}`,
    crowd: (share: string, letter: DuelLetter, total: string) => `${share} picked ${letter}, from ${total} picks`,
    crowdNone: 'Not enough picks yet',
    perMonth: '/ month',
    sources: 'Sources →',
    sourceShort: (name: string, year: number) => `${name}, ${year}`,
    next: 'Next round →',
    finish: 'See my day →',
    disclaimer: 'Educational simulation, not financial advice.',
  },

  summary: {
    heading: 'Today’s five',
    score: (right: number, total: number) => `${right} of ${total}`,
    scoreLabel: 'Right picks',
    points: (points: string) => `${points} points`,
    pointsLabel: 'Total points',
    gridLabel: 'Your five rounds',
    tile: { green: 'right', yellow: 'right with a hint', ink: 'missed' } satisfies Record<DuelTileColor, string>,
    tileLabel: (round: number, result: string) => `Round ${round}: ${result}`,
    legend: 'Green right · Yellow right with a hint · Black missed',
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
    ctaEyebrow: 'Now you’re up',
    ctaLead: 'What does your month cost?',
    nextIn: (hours: number, minutes: number) => `Next five in ${hours}h ${minutes}m`,
  },

  share: {
    header: (date: string) => `LifeGuessr · Which life costs more? ${date}`,
    tiles: { green: '🟩', yellow: '🟨', ink: '⬛' } satisfies Record<DuelTileColor, string>,
    score: (right: number, total: number, points: string) => `${right}/${total} · ${points} points`,
    /** The PNG's file name when the share sheet gets the image (GET /api/share, 9:16). */
    fileName: (date: string) => `lifeguessr-duel-${date}.png`,
  },

  /**
   * The duel's share card PNG (GET /api/share, 9:16 and 1:1). Its title, score, points and legend
   * reuse `title` and `summary` above, so the image says exactly what the day result says.
   */
  shareCard: {
    brand: 'LifeGuessr',
    daily: (date: string) => `Daily duel · ${date}`,
    /** Only on a day still being played: the card shows the rounds picked so far. */
    played: (played: number, total: number) => `${played} of ${total} rounds played so far`,
    cta: 'Guess which life costs more. Five new duels daily.',
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
