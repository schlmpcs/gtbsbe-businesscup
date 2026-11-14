// Server-only: the deterministic keyword categorizer for masked statement labels (T7). It is the
// fallback whenever the AI isn't used (no API key, provider failure, invalid output, too many
// labels), so it has to be good on its own: ordered rules, most specific first, matched on whole
// words. It sorts labels only; the money is summed by statementTotals in @lifeguessr/engine.
// Ported and extended from #55 (ruleCategory in services/api/internal/server/statement.go and
// categoryOf in apps/web/src/lib/csv.ts).
import type { CostCategory, StatementClass } from '@lifeguessr/types';

export type Direction = 'out' | 'in';
export type RuleResult = { cls: StatementClass; oneOffHint: boolean };

/** Words joined into one whole-word, case-insensitive pattern. `*` and `.` in a word are literal. */
const words = (...list: string[]) =>
  new RegExp(`(?:^|[^a-z0-9])(?:${list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s*]*')).join('|')})(?![a-z0-9])`, 'i');

// ----- money in --------------------------------------------------------------------------------

const PAY = words(
  'payroll', 'pay roll', 'direct dep', 'direct deposit', 'dir dep', 'salary', 'paycheck', 'des:payroll',
  'adp', 'gusto', 'paychex', 'trinet', 'rippling', 'justworks', 'paylocity', 'ceridian', 'workday pay',
  'ssa treas', 'soc sec', 'social security', 'unemployment', 'dol ui', 'va benefit',
);
const REFUND = words('refund', 'return', 'returned', 'reversal', 'credit adj', 'adjustment', 'cashback', 'cash back', 'rebate');

// ----- money out: not spending -----------------------------------------------------------------

/** Moving money to the user's own savings or investments is not spending. */
const SAVINGS = /^(?:transfer|wire) to (?:savings|checking|brokerage|account)$/i;
const INVESTING = words(
  'vanguard', 'fidelity', 'schwab', 'charles schwab', 'robinhood', 'betterment', 'wealthfront', 'acorns', 'stash',
  'etrade', 'e trade', 'e*trade', 'td ameritrade', 'merrill edge', 'coinbase', 'treasurydirect', 'm1 finance', 'public.com',
);

// ----- money out: categories, most specific first ------------------------------------------------

const RULES: readonly [CostCategory, RegExp][] = [
  ['debtPayments', /^transfer to (?:card|loan)$/i],
  ['eatingOut', words('uber eats', 'ubereats', 'uber *eats', 'doordash', 'door dash', 'grubhub', 'postmates', 'seamless', 'caviar')],
  ['car', words('rent-a-car', 'rent a car', 'car rental', 'hertz', 'avis', 'enterprise rent', 'zipcar', 'turo', 'costco gas', "sam's fuel", 'sams fuel')],
  ['rentUtilities', words('southwest gas', 'natural gas', 'gas co', 'gas company', 'gas service', 'piedmont gas', 'socalgas', 'nicor gas', 'atmos', 'spire energy')],
  ['debtPayments', words(
    'credit card', 'card payment', 'card pmt', 'crd pmt', 'crd epay', 'epay', 'autopay', 'auto pay', 'mobile pmt', 'online pmt',
    'loan', 'loan pmt', 'mortgage', 'mtg pmt', 'student ln', 'navient', 'nelnet', 'mohela', 'sallie mae', 'great lakes', 'aidvantage',
    'edfinancial', 'affirm', 'klarna', 'afterpay', 'sezzle', 'toyota financial', 'toyota motor credit', 'honda financial',
    'american honda', 'ford credit', 'gm financial', 'nissan motor', 'hyundai motor finance', 'ally', 'santander consumer',
    'capital one', 'chase card', 'chase credit', 'citi card', 'citicard', 'discover', 'amex', 'american express', 'synchrony',
    'barclaycard', 'barclays', 'wells fargo card', 'bank of america card', 'bk of amer card', 'sofi', 'lendingclub', 'upstart',
    'best egg', 'carmax auto', 'rocket mortgage', 'mr. cooper', 'mr cooper', 'quicken loans', 'applecard', 'apple card', 'gs bank',
  )],
  ['rentUtilities', words(
    'rent', 'apts', 'apt', 'apartments', 'apartment', 'property management', 'prop mgmt', 'properties', 'leasing', 'realty',
    'residential', 'hoa', 'homeowners assoc', 'landlord', 'appfolio', 'rentcafe', 'yardi', 'buildium', 'bilt',
    'electric', 'energy', 'power', 'utilities', 'utility', 'water', 'sewer', 'trash', 'waste management', 'republic services',
    'txu', 'coned', 'con ed', 'con edison', 'pg&e', 'pge', 'duke energy', 'dominion', 'xcel', 'comed', 'national grid',
    'eversource', 'oncor', 'reliant', 'georgia power', 'fpl', 'entergy', 'ameren', 'dte', 'consumers energy', 'sce', 'sdg&e',
    'spectrum', 'comcast', 'xfinity', 'at&t', 'att', 'verizon', 't-mobile', 'tmobile', 'sprint', 'cox comm', 'cox cable',
    'frontier comm', 'centurylink', 'lumen', 'optimum', 'mediacom', 'google fi', 'mint mobile', 'cricket wireless', 'metro by t-mobile',
    'boost mobile', 'visible', 'internet', 'cable', 'renters insurance', 'lemonade',
  )],
  ['childcare', words(
    'daycare', 'day care', 'childcare', 'child care', 'preschool', 'pre-school', 'nanny', 'babysit', 'babysitter', 'sitter',
    'kindercare', 'bright horizons', 'la petite', 'goddard school', 'primrose', 'learning care', 'after school', 'afterschool',
    'montessori', 'kiddie academy', 'care.com', 'tutoring', 'ymca child',
  )],
  ['car', words(
    'shell', 'chevron', 'exxon', 'exxonmobil', 'mobil', 'bp', 'texaco', 'citgo', 'sunoco', 'marathon', 'valero', 'speedway', 'wawa',
    'sheetz', 'quiktrip', 'qt', 'racetrac', 'raceway', 'circle k', 'kwik trip', 'kwik star', 'murphy usa', 'murphy express',
    'phillips 66', 'conoco', 'arco', 'loves', "love's", 'pilot', 'flying j', 'buc-ees', "buc-ee's", 'casey', "casey's", 'holiday stationstores',
    'gas station', 'fuel', 'gasoline', 'gas', 'parking', 'parkmobile', 'park mobile', 'spothero', 'toll', 'tolls', 'e-zpass', 'ezpass',
    'fastrak', 'sunpass', 'ntta', 'tolltag', 'txtag', 'peach pass', 'i-pass', 'auto insurance', 'car insurance', 'geico', 'progressive',
    'state farm', 'allstate', 'liberty mutual', 'usaa', 'farmers ins', 'nationwide', 'travelers ins', 'root insurance', 'car wash',
    'jiffy lube', 'valvoline', 'autozone', "o'reilly auto", 'oreilly auto', 'advance auto', 'napa auto', 'pep boys', 'firestone',
    'discount tire', 'midas', 'meineke', 'goodyear', 'dmv', 'uber', 'lyft', 'tesla supercharger', 'chargepoint', 'evgo',
    'electrify america', 'metro transit', 'transit', 'mta', 'bart', 'clipper', 'ventra', 'dart',
  )],
  ['groceries', words(
    'grocery', 'groceries', 'supermarket', 'market basket', 'kroger', 'aldi', 'safeway', 'albertsons', 'publix', 'whole foods',
    'wholefds', 'trader joe', "trader joe's", 'h-e-b', 'heb', 'wegmans', 'food lion', 'giant eagle', 'giant food', 'stop & shop',
    'shoprite', 'meijer', 'winco', 'sprouts', 'tom thumb', 'vons', 'ralphs', 'fred meyer', 'harris teeter', 'hy-vee', 'hyvee',
    'piggly wiggly', 'food 4 less', 'smart & final', 'save mart', 'lidl', 'fresh market', 'costco', 'costco whse', "sam's club",
    'sams club', "bj's wholesale", 'walmart supercenter', 'wal-mart super', 'wm supercenter', 'walmart grocery', 'instacart',
    'fresh thyme', 'natural grocers', 'winn-dixie', 'ingles', 'jewel osco', 'jewel-osco', 'acme markets', 'key food',
    'food bazaar', '99 ranch', 'h mart', 'grocery outlet', 'el super', 'fiesta mart', 'cub foods', 'hannaford', 'price chopper',
    'stater bros', 'weis', 'amazon fresh', 'food city', 'brookshire', 'market street', 'randalls', 'kings food', 'foodtown',
  )],
  ['eatingOut', words(
    'restaurant', 'restaurants', 'cafe', 'café', 'coffee', 'starbucks', 'dunkin', "mcdonald's", 'mcdonalds', 'burger', 'burgers',
    'whataburger', "wendy's", 'wendys', 'taco bell', 'tacos', 'taco', 'chipotle', 'chick-fil-a', 'subway', "domino's", 'dominos',
    'pizza', 'papa john', "papa john's", 'little caesars', 'panera', 'panda express', 'sonic drive', 'kfc', 'popeyes', "arby's",
    'arbys', 'jack in the box', 'in-n-out', 'five guys', 'shake shack', 'raising cane', "raising cane's", 'wingstop',
    'buffalo wild', 'applebee', "applebee's", "chili's", 'olive garden', 'ihop', "denny's", 'waffle house', 'cracker barrel',
    'dutch bros', "peet's", 'tim hortons', 'sushi', 'ramen', 'grill', 'bistro', 'diner', 'bbq', 'barbecue', 'pub', 'tavern',
    'brewery', 'brewing', 'taqueria', 'bakery', 'deli', 'donut', 'donuts', 'bagel', 'bagels', 'tst*', 'toast', 'cava',
    'sweetgreen', 'qdoba', 'jersey mike', "jimmy john's", 'jimmy johns', 'firehouse subs', "culver's", "zaxby's", 'el pollo loco',
    'del taco', "carl's jr", "hardee's", 'white castle', 'dairy queen', 'baskin', 'cold stone', 'krispy kreme', 'smoothie',
    'jamba', 'boba', 'tea house', 'kitchen', 'eatery', 'cantina', 'steakhouse', 'wings', 'noodle', 'pho', 'thai', 'mexican grill',
  )],
  ['subscriptions', words(
    'netflix', 'spotify', 'hulu', 'disney+', 'disney plus', 'disneyplus', 'hbo', 'hbo max', 'max.com', 'paramount+', 'paramount plus',
    'peacock', 'apple.com/bill', 'apple music', 'icloud', 'itunes', 'google *', 'google storage', 'youtube premium', 'youtube tv',
    'youtubepremium', 'amazon prime', 'prime video', 'audible', 'kindle unlimited', 'siriusxm', 'sirius xm', 'pandora', 'dropbox',
    'adobe', 'microsoft*', 'microsoft 365', 'msft', 'xbox', 'playstation', 'nintendo', 'patreon', 'substack', 'nytimes',
    'new york times', 'wsj', 'washington post', 'planet fitness', 'la fitness', '24 hour fitness', 'anytime fitness', 'equinox',
    'crunch fitness', 'orangetheory', 'peloton', 'gym', 'fitness', 'subscription', 'chatgpt', 'openai', 'claude.ai', 'anthropic',
    'canva', 'duolingo', 'calm.com', 'headspace', 'noom', 'match.com', 'tinder', 'bumble', 'hinge', 'hellofresh', 'blue apron',
    'factor75', 'onlyfans', 'twitch', 'crunchyroll', 'sling', 'fubo', 'philo', 'espn+', 'dazn', 'ring.com', 'adt', 'simplisafe',
    '1password', 'lastpass', 'nordvpn', 'expressvpn', 'grammarly', 'linkedin premium', 'github', 'notion', 'zoom.us',
  )],
];

/** Merchants that are typically one-off or yearly charges (a hint; statementTotals decides). */
const ONE_OFF_HINT = words(
  'hospital', 'animal hosp', 'vet', 'veterinary', 'clinic', 'urgent care', 'medical center', 'dental', 'dentist', 'orthodont',
  'surgery', 'emergency', 'airline', 'airlines', 'air lines', 'delta air', 'united air', 'american air', 'southwest air',
  'jetblue', 'spirit air', 'frontier air', 'alaska air', 'expedia', 'booking.com', 'hotel', 'hotels', 'marriott', 'hilton',
  'hyatt', 'airbnb', 'vrbo', 'furniture', 'ikea', 'wayfair', 'ashley', 'mattress', 'appliance', 'best buy', 'apple store',
  'repair', 'tuition', 'university', 'college', 'annual', 'yearly', 'annual fee', 'registration', 'dmv', 'amazon prime',
  'costco membership', 'jeweler', 'jewelers', 'jewelry', 'ticketmaster', 'stubhub', 'seatgeek', 'tickets', 'moving',
  'u-haul', 'uhaul', 'tax prep', 'turbotax', 'h&r block', 'irs', 'insurance premium',
);

/** Sorts one masked label. `in` = money coming in, `out` = money going out. */
export function ruleClass(label: string, direction: Direction): RuleResult {
  const oneOffHint = direction === 'out' && ONE_OFF_HINT.test(label);
  if (direction === 'in') {
    if (PAY.test(label)) return { cls: 'pay', oneOffHint: false };
    if (REFUND.test(label)) {
      const category = RULES.find(([, re]) => re.test(label.replace(REFUND, ' ')))?.[0];
      return { cls: category ?? 'other', oneOffHint: false };
    }
    // Transfers in, money from people, deposits, interest: neither spending nor pay.
    return { cls: 'transfer', oneOffHint: false };
  }
  if (SAVINGS.test(label) || INVESTING.test(label)) return { cls: 'transfer', oneOffHint: false };
  const rule = RULES.find(([, re]) => re.test(label));
  return { cls: rule ? rule[0] : 'other', oneOffHint };
}
