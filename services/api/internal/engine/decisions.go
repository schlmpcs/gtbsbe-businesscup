package engine

import (
	"math"
	"sort"
)

// RankMoves returns up to three independently evaluated level-one changes, sorted by ten-year effect.
func RankMoves(p Profile) ([]Move, error) {
	if e := ValidateProfile(p); e != nil {
		return nil, e
	}
	base, e := Forecast(p, ForecastOptions{})
	if e != nil {
		return nil, e
	}
	out := []Move{}
	add := func(m Move) {
		patched, err := ApplyPatch(p, m.Patch)
		if err != nil {
			return
		}
		f, err := Forecast(patched, ForecastOptions{})
		if err == nil {
			m.Effect10Y = f.In10Y.Mid - base.In10Y.Mid
			out = append(out, m)
		}
	}
	highest := -1
	for i, d := range p.Debts {
		if d.Kind == "card" && d.Balance > 0 && (highest < 0 || d.APR > p.Debts[highest].APR) {
			highest = i
		}
	}
	if highest >= 0 {
		extra := p.Debts[highest].ExtraPayment + math.Max(25, math.Min(200, math.Max(0, p.TakeHomePay.Value-spending(p))*.2))
		add(Move{ID: "payCardFirst", Kind: "payCardFirst", Level: 1, Patch: ProfilePatch{Debts: []DebtPatch{{ID: p.Debts[highest].ID, ExtraPayment: &extra}}}})
	}
	largest := "eatingOut"
	for _, c := range []string{"subscriptions", "other"} {
		if p.Spending[c].Value > p.Spending[largest].Value {
			largest = c
		}
	}
	if p.Spending[largest].Value > 0 {
		add(Move{ID: "cutCategory-" + largest, Kind: "cutCategory", Level: 1, Category: largest, Patch: ProfilePatch{Spending: map[string]float64{largest: p.Spending[largest].Value * .8}}})
	}
	if p.StatementUploaded && p.Spending["subscriptions"].Value > 0 {
		add(Move{ID: "cancelSubscriptions", Kind: "cancelSubscriptions", Level: 1, Category: "subscriptions", Patch: ProfilePatch{Spending: map[string]float64{"subscriptions": 0}}})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Effect10Y > out[j].Effect10Y })
	if len(out) > 3 {
		out = out[:3]
	}
	return out, nil
}
func affordabilityFailure(p Profile, states []monthState, delay int, card bool) string {
	for i := 1; i <= delay+12 && i < len(states); i++ {
		cushion := spending(p) * math.Pow(1+InflationAnnual, float64(i-1)/12)
		if states[i].cash+1e-8 < cushion {
			return "cushion"
		}
		if states[i].load > DebtLoadRed {
			return "debtLoad"
		}
	}
	if card && states[min(delay+12, len(states)-1)].card > 1e-8 {
		return "cardRevolves"
	}
	return ""
}

// CanAfford tests cash cushion, debt load and twelve-month card repayment, including delayed one-time purchases.
func CanAfford(p Profile, x Purchase) (AffordResult, error) {
	r := AffordResult{Verdict: "no", CheapestWay: "cash"}
	if e := ValidateProfile(p); e != nil {
		return r, e
	}
	if e := validatePurchase(x); e != nil {
		return r, e
	}
	mode, suppliedLoan, _ := purchaseMode(x)
	base, _ := Forecast(p, ForecastOptions{})
	with, _ := Forecast(p, ForecastOptions{Extra: []Purchase{x}})
	r.With = with
	r.Without = base
	baseline := simulate(p, 120, ForecastOptions{}, 0)
	r.BaselineFails = affordabilityFailure(p, baseline, 0, false) != ""
	states := simulate(p, 120, ForecastOptions{Extra: []Purchase{x}}, 0)
	r.FailsOn = affordabilityFailure(p, states, 0, mode == "card")
	if r.FailsOn == "" {
		r.Verdict = "fits"
	} else if x.Recurring == nil || x.Recurring == false {
		for delay := 1; delay <= 12; delay++ {
			delayed := simulate(p, 120, ForecastOptions{Extra: []Purchase{x}}, delay)
			if affordabilityFailure(p, delayed, delay, mode == "card") == "" {
				r.Verdict = "wait"
				r.WaitMonths = delay
				break
			}
		}
	}
	best := math.Inf(-1)
	for _, way := range []string{"cash", "card", "loan"} {
		candidate := x
		if way == "loan" {
			offer := LoanInput{Amount: x.Amount, APR: LoanAPRDefault, TermMonths: LoanTermDefault}
			if suppliedLoan != nil {
				offer = *suppliedLoan
			}
			candidate.PayWith = map[string]LoanInput{"loan": offer}
		} else {
			candidate.PayWith = way
		}
		f, err := Forecast(p, ForecastOptions{Extra: []Purchase{candidate}})
		if err == nil && f.In10Y.Mid > best {
			best = f.In10Y.Mid
			r.CheapestWay = way
		}
	}
	return r, nil
}

// Level2Unlocked reports whether a first move was completed or a committed move checked in.
// Higher-level moves still require new inputs and remain in the labeled mock path.
func Level2Unlocked(p Profile) bool {
	if len(p.DoneMoveIDs) > 0 {
		return true
	}
	for _, id := range p.CheckedInMoveIDs {
		if id == p.CommittedMoveID && id != "" {
			return true
		}
	}
	return false
}
