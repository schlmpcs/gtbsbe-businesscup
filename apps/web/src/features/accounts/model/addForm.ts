// Pure parts of the add-account form: which fields a type has, how typed text is read, and how a valid
// form becomes the store's `AccountForm` (lib/model/addAccount.ts). A blank minimum payment or APR is
// not filled in here: the engine's default is what the store keeps (`liabilityEstimates`).
import type { AccountGroup, Money, Rate } from '@lifeguessr/types';
import { DEFAULT_LOAN_KIND, isLiabilityGroup, LOAN_KINDS, type AccountForm, type LoanKind } from '@/lib/model/addAccount';
import type { AddAccountFieldId, AddAccountFieldVM } from './types';

export const DEBT_KINDS: LoanKind[] = [...LOAN_KINDS];
export const DEFAULT_DEBT_KIND: LoanKind = DEFAULT_LOAN_KIND;

type FieldSpec = Pick<AddAccountFieldVM, 'id' | 'input' | 'required' | 'canBeEstimate'>;

/** The fields of each account type, in display order. */
export function fieldSpecs(group: AccountGroup): FieldSpec[] {
  const name: FieldSpec = { id: 'name', input: 'text', required: true, canBeEstimate: false };
  const balance: FieldSpec = { id: 'balance', input: 'money', required: true, canBeEstimate: true };
  if (group === 'creditCard') {
    return [name, balance, { id: 'apr', input: 'percent', required: true, canBeEstimate: false }, { id: 'minPayment', input: 'money', required: false, canBeEstimate: true }];
  }
  if (group === 'loan' || group === 'mortgage') {
    return [
      name, balance,
      ...(group === 'loan' ? [{ id: 'debtKind', input: 'select', required: true, canBeEstimate: false } as FieldSpec] : []),
      { id: 'apr', input: 'percent', required: true, canBeEstimate: false },
      { id: 'minPayment', input: 'money', required: true, canBeEstimate: true },
    ];
  }
  if (group === 'cash') return [name, balance];
  return [name, balance, { id: 'growth', input: 'percent', required: false, canBeEstimate: false }];
}

/** '$1,250.50' → 1250.5; blank → null; anything else → NaN. */
export function parseMoney(text: string): Money | null {
  const t = text.replace(/[$,\s]/g, '');
  if (t === '') return null;
  return /^-?\d*\.?\d+$|^-?\d+\.$/.test(t) ? Number(t) : Number.NaN;
}

/** '22.8' or '22.8%' (percent) → 0.228 (per year); blank → null; anything else → NaN. Negative is allowed (a car loses value). */
export function parsePercent(text: string): Rate | null {
  const t = text.replace(/[%\s]/g, '');
  if (t === '') return null;
  return /^-?\d*\.?\d+$|^-?\d+\.$/.test(t) ? Number(t) / 100 : Number.NaN;
}

export type FormState = { values: Partial<Record<AddAccountFieldId, string>>; estimates: Partial<Record<AddAccountFieldId, boolean>> };

export const emptyForm = (): FormState => ({ values: {}, estimates: {} });

const valueOf = (f: FormState, id: AddAccountFieldId): string => f.values[id] ?? (id === 'debtKind' ? DEFAULT_DEBT_KIND : '');

/** The fields as the UI shows them; `showErrors` is true after a failed submit. */
export function toFields(group: AccountGroup, form: FormState, showErrors: boolean): AddAccountFieldVM[] {
  return fieldSpecs(group).map((spec): AddAccountFieldVM => {
    const value = valueOf(form, spec.id);
    const blank = value.trim() === '';
    // A card's minimum payment left blank is filled in from its balance and APR (an estimate).
    const defaulted = spec.id === 'minPayment' && group === 'creditCard' && blank;
    let error: AddAccountFieldVM['error'] = null;
    if (showErrors) {
      if (blank && spec.required) error = 'required';
      else if (!blank && spec.input === 'money' && !((parseMoney(value) ?? Number.NaN) >= 0)) error = 'invalid';
      else if (!blank && spec.input === 'percent' && Number.isNaN(parsePercent(value))) error = 'invalid';
    }
    return {
      ...spec,
      labelKey: spec.id,
      value,
      isEstimate: defaulted || form.estimates[spec.id] === true,
      defaulted,
      error,
      ...(spec.id === 'debtKind' ? { options: DEBT_KINDS } : {}),
    };
  });
}

/** The form the store adds an account from, and the growth rate to set on it (assets only), or null when a field is invalid. */
export function buildForm(group: AccountGroup, form: FormState): { form: AccountForm; growth: Rate | null } | null {
  const fields = toFields(group, form, true);
  if (fields.some((f) => f.error !== null)) return null;
  const balance = parseMoney(valueOf(form, 'balance')) as Money;
  const out: AccountForm = { group, name: valueOf(form, 'name').trim(), balance };
  if (!isLiabilityGroup(group)) return { form: out, growth: parsePercent(valueOf(form, 'growth')) };
  const apr = parsePercent(valueOf(form, 'apr')) as Rate;
  out.apr = { value: apr, isEstimate: false };
  if (group === 'loan') out.debtKind = valueOf(form, 'debtKind') as LoanKind;
  // A typed minimum is the person's number (measured); a blank one is left to the engine's default.
  const given = parseMoney(valueOf(form, 'minPayment'));
  if (given !== null) out.minPayment = { value: given, isEstimate: false };
  return { form: out, growth: null };
}
