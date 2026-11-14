// JF9 (#141, the /afford part): a loan on S11 starts from typical terms for its kind, tagged estimate, so a
// verdict shows without typing. The values are the engine's named assumption (`loanTermsTypical`); this file
// only picks the kind from the purchase name and fills the fields the user has not typed.
import { loanTermsTypical, type LoanKind } from '@lifeguessr/engine';
import type { AffordFormVM } from './types';

/** Words that make a purchase a vehicle (an auto loan); anything else is a personal loan. */
const VEHICLE = /\b(car|cars|auto|automobile|truck|pickup|suv|vehicle|van|minivan|motorcycle|motorbike|jeep|sedan|ev)\b/i;

export function loanKindOf(label: string): LoanKind {
  return VEHICLE.test(label) ? 'auto' : 'personal';
}

/**
 * The form with every loan field the user has not typed set to the typical value for its kind. A field
 * counts as typed once `setLoan` changed it, or when the form came from a saved or parsed purchase.
 */
export function withTypicalLoan(form: AffordFormVM): AffordFormVM {
  const typical = form.loan.typical;
  if (!typical || (!typical.apr && !typical.termMonths)) return form;
  const terms = loanTermsTypical.value[loanKindOf(form.label)];
  return {
    ...form,
    loan: {
      ...form.loan,
      apr: typical.apr ? terms.apr : form.loan.apr,
      termMonths: typical.termMonths ? terms.termMonths : form.loan.termMonths,
    },
  };
}
