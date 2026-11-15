// The "your numbers" form both partners fill in: their own profile from this app when they made
// one, else quick inputs. Returns the form view-model and `build()`, the partner + goal to send.
import { cardAprDefault, householdMonth } from '@lifeguessr/engine';
import { GoalSchema, TogetherNicknameSchema, type Goal, type TogetherPartner } from '@lifeguessr/types';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/state';
import { profilePartner, quickPartner } from './compute';
import type { PartnerFormVM, PartnerSource, QuickInputs } from './types';

export const EMPTY_QUICK: QuickInputs = {
  takeHomePay: null, rentUtilities: null, groceries: null, childcare: null, otherSpending: null,
  cash: null, retirement: null, debtBalance: null, debtApr: null, debtPayment: null,
};

/** The quick inputs past the first three (take-home pay, rent, groceries). */
const OPTIONAL_FIELDS = ['childcare', 'otherSpending', 'cash', 'retirement', 'debtBalance', 'debtApr', 'debtPayment'] as const;

export type PartnerFormState = {
  vm: PartnerFormVM;
  /** The partner and goal to send, or null while the form has a problem. */
  build: () => { partner: TogetherPartner; goal: Goal | null } | null;
};

export function usePartnerForm(initialGoal: Goal | null = null, initialNickname = ''): PartnerFormState {
  const profile = useAppStore((s) => s.profile);
  const origin = useAppStore((s) => s.profileOrigin);
  const hasProfile = origin === 'user';
  const [nickname, setNickname] = useState(initialNickname);
  const [chosen, setSource] = useState<PartnerSource | null>(null);
  const [quick, setQuickState] = useState<QuickInputs>(EMPTY_QUICK);
  const [touched, setTouched] = useState<{ nickname: boolean; takeHomePay: boolean; goal: boolean }>({
    nickname: false, takeHomePay: false, goal: false,
  });
  const [goal, setGoalState] = useState<{ target: number | null; years: number | null }>({
    target: initialGoal?.target ?? null,
    years: initialGoal?.years ?? null,
  });
  const source: PartnerSource = chosen ?? (hasProfile ? 'profile' : 'quick');

  const profileSummary = useMemo(() => {
    if (!hasProfile || source !== 'profile') return null;
    const m = householdMonth(profile);
    return { takeHomePay: m.takeHome, spending: m.spending, debts: profile.debts.filter((d) => d.balance > 0).length };
  }, [hasProfile, source, profile]);

  const goalValue: Goal | null | 'invalid' =
    goal.target === null && goal.years === null
      ? null
      : (() => {
          const parsed = GoalSchema.safeParse({ target: goal.target, years: goal.years });
          return parsed.success ? parsed.data : 'invalid';
        })();

  const nicknameOk = TogetherNicknameSchema.safeParse(nickname).success;
  const problem: PartnerFormVM['problem'] = !nicknameOk
    ? 'nickname'
    : source === 'quick' && !(quick.takeHomePay !== null && quick.takeHomePay > 0)
      ? 'takeHomePay'
      : goalValue === 'invalid'
        ? 'goal'
        : null;

  const vm: PartnerFormVM = {
    nickname,
    setNickname: (v) => {
      setNickname(v);
      setTouched((t) => ({ ...t, nickname: true }));
    },
    hasProfile,
    source,
    setSource: (s) => setSource(s === 'profile' && !hasProfile ? 'quick' : s),
    profileSummary,
    quick,
    setQuick: (field, value) => {
      setQuickState((q) => ({ ...q, [field]: value }));
      if (field === 'takeHomePay') setTouched((t) => ({ ...t, takeHomePay: true }));
    },
    defaultApr: { value: cardAprDefault.value, sourceName: cardAprDefault.source.name, year: cardAprDefault.source.year },
    goal,
    setGoal: (field, value) => {
      setGoalState((g) => ({ ...g, [field]: value }));
      setTouched((t) => ({ ...t, goal: true }));
    },
    problem,
    showProblem: problem !== null && touched[problem],
    filledOptional: OPTIONAL_FIELDS.filter((f) => quick[f] !== null).length,
  };

  const build = () => {
    if (problem !== null || goalValue === 'invalid') return null;
    const partner = source === 'profile' && hasProfile ? profilePartner(profile, nickname) : quickPartner(quick, nickname);
    return { partner, goal: goalValue };
  };

  return { vm, build };
}
