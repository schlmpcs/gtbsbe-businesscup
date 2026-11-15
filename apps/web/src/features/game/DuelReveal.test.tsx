// @vitest-environment jsdom
// The duel reveal's crowd line, from a server PickResult to the rendered text: buildDuelCrowd (the
// view-model's rounding rule) and DuelRevealBand / DuelReveal (the S3 band and the sources panel).
// The fixture duel never has a crowd, so this is where a non-null one is exercised.
import type { PickResult } from '@lifeguessr/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { duel as t } from '@/copy/duel';
import { buildDuelCrowd, buildDuelReveal } from './model/duelDerive';
import { DuelReveal, DuelRevealBand } from './ui/DuelReveal';

const source = { name: 'HUD Fair Market Rents', year: 2025, url: 'https://www.huduser.gov/portal/datasets/fmr.html' };

/** A scored round as the server answers it, with the crowd under test. */
function result(crowd: PickResult['crowd']): PickResult {
  return {
    resultId: '0123456789abcdef0123456789abcdef',
    correct: true,
    points: 1000,
    totals: { A: 5200, B: 4100 },
    breakdown: {
      A: [{ category: 'rentUtilities', amount: 5200, sources: [source], isEstimate: false }],
      B: [{ category: 'rentUtilities', amount: 4100, sources: [source], isEstimate: false }],
    },
    decidedBy: { category: 'rentUtilities', A: 5200, B: 4100 },
    lesson: 'Where you live and how many bedrooms usually decide the month.',
    crowd,
  };
}

const revealOf = (crowd: PickResult['crowd']) => buildDuelReveal(1, { choice: 'A', result: result(crowd) });

describe('buildDuelCrowd', () => {
  it('names the letter most players picked, with its share rounded half up to a whole percent', () => {
    expect(buildDuelCrowd({ pickedA: 131, total: 214 })).toEqual({ letter: 'A', share: 0.61, total: 214 }); // 61.2%
    expect(buildDuelCrowd({ pickedA: 83, total: 214 })).toEqual({ letter: 'B', share: 0.61, total: 214 }); // B: 131 of 214
    expect(buildDuelCrowd({ pickedA: 12, total: 20 })).toEqual({ letter: 'A', share: 0.6, total: 20 });
    // 60.5% exactly: half up to 61%, from the integer counts (0.605 as a double would round to 60%).
    expect(buildDuelCrowd({ pickedA: 121, total: 200 })).toEqual({ letter: 'A', share: 0.61, total: 200 });
    expect(buildDuelCrowd({ pickedA: 249, total: 400 })).toEqual({ letter: 'A', share: 0.62, total: 400 }); // 62.25%
  });

  it('says A on an exact tie, and never 100% while anyone picked the other life', () => {
    expect(buildDuelCrowd({ pickedA: 107, total: 214 })).toEqual({ letter: 'A', share: 0.5, total: 214 });
    expect(buildDuelCrowd({ pickedA: 1999, total: 2000 })).toEqual({ letter: 'A', share: 0.99, total: 2000 }); // 99.95%
    expect(buildDuelCrowd({ pickedA: 1, total: 2000 })).toEqual({ letter: 'B', share: 0.99, total: 2000 });
    expect(buildDuelCrowd({ pickedA: 20, total: 20 })).toEqual({ letter: 'A', share: 1, total: 20 });
    expect(buildDuelCrowd({ pickedA: 0, total: 20 })).toEqual({ letter: 'B', share: 1, total: 20 });
  });

  it('shows nothing for counts that cannot be right', () => {
    expect(buildDuelCrowd({ pickedA: 0, total: 0 })).toBeNull();
    expect(buildDuelCrowd({ pickedA: 21, total: 20 })).toBeNull();
  });
});

describe('the reveal’s crowd line', () => {
  it('renders "61% picked A, from 214 picks" from { pickedA: 131, total: 214 }', () => {
    const reveal = revealOf({ pickedA: 131, total: 214 });
    expect(reveal.crowd).toEqual({ letter: 'A', share: 0.61, total: 214 });
    render(<DuelRevealBand reveal={reveal} onNext={() => {}} />);
    expect(screen.getByText('61% picked A, from 214 picks')).toBeInTheDocument();
    expect(screen.queryByText(t.reveal.crowdNone)).not.toBeInTheDocument();
  });

  it('formats a large crowd with a thousands separator', () => {
    render(<DuelRevealBand reveal={revealOf({ pickedA: 900, total: 2468 })} onNext={() => {}} />);
    expect(screen.getByText('64% picked B, from 2,468 picks')).toBeInTheDocument();
  });

  it('says "Not enough picks yet" when the server sends no crowd', () => {
    render(<DuelRevealBand reveal={revealOf(null)} onNext={() => {}} />);
    expect(screen.getByText(t.reveal.crowdNone)).toBeInTheDocument();
    expect(screen.queryByText(/picked [AB], from/)).not.toBeInTheDocument();
  });

  it('explains in the sources panel that the player’s own pick is counted', () => {
    render(<DuelReveal reveal={revealOf({ pickedA: 131, total: 214 })} />);
    expect(screen.getByText(t.reveal.crowdHowHeading)).toBeInTheDocument();
    expect(screen.getByText(t.reveal.crowdHow)).toBeInTheDocument();
    expect(t.reveal.crowdHow).toMatch(/yours included/);
    expect(t.reveal.crowdHow).toContain('20 players');
  });
});

describe('the reveal’s side-by-side panel', () => {
  const both: PickResult = {
    ...result(null),
    totals: { A: 3100, B: 4300 },
    breakdown: {
      A: [
        { category: 'rentUtilities', amount: 2000, sources: [source], isEstimate: false },
        { category: 'car', amount: 600, sources: [source], isEstimate: true },
        { category: 'groceries', amount: 500, sources: [source], isEstimate: false },
      ],
      B: [
        { category: 'rentUtilities', amount: 1800, sources: [source], isEstimate: false },
        { category: 'childcare', amount: 2000, sources: [source], isEstimate: false },
        { category: 'groceries', amount: 500, sources: [source], isEstimate: false },
      ],
    },
    decidedBy: { category: 'childcare', A: 0, B: 2000 },
  };

  it('lists every category of either life, both amounts on one scale, largest first, the decider marked', () => {
    const rows = buildDuelReveal(1, { choice: 'B', result: both }).categories;
    expect(rows.map((r) => r.category)).toEqual(['rentUtilities', 'childcare', 'car', 'groceries']);
    expect(rows[0]).toMatchObject({ A: 2000, B: 1800, scaleA: 1, scaleB: 0.9, decided: false });
    expect(rows[1]).toMatchObject({ A: 0, B: 2000, scaleA: 0, scaleB: 1, decided: true });
    expect(rows[2]).toMatchObject({ A: 600, B: 0, isEstimate: true });
    expect(rows.filter((r) => r.decided)).toHaveLength(1);
  });

  it('renders both totals, a row per category with both amounts, the decider tag and the lesson', () => {
    render(<DuelReveal reveal={buildDuelReveal(1, { choice: 'B', result: both })} />);
    const panel = screen.getByTestId('duel-compare');
    expect(panel).toHaveTextContent('$3,100');
    expect(panel).toHaveTextContent('$4,300');
    const list = screen.getByRole('list', { name: t.reveal.compareLabel });
    expect(list.querySelectorAll('li')).toHaveLength(4);
    expect(list).toHaveTextContent(t.reveal.compareRow('$0', '$2,000'));
    expect(screen.getByText(t.reveal.decidedTag)).toBeInTheDocument();
    expect(panel).toHaveTextContent(both.lesson);
  });
});
