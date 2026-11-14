// Demo banks for the simulated "Connect your bank" on /start (apps/web features/start). The picker
// shows real banks' logos, but nothing connects to them: the flow asks for no credentials, says on
// screen that it is simulated, and serves one of the invented customers' CSV exports from
// fixtures/synthetic-statements in the matching export layout (`bankStyle` = the invented bank whose
// layout copies that bank's: see the synthetic-statements README) through
// GET /api/statement/demo-bank, which the app then reads exactly like an uploaded file. Each new
// connection to the same bank serves its next customer. `bankStyle` and `metro` are copied from
// labels/households.csv (demoBanks.test.ts checks them); `last4` is a made-up display number.

export type DemoBankAccount = { file: string; metro: string; last4: string };
export type DemoBank = {
  id: string;
  /** Name on screen. */
  name: string;
  /** The `bank_style` column of labels/households.csv. */
  bankStyle: string;
  /** Logo under /public/banks (Simple Icons, CC0; the marks are the banks' trademarks). */
  logo: string;
  accountLabel: string;
  accounts: readonly DemoBankAccount[];
};

export const DEMO_BANKS: readonly DemoBank[] = [
  {
    id: 'chase', name: 'Chase', bankStyle: 'Meridian National Bank', logo: '/banks/chase.svg', accountLabel: 'Total Checking',
    accounts: [
      { file: 'hh01-austin-single-renter.csv', metro: 'Austin, TX', last4: '1373' },
      { file: 'hh04-bronx-nurse-single-parent.csv', metro: 'New York, NY', last4: '2492' },
      { file: 'hh06-la-warehouse-family.csv', metro: 'Los Angeles, CA', last4: '3238' },
      { file: 'hh11-chicago-condo-couple.csv', metro: 'Chicago, IL', last4: '5103' },
      { file: 'hh15-houston-engineer-renter.csv', metro: 'Houston, TX', last4: '6595' },
      { file: 'hh21-chandler-young-family.csv', metro: 'Phoenix, AZ', last4: '8833' },
      { file: 'hh24-philly-rittenhouse-dinks.csv', metro: 'Philadelphia, PA', last4: '9952' },
      { file: 'hh27-dallas-sales-rep-revolver.csv', metro: 'Dallas-Fort Worth, TX', last4: '2071' },
      { file: 'hh32-pflugerville-new-parents.csv', metro: 'Austin, TX', last4: '3936' },
      { file: 'hh35-buckhead-physician-family.csv', metro: 'Atlanta, GA', last4: '5055' },
      { file: 'hh39-kendall-police-nurse-family.csv', metro: 'Miami, FL', last4: '6547' },
      { file: 'hh42-redmond-tech-couple-baby.csv', metro: 'Seattle, WA', last4: '7666' },
      { file: 'hh48-braintree-electrician-family.csv', metro: 'Boston, MA', last4: '9904' },
    ],
  },
  {
    id: 'bofa', name: 'Bank of America', bankStyle: 'Republic Shield Bank', logo: '/banks/bankofamerica.svg', accountLabel: 'Advantage Checking',
    accounts: [
      { file: 'hh03-nyc-finance-high-earner.csv', metro: 'New York, NY', last4: '2119' },
      { file: 'hh09-agoura-hills-two-kid-homeowners.csv', metro: 'Los Angeles, CA', last4: '4357' },
      { file: 'hh16-houston-river-oaks-dinks.csv', metro: 'Houston, TX', last4: '6968' },
      { file: 'hh25-bensalem-family-renters.csv', metro: 'Philadelphia, PA', last4: '1325' },
      { file: 'hh28-dallas-park-cities-family.csv', metro: 'Dallas-Fort Worth, TX', last4: '2444' },
      { file: 'hh33-atlanta-single-mom-toddler.csv', metro: 'Atlanta, GA', last4: '4309' },
      { file: 'hh38-brickell-single-professional.csv', metro: 'Miami, FL', last4: '6174' },
      { file: 'hh44-denver-retail-manager.csv', metro: 'Denver, CO', last4: '8412' },
      { file: 'hh47-back-bay-biotech-dinks.csv', metro: 'Boston, MA', last4: '9531' },
    ],
  },
  {
    id: 'wellsfargo', name: 'Wells Fargo', bankStyle: 'Hometown Federal Credit Union', logo: '/banks/wellsfargo.svg', accountLabel: 'Everyday Checking',
    accounts: [
      { file: 'hh10-chicago-hourly-low-income.csv', metro: 'Chicago, IL', last4: '4730' },
      { file: 'hh13-elk-grove-single-income-family.csv', metro: 'Chicago, IL', last4: '5849' },
      { file: 'hh17-katy-family-of-five.csv', metro: 'Houston, TX', last4: '7341' },
      { file: 'hh19-phoenix-teacher-monthly-pay.csv', metro: 'Phoenix, AZ', last4: '8087' },
      { file: 'hh22-philly-home-health-aide-mom.csv', metro: 'Philadelphia, PA', last4: '9206' },
      { file: 'hh29-south-dallas-mechanic-family.csv', metro: 'Dallas-Fort Worth, TX', last4: '2817' },
      { file: 'hh36-sandy-springs-empty-nest-dinks.csv', metro: 'Atlanta, GA', last4: '5428' },
      { file: 'hh40-seattle-barista-tips.csv', metro: 'Seattle, WA', last4: '6920' },
      { file: 'hh45-aurora-air-force-family.csv', metro: 'Denver, CO', last4: '8785' },
      { file: 'hh50-minneapolis-teacher-single-dad.csv', metro: 'Minneapolis-St. Paul, MN', last4: '1650' },
    ],
  },
  {
    id: 'discover', name: 'Discover', bankStyle: 'Clearwater Direct Bank', logo: '/banks/discover.svg', accountLabel: 'Cashback Checking',
    accounts: [
      { file: 'hh05-new-rochelle-dink-renters.csv', metro: 'New York, NY', last4: '2865' },
      { file: 'hh08-la-new-grad-roommates.csv', metro: 'Los Angeles, CA', last4: '3984' },
      { file: 'hh12-chicago-consultant.csv', metro: 'Chicago, IL', last4: '5476' },
      { file: 'hh20-scottsdale-freelance-designer.csv', metro: 'Phoenix, AZ', last4: '8460' },
      { file: 'hh23-philly-research-coordinator.csv', metro: 'Philadelphia, PA', last4: '9579' },
      { file: 'hh31-austin-software-engineer.csv', metro: 'Austin, TX', last4: '3563' },
      { file: 'hh41-seattle-carless-nurse.csv', metro: 'Seattle, WA', last4: '7293' },
      { file: 'hh46-dorchester-nonprofit-roommates.csv', metro: 'Boston, MA', last4: '9158' },
    ],
  },
  {
    id: 'cashapp', name: 'Cash App', bankStyle: 'Sprout Money (Bancorp partner)', logo: '/banks/cashapp.svg', accountLabel: 'Cash balance',
    accounts: [
      { file: 'hh02-queens-retail-roommates.csv', metro: 'New York, NY', last4: '1746' },
      { file: 'hh07-la-rideshare-driver.csv', metro: 'Los Angeles, CA', last4: '3611' },
      { file: 'hh14-houston-single-mom-preschooler.csv', metro: 'Houston, TX', last4: '6222' },
      { file: 'hh18-phoenix-server-tips.csv', metro: 'Phoenix, AZ', last4: '7714' },
      { file: 'hh26-dallas-warehouse-hourly.csv', metro: 'Dallas-Fort Worth, TX', last4: '1698' },
      { file: 'hh30-austin-delivery-gig.csv', metro: 'Austin, TX', last4: '3190' },
      { file: 'hh34-atlanta-grad-roommates.csv', metro: 'Atlanta, GA', last4: '4682' },
      { file: 'hh37-miami-two-job-family.csv', metro: 'Miami, FL', last4: '5801' },
      { file: 'hh43-denver-one-income-toddler.csv', metro: 'Denver, CO', last4: '8039' },
      { file: 'hh49-nashville-two-gigs.csv', metro: 'Nashville, TN', last4: '1277' },
    ],
  },
];

export function findDemoBank(id: string): DemoBank | null {
  return DEMO_BANKS.find((b) => b.id === id) ?? null;
}

/** The account a connection serves: the bank's `n`-th customer, wrapping around. */
export function demoBankAccount(bank: DemoBank, n: number): DemoBankAccount {
  const i = ((Math.trunc(n) % bank.accounts.length) + bank.accounts.length) % bank.accounts.length;
  return bank.accounts[i]!;
}
