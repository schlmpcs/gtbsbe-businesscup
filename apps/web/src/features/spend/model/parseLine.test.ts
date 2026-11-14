import { describe, expect, it } from 'vitest';
import { categoryOf, parseSpendLine } from './parseLine';

describe('parseSpendLine', () => {
  it.each([
    ['кофе 5', [{ category: 'eatingOut', amount: 5, label: 'кофе' }]],
    ['coffee 5.50', [{ category: 'eatingOut', amount: 5.5, label: 'coffee' }]],
    ['coffee 5,50', [{ category: 'eatingOut', amount: 5.5, label: 'coffee' }]],
    ['$18 uber', [{ category: 'other', amount: 18, label: 'uber' }]],
    ['18$ taxi', [{ category: 'other', amount: 18, label: 'taxi' }]],
    ['groceries 64, gas 40', [
      { category: 'groceries', amount: 64, label: 'groceries' },
      { category: 'car', amount: 40, label: 'gas' },
    ]],
    ['coffee 5, taxi 18, groceries 64', [
      { category: 'eatingOut', amount: 5, label: 'coffee' },
      { category: 'other', amount: 18, label: 'taxi' },
      { category: 'groceries', amount: 64, label: 'groceries' },
    ]],
    ['rent 1,200', [{ category: 'rentUtilities', amount: 1200, label: 'rent' }]],
    ['Uber Eats 23 dollars', [{ category: 'eatingOut', amount: 23, label: 'Uber Eats' }]],
    ['продукты 40 и бензин 30', [
      { category: 'groceries', amount: 40, label: 'продукты' },
      { category: 'car', amount: 30, label: 'бензин' },
    ]],
    ['lunch 15; netflix 15.49', [
      { category: 'eatingOut', amount: 15, label: 'lunch' },
      { category: 'subscriptions', amount: 15.49, label: 'netflix' },
    ]],
  ])('%s', (line, items) => {
    const r = parseSpendLine(line);
    expect(r.items).toEqual(items);
    expect(r.unresolved).toEqual([]);
  });

  it('a part without an amount, with two amounts, or with no known word is unresolved', () => {
    const r = parseSpendLine('coffee, taxi 18 20, zorbo 7, groceries 64');
    expect(r.items).toEqual([{ category: 'groceries', amount: 64, label: 'groceries' }]);
    expect(r.unresolved.map((p) => p.text)).toEqual(['coffee', 'taxi 18 20', 'zorbo 7']);
    expect(r.unresolved[0]).toMatchObject({ category: 'eatingOut' });
    expect(r.unresolved[0]!.amount).toBeUndefined();
    expect(r.unresolved[2]).toMatchObject({ amount: 7, label: 'zorbo' });
    expect(r.unresolved[2]!.category).toBeUndefined();
    expect(r.parts).toHaveLength(4);
  });

  it('a bare amount has no category; zero and absurd amounts are not amounts', () => {
    expect(parseSpendLine('$12').unresolved[0]).toEqual({ text: '$12', amount: 12 });
    expect(parseSpendLine('coffee 0').unresolved[0]!.amount).toBeUndefined();
    expect(parseSpendLine('coffee 1000000').unresolved[0]!.amount).toBeUndefined();
  });

  it('empty input reads as nothing', () => {
    expect(parseSpendLine('  ,  ')).toEqual({ items: [], parts: [], unresolved: [] });
  });
});

describe('categoryOf', () => {
  it('matches whole words, prefixes only where marked, phrases before words', () => {
    expect(categoryOf('bar')).toBe('eatingOut');
    expect(categoryOf('barber')).toBeUndefined();
    expect(categoryOf('продуктов')).toBe('groceries');
    expect(categoryOf('uber')).toBe('other');
    expect(categoryOf('uber eats')).toBe('eatingOut');
    expect(categoryOf('Coffee with Sam')).toBe('eatingOut');
  });
});
