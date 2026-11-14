// The daily log's own line parser: "coffee 5, taxi 18, groceries 64" → purchases, with no network.
// Deterministic: one amount per part (the number the user typed, never a guess), the category from
// a keyword table (English and Russian, since speech input follows the browser language). A part
// it can't read fully (no amount, two amounts, no known word) is returned as `unresolved`; only
// then does the app ask /api/ai/parse (kind 'spend'), and the user confirms what comes back.
import { DAILY_ENTRY_LABEL_MAX, DAILY_ENTRY_MAX_AMOUNT, type SPEND_ITEM_CATEGORIES, type SpendItem } from '@lifeguessr/types';

type ItemCategory = (typeof SPEND_ITEM_CATEGORIES)[number];

/**
 * Words → category. A word ending in `*` matches any word that starts with it (Russian endings:
 * "продукт*" matches "продукты", "продуктов"); other words match whole words only, so "bar" never
 * matches "barber". Phrases (two words) are tried before single words ("uber eats" before "uber").
 */
export const SPEND_KEYWORDS: Record<ItemCategory, readonly string[]> = {
  eatingOut: [
    'uber eats', 'ubereats', 'doordash', 'grubhub', 'postmates', 'take out', 'takeout', 'take-out',
    'coffee', 'latte', 'cappuccino', 'espresso', 'americano', 'starbucks', 'dunkin', 'tea', 'boba',
    'lunch', 'dinner', 'breakfast', 'brunch', 'restaurant*', 'cafe', 'café', 'diner', 'pizza', 'burger*',
    'sushi', 'tacos', 'taco', 'sandwich', 'bar', 'beer', 'drinks', 'cocktail*', 'wine', 'snack*', 'mcdonalds',
    "mcdonald's", 'chipotle', 'food truck', 'delivery',
    'кофе', 'кофей*', 'латте', 'капучино', 'обед*', 'ужин*', 'завтрак*', 'ланч*', 'кафе', 'ресторан*',
    'пицц*', 'бургер*', 'суши', 'пиво', 'перекус*', 'шаурм*', 'чай', 'бар', 'доставк*',
  ],
  groceries: [
    'whole foods', 'trader joes', "trader joe's", 'grocery*', 'groceries', 'supermarket', 'kroger', 'aldi',
    'safeway', 'costco', 'publix', 'wegmans', 'heb', 'food', 'milk', 'bread', 'eggs', 'produce', 'market',
    'продукт*', 'магазин*', 'супермаркет*', 'молок*', 'хлеб*', 'яйц*', 'еда', 'еду', 'пятерочк*', 'перекрест*',
  ],
  car: [
    'car wash', 'oil change', 'gas', 'gasoline', 'fuel', 'petrol', 'parking', 'toll*', 'shell', 'chevron',
    'exxon', 'tire*', 'mechanic',
    'бензин*', 'заправк*', 'топлив*', 'парковк*', 'мойк*', 'шиномонтаж*',
  ],
  rentUtilities: [
    'rent', 'electric*', 'power bill', 'water bill', 'internet', 'utilities', 'utility', 'phone bill', 'wifi',
    'аренд*', 'квартплат*', 'коммуналк*', 'свет', 'интернет*', 'связь',
  ],
  childcare: [
    'daycare', 'day care', 'babysitter', 'babysitting', 'nanny', 'childcare', 'preschool',
    'няня', 'няне', 'нян*', 'садик*', 'детсад*',
  ],
  subscriptions: [
    'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'icloud', 'youtube', 'subscription*', 'gym', 'membership',
    'подписк*', 'спортзал*', 'абонемент*',
  ],
  other: [
    'taxi', 'uber', 'lyft', 'cab', 'bus', 'metro', 'subway', 'train', 'transit', 'ride', 'movie*', 'cinema',
    'tickets', 'ticket', 'clothes', 'shoes', 'gift*', 'pharmacy', 'medicine', 'haircut', 'amazon', 'target',
    'walmart', 'book*', 'shopping',
    'такси', 'метро', 'автобус*', 'электричк*', 'кино', 'билет*', 'одежд*', 'обув*', 'подар*', 'аптек*',
    'лекарств*', 'стрижк*', 'книг*', 'покупк*',
  ],
};

export type SpendLinePart = {
  /** The part as typed (one purchase). */
  text: string;
  amount?: number;
  category?: ItemCategory;
  label?: string;
};

export type SpendLineParse = {
  /** Parts read fully: an amount and a category. */
  items: SpendItem[];
  /** Every part in order, read or not (the AI fallback and the confirm step use them). */
  parts: SpendLinePart[];
  /** Parts missing an amount or a category: when non-empty, the local parse failed. */
  unresolved: SpendLinePart[];
};

// Parts: commas (not between two digits: "1,200", "5,50"), semicolons, line breaks, "+", " and ", " и ".
const PART_SPLIT = /(?:(?<!\d),|,(?!\d)|;|\n|\+|\s+and\s+|\s+и\s+)/iu;
// One amount: $5, 5$, 5.50, 5,50, 1,200, 1,200.50; an optional currency word after it.
const AMOUNT = /(?<![\p{L}\d])\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)\s?(?:\$|usd\b|dollars?\b|bucks\b|долл\p{L}*|бакс\p{L}*)?/giu;
const CURRENCY_WORDS = /(?:^|\s)(?:usd|dollars?|bucks|долл\p{L}*|бакс\p{L}*)(?=\s|$)/giu;

function toNumber(raw: string): number {
  // "1,200.50" → 1200.5; "5,50" (decimal comma) → 5.5.
  const thousands = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw);
  return Number(thousands ? raw.replaceAll(',', '') : raw.replace(',', '.'));
}

type Keyword = { words: string[]; prefix: boolean; category: ItemCategory };
const KEYWORDS: Keyword[] = (Object.entries(SPEND_KEYWORDS) as [ItemCategory, readonly string[]][])
  .flatMap(([category, list]) =>
    list.map((k) => ({ words: k.replace(/\*$/, '').split(/\s+/), prefix: k.endsWith('*'), category })),
  )
  .sort((a, b) => b.words.length - a.words.length); // phrases first

/** The category of a part's words, from the keyword table; undefined when no word is known. */
export function categoryOf(text: string): ItemCategory | undefined {
  const words = text.toLowerCase().replaceAll('ё', 'е').split(/[^\p{L}\p{N}'-]+/u).filter(Boolean);
  for (const k of KEYWORDS) {
    for (let i = 0; i + k.words.length <= words.length; i++) {
      const hit = k.words.every((w, j) => {
        const word = words[i + j]!;
        const last = j === k.words.length - 1;
        return last && k.prefix ? word.startsWith(w) : word === w;
      });
      if (hit) return k.category;
    }
  }
  return undefined;
}

function readPart(text: string): SpendLinePart {
  const amounts = [...text.matchAll(AMOUNT)];
  const words = text.replace(AMOUNT, ' ').replace(CURRENCY_WORDS, ' ').replace(/[\s.:–—-]+/g, ' ').trim();
  const label = words ? words.slice(0, DAILY_ENTRY_LABEL_MAX).trim() : undefined;
  const part: SpendLinePart = { text, ...(label ? { label } : {}) };
  if (amounts.length === 1) {
    const amount = toNumber(amounts[0]![1]!);
    if (amount > 0 && amount <= DAILY_ENTRY_MAX_AMOUNT) part.amount = amount;
  }
  const category = label ? categoryOf(label) : undefined;
  if (category) part.category = category;
  return part;
}

/** Read a daily-log line: "coffee 5, taxi 18" → two purchases; see SpendLineParse for failures. */
export function parseSpendLine(line: string): SpendLineParse {
  const parts = line.split(PART_SPLIT).map((p) => p.trim()).filter(Boolean).map(readPart);
  const items: SpendItem[] = [];
  const unresolved: SpendLinePart[] = [];
  for (const p of parts) {
    if (p.amount !== undefined && p.category !== undefined) {
      items.push({ category: p.category, amount: p.amount, ...(p.label ? { label: p.label } : {}) });
    } else {
      unresolved.push(p);
    }
  }
  return { items, parts, unresolved };
}
