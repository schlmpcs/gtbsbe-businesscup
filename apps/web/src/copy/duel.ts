// Strings for the duel game (S2 Duel round, S3 Reveal, S3 Day result): "Which life costs more?".
// Functions here only pick words; every number arrives already computed (and formatted).
// The fixed lesson and blind-spot templates live here too: code fills them, never an LLM.
import type { DuelLessonId } from '@lifeguessr/engine';
import {
  DUEL_CROWD_MIN_PICKS, type AreaData, type CostCategory, type DuelFactGroupId, type DuelLetter, type KidAge,
} from '@lifeguessr/types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type DuelTileColor = 'green' | 'yellow' | 'ink';
export type DuelShareStatus = 'idle' | 'sharing' | 'shared' | 'copied' | 'failed';
export type DuelCopyStatus = 'idle' | 'copied' | 'failed';
/** US Census region of a card's state (lib/duel/publicDuelCard); `unknown` when the metro names none. */
export type DuelRegion = 'northeast' | 'midwest' | 'south' | 'west' | 'unknown';

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
  /**
   * Opening a challenge link (/duel?c=…). Numbers arrive formatted. The friend's score shows before
   * and during play ("the target"); the comparison with yours shows on the day result.
   */
  challenge: {
    /** The link names no day we can read (unknown id, unfinished day, the server didn't answer). */
    generic: 'A friend challenged you. Beat their score on today’s five.',
    friendScore: (right: number, total: number, points: string) => `Your friend got ${right}/${total} · ${points} points`,
    /** The link is from another day: its five duels are gone, so there is nothing to compare. */
    earlier: (date: string) => `This challenge was for ${date}. Here are today’s five.`,
    heading: 'You vs your friend',
    /** The day result's headline: both scores in one line. */
    headline: (you: number, friend: number, total: number) => `You ${you}/${total} · Friend ${friend}/${total}`,
    outcome: {
      ahead: 'You beat your friend.',
      tied: 'You and your friend tied.',
      behind: 'Your friend is ahead.',
    },
    you: 'You',
    friend: 'Friend',
    friendGridLabel: 'Your friend’s five rounds',
  },
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
    hintGroup: 'Neighborhood',
    /** The flavor caption, shown as a quote line under the facts. */
    quote: (caption: string) => `“${caption}”`,
  },
  vs: 'VS',

  hint: {
    offer: (cost: string) => `Hint: one more fact each · −${cost}`,
    /** Under the hint button: what it opens, without saying which way it points. */
    explain: 'Shows each life’s neighborhood price level.',
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
    /** The side-by-side panel under the cards: both totals, then every category for A and B. */
    compareHeading: 'Side by side',
    compareSub: 'Every monthly cost, life A vs life B.',
    compareLabel: 'Monthly costs by category, life A and life B',
    compareRow: (a: string, b: string) => `: life A ${a}, life B ${b} a month`,
    decidedTag: 'Biggest gap',
    decidedHeading: 'What decided it',
    /** The ink band's headline: the deciding category, the costlier life's amount vs the other's. */
    decidedLine: (category: string, amount: string, other: string) =>
      `What decided it: ${category.toLowerCase()}, ${amount} vs ${other}`,
    crowd: (share: string, letter: DuelLetter, total: string) => `${share} picked ${letter}, from ${total} picks`,
    crowdNone: 'Not enough picks yet',
    /**
     * In the sources panel, the reveal's "how we calculate": what the crowd line counts. It says
     * outright that the player's own pick is in it, so nobody reads "61% picked A" as "61% of the
     * others agreed with me". It does not repeat crowdNone word for word: the reveal shows both at
     * once, and the same sentence twice reads like a glitch.
     */
    crowdHowHeading: 'How we count the crowd',
    crowdHow: `Every pick stored for this round today, one per player, yours included. The share shows once ${DUEL_CROWD_MIN_PICKS} players have picked.`,
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
  /**
   * The card's fact lines, two per group (Home, Family, Car, Food). Word facts read off the LifeCard
   * only: never a dollar amount, a total or the neighborhood's price level (that is the hint).
   * Avoid the tier words (cheap, mid, expensive, suburb): the leak test refuses them on a card.
   */
  facts: {
    groups: { home: 'Home', family: 'Family', car: 'Car', food: 'Food' } satisfies Record<DuelFactGroupId, string>,
    /** "Rental": costOfLife prices every card as a renter today (see lib/duel/publicDuelCard). */
    home: (bedrooms: number) => (bedrooms === 0 ? 'Studio rental' : `${bedrooms}-bedroom rental`),
    region: {
      northeast: 'In the Northeast',
      midwest: 'In the Midwest',
      south: 'In the South',
      west: 'In the West',
      unknown: 'Somewhere in the US',
    } satisfies Record<DuelRegion, string>,
    noKids: 'No kids',
    livesSolo: 'Lives solo',
    couple: 'A couple',
    kidAge: { infant: 'baby', toddler: 'toddler', preschool: 'preschooler', schoolAge: 'school-age' } satisfies Record<KidAge, string>,
    /** The kids' ages youngest first, a count before a repeated age: "Kids: baby, 2 school-age". */
    kids: (ages: readonly { age: string; count: number }[]) =>
      `${ages.length === 1 && ages[0]!.count === 1 ? 'Kid' : 'Kids'}: ${ages.map((a) => (a.count > 1 ? `${a.count} ${a.age}` : a.age)).join(', ')}`,
    /** A fact about age (who is too young for school), never about what care costs. */
    notInSchool: (young: number, kids: number) =>
      kids === 1 ? 'Not in school yet' : young === kids ? 'None in school yet' : `${young} of ${kids} not in school yet`,
    allInSchool: (n: number) => (n === 1 ? 'In school' : 'All in school'),
    noCar: 'No car',
    noCarLoan: 'No car loan',
    economyCar: 'Economy car',
    midCar: 'Midsize car',
    luxuryCar: 'Luxury car',
    paidInFull: 'Paid in full',
    financed: (termMonths: number) =>
      termMonths % 12 === 0 ? `Financed, ${termMonths / 12}-year loan` : `Financed, ${termMonths}-month loan`,
    eatsOut: (perWeek: number) => (perWeek <= 0 ? 'Never eats out' : `Eats out ${perWeek}×/week`),
    groceriesFor: (people: number) => (people === 1 ? 'Groceries for one' : `Groceries for ${people}`),
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
