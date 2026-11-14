// Strings for the subscription audit (S21, `/tools/subscriptions`). Owner: Amir (M5).
// Wording rules (docs/design/08-subscription-audit.md): "looks recurring", "possible subscription",
// "catalogue price"; never "hidden fee" or "you are being charged for"; the tool never tells anyone to
// cancel a particular service, it shows what the numbers would be if they did; forgetting one is normal.
// Functions take values already formatted by the UI (formatMoney / formatMonth); no math here.
import type { Cadence, MissBucket, ServiceCategory } from '@lifeguessr/types';

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export const subscriptions = {
  screens: {
    S21: 'Subscription audit',
  },
  intro:
    'Guess what you spend on subscriptions, tick what you pay for, then add a bank statement to find the ones you forgot. It works without an account or a profile.',
  loading: 'Loading…',
  /** `/tools/subscriptions?stream=1`: streamer mode never shows anyone's own money. */
  streamer: {
    title: 'Hidden in streamer mode',
    body: 'This tool shows your own money, so streamer mode never shows it. Open it from the main site.',
  },

  stepper: {
    label: 'Steps',
    steps: {
      guess: 'Your guess',
      ticks: 'What you pay for',
      reveal: 'The gap',
      statement: 'Your statement',
      findings: 'What we found',
      plan: 'Cancel plan',
    },
    back: 'Back',
    next: 'Next',
  },

  guess: {
    title: 'How much do you think you spend on subscriptions each month?',
    label: 'Monthly guess',
    prefix: '$',
    suffix: '/mo',
    hint: 'Streaming, apps, gyms, memberships. A rough number is fine.',
    presets: 'Quick picks',
    next: 'Next: tick what you pay for',
    skip: 'Skip the guess',
  },

  ticks: {
    title: 'Tick the ones you pay for',
    hint: 'These are catalogue prices, not your bill. Where a service has more than one plan, pick yours.',
    categories: {
      video: 'Video',
      music: 'Music',
      software: 'Software',
      cloud: 'Cloud storage',
      fitness: 'Fitness',
      news: 'News',
      gaming: 'Gaming',
      learning: 'Learning',
      food: 'Food boxes',
      other: 'Other',
    } satisfies Record<ServiceCategory, string>,
    /** Catalogue price line: "$17.99 a month, catalogue price, 2026". */
    price: (amount: string, cadence: Cadence, year: number) =>
      `${amount} ${cadence === 'monthly' ? 'a month' : cadence === 'yearly' ? 'a year' : 'a quarter'}, catalogue price, ${year}`,
    /** What a yearly or quarterly plan comes to per month. */
    perMonth: (amount: string) => `about ${amount} a month`,
    planLabel: (service: string) => `Plan for ${service}`,
    /** After a price in the list. */
    cadenceShort: { monthly: '/mo', yearly: '/yr', quarterly: '/qtr' } satisfies Record<Cadence, string>,
    totalTitle: 'Your ticks',
    count: (n: number) => plural(n, 'service ticked', 'services ticked'),
    totalMonthly: (amount: string) => `${amount} a month`,
    totalYearly: (amount: string) => `${amount} a year`,
    totalNote: 'From your ticks, catalogue prices',
    empty: 'Nothing ticked yet.',
    next: 'See the gap',
  },

  reveal: {
    title: 'Your guess against the total',
    guessed: 'You guessed',
    fromTicks: (year: number | null) => (year === null ? 'From your ticks' : `From your ticks (catalogue prices, ${year})`),
    fromStatement: (months: number) => `From your statement (${plural(months, 'month', 'months')})`,
    perMonth: (amount: string) => `${amount} a month`,
    perYear: (amount: string) => `${amount} a year`,
    ticked: (n: number) => `${plural(n, 'service', 'services')} ticked`,
    /** `amount` is how far apart the guess and the total are, per month. */
    gap: {
      lower: (amount: string) => `Your guess was ${amount} a month under the total. Most people guess low.`,
      close: 'Your guess was close to the total.',
      higher: (amount: string) => `Your guess was ${amount} a month over the total.`,
    },
    /** `factor` is guess ÷ total, e.g. "0.73". */
    factor: (factor: string) => `Guess ÷ total: ${factor}`,
    bucket: {
      'under0.5': 'less than half of the total',
      '0.5to0.8': 'half to four fifths of the total',
      '0.8to1.25': 'about right',
      '1.25to2': 'up to double the total',
      over2: 'more than double the total',
    } satisfies Record<MissBucket, string>,
    noGuess: 'You skipped the guess, so here is the total on its own.',
    noValue: '—',
    noTotal: 'The total is $0, so there is nothing to compare a guess with.',
    survey: (guessed: string, itemized: string) =>
      `In a survey, people guessed about ${guessed} a month on subscriptions. When they added them up, it came to ${itemized}.`,
    surveyNote: 'A survey, not your data.',
    forgot: 'Upload a statement to find the ones you forgot.',
    findOnes: 'Find the ones you forgot',
    backToTicks: 'Back to the ticks',
  },

  statement: {
    title: 'Find the ones you forgot',
    readOnDevice: 'Your statement is read on this device.',
    pickerLabel: 'Bank statement (CSV)',
    pickerHint: 'Your bank’s CSV export. Three to six months works best.',
    minMonths: 'Needs at least 2 months for best results.',
    offline: 'Reading a statement needs a connection. The guess, the ticks and the gap work without one.',
    reading: 'Reading your statement…',
    dismiss: 'Dismiss',
    replace: 'Use another statement',
  },

  findings: {
    title: 'What we found',
    /** "Found 11 · you ticked 7". */
    headline: (found: number, ticked: number) =>
      `Found ${found}${ticked > 0 ? ` · you ticked ${ticked}` : ''}`,
    perMonth: (amount: string) => `${amount} a month`,
    perYear: (amount: string) => `${amount} a year`,
    countedNote: 'The totals count active charges only. Charges to confirm and stopped ones are left out.',
    measured: 'from your statement',
    groups: {
      active: 'Active',
      toConfirm: 'To confirm',
      stopped: 'Stopped',
      tickedOnly: 'Ticked, not in this statement',
    },
    tickedOnlyNote: 'You ticked these. They are catalogue prices, not charges we saw.',
    forgot: 'Forgot this one?',
    forgotNote: 'Found in your statement but not ticked. Easy to lose track of.',
    notCounted: 'not counted yet',
    toConfirmQuestion: 'Looks recurring. Is it a subscription?',
    yes: 'Yes',
    no: 'No',
    /** Cadence of one finding: "$17.99 monthly". */
    every: { monthly: 'every month', quarterly: 'every 3 months', yearly: 'every year' } satisfies Record<Cadence, string>,
    chargesSeen: (n: number) => `${plural(n, 'charge', 'charges')} seen`,
    nextExpected: (date: string) => `Next expected ${date}`,
    flag: {
      priceUp: (previous: string, now: string) => `Price up: ${previous} → ${now}`,
      introEnded: 'Intro price ended',
      overlap: (others: number) => `${plural(others + 1, 'service', 'services')} in this category`,
      seenOnce: (cadence: Cadence, month: string) =>
        `${cadence === 'yearly' ? 'Yearly' : 'Quarterly'} charge, seen once (${month})`,
    },
    stoppedSince: (month: string) => `Hasn’t charged since ${month}`,
    short: 'This statement covers less than 2 months, so most of these are possible subscriptions, not certain ones.',
    none: 'We found no recurring charges in this statement. A longer one helps: three to six months.',
    dismissed: (n: number) => `${plural(n, 'charge', 'charges')} hidden`,
    restore: 'Show them again',
    markToCancel: 'Mark to cancel',
    unknownMonth: '—',
    next: 'Make a cancel plan',
    planWaits: 'Nothing is counted yet. Answer the charges above, or tick a service, and the plan opens.',
  },

  plan: {
    title: 'Cancel plan',
    intro:
      'Mark what you would stop paying for to see what the numbers would be. Nothing is cancelled for you, and this is not a suggestion to cancel anything.',
    empty: 'Nothing marked yet.',
    options: 'Mark to cancel',
    mark: (name: string) => `Mark ${name} to cancel`,
    marked: (n: number) => `${plural(n, 'service', 'services')} marked`,
    perMonth: (amount: string) => `${amount} a month`,
    perYear: (amount: string) => `${amount} a year`,
    yearLabel: 'Per year',
    in10y: 'Over 10 years',
    todaysDollars: 'In today’s dollars.',
    loading: 'Working out the 10-year number…',
    error: 'We could not work out the 10-year number. Try again in a moment.',
    tooSmall: 'Too small to change your 10-year number.',
    sampleProfile: 'Based on the sample profile until you add your own numbers.',
    /** `held` is what the profile holds for subscriptions per month. */
    notCovered: (held: string) =>
      `Your plan holds ${held} a month for subscriptions, so the 10-year number counts at most that. Use this in my plan to include all of it.`,
    addAsMove: 'Add as my next move',
    moveAdded: 'Added as your next move.',
    updateMove: 'Update my next move',
    moveOutdated: 'Your next move still holds an earlier version of this plan. Update it to match.',
    useInPlan: 'Use this in my plan',
    inPlan: 'This is in your plan.',
  },

  apply: {
    title: 'Use this in my plan',
    description: 'Nothing changes until you confirm.',
    field: 'Subscriptions per month',
    /** Between the two values; read as `arrowSr` by a screen reader. */
    arrow: '→',
    arrowSr: 'changes to',
    estimate: 'estimate',
    measured: 'measured',
    /** `from` → `to`, each with its tag. */
    change: (from: string, fromTag: string, to: string, toTag: string) => `${from} ${fromTag} → ${to} ${toTag}`,
    toNote: {
      measured: 'From your statement.',
      estimate: 'Includes catalogue prices of services you ticked, so it stays an estimate.',
    },
    confirm: 'Update my plan',
    cancel: 'Cancel',
    done: 'Done. Your plan now uses this number.',
  },

  renewals: {
    title: 'Renewal reminders',
    body: (n: number) => `${plural(n, 'renewal', 'renewals')} in a calendar file you can add to your phone or computer.`,
    none: 'No upcoming renewals yet. A statement shows when each charge is expected.',
    button: 'Add renewals to my calendar',
    builtHere: 'The file is built on this device. Nothing is uploaded.',
    importOnce:
      'Import the file once. Exporting again later adds every renewal a second time, so remove the earlier ones first.',
    reminders:
      'The file asks your calendar for a reminder the day before. Some calendars, Google Calendar among them, can ignore it, so check your calendar’s notification settings.',
    outcome: {
      downloaded: 'File saved. Open it to add the renewals.',
      opened: 'The file opened in a new tab. Save it, then import it into your calendar.',
      failed: 'Your browser did not allow the download. Try again.',
    },
  },

  keep: {
    title: 'What we keep',
    tag: 'Stays in this browser',
    gist: 'This tool saves your guess, your ticks, your choices and the findings from your statement in this browser only. You can clear them at any time.',
    none: 'Nothing saved yet.',
    details: 'Exactly what we keep',
    savedTitle: 'Saved in this browser:',
    saved: [
      'your guess, and the services you ticked with the plan you picked',
      'the recurring charges found in your statement: the merchant name as it appears there, the amount and how often, how many charges were seen, the month and day of the last charge and of the next one expected, the price before a rise, and whether it looks stopped',
      'your choices about them: confirmed, not a subscription, marked to cancel',
    ],
    savedWhere: 'These stay on this device. The saved findings are never sent to our server.',
    neverTitle: 'We never save:',
    never: ['the statement file or its lines'],
    masking:
      'Before a label is saved or sent, account and card numbers are masked, and so are personal names on payment-app and transfer lines. A merchant whose name is a person’s name stays as it appears on your statement.',
    sentTitle: 'What leaves your browser to find them:',
    sent: 'only each line’s merchant label (account numbers masked, and personal names on payment-app and transfer lines), amount, month and day of month, to sort it into categories. We don’t store the labels or the lines. Only the labels, without amounts or dates, may go on to our AI provider, Anthropic, just to sort them; it doesn’t use API data to train its models.',
    forecastSent:
      'When you use the cancel plan, the numbers in your profile and the change you marked (no names or account numbers) go to our AI provider, Anthropic, to work out the 10-year number. It doesn’t use API data to train its models.',
    kept: '✓',
    notKeptMark: '✕',
    clear: 'Clear the guess, ticks, choices and findings saved here',
    clearNote:
      'This does not change your plan. If you used this in your plan or added it as your next move, the subscriptions line and the move stay until you change them in your plan.',
    cleared: 'Cleared.',
  },
} as const;
