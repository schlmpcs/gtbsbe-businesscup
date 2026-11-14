// The debt list the payoff planner and Loan Lab's payoff order both run on: the profile's debts plus the
// selected offer as one new debt. Expected values are worked out from the demo profile and the sample offers.
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, loanOffersSample } from '@/fixtures';
import { NEW_LOAN_DEBT_ID, payoffDebts } from './payoffDebts';

describe('payoffDebts', () => {
  it('adds the selected offer as a personal loan financed at amount - down payment + fees', () => {
    const profile = cloneProfileDemo();
    // Offer 2 of the sample: $28,000 with $3,000 down and $495 fees rolled in: 28,000 - 3,000 + 495 = 25,495.
    const offer = loanOffersSample[1]!;
    const debts = payoffDebts(profile.debts, { input: offer, monthly: 520.1 });
    expect(debts.map((d) => d.id)).toEqual(['card-1', 'auto-1', NEW_LOAN_DEBT_ID]);
    expect(debts[2]).toEqual({
      id: NEW_LOAN_DEBT_ID,
      kind: 'personal',
      balance: 25495,
      apr: 0.0549,
      minPayment: { value: 520.1, isEstimate: false },
    });
  });

  it('is only the profile debts without an offer (offer removed or invalid)', () => {
    const profile = cloneProfileDemo();
    const debts = payoffDebts(profile.debts, null);
    expect(debts).toEqual(profile.debts);
    expect(debts.map((d) => d.balance)).toEqual([6400, 17800]); // card $6,400, auto $17,800
  });

  it('never makes a negative balance (fees cannot offset a down payment past the amount)', () => {
    // amount 1,000 - down 1,000 + fees 0 = 0, not below.
    const debts = payoffDebts([], { input: { amount: 1000, apr: 0.05, termMonths: 12, downPayment: 1000 }, monthly: 0 });
    expect(debts[0]!.balance).toBe(0);
  });

  it('copies the profile debts: changing the list leaves the profile alone', () => {
    const profile = cloneProfileDemo();
    const debts = payoffDebts(profile.debts, null);
    debts[0]!.balance = 1;
    debts[0]!.minPayment.value = 1;
    expect(profile.debts[0]!.balance).toBe(6400);
    expect(profile.debts[0]!.minPayment.value).toBe(193.92);
  });
});
