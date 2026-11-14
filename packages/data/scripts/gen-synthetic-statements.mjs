#!/usr/bin/env node
// Builds 50 synthetic US checking-account exports as CSV, plus answer keys.
//
// Nobody here is real. People, employers, landlords, account numbers and the banks themselves are
// invented. What we do borrow from the real world is the *shape* of the data: national and regional
// chains in the states where they actually trade, utilities that really serve each ZIP, the way
// card, ACH, Zelle and transfer lines are worded by different banks, the Fed's business-day
// calendar, 2026 subscription prices, and take-home pay worked out from 2026 tax brackets.
// Rent, groceries, childcare, gas and car insurance come from packages/data/out/areas.json, the
// same numbers the app shows for each ZIP, so an uploaded sample lines up with its own area.
//
// Usage: node packages/data/scripts/gen-synthetic-statements.mjs [outDir]
// Everything is seeded per household, so reruns are byte-identical.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, '..');
const OUT = resolve(process.argv[2] ?? join(DATA, 'fixtures/synthetic-statements'));
const AREAS = new Map(JSON.parse(readFileSync(join(DATA, 'out/areas.json'), 'utf8')).map((a) => [a.zip, a]));
// areas.json names metros "Dallas-Fort Worth, TX"; the tables below are keyed by the short city.
const METRO_ALIAS = { 'Dallas-Fort Worth': 'Dallas', 'Minneapolis-St. Paul': 'Minneapolis' };
const metroKey = (name) => {
  const short = name.split(',')[0].trim();
  return METRO_ALIAS[short] ?? short;
};

// ─── Calendar ──────────────────────────────────────────────────────────────────────────────────
// Dates are whole days since 1970-01-01 (UTC), which keeps arithmetic and sorting trivial.
const DAY = 86400000;
const ed = (y, m, d) => Date.UTC(y, m - 1, d) / DAY;
const ymd = (n) => {
  const t = new Date(n * DAY);
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
};
const dow = (n) => (n + 4) % 7; // 0 = Sunday; 1970-01-01 was a Thursday
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// Fed holidays inside the window. July 4 2026 is a Saturday, and the Fed stays open the Friday
// before a Saturday holiday, so July 3 is an ordinary business day.
const HOLIDAYS = new Set([ed(2026, 9, 7), ed(2026, 10, 12), ed(2026, 11, 11)]);
const isBiz = (n) => dow(n) !== 0 && dow(n) !== 6 && !HOLIDAYS.has(n);
const nextBiz = (n) => {
  while (!isBiz(n)) n++;
  return n;
};
const prevBiz = (n) => {
  while (!isBiz(n)) n--;
  return n;
};
const mmdd = (n) => {
  const [, m, d] = ymd(n);
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
};
const usDate = (n) => `${mmdd(n)}/${ymd(n)[0]}`;
const isoDate = (n) => {
  const [y, m, d] = ymd(n);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// ─── Seeded randomness ─────────────────────────────────────────────────────────────────────────
function rngFor(seed) {
  let h = 2166136261 >>> 0;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  let a = h;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    uni: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    normal: (mu, sd) => mu + sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
    digits: (n) => Array.from({ length: n }, () => Math.floor(next() * 10)).join(''),
    alnum: (n, set = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789') =>
      Array.from({ length: n }, () => set[Math.floor(next() * set.length)]).join(''),
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [item, w] of pairs) if ((x -= w) < 0) return item;
      return pairs[pairs.length - 1][0];
    },
  };
  // Draw a dollar amount in [lo, hi] and return cents, skewed toward the low end the way real
  // receipts are (lots of $20 grocery runs, the odd $180 one).
  r.amt = (lo, hi, skew = 1.6) => Math.round((lo + (hi - lo) * Math.pow(next(), skew)) * 100);
  return r;
}

const cents = (dollars) => Math.round(dollars * 100);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

// ─── People names (only ever used for fictional counterparties and account holders) ──────────────
const FIRST_F = ['Maria', 'Aisha', 'Priya', 'Elena', 'Grace', 'Sofia', 'Mei', 'Hannah', 'Olivia', 'Fatima', 'Keisha', 'Ana',
  'Nadia', 'Chloe', 'Jasmine', 'Lena', 'Rachel', 'Imani', 'Yuki', 'Brianna', 'Megan', 'Tanya', 'Rosa', 'Leah', 'Allison',
  'Danielle', 'Vanessa', 'Monique', 'Lauren', 'Gabriela', 'Hye-jin', 'Erin', 'Tiffany', 'Carmen', 'Jenna', 'Amara', 'Lucia',
  'Kayla', 'Nicole', 'Ingrid', 'Destiny', 'Paola', 'Sarah', 'Wen', 'Shanice'];
const FIRST_M = ['James', 'David', 'Kevin', 'Marcus', 'Tyler', 'Andre', 'Brian', 'Carlos', 'Jamal', 'Luis', 'Ryan', 'Daniel',
  'Ethan', 'Victor', 'Omar', 'Derek', 'Hector', 'Tomas', 'Sean', 'Malik', 'Diego', 'Arjun', 'Caleb', 'Noah', 'Kwame',
  'Jordan', 'Miguel', 'Trevor', 'Darnell', 'Kenji', 'Patrick', 'Rafael', 'Steven', 'Andrew', 'Vikram', 'Terrence', 'Juan',
  'Corey', 'Eli', 'Mateo', 'Brandon', 'Jason', 'Minh', 'Isaiah', 'Gavin'];
const FIRST = [...FIRST_F, ...FIRST_M];
const LAST = ['Becker', 'Lopez', 'Nguyen', 'Johnson', 'Patel', 'Okafor', 'Kim', 'Rivera', 'Walsh', 'Brooks', 'Chen',
  'Hernandez', 'Morris', 'Shah', 'Coleman', 'Ramirez', 'Foster', 'Park', 'Delgado', 'Hughes', 'Reyes', 'Sullivan',
  'Washington', 'Kowalski', 'Ortiz', 'Bennett', 'Ali', 'Murphy', 'Castillo', 'Greene', 'Tran', 'Fischer', 'Mendoza',
  'Hayes', 'Silva', 'Abbott', 'Romero', 'Fleming', 'Gupta', 'Dawson', 'Vargas', 'Price', 'Ibrahim', 'Ward', 'Moreno',
  'Lindqvist', 'Banks', 'Torres', 'Yamamoto', 'Pierce'];

// ─── Places ────────────────────────────────────────────────────────────────────────────────────
// Store descriptors carry the city a card terminal reports, which for suburbs is the suburb.
const CITY_BY_ZIP = {
  10467: 'BRONX', 11385: 'RIDGEWOOD', 10801: 'NEW ROCHELLE', 85253: 'SCOTTSDALE', 91301: 'AGOURA HILLS', 60007: 'ELK GROVE VLG', 77449: 'KATY', 85225: 'CHANDLER', 19020: 'BENSALEM',
  78660: 'PFLUGERVILLE', 30350: 'SANDY SPRINGS', 98052: 'REDMOND', 80013: 'AURORA', '02124': 'DORCHESTER',
  '02184': 'BRAINTREE', 55420: 'BLOOMINGTON',
};
const STATE_NAME = { NY: 'NEW YORK', CA: 'CALIFORNIA', IL: 'ILLINOIS', TX: 'TEXAS', AZ: 'ARIZONA', PA: 'PENNSYLVANIA',
  GA: 'GEORGIA', FL: 'FLORIDA', WA: 'WASHINGTON', CO: 'COLORADO', MA: 'MASSACHUSETTS', TN: 'TENNESSEE', MN: 'MINNESOTA' };

// Per-metro flavour. `heat` drives the summer electric peak; `gasHeat` is whether homes heat with
// gas, so the gas bill climbs in October. Fuel prices and car insurance come straight from
// areas.json (EIA regional gas prices, NAIC state insurance averages).
const METROS = {
  'New York': { city: 'NEW YORK', heat: 0.9, gasHeat: true, transit: 'nyc', carless: 0.7,
    grocers: ['KEYFOOD', 'CTOWN', 'STOPSHOP', 'TRADERJOES', 'WHOLEFOODS'], fuel: ['SHELL', 'MOBIL', 'BP', 'SUNOCO'],
    elec: 'CONED', gasUtil: 'CONEDGAS', water: null, net: ['SPECTRUM', 'FIOS', 'OPTIMUM'], toll: 'E-ZPASS NY REPLENISH',
    eats: ['SHAKESHACK', 'DUNKIN', 'SWEETGREEN', 'HALAL'], coffee: ['STARBUCKS', 'DUNKIN'] },
  'Los Angeles': { city: 'LOS ANGELES', heat: 1.0, gasHeat: false, transit: 'la', carless: 0.1,
    grocers: ['RALPHS', 'VONS', 'FOOD4LESS', 'TRADERJOES', 'SPROUTS', 'NORTHGATE'], fuel: ['CHEVRON', 'ARCO', 'SHELL', '76'],
    elec: 'LADWP', gasUtil: 'SOCALGAS', water: null, net: ['SPECTRUM', 'ATT', 'FRONTIER'], toll: 'FASTRAK CSC',
    eats: ['INNOUT', 'JACKBOX', 'CHIPOTLE', 'PANDA'], coffee: ['STARBUCKS', 'COFFEEBEAN'] },
  Chicago: { city: 'CHICAGO', heat: 0.9, gasHeat: true, transit: 'chi', carless: 0.45,
    grocers: ['JEWEL', 'MARIANOS', 'ALDI', 'TONYS', 'WHOLEFOODS'], fuel: ['BP', 'SHELL', 'MOBIL', 'SPEEDWAY'],
    elec: 'COMED', gasUtil: 'PEOPLESGAS', water: null, net: ['XFINITY', 'ATT', 'ASTOUND'], toll: 'IPASS ILLINOIS TOLLWAY',
    eats: ['PORTILLOS', 'CHIPOTLE', 'DUNKIN', 'POTBELLY'], coffee: ['STARBUCKS', 'DUNKIN'] },
  Houston: { city: 'HOUSTON', heat: 1.25, gasHeat: false, transit: null, carless: 0,
    grocers: ['HEB', 'KROGER', 'FIESTA', 'WALMART'], fuel: ['SHELL', 'EXXON', 'BUCEES', 'VALERO', 'CHEVRON'],
    elec: 'RELIANT', gasUtil: 'CENTERPOINT', water: 'HOUSTONWATER', net: ['XFINITY', 'ATT'], toll: 'HCTRA EZ TAG',
    eats: ['WHATABURGER', 'TORCHYS', 'CANES', 'CHICKFILA'], coffee: ['STARBUCKS', 'DUTCHBROS'] },
  Phoenix: { city: 'PHOENIX', heat: 1.45, gasHeat: false, transit: null, carless: 0,
    grocers: ['FRYS', 'SAFEWAY', 'SPROUTS', 'FOODCITY', 'WALMART'], fuel: ['CIRCLEK', 'QT', 'SHELL', 'CHEVRON'],
    elec: 'APS', gasUtil: 'SWGAS', water: 'PHXWATER', net: ['COX', 'QUANTUM'], toll: null,
    eats: ['INNOUT', 'SONIC', 'CHICKFILA', 'FILIBERTOS'], coffee: ['DUTCHBROS', 'STARBUCKS'] },
  Philadelphia: { city: 'PHILADELPHIA', heat: 0.95, gasHeat: true, transit: 'phl', carless: 0.35,
    grocers: ['ACME', 'SHOPRITE', 'GIANT', 'ALDI', 'TRADERJOES'], fuel: ['WAWA', 'SUNOCO', 'GULF', 'EXXON'],
    elec: 'PECO', gasUtil: 'PGW', water: 'PHLWATER', net: ['XFINITY', 'FIOS'], toll: 'E-ZPASS PA REPLENISH',
    eats: ['CHIPOTLE', 'DUNKIN', 'CHICKFILA', 'PRIMOHOAGIES'], coffee: ['DUNKIN', 'STARBUCKS'] },
  Dallas: { city: 'DALLAS', heat: 1.25, gasHeat: false, transit: null, carless: 0,
    grocers: ['KROGER', 'TOMTHUMB', 'ALDI', 'SPROUTS', 'WALMART'], fuel: ['QT', 'RACETRAC', 'SHELL', '7ELEVEN', 'EXXON'],
    elec: 'TXU', gasUtil: 'ATMOS', water: 'DALLASWATER', net: ['SPECTRUM', 'ATT', 'FRONTIER'], toll: 'NTTA TOLLTAG',
    eats: ['WHATABURGER', 'TORCHYS', 'CANES', 'CHICKFILA'], coffee: ['STARBUCKS', 'DUTCHBROS'] },
  Austin: { city: 'AUSTIN', heat: 1.25, gasHeat: false, transit: null, carless: 0,
    grocers: ['HEB', 'RANDALLS', 'WHOLEFOODS', 'TRADERJOES', 'SPROUTS'], fuel: ['HEBFUEL', 'SHELL', 'VALERO', 'BUCEES', 'EXXON'],
    elec: 'AUSTINENERGY', gasUtil: 'TXGAS', water: null, net: ['SPECTRUM', 'ATT', 'GOOGLEFIBER'], toll: 'TXTAG',
    eats: ['WHATABURGER', 'TORCHYS', 'CHUYS', 'CHICKFILA'], coffee: ['STARBUCKS', 'DUTCHBROS'] },
  Atlanta: { city: 'ATLANTA', heat: 1.15, gasHeat: true, transit: 'atl', carless: 0.1,
    grocers: ['KROGER', 'PUBLIX', 'ALDI', 'SPROUTS'], fuel: ['QT', 'RACETRAC', 'SHELL', 'CHEVRON'],
    elec: 'GAPOWER', gasUtil: 'GASSOUTH', water: 'ATLWATER', net: ['XFINITY', 'ATT', 'GOOGLEFIBER'], toll: 'PEACH PASS',
    eats: ['CHICKFILA', 'ZAXBYS', 'WAFFLEHOUSE', 'CHIPOTLE'], coffee: ['STARBUCKS', 'DUNKIN'] },
  Miami: { city: 'MIAMI', heat: 1.3, gasHeat: false, transit: null, carless: 0.1,
    grocers: ['PUBLIX', 'SEDANOS', 'WINNDIXIE', 'ALDI', 'PRESIDENTE'], fuel: ['SHELL', 'MOBIL', 'RACETRAC', 'CHEVRON'],
    elec: 'FPL', gasUtil: null, water: 'MIAMIWATER', net: ['XFINITY', 'ATT'], toll: 'SUNPASS',
    eats: ['POLLOTROPICAL', 'CHICKFILA', 'CHIPOTLE', 'PINCHO'], coffee: ['STARBUCKS', 'VERSAILLESCAFE'] },
  Seattle: { city: 'SEATTLE', heat: 0.6, gasHeat: true, transit: 'sea', carless: 0.35,
    grocers: ['QFC', 'FREDMEYER', 'SAFEWAY', 'PCC', 'TRADERJOES'], fuel: ['CHEVRON', 'ARCO', 'SHELL', '76'],
    elec: 'SCL', gasUtil: 'PSE', water: 'SEAWATER', net: ['XFINITY', 'QUANTUM'], toll: 'GOOD TO GO WSDOT',
    eats: ['DICKS', 'CHIPOTLE', 'PANDA', 'MODPIZZA'], coffee: ['STARBUCKS', 'DUTCHBROS'] },
  Denver: { city: 'DENVER', heat: 0.85, gasHeat: true, transit: 'den', carless: 0.1,
    grocers: ['KINGSOOPERS', 'SAFEWAY', 'SPROUTS', 'NATURALGROCERS'], fuel: ['KINGSOOPERSFUEL', 'SHELL', 'CONOCO', 'MAVERIK'],
    elec: 'XCELCO', gasUtil: null, water: 'DENVERWATER', net: ['XFINITY', 'QUANTUM'], toll: 'E-470 EXPRESSTOLL',
    eats: ['CHIPOTLE', 'SNOOZE', 'CHICKFILA', 'ILLEGALPETES'], coffee: ['STARBUCKS', 'DUTCHBROS'] },
  Boston: { city: 'BOSTON', heat: 0.85, gasHeat: true, transit: 'bos', carless: 0.5,
    grocers: ['STOPSHOP', 'MARKETBASKET', 'STARMARKET', 'TRADERJOES', 'WHOLEFOODS'], fuel: ['SHELL', 'MOBIL', 'GULF', 'SUNOCO'],
    elec: 'EVERSOURCE', gasUtil: 'NATGRIDMA', water: 'BOSWATER', net: ['XFINITY', 'FIOS', 'ASTOUND'], toll: 'E-ZPASS MA',
    eats: ['DUNKIN', 'CHIPOTLE', 'SWEETGREEN', 'BOLOCO'], coffee: ['DUNKIN', 'STARBUCKS'] },
  Nashville: { city: 'NASHVILLE', heat: 1.1, gasHeat: true, transit: null, carless: 0,
    grocers: ['KROGER', 'PUBLIX', 'ALDI', 'TRADERJOES', 'WALMART'], fuel: ['SHELL', 'MAPCO', 'MARATHON', 'EXXON'],
    elec: 'NES', gasUtil: 'PIEDMONT', water: 'NASHWATER', net: ['XFINITY', 'ATT', 'GOOGLEFIBER'], toll: null,
    eats: ['HATTIEB', 'CHICKFILA', 'CANES', 'ZAXBYS'], coffee: ['STARBUCKS', 'DUNKIN'] },
  Minneapolis: { city: 'MINNEAPOLIS', heat: 0.75, gasHeat: true, transit: 'msp', carless: 0.2,
    grocers: ['CUB', 'HYVEE', 'ALDI', 'LUNDS', 'TRADERJOES'], fuel: ['HOLIDAY', 'KWIKTRIP', 'SPEEDWAY', 'BP'],
    elec: 'XCELMN', gasUtil: 'CENTERPOINTMN', water: 'MPLSWATER', net: ['XFINITY', 'USINTERNET', 'QUANTUM'], toll: null,
    eats: ['CULVERS', 'CHIPOTLE', 'PANERA', 'DAIRYQUEEN'], coffee: ['CARIBOU', 'STARBUCKS'] },
};

// ZIPs that differ from their metro: a different utility, a different set of stores, or big-box
// shopping that happens in the next town over.
const BIG_BOX = new Set(['COSTCO', 'COSTCOGAS', 'SAMS', 'BESTBUY', 'HOMEDEPOT', 'LOWES', 'TARGET', 'WALMART']);
const UTIL_BY_ZIP = {
  91301: { elec: 'SCE', water: 'LVMWD', shopCity: 'WESTLAKE VLG' },
  10467: { grocers: ['KEYFOOD', 'CTOWN', 'STOPSHOP', 'ALDI'], eats: ['DUNKIN', 'POPEYES', 'CHIPOTLE', 'HALAL'] }, 60007: { gasUtil: 'NICOR', water: 'ELKGROVEWATER' },
  77449: { water: 'KATYMUD' }, 85225: { elec: 'SRP', water: 'CHANDLERWATER' }, 19020: { gasUtil: 'PECOGAS', water: 'AQUAPA' },
  78660: { elec: 'TXU', water: 'PFLUGWATER' },
  98052: { elec: 'PSEELEC', water: 'REDMONDWATER' }, 80013: { water: 'AURORAWATER' }, '02184': { elec: 'BELD', water: 'BRAINTREEWATER' },
};

// ─── Merchant catalog ──────────────────────────────────────────────────────────────────────────
// One entry per merchant, one category per merchant. Whoever shops there, a Target run is `other`
// and a Kroger run is `groceries`; a categorizer only ever sees the label, so the answer key must
// never depend on who the shopper is.
//   d    descriptor template; {n} is a store number, {city}/{st} where the card was used
//   cat  the app's CostCategory
//   nd   digits in the store number
//   sun  false for chains that close on Sunday
//   brand clean name a neobank would show instead of the raw descriptor
const M = {
  // groceries
  WALMART: { d: 'WALMART SUPERCENTER #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Walmart' },
  ALDI: { d: 'ALDI {n} {city} {st}', nd: 5, cat: 'groceries', brand: 'Aldi' },
  TRADERJOES: { d: "TRADER JOE'S #{n} {city} {st}", nd: 3, cat: 'groceries', brand: "Trader Joe's" },
  WHOLEFOODS: { d: 'WHOLEFDS {abbr} {n} {city} {st}', nd: 5, cat: 'groceries', brand: 'Whole Foods Market' },
  COSTCO: { d: 'COSTCO WHSE #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Costco' },
  SAMS: { d: "SAM'S CLUB #{n} {city} {st}", nd: 4, cat: 'groceries', brand: "Sam's Club" },
  KEYFOOD: { d: 'KEY FOOD #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Key Food' },
  CTOWN: { d: 'CTOWN SUPERMARKET {city} {st}', nd: 0, cat: 'groceries', brand: 'C-Town Supermarket' },
  STOPSHOP: { d: 'STOP & SHOP {n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Stop & Shop' },
  RALPHS: { d: 'RALPHS #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Ralphs' },
  VONS: { d: 'VONS #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Vons' },
  FOOD4LESS: { d: 'FOOD 4 LESS #{n} {city} {st}', nd: 3, cat: 'groceries', brand: 'Food 4 Less' },
  SPROUTS: { d: 'SPROUTS FARMERS MAR #{n} {city} {st}', nd: 3, cat: 'groceries', brand: 'Sprouts Farmers Market' },
  NORTHGATE: { d: 'NORTHGATE MARKET #{n} {city} {st}', nd: 2, cat: 'groceries', brand: 'Northgate Market' },
  JEWEL: { d: 'JEWEL OSCO {n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Jewel-Osco' },
  MARIANOS: { d: "MARIANO'S #{n} {city} {st}", nd: 3, cat: 'groceries', brand: "Mariano's" },
  TONYS: { d: "TONY'S FRESH MARKET {city} {st}", nd: 0, cat: 'groceries', brand: "Tony's Fresh Market" },
  HEB: { d: 'H-E-B #{n} {city} {st}', nd: 3, cat: 'groceries', brand: 'H-E-B' },
  KROGER: { d: 'KROGER #{n} {city} {st}', nd: 3, cat: 'groceries', brand: 'Kroger' },
  FIESTA: { d: 'FIESTA MART #{n} {city} {st}', nd: 2, cat: 'groceries', brand: 'Fiesta Mart' },
  FRYS: { d: "FRY'S FOOD #{n} {city} {st}", nd: 3, cat: 'groceries', brand: "Fry's Food" },
  SAFEWAY: { d: 'SAFEWAY #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Safeway' },
  FOODCITY: { d: 'FOOD CITY #{n} {city} {st}', nd: 2, cat: 'groceries', brand: 'Food City' },
  ACME: { d: 'ACME MARKETS #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Acme Markets' },
  SHOPRITE: { d: 'SHOPRITE {city} S1 {st}', nd: 0, cat: 'groceries', brand: 'ShopRite' },
  GIANT: { d: 'GIANT {n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Giant' },
  TOMTHUMB: { d: 'TOM THUMB #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Tom Thumb' },
  RANDALLS: { d: 'RANDALLS #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Randalls' },
  PUBLIX: { d: 'PUBLIX #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Publix' },
  SEDANOS: { d: "SEDANO'S #{n} {city} {st}", nd: 2, cat: 'groceries', brand: "Sedano's" },
  WINNDIXIE: { d: 'WINN-DIXIE #{n} {city} {st}', nd: 3, cat: 'groceries', brand: 'Winn-Dixie' },
  PRESIDENTE: { d: 'PRESIDENTE SUPERMARKET {n} {city} {st}', nd: 2, cat: 'groceries', brand: 'Presidente Supermarket' },
  QFC: { d: 'QFC #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'QFC' },
  FREDMEYER: { d: 'FRED-MEYER #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Fred Meyer' },
  PCC: { d: 'PCC COMMUNITY MARKETS {city} {st}', nd: 0, cat: 'groceries', brand: 'PCC Community Markets' },
  KINGSOOPERS: { d: 'KING SOOPERS #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'King Soopers' },
  NATURALGROCERS: { d: 'NATURAL GROCERS {n} {city} {st}', nd: 3, cat: 'groceries', brand: 'Natural Grocers' },
  MARKETBASKET: { d: 'MARKET BASKET {n} {city} {st}', nd: 2, cat: 'groceries', brand: 'Market Basket' },
  STARMARKET: { d: 'STAR MARKET {n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Star Market' },
  CUB: { d: 'CUB FOODS #{n} {city} {st}', nd: 4, cat: 'groceries', brand: 'Cub Foods' },
  HYVEE: { d: 'HY-VEE {city} {n} {st}', nd: 4, cat: 'groceries', brand: 'Hy-Vee' },
  LUNDS: { d: 'LUNDS&BYERLYS {city} {st}', nd: 0, cat: 'groceries', brand: 'Lunds & Byerlys' },
  INSTACART: { d: 'INSTACART HTTPSINSTACAR CA', nd: 0, cat: 'groceries', brand: 'Instacart' },

  // fuel and other running costs of a car
  SHELL: { d: 'SHELL OIL {n} {city} {st}', nd: 11, cat: 'car', brand: 'Shell' },
  MOBIL: { d: 'EXXONMOBIL {n} {city} {st}', nd: 8, cat: 'car', brand: 'Mobil' },
  EXXON: { d: 'EXXON {n} {city} {st}', nd: 8, cat: 'car', brand: 'Exxon' },
  BP: { d: 'BP#{n} {city} {st}', nd: 7, cat: 'car', brand: 'BP' },
  SUNOCO: { d: 'SUNOCO {n} {city} {st}', nd: 10, cat: 'car', brand: 'Sunoco' },
  CHEVRON: { d: 'CHEVRON {n} {city} {st}', nd: 7, cat: 'car', brand: 'Chevron' },
  ARCO: { d: 'ARCO #{n} {city} {st}', nd: 5, cat: 'car', brand: 'ARCO' },
  76: { d: '76 - {n} {city} {st}', nd: 7, cat: 'car', brand: '76' },
  SPEEDWAY: { d: 'SPEEDWAY {n} {city} {st}', nd: 5, cat: 'car', brand: 'Speedway' },
  BUCEES: { d: "BUC-EE'S #{n} {city} {st}", nd: 2, cat: 'car', brand: "Buc-ee's", cityBy: { Houston: 'KATY', Austin: 'BASTROP' } },
  VALERO: { d: 'VALERO {n} {city} {st}', nd: 4, cat: 'car', brand: 'Valero' },
  CIRCLEK: { d: 'CIRCLE K {n} {city} {st}', nd: 5, cat: 'car', brand: 'Circle K' },
  QT: { d: 'QT {n} {city} {st}', nd: 4, cat: 'car', brand: 'QuikTrip' },
  RACETRAC: { d: 'RACETRAC{n} {city} {st}', nd: 3, cat: 'car', brand: 'RaceTrac' },
  '7ELEVEN': { d: '7-ELEVEN {n} {city} {st}', nd: 5, cat: 'car', brand: '7-Eleven' },
  WAWA: { d: 'WAWA {n} {city} {st}', nd: 4, cat: 'car', brand: 'Wawa' },
  GULF: { d: 'GULF OIL {n} {city} {st}', nd: 8, cat: 'car', brand: 'Gulf' },
  HEBFUEL: { d: 'H-E-B GAS #{n} {city} {st}', nd: 3, cat: 'car', brand: 'H-E-B Gas' },
  KINGSOOPERSFUEL: { d: 'KING SOOPERS FUEL #{n} {city} {st}', nd: 3, cat: 'car', brand: 'King Soopers Fuel' },
  CONOCO: { d: 'CONOCO - {n} {city} {st}', nd: 5, cat: 'car', brand: 'Conoco' },
  MAVERIK: { d: 'MAVERIK #{n} {city} {st}', nd: 3, cat: 'car', brand: 'Maverik' },
  MAPCO: { d: 'MAPCO #{n} {city} {st}', nd: 4, cat: 'car', brand: 'MAPCO' },
  MARATHON: { d: 'MARATHON PETRO{n} {city} {st}', nd: 6, cat: 'car', brand: 'Marathon' },
  HOLIDAY: { d: 'HOLIDAY STATIONS {n} {city} {st}', nd: 4, cat: 'car', brand: 'Holiday' },
  KWIKTRIP: { d: 'KWIK TRIP {n} {city} {st}', nd: 4, cat: 'car', brand: 'Kwik Trip' },
  COSTCOGAS: { d: 'COSTCO GAS #{n} {city} {st}', nd: 4, cat: 'car', brand: 'Costco Gas' },
  VALVOLINE: { d: 'VALVOLINE INSTANT OIL {n} {city} {st}', nd: 4, cat: 'car', brand: 'Valvoline' },
  TAKE5: { d: 'TAKE 5 OIL CHANGE #{n} {city} {st}', nd: 3, cat: 'car', brand: 'Take 5 Oil Change' },
  FIRESTONE: { d: 'FIRESTONE #{n} {city} {st}', nd: 4, cat: 'car', brand: 'Firestone' },
  AUTOZONE: { d: 'AUTOZONE #{n} {city} {st}', nd: 4, cat: 'car', brand: 'AutoZone' },
  PEPBOYS: { d: 'PEP BOYS #{n} {city} {st}', nd: 4, cat: 'car', brand: 'Pep Boys' },
  PARKING: { d: 'SP+ PARKING {n} {city} {st}', nd: 4, cat: 'car', brand: 'SP+ Parking' },
  PARKMOBILE: { d: 'PARKMOBILE {city} {st}', nd: 0, cat: 'car', brand: 'ParkMobile' },
  CARWASH: { d: 'MISTER CAR WASH {n} {city} {st}', nd: 3, cat: 'car', brand: 'Mister Car Wash' },

  // eating out
  STARBUCKS: { d: 'STARBUCKS STORE {n} {city} {st}', nd: 5, cat: 'eatingOut', brand: 'Starbucks' },
  DUNKIN: { d: 'DUNKIN #{n} {city} {st}', nd: 6, cat: 'eatingOut', brand: "Dunkin'" },
  DUTCHBROS: { d: 'DUTCH BROS {n} {city} {st}', nd: 3, cat: 'eatingOut', brand: 'Dutch Bros' },
  COFFEEBEAN: { d: 'COFFEE BEAN STORE {n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'The Coffee Bean' },
  CARIBOU: { d: 'CARIBOU COFFEE {n} {city} {st}', nd: 3, cat: 'eatingOut', brand: 'Caribou Coffee' },
  VERSAILLESCAFE: { d: 'SQ *CAFE LA VENTANITA {city} {st}', nd: 0, cat: 'eatingOut', brand: 'Cafe La Ventanita' },
  MCD: { d: "MCDONALD'S F{n} {city} {st}", nd: 5, cat: 'eatingOut', brand: "McDonald's" },
  TACOBELL: { d: 'TACO BELL #{n} {city} {st}', nd: 6, cat: 'eatingOut', brand: 'Taco Bell' },
  WENDYS: { d: "WENDY'S #{n} {city} {st}", nd: 4, cat: 'eatingOut', brand: "Wendy's" },
  BK: { d: 'BURGER KING #{n} {city} {st}', nd: 5, cat: 'eatingOut', brand: 'Burger King' },
  CHICKFILA: { d: 'CHICK-FIL-A #{n} {city} {st}', nd: 5, cat: 'eatingOut', brand: 'Chick-fil-A', sun: false },
  CHIPOTLE: { d: 'CHIPOTLE {n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'Chipotle' },
  SUBWAY: { d: 'SUBWAY {n} {city} {st}', nd: 5, cat: 'eatingOut', brand: 'Subway' },
  PANERA: { d: 'PANERA BREAD #{n} {city} {st}', nd: 6, cat: 'eatingOut', brand: 'Panera Bread' },
  POPEYES: { d: 'POPEYES {n} {city} {st}', nd: 5, cat: 'eatingOut', brand: 'Popeyes' },
  DOMINOS: { d: "DOMINO'S {n} {city} {st}", nd: 4, cat: 'eatingOut', brand: "Domino's" },
  PANDA: { d: 'PANDA EXPRESS #{n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'Panda Express' },
  SONIC: { d: 'SONIC DRIVE IN #{n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'Sonic' },
  CANES: { d: "RAISING CANES {n} {city} {st}", nd: 4, cat: 'eatingOut', brand: "Raising Cane's" },
  WINGSTOP: { d: 'WINGSTOP {n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'Wingstop' },
  WHATABURGER: { d: 'WHATABURGER {n} {city} {st}', nd: 3, cat: 'eatingOut', brand: 'Whataburger' },
  TORCHYS: { d: "TORCHY'S TACOS {city} {st}", nd: 0, cat: 'eatingOut', brand: "Torchy's Tacos" },
  CHUYS: { d: "CHUY'S {n} {city} {st}", nd: 2, cat: 'eatingOut', brand: "Chuy's" },
  INNOUT: { d: 'IN N OUT BURGER {n} {city} {st}', nd: 3, cat: 'eatingOut', brand: 'In-N-Out Burger' },
  JACKBOX: { d: 'JACK IN THE BOX {n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'Jack in the Box' },
  SHAKESHACK: { d: 'SHAKE SHACK {n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'Shake Shack' },
  SWEETGREEN: { d: 'SWEETGREEN {city} {st}', nd: 0, cat: 'eatingOut', brand: 'sweetgreen' },
  HALAL: { d: 'SQ *HALAL CART 53RD {city} {st}', nd: 0, cat: 'eatingOut', brand: 'Halal Cart 53rd' },
  PORTILLOS: { d: "PORTILLO'S {n} {city} {st}", nd: 3, cat: 'eatingOut', brand: "Portillo's" },
  POTBELLY: { d: 'POTBELLY #{n} {city} {st}', nd: 3, cat: 'eatingOut', brand: 'Potbelly' },
  FILIBERTOS: { d: "FILIBERTO'S MEXICAN {city} {st}", nd: 0, cat: 'eatingOut', brand: "Filiberto's" },
  PRIMOHOAGIES: { d: 'PRIMO HOAGIES {city} {st}', nd: 0, cat: 'eatingOut', brand: 'Primo Hoagies' },
  ZAXBYS: { d: "ZAXBY'S #{n} {city} {st}", nd: 4, cat: 'eatingOut', brand: "Zaxby's" },
  WAFFLEHOUSE: { d: 'WAFFLE HOUSE {n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'Waffle House' },
  POLLOTROPICAL: { d: 'POLLO TROPICAL #{n} {city} {st}', nd: 3, cat: 'eatingOut', brand: 'Pollo Tropical' },
  PINCHO: { d: 'PINCHO {city} {st}', nd: 0, cat: 'eatingOut', brand: 'Pincho' },
  DICKS: { d: "DICK'S DRIVE-IN {city} {st}", nd: 0, cat: 'eatingOut', brand: "Dick's Drive-In" },
  MODPIZZA: { d: 'MOD PIZZA {n} {city} {st}', nd: 4, cat: 'eatingOut', brand: 'MOD Pizza' },
  SNOOZE: { d: 'SNOOZE AM EATERY {city} {st}', nd: 0, cat: 'eatingOut', brand: 'Snooze' },
  ILLEGALPETES: { d: "ILLEGAL PETE'S {city} {st}", nd: 0, cat: 'eatingOut', brand: "Illegal Pete's" },
  BOLOCO: { d: 'SQ *CLOVER FOOD LAB {city} {st}', nd: 0, cat: 'eatingOut', brand: 'Clover Food Lab' },
  HATTIEB: { d: "HATTIE B'S HOT CHICKEN {city} {st}", nd: 0, cat: 'eatingOut', brand: "Hattie B's" },
  CULVERS: { d: "CULVER'S OF {city} {st}", nd: 0, cat: 'eatingOut', brand: "Culver's" },
  DAIRYQUEEN: { d: 'DAIRY QUEEN #{n} {city} {st}', nd: 5, cat: 'eatingOut', brand: 'Dairy Queen' },
  UBEREATS: { d: 'UBER *EATS HELP.UBER.COM CA', nd: 0, cat: 'eatingOut', brand: 'Uber Eats' },

  // other: general merchandise, pharmacy, personal care, entertainment, kids, pets
  TARGET: { d: 'TARGET T-{n} {city} {st}', nd: 4, cat: 'other', brand: 'Target' },
  AMAZON: { d: 'AMAZON MKTPL*{code} AMZN.COM/BILL WA', nd: 0, cat: 'other', brand: 'Amazon' },
  AMAZONCOM: { d: 'AMAZON.COM*{code} AMZN.COM/BILL WA', nd: 0, cat: 'other', brand: 'Amazon' },
  HOMEDEPOT: { d: 'THE HOME DEPOT #{n} {city} {st}', nd: 4, cat: 'other', brand: 'The Home Depot' },
  LOWES: { d: "LOWE'S #{n} {city} {st}", nd: 4, cat: 'other', brand: "Lowe's" },
  TJMAXX: { d: 'TJMAXX #{n} {city} {st}', nd: 4, cat: 'other', brand: 'TJ Maxx' },
  ROSS: { d: 'ROSS STORES #{n} {city} {st}', nd: 4, cat: 'other', brand: 'Ross' },
  OLDNAVY: { d: 'OLD NAVY US {n} {city} {st}', nd: 4, cat: 'other', brand: 'Old Navy' },
  BESTBUY: { d: 'BEST BUY {n} {city} {st}', nd: 8, cat: 'other', brand: 'Best Buy' },
  DOLLARTREE: { d: 'DOLLAR TREE {n} {city} {st}', nd: 4, cat: 'other', brand: 'Dollar Tree' },
  DOLLARGENERAL: { d: 'DOLLAR GENERAL #{n} {city} {st}', nd: 5, cat: 'other', brand: 'Dollar General' },
  FIVEBELOW: { d: 'FIVE BELOW {n} {city} {st}', nd: 4, cat: 'other', brand: 'Five Below' },
  ULTA: { d: 'ULTA #{n} {city} {st}', nd: 4, cat: 'other', brand: 'Ulta Beauty' },
  TEMU: { d: 'TEMU.COM 888-355-7759 MA', nd: 0, cat: 'other', brand: 'Temu' },
  ETSY: { d: 'ETSY.COM - {shop} BROOKLYN NY', nd: 0, cat: 'other', brand: 'Etsy' },
  CVS: { d: 'CVS/PHARMACY #{n} {city} {st}', nd: 5, cat: 'other', brand: 'CVS Pharmacy' },
  WALGREENS: { d: 'WALGREENS #{n} {city} {st}', nd: 5, cat: 'other', brand: 'Walgreens' },
  GREATCLIPS: { d: 'GREAT CLIPS #{n} {city} {st}', nd: 4, cat: 'other', brand: 'Great Clips' },
  BARBER: { d: 'SQ *FRESH CUTS BARBERSHOP {city} {st}', nd: 0, cat: 'other', brand: 'Fresh Cuts Barbershop' },
  WAXCENTER: { d: 'EUROPEAN WAX CENTER {city} {st}', nd: 0, cat: 'other', brand: 'European Wax Center' },
  AMC: { d: 'AMC {n} ONLINE 888-440-4262 KS', nd: 4, cat: 'other', brand: 'AMC Theatres' },
  TICKETMASTER: { d: 'TICKETMASTER 800-653-8000 CA', nd: 0, cat: 'other', brand: 'Ticketmaster' },
  STEAM: { d: 'STEAMGAMES.COM 4259522985 WA', nd: 0, cat: 'other', brand: 'Steam' },
  PETSMART: { d: 'PETSMART # {n} {city} {st}', nd: 4, cat: 'other', brand: 'PetSmart' },
  CHEWY: { d: 'CHEWY.COM 800-672-4399 FL', nd: 0, cat: 'other', brand: 'Chewy' },
  CARTERS: { d: "CARTER'S #{n} {city} {st}", nd: 4, cat: 'other', brand: "Carter's" },
  STAPLES: { d: 'STAPLES {n} {city} {st}', nd: 5, cat: 'other', brand: 'Staples' },
  SPIRIT: { d: 'SPIRIT HALLOWEEN {n} {city} {st}', nd: 4, cat: 'other', brand: 'Spirit Halloween' },
  SCHOOLLUNCH: { d: 'MYSCHOOLBUCKS.COM 855-832-5226 GA', nd: 0, cat: 'other', brand: 'MySchoolBucks' },
  LEAGUE: { d: 'LEAGUEAPPS*YOUTH SOCCER NEW YORK NY', nd: 0, cat: 'other', brand: 'LeagueApps' },
  // IKEA has one store per metro at most, rarely in the core city.
  IKEA: { d: 'IKEA {city} {st}', nd: 0, cat: 'other', brand: 'IKEA', cityBy: { 'New York': 'BROOKLYN', 'Los Angeles': 'BURBANK', Chicago: 'SCHAUMBURG',
    Houston: 'HOUSTON', Phoenix: 'TEMPE', Philadelphia: 'PHILADELPHIA', Dallas: 'FRISCO', Austin: 'ROUND ROCK', Atlanta: 'ATLANTA', Miami: 'MIAMI',
    Seattle: 'RENTON', Denver: 'CENTENNIAL', Boston: 'STOUGHTON', Minneapolis: 'BLOOMINGTON' } },
  LABCORP: { d: 'LABCORP 888-522-2677 NC', nd: 0, cat: 'other', brand: 'Labcorp' },
  DENTAL: { d: 'SQ *BRIGHT SMILES DENTAL {city} {st}', nd: 0, cat: 'other', brand: 'Bright Smiles Dental' },
  URGENTCARE: { d: 'SQ *CITY URGENT CARE {city} {st}', nd: 0, cat: 'other', brand: 'City Urgent Care' },
  VET: { d: 'SQ *PAWS & CLAWS VET {city} {st}', nd: 0, cat: 'other', brand: 'Paws & Claws Vet' },
  SOUTHWEST: { d: 'SOUTHWES {n} 800-435-9792 TX', nd: 13, cat: 'other', brand: 'Southwest Airlines' },
  DELTA: { d: 'DELTA AIR LINES {n} ATLANTA GA', nd: 13, cat: 'other', brand: 'Delta Air Lines' },
  UNITED: { d: 'UNITED {n} 800-932-2732 TX', nd: 13, cat: 'other', brand: 'United Airlines' },
  HOTEL: { d: 'HAMPTON INN {city2} {st2}', nd: 0, cat: 'other', brand: 'Hampton Inn' },
  AIRBNB: { d: 'AIRBNB * HM{code} AIRBNB.COM CA', nd: 0, cat: 'other', brand: 'Airbnb' },
  UBERTRIP: { d: 'UBER *TRIP HELP.UBER.COM CA', nd: 0, cat: 'other', brand: 'Uber' },
  LYFT: { d: 'LYFT *RIDE {dayname} {hour}PM LYFT.COM CA', nd: 0, cat: 'other', brand: 'Lyft' },
  GOFUNDME: { d: 'GOFUNDME *{cause} REDWOOD CITY CA', nd: 0, cat: 'other', brand: 'GoFundMe' },
  LAUNDRY: { d: 'CSC SERVICEWORKS 516-349-8555 NY', nd: 0, cat: 'other', brand: 'CSC ServiceWorks' },
};
const LOCAL_FOOD_A = ['BLUE', 'LITTLE', 'GOLDEN', 'RED', 'OLD TOWN', 'SUNNY', 'NORTHSIDE', 'CORNER', 'LUCKY', 'COPPER',
  'TWO BROTHERS', 'MAPLE', 'HARBOR', 'UNION', 'PARKSIDE', 'MAIN STREET', 'SILVER', 'JADE', 'LEMON', 'OAK', 'FIG', 'SAFFRON',
  'ROSE', 'EMBER', 'JUNIPER', 'STATION', 'HIGHLINE', 'PINE', 'RIVERSIDE', 'LANTERN', 'ORCHARD', 'MISSION', 'BRASS', 'TIDE'];
// Cuisine and a believable per-person price (before tax and tip).
const CUISINES = [['TAQUERIA', 10, 17], ['KITCHEN', 17, 30], ['NOODLE HOUSE', 13, 20], ['PHO', 13, 19], ['THAI', 15, 23],
  ['SUSHI', 22, 45], ['BBQ', 17, 27], ['PIZZERIA', 13, 24], ['DINER', 13, 21], ['BISTRO', 27, 50], ['RAMEN', 16, 23],
  ['GRILL', 18, 32], ['CANTINA', 16, 28], ['CURRY HOUSE', 15, 23], ['BAKERY', 8, 15], ['DELI', 11, 17], ['BURGER CO', 13, 20],
  ['TAPAS', 26, 44], ['STEAKHOUSE', 45, 85]];
const LOCAL_BAR_B = ['TAP ROOM', 'PUB', 'LOUNGE', 'BREWING CO', 'SALOON'];

// 2026 list prices (US, monthly unless noted). Streaming went up again in 2025–26: Netflix
// Standard $19.99, Spotify $12.99, Disney+ and Hulu ad-free $18.99.
const SUBS = {
  netflixAds: { d: 'NETFLIX.COM 866-579-7172 CA', p: 899, brand: 'Netflix' },
  netflix: { d: 'NETFLIX.COM 866-579-7172 CA', p: 1999, brand: 'Netflix' },
  netflixPremium: { d: 'NETFLIX.COM 866-579-7172 CA', p: 2699, brand: 'Netflix' },
  spotify: { d: 'SPOTIFY USA 877-778-1161 NY', p: 1299, brand: 'Spotify' },
  disneyAds: { d: 'DISNEY PLUS 888-905-7888 CA', p: 1199, brand: 'Disney+' },
  disney: { d: 'DISNEY PLUS 888-905-7888 CA', p: 1899, brand: 'Disney+' },
  huluAds: { d: 'HULU 877-824-4858 CA', p: 1199, brand: 'Hulu' },
  hbomax: { d: 'HBO MAX NEW YORK NY', p: 1849, brand: 'HBO Max' },
  peacock: { d: 'PEACOCK PREMIUM NEW YORK NY', p: 1099, brand: 'Peacock' },
  paramount: { d: 'PARAMOUNT+ 888-274-5343 CA', p: 899, brand: 'Paramount+' },
  ytPremium: { d: 'GOOGLE *YOUTUBEPREMIUM G.CO/HELPPAY# CA', p: 1399, brand: 'YouTube Premium' },
  ytTV: { d: 'GOOGLE *YOUTUBE TV G.CO/HELPPAY# CA', p: 8299, brand: 'YouTube TV' },
  icloud: { d: 'APPLE.COM/BILL 866-712-7753 CA', p: 299, brand: 'Apple' },
  icloud2tb: { d: 'APPLE.COM/BILL 866-712-7753 CA', p: 999, brand: 'Apple' },
  prime: { d: 'AMAZON PRIME*{code} AMZN.COM/BILL WA', p: 1499, brand: 'Amazon Prime' },
  audible: { d: 'AUDIBLE*{code} AMZN.COM/BILL NJ', p: 1495, brand: 'Audible' },
  xbox: { d: 'MICROSOFT*XBOX MSBILL.INFO WA', p: 2999, brand: 'Xbox' },
  psplus: { d: 'PLAYSTATION NETWORK SAN MATEO CA', p: 999, brand: 'PlayStation' },
  chatgpt: { d: 'OPENAI *CHATGPT SUBSCR OPENAI.COM CA', p: 2000, brand: 'OpenAI' },
  nyt: { d: 'NYTIMES*NYTIMES DIGITAL NEW YORK NY', p: 2500, brand: 'New York Times' },
  pfClassic: { d: 'PLANET FITNESS 603-750-0001 NH', p: 1500, brand: 'Planet Fitness' },
  pfBlack: { d: 'PLANET FITNESS 603-750-0001 NH', p: 2499, brand: 'Planet Fitness' },
  laFitness: { d: 'LA FITNESS IRVINE CA', p: 4499, brand: 'LA Fitness' },
  crunch: { d: 'CRUNCH FITNESS {city} {st}', p: 3299, brand: 'Crunch Fitness' },
  equinox: { d: 'EQUINOX {city} {st}', p: 28500, brand: 'Equinox' },
  orangetheory: { d: 'ORANGETHEORY FITNESS {city} {st}', p: 16900, brand: 'Orangetheory' },
  ymca: { d: 'YMCA OF {metroU} MBRSHIP DRAFT', p: 9800, brand: 'YMCA' },
};

// Utilities and telecom. `kind` decides the bill size model; descriptors are what lands in the
// account when autopay runs.
const UTIL = {
  CONED: { d: 'CON ED OF NY INTELL CK', kind: 'elec' },
  CONEDGAS: { d: 'CON ED OF NY INTELL CK', kind: 'gasInElec' },
  LADWP: { d: 'LADWP WEB PAYMENT', kind: 'elec' },
  SCE: { d: 'SO CAL EDISON CO BILL PAYMT', kind: 'elec' },
  SOCALGAS: { d: 'SO CAL GAS PAID SCGC', kind: 'gas' },
  LVMWD: { d: 'LAS VIRGENES MWD WATER BILL', kind: 'water' },
  COMED: { d: 'COMED PAYMENTS', kind: 'elec' },
  PEOPLESGAS: { d: 'PEOPLES GAS PAYMENTS', kind: 'gas' },
  NICOR: { d: 'NICOR GAS GAS PAYMNT', kind: 'gas' },
  ELKGROVEWATER: { d: 'VILLAGE OF ELK GROVE WATER', kind: 'water' },
  RELIANT: { d: 'RELIANT ENERGY RETAIL SERVICES', kind: 'elec' },
  TXU: { d: 'TXU ENERGY WEB PMT', kind: 'elec' },
  CENTERPOINT: { d: 'CENTERPOINT ENERGY PAYMENTS', kind: 'gas' },
  HOUSTONWATER: { d: 'CITY OF HOUSTON WATER BILL', kind: 'water' },
  KATYMUD: { d: 'HARRIS CO MUD 155 WATER', kind: 'water' },
  APS: { d: 'APS ELECTRIC PMT', kind: 'elec' },
  SRP: { d: 'SRP SALT RIVER PROJECT', kind: 'elec' },
  SWGAS: { d: 'SOUTHWEST GAS UTIL PMT', kind: 'gas' },
  PHXWATER: { d: 'CITY OF PHOENIX UTILITY', kind: 'water' },
  CHANDLERWATER: { d: 'CITY OF CHANDLER UTIL BILL', kind: 'water' },
  PECO: { d: 'PECO ENERGY UTIL PAYMT', kind: 'elec' },
  PECOGAS: { d: 'PECO ENERGY UTIL PAYMT', kind: 'gasInElec' },
  PGW: { d: 'PHILADELPHIA GAS WORKS', kind: 'gas' },
  PHLWATER: { d: 'PHILA WATER REVENUE BUREAU', kind: 'water' },
  AQUAPA: { d: 'AQUA PENNSYLVANIA WATER BILL', kind: 'water' },
  ATMOS: { d: 'ATMOS ENERGY PAYMENT', kind: 'gas' },
  DALLASWATER: { d: 'CITY OF DALLAS UTILITIES', kind: 'water' },
  PFLUGWATER: { d: 'CITY OF PFLUGERVILLE UTIL', kind: 'water' },
  AUSTINENERGY: { d: 'CITY OF AUSTIN UTILITIES', kind: 'elecWater' },
  TXGAS: { d: 'TEXAS GAS SERVICE PAYMENT', kind: 'gas' },
  GAPOWER: { d: 'GEORGIA POWER BILL PAY', kind: 'elec' },
  GASSOUTH: { d: 'GAS SOUTH LLC PAYMENT', kind: 'gas' },
  ATLWATER: { d: 'CITY OF ATLANTA WATERSHED', kind: 'water' },
  FPL: { d: 'FPL DIRECT DEBIT ELEC PYMT', kind: 'elec' },
  MIAMIWATER: { d: 'MIAMI-DADE WASD WATER BILL', kind: 'water' },
  SCL: { d: 'SEATTLE CITY LIGHT PAYMENT', kind: 'elec' },
  PSE: { d: 'PUGET SOUND ENERGY BILLPAY', kind: 'gas' },
  PSEELEC: { d: 'PUGET SOUND ENERGY BILLPAY', kind: 'elecGas' },
  SEAWATER: { d: 'SEATTLE PUBLIC UTILITIES', kind: 'water' },
  REDMONDWATER: { d: 'CITY OF REDMOND UTILITY', kind: 'water' },
  XCELCO: { d: 'XCEL ENERGY-PSCO XCELENERGY', kind: 'elecGas' },
  DENVERWATER: { d: 'DENVER WATER BILL PAYMENT', kind: 'water' },
  AURORAWATER: { d: 'AURORA WATER UTIL PMT', kind: 'water' },
  EVERSOURCE: { d: 'EVERSOURCE ENERGY BILL PAY', kind: 'elec' },
  NATGRIDMA: { d: 'NATIONAL GRID MA UTIL PAYMT', kind: 'gas' },
  BOSWATER: { d: 'BOSTON WATER AND SEWER', kind: 'water' },
  BELD: { d: 'BRAINTREE ELECTRIC LIGHT DEPT', kind: 'elec' },
  BRAINTREEWATER: { d: 'TOWN OF BRAINTREE WATER', kind: 'water' },
  NES: { d: 'NASHVILLE ELECTRIC SERVICE', kind: 'elec' },
  PIEDMONT: { d: 'PIEDMONT NATURAL GAS', kind: 'gas' },
  NASHWATER: { d: 'METRO WATER SERVICES NASHVILLE', kind: 'water' },
  XCELMN: { d: 'XCEL ENERGY-NSP XCELENERGY', kind: 'elec' },
  CENTERPOINTMN: { d: 'CENTERPOINT ENERGY MN', kind: 'gas' },
  MPLSWATER: { d: 'CITY OF MPLS UTILITY BILLING', kind: 'water' },
  CONSERVICE: { d: 'CONSERVICE UTILITY PMT', kind: 'aptWater' },
  // internet
  SPECTRUM: { d: 'SPECTRUM 855-707-7328 MO', kind: 'net' },
  FIOS: { d: 'VERIZON FIOS BILL PAY', kind: 'net' },
  OPTIMUM: { d: 'OPTIMUM 7816 CABLE PAYMT', kind: 'net' },
  ATT: { d: 'ATT*BILL PAYMENT 800-331-0500 TX', kind: 'net' },
  FRONTIER: { d: 'FRONTIER COMM ONLINE PMT', kind: 'net' },
  XFINITY: { d: 'COMCAST CABLE COMM 800-COMCAST', kind: 'net' },
  ASTOUND: { d: 'ASTOUND BROADBAND PAYMENT', kind: 'net' },
  COX: { d: 'COX COMM PHX AUTOPAY', kind: 'net' },
  QUANTUM: { d: 'QUANTUM FIBER BILL PAY', kind: 'net' },
  GOOGLEFIBER: { d: 'GOOGLE FIBER INC', kind: 'net' },
  USINTERNET: { d: 'US INTERNET CORP MINNETONKA MN', kind: 'net' },
};
const MOBILE = {
  verizon: { d: 'VERIZON WIRELESS PAYMENTS', perLine: [6500, 9000], ach: true },
  att: { d: 'ATT*BILL PAYMENT 800-331-0500 TX', perLine: [6000, 8500], ach: true },
  tmobile: { d: 'T-MOBILE AUTOPAY 800-937-8997 WA', perLine: [5000, 7500], ach: true },
  mint: { d: 'MINT MOBILE 800-683-7392 CA', perLine: [1500, 3000], ach: false },
  visible: { d: 'VISIBLE SERVICE DENVER CO', perLine: [2500, 4500], ach: false },
  cricket: { d: 'CRICKET WIRELESS 800-274-2538 GA', perLine: [3500, 5500], ach: false },
  metro: { d: 'METRO BY T-MOBILE 888-863-8768 WA', perLine: [3000, 5000], ach: false },
};
const TRANSIT = {
  nyc: { d: 'MTA*NYCT PAYGO NEW YORK NY', fare: 300, cap: 3500 }, // OMNY: $3.00 a ride, capped at 12 rides a week
  chi: { d: 'VENTRA CTA 877-669-8368 IL', pass: 7500 },
  phl: { d: 'SEPTA KEY CARD PHILADELPHIA PA', pass: 10400 },
  bos: { d: 'MBTA CHARLIECARD BOSTON MA', pass: 9000 },
  sea: { d: 'ORCA CARD KING COUNTY SEATTLE WA', pass: 9900 },
  la: { d: 'TAP LA METRO LOS ANGELES CA', fare: 175, cap: 2500 },
  atl: { d: 'MARTA BREEZE ATLANTA GA', fare: 250, cap: 2300 },
  den: { d: 'RTD DENVER MYRIDE DENVER CO', fare: 275, cap: 8800 },
  msp: { d: 'METRO TRANSIT GOTO MINNEAPOLIS MN', fare: 200, cap: 7600 },
};

// ─── Taxes (2026, approximate) ─────────────────────────────────────────────────────────────────
// Good enough to turn gross pay into a believable paycheck. Not tax advice and not exact: no
// credits beyond the child tax credit, flat state rates, and local taxes only where they bite.
const STD = { single: 16100, mfj: 32200, hoh: 24150 };
const BRACKETS = {
  single: [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
  mfj: [[24800, 0.1], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]],
  hoh: [[17700, 0.1], [67450, 0.12], [105700, 0.22], [201750, 0.24], [256200, 0.32], [640600, 0.35], [Infinity, 0.37]],
};
const STATE_TAX = { NY: 0.055, CA: 0.05, IL: 0.0495, PA: 0.0307, AZ: 0.025, GA: 0.0519, CO: 0.044, MA: 0.05, MN: 0.06,
  TX: 0, FL: 0, WA: 0, TN: 0 };
const LOCAL_TAX = { 10013: 0.036, 10467: 0.036, 11385: 0.036, 19132: 0.0374, 19125: 0.0374, 19103: 0.0374 };
// Sales tax that shows up on streaming and other digital subscriptions in some places.
const DIGITAL_TAX = { WA: 0.1025, TX: 0.0825, TN: 0.0925, PA: 0.06, MN: 0.0803 };
const CHICAGO_AMUSEMENT_TAX = new Set(['60621', '60618', '60611']);
const PERIODS = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, military: 24 };

function bracketTax(income, brackets) {
  let tax = 0;
  let floor = 0;
  for (const [top, rate] of brackets) {
    if (income <= floor) break;
    tax += (Math.min(income, top) - floor) * rate;
    floor = top;
  }
  return tax;
}

// Take-home per W-2 earner per year. Freelance and gig income arrives gross; those households pay
// estimated tax themselves (see estimatedTax below).
function payroll(hh) {
  const w2 = hh.earners.filter((e) => e.type !== 'gig' && e.type !== 'freelance');
  const gross = sum(w2.map((e) => e.gross));
  if (!gross) return new Map();
  const pre = sum(w2.map((e) => e.gross * ((e.k401 ?? 0) + (e.pension ?? 0)) + (e.health ?? 0)));
  const status = hh.adults === 2 ? 'mfj' : hh.kids.length ? 'hoh' : 'single';
  const fed = Math.max(0, bracketTax(Math.max(0, gross - pre - STD[status]), BRACKETS[status]) - 2200 * hh.kids.length);
  const state = (STATE_TAX[hh.state] ?? 0) * Math.max(0, gross - pre - (status === 'mfj' ? 10000 : 5000));
  const local = (LOCAL_TAX[hh.zip] ?? 0) * (gross - pre);
  const fica = 0.0765 * sum(w2.map((e) => e.gross - (e.health ?? 0)));
  const sdi = hh.state === 'CA' ? 0.013 * gross : 0;
  const totalTax = fed + state + local + fica + sdi;
  const out = new Map();
  for (const e of w2) {
    const own = e.gross * (1 - (e.k401 ?? 0) - (e.pension ?? 0)) - (e.health ?? 0);
    out.set(e, own - totalTax * (e.gross / gross));
  }
  return out;
}

// ─── Households ────────────────────────────────────────────────────────────────────────────────
// Fifty hand-picked lives across the app's 15 metros and 60 ZIPs. Each line is a compact brief;
// the generator fills in everything else (bills, merchants, timings) from it.
//
// earner types: salary (same net every check), hourly (hours wobble), tipped (small check + cash
// tips), gig (platform payouts, no withholding), freelance (client payments), military (1st/15th)
// home: rent | own | share (renting a room, rent split with roommates)
// card: 'payer' clears a credit card in full each month, 'revolver' pays a fixed amount
const E = (type, gross, freq, o = {}) => ({ type, gross, freq, ...o });
const ROSTER = [
  { id: 'hh01', zip: '78704', slug: 'austin-single-renter', ages: [28], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'chase',
    earners: [E('salary', 68000, 'biweekly', { k401: 0.05, health: 1800, employer: 'NORTHWIND DIGITAL LLC' })],
    card: 'payer', cardShare: 0.25, savings: 0.08, pets: 'cat', subs: ['spotify', 'netflix', 'icloud', 'pfBlack'] },
  { id: 'hh02', zip: '11385', slug: 'queens-retail-roommates', ages: [26], kids: [], home: 'share', beds: 3, cars: 0, layout: 'neobank',
    earners: [E('hourly', 36500, 'weekly', { health: 0, employer: 'BROADWAY OUTFITTERS INC' })],
    tight: true, bnpl: true, cash: true, subs: ['spotifyFamilyShare', 'huluAds'], odOptIn: true },
  { id: 'hh03', zip: '10013', slug: 'nyc-finance-high-earner', ages: [34], kids: [], home: 'rent', beds: 1, cars: 0, layout: 'bofa',
    earners: [E('salary', 215000, 'semimonthly', { k401: 0.1, health: 2600, employer: 'HUDSON YARD CAPITAL LP' })],
    card: 'payer', cardShare: 0.7, savings: 0.12, invest: 0.15, student: 0, subs: ['netflixPremium', 'spotify', 'nyt', 'equinox', 'icloud2tb', 'hbomax'] },
  { id: 'hh04', zip: '10467', slug: 'bronx-nurse-single-parent', ages: [37], kids: ['schoolAge', 'preschool'], home: 'rent', beds: 2, cars: 0, layout: 'chase',
    earners: [E('hourly', 94000, 'biweekly', { k401: 0.04, health: 3600, overtime: true, employer: 'MONTEFIORE PARK MEDICAL GRP' })],
    childSupport: 7200, freePreK: true, rentFactor: 0.72, card: 'revolver', cardPay: 15000, savings: 0.03, subs: ['netflixAds', 'disneyAds', 'spotify'] },
  { id: 'hh05', zip: '10801', slug: 'new-rochelle-dink-renters', ages: [31, 32], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'online',
    earners: [E('salary', 88000, 'biweekly', { k401: 0.06, health: 4200, employer: 'LANTERN MEDIA GROUP' }), E('salary', 79000, 'semimonthly', { k401: 0.05, employer: 'GREYSTONE ARCHITECTS PC' })],
    card: 'payer', cardShare: 0.4, savings: 0.12, invest: 0.04, student: 31000, subs: ['netflix', 'spotify', 'ytPremium', 'crunch', 'nyt'] },
  { id: 'hh06', zip: '90011', slug: 'la-warehouse-family', ages: [33, 31], kids: ['toddler', 'schoolAge'], home: 'rent', beds: 2, cars: 1, layout: 'chase',
    earners: [E('hourly', 55000, 'weekly', { health: 3200, employer: 'PACIFIC RIM DISTRIBUTION' }), E('hourly', 23000, 'biweekly', { employer: 'SUNRISE HOME CARE AGENCY' })],
    auto: [38900], informalCare: 500, rentFactor: 0.8, tight: true, bnpl: true, cash: true, relatives: true, subs: ['netflixAds', 'disneyAds'] },
  { id: 'hh07', zip: '90042', slug: 'la-rideshare-driver', ages: [30], kids: [], home: 'rent', beds: 0, cars: 1, layout: 'neobank',
    earners: [E('gig', 66000, 'weekly', { platforms: ['UBER', 'LYFT'] })], auto: [52800], marketplaceHealth: 310, estTax: true,
    card: 'revolver', cardPay: 9000, savings: 0.03, subs: ['spotify', 'netflixAds'] },
  { id: 'hh08', zip: '90024', slug: 'la-new-grad-roommates', ages: [25], kids: [], home: 'share', beds: 2, cars: 1, layout: 'online',
    earners: [E('salary', 74000, 'semimonthly', { k401: 0.04, health: 1500, employer: 'BRIGHTPATH LEARNING INC' })],
    student: 38500, card: 'payer', cardShare: 0.2, savings: 0.08, subs: ['spotifyStudentNo', 'netflixAds', 'chatgpt', 'pfClassic'] },
  { id: 'hh09', zip: '91301', slug: 'agoura-hills-two-kid-homeowners', ages: [42, 41], kids: ['schoolAge', 'schoolAge'], home: 'own', beds: 4, cars: 2, layout: 'bofa',
    earners: [E('salary', 168000, 'biweekly', { k401: 0.08, health: 7200, employer: 'SIERRA AEROSTRUCTURES INC' }), E('hourly', 58000, 'biweekly', { employer: 'CONEJO VALLEY DENTAL GRP' })],
    auto: [64900], card: 'payer', cardShare: 0.55, savings: 0.03, invest: 0.03, college529: 20000, pets: 'dog',
    subs: ['netflix', 'disney', 'spotify', 'prime', 'icloud2tb', 'ytTV'] },
  { id: 'hh10', zip: '60621', slug: 'chicago-hourly-low-income', ages: [29], kids: [], home: 'rent', beds: 1, cars: 0, layout: 'cu',
    earners: [E('hourly', 33000, 'weekly', { employer: 'LAKESHORE FOODSERVICE LLC' })],
    tight: true, bnpl: true, cash: true, subs: ['netflixAds'], odOptIn: true },
  { id: 'hh11', zip: '60618', slug: 'chicago-condo-couple', ages: [36, 35], kids: [], home: 'own', beds: 2, cars: 1, layout: 'chase',
    earners: [E('salary', 97000, 'biweekly', { k401: 0.06, health: 4400, employer: 'WINDY CITY LOGISTICS INC' }), E('salary', 71000, 'semimonthly', { k401: 0.05, employer: 'NORTH BRANCH CHARTER SCHOOLS' })],
    hoa: 38000, card: 'payer', cardShare: 0.35, savings: 0.1, invest: 0.03, pets: 'dog', subs: ['netflix', 'spotify', 'hbomax', 'pfClassic'] },
  { id: 'hh12', zip: '60611', slug: 'chicago-consultant', ages: [39], kids: [], home: 'rent', beds: 1, cars: 0, layout: 'online',
    earners: [E('salary', 178000, 'semimonthly', { k401: 0.1, health: 2200, employer: 'CALUMET STRATEGY PARTNERS' })],
    card: 'payer', cardShare: 0.6, savings: 0.1, invest: 0.12, subs: ['netflix', 'spotify', 'nyt', 'orangetheory', 'icloud'] },
  { id: 'hh13', zip: '60007', slug: 'elk-grove-single-income-family', ages: [40, 38], kids: ['infant', 'schoolAge', 'schoolAge'], home: 'own', beds: 3, cars: 2, layout: 'cu',
    earners: [E('salary', 112000, 'biweekly', { k401: 0.05, health: 7000, employer: 'MIDWEST ELEVATOR SVC CO' })],
    auto: [47900], card: 'revolver', cardPay: 25000, savings: 0.02, subs: ['netflixAds', 'disney', 'prime'] },
  { id: 'hh14', zip: '77033', slug: 'houston-single-mom-preschooler', ages: [32], kids: ['preschool'], home: 'rent', beds: 1, cars: 1, layout: 'neobank',
    earners: [E('hourly', 39000, 'biweekly', { employer: 'GULF COAST DIALYSIS LLC' })], childSupport: 4800, ccSubsidy: 280,
    subprimeAuto: 41800, tight: true, bnpl: true, subs: ['netflixAds'] },
  { id: 'hh15', zip: '77008', slug: 'houston-engineer-renter', ages: [27], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'chase',
    earners: [E('salary', 84000, 'semimonthly', { k401: 0.06, health: 1600, employer: 'BAYOU PROCESS ENGINEERING' })],
    auto: [46500], student: 29000, card: 'payer', cardShare: 0.3, savings: 0.1, subs: ['spotify', 'ytPremium', 'xbox', 'laFitness'] },
  { id: 'hh16', zip: '77019', slug: 'houston-river-oaks-dinks', ages: [33, 35], kids: [], home: 'rent', beds: 2, cars: 2, layout: 'bofa',
    earners: [E('salary', 142000, 'biweekly', { k401: 0.08, health: 4800, employer: 'ALLEN PARKWAY ENERGY LLC' }), E('salary', 96000, 'semimonthly', { k401: 0.06, employer: 'MONTROSE PEDIATRIC THERAPY' })],
    auto: [58900, 43200], card: 'payer', cardShare: 0.5, savings: 0.08, invest: 0.08, subs: ['netflix', 'spotify', 'hbomax', 'peacock', 'orangetheory'] },
  { id: 'hh17', zip: '77449', slug: 'katy-family-of-five', ages: [38, 37], kids: ['preschool', 'schoolAge', 'schoolAge'], home: 'own', beds: 4, cars: 2, layout: 'cu',
    earners: [E('salary', 108000, 'biweekly', { k401: 0.05, health: 7400, employer: 'WESTPARK PIPELINE SVCS' }), E('hourly', 52000, 'biweekly', { employer: 'KATY ISD PAYROLL' })],
    auto: [54300], card: 'revolver', cardPay: 22000, savings: 0.03, college529: 10000, pets: 'dog', subs: ['netflix', 'disneyAds', 'prime', 'ymca'] },
  { id: 'hh18', zip: '85009', slug: 'phoenix-server-tips', ages: [26], kids: [], home: 'rent', beds: 0, cars: 1, layout: 'neobank',
    earners: [E('tipped', 46000, 'weekly', { employer: 'CAMELBACK HOSPITALITY GRP' })],
    tight: true, cash: true, bnpl: true, subs: ['spotify', 'pfClassic'] },
  { id: 'hh19', zip: '85018', slug: 'phoenix-teacher-monthly-pay', ages: [35], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'cu',
    earners: [E('salary', 61000, 'monthly', { k401: 0.0, pension: 0.12, health: 1400, employer: 'SALT RIVER ELEM SCHOOL DIST' })],
    student: 24500, savings: 0.04, pets: 'cat', subs: ['netflixAds', 'spotify', 'icloud'] },
  { id: 'hh20', zip: '85253', slug: 'scottsdale-freelance-designer', ages: [38], kids: [], home: 'rent', beds: 2, cars: 1, layout: 'online',
    earners: [E('freelance', 105000, 'irregular', {})], marketplaceHealth: 540, estTax: true,
    card: 'payer', cardShare: 0.35, savings: 0.05, subs: ['spotify', 'adobe', 'netflix', 'icloud2tb', 'chatgpt'] },
  { id: 'hh21', zip: '85225', slug: 'chandler-young-family', ages: [34, 33], kids: ['infant', 'preschool'], home: 'own', beds: 3, cars: 2, layout: 'chase',
    earners: [E('salary', 124000, 'biweekly', { k401: 0.06, health: 7000, employer: 'SONORAN SEMICONDUCTOR INC' }), E('hourly', 31000, 'biweekly', { employer: 'CHANDLER REGIONAL RETAIL' })],
    auto: [49800], card: 'payer', cardShare: 0.3, savings: 0.04, subs: ['netflix', 'disney', 'prime', 'spotify'] },
  { id: 'hh22', zip: '19132', slug: 'philly-home-health-aide-mom', ages: [41], kids: ['schoolAge', 'schoolAge'], home: 'rent', beds: 2, cars: 0, layout: 'cu',
    earners: [E('hourly', 38000, 'weekly', { employer: 'KEYSTONE CARE PARTNERS' })], childSupport: 6000, snap: true,
    tight: true, cash: true, subs: ['netflixAds'] },
  { id: 'hh23', zip: '19125', slug: 'philly-research-coordinator', ages: [26], kids: [], home: 'share', beds: 3, cars: 0, layout: 'online',
    earners: [E('salary', 59000, 'monthly', { k401: 0.05, health: 1100, employer: 'SCHUYLKILL RESEARCH INSTITUTE' })],
    student: 27500, savings: 0.08, subs: ['spotify', 'netflixAds', 'chatgpt'] },
  { id: 'hh24', zip: '19103', slug: 'philly-rittenhouse-dinks', ages: [30, 31], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'chase',
    earners: [E('salary', 165000, 'semimonthly', { k401: 0.08, health: 4600, employer: 'WALNUT STREET LEGAL LLP' }), E('salary', 76000, 'biweekly', { k401: 0.04, employer: 'FAIRMOUNT CREATIVE CO' })],
    student: 89000, card: 'payer', cardShare: 0.5, savings: 0.08, invest: 0.06, subs: ['netflix', 'spotify', 'nyt', 'peacock', 'orangetheory'] },
  { id: 'hh25', zip: '19020', slug: 'bensalem-family-renters', ages: [36, 35], kids: ['schoolAge'], home: 'rent', beds: 2, cars: 2, layout: 'bofa',
    earners: [E('hourly', 74000, 'weekly', { k401: 0.03, health: 6200, employer: 'DELAWARE VALLEY FREIGHT' }), E('salary', 49000, 'biweekly', { employer: 'NESHAMINY MEDICAL BILLING' })],
    auto: [44100, 31800], card: 'revolver', cardPay: 20000, savings: 0.03, subs: ['netflixAds', 'disneyAds', 'prime', 'pfClassic'] },
  { id: 'hh26', zip: '75216', slug: 'dallas-warehouse-hourly', ages: [27], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'neobank',
    earners: [E('hourly', 43000, 'weekly', { employer: 'TRINITY FULFILLMENT LLC' })], subprimeAuto: 46800,
    tight: true, bnpl: true, cash: true, subs: ['netflixAds', 'psplus'] },
  { id: 'hh27', zip: '75206', slug: 'dallas-sales-rep-revolver', ages: [30], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'chase',
    earners: [E('salary', 79000, 'semimonthly', { k401: 0.03, health: 1700, commission: true, employer: 'LONE STAR MEDICAL SUPPLY' })],
    auto: [51200], card: 'revolver', cardPay: 35000, personalLoan: 28900, savings: 0.02, subs: ['spotify', 'netflix', 'hbomax', 'laFitness'] },
  { id: 'hh28', zip: '75205', slug: 'dallas-park-cities-family', ages: [44, 42], kids: ['schoolAge', 'schoolAge'], home: 'own', beds: 4, cars: 2, layout: 'bofa',
    earners: [E('salary', 235000, 'semimonthly', { k401: 0.1, health: 7600, employer: 'PRESTON HOLLOW ADVISORS' })],
    card: 'payer', cardShare: 0.7, savings: 0.08, invest: 0.12, college529: 50000, pets: 'dog',
    subs: ['netflixPremium', 'disney', 'spotify', 'ytTV', 'icloud2tb'] },
  { id: 'hh29', zip: '75216', slug: 'south-dallas-mechanic-family', ages: [39, 38], kids: ['toddler', 'schoolAge'], home: 'own', beds: 3, cars: 2, layout: 'cu',
    earners: [E('hourly', 66000, 'biweekly', { k401: 0.03, health: 6400, overtime: true, employer: 'NORTH TEXAS FLEET SVC' }), E('hourly', 31000, 'biweekly', { employer: 'DALLAS ISD PAYROLL' })],
    auto: [39600], informalCare: 400, card: 'revolver', cardPay: 15000, bnpl: true, savings: 0.02, subs: ['netflixAds', 'disneyAds', 'prime'] },
  { id: 'hh30', zip: '78744', slug: 'austin-delivery-gig', ages: [34], kids: [], home: 'share', beds: 2, cars: 1, layout: 'neobank',
    earners: [E('gig', 44000, 'weekly', { platforms: ['DOORDASH', 'INSTACART'] })], auto: [33900], estTax: true,
    savings: 0.03, subs: ['spotify', 'netflixAds'] },
  { id: 'hh31', zip: '78703', slug: 'austin-software-engineer', ages: [31], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'online',
    earners: [E('salary', 188000, 'biweekly', { k401: 0.1, health: 1900, employer: 'BARTON CREEK SOFTWARE INC' })],
    card: 'payer', cardShare: 0.6, savings: 0.06, invest: 0.2, crypto: true, subs: ['spotify', 'ytPremium', 'chatgpt', 'netflix', 'orangetheory'] },
  { id: 'hh32', zip: '78660', slug: 'pflugerville-new-parents', ages: [29, 30], kids: ['infant'], home: 'rent', beds: 2, cars: 2, layout: 'chase',
    earners: [E('salary', 74000, 'biweekly', { k401: 0.04, health: 6800, employer: 'HILL COUNTRY HVAC SERVICES' })],
    auto: [41500], card: 'revolver', cardPay: 12000, tight: true, subs: ['netflixAds', 'disneyAds', 'prime'] },
  { id: 'hh33', zip: '30315', slug: 'atlanta-single-mom-toddler', ages: [34], kids: ['toddler'], home: 'rent', beds: 1, cars: 1, layout: 'bofa',
    earners: [E('hourly', 45000, 'biweekly', { health: 2400, employer: 'PEACHTREE PATIENT ACCESS' })],
    auto: [33400], ccSubsidy: 220, tight: true, bnpl: true, subs: ['netflixAds', 'spotify'], odOptIn: true },
  { id: 'hh34', zip: '30316', slug: 'atlanta-grad-roommates', ages: [25], kids: [], home: 'share', beds: 3, cars: 1, layout: 'neobank',
    earners: [E('salary', 53000, 'biweekly', { k401: 0.03, health: 1300, employer: 'MIDTOWN MARKETING COLLECTIVE' })],
    student: 31500, bnpl: true, savings: 0.04, subs: ['spotifyStudentNo', 'netflixAds', 'hbomax'] },
  { id: 'hh35', zip: '30305', slug: 'buckhead-physician-family', ages: [45, 43], kids: ['preschool', 'schoolAge', 'schoolAge'], home: 'own', beds: 5, cars: 2, layout: 'chase',
    earners: [E('salary', 310000, 'semimonthly', { k401: 0.08, health: 8200, employer: 'NORTHSIDE CARDIOLOGY ASSOC' })],
    student: 145000, auto: [89900], card: 'payer', cardShare: 0.7, savings: 0.04, invest: 0.03, college529: 40000,
    privateSchool: 34000, pets: 'dog', subs: ['netflixPremium', 'disney', 'spotify', 'ytTV', 'icloud2tb', 'peacock'] },
  { id: 'hh36', zip: '30350', slug: 'sandy-springs-empty-nest-dinks', ages: [41, 44], kids: [], home: 'own', beds: 3, cars: 2, layout: 'cu',
    earners: [E('salary', 101000, 'biweekly', { k401: 0.08, health: 4400, employer: 'PERIMETER HEALTH SYSTEMS' }), E('salary', 89000, 'semimonthly', { k401: 0.06, employer: 'CHATTAHOOCHEE INSURANCE GRP' })],
    auto: [47200], card: 'payer', cardShare: 0.45, savings: 0.12, invest: 0.06, pets: 'dog', subs: ['netflix', 'spotify', 'peacock', 'paramount', 'laFitness'] },
  { id: 'hh37', zip: '33142', slug: 'miami-two-job-family', ages: [31, 30], kids: ['toddler', 'schoolAge'], home: 'rent', beds: 2, cars: 1, layout: 'neobank',
    earners: [E('hourly', 40000, 'weekly', { employer: 'BISCAYNE BAY HOTELS LLC' }), E('hourly', 33000, 'biweekly', { employer: 'LITTLE HAVANA CHILD ACADEMY' })],
    auto: [36200], informalCare: 450, tight: true, bnpl: true, cash: true, relatives: true, subs: ['netflixAds', 'disneyAds'] },
  { id: 'hh38', zip: '33131', slug: 'brickell-single-professional', ages: [33], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'bofa',
    earners: [E('salary', 124000, 'biweekly', { k401: 0.06, health: 2000, employer: 'BRICKELL TRADE FINANCE LLC' })],
    lease: 59900, card: 'payer', cardShare: 0.45, savings: 0.06, invest: 0.06, subs: ['netflix', 'spotify', 'hbomax', 'equinox'] },
  { id: 'hh39', zip: '33186', slug: 'kendall-police-nurse-family', ages: [37, 36], kids: ['preschool', 'schoolAge'], home: 'own', beds: 3, cars: 2, layout: 'chase',
    earners: [E('salary', 84000, 'biweekly', { k401: 0.0, pension: 0.1, health: 6600, employer: 'MIAMI-DADE COUNTY PAYROLL' }), E('hourly', 76000, 'biweekly', { overtime: true, employer: 'KENDALL BAPTIST MEDICAL' })],
    auto: [52600, 38400], card: 'revolver', cardPay: 25000, savings: 0.04, subs: ['netflix', 'disneyAds', 'prime', 'spotify'] },
  { id: 'hh40', zip: '98118', slug: 'seattle-barista-tips', ages: [27], kids: [], home: 'share', beds: 3, cars: 0, layout: 'cu',
    earners: [E('tipped', 47000, 'biweekly', { employer: 'RAINIER BEACH COFFEE CO' })],
    student: 18500, savings: 0.03, cash: true, subs: ['spotify', 'netflixAds'] },
  { id: 'hh41', zip: '98103', slug: 'seattle-carless-nurse', ages: [29], kids: [], home: 'rent', beds: 1, cars: 0, layout: 'online',
    earners: [E('salary', 102000, 'semimonthly', { k401: 0.06, health: 1700, employer: 'LAKE UNION MEDICAL CENTER' })],
    student: 34000, card: 'payer', cardShare: 0.35, savings: 0.12, invest: 0.06, pets: 'cat', subs: ['spotify', 'netflix', 'icloud', 'ymca'] },
  { id: 'hh42', zip: '98052', slug: 'redmond-tech-couple-baby', ages: [35, 34], kids: ['infant'], home: 'own', beds: 3, cars: 2, layout: 'chase',
    earners: [E('salary', 228000, 'semimonthly', { k401: 0.1, health: 5200, employer: 'CASCADE CLOUD SYSTEMS' }), E('salary', 162000, 'biweekly', { k401: 0.1, employer: 'EVERGREEN GAMES STUDIO' })],
    card: 'payer', cardShare: 0.65, savings: 0.08, invest: 0.15, college529: 50000, subs: ['netflix', 'spotify', 'disney', 'prime', 'ytPremium', 'icloud2tb'] },
  { id: 'hh43', zip: '80219', slug: 'denver-one-income-toddler', ages: [28, 27], kids: ['toddler'], home: 'rent', beds: 2, cars: 1, layout: 'neobank',
    earners: [E('hourly', 62000, 'biweekly', { health: 5400, employer: 'FRONT RANGE ROOFING CO' })],
    auto: [37400], tight: true, bnpl: true, subs: ['netflixAds', 'disneyAds'] },
  { id: 'hh44', zip: '80205', slug: 'denver-retail-manager', ages: [32], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'bofa',
    earners: [E('salary', 77000, 'semimonthly', { k401: 0.04, health: 1600, employer: 'MILE HIGH OUTFITTERS INC' })],
    auto: [42900], card: 'revolver', cardPay: 20000, savings: 0.05, pets: 'dog', subs: ['spotify', 'peacock', 'netflixAds', 'pfBlack'] },
  { id: 'hh45', zip: '80013', slug: 'aurora-air-force-family', ages: [30, 29], kids: ['preschool'], home: 'rent', beds: 2, cars: 2, layout: 'cu',
    earners: [E('military', 84000, 'military', { k401: 0.05, employer: 'DFAS-CLEVELAND' })],
    auto: [48700, 29900], usaa: true, savings: 0.06, subs: ['netflix', 'disneyAds', 'xbox'] },
  { id: 'hh46', zip: '02124', slug: 'dorchester-nonprofit-roommates', ages: [27], kids: [], home: 'share', beds: 3, cars: 0, layout: 'online',
    earners: [E('salary', 55000, 'biweekly', { k401: 0.03, health: 1400, employer: 'COMMONWEALTH YOUTH ALLIANCE' })],
    student: 29000, savings: 0.05, subs: ['spotify', 'netflixAds', 'nyt'] },
  { id: 'hh47', zip: '02116', slug: 'back-bay-biotech-dinks', ages: [32, 33], kids: [], home: 'rent', beds: 2, cars: 0, layout: 'bofa',
    earners: [E('salary', 148000, 'semimonthly', { k401: 0.08, health: 4200, employer: 'CHARLES RIVER THERAPEUTICS' }), E('salary', 121000, 'biweekly', { k401: 0.06, employer: 'KENDALL SQ ANALYTICS INC' })],
    card: 'payer', cardShare: 0.55, savings: 0.1, invest: 0.1, subs: ['netflix', 'spotify', 'hbomax', 'nyt', 'orangetheory'] },
  { id: 'hh48', zip: '02184', slug: 'braintree-electrician-family', ages: [40, 39], kids: ['toddler', 'schoolAge'], home: 'own', beds: 3, cars: 2, layout: 'chase',
    earners: [E('hourly', 108000, 'weekly', { k401: 0.04, health: 6900, overtime: true, employer: 'IBEW LOCAL PAYROLL SVCS' }), E('hourly', 46000, 'biweekly', { employer: 'SOUTH SHORE ORTHO GRP' })],
    auto: [56300], card: 'revolver', cardPay: 20000, savings: 0.02, pets: 'dog', subs: ['netflix', 'disneyAds', 'prime', 'peacock'] },
  { id: 'hh49', zip: '37207', slug: 'nashville-two-gigs', ages: [31], kids: [], home: 'rent', beds: 1, cars: 1, layout: 'neobank',
    earners: [E('hourly', 24000, 'biweekly', { employer: 'MUSIC ROW EVENT STAFFING' }), E('gig', 30000, 'weekly', { platforms: ['DOORDASH'] })],
    subprimeAuto: 38800, estTax: true, savings: 0.02, bnpl: true, cash: true, subs: ['spotify', 'netflixAds'] },
  { id: 'hh50', zip: '55408', slug: 'minneapolis-teacher-single-dad', ages: [43], kids: ['schoolAge', 'schoolAge'], home: 'rent', beds: 2, cars: 1, layout: 'cu',
    earners: [E('salary', 69000, 'semimonthly', { k401: 0.0, pension: 0.075, health: 4800, employer: 'MINNEHAHA PUBLIC SCHOOLS' })],
    auto: [34500], noAfterSchool: true, savings: 0.03, subs: ['netflix', 'disneyAds', 'spotify'] },
];

// A couple of brief keys above aren't real products; map them to what they mean.
SUBS.spotifyFamilyShare = { d: 'VENMO_SHARE', p: 0 }; // pays a friend for a Spotify Family slot via Venmo
SUBS.spotifyStudentNo = SUBS.spotify; // graduated, so it's full price now
SUBS.adobe = { d: 'ADOBE *CREATIVE CLD 408-536-6000 CA', p: 6999, brand: 'Adobe' };

// ─── Banks (all invented) and their export layouts ─────────────────────────────────────────────
// Each layout is one the app's CSV reader auto-detects. Fee rules follow what that kind of bank
// actually does in 2026: big banks still charge overdraft fees (with a small cushion), most
// online banks and neobanks don't and instead decline or float you a little.
const BANKS = {
  chase: { name: 'Meridian National Bank', odFee: 3400, odCushion: 5000, maxFeesPerDay: 3, order: 'desc', dates: 'posted' },
  bofa: { name: 'Republic Shield Bank', odFee: 1000, odCushion: 100, maxFeesPerDay: 2, order: 'asc', dates: 'posted' },
  cu: { name: 'Hometown Federal Credit Union', odFee: 3000, odCushion: 0, maxFeesPerDay: 2, order: 'desc', dates: 'posted' },
  online: { name: 'Clearwater Direct Bank', odFee: 0, float: 10000, order: 'desc', dates: 'transaction' },
  neobank: { name: 'Sprout Money (Bancorp partner)', odFee: 0, float: 20000, order: 'desc', dates: 'transaction', earlyPay: true },
};

// ─── Generating one household ──────────────────────────────────────────────────────────────────
function build(spec, adj = { flex: 1, sweep: 0, save: 1 }) {
  const r = rngFor(`synthetic-statements/v2/${spec.id}`);
  const area = AREAS.get(spec.zip);
  if (!area) throw new Error(`${spec.id}: ZIP ${spec.zip} is not in areas.json`);
  const metroName = metroKey(area.metro);
  if (!METROS[metroName]) throw new Error(`${spec.id}: no merchant table for metro ${area.metro}`);
  const metro = { ...METROS[metroName], ...(UTIL_BY_ZIP[spec.zip] ?? {}) };
  const hh = { ...spec, adults: spec.ages.length, state: area.state, area, metro, bank: BANKS[spec.layout] };
  const city = CITY_BY_ZIP[spec.zip] ?? metro.city;
  hh.city = city;
  const st = area.state;
  // Single parents' file names say mom or dad, so the holder's first name has to agree.
  const holderPool = /mom/.test(spec.slug) ? FIRST_F : /dad/.test(spec.slug) ? FIRST_M : FIRST;
  hh.holder = { first: r.pick(holderPool), last: r.pick(LAST) };
  hh.partner = hh.adults === 2 ? { first: r.pick(FIRST), last: r.chance(0.6) ? hh.holder.last : r.pick(LAST) } : null;

  // History: most people download "last 3 months" plus whatever this month has so far; some
  // grab a longer range. The export happens some day in early-to-mid November.
  const start = r.chance(0.3) ? ed(2026, 7, 1) : ed(2026, 8, 1);
  const end = ed(2026, 11, r.int(3, 13));
  hh.start = start;
  hh.end = end;
  const months = [];
  for (let [y, m] = [2026, ymd(start)[1] - 1]; ed(y, m, 1) <= end; m === 12 ? ((y += 1), (m = 1)) : (m += 1)) months.push([y, m]);

  const events = [];
  const stores = new Map();
  const storeNo = (key, digits) => {
    if (!stores.has(key)) stores.set(key, digits ? r.digits(digits).replace(/^0/, String(r.int(1, 9))) : '');
    return stores.get(key);
  };
  const abbr = city.split(' ').map((w) => w.slice(0, 3)).join('').slice(0, 3);
  const descOf = (key, extra = {}) => {
    const m = M[key];
    if (!m) throw new Error(`unknown merchant ${key}`);
    return m.d
      .replace('{n}', storeNo(key, m.nd))
      .replace('{city}', extra.city ?? m.cityBy?.[metroName] ?? (BIG_BOX.has(key) ? metro.shopCity : undefined) ?? city)
      .replace('{st}', extra.st ?? st)
      .replace('{abbr}', abbr.toUpperCase())
      .replace('{code}', r.alnum(6))
      .replace('{shop}', extra.shop ?? 'HANDMADEGOODS')
      .replace('{city2}', extra.city2 ?? city)
      .replace('{st2}', extra.st2 ?? st)
      .replace('{dayname}', extra.dayname ?? 'SAT')
      .replace('{hour}', extra.hour ?? '7')
      .replace('{cause}', extra.cause ?? 'HELP-THE-RIVERAS')
      .replace(/ +/g, ' ');
  };

  // Every row starts life as one of these. `date` is when the person did it, `post` is when the
  // bank booked it. Card purchases usually post the next business day; ACH posts on its
  // settlement day; nothing posts on a weekend or Fed holiday.
  const add = (ev) => {
    events.push({ oneOff: false, kind: 'spend', declinable: false, ...ev });
  };
  const card = (day, key, amount, o = {}) => {
    if (M[key]?.sun === false && dow(day) === 0) day += 1; // Chick-fil-A is closed on Sundays
    add({ date: day, post: nextBiz(day + (r.chance(0.75) ? 1 : 0)), amt: -amount, src: { ch: 'card', m: o.desc ?? descOf(key, o), brand: o.brand ?? M[key]?.brand },
      cat: o.cat ?? M[key].cat, declinable: true, onCard: o.onCard ?? false, ...o.ev });
  };
  const ach = (day, co, entry, amount, o = {}) => {
    const post = o.exact ? day : nextBiz(day);
    add({ date: post, post, amt: amount, src: { ch: 'ach', co, entry, id: o.id ?? achId(co), sec: o.sec ?? (amount > 0 ? 'PPD' : 'WEB'), brand: o.brand }, cat: o.cat, kind: o.kind ?? (amount > 0 ? 'income' : 'spend'), oneOff: o.oneOff ?? false });
  };
  const achIds = new Map();
  const achId = (co) => {
    if (!achIds.has(co)) achIds.set(co, String(r.int(1, 9)) + r.digits(9));
    return achIds.get(co);
  };
  const p2p = (day, svc, dir, name, amount, o = {}) => {
    add({ date: day, post: nextBiz(day), amt: dir === 'out' ? -amount : amount,
      src: { ch: 'p2p', svc, dir, name, memo: o.memo, code: r.alnum(10) }, cat: o.cat ?? (dir === 'out' ? 'other' : undefined), kind: o.kind ?? (dir === 'out' ? 'spend' : 'reimbursement'),
      declinable: dir === 'out' && !o.essential });
  };
  const personName = () => `${r.pick(FIRST)} ${r.pick(LAST)}`;
  const monthDays = (y, m) => Array.from({ length: daysIn(y, m) }, (_, i) => ed(y, m, i + 1));
  // Card spending isn't spread evenly across the week; restaurants and big shops lean to Fri–Sun.
  const dayIn = (y, m, weekendBias = 1) =>
    r.weighted(monthDays(y, m).map((d) => [d, dow(d) === 0 || dow(d) === 6 ? weekendBias : dow(d) === 5 ? (1 + weekendBias) / 2 : 1]));

  // ── Income ───────────────────────────────────────────────────────────────────────────────────
  const nets = payroll(hh);
  let monthlyIn = 0;
  for (const e of hh.earners) {
    const isGig = e.type === 'gig' || e.type === 'freelance';
    const perYear = isGig ? e.gross : nets.get(e);
    // Tipped workers see only part of their net as a paycheck; the rest is cash they deposit.
    monthlyIn += e.type === 'tipped' ? (perYear * 0.55) / 12 + 165 * 4.33 * (e.gross / 45000) : perYear / 12;
    if (isGig) continue;
    const perCheck = perYear / PERIODS[e.freq];
    const co = e.employer;
    // Payroll processors word deposits differently; pick one per employer and stick with it.
    const entry = r.pick(['PAYROLL', 'DIRECT DEP', 'DIR DEP', 'PAYROLL']);
    const anchor = r.chance(0.5) ? ed(2026, 7, 3) : ed(2026, 7, 10); // a Friday; biweekly runs off it
    const weeklyDow = r.pick([4, 5, 5, 5]);
    const paydays = [];
    for (const [y, m] of months) {
      const last = daysIn(y, m);
      if (e.freq === 'semimonthly') paydays.push(prevBiz(ed(y, m, 15)), prevBiz(ed(y, m, last)));
      else if (e.freq === 'military') paydays.push(prevBiz(ed(y, m, 1)), prevBiz(ed(y, m, 15)));
      else if (e.freq === 'monthly') paydays.push(prevBiz(ed(y, m, last)));
    }
    if (e.freq === 'biweekly') for (let d = anchor; d <= end + 14; d += 14) paydays.push(prevBiz(d));
    if (e.freq === 'weekly') for (let d = ed(2026, 6, 1) + ((weeklyDow - dow(ed(2026, 6, 1)) + 7) % 7); d <= end + 7; d += 7) paydays.push(prevBiz(d));
    for (const pay of [...new Set(paydays)].sort((a, b) => a - b)) {
      let amount = perCheck;
      if (e.type === 'hourly') amount *= Math.min(1.2, Math.max(0.78, r.normal(1, 0.07)));
      if (e.overtime && r.chance(0.35)) amount *= r.uni(1.12, 1.35);
      if (e.type === 'tipped') amount *= 0.55 * Math.min(1.25, Math.max(0.7, r.normal(1, 0.12))); // card tips run through payroll; the rest is cash
      if (e.commission && ymd(pay)[2] > 20) amount += r.chance(0.6) ? r.uni(300, 1400) * 0.7 : 0;
      // Neobanks release direct deposits up to two days early.
      const post = hh.bank.earlyPay ? prevBiz(prevBiz(pay - 1) - 1) : pay;
      const desc = e.type === 'military' ? ['DFAS-CLEVELAND', 'MIL PAY'] : [co, entry];
      const who = hh.earners.indexOf(e) === 1 && hh.partner ? hh.partner : hh.holder;
      add({ date: post, post, amt: Math.round(amount * 100), src: { ch: 'ach', co: desc[0], entry: desc[1], id: achId(co), sec: 'PPD', indn: `${who.last}, ${who.first}`.toUpperCase() }, kind: 'income' });
    }
    if (e.type === 'tipped' || hh.cash) {
      // Cash tips go into the account at an ATM or a retailer once or twice a week.
      if (e.type === 'tipped') {
        for (let d = start; d <= end; d += 7) {
          const day = d + r.int(0, 6);
          add({ date: day, post: nextBiz(day), amt: cents(r.uni(90, 240) * (e.gross / 45000)), src: { ch: 'cashdep' }, kind: 'income' });
        }
      }
    }
  }
  for (const e of hh.earners.filter((x) => x.type === 'gig')) {
    // Platforms settle the previous week on a fixed weekday; drivers also cash out instantly
    // to their debit card mid-week when money is short (that costs a fee, netted out here).
    const perWeek = e.gross / 52;
    for (const [i, plat] of e.platforms.entries()) {
      const share = e.platforms.length === 1 ? 1 : i === 0 ? 0.65 : 0.35;
      const payDow = { UBER: 2, LYFT: 2, DOORDASH: 3, INSTACART: 3 }[plat];
      for (let d = ed(2026, 6, 1) + ((payDow - dow(ed(2026, 6, 1)) + 7) % 7); d <= end; d += 7) {
        const [, m] = ymd(d);
        const season = m === 10 ? 1.08 : m === 7 ? 0.92 : 1;
        let amount = perWeek * share * season * Math.min(1.45, Math.max(0.55, r.normal(1, 0.2)));
        if (r.chance(0.25)) {
          const instant = amount * r.uni(0.3, 0.6);
          amount -= instant;
          const iday = d - r.int(2, 4);
          add({ date: iday, post: iday, amt: cents(instant - 0.85), src: { ch: 'visadirect', co: plat }, kind: 'income' });
        }
        const pay = nextBiz(d);
        const co = { UBER: 'UBER USA 6787', LYFT: 'LYFT INC', DOORDASH: 'DOORDASH, INC.', INSTACART: 'MAPLEBEAR INC' }[plat];
        const entry = { UBER: 'EDI PYMNTS', LYFT: 'PAYMENTS', DOORDASH: 'DIRECT DEP', INSTACART: 'INSTACART' }[plat];
        add({ date: pay, post: pay, amt: cents(amount), src: { ch: 'ach', co, entry, id: achId(co), sec: 'PPD' }, kind: 'income' });
      }
    }
  }
  for (const e of hh.earners.filter((x) => x.type === 'freelance')) {
    // Clients pay invoices whenever their AP run happens: some by ACH, some through Stripe or
    // PayPal, one small client by Zelle.
    const clients = [
      { co: 'ASTERWOOD BRANDS INC', entry: 'ACH PMT', share: 0.4 },
      { co: 'STRIPE', entry: 'TRANSFER', share: 0.35 },
      { co: 'PAYPAL', entry: 'TRANSFER', share: 0.15 },
      { zelle: personName(), share: 0.1 },
    ];
    for (const [y, m] of months) {
      for (const c of clients) {
        const n = c.share > 0.3 ? r.int(1, 3) : r.int(0, 1);
        for (let k = 0; k < n; k++) {
          const amount = cents(((e.gross / 12) * c.share * r.uni(0.6, 1.4)) / Math.max(1, n));
          const day = nextBiz(ed(y, m, r.int(1, daysIn(y, m))));
          if (c.zelle) p2p(day, 'zelle', 'in', c.zelle, amount, { kind: 'income', memo: 'invoice' });
          else add({ date: day, post: day, amt: amount, src: { ch: 'ach', co: c.co, entry: c.entry, id: achId(c.co), sec: 'CCD' }, kind: 'income' });
        }
      }
    }
  }
  if (hh.childSupport) {
    // State disbursement units forward support a day or two after the other parent's payday.
    const sdu = `${STATE_NAME[st].split(' ').map((w) => w.slice(0, 2)).join('')} SDU`;
    const per = hh.childSupport / 26;
    for (let d = ed(2026, 7, 7); d <= end; d += 14) {
      if (r.chance(0.12)) continue; // missed payment
      const day = nextBiz(d);
      add({ date: day, post: day, amt: cents(per * r.uni(0.95, 1.0)), src: { ch: 'ach', co: `${STATE_NAME[st]} CHILD SUPPORT`, entry: 'SDU PMT', id: achId(sdu), sec: 'PPD' }, kind: 'income' });
    }
    monthlyIn += hh.childSupport / 12;
  }
  hh.monthlyIn = monthlyIn;
  if (hh.layout === 'online') {
    for (const [y, m] of months) add({ date: ed(y, m, daysIn(y, m)), post: ed(y, m, daysIn(y, m)), amt: cents(r.uni(0.2, 3) + 0), src: { ch: 'interest' }, kind: 'income', late: true });
  }

  // ── Households, homes and fixed bills ────────────────────────────────────────────────────────
  const kids = hh.kids.length;
  const people = hh.adults + kids;
  const perHead = monthlyIn / (hh.adults + 0.5 * kids);
  const budget = { fixed: 0 }; // tallied for the balance check further down
  const monthlyBill = (day, fn) => {
    for (const [y, m] of months) {
      const d = ed(y, m, Math.min(day, daysIn(y, m)));
      fn(d, y, m);
    }
  };

  // Rent: the areas.json figure is gross rent (rent + utilities, HUD style). Contract rent is
  // most of it; the utilities we bill separately make up the rest.
  const gross = area.rentByBedrooms[String(Math.min(hh.beds, 4))].value;
  const rentShare = hh.home === 'share' ? 1 / hh.beds : 1;
  // rentFactor covers rent-stabilized (NYC) and rent-controlled (LA RSO) units, which lag market.
  const contractRent = Math.round((gross * r.uni(0.84, 0.94) * rentShare * (hh.rentFactor ?? 1)) / 5) * 5;
  const prop = `${r.pick(['OAK', 'CEDAR', 'WILLOW', 'RIVER', 'STONE', 'HARBOR', 'SUMMIT', 'MAPLE', 'ASPEN', 'BRIAR', 'ELM', 'HERON'])} ${r.pick(['POINTE', 'CROSSING', 'COMMONS', 'FLATS', 'LOFTS', 'GROVE', 'TERRACE', 'PLACE', 'HEIGHTS', 'LANDING'])}`;
  const landlord = personName();
  if (hh.home === 'own') {
    // PITI on a home bought a few years back; servicer names are the big real ones.
    const piti = Math.round(area.rentByBedrooms[String(Math.min(hh.beds, 4))].value * r.uni(0.9, 1.2) * (hh.hoa ? 0.85 : 1));
    const servicer = r.pick([['ROCKET MORTGAGE', 'MTG PYMT'], ['MR. COOPER', 'MTG PYMT'], ['NEWREZ-SHELLPOIN', 'ACH PMT'], ['PENNYMAC', 'MTG PMT'], ['US BANK HOME MTG', 'MTG PAYMT'], ['FREEDOM MORTGAGE', 'MTG PMT']]);
    const day = r.int(1, 5);
    monthlyBill(day, (d) => ach(d, servicer[0], servicer[1], -piti * 100, { cat: 'debtPayments' }));
    budget.fixed += piti;
    if (hh.hoa) {
      monthlyBill(1, (d) => ach(d, `${prop} CONDO ASSN`, 'HOA DUES', -hh.hoa, { cat: 'rentUtilities' }));
      budget.fixed += hh.hoa / 100;
    }
  } else {
    // How rent gets paid depends on who the landlord is: big complexes use a portal, small
    // landlords take a check or Zelle, roommates Venmo/Zelle the leaseholder.
    const how = hh.home === 'share' ? r.pick(['zelle', 'venmo', 'portal']) : r.weighted([['portal', 6], ['check', hh.layout === 'neobank' ? 0 : 1.2], ['zelle', 1.5]]);
    const portal = r.pick([['RENTCAFE.COM', 'RENT'], ['APPFOLIO', 'WEB PMTS'], ['YARDI-RENT', 'RENT PMT'], ['BILT RENT', 'RENT'], ['ZILLOW RENT', 'RENT PMT']]);
    const day = r.chance(0.2) ? r.int(25, 27) : r.int(1, 3);
    let checkNo = r.int(1010, 1180);
    monthlyBill(day, (d) => {
      if (how === 'portal') ach(d, `${portal[0]} ${prop}`, portal[1], -contractRent * 100, { cat: 'rentUtilities' });
      else if (how === 'check') {
        const post = nextBiz(d + r.int(1, 3)); // the landlord deposits it whenever they get to it
        add({ date: post, post, amt: -contractRent * 100, src: { ch: 'check', num: checkNo++ }, cat: 'rentUtilities' });
      } else if (how === 'venmo') add({ date: d, post: nextBiz(d), amt: -contractRent * 100, src: { ch: 'venmo', dir: 'out', name: landlord }, cat: 'rentUtilities' });
      else p2p(d, 'zelle', 'out', landlord, contractRent * 100, { cat: 'rentUtilities', memo: 'rent', essential: true });
    });
    budget.fixed += contractRent;
    hh.rentHow = how;
  }
  hh.contractRent = contractRent;

  // Utilities. Bills arrive monthly for last month's usage, so August's bill carries July's heat.
  const heat = metro.heat;
  const big = hh.home === 'own' ? 1.6 : hh.beds >= 2 ? 1.15 : 0.85;
  const share = hh.home === 'share' ? 1 / hh.beds : 1;
  const seasonElec = { 6: 0.85, 7: 1.0, 8: 1.12, 9: 1.08, 10: 0.82, 11: 0.66 };
  const seasonGas = { 6: 0.65, 7: 0.55, 8: 0.5, 9: 0.5, 10: 0.7, 11: 1.15 };
  const utilBill = (code, day, fn, cat = 'rentUtilities') => {
    const u = UTIL[code];
    if (!u) return;
    const viaBillPay = hh.layout === 'chase' && r.chance(0.25);
    const viaCard = !viaBillPay && r.chance(0.2);
    let avg = 0;
    monthlyBill(day, (d, y, m) => {
      const amt = Math.round(fn(m) * 100);
      avg += amt / months.length / 100;
      if (hh.home === 'share' && hh.rentHow !== 'portal') return; // roommates pay utilities to the leaseholder, below
      if (viaBillPay) add({ date: nextBiz(d), post: nextBiz(d), amt: -amt, src: { ch: 'billpay', payee: u.d.split(' ').slice(0, 3).join(' ') }, cat });
      else if (viaCard) card(d, null, amt, { desc: u.d, brand: titleCase(u.d.split(' ').slice(0, 2).join(' ')), cat, ev: { declinable: false } });
      else ach(d, u.d, /PAY|PMT|BILL/.test(u.d) ? '' : 'BILL PAY', -amt, { cat });
    });
    if (!(hh.home === 'share' && hh.rentHow !== 'portal')) budget.fixed += avg;
    return avg;
  };
  const elecPeak = r.uni(105, 150) * heat * big * share;
  if (metro.elec) {
    const u = UTIL[metro.elec];
    const gasToo = u.kind === 'elecGas';
    utilBill(metro.elec, r.int(5, 22), (m) => elecPeak * seasonElec[m] * r.uni(0.92, 1.08) + (gasToo && metro.gasHeat ? 28 * big * share * seasonGas[m] * r.uni(0.9, 1.1) : 0) + (u.kind === 'elecWater' ? 62 * share * r.uni(0.9, 1.1) : 0));
  }
  if (metro.gasUtil && UTIL[metro.gasUtil].kind !== 'gasInElec' && (hh.home === 'own' || r.chance(0.5))) {
    const base = (metro.gasHeat ? 42 : 30) * big * share;
    utilBill(metro.gasUtil, r.int(5, 22), (m) => Math.max(18, base * (metro.gasHeat ? seasonGas[m] : 0.9) * r.uni(0.9, 1.12)));
  }
  if (hh.home === 'own' && metro.water) utilBill(metro.water, r.int(8, 24), () => r.uni(58, 96) * (people > 3 ? 1.3 : 1));
  else if (hh.home !== 'own' && r.chance(0.4)) utilBill('CONSERVICE', r.int(5, 15), () => r.uni(38, 72) * share);
  const netCode = r.pick(metro.net);
  const netPrice = r.pick([55, 65, 70, 80, 90]) * (hh.home === 'share' ? share : 1);
  utilBill(netCode, r.int(6, 26), () => netPrice);
  if (hh.home === 'share' && hh.rentHow !== 'portal') {
    // Leaseholder fronts the utilities and everyone Venmos/Zelles their share.
    const utilShare = Math.round((elecPeak * 0.95 + netPrice + 20) * r.uni(0.9, 1.1) * 100) / 100;
    monthlyBill(r.int(10, 18), (d) => p2p(d, hh.rentHow === 'venmo' ? 'venmo' : 'zelle', 'out', landlord, cents(utilShare * r.uni(0.85, 1.15)), { cat: 'rentUtilities', memo: 'utilities', essential: true }));
    budget.fixed += utilShare;
  }
  // Phones: lines = adults plus teenagers; budget brands for tight budgets.
  const carrier = hh.tight ? r.pick(['mint', 'cricket', 'metro', 'visible']) : r.weighted([['verizon', 3], ['att', 3], ['tmobile', 3], ['mint', 1], ['visible', 1]]);
  const lines = hh.adults + (hh.kids.filter((k) => k === 'schoolAge').length > 1 ? 1 : 0);
  const mob = MOBILE[carrier];
  const phone = (r.uni(...mob.perLine) / 100) * lines * (lines > 1 ? 0.8 : 1);
  if (carrier === 'mint') {
    // Mint sells service in 3-month blocks, so it shows up as one bigger charge every quarter.
    const firstDay = start + r.int(3, 40);
    for (let d = firstDay; d <= end; d += 91) card(d, null, Math.round(phone * 3 * 100), { desc: mob.d, brand: 'Mint Mobile', cat: 'rentUtilities', ev: { declinable: false } });
  } else {
    const day = r.int(3, 25);
    const p = Math.round(phone * 100);
    monthlyBill(day, (d) => (mob.ach ? ach(d, mob.d, /PAY/.test(mob.d) ? '' : 'AUTOPAY', -p, { cat: 'rentUtilities' }) : card(d, null, p, { desc: mob.d, brand: titleCase(carrier), cat: 'rentUtilities', ev: { declinable: false } })));
  }
  budget.fixed += phone;

  // Insurance. Renters and life insurance are `other`; car insurance is a running cost of the car.
  if (hh.cars) {
    const factor = (hh.cars > 1 ? 1.75 : 1) * (Math.min(...hh.ages) < 27 ? 1.2 : 1) * r.uni(0.85, 1.15);
    const premium = Math.round(area.carInsuranceMonthly.value * factor * 100);
    const insurer = hh.usaa
      ? ['USAA P&C', 'AUTOPAY']
      : r.pick([['GEICO', 'AUTOPAY'], ['PROGRESSIVE', 'INS PREM'], ['STATE FARM RO 27', 'SFPP'], ['ALLSTATE INS CO', 'INS PREM'], ['LIBERTY MUTUAL', 'PAYMENT']]);
    monthlyBill(r.int(4, 24), (d) => ach(d, insurer[0], insurer[1], -premium, { cat: 'car' }));
    budget.fixed += premium / 100;
  }
  if (hh.home !== 'own' && !hh.tight && r.chance(0.6)) {
    const p = r.int(1000, 2400);
    monthlyBill(r.int(2, 25), (d) => card(d, null, p, { desc: 'LEMONADE INSURANCE 844-733-8666 NY', brand: 'Lemonade', cat: 'other', ev: { declinable: false } }));
    budget.fixed += p / 100;
  }
  if (kids && !hh.tight && r.chance(0.6)) {
    const p = r.int(2800, 6500);
    const lifeCo = r.pick(['BANNER LIFE INS', 'PROTECTIVE LIFE', 'NORTHWESTERN MU']);
    monthlyBill(r.int(5, 25), (d) => ach(d, lifeCo, 'PREMIUM', -p, { cat: 'other' }));
    budget.fixed += p / 100;
  }
  if (hh.marketplaceHealth) {
    const p = cents(hh.marketplaceHealth);
    const plan = r.pick(['AMBETTER HEALTH', 'BLUE CROSS BLUE SH', 'OSCAR HEALTH INS']);
    monthlyBill(1, (d) => ach(d, plan, 'PREMIUM', -p, { cat: 'other' }));
    budget.fixed += p / 100;
  }

  // Debts. Car loans, mortgages, student loans, BNPL and card payments are all `debtPayments`.
  for (const [i, pay] of (hh.auto ?? []).entries()) {
    const lender = r.pick([['TOYOTA MOTOR CREDIT', 'TMCC PYMT'], ['HONDA PMT', 'AUTOPAY'], ['CAPITAL ONE AUTO', 'CARPAY'], ['ALLY ALLY PAYMT', 'AUTO'], ['FORD CREDIT', 'AUTOPAY'], ['GM FINANCIAL', 'AUTOPAY'], ['HYUNDAI CAPITAL', 'AUTO PMT']]);
    monthlyBill(r.int(3, 26), (d) => ach(d, lender[0], lender[1], -pay, { cat: 'debtPayments' }));
    budget.fixed += pay / 100;
    void i;
  }
  if (hh.subprimeAuto) {
    const lender = r.pick(['CREDIT ACCEPTANCE', 'WESTLAKE FINANCIAL', 'EXETER FINANCE']);
    monthlyBill(r.int(5, 20), (d) => ach(d, lender, 'AUTO PMT', -hh.subprimeAuto, { cat: 'debtPayments' }));
    budget.fixed += hh.subprimeAuto / 100;
  }
  if (hh.lease) {
    const lessor = r.pick(['BMW FINANCIAL SVCS', 'MERCEDES-BENZ FIN', 'LEXUS FINANCIAL']);
    monthlyBill(r.int(5, 20), (d) => ach(d, lessor, 'LEASE PMT', -hh.lease, { cat: 'debtPayments' }));
    budget.fixed += hh.lease / 100;
  }
  if (hh.student) {
    const servicer = r.pick([['DEPT EDUCATION', 'STUDENT LN'], ['MOHELA', 'DEPT OF ED'], ['NELNET LNS', 'NELNET LNS'], ['AIDVANTAGE', 'DEPT ED PMT'], ['SALLIE MAE BANK', 'PAYMENT']]);
    monthlyBill(r.int(5, 25), (d) => ach(d, servicer[0], servicer[1], -hh.student, { cat: 'debtPayments' }));
    budget.fixed += hh.student / 100;
  }
  if (hh.personalLoan) {
    monthlyBill(r.int(5, 25), (d) => ach(d, 'UPSTART NETWORK', 'LOAN PMT', -hh.personalLoan, { cat: 'debtPayments' }));
    budget.fixed += hh.personalLoan / 100;
  }
  const issuer = r.pick([['CHASE CREDIT CRD', 'AUTOPAY'], ['CAPITAL ONE', 'MOBILE PMT'], ['DISCOVER', 'E-PAYMENT'], ['CITI AUTOPAY', 'PAYMENT'], ['AMEX EPAYMENT', 'ACH PMT'], ['APPLECARD GSBANK', 'PAYMENT'], ['WF CREDIT CARD', 'AUTO PAY']]);
  const cardDay = r.int(5, 24);
  if (hh.card === 'revolver') {
    // Carries a balance and pays a fixed chunk each month, a bit more when there's slack.
    monthlyBill(cardDay, (d) => ach(d, issuer[0], issuer[1], -Math.round(hh.cardPay * r.weighted([[1, 6], [1.5, 1], [0.6, 1]])), { cat: 'debtPayments' }));
    budget.fixed += hh.cardPay / 100;
    if (r.chance(0.6)) {
      // ...and a store card on top.
      const store = r.pick(['SYNCHRONY BANK', 'COMENITY PAY', 'TD BANK TARGET']);
      const p = r.int(4000, 9000);
      monthlyBill(r.int(5, 25), (d) => ach(d, store, 'PAYMENT', -p, { cat: 'debtPayments' }));
      budget.fixed += p / 100;
    }
  }

  // Childcare from the DOL county medians in areas.json. Under-5s go to a center; school-age
  // kids get after-school care in term time and day camp in July and August. Kids at home with
  // a stay-at-home parent need none.
  const stayHome = hh.adults === 2 && hh.earners.length === 1;
  const cc = area.childcareMonthly ?? {};
  if (!stayHome && kids && hh.informalCare) {
    // Grandma watches the kids; the family pays her what they can, by Zelle, on the 1st.
    const grandma = `${r.pick(FIRST_F)} ${hh.holder.last}`;
    monthlyBill(1, (d) => p2p(d, hh.layout === 'neobank' ? 'payfriends' : 'zelle', 'out', grandma, cents(hh.informalCare), { cat: 'childcare', memo: 'kids', essential: true }));
    budget.fixed += hh.informalCare;
  } else if (!stayHome && kids) {
    const center = r.pick(['BRIGHT HORIZONS', 'KINDERCARE', 'GODDARD SCHOOL', 'LA PETITE ACADEMY', `${r.pick(['LITTLE SPROUTS', 'SUNSHINE', 'TINY STEPS', 'ACORN'])} EARLY LEARNING`]);
    // National chains bill tuition by ACH; small local centers use a payments app.
    const via = center.includes('EARLY LEARNING') ? r.pick(['ach', 'brightwheel', 'tuitionexpress']) : 'ach';
    // NYC's 3-K and Pre-K for All are free, so a preschooler there costs nothing in care.
    const young = hh.kids.filter((k) => k !== 'schoolAge' && !(hh.freePreK && k === 'preschool'));
    if (young.length) {
      // With a state subsidy (CCAP/CAPS) or free public pre-K the family pays only a copay.
      const monthlyCost = hh.ccSubsidy ? hh.ccSubsidy * r.uni(0.95, 1.05) : sum(young.map((k) => cc[k] ?? 1200)) * (young.length > 1 ? 0.92 : 1) * r.uni(0.9, 1.1);
      monthlyBill(1, (d) => {
        const amt = cents(monthlyCost);
        if (via === 'brightwheel') card(d, null, amt, { desc: `BRIGHTWHEEL* ${center} SAN FRANCISCO CA`, brand: `Brightwheel ${titleCase(center)}`, cat: 'childcare', ev: { declinable: false } });
        else if (via === 'tuitionexpress') ach(d, 'TUITION EXPRESS', center, -amt, { cat: 'childcare' });
        else ach(d, center, 'TUITION', -amt, { cat: 'childcare' });
      });
      budget.fixed += monthlyCost;
    }
    const school = hh.kids.filter((k) => k === 'schoolAge').length;
    // A teacher's day matches the school day, so no after-school program is needed.
    if (school && !hh.privateSchool && !hh.ccSubsidy && !hh.noAfterSchool) {
      const ymcaName = `YMCA OF ${(metro.city === 'NEW YORK' ? 'GREATER NEW YORK' : metro.city)}`;
      for (const [y, m] of months) {
        if (m === 7 || (m === 8 && r.chance(0.5))) {
          // Summer day camp, paid weekly. Families on a tight budget lean on relatives and free
          // city rec programs instead, so nothing shows up for them.
          if (hh.tight) continue;
          for (let w = 0; w < (m === 7 ? 4 : 2); w++) card(ed(y, m, 1 + w * 7), null, cents(r.uni(210, 330) * school), { desc: `${ymcaName} DAY CAMP ${st}`, brand: 'YMCA Day Camp', cat: 'childcare', ev: { declinable: false } });
        } else if (m >= 9 || (m === 8 && hh.state !== 'NY' && hh.state !== 'MA' && hh.state !== 'PA')) {
          const amt = cents((cc.schoolAge ?? 900) * 0.35 * school * r.uni(0.9, 1.05));
          ach(ed(y, m, 1), ymcaName, 'AFTERSCHOOL', -amt, { cat: 'childcare' });
        }
      }
      budget.fixed += (cc.schoolAge ?? 900) * 0.35 * school;
    }
  }
  if (hh.privateSchool) {
    // Ten monthly installments starting in August.
    monthlyBill(10, (d, y, m) => m >= 8 && ach(d, 'FACTS TUITION MGMT', 'TUITION', -cents(hh.privateSchool / 10 / 1), { cat: 'other' }));
    budget.fixed += hh.privateSchool / 12;
  }

  // Subscriptions, priced with whatever digital sales tax the household's city charges.
  const digitalTax = 1 + (DIGITAL_TAX[st] ?? 0) + (CHICAGO_AMUSEMENT_TAX.has(spec.zip) ? 0.09 : 0);
  for (const key of hh.subs ?? []) {
    const s = SUBS[key];
    if (!s) throw new Error(`${spec.id}: unknown subscription ${key}`);
    const day = r.int(1, 28);
    if (s.d === 'VENMO_SHARE') {
      const friend = personName();
      monthlyBill(day, (d) => add({ date: d, post: nextBiz(d), amt: -400, src: { ch: 'venmo', dir: 'out', name: friend }, cat: 'subscriptions', declinable: true }));
      budget.fixed += 4;
      continue;
    }
    const isGym = /FITNESS|EQUINOX|YMCA|ORANGETHEORY/.test(s.d);
    const price = Math.round(s.p * (isGym ? 1 : digitalTax));
    const onCard = hh.card === 'payer' && r.chance(hh.cardShare);
    const desc = s.d.replace('{city}', city).replace('{st}', st).replace('{metroU}', metro.city);
    monthlyBill(day, (d) => {
      const realDesc = desc.replace('{code}', r.alnum(6));
      card(d, null, price, { desc: realDesc, brand: s.brand, cat: 'subscriptions', onCard, ev: { declinable: false } });
    });
    if (!onCard) budget.fixed += price / 100;
    if (key.startsWith('pf') && months.some(([, m]) => m === 10)) {
      // Planet Fitness bills its annual fee once a year; for these members it lands in October.
      card(ed(2026, 10, day), null, 4900, { desc: s.d, brand: s.brand, cat: 'subscriptions', onCard, ev: { declinable: false, oneOff: true } });
    }
  }
  if (hh.cars && !hh.tight && r.chance(0.18)) {
    const p = r.pick([2999, 3499, 3999]);
    monthlyBill(r.int(1, 28), (d) => card(d, 'CARWASH', p, { ev: { declinable: false } }));
    budget.fixed += p / 100;
  }
  if (hh.pets) {
    const p = hh.pets === 'dog' ? r.int(4500, 8500) : r.int(2800, 5200);
    monthlyBill(r.int(1, 28), (d) => card(d, 'CHEWY', Math.round(p * r.uni(0.95, 1.05)), { ev: { declinable: false } }));
    budget.fixed += p / 100;
  }

  // Transit for people who don't drive (or don't drive to work).
  const transit = metro.transit && (hh.cars === 0 || r.chance(0.2)) ? TRANSIT[metro.transit] : null;
  if (transit) {
    if (transit.pass) {
      monthlyBill(r.int(1, 3), (d) => card(d, null, transit.pass * Math.max(1, hh.cars === 0 ? hh.adults : 1), { desc: transit.d, cat: 'other', ev: { declinable: false } }));
      budget.fixed += (transit.pass / 100) * (hh.cars === 0 ? hh.adults : 1);
    } else {
      // Pay-per-ride systems settle taps into one charge every few days.
      for (let d = start; d <= end; d += r.int(2, 5)) card(d, null, Math.min(transit.cap, transit.fare * r.int(2, 6)), { desc: transit.d, cat: 'other', ev: { declinable: false } });
      budget.fixed += (transit.fare / 100) * 40 * (hh.cars === 0 ? hh.adults : 0.4);
    }
  }

  // ── Estimated tax for the self-employed ──────────────────────────────────────────────────────
  if (hh.estTax) {
    const selfEmp = sum(hh.earners.filter((e) => e.type === 'gig' || e.type === 'freelance').map((e) => e.gross));
    // Roughly 15.3% SE tax on 92.35% of profit plus income tax, after mileage/expenses.
    const quarterly = Math.round((selfEmp * (hh.earners.some((e) => e.type === 'gig') ? 0.45 : 0.85) * 0.25) / 4 / 10) * 10;
    if (months.some(([, m]) => m === 9)) ach(ed(2026, 9, 15), 'IRS', 'USATAXPYMT', -quarterly * 100, { cat: 'other', id: `27${r.digits(13)}`, oneOff: true });
    if (STATE_TAX[st] && months.some(([, m]) => m === 9)) ach(ed(2026, 9, 15), `${st} DEPT OF REVENUE`, 'EST TAX PMT', -Math.round(quarterly * 0.25) * 100, { cat: 'other', oneOff: true });
    budget.fixed += (quarterly * (STATE_TAX[st] ? 1.25 : 1)) / 3;
  }

  // ── Variable spending ────────────────────────────────────────────────────────────────────────
  const priceFuel = area.gasPerGallon.value;
  const gigMiles = hh.earners.some((e) => e.type === 'gig') ? sum(hh.earners.filter((e) => e.type === 'gig').map((e) => e.gross)) / 52000 : 0;
  const kidFactor = { infant: 0.45, toddler: 0.55, preschool: 0.62, schoolAge: 0.8 };
  const gF = perHead < 1700 ? 0.8 : perHead < 3000 ? 0.92 : perHead < 5000 ? 1.0 : 1.15;
  let groceries = area.groceriesPerAdult.value * (hh.adults + sum(hh.kids.map((k) => kidFactor[k]))) * gF * r.uni(0.9, 1.08);
  let eatingOut = monthlyIn * (perHead < 1700 ? 0.065 : perHead < 3000 ? 0.07 : 0.06) * (kids ? 0.75 : hh.adults === 1 ? 1.2 : 1) * r.uni(0.85, 1.15);
  let fuel = hh.cars ? (hh.cars * r.uni(34, 50) + gigMiles * 95) * priceFuel : 0;
  let other = monthlyIn * (0.06 + 0.012 * kids) * r.uni(0.85, 1.15) + (hh.cars ? 25 : 0);
  if (hh.tight) other *= 0.75;

  // The calibration loop in main() tunes `adj` so the account behaves the way the brief says:
  // `flex` grows or trims eating out and discretionary shopping (groceries only a little, since
  // people cut restaurants long before food), and `sweep` moves a comfortable household's
  // leftover cash to savings at month end instead of letting it pile up in checking.
  eatingOut *= adj.flex;
  other *= adj.flex;
  groceries *= Math.min(1.1, Math.max(0.8, 0.8 + 0.2 * adj.flex));
  const saveAmt = Math.round((monthlyIn * (hh.savings ?? 0) * adj.save) / 25) * 25;
  const investAmt = Math.round((monthlyIn * (hh.invest ?? 0) * adj.save) / 25) * 25;
  const cardShare = hh.card === 'payer' ? hh.cardShare : hh.card === 'revolver' ? 0.12 : 0;
  const sweep = adj.sweep;
  hh.levels = { groceries, eatingOut, fuel, other, saveAmt, investAmt, sweep, monthlyIn, fixed: budget.fixed };

  // Who they shop with. People are creatures of habit: one main grocery store, a fill-in store,
  // a warehouse club if they're a family with a car, two or three favourite places to eat.
  const grocers = metro.grocers.filter((g) => M[g]);
  // Tight budgets shop at the discount and mainstream chains, not Whole Foods or PCC.
  const BUDGET_GROCERS = ['ALDI', 'WALMART', 'FOOD4LESS', 'FIESTA', 'FOODCITY', 'CTOWN', 'KEYFOOD', 'MARKETBASKET', 'WINNDIXIE', 'SEDANOS', 'CUB', 'KROGER', 'HEB', 'FRYS', 'JEWEL', 'SAFEWAY', 'KINGSOOPERS', 'PUBLIX', 'QFC', 'ACME', 'STOPSHOP'];
  const mainGrocer = hh.tight ? r.pick([...grocers.filter((g) => BUDGET_GROCERS.includes(g)), 'WALMART']) : r.pick(grocers);
  const fillGrocer = r.pick([...grocers.filter((g) => g !== mainGrocer), 'WALMART', 'TRADERJOES'].filter((g) => M[g]));
  const club = hh.cars && (kids || hh.adults === 2) && !hh.tight && r.chance(0.6) ? r.pick(['COSTCO', 'SAMS']) : null;
  const stations = hh.cars ? [r.pick(metro.fuel), r.pick(metro.fuel), ...(club === 'COSTCO' ? ['COSTCOGAS'] : [])] : [];
  // Three or four neighbourhood places they keep going back to, priced to the budget.
  const cuisinePool = hh.tight ? CUISINES.filter(([, lo]) => lo < 16) : perHead > 4500 ? CUISINES : CUISINES.filter(([, lo]) => lo < 30);
  const spots = Array.from({ length: r.int(3, 4) }, () => {
    const [cuisine, lo, hi] = r.pick(cuisinePool);
    return { name: `${r.pick(LOCAL_FOOD_A)} ${cuisine}`, lo, hi, pos: r.pick(['TST* ', 'SQ *', 'TST* ']) };
  });
  // Who's at the table: the whole family, the couple, or a single person alone or with a date.
  const table = () => (kids ? Math.min(people, 4) : hh.adults === 2 ? 2 : r.weighted([[1, 5], [2, 3]]));
  const barName = `SQ *${r.pick(LOCAL_FOOD_A)} ${r.pick(LOCAL_BAR_B)} ${city} ${st}`;
  const coffeeKey = r.pick(metro.coffee);
  const regulars = metro.eats.filter((k) => M[k]);
  const fastFood = ['MCD', 'TACOBELL', 'WENDYS', 'BK', 'SUBWAY', 'POPEYES', 'DOMINOS', 'WINGSTOP', 'CHICKFILA', 'CHIPOTLE', 'PANERA'];
  const friends = Array.from({ length: 4 }, personName);
  // One broker and one 529 plan per household, and the 529 is their own state's plan.
  const broker = r.pick([['VANGUARD', 'BUY INVESTMENT'], ['FID BKG SVC LLC', 'MONEYLINE'], ['SCHWAB BROKERAGE', 'MONEYLINK'], ['ROBINHOOD', 'DEBITS'], ['BETTERMENT', 'INVESTMENT'], ['WEALTHFRONT', 'EDI PYMNTS']]);
  const plan529 = { CA: 'SCHOLARSHARE 529', TX: 'TEXAS COLLEGE SAVINGS', GA: 'GA PATH2COLLEGE 529', WA: 'DREAMAHEAD WA 529', MA: 'MEFA U.FUND 529', CO: 'CO COLLEGEINVEST', IL: 'BRIGHT START 529', NY: 'NY 529 DIRECT PLAN', AZ: 'AZ529 FIDELITY', PA: 'PA 529 INVESTMENT', FL: 'FLORIDA 529 SAVINGS', TN: 'TNSTARS 529', MN: 'MN COLLEGE SAVINGS' }[st];
  const cardHit = (p) => cardShare > 0 && r.chance(p);

  for (const [y, m] of months) {
    const season = { 6: 1.0, 7: 1.0, 8: 1.02, 9: 0.97, 10: 1.0, 11: 1.0 }[m];
    // Groceries: a weekly main shop, top-up runs, the odd club trip, sometimes Instacart.
    let g = groceries * season * r.uni(0.92, 1.08);
    const trips = [];
    const mainTrips = r.int(4, 5);
    for (let i = 0; i < mainTrips; i++) trips.push([mainGrocer, (g * (club ? 0.55 : 0.68)) / mainTrips]);
    const fills = r.int(2, people > 2 ? 6 : 4);
    for (let i = 0; i < fills; i++) trips.push([fillGrocer, (g * (club ? 0.2 : 0.32)) / fills]);
    if (club) trips.push([club, g * 0.25]);
    // Most of a SNAP household's groceries go on the EBT card, which never touches checking.
    if (hh.snap) for (const t of trips) t[1] *= 0.4;
    for (const [key, base] of trips) {
      const amount = cents(base * r.uni(0.6, 1.4));
      if (amount < 300) continue;
      card(dayIn(y, m, 1.6), key, amount, { onCard: cardHit(cardShare) });
    }
    if (!hh.tight && r.chance(0.25)) card(dayIn(y, m), 'INSTACART', cents(r.uni(45, 140)), { onCard: cardHit(cardShare) });

    // Eating out.
    let e = eatingOut * r.uni(0.85, 1.15);
    const party = Math.max(1, Math.round(people * 0.85));
    while (e > 5) {
      const type = r.weighted([['coffee', hh.tight ? 2 : 4], ['fast', hh.tight ? 6 : 4], ['regular', 3], ['local', hh.tight ? 0.5 : 2.5], ['delivery', 2], ['bar', kids ? 0.3 : 1.2]]);
      let amount;
      if (type === 'coffee') {
        amount = cents(r.uni(4.25, 9.5));
        card(dayIn(y, m, 0.7), coffeeKey, amount, { onCard: cardHit(cardShare) });
      } else if (type === 'fast') {
        amount = cents(r.uni(8, 15) * Math.min(party, 4) * r.uni(0.8, 1.1));
        card(dayIn(y, m, 1.3), r.pick(fastFood), amount, { onCard: cardHit(cardShare) });
      } else if (type === 'regular') {
        amount = cents(r.uni(11, 19) * Math.min(party, 4));
        card(dayIn(y, m, 1.4), r.pick(regulars), amount, { onCard: cardHit(cardShare) });
      } else if (type === 'local') {
        const spot = r.pick(spots);
        amount = cents(r.uni(spot.lo, spot.hi) * table() * r.uni(1.22, 1.3)); // plus tax and tip
        card(dayIn(y, m, 2), null, amount, { desc: `${spot.pos}${spot.name} ${city} ${st}`, brand: titleCase(spot.name), cat: 'eatingOut', onCard: cardHit(cardShare) });
      } else if (type === 'delivery') {
        const spot = r.pick(spots);
        const eaters = kids ? Math.min(people, 4) : hh.adults;
        amount = cents(r.uni(spot.lo, spot.hi) * eaters * r.uni(1.3, 1.45)); // plus fees and tip
        const via = r.weighted([['dd', 5], ['ue', 3], ['gh', metro.city === 'NEW YORK' || metro.city === 'CHICAGO' ? 2 : 0.3]]);
        if (via === 'ue') card(dayIn(y, m, 1.5), 'UBEREATS', amount, { onCard: cardHit(cardShare) });
        else card(dayIn(y, m, 1.5), null, amount, { desc: via === 'dd' ? `DOORDASH*${spot.name}` : `GRUBHUB*${spot.name.replace(/ /g, '')}`, brand: via === 'dd' ? 'DoorDash' : 'Grubhub', cat: 'eatingOut', onCard: cardHit(cardShare) });
      } else {
        amount = cents(r.uni(22, 85));
        card(dayIn(y, m, 3), null, amount, { desc: barName, cat: 'eatingOut', onCard: cardHit(cardShare) });
      }
      e -= amount / 100;
    }

    // Fuel: fill-ups of 9–16 gallons at the regional price, a gig driver every other day.
    let f = fuel * r.uni(0.9, 1.1);
    while (f > 15) {
      const gallons = r.uni(9, 16);
      const amount = cents(gallons * priceFuel * r.uni(0.97, 1.03));
      card(dayIn(y, m, 1.2), r.pick(stations), amount, { onCard: cardHit(cardShare * 0.8) });
      f -= amount / 100;
    }
    if (hh.cars && hh.metro.toll && r.chance(0.35)) card(ed(y, m, r.int(1, 28)), null, r.pick([2500, 3500, 4000, 5000]), { desc: hh.metro.toll, cat: 'car', ev: { declinable: false } });
    if (hh.cars && ['NEW YORK', 'CHICAGO', 'BOSTON', 'PHILADELPHIA', 'SEATTLE', 'MIAMI', 'ATLANTA', 'DENVER'].includes(metro.city) && r.chance(0.6)) {
      for (let i = r.int(1, 3); i > 0; i--) card(dayIn(y, m, 1.5), r.pick(['PARKING', 'PARKMOBILE']), cents(r.uni(4, 28)), {});
    }

    // Everything else: shopping, pharmacy, haircuts, kids' stuff, fun.
    let o = other * r.uni(0.85, 1.15);
    const otherPool = [
      ['AMAZON', 6, 9, 85], ['AMAZONCOM', 2, 12, 120], ['TARGET', 4, 14, 110], ['CVS', 2, 6, 45], ['WALGREENS', 1.5, 6, 45],
      ['HOMEDEPOT', hh.home === 'own' ? 3 : 0.5, 12, 160], ['LOWES', hh.home === 'own' ? 1.5 : 0.2, 15, 140], ['TJMAXX', 1.5, 15, 90],
      ['ROSS', hh.tight ? 2 : 0.6, 12, 70], ['OLDNAVY', kids ? 2 : 0.8, 18, 95], ['DOLLARTREE', hh.tight ? 2.5 : 0.4, 5, 30],
      ['DOLLARGENERAL', hh.tight ? 1.5 : 0.2, 6, 35], ['ULTA', 0.8, 15, 75], ['TEMU', hh.tight ? 1.5 : 0.5, 12, 60], ['ETSY', 0.5, 15, 70],
      ['GREATCLIPS', 0.8, 20, 32], ['BARBER', 0.6, 30, 55], ['AMC', kids ? 0.5 : 0.8, 14, 60], ['TICKETMASTER', hh.tight ? 0.1 : 0.4, 45, 180],
      ['STEAM', 0.5, 5, 60], ['FIVEBELOW', kids ? 1 : 0.2, 6, 40], ['CARTERS', hh.kids.some((k) => k !== 'schoolAge') ? 1.2 : 0, 20, 85],
      ['SCHOOLLUNCH', hh.kids.includes('schoolAge') && m >= 9 ? 2 : 0, 20, 50], ['UBERTRIP', hh.cars ? 0.6 : 2.5, 9, 38],
      ['LYFT', hh.cars ? 0.3 : 1.2, 9, 34], ['LAUNDRY', hh.home !== 'own' && hh.tight ? 2 : 0, 10, 30], ['PETSMART', hh.pets ? 1 : 0, 12, 60],
      ['BESTBUY', 0.3, 25, 160], ['DENTAL', 0.25, 40, 160], ['LABCORP', 0.15, 25, 120],
    ].filter(([, w]) => w > 0);
    let guard = 0;
    while (o > 8 && guard++ < 200) {
      const [key, , lo, hi] = r.weighted(otherPool.map((x) => [x, x[1]]));
      const amount = r.amt(lo, hi);
      const extra = key === 'LYFT' ? (() => { const d = dayIn(y, m, 2); return { day: d, dayname: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dow(d)], hour: String(r.int(5, 11)) }; })() : { day: dayIn(y, m, 1.4) };
      card(extra.day, key, amount, { ...extra, onCard: cardHit(cardShare) });
      o -= amount / 100;
    }
    // Money between people: splitting dinner, birthday gifts, the babysitter. Friends send money
    // back too, which is not income.
    if (!hh.tight || r.chance(0.6)) {
      for (let i = r.int(0, hh.tight ? 2 : 3); i > 0; i--) {
        const svc = hh.layout === 'neobank' ? r.pick(['cashapp', 'venmo', 'payfriends']) : r.pick(['zelle', 'venmo', 'zelle']);
        const amount = cents(r.uni(15, 90));
        const friend = r.pick(friends);
        if (svc === 'zelle' || svc === 'payfriends') p2p(dayIn(y, m), svc, 'out', friend, amount, { memo: r.pick(['dinner', 'tickets', 'gift', 'bday', 'trip']) });
        else add({ date: dayIn(y, m), post: 0, amt: -amount, src: { ch: svc, dir: 'out', name: friend }, cat: 'other', declinable: true });
      }
      for (let i = r.int(0, 2); i > 0; i--) {
        const svc = hh.layout === 'neobank' ? r.pick(['venmo', 'payfriends']) : r.pick(['zelle', 'venmo']);
        const amount = cents(r.uni(12, 75));
        const friend = r.pick(friends);
        if (svc === 'zelle' || svc === 'payfriends') p2p(dayIn(y, m), svc, 'in', friend, amount, { memo: r.pick(['dinner', 'uber', 'groceries', 'tix']) });
        else add({ date: dayIn(y, m), post: 0, amt: amount, src: { ch: 'venmo', dir: 'in', name: friend }, kind: 'reimbursement' });
      }
    }
    if (kids && !stayHome && r.chance(0.6)) {
      // date night babysitter
      const sitter = personName();
      p2p(dayIn(y, m, 3), hh.layout === 'neobank' ? 'payfriends' : r.pick(['zelle', 'venmo']), 'out', sitter, cents(r.uni(50, 110)), { cat: 'childcare', memo: 'babysitting' });
    }
    if (hh.relatives && r.chance(0.7)) {
      // money sent to family abroad or back home
      card(dayIn(y, m), null, cents(r.uni(100, 300)), { desc: r.pick(['REMITLY* TRANSFER 888-736-4859 WA', 'WESTERN UNION 800-325-6000 CO', 'XOOM 877-815-1531 CA']), cat: 'other', ev: { declinable: false } });
    }
    if (hh.cash) {
      for (let i = r.int(1, 3); i > 0; i--) {
        const day = dayIn(y, m, 1.5);
        const amount = r.pick([2000, 4000, 6000, 8000, 10000]);
        add({ date: day, post: nextBiz(day), amt: -amount, src: { ch: 'atm', addr: `${r.int(100, 9800)} ${r.pick(['MAIN ST', 'BROADWAY', 'MARKET ST', 'PARK AVE', 'CENTRAL AVE', 'WASHINGTON ST'])}` }, cat: 'other', declinable: true });
        if (r.chance(0.35) && hh.layout !== 'online') add({ date: day, post: nextBiz(day), amt: -r.pick([250, 300, 350]), src: { ch: 'fee', fee: 'atm' }, cat: 'other' });
      }
    }
    // Savings and investing, usually the day after a payday.
    if (saveAmt > 0) {
      const day = nextBiz(ed(y, m, r.pick([2, 16, 16, 17])));
      add({ date: day, post: day, amt: -saveAmt * 100, src: { ch: 'xfer', dir: 'out' }, kind: 'transfer_out' });
    }
    if (investAmt > 0) {
      ach(ed(y, m, 18), broker[0], broker[1], -investAmt * 100, { kind: 'transfer_out', cat: undefined });
    }
    if (hh.crypto) ach(ed(y, m, 20), 'COINBASE.COM', 'COINBASE', -r.pick([25000, 50000]), { kind: 'transfer_out', cat: undefined });
    if (hh.college529) ach(ed(y, m, 10), plan529, 'CONTRIB', -hh.college529, { kind: 'transfer_out', cat: undefined });
    if (sweep > 0) {
      const day = prevBiz(ed(y, m, daysIn(y, m)));
      add({ date: day, post: day, amt: -sweep * 100, src: { ch: 'xfer', dir: 'out' }, kind: 'transfer_out' });
    }
  }

  // BNPL: pay-in-4 every two weeks after a bigger online purchase, plus an Affirm monthly plan.
  if (hh.bnpl) {
    for (let d = start - 20 + r.int(0, 15); d <= end; d += r.int(28, 50)) {
      const total = cents(r.uni(90, 340));
      const via = r.pick(['KLARNA', 'AFTERPAY']);
      const shop = r.pick(['NIKE.COM', 'SHEIN', 'ULTA.COM', 'WALMART.COM', 'BESTBUY.COM', 'FASHION NOVA']);
      for (let k = 0; k < 4; k++) {
        const day = d + 14 * k;
        const desc = via === 'KLARNA' ? `KLARNA* ${shop} 844-552-7621 OH` : `AFTERPAY 855-289-6014 CA`;
        card(day, null, Math.round(total / 4), { desc, brand: titleCase(via), cat: 'debtPayments', ev: { declinable: false } });
      }
    }
    if (r.chance(0.6)) {
      const p = cents(r.uni(38, 96));
      monthlyBill(r.int(5, 25), (d) => card(d, null, p, { desc: 'AFFIRM INC 855-423-3729 CA', brand: 'Affirm', cat: 'debtPayments', ev: { declinable: false } }));
    }
  }

  // One-off and seasonal spending, flagged so the app's month-end projection can ignore it.
  const oneOff = (day, key, amount, o = {}) => card(day, key, amount, { ...o, ev: { oneOff: true, declinable: false, ...(o.ev ?? {}) }, onCard: cardHit(cardShare) });
  const inWindow = (m) => months.some(([, mm]) => mm === m);
  if (hh.kids.includes('schoolAge') && inWindow(8)) oneOff(ed(2026, 8, r.int(1, 14)), r.pick(['TARGET', 'STAPLES', 'OLDNAVY']), cents(r.uni(60, 140) * hh.kids.filter((k) => k === 'schoolAge').length));
  if (kids && inWindow(10)) oneOff(ed(2026, 10, r.int(10, 30)), 'SPIRIT', cents(r.uni(25, 80)));
  if (hh.kids.includes('schoolAge') && inWindow(9) && r.chance(0.6)) oneOff(ed(2026, 9, r.int(1, 12)), 'LEAGUE', cents(r.uni(95, 180)));
  if (hh.cars) {
    const oil = r.pick(['VALVOLINE', 'TAKE5', 'FIRESTONE', 'PEPBOYS']);
    for (let d = start + r.int(10, 60); d <= end; d += Math.round(hh.earners.some((e) => e.type === 'gig') ? 30 : r.int(85, 120))) card(d, oil, cents(r.uni(69, 119)), { ev: { declinable: false } });
    if (r.chance(0.35)) oneOff(start + r.int(10, end - start - 5), r.pick(['FIRESTONE', 'PEPBOYS']), cents(r.uni(180, 950)));
    if (r.chance(0.4)) card(start + r.int(5, end - start - 5), 'AUTOZONE', cents(r.uni(18, 95)), { ev: { declinable: false } });
    if (r.chance(0.3)) {
      const d = start + r.int(10, end - start - 5);
      add({ date: d, post: nextBiz(d), amt: -cents(r.uni(65, 240)), src: { ch: 'card', m: `${st} DMV ONLINE RENEWAL ${st}` }, cat: 'car', oneOff: true });
    }
  }
  if (!hh.tight && r.chance(0.55)) {
    // A trip: flights and a hotel or Airbnb a couple of weeks later.
    const book = start + r.int(5, Math.max(6, end - start - 30));
    const airline = r.pick(['SOUTHWEST', 'DELTA', 'UNITED']);
    oneOff(book, airline, cents(r.uni(180, 420) * hh.adults));
    const dest = r.pick([['NEW ORLEANS', 'LA'], ['SAN DIEGO', 'CA'], ['ORLANDO', 'FL'], ['CHICAGO', 'IL'], ['DENVER', 'CO'], ['ASHEVILLE', 'NC'], ['LAS VEGAS', 'NV']]);
    if (r.chance(0.5)) oneOff(book + r.int(14, 28), 'HOTEL', cents(r.uni(280, 720)), { city2: dest[0], st2: dest[1] });
    else oneOff(book + r.int(1, 5), 'AIRBNB', cents(r.uni(350, 900)));
  }
  if (!hh.tight && r.chance(0.3)) oneOff(start + r.int(5, end - start - 5), r.pick(['BESTBUY', M.IKEA.cityBy[metroName] ? 'IKEA' : 'HOMEDEPOT', 'HOMEDEPOT']), cents(r.uni(220, 780)));
  if (hh.pets && r.chance(0.45)) oneOff(start + r.int(5, end - start - 5), 'VET', cents(r.uni(140, 520)));
  if (r.chance(0.2)) oneOff(start + r.int(5, end - start - 5), 'URGENTCARE', cents(r.uni(75, 250)));
  if (!hh.tight && r.chance(0.15)) oneOff(start + r.int(5, end - start - 5), 'GOFUNDME', r.pick([2500, 5000, 10000]), { cause: r.pick(['MEDICAL-BILLS-FOR-DEE', 'REBUILD-AFTER-THE-FIRE', 'COACH-RAYS-RECOVERY', 'SUPPORT-LILYS-TREATMENT', 'HELP-THE-OKAFORS', 'SEND-THE-BAND-TO-STATE']) });

  // Refunds: something sent back to Amazon or Target, credited a week or two later.
  for (let i = r.int(hh.tight ? 0 : 1, 3); i > 0; i--) {
    const key = r.pick(['AMAZON', 'TARGET', 'OLDNAVY', 'UBEREATS']);
    const d = start + r.int(10, end - start - 2);
    const amount = key === 'UBEREATS' ? cents(r.uni(8, 25)) : cents(r.uni(15, 90));
    add({ date: d, post: nextBiz(d + 1), amt: amount, src: { ch: 'card', m: descOf(key), brand: M[key].brand, refund: true }, cat: M[key].cat, kind: 'refund' });
  }

  // Monthly fee at the big-bank layouts when there's no direct deposit big enough to waive it.
  if ((hh.layout === 'chase' || hh.layout === 'bofa') && monthlyIn < 1800) {
    for (const [y, m] of months) add({ date: prevBiz(ed(y, m, daysIn(y, m))), post: prevBiz(ed(y, m, daysIn(y, m))), amt: -1200, src: { ch: 'fee', fee: 'maint' }, cat: 'other' });
  }

  // Credit-card bill for card-heavy households: last month's card spending, paid in full.
  if (hh.card === 'payer') {
    const byMonth = new Map();
    for (const ev of events) {
      if (!ev.onCard) continue;
      const [y, m] = ymd(ev.date);
      byMonth.set(`${y}-${m}`, (byMonth.get(`${y}-${m}`) ?? 0) - ev.amt);
    }
    for (const [y, m] of months) {
      const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      // the month before the window only gets a realistic guess, since we never generated it
      const prev = byMonth.get(`${py}-${pm}`) ?? Math.round(sum([...byMonth.values()]) / Math.max(1, byMonth.size));
      if (prev > 0) ach(ed(y, m, cardDay), issuer[0], issuer[1], -prev, { cat: 'debtPayments' });
    }
  }

  return { hh, events: events.filter((e) => !e.onCard) };
}

// ─── Posting, balances and overdrafts ──────────────────────────────────────────────────────────
function simulate({ hh, events }, r) {
  for (const e of events) if (!e.post) e.post = nextBiz(e.date + (r.chance(0.6) ? 1 : 0));
  // Opening balance: comfortable households start with a cushion, tight ones with about what
  // the first rent needs.
  const firstRent = hh.contractRent ?? 1000;
  const opening = hh.tight ? cents(firstRent + r.uni(700, 1300)) : cents(Math.max(firstRent * r.uni(1.3, 2.2), hh.monthlyIn * r.uni(0.4, 0.9)));
  // Posted-date exports cover what posted inside the range; transaction-date exports cover what
  // happened inside it and has already posted.
  const lastPosted = prevBiz(hh.end);
  const inWindow = events.filter((e) =>
    hh.bank.dates === 'posted' ? e.post >= hh.start && e.post <= lastPosted : e.date >= hh.start && e.date <= hh.end && e.post <= hh.end);
  // Within a day, credits post before debits (most banks now do this), then by size.
  inWindow.sort((a, b) => a.post - b.post || (b.amt > 0) - (a.amt > 0) || (a.late ? 1 : 0) - (b.late ? 1 : 0) || a.amt - b.amt);
  const out = [];
  let bal = opening;
  let feesToday = 0;
  let feeDay = -1;
  const feesInMonth = new Map();
  const declined = [];
  const returned = [];
  const hasSavings = (hh.savings ?? 0) > 0 || (hh.invest ?? 0) > 0;
  for (const ev of inWindow) {
    if (ev.amt < 0 && bal + ev.amt < (hasSavings ? 10000 : 0)) {
      if (hasSavings && ev.kind !== 'transfer_out') {
        // Pull from savings to cover it, in round hundreds.
        const need = Math.ceil((10000 - (bal + ev.amt) + 20000) / 10000) * 10000;
        bal += need;
        out.push({ ...ev, date: ev.post, amt: need, src: { ch: 'xfer', dir: 'in' }, kind: 'transfer_in', cat: undefined, oneOff: false, balance: bal });
      } else if (hasSavings && ev.kind === 'transfer_out') {
        continue; // they'd skip this month's savings transfer rather than overdraw
      } else if (ev.declinable && bal + ev.amt < -(hh.bank.odFee === 0 ? hh.bank.float : hh.odOptIn ? 30000 : 0)) {
        declined.push(ev);
        continue; // card declined at the register
      } else if (hh.bank.odFee === 0 && bal + ev.amt < -hh.bank.float) {
        returned.push(ev);
        continue; // no-fee banks only float a small amount; anything past it is returned unpaid
      }
    }
    bal += ev.amt;
    out.push({ ...ev, balance: bal });
    if (ev.amt < 0 && bal < -(hh.bank.odCushion ?? Infinity) && hh.bank.odFee > 0) {
      if (feeDay !== ev.post) {
        feeDay = ev.post;
        feesToday = 0;
      }
      const key = ymd(ev.post).slice(0, 2).join('-');
      if (feesToday < hh.bank.maxFeesPerDay && (feesInMonth.get(key) ?? 0) < 3) {
        feesToday++;
        feesInMonth.set(key, (feesInMonth.get(key) ?? 0) + 1);
        bal -= hh.bank.odFee;
        out.push({ date: ev.post, post: ev.post, amt: -hh.bank.odFee, src: { ch: 'fee', fee: 'od', ref: ev }, cat: 'other', kind: 'spend', oneOff: false, balance: bal });
      }
    }
  }
  return { opening, rows: out, closing: bal, declined, returned };
}

// ─── Layout renderers ──────────────────────────────────────────────────────────────────────────
function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Llc|Inc|Usa|Atm|Ach|Hoa|Mtg|Irs|Txu|Ladwp|Fpl|Aps|Srp|Peco|Pgw|Nes|Csc|Mta|Nyct|Sdu|Cta|Septa|Mbta|Orca|Rtd|Usaa|Gm|Td|Us|Hctra|Ntta|Ez|Dmv|Bmw|Ymca)\b/g, (w) => w.toUpperCase());
}
const fullName = (n) => n;
const holderIndn = (hh) => `${hh.holder.last.toUpperCase()}, ${hh.holder.first.toUpperCase()}`;

// Neobank apps clean card descriptors down to a merchant name. Known chains carry a brand; for
// everything else, strip the processor prefix, phone numbers, store numbers and the trailing
// city/state the way those apps do.
function cleanMerchant(raw, city) {
  const s = raw
    .replace(new RegExp(`\\s+${city}\\s+[A-Z]{2}$`), '')
    .replace(/^(SQ \*|TST\* |SP \*)/, '')
    .replace(/\s+\d{3}-\d{3}-\d{4}\b.*$/, '')
    .replace(/\s+(?:#\s?)?\d{3,}.*$/, '')
    .replace(/\s+[A-Z]{2}$/, '');
  return titleCase(s.trim());
}
function cardText(ev, layout, hh) {
  const raw = ev.src.m;
  if (layout === 'neobank') return ev.src.brand ?? cleanMerchant(raw, hh.city);
  return raw;
}

const RENDER = {
  // Big-bank layout, mirrors the existing statement.sample.csv fixture column for column.
  chase(ev, hh, rng) {
    const s = ev.src;
    const credit = ev.amt > 0;
    const base = { details: credit ? 'CREDIT' : 'DEBIT', check: '' };
    switch (s.ch) {
      case 'card':
        return { ...base, desc: cardText(ev, 'chase', hh), type: 'DEBIT_CARD' };
      case 'ach':
        return { ...base, desc: `${s.co} ${s.entry} ${s.sec} ID: ${s.id}`.replace(/ +/g, ' '), type: credit ? 'ACH_CREDIT' : 'ACH_DEBIT' };
      case 'p2p':
        if (s.svc === 'zelle') return { ...base, desc: credit ? `Zelle payment from ${fullName(s.name)} ${s.code}` : `Zelle payment to ${fullName(s.name)} ${s.code}`, type: credit ? 'QUICKPAY_CREDIT' : 'QUICKPAY_DEBIT' };
        return { ...base, desc: credit ? `VENMO PAYMENT ${rng.digits(10)} FROM ${s.name.toUpperCase()} WEB ID: 3264681992` : `VENMO *${s.name} Visa Direct NY`, type: credit ? 'ACH_CREDIT' : 'DEBIT_CARD' };
      case 'venmo':
        return { ...base, desc: credit ? `VENMO PAYMENT ${rng.digits(10)} FROM ${s.name.toUpperCase()} WEB ID: 3264681992` : `VENMO *${s.name} Visa Direct NY`, type: credit ? 'ACH_CREDIT' : 'DEBIT_CARD' };
      case 'cashapp':
        return { ...base, desc: `CASH APP*${s.name.toUpperCase()} OAKLAND CA`, type: 'DEBIT_CARD' };
      case 'xfer':
        return { ...base, desc: `Online Transfer ${credit ? 'from' : 'to'} SAV ...${hh.savingsAcct} transaction#: ${rng.digits(11)}`, type: 'ACCT_XFER' };
      case 'check':
        return { details: 'CHECK', desc: `CHECK ${s.num}`, type: 'CHECK_PAID', check: String(s.num) };
      case 'atm':
        return { ...base, desc: `ATM WITHDRAWAL ${rng.digits(6)} ${mmdd(ev.date)} ${s.addr}`, type: 'ATM' };
      case 'cashdep':
        return { details: 'DSLIP', desc: `ATM CASH DEPOSIT ${mmdd(ev.date)} ${rng.int(100, 9800)} MAIN ST`, type: 'ATM_DEPOSIT' };
      case 'fee':
        if (s.fee === 'od') return { ...base, desc: `OVERDRAFT FEE FOR A $${(Math.abs(s.ref.amt) / 100).toFixed(2)} ITEM - DETAILS: ${RENDER.chase(s.ref, hh, rng).desc}`.slice(0, 120), type: 'FEE_TRANSACTION' };
        if (s.fee === 'atm') return { ...base, desc: 'NON-MERIDIAN ATM FEE-WITH', type: 'FEE_TRANSACTION' };
        return { ...base, desc: 'MONTHLY SERVICE FEE', type: 'FEE_TRANSACTION' };
      case 'billpay':
        return { ...base, desc: `Online Payment ${rng.digits(11)} To ${s.payee} ${mmdd(ev.date)}`, type: 'BILLPAY' };
      case 'visadirect':
        return { ...base, desc: `${s.co} INSTANT PAY VISA DIRECT`, type: 'MISC_CREDIT' };
      case 'interest':
        return { ...base, desc: 'INTEREST PAYMENT', type: 'MISC_CREDIT' };
      default:
        throw new Error(`chase: no renderer for ${s.ch}`);
    }
  },
  // Big-bank layout #2: CHECKCARD lines with a long reference, and ACH lines that spell out
  // DES/ID/INDN (the account holder's name) and CO ID.
  bofa(ev, hh, rng) {
    const s = ev.src;
    const credit = ev.amt > 0;
    switch (s.ch) {
      case 'card':
        return `${s.refund ? 'CHECKCARD REFUND' : 'CHECKCARD'} ${mmdd(ev.date).replace('/', '')} ${s.m} ${rng.digits(23)}`;
      case 'ach':
        return `${s.co} DES:${s.entry} ID:${rng.alnum(9, '0123456789ABCDEFGHJK')} INDN:${s.indn ?? holderIndn(hh)} CO ID:${s.id} ${s.sec}`;
      case 'p2p':
        if (s.svc === 'zelle') return credit ? `Zelle payment from ${s.name} for "${s.memo ?? 'thanks'}"; Conf# ${s.code.toLowerCase().slice(0, 9)}` : `Zelle payment to ${s.name} for "${s.memo ?? 'thanks'}"; Conf# ${s.code.toLowerCase().slice(0, 9)}`;
        return RENDER.bofa({ ...ev, src: { ...s, ch: 'venmo' } }, hh, rng);
      case 'venmo':
        return credit ? `VENMO DES:CASHOUT ID:${rng.digits(10)} INDN:${holderIndn(hh)} CO ID:5264681992 PPD` : `VENMO DES:PAYMENT ID:${rng.digits(10)} INDN:${holderIndn(hh)} CO ID:3264681992 WEB`;
      case 'cashapp':
        return `CHECKCARD ${mmdd(ev.date).replace('/', '')} CASH APP*${s.name.toUpperCase()} OAKLAND CA ${rng.digits(23)}`;
      case 'xfer':
        return `Online Banking transfer ${credit ? 'from' : 'to'} SAV ${hh.savingsAcct} Confirmation# ${rng.digits(10)}`;
      case 'check':
        return `Check ${s.num}`;
      case 'atm':
        return `BKOFAMERICA ATM ${mmdd(ev.date)} #${rng.digits(9)} WITHDRWL ${s.addr} ${hh.state}`;
      case 'cashdep':
        return `BKOFAMERICA ATM ${mmdd(ev.date)} #${rng.digits(9)} DEPOSIT ${hh.state}`;
      case 'fee':
        if (s.fee === 'od') return `OVERDRAFT ITEM FEE FOR ACTIVITY OF ${mmdd(ev.date).replace('/', '-')} ELECTRONIC TRANSACTION POSTING SEQ ${rng.int(1, 9)}`;
        if (s.fee === 'atm') return 'NON-BANK ATM WITHDRAWAL FEE';
        return 'MONTHLY MAINTENANCE FEE';
      case 'visadirect':
        return `${s.co} DES:INSTANT PY ID:${rng.digits(10)} INDN:${holderIndn(hh)} CO ID:9000000000 PPD`;
      case 'interest':
        return 'Interest Earned';
      case 'billpay':
        return `${s.payee} DES:BILL PAY ID:${rng.digits(9)} INDN:${holderIndn(hh)} CO ID:1000000000 WEB`;
      default:
        throw new Error(`bofa: no renderer for ${s.ch}`);
    }
  },
  // Credit-union layout: unsigned Debit/Credit columns and short, shouty descriptions.
  cu(ev, hh, rng) {
    const s = ev.src;
    const credit = ev.amt > 0;
    switch (s.ch) {
      case 'card':
        return `${s.refund ? 'POS RETURN' : 'POS PURCHASE'} ${s.m}`;
      case 'ach':
        return `${credit ? 'ACH DEPOSIT' : 'ACH DEBIT'} ${s.co} ${s.entry}`;
      case 'p2p':
        if (s.svc === 'zelle') return credit ? `ZELLE FROM ${s.name.toUpperCase()}` : `ZELLE TO ${s.name.toUpperCase()}${s.memo ? ` ${s.memo.toUpperCase()}` : ''}`;
        return RENDER.cu({ ...ev, src: { ...s, ch: 'venmo' } }, hh, rng);
      case 'venmo':
        return credit ? `ACH DEPOSIT VENMO CASHOUT` : `POS PURCHASE VENMO *${s.name.toUpperCase()} NEW YORK NY`;
      case 'cashapp':
        return `POS PURCHASE CASH APP*${s.name.toUpperCase()} OAKLAND CA`;
      case 'xfer':
        return credit ? 'TRANSFER FROM SHARE 0001 SAVINGS' : 'TRANSFER TO SHARE 0001 SAVINGS';
      case 'check':
        return `SHARE DRAFT #${s.num}`;
      case 'atm':
        return `ATM WITHDRAWAL ${s.addr} ${hh.state}`;
      case 'cashdep':
        return `SHARED BRANCH CASH DEPOSIT`;
      case 'fee':
        if (s.fee === 'od') return 'COURTESY PAY FEE';
        if (s.fee === 'atm') return 'FOREIGN ATM FEE';
        return 'ACCOUNT SERVICE FEE';
      case 'visadirect':
        return `VISA DIRECT CREDIT ${s.co} INSTANT PAY`;
      case 'interest':
        return 'DIVIDEND EARNED';
      case 'billpay':
        return `BILL PAY ${s.payee}`;
      default:
        throw new Error(`cu: no renderer for ${s.ch}`);
    }
  },
  // Online bank: ISO dates, a time, a Withdrawal/Deposit type and plainer descriptions.
  online(ev, hh, rng) {
    const s = ev.src;
    const credit = ev.amt > 0;
    switch (s.ch) {
      case 'card':
        return s.m;
      case 'ach':
        return `${s.co} ${s.entry}`;
      case 'p2p':
        if (s.svc === 'zelle') return credit ? `Zelle money received from ${s.name}` : `Zelle money sent to ${s.name}`;
        return RENDER.online({ ...ev, src: { ...s, ch: 'venmo' } }, hh, rng);
      case 'venmo':
        return credit ? 'VENMO CASHOUT' : `VENMO *${s.name}`;
      case 'cashapp':
        return `CASH APP*${s.name.toUpperCase()}`;
      case 'xfer':
        return `Internet transfer ${credit ? 'from' : 'to'} Online Savings account XXXXXX${hh.savingsAcct}`;
      case 'check':
        return `Check #${s.num}`;
      case 'atm':
        return `ATM Withdrawal - ${s.addr} ${hh.state}`;
      case 'fee':
        return s.fee === 'atm' ? 'ATM Fee' : 'Service Fee';
      case 'visadirect':
        return `${s.co} Instant Pay`;
      case 'interest':
        return 'Interest Paid';
      case 'billpay':
        return `Bill Payment - ${s.payee}`;
      default:
        throw new Error(`online: no renderer for ${s.ch}`);
    }
  },
  // Neobank: cleaned-up, title-cased merchant names and app-style transfer wording.
  neobank(ev, hh, rng) {
    const s = ev.src;
    const credit = ev.amt > 0;
    switch (s.ch) {
      case 'card':
        return s.refund ? `Refund - ${cardText(ev, 'neobank', hh)}` : cardText(ev, 'neobank', hh);
      case 'ach':
        return titleCase(`${s.co} ${s.entry}`);
      case 'p2p':
      case 'payfriends':
        // this kind of app has no Zelle; person-to-person goes through its own Pay Friends feature
        if (s.svc === 'payfriends' || s.svc === 'zelle') return credit ? `Pay Friends - Received from ${s.name}` : `Pay Friends - Sent to ${s.name}`;
        return RENDER.neobank({ ...ev, src: { ...s, ch: 'venmo' } }, hh, rng);
      case 'venmo':
        return credit ? 'Venmo Cashout' : `Venmo *${s.name}`;
      case 'cashapp':
        return `Cash App*${s.name}`;
      case 'xfer':
        return credit ? 'Transfer from Savings Account' : 'Transfer to Savings Account';
      case 'atm':
        return `ATM Withdrawal - ${titleCase(s.addr)} ${hh.state}`;
      case 'cashdep':
        return 'Cash Deposit - Walgreens';
      case 'fee':
        return s.fee === 'atm' ? 'Out-of-network ATM Fee' : 'Fee';
      case 'visadirect':
        return `${titleCase(s.co)} Instant Pay`;
      case 'interest':
        return 'Savings Interest';
      case 'check':
        return `Check ${s.num}`;
      case 'billpay':
        return `Bill Pay - ${titleCase(s.payee)}`;
      default:
        throw new Error(`neobank: no renderer for ${s.ch}`);
    }
  },
};

const DESC_COL = { chase: 2, bofa: 1, cu: 1, online: 4, neobank: 1 };
// Memos that settle what a person-to-person payment was for.
const TELLING_MEMOS = new Set(['rent', 'utilities', 'babysitting', 'kids', 'invoice']);
// How anyone could know a row's label: from the merchant, from a memo the payer typed, or only
// from context the statement doesn't carry (who that person is, what a check paid for).
function labelBasis(ev, desc) {
  if (!['p2p', 'venmo', 'cashapp', 'check'].includes(ev.src.ch)) return 'merchant';
  const memo = ev.src.memo;
  return memo && TELLING_MEMOS.has(memo) && desc.toLowerCase().includes(memo) ? 'memo' : 'context';
}

const HEADERS = {
  chase: ['Details', 'Posting Date', 'Description', 'Amount', 'Type', 'Balance', 'Check or Slip #'],
  bofa: ['Date', 'Description', 'Amount', 'Running Bal.'],
  cu: ['Posting Date', 'Description', 'Debit', 'Credit', 'Balance'],
  online: ['Date', 'Time', 'Amount', 'Type', 'Description'],
  neobank: ['Transaction Date', 'Description', 'Withdrawals', 'Deposits'],
};

const tidy = (t) => t.replace(/ +/g, ' ').trim();
const money = (c) => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2);
const moneyCommas = (c) => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const csvCell = (v, force = false) => {
  const s = String(v);
  return force || /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function render(hh, sim, r) {
  const layout = hh.layout;
  const rows = sim.rows.map((ev) => {
    const displayDate = hh.bank.dates === 'posted' ? ev.post : ev.date;
    let cells;
    let typeCode = null;
    if (layout === 'chase') {
      const x = RENDER.chase(ev, hh, r);
      typeCode = x.type;
      cells = [x.details, usDate(displayDate), tidy(x.desc), money(ev.amt), x.type, money(ev.balance), x.check];
    } else if (layout === 'bofa') {
      cells = [usDate(displayDate), tidy(RENDER.bofa(ev, hh, r)), money(ev.amt), moneyCommas(ev.balance)];
    } else if (layout === 'cu') {
      cells = [usDate(displayDate), tidy(RENDER.cu(ev, hh, r)), ev.amt < 0 ? money(-ev.amt) : '', ev.amt > 0 ? money(ev.amt) : '', money(ev.balance)];
    } else if (layout === 'online') {
      const isCard = ev.src.ch === 'card';
      const t = isCard ? `${String(r.int(7, 22)).padStart(2, '0')}:${String(r.int(0, 59)).padStart(2, '0')}:${String(r.int(0, 59)).padStart(2, '0')}` : `0${r.int(1, 6)}:${String(r.int(0, 59)).padStart(2, '0')}:00`;
      cells = [isoDate(displayDate), t, money(ev.amt), ev.amt < 0 ? 'Withdrawal' : 'Deposit', tidy(RENDER.online(ev, hh, r))];
    } else {
      cells = [usDate(displayDate), tidy(RENDER.neobank(ev, hh, r)), ev.amt < 0 ? money(-ev.amt) : '', ev.amt > 0 ? money(ev.amt) : ''];
    }
    return { ev, cells, displayDate, typeCode, desc: cells[DESC_COL[layout]] };
  });
  // Stable order: by posting sequence, then flipped for newest-first layouts.
  const seq = rows.map((x, i) => ({ ...x, i }));
  if (hh.bank.dates === 'transaction') seq.sort((a, b) => a.displayDate - b.displayDate || a.i - b.i);
  if (hh.bank.order === 'desc') seq.reverse();
  const quoteAll = layout === 'bofa';
  const eol = layout === 'bofa' ? '\r\n' : '\n';
  const bom = layout === 'online' ? '\uFEFF' : '';
  const text = bom + [HEADERS[layout].map((h) => csvCell(h, quoteAll)).join(','), ...seq.map((x) => x.cells.map((c) => csvCell(c, quoteAll)).join(','))].join(eol) + eol;
  return { text, ordered: seq };
}

// ─── Calibration ───────────────────────────────────────────────────────────────────────────────
// Average monthly change in the checking balance over the window's full calendar months, as
// planned, before the bank reacts (declines, savings top-ups, fees).
function monthlyDrift({ hh, events }) {
  const full = [];
  for (let m = ymd(hh.start)[1]; m <= 10; m++) full.push(m);
  let total = 0;
  for (const e of events) {
    const [y, m] = ymd(e.post || e.date);
    if (y === 2026 && full.includes(m)) total += e.amt;
  }
  return total / 100 / full.length;
}

// A budget worked out on paper always misses the small stuff (oil changes, Venmo for dinner,
// the urgent-care copay), so instead of trusting one estimate we generate, measure how the
// balance actually moves, and nudge. Tight households should end each month a little behind,
// everyone else a little ahead, with any real surplus swept to savings rather than spent.
function calibrate(spec) {
  const adj = { flex: 1, sweep: 0, save: 1 };
  const hasSavings = (spec.savings ?? 0) > 0 || (spec.invest ?? 0) > 0;
  let built;
  for (let i = 0; i < 10; i++) {
    built = build(spec, adj);
    const { monthlyIn, eatingOut, other, saveAmt, investAmt } = built.hh.levels;
    const target = spec.tight ? -0.01 * monthlyIn : 0.02 * monthlyIn;
    const gap = monthlyDrift(built) - target; // positive means money left over
    if (Math.abs(gap) < Math.max(40, 0.01 * monthlyIn)) break;
    // Well-off households let some of a surplus turn into lifestyle before saving the rest.
    const ceiling = monthlyIn / (built.hh.adults + 0.5 * built.hh.kids.length) > 4500 ? 1.35 : 1;
    if (gap > 0) {
      if (adj.flex < ceiling || spec.tight || !hasSavings) adj.flex = Math.min(spec.tight || !hasSavings ? 1.8 : ceiling, adj.flex * (1 + gap / (eatingOut + other)));
      else adj.sweep = Math.round((adj.sweep + gap) / 50) * 50;
    } else if (adj.sweep > 0) {
      adj.sweep = Math.max(0, Math.round((adj.sweep + gap) / 50) * 50);
    } else if (adj.flex > 0.45) {
      adj.flex = Math.max(0.45, adj.flex * (1 + gap / (eatingOut + other)));
    } else {
      adj.save = Math.max(0, adj.save + gap / Math.max(1, saveAmt + investAmt));
    }
  }
  built.hh.adj = { ...adj };
  return built;
}

// ─── Main ──────────────────────────────────────────────────────────────────────────────────────
const KIND_ORDER = ['income', 'spend', 'refund', 'reimbursement', 'transfer_out', 'transfer_in'];
function main() {
  if (ROSTER.length !== 50) throw new Error(`roster has ${ROSTER.length} households, expected 50`);
  mkdirSync(join(OUT, 'labels'), { recursive: true });
  for (const f of readdirSync(OUT)) if (/\.(csv|md)$/.test(f) && f !== 'README.md') rmSync(join(OUT, f));
  const keyRows = [['file', 'row', 'category', 'kind', 'one_off', 'label_basis']];
  const hhRows = [['file', 'household', 'layout', 'bank_style', 'metro', 'zip', 'area_tier', 'adults', 'ages', 'kids', 'home', 'bedrooms', 'cars',
    'earners', 'gross_income', 'est_monthly_take_home', 'debts', 'holder_name', 'from', 'to', 'opening_balance', 'closing_balance', 'min_balance', 'overdraft_fees', 'notes']];
  const summary = [];
  for (const spec of ROSTER) {
    const built = calibrate(spec);
    const { hh } = built;
    const r = rngFor(`synthetic-statements/v2/${spec.id}/render`);
    hh.savingsAcct = r.digits(4);
    const sim = simulate(built, r);
    const { text, ordered } = render(hh, sim, r);
    const file = `${spec.id}-${spec.slug}.csv`;
    writeFileSync(join(OUT, file), text);
    ordered.forEach((x, i) => {
      const ev = x.ev;
      if (!KIND_ORDER.includes(ev.kind)) throw new Error(`${file}: bad kind ${ev.kind}`);
      const cat = ev.kind === 'spend' || ev.kind === 'refund' ? ev.cat : '';
      if ((ev.kind === 'spend' || ev.kind === 'refund') && !cat) throw new Error(`${file}: spend row without category: ${JSON.stringify(ev.src)}`);
      keyRows.push([file, i + 1, cat, ev.kind, ev.oneOff ? 'true' : 'false', labelBasis(ev, x.desc)]);
    });
    const debts = [
      ...(hh.home === 'own' ? ['mortgage'] : []), ...(hh.auto ?? []).map(() => 'auto'), ...(hh.subprimeAuto ? ['auto'] : []), ...(hh.lease ? ['auto lease'] : []),
      ...(hh.student ? ['student'] : []), ...(hh.card ? [`card (${hh.card === 'payer' ? 'pays in full' : 'carries a balance'})`] : []),
      ...(hh.bnpl ? ['bnpl'] : []), ...(hh.personalLoan ? ['personal'] : []),
    ];
    const minBal = Math.min(...sim.rows.map((x) => x.balance ?? Infinity), sim.opening);
    const fees = sim.rows.filter((x) => x.src.ch === 'fee' && x.src.fee === 'od').length;
    const freqLabel = { military: 'semimonthly (1st/15th)', irregular: 'irregular' };
    const earners = hh.earners.map((e) => `${e.type} ${freqLabel[e.freq] ?? e.freq} $${Math.round(e.gross / 1000)}k`).join(' + ');
    const moved = (k) => sum(sim.rows.filter((x) => x.kind === k).map((x) => Math.abs(x.amt)));
    const stayHome = hh.adults === 2 && hh.earners.length === 1;
    const notes = [hh.tight ? 'tight budget' : '', sim.returned.length ? `${sim.returned.length} small payments returned unpaid (this bank has no overdraft)` : '', moved('transfer_in') > moved('transfer_out') ? 'draws down savings to cover bills' : '',
      stayHome && hh.kids.length ? 'one parent at home, no paid childcare' : '', hh.ccSubsidy ? 'childcare subsidy copay' : '',
      hh.freePreK ? 'free public pre-K' : '', hh.informalCare ? 'grandparent paid for childcare' : '',
      hh.snap ? 'SNAP covers most groceries (EBT, not on this account)' : '', hh.rentFactor ? 'rent-regulated unit, below market' : '',
      hh.noAfterSchool ? 'teacher hours, no after-school care' : '', hh.estTax ? 'pays estimated tax' : '', hh.childSupport ? 'receives child support' : '', hh.cash ? 'uses cash' : '',
      hh.card === 'payer' ? `~${Math.round(hh.cardShare * 100)}% of everyday spending on a credit card` : '', hh.privateSchool ? 'private school tuition (labelled other, not childcare)' : '',
hh.relatives ? 'sends money to family' : ''].filter(Boolean).join('; ');
    hhRows.push([file, spec.slug, hh.layout, hh.bank.name, hh.area.metro, spec.zip, hh.area.tier, hh.adults, hh.ages.join(' '), hh.kids.join(' '), hh.home, hh.beds, hh.cars,
      earners, sum(hh.earners.map((e) => e.gross)), Math.round(hh.monthlyIn), debts.join('; '), `${hh.holder.first} ${hh.holder.last}`,
      isoDate(hh.start), isoDate(hh.end), money(sim.opening), money(sim.closing), money(minBal), fees, notes]);
    summary.push({ file, rows: sim.rows.length, min: minBal / 100, close: sim.closing / 100, open: sim.opening / 100, fees, declined: sim.declined.length, returned: sim.returned.map((e) => `${e.src.co ?? e.src.m ?? e.src.ch} ${(e.amt / 100).toFixed(2)}`), adj: hh.adj, inc: hh.monthlyIn, fixed: hh.levels.fixed });
  }
  writeFileSync(join(OUT, 'labels/answer-key.csv'), keyRows.map((row) => row.map((c) => csvCell(c)).join(',')).join('\n') + '\n');
  writeFileSync(join(OUT, 'labels/households.csv'), hhRows.map((row) => row.map((c) => csvCell(c)).join(',')).join('\n') + '\n');
  if (process.env.VERBOSE) for (const s of summary) console.log(`${s.file.slice(0, 34).padEnd(34)} rows=${String(s.rows).padStart(4)} inc=${s.inc.toFixed(0).padStart(6)} fixed=${s.fixed.toFixed(0).padStart(6)} open=${s.open.toFixed(0).padStart(6)} min=${s.min.toFixed(0).padStart(6)} close=${s.close.toFixed(0).padStart(6)} fees=${s.fees} declined=${s.declined} returned=[${s.returned.join('; ')}] flex=${s.adj.flex.toFixed(2)} sweep=${s.adj.sweep} save=${s.adj.save.toFixed(2)}`);
  console.log(`wrote ${summary.length} statements to ${OUT}`);
}

main();
