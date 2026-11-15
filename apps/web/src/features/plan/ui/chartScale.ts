// Pixel ↔ x-value geometry for LineChart's draggable markers. No money math: it only turns a pointer's
// screen x into a position on the chart's x axis (a year) and back.

/** The part of an SVG screen matrix (getScreenCTM) that maps user-space x to client x: client = a·x + e. */
export type ScreenMatrixX = { a: number; e: number };

/**
 * The x value under a client-space pixel, through the inverse of the chart SVG's screen matrix.
 * The SVG's viewBox is `vb` wide and spans [xMin, xMax].
 */
export function xAtClient(clientX: number, ctm: ScreenMatrixX, vb: number, xMin: number, xMax: number): number {
  if (ctm.a === 0 || vb <= 0) return xMin;
  const svgX = (clientX - ctm.e) / ctm.a;
  return xMin + (svgX / vb) * (xMax - xMin);
}

/** Round to a whole step (a year) and clamp to [min, max]. */
export function snapX(x: number, min: number, max: number): number {
  const r = Math.round(x);
  return Math.min(Math.max(r, Math.ceil(min)), Math.floor(max));
}
