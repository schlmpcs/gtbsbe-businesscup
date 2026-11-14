// The debts Loan Lab pays off: the profile's debts plus the selected offer as one new debt. Shared by
// useLoanLab (its payoff order) and usePayoffPlanner, so both always run on the same list.
import type { Debt, LoanInput, Money } from '@lifeguessr/types';

/** Id of the selected offer when it is added to the payoff order as a new debt. */
export const NEW_LOAN_DEBT_ID = 'new-loan';

/** The selected offer, as far as the payoff needs it: its terms and the monthly payment the engine computed. */
export type PayoffOffer = { input: LoanInput; monthly: Money };

/** The profile's debts (copied) and, when there is a valid selected offer, that offer as a new personal loan. */
export function payoffDebts(profileDebts: readonly Debt[], offer: PayoffOffer | null): Debt[] {
  const debts: Debt[] = profileDebts.map((d) => ({ ...d, minPayment: { ...d.minPayment } }));
  if (offer) {
    const { amount, apr, downPayment = 0, fees = 0 } = offer.input;
    debts.push({
      id: NEW_LOAN_DEBT_ID,
      kind: 'personal',
      balance: Math.max(0, amount - downPayment + fees), // financed principal (LoanInput contract)
      apr,
      minPayment: { value: offer.monthly, isEstimate: false },
    });
  }
  return debts;
}
