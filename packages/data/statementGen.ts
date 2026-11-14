// Statement generator: a made-up but realistic bank statement for someone who has no US statement
// at hand (a judge, a visitor from abroad, anyone who won't upload theirs). It is the "Generate a
// life like yours" path of onboarding (/start): no typing, five taps, then the CSV goes through
// exactly the same in-browser reader, masking and categorizer as a real upload. Nothing downstream
// knows it was generated except the label we show.
//
// Every amount is built from the public area data for the chosen ZIP (HUD rent, DOL childcare,
// USDA groceries, EIA gas, NAIC car insurance; see out/areas.json) plus a few stated lifestyle
// assumptions below. Pure and seeded: the same spec and seed give the same file, byte for byte.
//
// Layout: "Big bank A" (the same columns as fixtures/statement.sample.csv), newest line first,
// posting dates on weekdays only, a running balance. Merchant names are real chains and utilities
// because that is what statements contain; people, employers and landlords are invented.
import type { AreaData, KidAge } from '@lifeguessr/types';
import { areaData } from './areas';

export const GEN_HOUSEHOLDS = ['solo', 'couple', 'family', 'singleParent'] as const;
export const GEN_PAY_BANDS = ['lean', 'steady', 'comfortable'] as const;
export const GEN_STYLES = ['saver', 'typical', 'spender'] as const;
export const GEN_TIERS = ['cheap', 'mid', 'expensive', 'suburb'] as const;

export type GenHousehold = (typeof GEN_HOUSEHOLDS)[number];
export type GenPayBand = (typeof GEN_PAY_BANDS)[number];
export type GenStyle = (typeof GEN_STYLES)[number];
export type GenTier = (typeof GEN_TIERS)[number];

export type StatementSpec = {
  /** A ZIP covered by areaData (one of 15 metros × 4 neighborhood tiers). */
  zip: string;
  household: GenHousehold;
  pay: GenPayBand;
  style: GenStyle;
  /** Any integer; "Regenerate" bumps it. */
  seed: number;
  /** The last day of the statement, 'YYYY-MM-DD'. It starts on the 1st, three months earlier. */
  asOf: string;
};

/** Who lives there, as the generator models it. Exported so the UI can describe the household. */
export const HOUSEHOLD_SHAPE: Record<GenHousehold, { adults: 1 | 2; kids: KidAge[]; bedrooms: 0 | 1 | 2 | 3; earners: 1 | 2 }> = {
  solo: { adults: 1, kids: [], bedrooms: 1, earners: 1 },
  couple: { adults: 2, kids: [], bedrooms: 1, earners: 2 },
  family: { adults: 2, kids: ['toddler'], bedrooms: 2, earners: 2 },
  singleParent: { adults: 1, kids: ['preschool'], bedrooms: 2, earners: 1 },
};

/**
 * Monthly take-home pay of the main earner (after tax and payroll deductions), by band. A second
 * earner takes home 80% of it. Assumption: roughly the 30th / 55th / 80th percentile of full-time
 * pay for ages 25–45 after federal, state and FICA taxes (BLS CPS 2025, rounded).
 */
export const TAKE_HOME_BY_BAND: Record<GenPayBand, number> = { lean: 3050, steady: 4400, comfortable: 6900 };

/** Lifestyle assumptions (stated, not sourced): how each style shifts the everyday categories. */
export const STYLE_ASSUMPTIONS: Record<GenStyle, {
  groceriesFactor: number; mealsOutPerWeek: number; subscriptions: number; shoppingMonthly: number;
  savingsShareOfPay: number; openingMonthsOfPay: number;
}> = {
  saver: { groceriesFactor: 0.85, mealsOutPerWeek: 1, subscriptions: 3, shoppingMonthly: 110, savingsShareOfPay: 0.15, openingMonthsOfPay: 1.6 },
  typical: { groceriesFactor: 1, mealsOutPerWeek: 3, subscriptions: 6, shoppingMonthly: 240, savingsShareOfPay: 0.06, openingMonthsOfPay: 1 },
  spender: { groceriesFactor: 1.2, mealsOutPerWeek: 6, subscriptions: 10, shoppingMonthly: 430, savingsShareOfPay: 0, openingMonthsOfPay: 0.5 },
};

/** The ZIPs the generator can use, grouped as the onboarding chips show them. */
export function generatorMetros(): { metro: string; tiers: { tier: GenTier; zip: string }[] }[] {
  const byMetro = new Map<string, { tier: GenTier; zip: string }[]>();
  for (const a of areaData) {
    const list = byMetro.get(a.metro) ?? [];
    list.push({ tier: a.tier, zip: a.zip });
    byMetro.set(a.metro, list);
  }
  return [...byMetro.entries()].map(([metro, tiers]) => ({
    metro,
    tiers: [...tiers].sort((x, y) => GEN_TIERS.indexOf(x.tier) - GEN_TIERS.indexOf(y.tier)),
  }));
}

/** What the generated month is built from, with sources, before any line is drawn. */
export type StatementPlan = {
  area: Pick<AreaData, 'zip' | 'metro' | 'tier' | 'state'>;
  household: GenHousehold;
  adults: 1 | 2;
  kids: KidAge[];
  bedrooms: number;
  hasCar: boolean;
  /** Monthly amounts the lines are drawn around, before day-to-day noise. */
  monthly: {
    takeHome: number; rentUtilities: number; groceries: number; eatingOut: number; car: number;
    childcare: number; subscriptions: number; debtPayments: number; shopping: number; savings: number;
  };
  /** Which public series each monthly amount starts from. */
  sources: { rent: string; childcare: string | null; groceries: string; car: string | null };
};

export type GeneratedStatement = {
  csv: string;
  plan: StatementPlan;
  /** Transactions written (money in and out). */
  lines: number;
  from: string;
  to: string;
};

// ----- seeded randomness -----------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Rng = { next: () => number; between: (lo: number, hi: number) => number; int: (lo: number, hi: number) => number; pick: <T>(xs: readonly T[]) => T };

function rngFor(spec: StatementSpec): Rng {
  const next = mulberry32(hashString(`${spec.zip}|${spec.household}|${spec.pay}|${spec.style}|${spec.seed}`));
  return {
    next,
    between: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor((hi - lo + 1) * next()),
    pick: (xs) => xs[Math.floor(next() * xs.length)]!,
  };
}

const cents = (x: number) => Math.round(x * 100) / 100;
const round5 = (x: number) => Math.round(x / 5) * 5;

// ----- dates ------------------------------------------------------------------------------------

type Ymd = { y: number; m: number; d: number }; // m: 1–12

function parseYmd(s: string): Ymd {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`asOf must be YYYY-MM-DD, got ${s}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
const toUtc = (x: Ymd) => Date.UTC(x.y, x.m - 1, x.d);
const fromUtc = (t: number): Ymd => {
  const dt = new Date(t);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};
const DAY = 86_400_000;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (x: Ymd) => `${x.y}-${String(x.m).padStart(2, '0')}-${String(x.d).padStart(2, '0')}`;
const usDate = (x: Ymd) => `${String(x.m).padStart(2, '0')}/${String(x.d).padStart(2, '0')}/${x.y}`;

/** Posting dates are business days: a weekend date posts the next Monday. */
function posted(t: number): number {
  const dow = new Date(t).getUTCDay();
  return dow === 6 ? t + 2 * DAY : dow === 0 ? t + DAY : t;
}

// ----- merchants --------------------------------------------------------------------------------

const ELECTRIC_BY_STATE: Record<string, string> = {
  TX: 'TXU ENERGY PPD', NY: 'CON ED OF NY PPD', CA: 'SO CAL EDISON CO PPD', IL: 'COMED PPD', GA: 'GEORGIA POWER PPD',
  FL: 'FPL DIRECT DEBIT', WA: 'PUGET SOUND ENERGY PPD', CO: 'XCEL ENERGY PPD', MA: 'EVERSOURCE ENERGY PPD',
  TN: 'NASHVILLE ELECTRIC SERVICE', MN: 'XCEL ENERGY PPD', AZ: 'APS ELECTRIC PPD', PA: 'PECO ENERGY PPD',
};
const GROCERS_BY_STATE: Record<string, readonly string[]> = {
  TX: ['H-E-B #', 'KROGER #', 'ALDI #', 'COSTCO WHSE #'], NY: ['TRADER JOE S #', 'KEY FOOD #', 'WHOLEFDS #', 'COSTCO WHSE #'],
  CA: ['RALPHS #', 'TRADER JOE S #', 'VONS #', 'COSTCO WHSE #'], IL: ['JEWEL OSCO #', 'ALDI #', 'TRADER JOE S #', 'COSTCO WHSE #'],
  GA: ['PUBLIX #', 'KROGER #', 'ALDI #', 'COSTCO WHSE #'], FL: ['PUBLIX #', 'WINN-DIXIE #', 'ALDI #', 'COSTCO WHSE #'],
  WA: ['SAFEWAY #', 'FRED MEYER #', 'TRADER JOE S #', 'COSTCO WHSE #'], CO: ['KING SOOPERS GROCERY #', 'SAFEWAY #', 'SPROUTS #', 'COSTCO WHSE #'],
  MA: ['MARKET BASKET #', 'STOP & SHOP #', 'TRADER JOE S #', 'WHOLEFDS #'], TN: ['KROGER #', 'PUBLIX #', 'ALDI #', 'COSTCO WHSE #'],
  MN: ['CUB FOODS #', 'HY-VEE #', 'ALDI #', 'TRADER JOE S #'], AZ: ['FRYS FOOD GROCERY #', 'SAFEWAY #', 'SPROUTS #', 'COSTCO WHSE #'],
  PA: ['GIANT FOOD #', 'ACME MARKETS #', 'ALDI #', 'WEGMANS #'],
};
const FUEL = ['SHELL OIL #', 'CHEVRON #', 'EXXONMOBIL #', 'VALERO #', 'CIRCLE K #'] as const;
const EATING_OUT = [
  ['STARBUCKS STORE #', 6, 14], ['CHIPOTLE #', 11, 28], ['DOORDASH*', 24, 52], ['SWEETGREEN #', 14, 31], ['TST* TAQUERIA LOCAL', 18, 46],
  ['PANERA BREAD #', 12, 30], ['CHICK-FIL-A #', 9, 26], ['UBER EATS', 22, 48], ['SHAKE SHACK #', 16, 38], ['PIZZA HUT #', 18, 36],
] as const;
const SUBSCRIPTIONS = [
  ['NETFLIX.COM', 17.99], ['SPOTIFY USA', 11.99], ['APPLE.COM/BILL ICLOUD', 2.99], ['HULU 877-8244858', 9.99],
  ['PLANET FITNESS', 24.99], ['YOUTUBE PREMIUM', 13.99], ['DISNEY PLUS', 15.99], ['AUDIBLE*', 14.95], ['PELOTON MEMBERSHIP', 44],
  ['OPENAI *CHATGPT SUBSCR', 20],
] as const;
const SHOPPING = ['TARGET #', 'AMAZON MKTPL*', 'CVS/PHARMACY #', 'WALGREENS #', 'TJ MAXX #', 'HOME DEPOT #'] as const;
const EMPLOYERS = ['NORTHWIND HEALTH', 'BLUEPEAK LOGISTICS', 'CEDARLINE SCHOOLS', 'ORBITAL SOFTWARE', 'MERIDIAN RETAIL GRP', 'HALCYON BIOTECH'] as const;
const LANDLORDS = ['BELLWOOD APARTMENTS', 'PARKSIDE APTS', 'MAPLE COURT APARTMENTS', 'RIVERSTONE PROPERTY MANAGEMENT'] as const;
const FRIENDS = ['Sam Rivera', 'Jordan Lee', 'Priya Natarajan', 'Alex Morgan', 'Chris Okafor'] as const;

// ----- plan -------------------------------------------------------------------------------------

/** The monthly amounts a spec stands for (no randomness): what the review should roughly find. */
export function planStatement(spec: StatementSpec, areas: readonly AreaData[] = areaData): StatementPlan {
  const area = areas.find((a) => a.zip === spec.zip);
  if (!area) throw new RangeError(`No area data for ZIP ${spec.zip}`);
  const shape = HOUSEHOLD_SHAPE[spec.household];
  const style = STYLE_ASSUMPTIONS[spec.style];
  const takeHome = TAKE_HOME_BY_BAND[spec.pay] * (shape.earners === 2 ? 1.8 : 1);
  const rent = area.rentByBedrooms[shape.bedrooms as 0 | 1 | 2 | 3];
  const transitCity = area.state === 'NY' && area.tier !== 'suburb';
  const hasCar = !transitCity;
  const kid = shape.kids[0];
  const childcare = kid && area.childcareMonthly ? area.childcareMonthly[kid] : 0;
  const groceries = area.groceriesPerAdult.value * (shape.adults + 0.6 * shape.kids.length) * style.groceriesFactor;
  const fuel = hasCar ? (52 / 12) * 11 * area.gasPerGallon.value * (shape.adults === 2 ? 1.4 : 1) : 0;
  const car = hasCar ? fuel + area.carInsuranceMonthly.value : 132;
  const carLoan = hasCar && spec.pay !== 'comfortable' ? (spec.pay === 'lean' ? 312 : 389) : hasCar && spec.style === 'spender' ? 545 : 0;
  const studentLoan = spec.pay !== 'lean' && spec.household !== 'singleParent' ? 262 : 0;
  const cardMin = spec.style === 'spender' || spec.pay === 'lean' ? 185 : 0;
  const subs = SUBSCRIPTIONS.slice(0, style.subscriptions).reduce((s, [, p]) => s + p, 0);
  const phone = 48 * shape.adults;
  return {
    area: { zip: area.zip, metro: area.metro, tier: area.tier, state: area.state },
    household: spec.household,
    adults: shape.adults,
    kids: [...shape.kids],
    bedrooms: shape.bedrooms,
    hasCar,
    monthly: {
      takeHome,
      rentUtilities: rent.value + phone,
      groceries,
      eatingOut: (52 / 12) * style.mealsOutPerWeek * 24 * (shape.adults === 2 ? 1.5 : 1),
      car,
      childcare,
      subscriptions: subs,
      debtPayments: carLoan + studentLoan + cardMin,
      shopping: style.shoppingMonthly,
      savings: takeHome * style.savingsShareOfPay,
    },
    sources: {
      rent: rent.source.name,
      childcare: kid && area.childcareMonthly ? area.childcareMonthly.source.name : null,
      groceries: area.groceriesPerAdult.source.name,
      car: hasCar ? area.carInsuranceMonthly.source.name : null,
    },
  };
}

// ----- lines ------------------------------------------------------------------------------------

type Line = { t: number; description: string; amount: number; type: string };

/** Generate the statement CSV for a spec (pure, seeded). */
export function generateStatement(spec: StatementSpec, areas: readonly AreaData[] = areaData): GeneratedStatement {
  const plan = planStatement(spec, areas);
  const rng = rngFor(spec);
  const style = STYLE_ASSUMPTIONS[spec.style];
  const shape = HOUSEHOLD_SHAPE[spec.household];
  const end = parseYmd(spec.asOf);
  const start: Ymd = end.m > 3 ? { y: end.y, m: end.m - 3, d: 1 } : { y: end.y - 1, m: end.m + 9, d: 1 };
  const t0 = toUtc(start);
  const t1 = toUtc(end);
  const lines: Line[] = [];
  const add = (t: number, description: string, amount: number, type: string) => {
    const p = posted(t);
    if (p >= t0 && p <= t1 && amount !== 0) lines.push({ t: p, description, amount: cents(amount), type });
  };
  const ref = (n = 4) => String(rng.int(10 ** (n - 1), 10 ** n - 1));
  const store = (name: string) => (name.endsWith('#') ? `${name}${ref()}` : name.endsWith('*') ? `${name}${ref(3)}${String.fromCharCode(65 + rng.int(0, 25))}` : name);
  const city = plan.area.metro.split(',')[0]!.split('-')[0]!.toUpperCase();
  const st = plan.area.state;

  const employer1 = rng.pick(EMPLOYERS);
  const employer2 = rng.pick(EMPLOYERS.filter((e) => e !== employer1));
  const landlord = rng.pick(LANDLORDS);
  const grocers = GROCERS_BY_STATE[st] ?? GROCERS_BY_STATE.TX!;
  const electric = ELECTRIC_BY_STATE[st] ?? 'CITY ELECTRIC UTILITY PPD';
  const friend = rng.pick(FRIENDS);

  // Pay: the main earner every other Friday, a second earner on the 15th and the last day.
  const main = TAKE_HOME_BY_BAND[spec.pay];
  const biweekly = cents((main * 12) / 26 * rng.between(0.995, 1.005));
  let payday = t0 + (((5 - new Date(t0).getUTCDay()) + 7) % 7) * DAY + rng.int(0, 1) * 7 * DAY;
  for (; payday <= t1; payday += 14 * DAY) add(payday, `${employer1} PAYROLL PPD ID: 9${ref(9)}`, biweekly, 'ACH_CREDIT');

  // Month by month.
  for (let y = start.y, m = start.m; toUtc({ y, m, d: 1 }) <= t1; m === 12 ? (y++, (m = 1)) : m++) {
    const dim = daysInMonth(y, m);
    const at = (d: number) => toUtc({ y, m, d: Math.min(d, dim) });
    const day = () => at(rng.int(1, dim));

    if (shape.earners === 2) {
      const semi = cents((main * 0.8) / 2 * rng.between(0.995, 1.005));
      add(at(15), `${employer2} DIR DEP PPD ID: 4${ref(9)}`, semi, 'ACH_CREDIT');
      add(at(dim), `${employer2} DIR DEP PPD ID: 4${ref(9)}`, semi, 'ACH_CREDIT');
    }

    // Home: rent on the 1st, power mid-month, internet, phone.
    const gross = plan.monthly.rentUtilities - 48 * shape.adults;
    const rent = round5(gross * 0.87);
    const internet = 70;
    add(at(1), `${landlord} RENT PPD ID: 1${ref(9)}`, -rent, 'ACH_DEBIT');
    add(at(17 + rng.int(0, 3)), electric, -Math.max(35, (gross - rent - internet) * rng.between(0.85, 1.2)), 'ACH_DEBIT');
    add(at(9), 'COMCAST XFINITY PPD', -internet, 'ACH_DEBIT');
    add(at(22), 'T-MOBILE PCS SVC', -48 * shape.adults, 'ACH_DEBIT');

    // Food: grocery trips adding up to the month, then meals out.
    const trips = rng.int(7, 10);
    for (let i = 0; i < trips; i++) {
      const share = (plan.monthly.groceries / trips) * rng.between(0.55, 1.45);
      add(day(), `${store(rng.pick(grocers))} ${city} ${st}`, -share, 'DEBIT_CARD');
    }
    const meals = Math.round(style.mealsOutPerWeek * (52 / 12) * (shape.adults === 2 ? 1.5 : 1) * rng.between(0.85, 1.15));
    for (let i = 0; i < meals; i++) {
      const [name, lo, hi] = rng.pick(EATING_OUT);
      add(day(), `${store(name)} ${city} ${st}`, -rng.between(lo, hi), 'DEBIT_CARD');
    }

    // Getting around.
    if (plan.hasCar) {
      const fills = rng.int(3, 5);
      const fuelMonth = plan.monthly.car - (areas.find((a) => a.zip === spec.zip)!.carInsuranceMonthly.value);
      for (let i = 0; i < fills; i++) add(day(), `${store(rng.pick(FUEL))} ${city} ${st}`, -(fuelMonth / fills) * rng.between(0.8, 1.2), 'DEBIT_CARD');
      add(at(5), 'GEICO AUTO INSURANCE PPD', -(plan.monthly.car - fuelMonth), 'ACH_DEBIT');
    } else {
      add(at(rng.int(1, 4)), 'MTA*NYCT PAYGO NEW YORK NY', -132, 'DEBIT_CARD');
    }

    // Kids.
    if (plan.monthly.childcare > 0) {
      add(at(1), 'KINDERCARE LEARNING CTR', -plan.monthly.childcare / 2, 'ACH_DEBIT');
      add(at(15), 'KINDERCARE LEARNING CTR', -plan.monthly.childcare / 2, 'ACH_DEBIT');
    }

    // Subscriptions on fixed days.
    SUBSCRIPTIONS.slice(0, style.subscriptions).forEach(([name, price], i) => add(at(3 + ((i * 7) % 25)), store(name), -price, 'DEBIT_CARD'));

    // Debt payments.
    if (plan.hasCar && spec.pay !== 'comfortable') add(at(12), 'TOYOTA MOTOR CREDIT PMT', spec.pay === 'lean' ? -312 : -389, 'ACH_DEBIT');
    else if (plan.hasCar && spec.style === 'spender') add(at(12), 'TOYOTA MOTOR CREDIT PMT', -545, 'ACH_DEBIT');
    if (spec.pay !== 'lean' && spec.household !== 'singleParent') add(at(20), 'NAVIENT STUDENT LN PMT', -262, 'ACH_DEBIT');
    if (spec.style === 'spender' || spec.pay === 'lean') add(at(25), 'CAPITAL ONE MOBILE PMT', -185, 'ACH_DEBIT');

    // Everything else: shopping, a pharmacy run, splitting dinner with a friend.
    const runs = rng.int(3, 6);
    for (let i = 0; i < runs; i++) add(day(), `${store(rng.pick(SHOPPING))} ${city} ${st}`, -(style.shoppingMonthly / runs) * rng.between(0.5, 1.5), 'DEBIT_CARD');
    if (rng.next() < 0.7) add(day(), `Zelle payment to ${friend} JPM99${ref(5)}`, -round5(rng.between(20, 60)), 'QUICKPAY_DEBIT');

    // Saving: a transfer the day after the first payday of the month.
    if (plan.monthly.savings > 0) add(at(rng.int(5, 9)), 'TRANSFER TO SAVINGS', -round5(plan.monthly.savings), 'ACCT_XFER');
  }

  // One trip in the middle month (a one-off the review should flag, not average in).
  if (spec.style !== 'saver') {
    const mid = start.m + 1 > 12 ? { y: start.y + 1, m: 1 } : { y: start.y, m: start.m + 1 };
    add(toUtc({ ...mid, d: 14 }), 'DELTA AIR LINES ATLANTA', -rng.between(240, 520) * shape.adults, 'DEBIT_CARD');
  }

  // Running balance, oldest first, then newest first like the bank's export.
  lines.sort((a, b) => a.t - b.t || (b.amount > 0 ? 1 : 0) - (a.amount > 0 ? 1 : 0));
  let balance = cents(plan.monthly.takeHome * style.openingMonthsOfPay);
  const rows = lines.map((l) => {
    balance = cents(balance + l.amount);
    return { ...l, balance };
  });
  rows.reverse();
  const header = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #';
  const csv = [header, ...rows.map((r) => [
    r.amount > 0 ? 'CREDIT' : 'DEBIT', usDate(fromUtc(r.t)), r.description.replace(/,/g, ' '), r.amount.toFixed(2), r.type, r.balance.toFixed(2), '',
  ].join(','))].join('\n') + '\n';

  return {
    csv,
    plan,
    lines: rows.length,
    from: iso(fromUtc(rows.at(-1)!.t)),
    to: iso(fromUtc(rows[0]!.t)),
  };
}
