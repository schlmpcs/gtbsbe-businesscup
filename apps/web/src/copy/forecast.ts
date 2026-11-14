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
  sampleProfile: 'These numbers are for a sample life, not yours yet.',
  todaysDollarsNote: 'In today’s dollars: prices grow every year, so we show what the money would buy now.',
  futureDollarsNote: 'In future dollars: the amounts you would see on a statement then, before inflation.',
  /** The range band (docs/ENGINEERING.md → Forecast: label it exactly this way). */
  band: {
    label: 'Range from the numbers we estimated',
    explain:
      'The shaded band is the range from the numbers we estimated. It shows uncertainty in your inputs only, not market or inflation risk.',
    zero: 'Every number is yours, so there is no range: nothing was estimated.',
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
    intro: 'Your month, your next 10 years, and the best move to make next.',
    monthEnd: {
      title: 'This month',
      projected: 'Projected spending this month',
      fromStatement: 'Projected from your statement so far this month.',
      fromProfile: 'From the monthly spending in your profile. Upload a statement to track the month as it goes.',
      vsAverage: 'Compared with your 3-month average',
      /** `amount` is signed: +$240 = spending more than the average. */
      vsAverageValue: (amount: string) => `${amount} vs your 3-month average`,
      driftsTitle: 'Drifting from your usual',
      noDrifts: 'No category is drifting from your usual.',
      /** `amount` is signed: +$80 = more than usual. */
      drift: (category: string, amount: string) => `${category}: ${amount} vs usual`,
      needHistory: (have: number) =>
        `Drift flags need 3 months of statements to know your usual. You have ${have === 0 ? 'none' : have === 1 ? '1 month' : `${have} months`} so far, so this shows the projection only.`,
      takeHome: 'Take-home pay',
      perMonth: 'per month',
      upload: 'Upload a statement',
    },
    future: {
      title: 'You in 10 years',
      hint: 'Net worth, in today’s dollars',
      cta: 'See the forecast and your next moves',
    },
    play: {
      title: 'Today’s homes',
      cta: 'Play today’s homes',
      continue: (played: number, total: number) => `Keep playing (${played} of ${total})`,
      done: 'You played today’s homes. New ones tomorrow.',
      doneCta: 'See your results',
      pitch: 'Five homes. Guess what each life costs a month.',
    },
    move: {
      committedTitle: 'Your move',
      topTitle: 'Best move right now',
      none: 'No move helps right now. Moves show up when you have money left over or a card balance to pay down.',
      markDone: 'I did it',
      seeAll: 'See all moves',
    },
    kicker: 'Daily game',
    kickerNote: 'Same homes for everyone today. New ones tomorrow.',
    homes: {
      label: 'Today’s homes',
      home: (n: number) => `Home ${n}`,
      start: 'Start here',
      played: 'Guessed',
      /** Masked price shown before a guess (no number). */
      hidden: '$?,???',
      hiddenLabel: 'Price hidden until you guess',
    },
    score: {
      label: 'Your day at a glance',
      played: 'homes played today',
      playedValue: (played: number, total: number) => `${played}/${total}`,
      in10y: 'net worth in 10 years',
      month: 'projected spending this month',
      move: 'your best move adds in 10 years',
    },
    tools: {
      title: 'Plan a decision',
      afford: { title: 'Can I Afford It?', body: 'Check a purchase against this month and the next 10 years.' },
      loan: { title: 'Loan Lab', body: 'Compare loans side by side and see the debt load.' },
      profile: { title: 'Build your profile', body: 'Guess your own month, then make the numbers yours.' },
      profileEdit: { title: 'Update your profile', body: 'Change your numbers or upload a statement.' },
    },
    allScreens: 'All screens',
  },

  /** S10 You in 10 years + Next Moves. */
  future: {
    title: 'You in 10 years',
    intro: 'Where your money goes from here if nothing changes, and what the best moves would do.',
    headline: 'Net worth in 10 years',
    todayLabel: 'Today',
    chartTitle: 'Your net worth over the next 10 years',
    seriesLabel: 'Your plan',
    withMoveLabel: (title: string) => `With: ${title}`,
    todaysDollarsToggle: 'Show in today’s dollars',
    compareToggle: (title: string) => `Compare with: ${title}`,
    compareCommittedNote: 'The move you committed to.',
    compareTopNote: 'Your best move right now.',
    withMoveIn10y: 'With this move',
    committedIn10y: 'With your committed move',
    errorTitle: 'We could not build your forecast.',
    /** Sticker on the illustration: what the compared move adds (amount already signed). */
    artSticker: (amount: string, committed: boolean) => `${amount} from ${committed ? 'your move' : 'your top move'}`,
    artStickerNone: 'Your next 10 years',
    backCta: 'Back to Today',
  },

  moves: {
    heading: 'Next moves',
    rank: (n: number) => `#${n}`,
    intro: 'Ranked by what each one adds to your net worth in 10 years, in today’s dollars.',
    effect: (amount: string) => `${amount} in 10 years`,
    effectLabel: 'Added to your net worth in 10 years',
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
    whyTemplate: 'Standard explanation (the AI writer is off).',
    whyAi: 'Written by AI from the numbers above; it adds no numbers of its own.',
    empty: 'No move helps right now. Moves show up when you have money left over each month or a card balance to pay down.',
    doneCount: (n: number) => (n === 1 ? 'You finished 1 move.' : `You finished ${n} moves.`),
    level2: {
      title: 'Level 2 moves',
      locked: 'Locked. Commit to a move above, or finish one, to unlock the next level.',
      unlocked: 'Unlocked. These need a few more details from you, coming soon.',
      preview: 'Preview',
    },
  },

  /** "How we calculate" panel (S10). */
  how: {
    title: 'How we calculate',
    intro:
      'Every number comes from the same simulation, month by month for 10 years. Same inputs, same answer, every time. These are the rates and rules it uses.',
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
