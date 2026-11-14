// Strings for Today and the forecast (S1, S10). Owner: Amir (Y10).
// Functions take values already formatted by the UI (formatMoney / formatRate); no math here.
import type { MoveKind } from '@lifeguessr/types';
import type { VMError } from '@/lib/model/types';
import { yearsPhrase } from './ai';

/** Next Move titles by kind. Level 2 kinds appear only in the locked preview. */
const moveTitles: Record<MoveKind, (category: string) => string> = {
  payCardFirst: () => 'Pay your card down first',
  cutCategory: (category) => `Spend less on ${category.toLowerCase()}`,
  cancelSubscriptions: () => 'Cancel the subscriptions you don’t use',
  retirementMatch: () => 'Collect the full employer match',
  hsa: () => 'Put money in a health savings account',
  refinance: () => 'Move a high-rate debt to a lower rate',
  negotiateRent: () => 'Ask for a lower rent at renewal',
  reshopInsurance: () => 'Compare car insurance quotes',
};

/** "Net worth in 3 years" (singular at 1). The years are the picked horizon (S10 picker, S1). */
const netWorthAt = (years: number) => `Net worth in ${yearsPhrase(years)}`;
/** "You in 3 years" (singular at 1). */
const youIn = (years: number) => `You in ${yearsPhrase(years)}`;

export const forecast = {
  screens: {
    S1: 'Today',
    /** The screen's name in navigation: its title follows the picked year, so this one names no number. */
    S10: 'Your future',
  },

  /** Shared by S1 and S10. */
  loading: 'Loading your numbers…',
  sampleProfile: 'Sample numbers, not yours yet.',
  todaysDollarsNote: 'In today’s dollars.',
  futureDollarsNote: 'In future dollars, before inflation.',
  /**
   * Who made a forecast number (docs/ENGINEERING.md → AI forecast → Labeling). `rulesPreview` labels the
   * ladder's 10-year number (S5–S9), which always comes from the rules engine so it can move as you type.
   */
  source: {
    ai: 'AI estimate',
    rules: 'Rules-based estimate',
    rulesPreview: 'Rules-based preview',
  },
  /**
   * The range band (docs/ENGINEERING.md → Forecast: label it exactly this way). `label` / `explain` /
   * `zero` are the rules forecast's band, made from the numbers we estimated; `model` is the AI
   * forecast's own range.
   */
  band: {
    label: 'Range from the numbers we estimated',
    explain: 'The shaded band covers only the numbers we estimated, not market or inflation risk.',
    zero: 'Every number is yours, so there is no range.',
    model: {
      label: 'Range from the AI model’s own uncertainty',
      explain: 'The shaded band is the AI model’s own range, not a guarantee. It may not narrow as you add real numbers.',
      zero: 'The model gave a single number, with no range.',
    },
    estimatedTitle: 'Numbers we estimated',
    /** Names of estimated inputs (spending categories use common.categories). */
    fields: {
      takeHomePay: 'Take-home pay',
      cash: 'Cash',
      retirement: 'Retirement savings',
      retirementShare: 'Retirement saving rate',
      age: 'Age',
      debtMinPayment: 'Minimum payment on a debt',
    },
    makeExact: 'Make it exact',
  },
  range: (low: string, high: string) => `Likely between ${low} and ${high}`,
  netWorthAt,
  errors: {
    notImplemented: 'This part of the forecast is still being built.',
    unavailable: 'This is not available right now.',
    network: 'We could not reach the server. Check your connection and try again.',
    invalidResponse: 'We got an answer we could not read. Try again.',
    rateLimited: 'Too many requests. Wait a moment and try again.',
    alreadyGuessed: 'Already done.',
    badInput: 'That request was not valid.',
    nothingFound: 'Nothing to show.',
    incomplete: 'Something is missing.',
    unknown: 'Something went wrong.',
  } satisfies Record<VMError['kind'], string>,

  /** S1 Today. */
  today: {
    /** The game card's question while /play is the slider game (NEXT_PUBLIC_GAME_MODE=slider). */
    title: 'What does their life cost?',
    /** The same while /play is the duel (the default). */
    duel: {
      title: 'Which life costs more?',
    },
    /** First visit (no profile, no game yet): what the app is, in one look. No user numbers. */
    firstVisit: {
      title: 'Which life costs more?',
      body: 'Guess what strangers’ lives cost. Then see where yours is going.',
      play: 'Play',
      sample: 'Try with sample data',
      note: 'No sign-up. About a minute.',
      stepsLabel: 'How it works',
      steps: ['Play 5 quick rounds', 'Price your own month', 'See you in 10 years'],
      vs: 'vs',
    },
    monthEnd: {
      title: 'This month',
      projected: 'Projected spending',
      /** `asOf` = the day the statement goes up to, e.g. "November 9". */
      fromStatement: (asOf: string) => `From your statement, up to ${asOf}.`,
      fromProfile: 'From your profile.',
      /** There are statements, but none has lines for this month (`month` = "November"). */
      noRowsThisMonth: (month: string) => `No ${month} transactions yet, so this is your usual month.`,
      /** `amount` is signed: +$240 = spending more than the average. */
      vsAverageValue: (amount: string) => `${amount} vs your 3-month average`,
      driftsTitle: 'Drifting from usual',
      noDrifts: 'Nothing is drifting.',
      /** `amount` is signed: +$80 = more than usual. */
      drift: (category: string, amount: string) => `${category}: ${amount} vs usual`,
      needHistory: (have: number) =>
        `Drift flags need 3 past months of statements (you have ${have}).`,
      /** The 3 months of history are there; only this month's lines are missing. */
      needThisMonth: (month: string) => `Upload ${month}’s statement to see drift flags.`,
      takeHome: 'Take-home pay',
      perMonth: 'per month',
      upload: 'Upload a statement',
    },
    future: {
      title: youIn,
      /** The card's title before the saved horizon is loaded (no year yet, so no wrong one flashes). */
      titleNeutral: 'Your future',
      hint: 'In today’s dollars',
      cta: 'See your forecast',
    },
    /** The game call to action while /play is the duel (the default): rounds, not homes. */
    playDuel: {
      cta: 'Play today’s five',
      continue: (played: number, total: number) => `Keep playing (${played} of ${total})`,
      /** Sticker over the score once today's five rounds are all picked. */
      doneSticker: 'Today’s five · done',
      /** The big line once the day is done: rounds picked of today's total. */
      doneScore: (played: number, total: number) => `${played} of ${total}`,
      doneCta: 'See your results',
    },
    /** The game card while /play is the slider game (NEXT_PUBLIC_GAME_MODE=slider). */
    play: {
      cta: 'Play today’s homes',
      continue: (played: number, total: number) => `Keep playing (${played} of ${total})`,
      /** Sticker over the score once today's homes are all guessed. */
      doneSticker: 'Today’s homes · done',
      /** The big line once the day is done: homes guessed of today's total. */
      doneScore: (played: number, total: number) => `${played} of ${total}`,
      doneCta: 'See your results',
    },
    move: {
      committedTitle: 'Your move',
      none: 'No move helps right now.',
      markDone: 'I did it',
    },
    /** The Home dashboard (returning visits): your house, this month, your next move, today's game, What if?. */
    home: {
      /** The page's h1, as an eyebrow sticker over the 10-year number. */
      title: 'My house',
      /** Under the goal verdict sticker (`target` is formatted). */
      goalLine: (target: string, years: number) => `Goal ${target} in ${years} ${years === 1 ? 'year' : 'years'}`,
      openFuture: 'Open my future',
      move: {
        title: 'Your next move',
        allMoves: 'All moves',
      },
      game: {
        title: 'Today’s game',
        tomorrow: 'Five new duels tomorrow',
        tomorrowHomes: 'New homes tomorrow',
      },
      nudge: {
        /** Still the starting profile (no sample asked for): the numbers are not the user's. */
        demo: 'Sample numbers, not yours yet',
        buildProfile: 'Build your profile',
        estimates: 'Some of your numbers are estimates',
        makeExact: 'Make it exact',
      },
      whatIf: {
        title: 'What if?',
        all: 'All tools',
      },
    },
    allScreens: 'All screens',
  },

  /** S10 You in N years + Next Moves (N = the picked horizon: 1, 3, 5 or 10). */
  future: {
    title: youIn,
    /** The title before the saved horizon is loaded (no year yet, so no wrong one flashes). */
    titleNeutral: 'Your future',
    /** The picker's visible label (a legend); its options are `yearsPhrase(years)`. */
    horizonLabel: 'Look ahead',
    headline: netWorthAt,
    /** The "why" under the headline (amounts already formatted): this month's pay vs what goes out. */
    why: {
      short: (out: string, pay: string, short: string) => `You spend ${out} a month and earn ${pay}, so you’re ${short} short.`,
      left: (out: string, pay: string, left: string) => `You earn ${pay} a month and spend ${out}, so ${left} a month is left over.`,
      runsOut: (months: number) => (months === 1 ? 'Cash runs out this month.' : `Cash runs out in about ${months} months.`),
      lasts: 'At this pace your cash lasts more than 10 years.',
      source: 'From your inputs',
    },
    todayLabel: 'Today',
    chartTitle: (years: number) => `Your net worth over the next ${years === 1 ? 'year' : `${years} years`}`,
    seriesLabel: 'Your plan',
    withMoveLabel: (title: string) => `With: ${title}`,
    todaysDollarsToggle: 'Show in today’s dollars',
    compareToggle: (title: string) => `Compare with: ${title}`,
    /** The number beside them is the net worth at the picked year, so these name no year. */
    withMoveAt: 'With this move',
    committedAt: 'With your plan',
    errorTitle: 'We could not build your forecast.',
    /** Sticker on the illustration: the headline number at the picked year, compact (`amount` is formatted). */
    artSticker: (amount: string, years: number) => `In ${yearsPhrase(years)} · ${amount}`,
    /** After the range line: today's net worth (`amount` is formatted). */
    todayInline: (amount: string) => `today ${amount}`,
    howLink: 'How we calculate',
    /** Shown while a new answer is on its way and the numbers on screen are the previous ones. */
    refreshing: 'Updating the forecast…',
  },

  moves: {
    heading: 'Your next best moves',
    rank: (n: number) => `#${n}`,
    /** `years` is the picked horizon. */
    intro: (years: number) => `Ranked by what each adds in ${yearsPhrase(years)}, in today’s dollars.`,
    /** The intro before the saved horizon is loaded. */
    introNeutral: 'Ranked by what each adds, in today’s dollars.',
    /** `years` is the year the move's own gain is measured at (MoveVM.horizonYears), not the screen's. */
    effect: (amount: string, years: number) => `${amount} in ${yearsPhrase(years)}`,
    effectLabel: (years: number) => `Net worth gain in ${yearsPhrase(years)}`,
    /** Title of a move; `categoryLabel` = common.categories[move.category] when the move has one. */
    title: (kind: MoveKind, categoryLabel?: string) => moveTitles[kind](categoryLabel ?? 'one category'),
    detail: {
      payCardFirst: (amount: string) => `Pay ${amount} a month extra on your highest-rate card.`,
      spendingTo: (category: string, amount: string) => `Bring ${category.toLowerCase()} to ${amount} a month.`,
    },
    committed: 'In my plan ✓',
    commit: 'Add to my plan',
    uncommit: 'Remove from plan',
    markDone: 'I did it',
    why: 'Why?',
    whyLoading: 'Writing the explanation…',
    whyRetry: 'Try again',
    whyTemplate: 'Standard explanation (AI off).',
    whyAi: 'Worded by AI; the numbers are ours.',
    empty: 'No move helps right now. Moves appear when money is left over or a card has a balance.',
    doneCount: (n: number) => (n === 1 ? 'You finished 1 move.' : `You finished ${n} moves.`),
    level2: {
      locked: 'Commit to or finish a move to unlock.',
      unlocked: 'Unlocked. Coming soon.',
      /** The closed summary line of the level 2 preview (`count` = how many moves it holds). */
      summary: (count: number) => `Level 2 · ${count} more moves`,
    },
  },

  /** "How we calculate" panel (S10). */
  how: {
    title: 'How we calculate',
    /** The rules forecast: every number is the engine's. */
    intro: 'One month-by-month simulation: same inputs, same answer. Its rates and rules:',
    /** Before the first answer: it is not yet known who made the numbers. */
    introPending: 'Your forecast is loading; once it is in, this says who made its numbers. The simulation’s rates and rules:',
    /** The AI forecast: the model writes the numbers, code checks them against the simulation. */
    introAi:
      'An AI model writes the yearly numbers for the next 10 years and code checks them against our month-by-month simulation; an answer that strays too far is replaced by the simulation’s, labeled. Everything else is our own rules. The simulation’s rates and rules:',
    forecastTitle: 'Forecast',
    movesTitle: 'Next moves',
    assumption: 'our assumption',
    assumptionHint: 'A default we chose, not a published figure.',
    labels: {
      inflation: 'Inflation',
      incomeGrowth: 'Pay growth',
      returnAnnualNominal: 'Return on savings and retirement',
      cashYieldAnnual: 'Interest on cash',
      cardAprDefault: 'Card interest rate when you skip it',
      cardMinPayment: 'Card minimum payment when you skip it',
      retirementShareDefault: 'Share of leftover money saved for retirement',
      estimateSpread: 'Range for each estimated number',
      payCardExtraShareOfSurplus: 'Extra card payment: share of what is left each month',
      payCardExtraStep: 'Extra card payment rounded down to',
      cutCategoryShare: 'Cut to the biggest flexible category',
      cancelSubscriptionsShare: 'Subscriptions cancelled',
    },
    values: {
      ratePerYear: (rate: string) => `${rate} a year`,
      share: (rate: string) => rate,
      spread: (rate: string) => `± ${rate}`,
      money: (amount: string) => amount,
      sameAsInflation: 'Same as inflation (your pay keeps up with prices)',
      cardMinPayment: (share: string, floor: string) => `Interest + ${share} of the balance, at least ${floor}`,
    },
  },
} as const;
