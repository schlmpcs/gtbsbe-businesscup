// Strings for the 2-minute tour (a sheet opened from the site header or S1): numbered steps, each a
// link to a real screen. No math here; the promo code comes from the server's Pro status.
export const tour = {
  open: '2-minute tour',
  title: 'The 2-minute tour',
  description: 'Six stops, each a working screen. No sign-up needed.',
  stepsLabel: 'Tour steps',
  go: 'Open',
  steps: {
    play: {
      title: 'Play 1–2 rounds',
      body: 'Two strangers’ homes: guess which life costs more a month. The answer comes from public data, with sources.',
    },
    sample: {
      title: 'A sample life: number, goal, moves',
      body: 'Her net worth today and in 10 years, a goal with its gap, and the moves that change it, in dollars.',
    },
    upload: {
      title: 'Read a bank statement',
      body: 'Tap “Try with sample statement”: parsed in your browser, only category totals are kept.',
    },
    afford: {
      title: 'Can I afford it?',
      body: 'Check a purchase against your month and your net worth over the next 10 years.',
    },
    loan: {
      title: 'Loan Lab',
      body: 'Compare up to 3 loan offers side by side: payment, total interest, total cost. Try paying extra.',
    },
    pro: {
      title: 'Pro, without paying',
      body: 'Goal tracking, check-ins and the wishlist. A simulated checkout: nothing is charged.',
      /** The promo code the server accepts (shown on the Pro screen too, on purpose, for the jury). */
      code: (code: string) => `Judges: promo code ${code}`,
    },
  },
  preview: 'Not built yet: connecting a bank app (coming soon). Upload a statement instead.',
} as const;
