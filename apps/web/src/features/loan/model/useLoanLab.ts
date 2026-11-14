// S12 Loan Lab: compare up to 3 offers (engine compareLoans), the debt-load gauge, and an
// extra-payment slider on the selected offer (engine loan). Starts from the fixture offers.
import { compareLoans, loan } from '@lifeguessr/engine';
import { LoanInputSchema, type LoanInput, type Money } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { loanOffersSample } from '@/fixtures';
import { runEngine } from '@/lib/model/errors';
import { debtLoadGauge } from '@/lib/model/profile';
import { linearSliderVM, snap } from '@/lib/model/slider';
import { useParseConfirm, type ParseFn } from '@/lib/model/useParseConfirm';
import { useAppReady, useAppStore } from '@/state';
import type { LoanLabVM, LoanOfferVM } from './types';

export const MAX_OFFERS = 3;
/** Extra-payment slider: $0 to max(EXTRA_MAX_FLOOR, the selected offer's monthly payment), $25 steps. */
export const EXTRA_MAX_FLOOR: Money = 500;
export const EXTRA_STEP: Money = 25;

type Offer = { id: string; input: LoanInput };

let offerSeq = 0;
const newOfferId = () => `offer-${++offerSeq}`;

function invalidFieldsOf(input: LoanInput): string[] {
  const r = LoanInputSchema.safeParse(input);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join('.')))];
}

export function useLoanLab(opts: { parse?: ParseFn; initialOffers?: readonly LoanInput[] } = {}): LoanLabVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const [offers, setOffers] = useState<Offer[]>(() =>
    (opts.initialOffers ?? loanOffersSample).slice(0, MAX_OFFERS).map((o) => ({ id: newOfferId(), input: { ...o } })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => offers[0]?.id ?? null);
  const [extraPayment, setExtra] = useState<Money>(0);

  const offerVMs: LoanOfferVM[] = useMemo(() => {
    const checked = offers.map((o) => ({ offer: o, invalid: invalidFieldsOf(o.input) }));
    const validInputs = checked.filter((c) => c.invalid.length === 0).map((c) => c.offer.input);
    const compared = runEngine(() => compareLoans(profile, validInputs));
    let k = 0;
    const rows = checked.map(({ offer, invalid }) => {
      if (invalid.length > 0) return { offer, invalid, result: null, error: null };
      const i = k++;
      return compared.status === 'ready'
        ? { offer, invalid, result: compared.data[i] ?? null, error: null }
        : { offer, invalid, result: null, error: compared.status === 'error' ? compared.error : null };
    });
    const valid = rows.filter((r) => r.result !== null).map((r) => r.result!);
    const minCost = Math.min(...valid.map((r) => r.totalCost));
    const minMonthly = Math.min(...valid.map((r) => r.monthly));
    return rows.map(({ offer, invalid, result, error }) => ({
      id: offer.id,
      input: offer.input,
      result,
      invalidFields: invalid,
      error,
      isLowestCost: result !== null && valid.length > 1 && result.totalCost === minCost,
      isLowestMonthly: result !== null && valid.length > 1 && result.monthly === minMonthly,
      debtLoadAfter: result ? debtLoadGauge(result.debtLoadAfter) : null,
    }));
  }, [offers, profile]);

  const selected = offerVMs.find((o) => o.id === selectedId) ?? null;

  const before = useMemo(() => {
    // The debt load before any new loan: the engine's loan() reports it for any input.
    const probe = runEngine(() => loan(profile, { amount: 0, apr: 0, termMonths: 1 }).debtLoadBefore);
    return debtLoadGauge(probe.status === 'ready' ? probe.data : Number.NaN);
  }, [profile]);

  const extra = useMemo(() => {
    if (!selected?.result) return null;
    const base = selected.result;
    const max = Math.max(EXTRA_MAX_FLOOR, Math.ceil(base.monthly / EXTRA_STEP) * EXTRA_STEP);
    const value = snap(extraPayment, 0, max, EXTRA_STEP);
    const withExtra = value > 0 ? runEngine(() => loan(profile, { ...selected.input, extraPayment: value })) : null;
    const r = withExtra?.status === 'ready' ? withExtra.data : base;
    return {
      ...linearSliderVM(value, 0, max, EXTRA_STEP),
      payoffMonth: r.payoffMonth,
      totalInterest: r.totalInterest,
      basePayoffMonth: base.payoffMonth,
      baseTotalInterest: base.totalInterest,
      interestSaved: base.totalInterest - r.totalInterest,
      monthsSaved: base.payoffMonth !== null && r.payoffMonth !== null ? base.payoffMonth - r.payoffMonth : null,
    };
  }, [selected, extraPayment, profile]);

  const addOffer = useCallback(
    (input?: LoanInput) => {
      if (offers.length >= MAX_OFFERS) return null;
      const base = input ?? offers[offers.length - 1]?.input ?? loanOffersSample[0]!;
      const id = newOfferId();
      setOffers((os) => (os.length >= MAX_OFFERS ? os : [...os, { id, input: { ...base } }]));
      setSelectedId(id);
      return id;
    },
    [offers],
  );

  const updateOffer = useCallback((id: string, patch: Partial<LoanInput>) => {
    setOffers((os) => os.map((o) => (o.id === id ? { ...o, input: { ...o.input, ...patch } } : o)));
  }, []);

  const removeOffer = useCallback(
    (id: string) => {
      const rest = offers.filter((o) => o.id !== id);
      setOffers(rest);
      if (selectedId === id) setSelectedId(rest[0]?.id ?? null);
    },
    [offers, selectedId],
  );

  const parse = useParseConfirm(
    'loan',
    (input: LoanInput) => {
      if (offers.length < MAX_OFFERS) addOffer(input);
      else if (selectedId) updateOffer(selectedId, { ...input });
    },
    { parse: opts.parse },
  );

  return {
    status: ready ? 'ready' : 'loading',
    offers: offerVMs,
    canAddOffer: offers.length < MAX_OFFERS,
    addOffer,
    updateOffer,
    removeOffer,
    selectedOfferId: selected?.id ?? null,
    selectOffer: setSelectedId,
    gauge: {
      before,
      after: selected?.debtLoadAfter ?? null,
      isEstimate: profile.takeHomePay.isEstimate || profile.debts.some((d) => d.minPayment.isEstimate),
    },
    extra,
    setExtraPayment: setExtra,
    parse,
  };
}
