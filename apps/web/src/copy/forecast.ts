// Strings for Today and the forecast (S1, S10). Owner: Amir (Y10).
// Functions take values already formatted by the UI (formatMoney / formatRate); no math here.
import type { MoveKind } from '@lifeguessr/types';
import type { VMError } from '@/lib/model/types';

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

export const forecast = {
  screens: {
    S1: 'Today',
    S10: 'You in 10 years',
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
  netWorthIn10y: 'Net worth in 10 years',
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
    /** The hero headline and lead while /play is the slider game (NEXT_PUBLIC_GAME_MODE=slider). */
    title: 'What does their life cost?',
    lead: 'Guess what a stranger’s month costs, then price your own and see your next 10 years.',
    /** The same while /play is the duel (the default). */
    duel: {
      title: 'Which life costs more?',
      lead: 'Pick the costlier of two lives, five times a day. Then price your own month and see your next 10 years.',
      steps: ['Play 5 quick rounds', 'Price your own month', 'See you in 10 years'],
    },
    note: 'No sign-up, no bank login',
    /** Opens the forecast on the sample profile (shown only while the profile is still the sample one). */
    sampleCta: 'Try with sample data',
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
    steps: {
      label: 'How it works',
      items: ['Guess strangers’ months', 'Price your own month', 'See you in 10 years'],
    },
    monthEnd: {
      title: 'This month',
      projected: 'Projected spending',
      /** `asOf` = the day the statement goes up to, e.g. "November 9". */
      fromStatement: (asOf: string) => `From your statement, up to ${asOf}.`,
      fromProfile: 'From your profile.',
      /** There are statements, but none has lines for this month (`month` = "November"). */
      noRowsThisMonth: (month: string) => `No ${month} transactions yet, so this is your usual month.`,
      vsAverage: 'Compared with your 3-month average',
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
      title: 'You in 10 years',
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
      done: 'Done for today. Five new duels tomorrow. Now try your own month.',
      doneCta: 'See your results',
      priceOwn: 'Price my own month',
    },
    /** The game call to action while /play is the slider game (NEXT_PUBLIC_GAME_MODE=slider). */
    play: {
      cta: 'Play today’s homes',
      continue: (played: number, total: number) => `Keep playing (${played} of ${total})`,
      /** Sticker over the score once today's homes are all guessed. */
      doneSticker: 'Today’s homes · done',
      /** The big line once the day is done: homes guessed of today's total. */
      doneScore: (played: number, total: number) => `${played} of ${total}`,
      done: 'Done for today. New homes tomorrow. Now try your own month.',
      doneCta: 'See your results',
      /** Main call to action once the day is done, while the profile is still the sample one. */
      priceOwn: 'Price my own month',
    },
    move: {
      committedTitle: 'Your move',
      topTitle: 'Best move',
      none: 'No move helps right now.',
      markDone: 'I did it',
      seeAll: 'See all moves',
    },
    kicker: 'Daily game',
    inProgress: 'Today’s game is on',
    homes: {
      label: 'Today’s homes',
      home: (n: number) => `Home ${n}`,
      start: 'Start here',
      played: 'Guessed',
      /** Masked price shown before a guess (no number). */
      hidden: '$?,???',
      hiddenLabel: 'Price hidden until you guess',
    },
    tools: {
      title: 'Plan a decision',
      afford: { title: 'Can I Afford It?', body: 'Check a purchase' },
      loan: { title: 'Loan Lab', body: 'Compare loans' },
      decide: { title: 'Decision: the car', body: 'Buy, lease or keep' },
      checkin: { title: 'Monthly check-in', body: 'How the month went' },
      profile: { title: 'Build your profile', body: 'Make the numbers yours' },
      profileEdit: { title: 'Update your profile', body: 'Edit numbers or upload' },
    },
    allScreens: 'All screens',
  },

  /** S10 You in 10 years + Next Moves. */
  future: {
    title: 'You in 10 years',
    headline: 'Your net worth in 10 years',
    todayLabel: 'Today',
    chartTitle: 'Your net worth over the next 10 years',
    seriesLabel: 'Your plan',
    withMoveLabel: (title: string) => `With: ${title}`,
    todaysDollarsToggle: 'Show in today’s dollars',
    compareToggle: (title: string) => `Compare with: ${title}`,
    withMoveIn10y: 'With this move',
    committedIn10y: 'With your plan',
    errorTitle: 'We could not build your forecast.',
    /** Sticker on the illustration: the same 10-year number, compact (`amount` is formatted). */
    artSticker: (amount: string) => `In 10 years · ${amount}`,
    /** After the range line: today's net worth (`amount` is formatted). */
    todayInline: (amount: string) => `today ${amount}`,
    howLink: 'How we calculate',
    backCta: 'Back to Today',
    /** Shown while a new answer is on its way and the numbers on screen are the previous ones. */
    refreshing: 'Updating the forecast…',
  },

  moves: {
    heading: 'Your next best moves',
    rank: (n: number) => `#${n}`,
    intro: 'Ranked by what each adds in 10 years, in today’s dollars.',
    effect: (amount: string) => `${amount} in 10 years`,
    effectLabel: 'Net worth gain in 10 years',
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
      title: 'Level 2 moves',
      locked: 'Commit to or finish a move to unlock.',
      unlocked: 'Unlocked. Coming soon.',
      preview: 'Preview',
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
      'An AI model writes the 10-year numbers and code checks them against our month-by-month simulation; an answer that strays too far is replaced by the simulation’s, labeled. Everything else is our own rules. The simulation’s rates and rules:',
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
