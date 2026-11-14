import type { CostCategory, StatementItem } from "./types";
export type CategorizedItem = StatementItem & {
  category: CostCategory;
  oneOff: boolean;
};
export const categories: CostCategory[] = [
  "rentUtilities",
  "car",
  "childcare",
  "groceries",
  "eatingOut",
  "subscriptions",
  "debtPayments",
  "other",
];
export function rowsOf(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    state: "plain" | "quoted" | "closed" = "plain";
  const finish = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
    cell = "";
    state = "plain";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === "quoted") {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else state = "closed";
      } else cell += c;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      state = "plain";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      finish();
    } else if (c === '"') {
      if (state === "closed" || cell !== "")
        throw new Error("Unexpected quote in CSV.");
      state = "quoted";
    } else {
      if (state === "closed")
        throw new Error("Unexpected text after quoted CSV field.");
      cell += c;
    }
  }
  if (state === "quoted") throw new Error("Unclosed quote in CSV.");
  finish();
  return rows;
}
export function maskLabel(label: string): string {
  if (/\b(zelle|venmo|paypal|transfer|cash\s?app)\b/i.test(label))
    return "Personal transfer";
  return label
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[masked]")
    .replace(/\b(?:\d[ -]?){4,}\b/g, "[masked]")
    .slice(0, 100);
}
export function categoryOf(label: string): CostCategory {
  if (/rent|electric|utility|water|internet/i.test(label))
    return "rentUtilities";
  if (/gas|shell|chevron|insurance|parking|uber|lyft/i.test(label))
    return "car";
  if (/daycare|childcare|preschool/i.test(label)) return "childcare";
  if (/grocery|trader joe|whole foods|kroger|safeway|aldi|costco/i.test(label))
    return "groceries";
  if (/restaurant|cafe|coffee|pizza|doordash|takeout|starbucks/i.test(label))
    return "eatingOut";
  if (/netflix|spotify|subscription|hulu/i.test(label)) return "subscriptions";
  if (/loan|credit card|debt payment/i.test(label)) return "debtPayments";
  return "other";
}
export function parseStatement(
  text: string,
  mapping?: {
    date: number;
    label: number;
    amount: number;
    debit?: number;
    credit?: number;
  },
  reverse = false,
): CategorizedItem[] {
  const rows = rowsOf(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV needs a header and transactions.");
  const headers = rows[0].map((x) => x.toLowerCase().trim());
  const find = (r: RegExp) => headers.findIndex((x) => r.test(x));
  const m = mapping ?? {
    date: find(/^(date|transaction date|posted date|posting date)$/),
    label: find(/description|merchant|memo|payee/),
    amount: find(/^amount$/),
    debit: find(/debit|withdrawal/),
    credit: find(/credit|deposit/),
  };
  const valid = (i: number | undefined): i is number =>
    i !== undefined && Number.isInteger(i) && i >= 0 && i < headers.length;
  if (
    !valid(m.date) ||
    !valid(m.label) ||
    (!valid(m.amount) && !valid(m.debit))
  )
    throw new Error("Choose the date, description and amount columns below.");
  const selected = [
    m.date,
    m.label,
    ...(valid(m.amount)
      ? [m.amount]
      : [m.debit!, ...(valid(m.credit) ? [m.credit] : [])]),
  ];
  if (new Set(selected).size !== selected.length)
    throw new Error("Each mapped field needs a different column.");
  const money = (s: string, allowEmpty = false) => {
    const raw = s.trim();
    if (raw === "") {
      if (allowEmpty) return 0;
      throw new Error("Invalid transaction amount.");
    }
    const normalized = raw
      .replace(/^\((.*)\)$/, "-$1")
      .replace(/^([+-]?)\$\s*/, "$1");
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(normalized))
      throw new Error("Invalid transaction amount.");
    const n = Number(normalized.replaceAll(",", ""));
    if (!Number.isFinite(n) || Math.abs(n) > 1e12)
      throw new Error("Invalid transaction amount.");
    return n;
  };
  return rows.slice(1).map((r, index) => {
    if (r.length !== headers.length)
      throw new Error(`Wrong number of columns in row ${index + 2}.`);
    const raw = r[m.date].trim();
    let year: number, month: number, day: number;
    let parts = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (parts) {
      year = +parts[1];
      month = +parts[2];
      day = +parts[3];
    } else {
      parts = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!parts)
        throw new Error(
          `Unsupported date in row ${index + 2}; use YYYY-MM-DD or MM/DD/YYYY.`,
        );
      month = +parts[1];
      day = +parts[2];
      year = +parts[3];
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 1900 ||
      year > 2200 ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      throw new Error(`Invalid date in row ${index + 2}.`);
    if (!r[m.label].trim())
      throw new Error(`Missing merchant description in row ${index + 2}.`);
    const label = maskLabel(r[m.label]);
    let amount: number;
    if (valid(m.amount)) amount = money(r[m.amount]) * (reverse ? -1 : 1);
    else {
      const debit = money(r[m.debit!], true),
        credit = valid(m.credit) ? money(r[m.credit], true) : 0;
      if (
        debit < 0 ||
        credit < 0 ||
        (debit > 0 && credit > 0) ||
        (!r[m.debit!].trim() && (!valid(m.credit) || !r[m.credit].trim()))
      )
        throw new Error(`Ambiguous debit/credit amounts in row ${index + 2}.`);
      amount = debit - credit;
    }
    return {
      label,
      amount,
      month: `${year}-${String(month).padStart(2, "0")}`,
      day,
      category: categoryOf(label),
      oneOff: false,
    };
  });
}
