// The app's client state (Zustand), persisted to localStorage: the Profile, where it came from,
// the user's own guess, statement history (category totals only), the wishlist, the committed
// Next Move and the forecast horizon picked on S10. The anonymous id lives separately (./anonId).
//
// Persistence uses `skipHydration`: the server render and the first client render both see the
// defaults, then `useHydrated()` (./hydration) loads the saved state, so React never sees a
// hydration mismatch. Screen hooks report `status: 'loading'` until then.
import { applyPatch } from '@lifeguessr/engine';
import {
  CategoryTotalsSchema, HorizonYearsSchema, MOVE_KINDS, ProfilePatchSchema, ProfileSchema, PurchaseSchema, CostCategorySchema,
  type CategoryTotals, type CostCategory, type HorizonYears, type Money, type Move, type Profile, type ProfilePatch,
  type Purchase,
} from '@lifeguessr/types';
import { z } from 'zod';
import { GoalSchema, type Goal } from '@lifeguessr/types';
import { ToolsStateSchema, type ToolsState } from '@lifeguessr/types';
import { restoreTools } from './tools';
import type { DailyEntry, SpendItem } from '@lifeguessr/types';
import { appendEntries, restoreDailyEntries, withoutEntries } from './daily';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cloneProfileDemo } from '@/fixtures';
import { safeStateStorage } from '@/lib/safeStorage';
import {
  addDebt, applyUserPatch, mergeStatementHistory, mergeStatementTotals, removeDebt, setField, setSpending,
  setSubscriptionsLine, skipField, updateDebt, type DebtInput, type ProfileField,
} from './profileOps';

/** demo = the sample profile (nothing entered yet); closestLife = built from a life card; user = edited. */
export type ProfileOrigin = 'demo' | 'closestLife' | 'user';

export type WishlistItem = { id: string; purchase: Purchase; addedAt: string /* ISO timestamp */ };

export type AppData = {
  goal: Goal | null;
  tools: ToolsState;
  profile: Profile;
  profileOrigin: ProfileOrigin;
  /** S5: the user's guess of their own monthly cost (null until they guess). */
  selfGuess: Money | null;
  /** S6: the life card the profile was built from. */
  closestCardId: string | null;
  /** Uploaded statement months (category totals only, `oneOffs` emptied), oldest first. Feeds monthEnd. */
  statementMonths: CategoryTotals[];
  /** A statement upload found subscription charges (enables the cancelSubscriptions move). */
  subscriptionsDetected: boolean;
  wishlist: WishlistItem[];
  /** The Next Move the user committed to (its id is also `profile.committedMoveId`). */
  committedMove: Move | null;
  /**
   * The year S1 and S10 show the forecast and the move gains at (picked on S10). Client state only: it
   * is not part of the Profile and never reaches the forecast request.
   */
  horizonYears: HorizonYears;
  /**
   * The user asked to look around with the sample life ("Try with sample data", /future?sample=1).
   * The profile is then the demo fixture (profile.demo.json). It counts as active only while the
   * profile is still the demo one (`isSampleActive`): any edit makes the life the user's own.
   */
  isSample: boolean;
  /** The daily spending log (/spend, Home quick-add), oldest first. Browser only, never synced. */
  dailyEntries: DailyEntry[];
};

export type AppActions = {
  setGoal: (goal:Goal) => void;
  clearGoal: () => void;
  setTool: <K extends keyof ToolsState>(key: K, value: ToolsState[K]) => void;
  clearTool: (key: keyof ToolsState) => void;
  /** Replace the whole profile (e.g. restored from the server session). */
  setProfile: (profile: Profile, origin: ProfileOrigin) => void;
  setSelfGuess: (guess: Money) => void;
  /** S6: start from a life card's profile (`cardToProfile`). Drops any committed move. */
  chooseClosestLife: (cardId: string, profile: Profile) => void;
  setSpending: (category: CostCategory, value: Money) => void;
  setField: (field: ProfileField, value: number) => void;
  skipField: (field: ProfileField) => void;
  addDebt: (input: DebtInput) => string;
  updateDebt: (id: string, input: DebtInput) => void;
  removeDebt: (id: string) => void;
  /** A patch the user confirmed (parsed from their own words): patched fields become measured. */
  applyUserPatch: (patch: ProfilePatch) => void;
  /** S9 seam: statement category totals → measured spending (+ pay) and month history. */
  applyStatementTotals: (months: CategoryTotals[]) => void;
  /**
   * M5 seam: the subscription audit's monthly total becomes the subscriptions line (measured only when it
   * comes from a statement, else an estimate) and the cancelSubscriptions move is offered (detected = true).
   */
  applySubscriptionsAudit: (monthly: Money, measuredFromStatement: boolean) => void;
  addToWishlist: (purchase: Purchase) => string;
  removeFromWishlist: (id: string) => void;
  commitMove: (move: Move) => void;
  uncommitMove: () => void;
  /** The user did a move: its patch enters the profile and it joins doneMoveIds. */
  markMoveDone: (move: Move) => void;
  setHorizonYears: (years: HorizonYears) => void;
  /**
   * Look around with the sample life: the demo fixture becomes the profile, flagged `isSample`. Only
   * when the user has no profile of their own (origin 'demo'); returns whether it was loaded.
   */
  loadSample: () => boolean;
  /** Stop showing the sample life as such ("Use mine"); the profile is left as it is. */
  clearSample: () => void;
  /** Log purchases on `date` ('YYYY-MM-DD', local); returns the new entry ids (for undo). */
  addDailyEntries: (items: SpendItem[], date: string) => string[];
  /** Remove log entries (undo of an add, or a delete). */
  removeDailyEntries: (ids: string[]) => void;
  /** Back to the demo profile and empty lists (keeps the anonymous id). */
  reset: () => void;
};

export type AppState = AppData & AppActions;

export const APP_STORE_KEY = 'lifeguessr.app';

export function initialAppData(): AppData {
  return {
    goal: null,
    tools: {},
    profile: cloneProfileDemo(),
    profileOrigin: 'demo',
    selfGuess: null,
    closestCardId: null,
    statementMonths: [],
    subscriptionsDetected: false,
    wishlist: [],
    committedMove: null,
    horizonYears: 10,
    isSample: false,
    dailyEntries: [],
  };
}

/** The sample life is on screen: loaded on request and not yet replaced by the user's own numbers. */
export function isSampleActive(s: Pick<AppData, 'isSample' | 'profileOrigin'>): boolean {
  return s.isSample && s.profileOrigin === 'demo';
}

function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const MoveSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(MOVE_KINDS),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  category: CostCategorySchema.optional(),
  effect10y: z.number(),
  patch: ProfilePatchSchema,
});

const WishlistItemSchema = z.object({ id: z.string().min(1), purchase: PurchaseSchema, addedAt: z.string() });

/** Saved state is validated field by field; a field that fails keeps its default. */
const persistedFields = {
  goal: GoalSchema.nullable(),
  tools: z.unknown().transform(restoreTools),
  profile: ProfileSchema,
  profileOrigin: z.enum(['demo', 'closestLife', 'user']),
  selfGuess: z.number().positive().nullable(),
  closestCardId: z.string().nullable(),
  statementMonths: z.array(CategoryTotalsSchema),
  subscriptionsDetected: z.boolean(),
  wishlist: z.array(WishlistItemSchema),
  committedMove: MoveSchema.nullable(),
  horizonYears: HorizonYearsSchema,
  isSample: z.boolean(),
  dailyEntries: z.unknown().transform(restoreDailyEntries),
} satisfies { [K in keyof AppData]: z.ZodType };

/** No real household spends this much a month in one category; above it the saved data is broken. */
export const MONTHLY_SPENDING_SANITY_CAP = 1_000_000;

function hasAbsurdSpending(profile: AppState['profile']): boolean {
  return Object.values(profile.spending).some((e) => !Number.isFinite(e.value) || e.value > MONTHLY_SPENDING_SANITY_CAP);
}

function mergePersisted(saved: unknown, current: AppState): AppState {
  if (!saved || typeof saved !== 'object') return current;
  const next = { ...current } as Record<string, unknown>;
  for (const [key, schema] of Object.entries(persistedFields)) {
    const parsed = (schema as z.ZodType).safeParse((saved as Record<string, unknown>)[key]);
    if (!parsed.success) continue;
    // A saved profile with an absurd monthly amount (left by the old runaway slider) is dropped.
    if (key === 'profile' && hasAbsurdSpending(parsed.data as AppState['profile'])) continue;
    next[key] = parsed.data;
  }
  return next as AppState;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialAppData(),

      setProfile: (profile, origin) => set({ profile, profileOrigin: origin }),
      setSelfGuess: (guess) => set({ selfGuess: guess }),
      chooseClosestLife: (cardId, profile) =>
        set({ profile, profileOrigin: 'closestLife', closestCardId: cardId, committedMove: null }),
      setSpending: (category, value) => set((s) => ({ profile: setSpending(s.profile, category, value), profileOrigin: 'user' })),
      setField: (field, value) => set((s) => ({ profile: setField(s.profile, field, value), profileOrigin: 'user' })),
      skipField: (field) => set((s) => ({ profile: skipField(s.profile, field) })),
      addDebt: (input) => {
        const { profile, id } = addDebt(get().profile, input);
        set({ profile, profileOrigin: 'user' });
        return id;
      },
      updateDebt: (id, input) => set((s) => ({ profile: updateDebt(s.profile, id, input), profileOrigin: 'user' })),
      removeDebt: (id) => set((s) => ({ profile: removeDebt(s.profile, id), profileOrigin: 'user' })),
      applyUserPatch: (patch) => set((s) => ({ profile: applyUserPatch(s.profile, patch), profileOrigin: 'user' })),
      applyStatementTotals: (months) =>
        set((s) => {
          // Only category totals are kept (CLAUDE.md → Privacy): one-off labels are dropped.
          const totalsOnly = months.map((m): CategoryTotals => ({ ...m, oneOffs: [] }));
          const statementMonths = mergeStatementHistory(s.statementMonths, totalsOnly);
          return {
            statementMonths,
            subscriptionsDetected: statementMonths.some((m) => (m.totals.subscriptions ?? 0) > 0),
            profile: mergeStatementTotals(s.profile, statementMonths),
            profileOrigin: 'user',
          };
        }),
      applySubscriptionsAudit: (monthly, measuredFromStatement) =>
        set((s) => ({
          profile: setSubscriptionsLine(s.profile, monthly, measuredFromStatement),
          profileOrigin: 'user',
          subscriptionsDetected: true,
        })),
      addToWishlist: (purchase) => {
        const id = newId();
        set((s) => ({ wishlist: [...s.wishlist, { id, purchase, addedAt: new Date().toISOString() }] }));
        return id;
      },
      removeFromWishlist: (id) => set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) })),
      commitMove: (move) => set((s) => ({ committedMove: move, profile: { ...s.profile, committedMoveId: move.id } })),
      uncommitMove: () =>
        set((s) => {
          const profile = { ...s.profile };
          delete profile.committedMoveId;
          return { committedMove: null, profile };
        }),
      markMoveDone: (move) =>
        set((s) => {
          const patched = applyPatch(s.profile, move.patch);
          const doneMoveIds = patched.doneMoveIds.includes(move.id) ? patched.doneMoveIds : [...patched.doneMoveIds, move.id];
          const profile: Profile = { ...patched, doneMoveIds };
          if (profile.committedMoveId !== move.id) return { profile };
          delete profile.committedMoveId;
          return { profile, committedMove: null };
        }),
      setHorizonYears: (years) => set({ horizonYears: HorizonYearsSchema.parse(years) }),
      loadSample: () => {
        if (get().profileOrigin !== 'demo') return false;
        set({ profile: cloneProfileDemo(), profileOrigin: 'demo', committedMove: null, isSample: true });
        return true;
      },
      clearSample: () => set({ isSample: false }),
      setGoal: goal => set({goal:GoalSchema.parse(goal)}),
      clearGoal: () => set({goal:null}),
      setTool: (key,value) => set(s=>({tools:{...s.tools,[key]:ToolsStateSchema.shape[key].parse(value)}})),
      clearTool: key => set(s=>{const tools={...s.tools};delete tools[key];return {tools};}),
      addDailyEntries: (items, date) => {
        const { entries, added } = appendEntries(get().dailyEntries, items, date, newId);
        set({ dailyEntries: entries });
        return added.map((e) => e.id);
      },
      removeDailyEntries: (ids) => set((s) => ({ dailyEntries: withoutEntries(s.dailyEntries, ids) })),
      reset: () => set(initialAppData()),
    }),
    {
      name: APP_STORE_KEY,
      // v2: + dailyEntries. A v1 save has none; merge then keeps the default (an empty log).
      version: 2,
      migrate: (saved) => saved as AppState,
      storage: createJSONStorage(() => safeStateStorage),
      skipHydration: true,
      partialize: (s): AppData => ({
        goal: s.goal,
        tools: s.tools,
        profile: s.profile,
        profileOrigin: s.profileOrigin,
        selfGuess: s.selfGuess,
        closestCardId: s.closestCardId,
        statementMonths: s.statementMonths,
        subscriptionsDetected: s.subscriptionsDetected,
        wishlist: s.wishlist,
        committedMove: s.committedMove,
        horizonYears: s.horizonYears,
        isSample: s.isSample,
        dailyEntries: s.dailyEntries,
      }),
      merge: mergePersisted,
    },
  ),
);
