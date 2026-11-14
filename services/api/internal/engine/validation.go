package engine

import (
	"encoding/json"
	"fmt"
	"math"
)

func finite(v float64) bool      { return !math.IsNaN(v) && !math.IsInf(v, 0) }
func nonnegative(v float64) bool { return finite(v) && v >= 0 && v <= 1e12 }
func category(s string) bool {
	for _, c := range Categories {
		if s == c {
			return true
		}
	}
	return false
}

// ValidateProfile rejects malformed and non-finite financial inputs before simulation.
func ValidateProfile(p Profile) error {
	if !finite(p.Age.Value) || p.Age.Value < 0 || p.Age.Value > 120 {
		return fmt.Errorf("invalid age")
	}
	for _, v := range []float64{p.TakeHomePay.Value, p.Cash.Value, p.Retirement.Value} {
		if !nonnegative(v) {
			return fmt.Errorf("invalid profile balance or income")
		}
	}
	if !finite(p.RetirementShare.Value) || p.RetirementShare.Value < 0 || p.RetirementShare.Value > 1 {
		return fmt.Errorf("invalid retirement share")
	}
	for c, e := range p.Spending {
		if !category(c) || !nonnegative(e.Value) {
			return fmt.Errorf("invalid spending category %s", c)
		}
	}
	seen := map[string]bool{}
	for _, d := range p.Debts {
		if d.ID == "" || seen[d.ID] || !nonnegative(d.Balance) || !finite(d.APR) || d.APR < 0 || d.APR > 5 || !nonnegative(d.MinPayment.Value) || !nonnegative(d.ExtraPayment) {
			return fmt.Errorf("invalid debt")
		}
		seen[d.ID] = true
		switch d.Kind {
		case "card", "auto", "student", "personal", "bnpl", "mortgage":
		default:
			return fmt.Errorf("invalid debt kind")
		}
	}
	return nil
}
func validateLoan(l LoanInput) error {
	if !nonnegative(l.Amount) || !nonnegative(l.DownPayment) || !nonnegative(l.Fees) || !nonnegative(l.ExtraPayment) || l.DownPayment > l.Amount || !finite(l.APR) || l.APR < 0 || l.APR > 5 || l.TermMonths < 1 || l.TermMonths > 1200 {
		return fmt.Errorf("invalid loan")
	}
	if l.PaymentOverride != nil && !nonnegative(*l.PaymentOverride) {
		return fmt.Errorf("invalid payment")
	}
	return nil
}
func purchaseMode(p Purchase) (string, *LoanInput, error) {
	switch v := p.PayWith.(type) {
	case string:
		if v == "cash" || v == "card" {
			return v, nil, nil
		}
	case map[string]any:
		if len(v) != 1 {
			return "", nil, fmt.Errorf("invalid payment mode")
		}
		b, e := json.Marshal(v["loan"])
		if e != nil {
			return "", nil, e
		}
		var l LoanInput
		if e = json.Unmarshal(b, &l); e == nil {
			return "loan", &l, validateLoan(l)
		}
	case map[string]LoanInput:
		l, ok := v["loan"]
		if ok {
			return "loan", &l, validateLoan(l)
		}
	}
	return "", nil, fmt.Errorf("invalid payment mode")
}
func validatePurchase(p Purchase) error {
	if !nonnegative(p.Amount) {
		return fmt.Errorf("invalid purchase amount")
	}
	switch v := p.Recurring.(type) {
	case bool:
		if v {
			return fmt.Errorf("invalid recurring")
		}
	case string:
		if v != "monthly" && v != "yearly" {
			return fmt.Errorf("invalid recurring")
		}
	case nil:
	default:
		return fmt.Errorf("invalid recurring")
	}
	_, l, err := purchaseMode(p)
	if err != nil {
		return err
	}
	if l != nil {
		l.Amount = p.Amount
		return validateLoan(*l)
	}
	return nil
}
