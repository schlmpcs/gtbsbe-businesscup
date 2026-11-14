/** True when `value` holds a number anywhere inside it (arrays and objects included) that is NaN or infinite. */
export function hasNonFinite(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasNonFinite);
  if (value && typeof value === 'object') return Object.values(value).some(hasNonFinite);
  return false;
}
