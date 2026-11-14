package engine

import (
	"fmt"
	"math"
)

func cloneProfile(p Profile) Profile {
	p.Debts = append([]Debt(nil), p.Debts...)
	s := map[string]Estimate{}
	for k, v := range p.Spending {
		s[k] = v
	}
	p.Spending = s
	p.DoneMoveIDs = append([]string(nil), p.DoneMoveIDs...)
	return p
}
func spending(p Profile) float64 {
	v := 0.0
	for _, c := range Categories {
		if c != "debtPayments" {
			v += p.Spending[c].Value
		}
	}
	return v
}

type monthState struct{ net, cash, load, card float64 }

func shifted(p Profile, direction float64) Profile {
	p = cloneProfile(p)
	shift := func(e Estimate, favorable float64) Estimate {
		if e.IsEstimate {
			e.Value *= 1 + direction*favorable*EstimateSpread
		}
		return e
	}
	p.TakeHomePay = shift(p.TakeHomePay, 1)
	p.Cash = shift(p.Cash, 1)
	p.Retirement = shift(p.Retirement, 1)
	p.RetirementShare = shift(p.RetirementShare, 1)
	p.RetirementShare.Value = math.Min(1, p.RetirementShare.Value)
	for k, e := range p.Spending {
		p.Spending[k] = shift(e, -1)
	}
	for i := range p.Debts {
		p.Debts[i].MinPayment = shift(p.Debts[i].MinPayment, 1)
	}
	return p
}
func simulate(p Profile, months int, opts ForecastOptions, delay int) []monthState {
	p = cloneProfile(p)
	out := make([]monthState, months+1)
	usedIDs := map[string]bool{}
	for _, d := range p.Debts {
		usedIDs[d.ID] = true
	}
	freshID := func(prefix string) string {
		for i := 0; ; i++ {
			id := fmt.Sprintf("%s-%d", prefix, i)
			if !usedIDs[id] {
				usedIDs[id] = true
				return id
			}
		}
	}
	deficitID := freshID("simulation-deficit")
	purchaseCards := map[string]bool{}
	inflation := InflationAnnual
	if opts.InflationAnnual != nil {
		inflation = *opts.InflationAnnual
	}
	cash, retirement := p.Cash.Value, p.Retirement.Value
	cashRate := math.Pow(1+CashYieldAnnual, 1.0/12) - 1
	retRate := math.Pow(1+ReturnAnnualNominal, 1.0/12) - 1
	net := func() float64 {
		n := cash + retirement
		for _, d := range p.Debts {
			n -= d.Balance
		}
		return n
	}
	out[0] = monthState{net: net(), cash: cash, load: debtLoad(p)}
	for m := 0; m < months; m++ {
		growth := math.Pow(1+inflation, float64(m)/12)
		income := p.TakeHomePay.Value * growth
		spend := spending(p) * growth
		for j, x := range opts.Extra {
			if m < delay {
				continue
			}
			occurs := m == delay
			if x.Recurring == "monthly" {
				occurs = true
			}
			if x.Recurring == "yearly" {
				occurs = (m-delay)%12 == 0
			}
			if !occurs {
				continue
			}
			mode, l, _ := purchaseMode(x)
			switch mode {
			case "cash":
				spend += x.Amount
			case "card":
				id := freshID(fmt.Sprintf("purchase-%d-%d", j, m))
				purchaseCards[id] = true
				p.Debts = append(p.Debts, Debt{ID: id, Kind: "card", Balance: x.Amount, APR: CardAPRDefault, MinPayment: Estimate{IsEstimate: true}})
			case "loan":
				ll := *l
				ll.Amount = x.Amount
				payment := monthlyPayment(ll.Amount-ll.DownPayment+ll.Fees, ll.APR, ll.TermMonths)
				if ll.PaymentOverride != nil {
					payment = *ll.PaymentOverride
				}
				p.Debts = append(p.Debts, Debt{ID: freshID(fmt.Sprintf("purchase-%d-%d", j, m)), Kind: "personal", Balance: ll.Amount - ll.DownPayment + ll.Fees, APR: ll.APR, MinPayment: Estimate{Value: payment}, ExtraPayment: ll.ExtraPayment})
				spend += ll.DownPayment
			}
		}
		payments := 0.0
		for i := range p.Debts {
			d := &p.Debts[i]
			if d.Balance <= 0 {
				continue
			}
			interest := d.Balance * d.APR / 12
			payment := math.Min(d.Balance+interest, debtMinimum(*d))
			payments += payment
			d.Balance = math.Max(0, d.Balance+interest-payment)
		}
		surplus := income - spend - payments
		if surplus >= 0 {
			retirement += surplus * p.RetirementShare.Value
			cash += surplus * (1 - p.RetirementShare.Value)
		} else {
			cash += surplus
			if cash < 0 {
				deficit := -cash
				cash = 0
				idx := -1
				for i, d := range p.Debts {
					if d.ID == deficitID {
						idx = i
						break
					}
				}
				if idx < 0 {
					p.Debts = append(p.Debts, Debt{ID: deficitID, Kind: "card", APR: CardAPRDefault, MinPayment: Estimate{IsEstimate: true}})
					idx = len(p.Debts) - 1
				}
				p.Debts[idx].Balance += deficit
			}
		}
		cash *= 1 + cashRate
		retirement *= 1 + retRate
		card := 0.0
		for _, d := range p.Debts {
			if purchaseCards[d.ID] {
				card += d.Balance
			}
		}
		load := 0.0
		if income > 0 {
			load = payments / income
		} else if payments > 0 {
			load = 1e12
		}
		value := net()
		if opts.TodaysDollars {
			value /= math.Pow(1+inflation, float64(m+1)/12)
		}
		out[m+1] = monthState{net: value, cash: cash, load: load, card: card}
	}
	return out
}

// Forecast simulates at least ten years; range uncertainty reflects estimated inputs only.
func Forecast(p Profile, opts ForecastOptions) (ForecastResult, error) {
	r := ForecastResult{Points: []ForecastPoint{}, TodaysDollars: opts.TodaysDollars}
	if e := ValidateProfile(p); e != nil {
		return r, e
	}
	if opts.Years < 0 || opts.Years > 50 {
		return r, fmt.Errorf("invalid forecast years")
	}
	if opts.InflationAnnual != nil && (!finite(*opts.InflationAnnual) || *opts.InflationAnnual <= -1 || *opts.InflationAnnual > 1) {
		return r, fmt.Errorf("invalid inflation")
	}
	if len(opts.Extra) > 30 {
		return r, fmt.Errorf("too many purchases")
	}
	for _, x := range opts.Extra {
		if e := validatePurchase(x); e != nil {
			return r, e
		}
	}
	months := max(10, opts.Years) * 12
	mid := simulate(p, months, opts, 0)
	low := simulate(shifted(p, -1), months, opts, 0)
	high := simulate(shifted(p, 1), months, opts, 0)
	for i, v := range mid {
		if !finite(v.net) || !finite(low[i].net) || !finite(high[i].net) {
			return r, fmt.Errorf("forecast exceeds numerical range")
		}
		r.Points = append(r.Points, ForecastPoint{i, v.net, math.Min(v.net, math.Min(low[i].net, high[i].net)), math.Max(v.net, math.Max(low[i].net, high[i].net))})
	}
	r.In10Y = r.Points[120]
	return r, nil
}

// ApplyPatch makes an independent copy and validates the resulting profile.
func ApplyPatch(p Profile, patch ProfilePatch) (Profile, error) {
	p = cloneProfile(p)
	for k, v := range patch.Spending {
		p.Spending[k] = Estimate{Value: v}
	}
	for _, change := range patch.Debts {
		found := false
		for i := range p.Debts {
			if p.Debts[i].ID == change.ID {
				found = true
				if change.APR != nil {
					p.Debts[i].APR = *change.APR
				}
				if change.ExtraPayment != nil {
					p.Debts[i].ExtraPayment = *change.ExtraPayment
				}
			}
		}
		if !found {
			return p, fmt.Errorf("unknown debt")
		}
	}
	if patch.RetirementShare != nil {
		p.RetirementShare = Estimate{Value: *patch.RetirementShare}
	}
	return p, ValidateProfile(p)
}
