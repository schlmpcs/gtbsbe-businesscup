import { describe, expect, it } from 'vitest';
import { snapX, xAtClient } from './ui/chartScale';

describe('chart pixel → year', () => {
  // A 1000-unit viewBox drawn 500px wide, starting 100px from the left: 2 user units per pixel.
  const ctm = { a: 0.5, e: 100 };

  it('maps client x through the inverse screen matrix onto [xMin, xMax]', () => {
    expect(xAtClient(100, ctm, 1000, 2026, 2090)).toBe(2026);
    expect(xAtClient(600, ctm, 1000, 2026, 2090)).toBe(2090);
    expect(xAtClient(350, ctm, 1000, 2026, 2090)).toBe(2058);
  });

  it('snaps to whole years and clamps to the range', () => {
    expect(snapX(2058.4, 2026, 2090)).toBe(2058);
    expect(snapX(2058.6, 2026, 2090)).toBe(2059);
    expect(snapX(2000, 2026, 2090)).toBe(2026);
    expect(snapX(2100, 2026, 2090)).toBe(2090);
    expect(snapX(xAtClient(0, ctm, 1000, 2026, 2090), 2026, 2090)).toBe(2026);
  });

  it('survives a degenerate matrix', () => {
    expect(xAtClient(300, { a: 0, e: 0 }, 1000, 2026, 2090)).toBe(2026);
  });
});
