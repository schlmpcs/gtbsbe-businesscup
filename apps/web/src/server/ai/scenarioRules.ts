// Server-only: the rules (regex) reader for "What if…" sentences, used when there is no model or
// the model's answer fails validation. It only reads what the sentence says: words to fields,
// written numbers to values. The two conversions it makes are unit changes ("next year" → 12
// months, "6.9%" → 0.069) and, for a raise stated per year before tax, the engine's
// takeHomeFromGrossRaise. Every result is checked with ScenarioChangeSchema and confirmed by the user.
import { takeHomeFromGrossRaise } from '@lifeguessr/engine';
import { areaData, areaForMetro, findArea } from '@lifeguessr/data/areas';
import {
  ScenarioChangeSchema, type AreaData, type CostCategory, type KidAge, type Purchase, type ScenarioChange,
} from '@lifeguessr/types';

export type ScenarioParse =
  | { ok: true; value: ScenarioChange; inferred: string[] }
  | { ok: false; code: 'nothing_found' }
  | { ok: false; code: 'incomplete'; missing: string[] };

// ----- places --------------------------------------------------------------------------------

/** Extra names people use for our metros (lowercase). The metro's own city names are added below. */
const ALIASES: Record<string, string[]> = {
  'New York, NY': ['nyc', 'new york city', 'queens'],
  'Los Angeles, CA': ['la', 'l.a.'],
  'Philadelphia, PA': ['philly'],
  'Dallas-Fort Worth, TX': ['dfw'],
  'Minneapolis-St. Paul, MN': ['twin cities', 'saint paul', 'st paul'],
};

/** Lowercase place name → metro, from our 15 metros' names and the aliases. */
const PLACES: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const metro of new Set(areaData.map((a) => a.metro))) {
    const cities = metro.split(',')[0]!;
    map.set(cities.toLowerCase(), metro);
    for (const city of cities.split('-')) map.set(city.trim().toLowerCase(), metro);
    for (const alias of ALIASES[metro] ?? []) map.set(alias, metro);
  }
  return map;
})();

const TIER_WORDS: [RegExp, AreaData['tier']][] = [
  [/\bsuburbs?\b|\bsuburban\b/i, 'suburb'],
  [/\bdowntown\b|\bcity cent(?:er|re)\b|\bfancier\b|\bnicer (?:area|part|neighbou?rhood)\b/i, 'expensive'],
  [/\bcheaper (?:area|part|neighbou?rhood|place)\b/i, 'cheap'],
];

export type PlaceResult = { zip: string } | { unknown: string } | null;

/**
 * A place as we can cost it: a ZIP we have, a metro name (its mid-priced ZIP, or the tier the
 * sentence names) or a tier of the user's own metro ("the suburbs"). Unknown names come back as such.
 */
export function resolvePlace(place: string | null, tier: AreaData['tier'] | null, homeZip?: string): PlaceResult {
  const name = (place ?? '').toLowerCase().replace(/[.,!?]+$/, '').replace(/^the\s+/, '').trim();
  const zip = name.match(/\b\d{5}\b/)?.[0];
  if (zip) return findArea(zip) ? { zip } : { unknown: zip };
  if (name) {
    // Longest known name inside the text ("downtown austin" → austin).
    const known = [...PLACES.keys()].filter((k) => new RegExp(`(^|[^a-z])${k.replace(/\./g, '\\.')}([^a-z]|$)`).test(name));
    const metro = known.sort((a, b) => b.length - a.length).map((k) => PLACES.get(k)!)[0];
    if (metro) {
      const area = areaForMetro(metro, tier ?? 'mid') ?? areaForMetro(metro, 'mid');
      if (area) return { zip: area.zip };
    }
  }
  if (tier) {
    const home = findArea(homeZip);
    const area = home ? areaForMetro(home.metro, tier) : null;
    if (area) return { zip: area.zip };
    return name ? { unknown: place!.trim() } : null;
  }
  return name ? { unknown: place!.trim() } : null;
}

// ----- numbers -------------------------------------------------------------------------------

const MONEY_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?(k|K|thousand\b|m\b|M\b|million\b)?|\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?(k|K|thousand\b)(?![a-z])/g;

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eighteen: 18,
};

function moneyAmounts(text: string): { value: number; index: number; end: number }[] {
  const out: { value: number; index: number; end: number }[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const int = m[1] ?? m[4]!;
    const dec = m[2] ?? m[5];
    const unit = (m[3] ?? m[6] ?? '').toLowerCase();
    const mult = unit === 'k' || unit === 'thousand' ? 1e3 : unit === 'm' || unit === 'million' ? 1e6 : 1;
    out.push({ value: Number(`${int.replaceAll(',', '')}${dec ? `.${dec}` : ''}`) * mult, index: m.index, end: m.index + m[0].length });
  }
  return out;
}

const num = (s: string) => WORD_NUMBERS[s.toLowerCase()] ?? Number(s);
const NUMBER_WORD = `\\d+|${Object.keys(WORD_NUMBERS).join('|')}`;

/** "now" → 0, "next year" → 12, "in 2 years" → 24, "in 6 months" → 6; null when not said. */
function startMonths(text: string): number | null {
  if (/\bnext year\b/i.test(text)) return 12;
  if (/\bnext month\b/i.test(text)) return 1;
  const m = text.match(new RegExp(`\\bin (?:about |around )?(${NUMBER_WORD}) (years?|months?)\\b`, 'i'));
  if (m) return num(m[1]!) * (m[2]!.toLowerCase().startsWith('year') ? 12 : 1);
  const y = text.match(new RegExp(`\\b(${NUMBER_WORD}) (years?|months?) from now\\b`, 'i'));
  if (y) return num(y[1]!) * (y[2]!.toLowerCase().startsWith('year') ? 12 : 1);
  if (/\b(now|this year|today|right away)\b/i.test(text)) return 0;
  return null;
}

// ----- the kinds of change --------------------------------------------------------------------

const KID_RE = /\b(baby|babies|newborn|kid|child|son|daughter|toddler|adopt\w*|pregnan\w*|twins)\b/i;
const MOVE_RE = /\b(?:move|moving|moved|relocate|relocating|live|living)\b(?:\s+(?:back|out))?\s+(?:to|in|into)\s+(.+)$/i;
const INCOME_RE = /\b(raise|pay ?rise|pay bump|promotion|bonus|salary|pay ?cut|earn|make|income|paycheck|take[- ]home)\b/i;
const RENT_RE = /\brent\b/i;
const BUY_RE = /\b(buy|buying|bought|purchase|get|getting|lease|finance|financing)\b/i;
/** Words that make a sentence a purchase even when it also says "get" or "pay". */
const STRONG_BUY_RE = /\b(buy|buying|bought|purchase|lease|financ\w*)\b/i;

function kidChange(text: string): ScenarioParse {
  let age: KidAge = 'infant';
  if (/\btoddler\b/i.test(text)) age = 'toddler';
  else if (/\bpreschool/i.test(text)) age = 'preschool';
  else if (/\bschool[- ]age|\b(?:[5-9]|1[0-2])[- ]year[- ]old\b/i.test(text)) age = 'schoolAge';
  const start = startMonths(text);
  const value: ScenarioChange = { kind: 'kid', age, ...(start !== null && start > 0 && { inMonths: start }) };
  return { ok: true, value, inferred: start === null ? ['inMonths'] : [] };
}

function moveChange(text: string, homeZip?: string): ScenarioParse | null {
  const tier = TIER_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const target = text.match(MOVE_RE)?.[1]?.replace(/\b(next year|in \w+ (?:years?|months?)|now|this year)\b.*$/i, '').trim() ?? null;
  const place = resolvePlace(target, tier, homeZip);
  if (place === null) return tier ? { ok: false, code: 'incomplete', missing: ['move.zip'] } : null;
  if ('unknown' in place) return { ok: false, code: 'incomplete', missing: ['move.zip'] };
  return { ok: true, value: { kind: 'move', zip: place.zip }, inferred: target && /\d{5}/.test(target) ? [] : ['zip'] };
}

function incomeChange(text: string): ScenarioParse {
  const amount = moneyAmounts(text)[0];
  if (!amount) return { ok: false, code: 'incomplete', missing: ['income.monthlyDelta'] };
  const down = /\bpay ?cut\b|\bcut\b|\bless\b|\blose\b|\bdrop\b/i.test(text) ? -1 : 1;
  const monthly = /\b(a|per|each|every) month\b|\/\s?mo\b|\bmonthly\b/i.test(text);
  const takeHome = /\btake[- ]home\b|\bafter tax/i.test(text);
  if (monthly) return { ok: true, value: { kind: 'income', monthlyDelta: down * amount.value }, inferred: [] };
  const yearly = down * amount.value;
  // A yearly amount: before tax unless the sentence says take-home (then only a unit change).
  if (takeHome) return { ok: true, value: { kind: 'income', monthlyDelta: yearly / 12 }, inferred: ['monthlyDelta'] };
  return {
    ok: true,
    value: { kind: 'income', monthlyDelta: takeHomeFromGrossRaise(yearly), grossYearly: yearly },
    inferred: ['monthlyDelta'],
  };
}

function rentChange(text: string): ScenarioParse {
  const amounts = moneyAmounts(text);
  // "rent goes from $1,900 to $2,400": the last amount is the new rent.
  const amount = amounts[amounts.length - 1];
  if (!amount) return { ok: false, code: 'incomplete', missing: ['rent.monthly'] };
  return { ok: true, value: { kind: 'rent', monthly: amount.value }, inferred: [] };
}

const CAR_RE = /\b(car|truck|suv|sedan|minivan|van|pickup|tesla|ev|vehicle|jeep|honda|toyota)\b/i;

/** The words right after the price, as a short label ("a $35k car" → "car"). */
function labelOf(text: string, end: number): string {
  const after = text.slice(end).match(/^\s*(?:for\s+)?(?:an?\s+)?([a-z][a-z' -]{1,40}?)(?=\s+(?:on|with|at|for|over|financed|using|paid|in|next|from|,|\.|$)|[,.]|$)/i)?.[1];
  const before = text.slice(0, text.lastIndexOf('$', end) >= 0 ? text.lastIndexOf('$', end) : end)
    .match(/\b(?:buy|get|lease|purchase|finance)\s+(?:a|an|the|my)?\s*(?:new\s+|used\s+)?([a-z][a-z' -]{1,30}?)\s+(?:for|at|costing)\s*$/i)?.[1];
  const label = (after && !/^(loan|month|year)/i.test(after) ? after : before ?? '').trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Purchase';
}

function purchaseChange(text: string): ScenarioParse {
  const amounts = moneyAmounts(text);
  const price = amounts[0];
  if (!price) return { ok: false, code: 'incomplete', missing: ['purchase.amount'] };
  const apr = text.match(/(\d+(?:\.\d+)?)\s?%/);
  const termMonths = text.match(/\b(\d+)[- ]?(?:months?|mo)\b/i);
  const termYears = text.match(new RegExp(`\\b(${NUMBER_WORD})[- ]years?\\b`, 'i'));
  const down = text.match(/\$\s?([\d,.]+)\s?(k|K)?\s+down\b|\bdown payment of \$\s?([\d,.]+)\s?(k|K)?/i);
  const financed = /\bloan\b|\bfinanc|\bapr\b|\b\d+[- ]?(?:months?|mo)\b|%/i.test(text);
  const label = labelOf(text, price.end);
  const category: CostCategory | undefined = CAR_RE.test(text) ? 'car' : undefined;
  const recurring: Purchase['recurring'] = /\b(a|per|each|every) month\b|\bmonthly\b/i.test(text) && !financed
    ? 'monthly'
    : /\b(a|per|each|every) year\b|\byearly\b|\bannual/i.test(text) ? 'yearly' : false;

  let payWith: Purchase['payWith'] = /\b(credit )?card\b/i.test(text) ? 'card' : 'cash';
  const inferred: string[] = [];
  if (financed) {
    const term = termMonths ? Number(termMonths[1]) : termYears ? num(termYears[1]!) * 12 : null;
    const missing = [...(apr ? [] : ['payWith.loan.apr']), ...(term ? [] : ['payWith.loan.termMonths'])];
    if (missing.length > 0) return { ok: false, code: 'incomplete', missing };
    const downValue = down ? Number((down[1] ?? down[3])!.replaceAll(',', '')) * ((down[2] ?? down[4]) ? 1e3 : 1) : undefined;
    payWith = {
      loan: {
        // "6.9%" → 0.069 without float noise.
        amount: price.value, apr: Number(`${apr![1]}e-2`), termMonths: term!,
        ...(downValue !== undefined && downValue <= price.value && { downPayment: downValue }),
      },
    };
  }
  const start = startMonths(text);
  const value: ScenarioChange = {
    kind: 'purchase',
    purchase: { label, amount: price.value, recurring, payWith },
    ...(category && { category }),
    ...(start !== null && start > 0 && { inMonths: start }),
  };
  return { ok: true, value, inferred };
}

/** Reads one change from a "What if…" sentence; validated with ScenarioChangeSchema. */
export function parseScenarioRules(text: string, homeZip?: string): ScenarioParse {
  const t = text.trim().replace(/^what if\s+/i, '');
  let out: ScenarioParse | null = null;
  if (KID_RE.test(t) && !STRONG_BUY_RE.test(t)) out = kidChange(t);
  else if (MOVE_RE.test(t) || (TIER_WORDS.some(([re]) => re.test(t)) && /\bmove|moving|live\b/i.test(t))) out = moveChange(t, homeZip);
  else if (RENT_RE.test(t) && !BUY_RE.test(t)) out = rentChange(t);
  else if (INCOME_RE.test(t) && !STRONG_BUY_RE.test(t)) out = incomeChange(t);
  else if (BUY_RE.test(t) || moneyAmounts(t).length > 0) out = purchaseChange(t);
  if (!out) return { ok: false, code: 'nothing_found' };
  if (!out.ok) return out;
  const checked = ScenarioChangeSchema.safeParse(out.value);
  return checked.success ? { ok: true, value: checked.data, inferred: out.inferred } : { ok: false, code: 'nothing_found' };
}
