package engine

import (
	"fmt"
	"math"
	"sort"
)

func monthlyPayment(principal, apr float64, months int) float64 {
	if principal <= 0 {
		return 0
	}
	if apr == 0 {
		return principal / float64(months)
	}
	r := apr / 12
	return principal * r / -math.Expm1(-float64(months)*math.Log1p(r))
}
func debtMinimum(d Debt) float64 {
	if d.Balance <= 0 {
		return 0
	}
	v := d.MinPayment.Value
	if d.Kind == "card" && d.MinPayment.IsEstimate {
		v = math.Max(25, d.Balance*(d.APR/12+.01))
	}
	return v + d.ExtraPayment
}
func debtLoad(p Profile) float64 {
	total := 0.0
	for _, d := range p.Debts {
		total += math.Min(d.Balance*(1+d.APR/12), debtMinimum(d))
	}
	if p.TakeHomePay.Value == 0 {
		if total == 0 {
			return 0
		}
		return 1e12
	}
	return total / p.TakeHomePay.Value
}
func amortize(l LoanInput) (LoanResult, error) {
	r := LoanResult{Schedule: []Payment{}}
	if err := validateLoan(l); err != nil {
		return r, err
	}
	balance := l.Amount - l.DownPayment + l.Fees
	r.Monthly = monthlyPayment(balance, l.APR, l.TermMonths)
	if l.PaymentOverride != nil {
		r.Monthly = *l.PaymentOverride
	}
	r.TotalCost = l.DownPayment
	if balance == 0 {
		z := 0
		r.PayoffMonth = &z
		return r, nil
	}
	if r.Monthly+l.ExtraPayment <= balance*l.APR/12 {
		return r, nil
	}
	for m := 1; m <= 12000; m++ {
		interest := balance * l.APR / 12
		principal := math.Min(balance, r.Monthly+l.ExtraPayment-interest)
		balance = math.Max(0, balance-principal)
		r.TotalInterest += interest
		r.TotalCost += principal + interest
		r.Schedule = append(r.Schedule, Payment{m, interest, principal, balance})
		if balance < 1e-8 {
			r.Schedule[len(r.Schedule)-1].Balance = 0
			r.PayoffMonth = &m
			return r, nil
		}
	}
	return r, nil
}

// Loan compares a financed purchase with the unchanged profile over ten years.
func Loan(p Profile, l LoanInput) (LoanResult, error) {
	if err := ValidateProfile(p); err != nil {
		return LoanResult{}, err
	}
	r, err := amortize(l)
	if err != nil {
		return r, err
	}
	r.DebtLoadBefore = debtLoad(p)
	p2 := cloneProfile(p)
	used := map[string]bool{}
	for _, d := range p2.Debts {
		used[d.ID] = true
	}
	uniqueID := func(prefix string) string {
		for i := 0; ; i++ {
			id := fmt.Sprintf("%s-%d", prefix, i)
			if !used[id] {
				used[id] = true
				return id
			}
		}
	}
	comparisonID := uniqueID("loan-comparison")
	deficitID := uniqueID("downpayment-deficit")
	p2.Debts = append(p2.Debts, Debt{ID: comparisonID, Kind: "personal", Balance: l.Amount - l.DownPayment + l.Fees, APR: l.APR, MinPayment: Estimate{Value: r.Monthly}, ExtraPayment: l.ExtraPayment})
	if p2.Cash.Value < l.DownPayment {
		p2.Debts = append(p2.Debts, Debt{ID: deficitID, Kind: "card", Balance: l.DownPayment - p2.Cash.Value, APR: CardAPRDefault, MinPayment: Estimate{IsEstimate: true}})
	}
	p2.Cash.Value = math.Max(0, p2.Cash.Value-l.DownPayment)
	r.DebtLoadAfter = debtLoad(p2)
	base, err := Forecast(p, ForecastOptions{})
	if err != nil {
		return r, err
	}
	after, err := Forecast(p2, ForecastOptions{})
	if err != nil {
		return r, err
	}
	r.Effect10Y = after.In10Y.Mid - base.In10Y.Mid
	return r, nil
}

// CompareLoans evaluates offers independently against one common baseline.
func CompareLoans(p Profile, ls []LoanInput) ([]LoanResult, error) {
	if len(ls) > 20 {
		return nil, fmt.Errorf("too many loans")
	}
	out := make([]LoanResult, 0, len(ls))
	for _, l := range ls {
		r, e := Loan(p, l)
		if e != nil {
			return nil, e
		}
		out = append(out, r)
	}
	return out, nil
}

// PayoffOrder simulates avalanche or snowball repayment with a fixed total monthly debt budget.
func PayoffOrder(debts []Debt, extra float64, method string) (PayoffResult, error) {
	r := PayoffResult{Order: []string{}}
	if !nonnegative(extra) || (method != "avalanche" && method != "snowball") {
		return r, fmt.Errorf("invalid payoff strategy")
	}
	p := Profile{Debts: debts}
	if e := ValidateProfile(p); e != nil {
		return r, e
	}
	ds := append([]Debt(nil), debts...)
	totalBalance := 0.0
	for _, d := range ds {
		totalBalance += d.Balance
	}
	if totalBalance == 0 {
		zero := 0
		r.PayoffMonth = &zero
		return r, nil
	}
	sort.SliceStable(ds, func(i, j int) bool {
		if method == "snowball" {
			return ds[i].Balance < ds[j].Balance
		}
		return ds[i].APR > ds[j].APR
	})
	budget := extra
	for _, d := range ds {
		r.Order = append(r.Order, d.ID)
		budget += debtMinimum(d)
	}
	for month := 1; month <= 12000; month++ {
		initialInterest := 0.0
		for _, d := range ds {
			initialInterest += d.Balance * d.APR / 12
		}
		if budget <= initialInterest {
			return r, nil
		}
		remaining := budget
		total := 0.0
		for i := range ds {
			if ds[i].Balance <= 0 {
				continue
			}
			minimum := debtMinimum(ds[i])
			interest := ds[i].Balance * ds[i].APR / 12
			r.TotalInterest += interest
			ds[i].Balance += interest
			payment := math.Min(remaining, math.Min(ds[i].Balance, minimum))
			ds[i].Balance -= payment
			remaining -= payment
		}
		for i := range ds {
			payment := math.Min(remaining, ds[i].Balance)
			ds[i].Balance -= payment
			remaining -= payment
			total += ds[i].Balance
		}
		if total < 1e-8 {
			r.PayoffMonth = &month
			return r, nil
		}
		if month == 12000 {
			return r, nil
		}
	}
	return r, nil
}
