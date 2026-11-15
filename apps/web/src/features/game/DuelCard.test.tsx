// @vitest-environment jsdom
// The duel card face before the pick: household, metro, the four fact groups (two lines each), the
// caption as a quote, and the hint's fact once open. Never a dollar amount before the reveal.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { duel as t } from '@/copy/duel';
import { duelCardsSample } from '@/fixtures/duelCards';
import { publicDuelCard } from '@/lib/duel/publicDuelCard';
import type { DuelCardVM } from './model/types';
import { DuelCard } from './ui/DuelCard';

const pub = publicDuelCard(duelCardsSample.find((c) => c.id === 'sample-duel-03')!, 'A');
const vm: DuelCardVM = {
  ...pub, hintFact: null, state: 'round', pickedByYou: false, total: null, categories: [],
};

describe('DuelCard', () => {
  it('shows the household, the metro, every fact group and the caption, with no money', () => {
    const { container } = render(<DuelCard card={vm} onPick={() => {}} />);
    expect(screen.getByRole('heading', { name: pub.household })).toBeInTheDocument();
    expect(screen.getByText(pub.metro)).toBeInTheDocument();
    const facts = screen.getByRole('list', { name: t.card.factsLabel });
    expect(within(facts).getAllByRole('listitem')).toHaveLength(4);
    for (const g of pub.facts) {
      expect(within(facts).getByText(t.facts.groups[g.group])).toBeInTheDocument();
      for (const line of g.items) expect(within(facts).getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByText(t.card.quote(pub.caption))).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\$/);
    expect(screen.getByRole('button', { name: t.card.pick('A', pub.metro) })).toBeInTheDocument();
  });

  it('adds the hint’s neighborhood fact as its own row once open', () => {
    render(<DuelCard card={{ ...vm, hintFact: t.hintFacts.expensive }} onPick={() => {}} />);
    const facts = screen.getByRole('list', { name: t.card.factsLabel });
    expect(within(facts).getAllByRole('listitem')).toHaveLength(5);
    expect(within(facts).getByText(t.hintFacts.expensive)).toBeInTheDocument();
  });
});
