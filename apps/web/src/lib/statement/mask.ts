// Masks a bank-statement description before it leaves the browser (CLAUDE.md rule 6,
// docs/ARCHITECTURE.md → Privacy design). The server runs the same function again on what it
// receives, so it must be idempotent: maskLabel(maskLabel(x)) === maskLabel(x).
//
// - Person-to-person lines (Zelle, Venmo, PayPal, Cash App, a bank app's own "Pay Anyone"…) become
//   "<Service> to|from [name]": everything after the service is dropped, so no way of writing a
//   name can slip through.
// - Transfers become "Transfer to|from savings|checking|…", or "[name]" when the other side is
//   not one of the user's own account types.
// - Bill pay, named online payments, checks, deposits from a counterparty, and bare ACH
//   credits/debits drop the counterparty and memo entirely, even when it looks like a business.
// - ACH name fields (INDN:, IND NAME:, RECEIVER: …) are masked; the company name (CO NAME:) is kept.
// - E-mail addresses, card/account numbers (4+ digits, XXXX1234), phone numbers and reference
//   codes that mix letters and digits are replaced by "#", "[email]" or "[ref]".
// Ported from #55 (maskLabel in apps/web/src/lib/csv.ts and statement.go), which replaced every
// transfer line with "Personal transfer"; keeping the direction and the account type lets the
// categorizer tell a move to savings (not spending) from paying a person (spending).

export const MAX_LABEL_LENGTH = 200;

const P2P_SERVICES: readonly [RegExp, string][] = [
  [/\bzelle\b|\bquick ?pay\b/i, 'Zelle'],
  [/\bvenmo\b/i, 'Venmo'],
  [/\bpay ?pal\b/i, 'PayPal'],
  [/\bcash ?app\b|\bsquare ?cash\b|\bsq ?c\*/i, 'Cash App'],
  [/\bapple ?cash\b/i, 'Apple Cash'],
  [/\bpopmoney\b/i, 'Popmoney'],
  // Neobank apps send money between people with their own feature rather than Zelle, and the
  // export reads "Pay Anyone to Sarah Nguyen" or, under its older name, "Pay Friends - Sent to …".
  [/\bpay ?anyone\b/i, 'Pay Anyone'],
  [/\bpay ?friends\b/i, 'Pay Friends'],
];

const TRANSFER = /\b(?:transfer|xfer|trnsfr|tfr)\b/i;
const WIRE = /\bwire\b/i;

/** The user's own account types a transfer can go to or come from. */
const ACCOUNT_TYPES: readonly [RegExp, string][] = [
  [/\b(?:sav|savs|savings?|money ?market|mma|share)\b/i, 'savings'],
  [/\b(?:chk|chking|checking|dda)\b/i, 'checking'],
  [/\b(?:brokerage|invest(?:ment)?s?|ira|roth|401k)\b/i, 'brokerage'],
  [/\b(?:credit ?card|card|crd)\b/i, 'card'],
  [/\b(?:loan|mortgage|heloc)\b/i, 'loan'],
  [/\b(?:acct|account)\b/i, 'account'],
];

function direction(text: string): 'to' | 'from' | null {
  const to = /\b(?:to|sent|send)\b/i.exec(text);
  const from = /\b(?:from|received|recv|rcvd)\b/i.exec(text);
  if (to && from) return to.index < from.index ? 'to' : 'from';
  return to ? 'to' : from ? 'from' : null;
}

/** "Transfer to savings" / "Wire from [name]" / "Transfer fee". */
function transferLabel(text: string): string {
  const dir = direction(text);
  const kind = WIRE.test(text) && !TRANSFER.test(text) ? 'Wire' : 'Transfer';
  if (/\bfee\b/i.test(text)) return `${kind} fee`;
  if (!dir) return kind;
  const after = text.slice(new RegExp(`\\b${dir === 'to' ? '(?:to|sent|send)' : '(?:from|received|recv|rcvd)'}\\b`, 'i').exec(text)!.index);
  const account = ACCOUNT_TYPES.find(([re]) => re.test(after));
  return `${kind} ${dir} ${account ? account[1] : '[name]'}`;
}

/** ACH fields that come after a name in NACHA-style descriptions; a masked value ends at one. */
const ACH_NEXT_FIELD = String.raw`(?:CO ID|CO NAME|ORIG CO NAME|ORIG ID|IND ID|ID|DES|DESC DATE|SEC|TRN|TRACE#?|ENTRY DESCR|CO ENTRY DESCR|EED|PPD|WEB|CCD|TEL)`;
/** INDN:, IND NAME:, RECEIVER: … (a person). `CO NAME:` (the company paying or being paid) is kept. */
const ACH_NAME_FIELD = new RegExp(
  String.raw`\b(INDN|IND NAME|IND ID|RECEIVER|BENEFICIARY|BNF|(?<!CO )NAME)\s*:\s*.*?(?=\s+${ACH_NEXT_FIELD}\b|$)`,
  'gi',
);

/** These payment formats can hold either a person or a business. Treat the whole
 * counterparty as private: category keywords and company-looking suffixes cannot
 * establish that a name is safe to send. Canonical output also drops reference IDs,
 * dates and memo text, and stays unchanged when the server masks it again. */
function namedPaymentLabel(text: string): string | null {
  if (/\bbill\s*pay(?:ment)?\b/i.test(text)) return 'Bill payment to [name]';
  if (/\bonline(?: banking)?\s+payment\b.*?\bto\b/i.test(text)) return 'Online payment to [name]';
  if (/^check(?:\s|#|$)/i.test(text)) return 'Check to [name]';
  if (/\bdeposit\s+from\b/i.test(text)) return 'Deposit from [name]';
  const ach = /^ach\s+(credit|debit)\b/i.exec(text);
  if (ach) return `ACH ${ach[1]!.toLowerCase()} [name]`;
  return null;
}

/** Normalizes a raw description and masks personal data. Never returns an empty string. */
export function maskLabel(raw: string): string {
  let text = raw
    .normalize('NFKC')
    .replace(/\p{Cc}+/gu, ' ') // control characters, including tabs and line breaks
    .replace(/\s+/g, ' ')
    .trim();

  const p2p = P2P_SERVICES.find(([re]) => re.test(text));
  if (p2p) {
    const dir = direction(text);
    return `${p2p[1]} ${dir ? `${dir} ` : ''}[name]`;
  }
  if (TRANSFER.test(text) || WIRE.test(text)) return transferLabel(text);

  const namedPayment = namedPaymentLabel(text);
  if (namedPayment) return namedPayment;

  text = text
    // ACH name fields: mask the value up to the next "FIELD:" or the end. CO NAME (the company) stays.
    .replace(ACH_NAME_FIELD, (_m, field: string) => `${field.toUpperCase()}:[name]`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    // Masked account numbers as banks print them: XXXX1234, ****1234, ...1234
    .replace(/(?:[x*•]{2,}|\.{2,})[\s-]?\d+/gi, '#')
    // Reference codes that mix letters and digits (JPM99K1L2M3N, 2B7XY1QZ0)
    .replace(/\b(?=[A-Z0-9]*\d[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/gi, '[ref]')
    // Runs with 4+ digits: card and account numbers, phone numbers, store and check numbers
    .replace(/\d(?:[\d -]*\d)?/g, (run) => ((run.match(/\d/g)?.length ?? 0) >= 4 ? '#' : run))
    .replace(/#(?:[\s#-]*#)+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > MAX_LABEL_LENGTH) text = text.slice(0, MAX_LABEL_LENGTH).trimEnd();
  // Nothing left but masks and punctuation: say so instead of sending "#".
  return /[a-z0-9]/i.test(text.replace(/\[(?:name|ref|email)\]/gi, '')) ? text : 'Unknown';
}
