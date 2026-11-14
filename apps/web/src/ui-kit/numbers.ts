// Input plumbing for the kit's controls (clamping, step snapping, parsing typed text).
// Widget behaviour only: no money or finance math lives here.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Digits after the decimal point in a step: 1 → 0, 0.01 → 2, 2.5e-3 → 4. */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || Number.isInteger(step)) return 0;
  const [mantissa = '', exponent] = step.toString().split('e-');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return fraction + (exponent ? Number(exponent) : 0);
}

/** Snap to the nearest min + k·step, without float noise (0.1 + 0.2 stays 0.3). */
export function snapToStep(value: number, step: number, min: number): number {
  if (!(step > 0)) return value;
  const snapped = min + Math.round((value - min) / step) * step;
  return Number(snapped.toFixed(Math.max(decimalsOf(step), decimalsOf(min))));
}

/** Drop binary float noise from a computed value (24.36 / 100 → 0.2436, not 0.24359999999999998). */
export function cleanFloat(value: number): number {
  return Number(value.toPrecision(15));
}

/**
 * Parse what a person typed into a number field: "1,234.5", "$1,200", " 22.8 % " → number.
 * Returns null for an empty field and undefined when the text is not a number (yet), e.g. "-" or "1.2.3".
 */
export function parseTypedNumber(text: string): number | null | undefined {
  const cleaned = text.replace(/[\s,$%]/g, '').replace(/^−/, '-');
  if (cleaned === '') return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

/** A plain number for an input box: grouped ("1,234.5") at rest, ungrouped ("1234.5") while editing. */
export function formatPlainNumber(value: number, maxFractionDigits: number, grouped: boolean): string {
  const key = `${maxFractionDigits}-${grouped}`;
  let f = numberFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFractionDigits, useGrouping: grouped });
    numberFormatters.set(key, f);
  }
  return f.format(value).replace(/^−/, '-');
}
