// Strings for the "guess yourself" ladder (S5–S9 UI). Owner: Amir (Y9).
// S9's screen title lives in ./upload.ts (T6/T7); the S9 screen's own strings are under `upload` here.
import type { Debt, KidAge } from '@lifeguessr/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** 'YYYY-MM' → "Oct 2026" (falls back to the raw text when it is not a month). */
function monthName(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  const name = m ? MONTH_NAMES[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${m[1]}` : month;
}

const debtKinds: Record<Debt['kind'], string> = {
  card: 'Credit card',
  auto: 'Car loan',
  student: 'Student loan',
  personal: 'Personal loan',
  bnpl: 'Buy now, pay later',
  mortgage: 'Mortgage',
};

const kidAges: Record<KidAge, string> = {
  infant: 'infant',
  toddler: 'toddler',
  preschool: 'preschooler',
  schoolAge: 'school-age kid',
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** 'YYYY-MM-DD' → "Oct 3, 2026" (falls back to the raw text when it is not a date). */
function dayName(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const name = m ? MONTH_NAMES[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${Number(m[3])}, ${m[1]}` : date;
}

export const ladder = {
  /** Screen titles (also each rung's h1, as in the Figma frames). */
  screens: {
    S5: 'Now price your own life',
    S6: 'Which life looks like yours?',
    S7: 'Make it yours',
    S8: 'Six quick numbers',
  },

  /** Shared frame of every rung: progress, the 10-year number and its range band, the CTA. */
  shell: {
    intro: {
      S5: 'Rent, food, car, fun: everything in a normal month. Gut feeling, nothing to look up.',
      S6: 'Pick one as your starting point. You can change every number next.',
      S7: 'Move the sliders to your real numbers. Untouched numbers stay marked as an estimate.',
      S8: 'Skip any. We’ll use a typical amount and mark it as an estimate.',
      S9: 'Add a bank statement and we swap our guesses for your real numbers.',
    },
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    optional: 'Optional',
    progressTitle: 'Your forecast so far',
    stepsLabel: 'Steps to your forecast',
    rungs: {
      S5: 'Guess yourself',
      S6: 'Closest life',
      S7: 'Quick sliders',
      S8: 'Balance sheet',
      S9: 'Statement',
    },
    done: 'done',
    notYet: 'not yet',
    current: 'this step',
    stepsDone: (done: number, total: number) => `${done} of ${total} steps done`,
    in10yLabel: 'You in 10 years',
    in10yHint: 'Net worth in today’s dollars, if nothing changes.',
    range: (low: string, high: string) => `Likely range ${low} to ${high}`,
    bandNote: 'The range comes only from the numbers we estimated. Each real number you add narrows it.',
    narrowedLabel: 'Range narrowed by your numbers',
    narrowed: (share: string) => `${share} narrower than with every number estimated`,
    estimatesLeft: (left: number, total: number) =>
      left === 0 ? `All ${total} inputs are your own numbers.` : `${left} of ${total} inputs are still estimates.`,
    futureCta: 'See your future →',
    next: (title: string) => `Next: ${title} →`,
    loading: 'Loading your numbers…',
  },

  guess: {
    sliderLabel: 'What does your life cost a month?',
    aMonth: 'a month',
    sliderHint: 'Rent, car, childcare, food, subscriptions, debt payments and everything else.',
    bridgeLabel: 'Your guesses in today’s game',
    bridgeOf: (n: number, played: number) => `${n} of ${played}`,
    bridgeLow: (played: number) => `${played === 1 ? 'home' : 'homes'} you priced too low today`,
    bridgeHigh: (played: number) => `${played === 1 ? 'home' : 'homes'} you priced too high today`,
    bridgeNone: 'Same slider as the game: one guess, no peeking.',
    submit: 'Lock in my guess',
    update: 'Update my guess',
    saved: 'Saved',
    compareTitle: 'Your guess vs. our estimate',
    yourGuess: 'Your guess',
    ourEstimate: 'Our estimate',
    perMonth: 'per month',
    basis: {
      demo: 'Our estimate is for a sample profile until you add your own numbers on the next steps.',
      closestLife: 'Our estimate is for the life you picked, with its typical numbers.',
      user: 'Our estimate uses the numbers you have entered so far.',
    },
    above: (amount: string, share: string) => `You guessed ${amount} (${share}) more than our estimate.`,
    below: (amount: string, share: string) => `You guessed ${amount} (${share}) less than our estimate.`,
    exact: 'Spot on: your guess matches our estimate.',
  },

  closest: {
    sortedByGuess: (guess: string) => `Sorted by how close each life is to your guess of ${guess} a month.`,
    unsorted: 'No guess yet, so these are in the game’s order.',
    listLabel: 'Lives to start from',
    fromToday: 'From today’s game',
    sample: 'Sample life',
    nearest: 'Closest to your guess',
    chosen: 'That’s me',
    household: (adults: 1 | 2, kids: readonly KidAge[], bedrooms: number) => {
      const people = adults === 1 ? '1 adult' : '2 adults';
      const kidText = kids.length === 0 ? 'no kids' : kids.map((k) => kidAges[k]).join(', ');
      const home = bedrooms === 0 ? 'studio' : `${bedrooms}-bedroom home`;
      return `${people}, ${kidText}, ${home}`;
    },
    car: (price: string) => `Car worth ${price}`,
    noCar: 'No car',
    perMonth: (amount: string) => `≈ ${amount} a month`,
    monthlyRange: (low: string, high: string) => `Range ${low} to ${high}`,
    costsToggle: 'See the costs and sources',
    costsLabel: (metro: string) => `Monthly costs for the ${metro} life`,
    choose: 'Start from this life',
    chooseLabel: (metro: string, caption: string) => `Start from this life: ${metro}, ${caption}`,
    chosenNote: 'Every number in your profile is an estimate for now. The next steps replace them with yours.',
    unavailable: 'We don’t have area data for this life yet, so it can’t be a starting point.',
  },

  sliders: {
    monthTitle: 'Your month',
    moreThanGuessed: (amount: string) => `+${amount} more than you guessed`,
    lessThanGuessed: (amount: string) => `${amount} less than you guessed`,
    breakdownLabel: 'This month by category',
    takeHome: 'Take-home pay',
    spending: 'Spending',
    debtPayments: 'Debt payments',
    surplus: 'Left over',
    shortfall: 'Short',
    vsGuess: (cost: string, guess: string) => `Your month costs ${cost}. You guessed ${guess}.`,
    noGuess: (cost: string) => `Your month costs ${cost}.`,
    slidersTitle: 'Monthly spending',
    slidersLabel: 'Spending by category',
    carHint: 'Insurance, fuel and upkeep. Car loan payments go on the balance sheet.',
    rentHint: 'Rent plus utilities.',
    savingsLabel: 'Share of what’s left over saved for retirement',
    savingsHint: 'Each month, this share of any money left over goes to retirement; the rest stays in cash.',
    perMonth: (amount: string) => `${amount}/mo`,
    describe: {
      title: 'Or describe your life',
      label: 'Describe your month in your own words',
      placeholder: 'I pay 1,800 rent, spend about 500 on groceries and eat out twice a week.',
      hint: 'We read the numbers from your text and show them to you before anything changes.',
      submit: 'Fill in from my words',
      parsing: 'Reading…',
      confirmTitle: 'Is this right?',
      confirmNote: 'We read these numbers from what you typed. Nothing changes until you confirm.',
      inferred: 'inferred',
      inferredHint: 'Not written in your text: we worked it out. Check it.',
      was: (value: string) => `now ${value}`,
      wasUnknown: 'not set',
      confirm: 'Use these numbers',
      discard: 'Discard',
      dismiss: 'OK, I’ll use the sliders',
      rowLabel: {
        retirementShare: 'Saved for retirement (share of what’s left over)',
        debtApr: (kind: string) => `${kind} APR`,
        debtExtraPayment: (kind: string) => `Extra payment on ${kind.toLowerCase()}`,
        unknownDebt: 'a debt',
      },
      /** By VMError kind. Every message ends by pointing at the sliders, the manual fallback. */
      errors: {
        unavailable: 'Reading text isn’t available right now. Use the sliders below instead.',
        incomplete: 'Your text is missing something we need to use it. Add more detail, or use the sliders below.',
        nothingFound:
          'We couldn’t find any amounts in that. Try “rent 1,800, groceries 500”, or use the sliders below.',
        badInput: 'We couldn’t read that. Try a shorter, simpler description, or use the sliders below.',
        rateLimited: 'Too many tries in a short time. Wait a moment, or use the sliders below.',
        network: 'We couldn’t reach the server. Check your connection, or use the sliders below.',
        invalidResponse: 'We couldn’t read that reliably. Use the sliders below instead.',
        notImplemented: 'Reading text isn’t built yet. Use the sliders below instead.',
        alreadyGuessed: 'Something went wrong reading that. Use the sliders below instead.',
        unknown: 'Something went wrong reading that. Use the sliders below instead.',
      },
    },
  },

  balance: {
    fieldsTitle: 'About you',
    fields: {
      age: 'Your age',
      takeHomePay: 'Take-home pay',
      cash: 'Cash',
      retirement: 'Retirement',
    },
    hints: {
      age: 'in years',
      takeHomePay: 'per month, after tax and payroll retirement contributions',
      cash: 'checking + savings today; negative if overdrawn',
      retirement: '401k, IRA: today’s total',
    },
    estimatedHint: 'typical amount · type yours to make it exact',
    estimateSticker: 'Estimate',
    skip: 'Skip',
    skipLabel: (field: string) => `Use our estimate for ${field.toLowerCase()}`,
    yearsSuffix: 'years',
    perMonthSuffix: '/mo',
    debtsTitle: 'What you owe',
    debtsLabel: 'Your debts',
    noDebts: 'No debts. Add one if you have a card balance or a loan.',
    debtKinds,
    balanceLabel: 'Balance',
    aprLabel: 'APR',
    minPaymentLabel: 'Minimum payment',
    minPaymentPerMonth: (amount: string) => `${amount}/mo minimum`,
    minPaymentHint: 'Leave it empty and we’ll estimate it from the balance and APR.',
    edit: 'Edit',
    editLabel: (kind: string) => `Edit ${kind.toLowerCase()}`,
    remove: 'Remove',
    removeLabel: (kind: string) => `Remove ${kind.toLowerCase()}`,
    addDebt: 'Add a debt',
    kindLabel: 'Type',
    save: 'Save debt',
    cancel: 'Cancel',
    formTitleAdd: 'New debt',
    formTitleEdit: (kind: string) => `Edit ${kind.toLowerCase()}`,
    debtLoadLabel: 'Debt load',
    debtLoadHint: 'Debt payments as a share of take-home pay this month.',
    debtLoadZones: { low: 'Comfortable', medium: 'Stretched', high: 'Risky' },
    netWorthLabel: 'Net worth today',
    netWorthHint: 'Cash + retirement − debts.',
    scoreLabel: 'Your balance sheet today',
    netWorthScore: 'net worth today (cash + retirement − debts)',
    debtLoadScore: 'of take-home pay goes to debt payments',
  },

  upload: {
    pickerTitle: 'Add a bank CSV',
    pickerSub: 'A CSV export from your bank’s website. We read the columns for you.',
    pickerLabel: 'Bank statement (CSV)',
    pickerHint: 'A CSV export from your bank. It is read on this device.',
    pickerUnavailable:
      'Reading statements isn’t switched on in this build yet. Until it is, your forecast uses the sliders and balance sheet.',
    reading: 'Reading your statement…',
    errors: {
      badInput: 'We couldn’t use that statement: its months or totals didn’t look right. Try another file.',
      unreadable: {
        notCsv: 'That isn’t a CSV file. In your bank’s website or app, look for “Download transactions” and pick CSV.',
        tooLarge: 'That file is too big. Export a shorter period, such as the last 3 to 6 months.',
        tooMany: 'That file has too many transactions for one upload. Export a shorter period, such as the last 6 months.',
        empty: 'That file is empty.',
        malformed: 'That file isn’t a well-formed CSV (a quote is never closed). Try exporting it again.',
        noColumns: 'We couldn’t find date, description and amount columns in that file. Try your bank’s CSV export.',
        noTransactions: 'We found the columns but no transactions in that file.',
      },
      rateLimited: 'Too many uploads in a short time. Wait a minute and try again.',
      network: 'We couldn’t reach the server to sort your statement. Check your connection and try again.',
      unknown: 'Something went wrong with that statement. Try again.',
    },
    dismiss: 'Dismiss',
    bank: {
      or: 'or',
      title: 'Connect your bank app',
      note: 'Read-only, through a secure partner: we never see your password and can’t move money. Not switched on in this build yet; use a CSV export for now.',
      button: 'Connect bank',
      soon: 'Coming soon',
    },
    reviewTitle: 'Check your months',
    reviewNote: 'Nothing changes until you confirm. Each category becomes your average over these months.',
    readSummary: (transactions: number, from: string, to: string) =>
      `Read ${plural(transactions, 'transaction', 'transactions')} from ${dayName(from)} to ${dayName(to)}.`,
    skipped: (pending: number, other: number) =>
      [
        pending > 0 ? `${plural(pending, 'pending line', 'pending lines')} (they count once they post)` : null,
        other > 0 ? `${plural(other, 'line that isn’t a transaction', 'lines that aren’t transactions')}` : null,
      ].filter(Boolean).join(' and ') + ' left out.',
    categorizedBy: {
      ai: 'Sorted into categories by AI from the masked labels. Every total is added up in code.',
      rules: 'Sorted into categories by keyword rules. Every total is added up in code.',
      mixed: 'Sorted into categories by AI and keyword rules. Every total is added up in code.',
    },
    excludedNote: 'Transfers between your own accounts and money from other people are not counted as spending or pay.',
    monthLabel: (month: string) => `Spending in ${monthName(month)}`,
    detectedPay: (amount: string) => `Take-home pay found: ${amount}`,
    oneOffsTitle: 'Left out as one-off charges (not kept)',
    apply: 'Use these numbers',
    discard: 'Discard',
    applied: 'Done. Your spending categories now use your statement averages.',
    history: (months: readonly string[]) => `Months in your profile: ${months.map(monthName).join(', ')}.`,
    driftReady: 'You have 3 or more months, so Today can flag categories drifting from your average.',
    scoreLabel: 'Your statement so far',
    monthsScore: (n: number) => (n === 1 ? 'month in your profile' : 'months in your profile'),
    categoriesScore: (n: number) => (n === 1 ? 'category from your statements' : 'categories from your statements'),
    driftNotYet: 'Today can flag categories drifting from your average once you have 3 months.',
    keep: {
      title: 'What we keep',
      none: 'Nothing from a statement yet.',
      onlyThis: 'From a statement we keep only:',
      months: (months: readonly string[]) =>
        months.length === 0 ? 'the month it covers' : `the months it covers (${months.map(monthName).join(', ')})`,
      totals: (categories: readonly string[]) =>
        categories.length === 0
          ? 'your total for each spending category, per month'
          : `your total per month for each category: ${categories.join(', ')}`,
      pay: 'your take-home pay, if the statement shows it',
      payFound: 'your take-home pay, found in your statement',
      where: 'They are stored in this browser.',
      server: 'Your profile, which holds the category averages and take-home pay, is also saved on our server under a random ID, with no name or email.',
      neverTitle: 'We never keep:',
      never: [
        'the file itself',
        'transaction descriptions or merchant names',
        'dates of single transactions',
        'one-off charges',
        'account numbers or names',
      ],
      sentTitle: 'What leaves your browser:',
      sent: 'only each line’s merchant label (account numbers masked, and personal names on payment-app and transfer lines), amount, month and day of month, to sort it into categories. We don’t store the labels or the lines. Only the labels, without amounts or dates, may go on to our AI provider, Anthropic, just to sort them; it doesn’t use API data to train its models.',
    },
  },
} as const;
