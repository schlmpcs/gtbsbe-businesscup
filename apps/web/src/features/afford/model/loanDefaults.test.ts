import { describe, expect, it } from 'vitest';
import { loanKindOf } from './loanDefaults';

describe('loanKindOf', () => {
  it('a vehicle is an auto loan, whole words only; anything else is a personal loan', () => {
    for (const label of ['Car', 'used car', 'New SUV', 'Pickup truck', 'Motorcycle']) expect(loanKindOf(label), label).toBe('auto');
    for (const label of ['Carpet', 'Scarf', 'Couch', 'Trip', '', 'Caravan holiday']) expect(loanKindOf(label), label).toBe('personal');
  });
});
