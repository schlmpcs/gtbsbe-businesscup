// View-model types for "Together" (/together, /together/<id>): a couple's shared plan via a link.
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hooks: useTogetherStart() (./useTogetherStart.ts) and useTogetherPlan(id) (./useTogetherPlan.ts).
import type { GoalVerdict, Money } from '@lifeguessr/types';
import type { VMError } from '@/lib/model/types';

export type { VMError } from '@/lib/model/types';
export type { Goal, GoalVerdict, Money } from '@lifeguessr/types';

/** Which partner this browser is in a plan: the one who created it, or the one who opened the link. */
export type TogetherRole = 'partner1' | 'partner2';

/** The quick inputs (monthly amounts and balances in dollars; null = left blank). */
export type QuickInputs = {
  takeHomePay: Money | null;
  rentUtilities: Money | null;
  groceries: Money | null;
  childcare: Money | null;
  /** Everything else they spend in a month (car, eating out, subscriptions, other). */
  otherSpending: Money | null;
  cash: Money | null;
  retirement: Money | null;
  debtBalance: Money | null;
  /** Decimal per year; null = our default card APR (shown with an estimate tag). */
  debtApr: number | null;
  /** Monthly; null = the typical card minimum for that balance (estimate). */
  debtPayment: Money | null;
};
export type QuickField = keyof QuickInputs;

/** Where this partner's numbers come from: the profile they made in this app, or the quick inputs. */
export type PartnerSource = 'profile' | 'quick';

/** The "your numbers" form: partner 1 on /together, partner 2 on the link. */
export type PartnerFormVM = {
  nickname: string;
  setNickname: (v: string) => void;
  /** True when this browser holds a profile the person made themselves (not the demo). */
  hasProfile: boolean;
  source: PartnerSource;
  setSource: (s: PartnerSource) => void;
  /** Their profile's take-home pay and spending, shown when source = 'profile' (null otherwise). */
  profileSummary: { takeHomePay: Money; spending: Money; debts: number } | null;
  quick: QuickInputs;
  setQuick: (field: QuickField, value: number | null) => void;
  /** The default APR used when debtApr is blank (decimal per year), with where it comes from. */
  defaultApr: { value: number; sourceName: string; year: number };
  /** Optional shared goal (today's dollars). */
  goal: { target: Money | null; years: number | null };
  setGoal: (field: 'target' | 'years', value: number | null) => void;
  /** What is missing or wrong, if anything; the submit button is off while it is set. */
  problem: 'takeHomePay' | 'nickname' | 'goal' | null;
  /** The problem to show next to its field: as `problem`, but a blank take-home pay is not an error until they typed there. */
  problemShown: 'takeHomePay' | 'nickname' | 'goal' | null;
  /** Fill the quick inputs with example numbers (null when this browser has the person's own profile). */
  fillExample: (() => void) | null;
};

/** One partner's month, as both partners see it (only totals, never categories or debts one by one). */
export type PartnerTotalsVM = { label: string | null; takeHome: Money; spending: Money; debtPayments: Money };

export type TogetherResultVM = {
  partners: [PartnerTotalsVM, PartnerTotalsVM];
  month: { takeHome: Money; spending: Money; debtPayments: Money; surplus: Money; isEstimate: boolean };
  split: {
    total: Money;
    byCategory: { rentUtilities: Money; groceries: Money; childcare: Money };
    /** By income: what each pays, and partner 1's share (0–1). */
    p1: Money;
    p2: Money;
    p1Share: number;
    basis: 'income' | 'even';
    evenEach: Money;
    /** How much more (+) or less (−) partner 1 pays by income than 50/50. */
    p1VsEven: Money;
    isEstimate: boolean;
  };
  /** "Us in 10 years": rules-based forecast of the combined household, today's dollars. */
  future: { today: Money; low: Money; mid: Money; high: Money; isEstimate: boolean; source: 'rules' };
  goal: { target: Money; years: number; verdict: GoalVerdict; projectedMid: Money; gap: Money; progress: number } | null;
};

export type ShareVM = {
  url: string;
  copy: () => void;
  /** Web Share, when the browser has it. */
  share: (() => void) | null;
  copied: boolean;
};

/** /together: partner 1 starts a plan. */
export type TogetherStartVM = {
  ready: boolean;
  form: PartnerFormVM;
  create: () => void;
  creating: boolean;
  error: VMError | null;
  /** 'api' = the plan is saved on the server for 30 days; 'fixtures' = kept in this browser and the link itself. */
  storage: 'api' | 'fixtures';
};

/** /together/<id>. */
export type TogetherPlanVM =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; error: VMError; retry: () => void }
  | {
      status: 'ready';
      role: TogetherRole;
      storage: 'api' | 'fixtures';
      names: { p1: string | null; p2: string | null };
      /** The day the link stops working, ready to show ("December 14, 2026"). */
      expiresOn: string;
      share: ShareVM;
      /** Partner 2 has not added their numbers yet. */
      waiting: boolean;
      /** Partner 1 waiting: look again for partner 2's numbers (api mode). */
      refresh: (() => void) | null;
      /** The form, when this browser is partner 2 and is adding or editing their numbers. */
      form: PartnerFormVM | null;
      submit: () => void;
      submitting: boolean;
      submitError: VMError | null;
      /** Partner 2 re-opens their form. */
      editMine: (() => void) | null;
      cancelEdit: (() => void) | null;
      result: TogetherResultVM | null;
      resultError: VMError | null;
    };
