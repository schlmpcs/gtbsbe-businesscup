// View-model of the add-account flow (MP11, #171): pick a type, then fill the form. The account goes to
// the Accounts store (MP8, lib/model/accounts.ts), which makes its id and its first history point.
import { useCallback, useMemo, useState } from 'react';
import { ACCOUNT_GROUPS, type AccountGroup } from '@lifeguessr/types';
import { useAccountsStore } from '@/lib/model/accounts';
import { useAccountsUiStore } from './accountsStore';
import { buildForm, emptyForm, formTitle, parseMoney, toFields, type FormState } from './addForm';
import { hasGrowthField, useGrowthAiField, type AiFill, type GrowthAiInput } from './growthAi';
import { kindOf } from './series';
import type { AddAccountFieldId, AddAccountVM } from './types';

const GROUPS = ACCOUNT_GROUPS.map((group) => ({ group, kind: kindOf(group) }));

/** `today` is accepted for symmetry with the other hooks; the store dates the first balance by the clock. */
export function useAddAccount(_options: { today?: string } = {}): AddAccountVM {
  const [group, setGroup] = useState<AccountGroup | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showErrors, setShowErrors] = useState(false);

  const fields = useMemo(() => (group === null ? [] : toFields(group, form, showErrors)), [group, form, showErrors]);

  // "Estimate with AI": sends this type, the name typed and the value; the rate fills the growth field.
  const name = form.values.name?.trim() ?? '';
  const value = parseMoney(form.values.balance ?? '');
  const aiInput: GrowthAiInput | null = useMemo(
    () => (hasGrowthField(group) && name !== '' && value !== null && Number.isFinite(value) && value >= 0 ? { group, name, value } : null),
    [group, name, value],
  );
  const fill = useCallback((f: AiFill) => setForm((prev) => ({ ...prev, values: { ...prev.values, growth: f.text }, aiGrowth: f })), []);
  const [growthAi, resetAi] = useGrowthAiField(aiInput, fill);

  const reset = useCallback(() => {
    setGroup(null);
    setForm(emptyForm());
    setShowErrors(false);
    resetAi();
  }, [resetAi]);

  const pickType = useCallback((next: AccountGroup) => {
    setGroup(next);
    setForm(emptyForm());
    setShowErrors(false);
    resetAi();
  }, [resetAi]);
  const setField = useCallback((id: AddAccountFieldId, value: string) => setForm((f) => ({ ...f, values: { ...f.values, [id]: value } })), []);
  // The store keeps a typed balance and minimum as measured: the "not sure" tag is not stored (MP11b blocked).
  const setEstimate = useCallback((id: AddAccountFieldId, isEstimate: boolean) => setForm((f) => ({ ...f, estimates: { ...f.estimates, [id]: isEstimate } })), []);

  const submit = useCallback((): string | null => {
    if (group === null) return null;
    const built = buildForm(group, form);
    const id = built === null ? null : useAccountsStore.getState().addAccount(built.form);
    if (built === null || id === null) {
      setShowErrors(true);
      return null;
    }
    if (built.growth !== null) {
      useAccountsStore.getState().updateAccount(id, { growth: built.growth, ...(built.growthNote && { growthNote: built.growthNote }) });
    }
    useAccountsUiStore.getState().setAdding(false);
    reset();
    return id;
  }, [group, form, reset]);

  const close = useCallback(() => {
    useAccountsUiStore.getState().setAdding(false);
    reset();
  }, [reset]);

  return {
    step: group === null ? 'pick-type' : 'form',
    groups: GROUPS,
    group,
    title: group === null ? null : formTitle(group),
    fields,
    growthAi: hasGrowthField(group) ? growthAi : null,
    pickType,
    setField,
    setEstimate,
    submit,
    back: reset,
    close,
  };
}
