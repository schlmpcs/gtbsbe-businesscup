// "What if?" hub (/tools): every tool answers one question about your plan, the same way:
// your input → one verdict → what it does to you in 10 years → add it to your plan.
export const tools = {
  hub: {
    eyebrow: 'What if?',
    title: 'Test a decision before you make it',
    lead: 'Each tool answers one question and shows what it does to you in 10 years.',
    open: 'Open',
    items: {
      afford: { question: 'Can I afford it?', line: 'Check a purchase against your plan.' },
      loan: { question: 'Which loan costs less?', line: 'Compare up to 3 offers, total cost included.' },
      decide: { question: 'Keep the car or lease?', line: 'Two paths, one decision, ten years out.' },
      checkin: { question: 'Am I on track this month?', line: 'Your month against your usual one.' },
      subscriptions: { question: 'What am I still paying for?', line: 'Find the subscriptions you forgot.' },
      overpaying: { question: 'Am I overpaying?', line: 'Your bills against people near you.' },
      exact: { question: 'Are my numbers right?', line: 'Swap our estimates for your statement.' },
      bills: { question: 'What is due this month?', line: 'Every bill on one calendar, on the day it is due.' },
    },
  },
} as const;
