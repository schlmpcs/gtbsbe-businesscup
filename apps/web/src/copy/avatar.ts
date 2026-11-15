export const avatar = {
  offer: 'Let strangers meet a rounded version of you in the daily duel?',
  title: 'Your anonymous avatar',
  open: 'Preview my avatar',
  refresh: 'Refresh preview',
  preview: 'Exactly what would be published',
  published: 'Published avatar',
  publish: 'Publish avatar',
  republish: 'Replace published avatar',
  unpublish: 'Unpublish',
  intro:
    'When community duels launch, strangers can compare your rounded avatar with another life. They never see your name, ZIP or anything you typed. Educational simulation, not financial advice.',
  stamp: {
    selfReported: 'Self-reported',
    statementVerified: 'Statement-verified',
  },
  fields: {
    ageBand: 'Age band',
    metro: 'Metro',
    netWorth: 'Net worth',
    monthlyCost: 'Monthly cost',
    rentShare: 'Rent share of take-home pay',
    debtTotal: 'Total debt',
    'facts.hasCar': 'Car',
    'facts.kids': 'Children',
    'facts.householdAdults': 'Adults',
    age: 'Age',
  },
  yes: 'Yes',
  no: 'No',
  none: 'Not available',
  estimate: 'estimate',
  about: (value: string) => `About ${value}`,
  facts: 'Confirm the household facts before refreshing your preview',
  consent:
    'I choose to publish my age band, metro, rounded net worth, monthly cost, rent share, debt total, car, children and adults. Strangers’ picks may be counted once duels support avatars. My avatar expires after 90 days unless I return. If I clear this browser, I lose control of it until it expires.',
  retention:
    'Published fields are stored on the server. Unpublish deletes the avatar. Your avatar is saved for the upcoming duel pool. It is not shown to other players yet, and pick statistics are not collected.',
  expiry: (start: string, end: string) =>
    `Published ${start}. Expires ${end} unless you return.`,
  bounds: 'Fix these inputs before publishing:',
  fix: 'Edit your profile',
  loading: 'Loading avatar…',
  error: 'Unable to update your avatar. Try again.',
  errors: {
    no_session: 'Save your balance sheet first.',
    no_metro: 'Choose a ZIP covered by our area data.',
    out_of_bounds: 'Some values fall outside the publishing bounds.',
    stale_preview:
      'Your saved profile changed. Refresh the preview and consent again.',
    rate_limited: 'Please try again later.',
    unavailable: 'Avatar storage is unavailable. Try again later.',
  } as Record<string, string>,
  rules:
    'Avatar amounts are rounded after calculation: balances to $1,000 below $100,000 and $5,000 above, monthly costs to $50, rent share to 5 percentage points. Net worth is cash plus retirement plus the value of a home you own, minus debts. Inputs outside the publishing bounds are refused. Pick statistics require at least 20 completed picks; they are not available yet.',
  keep: 'Published avatar: age band, metro, rounded net worth, monthly cost, rent share, debt total, car, children and adults. Stored on the server until you unpublish or it expires.',
  manage: 'Manage or unpublish your avatar',
} as const;
