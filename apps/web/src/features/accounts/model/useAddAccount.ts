// View-model of the add-account flow (MP11, #171): pick a type, then fill the form. Fixture-backed:
// the new account goes to the in-memory store (./accountsStore.ts). MP11b: the real accounts store (MP8).
import { useCallback, useMemo, useState } from 'react';
import { ACCOUNT_GROUPS, type AccountGroup } from '@lifeguessr/types';
import { usEasternDate } from '@/lib/dates';
import { useAccountsStore } from './accountsStore';
import { buildAccount, emptyForm, toFields, type FormState } from './addForm';
import { kindOf } from './series';
import type { AddAccountFieldId, AddAccountVM } from './types';

const GROUPS = ACCOUNT_GROUPS.map((group) => ({ group, kind: kindOf(group) }));

export function useAddAccount({ today }: { today?: string } = {}): AddAccountVM {
  const [group, setGroup] = useState<AccountGroup | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showErrors, setShowErrors] = useState(false);
  const month = (today ?? usEasternDate()).slice(0, 7);

  const fields = useMemo(() => (group === null ? [] : toFields(group, form, showErrors)), [group, form, showErrors]);

  const reset = useCallback(() => {
    setGroup(null);
    setForm(emptyForm());
    setShowErrors(false);
  }, []);

  const pickType = useCallback((next: AccountGroup) => {
    setGroup(next);
    setForm(emptyForm());
    setShowErrors(false);
  }, []);
  const setField = useCallback((id: AddAccountFieldId, value: string) => setForm((f) => ({ ...f, values: { ...f.values, [id]: value } })), []);
  const setEstimate = useCallback((id: AddAccountFieldId, isEstimate: boolean) => setForm((f) => ({ ...f, estimates: { ...f.estimates, [id]: isEstimate } })), []);

  const submit = useCallback((): string | null => {
    if (group === null) return null;
    const account = buildAccount(group, form, month);
    if (account === null) {
      setShowErrors(true);
      return null;
    }
    const id = useAccountsStore.getState().addAccount(account);
    useAccountsStore.getState().setAdding(false);
    reset();
    return id;
  }, [group, form, month, reset]);

  const close = useCallback(() => {
    useAccountsStore.getState().setAdding(false);
    reset();
  }, [reset]);

  return { step: group === null ? 'pick-type' : 'form', groups: GROUPS, group, fields, pickType, setField, setEstimate, submit, back: reset, close };
}
