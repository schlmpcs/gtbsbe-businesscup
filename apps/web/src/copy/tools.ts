// "What if?" hub (/tools): every tool answers one question about your plan, the same way:
// your input → one verdict → what it does to you in 10 years → add it to your plan.
export const tools = {
  hub: {
    eyebrow: 'What if?',
    title: 'Test a decision before you make it',
    lead: 'Each tool answers one question and shows what it does to you in 10 years.',
    open: 'Open',
    /** The hub's sections, in order (tools listed in features/tools/ui/ToolsHub.tsx). */
    groups: {
      big: { title: 'Big decisions', line: 'The ones that move your plan for years.' },
      month: { title: 'This month', line: 'Where your month stands, day by day.' },
      money: { title: 'Find money', line: 'Money leaving every month that you could keep.' },
      together: { title: 'Together', line: 'Two people, one plan.' },
    },
    /** The slim strip above the groups: every answer gets better with your own numbers. */
    exactCta: 'Import a statement',
    /** Live one-liners on a tile (only where a screen already knows the number). */
    teasers: {
      nextBill: (inDays: number) =>
        inDays <= 0 ? 'Next bill due today' : inDays === 1 ? 'Next bill tomorrow' : `Next bill in ${inDays} days`,
    },
    /** The link back to the hub at the top of every tool. */
    back: 'What if?',
    backLabel: 'Back to What if?',
    items: {
      afford: { question: 'Can I afford it?', line: 'Check a purchase against your plan.' },
      loan: { question: 'Which loan costs less?', line: 'Compare up to 3 offers, total cost included.' },
      decide: { question: 'Keep the car or lease?', line: 'Two paths, one decision, ten years out.' },
      checkin: { question: 'Am I on track this month?', line: 'Your month against your usual one.' },
      subscriptions: { question: 'What am I still paying for?', line: 'Find the subscriptions you forgot.' },
      overpaying: { question: 'Am I overpaying?', line: 'Your bills against people near you.' },
      exact: { question: 'Are my numbers right?', line: 'Import a bank statement: about a minute, nothing to type.' },
      bills: { question: 'What is due this month?', line: 'Every bill on one calendar, on the day it is due.' },
      spend: { question: 'Daily spending log', line: 'Log today’s spending in a tap and watch your month add up.' },
      together: { question: 'How do we split it?', line: 'Plan with your partner by link: a fair split and us in 10 years.' },
    },
  },
} as const;
