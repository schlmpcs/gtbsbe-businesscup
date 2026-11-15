// Merchant names and marks for the onboarding's analysis: a statement label ("SPOTIFY USA 877-778-1161 NY")
// becomes "Spotify" with its mark (public/merchants, Simple Icons, CC0) when we know it, else a short name
// from the label and its initials. Display only: amounts come from the categorized lines as they are.
const KNOWN: [RegExp, string, string?][] = [
  [/SPOTIFY/i, 'Spotify', 'spotify'], [/NETFLIX/i, 'Netflix', 'netflix'], [/APPLE/i, 'Apple', 'apple'],
  [/STARBUCKS/i, 'Starbucks', 'starbucks'], [/UBER\s*\*?\s*EATS/i, 'Uber Eats', 'ubereats'], [/DOORDASH/i, 'DoorDash', 'doordash'],
  [/TACO BELL/i, 'Taco Bell', 'tacobell'], [/TARGET/i, 'Target', 'target'], [/SHELL/i, 'Shell', 'shell'],
  [/TOYOTA/i, 'Toyota Financial', 'toyota'], [/SPECTRUM/i, 'Spectrum', 'spectrum'], [/VENMO/i, 'Venmo', 'venmo'],
  [/ZELLE/i, 'Zelle', 'zelle'], [/MCDONALD/i, 'McDonald’s', 'mcdonalds'],
  [/WHATABURGER/i, 'Whataburger'], [/CHIPOTLE/i, 'Chipotle'], [/ALDI/i, 'Aldi'], [/TOM THUMB/i, 'Tom Thumb'],
  [/WALMART/i, 'Walmart'], [/KROGER/i, 'Kroger'], [/PROGRESSIVE/i, 'Progressive'], [/PLANET FITNESS/i, 'Planet Fitness'],
  [/CVS/i, 'CVS'], [/EXXON/i, 'Exxon'], [/AMAZON PRIME/i, 'Amazon Prime'], [/AMAZON/i, 'Amazon'], [/OAKWOOD/i, 'Oakwood Apts'],
  [/ATMOS/i, 'Atmos Energy'], [/TXU/i, 'TXU Energy'], [/CAPITAL ONE/i, 'Capital One'],
  [/HOME DEPOT/i, 'Home Depot'], [/HOPDODDY/i, 'Hopdoddy'], [/\bQT\b/i, 'QuikTrip'], [/ATM/i, 'ATM cash'],
];

const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export type MerchantName = { name: string; logo: string | null; initials: string };

export function merchantOf(label: string): MerchantName {
  for (const [re, name, slug] of KNOWN) {
    if (re.test(label)) return { name, logo: slug ? `/merchants/${slug}.svg` : null, initials: initialsOf(name) };
  }
  const words = label.split(/[\s*#/]+/).filter((w) => /^[a-z&'.-]{2,}$/i.test(w) && !/^(INC|LLC|PPD|ID|PAYROLL|PMT|PMTS|WEB|ONLINE|PAYMENT)$/i.test(w)).slice(0, 2);
  const name = words.length > 0 ? words.map(titleCase).join(' ') : label.slice(0, 16);
  return { name, logo: null, initials: initialsOf(name) };
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)).toUpperCase();
}
