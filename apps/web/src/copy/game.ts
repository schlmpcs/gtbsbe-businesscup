// Strings for the daily game (S2–S4). Owner: Amir (Y8).
// Functions here only pick words; every number arrives already computed (and usually formatted).
import type { AreaData, ClueId, KidAge, SceneLayout } from '@lifeguessr/types';

type Tier = AreaData['tier'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const kidAges: Record<KidAge, string> = {
  infant: 'infant',
  toddler: 'toddler',
  preschool: 'preschooler',
  schoolAge: 'school-age kid',
};

export const game = {
  screens: {
    S2: 'Explore the home',
    S3: 'Reveal',
    S4: 'Streamer mode',
  },

  /** "Home 2 of 5". */
  progress: (n: number, total: number) => `Home ${n} of ${total}`,
  loading: 'Loading today’s homes…',
  errors: {
    title: 'We couldn’t load today’s homes',
    retry: 'Try again',
    clue: 'That room didn’t open. Tap to try again.',
    guess: 'Your guess didn’t go through.',
    guessRetry: 'Try again',
    alreadyGuessed: 'You already guessed this home today.',
    /** By VMError kind. */
    byKind: {
      notImplemented: 'This part of the game is still being built.',
      unavailable: 'The game server isn’t available right now.',
      network: 'Check your connection and try again.',
      invalidResponse: 'The game server sent something we didn’t expect.',
      rateLimited: 'Too many requests. Wait a moment and try again.',
      alreadyGuessed: 'You already guessed this home today.',
      badInput: 'The game server rejected that request.',
      nothingFound: 'Nothing found.',
      incomplete: 'Something is missing from that request.',
      unknown: 'Something went wrong.',
    },
  },

  // ----- S2: the home -----
  home: {
    label: 'The home',
    layouts: {
      studio: 'Studio',
      '1bed': '1-bedroom',
      '2bed': '2-bedroom',
      '3bed': '3-bedroom',
      '4bed': '4-bedroom',
    } satisfies Record<SceneLayout, string>,
    metro: 'Metro',
    layout: 'Layout',
    decor: 'Around the house',
    /** A decor sprite id ('decor/plant') as words; decor never implies a cost. */
    decorItem: (sprite: string) => (sprite.split('/').pop() ?? sprite).replace(/[-_]/g, ' '),
  },
  multiplier: {
    label: 'Score multiplier',
    /** "Opening a room costs 10% of your points." */
    cost: (pct: string) => `Opening a room costs ${pct} of your points.`,
    floor: 'Your multiplier is at its floor: more rooms are free now.',
  },
  clues: {
    heading: 'Look around',
    intro: 'Tap a room to see a clue. Each one lowers your score multiplier.',
    rooms: {
      garage: 'Garage',
      kidsRoom: 'Kids’ room',
      kitchen: 'Kitchen',
      entry: 'Entry',
      mailbox: 'Mailbox',
    } satisfies Record<ClueId, string>,
    closedHint: (pct: string) => `Tap to look (−${pct} points)`,
    closedFreeHint: 'Tap to look (free)',
    opening: 'Opening…',
    opened: 'Opened',
    lockedHint: 'Locked in',
  },
  facts: {
    noCar: 'No car: a bike and a bus pass.',
    car: (price: string) => `A ${price} car, paid in cash.`,
    carFinanced: (price: string, months: number, apr: string) =>
      `A ${price} car on a ${months}-month loan at ${apr} APR.`,
    noKids: 'No kids: the room is a home office.',
    kids: (ages: KidAge[]) => `${plural(ages.length, 'kid', 'kids')}: ${ages.map((a) => kidAges[a]).join(', ')}.`,
    eatingOut: (perWeek: number) => `Takeout and restaurants about ${plural(perWeek, 'time', 'times')} a week.`,
    household: (adults: number, kids: number) =>
      kids > 0
        ? `Coats for ${plural(adults, 'adult', 'adults')} and ${plural(kids, 'kid', 'kids')}.`
        : `Coats for ${plural(adults, 'adult', 'adults')}.`,
    zip: (zip: string) => `ZIP code ${zip}.`,
    zipTier: (zip: string, tier: Tier) => `ZIP code ${zip}, ${tierNames[tier]} neighborhood.`,
  },

  // ----- S2: the guess -----
  guess: {
    heading: 'What does their month cost?',
    slider: 'Monthly cost of living',
    hint: 'Rent, car, childcare, food and the rest, per month.',
    input: 'Or type it',
    inputSuffix: '/mo',
    lockIn: (amount: string) => `Lock in ${amount}`,
    locking: 'Locking in…',
  },

  // ----- S4: streamer -----
  streamer: {
    countdown: 'Time left',
    seconds: (n: number) => `${n}s`,
    secondsLabel: (n: number) => plural(n, 'second', 'seconds') + ' left',
    start: 'Start countdown',
    pause: 'Pause',
    reset: 'Reset',
    autoLock: 'At zero your guess locks in.',
    lockedIn: 'Locked in. Revealing…',
  },

  // ----- S3: the reveal -----
  reveal: {
    actualLabel: 'Their month',
    actualHint: 'Most likely, per month',
    range: (low: string, high: string) => `Typical range ${low} to ${high}`,
    yourGuess: 'Your guess',
    direction: {
      low: 'You guessed low.',
      in: 'In range!',
      high: 'You guessed high.',
    },
    scaleLabel: (guess: string, low: string, high: string) =>
      `Your guess ${guess} against the typical range ${low} to ${high}`,
    scaleRange: 'Typical range',
    scaleMid: 'Most likely',
    points: 'Points',
    pointsOf: (points: string, max: string) => `${points} / ${max}`,
    pointsDetail: (base: string, multiplier: string, clues: number) =>
      `${base} base points × ${multiplier} for ${plural(clues, 'room', 'rooms')} opened`,
    surprise: (category: string, share: string) => `${category} was ${share} of their month.`,
    breakdownHeading: 'Where the money goes',
    breakdownLabel: 'Monthly costs by category',
    sourcesHeading: 'Where these numbers come from',
    whoLivedHere: 'Who lived here',
    next: 'Next home →',
    finish: 'See your results →',
    shareCard: 'Share card (9:16)',
    shareCardSquare: 'Share card (square)',
  },

  // ----- after 5 homes -----
  summary: {
    heading: 'Your five lives',
    gridLabel: 'Your results, one tile per home',
    tile: (n: number, result: string, points: string) => `Home ${n}: ${result}, ${points} points`,
    tileResult: { green: 'in range', yellow: '500 points or more', red: 'under 500 points' },
    total: 'Total',
    bridge: (low: number, played: number) => `You guessed low on ${low} of ${played}.`,
    bridgeDetail: (inRange: number, high: number) => `In range on ${inRange}, high on ${high}.`,
    cta: 'Now guess your own life →',
    share: 'Share',
    shareStatus: {
      idle: '',
      sharing: 'Sharing…',
      shared: 'Shared.',
      copied: 'Copied to your clipboard.',
      failed: 'Couldn’t share. Copy the text below.',
    },
    shareTextLabel: 'Text to share',
    clipCard: 'Clip card of your most surprising home (9:16)',
  },

  /** The spoiler-free share grid (PRODUCT.md → Game design): 🟩 in range, 🟨 500+ points, 🟥 below. */
  share: {
    header: (date: string) => `LifeGuessr ${date}`.trim(),
    tiles: { green: '🟩', yellow: '🟨', red: '🟥' },
    score: (points: string, max: string) => `${points} / ${max}`,
  },
} as const;

const tierNames: Record<Tier, string> = {
  cheap: 'a lower-cost',
  mid: 'a mid-priced',
  expensive: 'an expensive',
  suburb: 'a suburban',
};
