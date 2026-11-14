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
    title: 'Today',
    /** First visit (no profile, no game yet): what the app is, in one look. No user numbers. */
    firstVisit: {
      title: 'Know your number.',
      body: 'See what you’re worth today, what you’ll be worth in 10 years, and which decisions change it.',
      play: 'Play: guess a stranger’s month',
      sample: 'See a sample life',
      note: 'No sign-up. No bank login.',
      tour: 'Take the 2-minute tour',
      stepsLabel: 'How it works',
      steps: [
        { title: 'Guess strangers’ lives', body: 'Peek inside a home and guess what that life costs a month.' },
        { title: 'Guess your own', body: 'Price your own month, then make it exact with a statement.' },
        { title: 'See your number and moves', body: 'Your net worth in 10 years and the moves that raise it, in dollars.' },
      ],
      /** The sample-life card: every number computed by the rules engine on the demo profile. */
      card: {
        title: 'Sample life',
        computed: 'Sample life, computed by the rules engine',
        who: (age: number, takeHome: string) => `Age ${age}, ${takeHome} a month take-home, a card balance and a car loan.`,
        month: 'Her month',
        monthHint: 'Spending + debt payments',
        today: 'Net worth today',
        number: (year: number) => `Her number in ${year}`,
        goal: (target: string, year: number) => `Goal: ${target} by ${year}`,
        moves: 'Top moves',
        moveEffect: (amount: string) => `${amount} to her number`,
        cta: 'Open this life',
      },
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
    play: {
      title: 'Guess their month',
      cta: 'Play today’s homes',
      continue: (played: number, total: number) => `Keep playing (${played} of ${total})`,
      done: 'Done for today. New homes tomorrow.',
      doneCta: 'See your results',
    },
    move: {
      committedTitle: 'Your move',
      topTitle: 'Best move',
      none: 'No move helps right now.',
      markDone: 'I did it',
      seeAll: 'See all moves',
    },
    kicker: 'Daily game',
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
    headline: 'Net worth in 10 years',
    todayLabel: 'Today',
    /** The "Your number" hero: the rules forecast (never the AI one), today's dollars. */
    hero: {
      number: (year: number) => `Your number in ${year}`,
      today: 'Today',
      source: 'Rules forecast, today’s dollars',
      goal: (target: string, year: number) => `Goal: ${target} by ${year}`,
      sampleGoal: (target: string, year: number) => `Sample goal: ${target} by ${year}`,
      /** gap > 0: short of the goal at the projected middle. */
      short: (amount: string) => `${amount} short`,
      /** gap <= 0: the projected middle reaches the goal. */
      ahead: (amount: string) => `${amount} ahead`,
      verdict: {
        onTrack: 'On track',
        withinRange: 'Within range',
        behind: 'Behind',
      },
    },
    chartTitle: 'Your net worth over the next 10 years',
    seriesLabel: 'Your plan',
    withMoveLabel: (title: string) => `With: ${title}`,
    todaysDollarsToggle: 'Show in today’s dollars',
    compareToggle: (title: string) => `Compare with: ${title}`,
    withMoveIn10y: 'With this move',
    committedIn10y: 'With your committed move',
    errorTitle: 'We could not build your forecast.',
    /** Sticker on the illustration (no number: the amounts are shown once, above and in the moves). */
    artSticker: 'If nothing changes',
    backCta: 'Back to Today',
    /** Shown while a new answer is on its way and the numbers on screen are the previous ones. */
    refreshing: 'Updating the forecast…',
  },

  moves: {
    heading: 'Next moves',
    rank: (n: number) => `#${n}`,
    intro: 'Ranked by 10-year gain, in today’s dollars.',
    effect: (amount: string) => `${amount} to your number`,
    effectLabel: 'To your number in 10 years',
    /** Title of a move; `categoryLabel` = common.categories[move.category] when the move has one. */
    title: (kind: MoveKind, categoryLabel?: string) => moveTitles[kind](categoryLabel ?? 'one category'),
    detail: {
      payCardFirst: (amount: string) => `Pay ${amount} a month extra on your highest-rate card.`,
      spendingTo: (category: string, amount: string) => `Bring ${category.toLowerCase()} to ${amount} a month.`,
    },
    committed: 'You committed to this',
    commit: 'I’m doing this',
    uncommit: 'Not now',
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
