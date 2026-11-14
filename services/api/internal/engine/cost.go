package engine

import (
	"fmt"
	"math"
)

var assumptionSource = Source{Name: "LifeGuessr modeling assumption", Year: 2026}

// CostOfLife derives monthly living costs from a card and sourced area data.
func CostOfLife(c LifeCard, a AreaData) (CostBreakdown, error) {
	r := CostBreakdown{Items: []CostItem{}}
	if c.Bedrooms < 0 || c.Bedrooms > 4 || len(c.Kids) > 20 {
		return r, fmt.Errorf("invalid household")
	}
	if a.RentRangeRatio != nil && (!finite(a.RentRangeRatio.Low) || !finite(a.RentRangeRatio.High) || a.RentRangeRatio.Low <= 0 || a.RentRangeRatio.Low > a.RentRangeRatio.High) {
		return r, fmt.Errorf("invalid rent range")
	}
	rent, ok := a.RentByBedrooms[c.Bedrooms]
	if !ok || !nonnegative(rent.Value) || c.Adults < 1 || c.Adults > 2 || !nonnegative(c.EatingOutPerWeek) {
		return r, fmt.Errorf("invalid card or area")
	}
	add := func(cat string, v float64, s Source, estimate bool) {
		r.Items = append(r.Items, CostItem{cat, v, s, estimate})
		r.Total.Mid += v
		lo, hi := v, v
		if estimate {
			lo *= 1 - EstimateSpread
			hi *= 1 + EstimateSpread
		}
		if cat == "rentUtilities" {
			if a.RentRangeRatio != nil {
				lo = v * a.RentRangeRatio.Low
				hi = v * a.RentRangeRatio.High
			} else {
				lo = v * (1 - EstimateSpread)
				hi = v * (1 + EstimateSpread)
			}
		}
		r.Total.Low += math.Min(lo, v)
		r.Total.High += math.Max(hi, v)
	}
	add("rentUtilities", rent.Value, rent.Source, rent.IsEstimate)
	car := 0.0
	if c.Car != nil {
		l := LoanInput{Amount: c.Car.Price, DownPayment: c.Car.DownPayment, APR: c.Car.APR, TermMonths: c.Car.TermMonths}
		if e := validateLoan(l); e != nil {
			return r, e
		}
		car = monthlyPayment(l.Amount-l.DownPayment, l.APR, l.TermMonths) + a.CarInsuranceMonthly.Value + a.GasPerGallon.Value*MonthlyGallons
	}
	add("car", car, assumptionSource, true)
	childcare := 0.0
	for _, age := range c.Kids {
		if a.ChildcareMonthly == nil {
			return r, fmt.Errorf("missing childcare data")
		}
		switch age {
		case "infant":
			childcare += a.ChildcareMonthly.Infant
		case "toddler":
			childcare += a.ChildcareMonthly.Toddler
		case "preschool":
			childcare += a.ChildcareMonthly.Preschool
		case "schoolAge":
			childcare += a.ChildcareMonthly.SchoolAge
		default:
			return r, fmt.Errorf("invalid kid age")
		}
	}
	source := assumptionSource
	estimate := false
	if a.ChildcareMonthly != nil {
		source = a.ChildcareMonthly.Source
		estimate = a.ChildcareMonthly.IsEstimate
	}
	add("childcare", childcare, source, estimate)
	add("groceries", a.GroceriesPerAdult.Value*(float64(c.Adults)+KidGroceryFactor*float64(len(c.Kids))), a.GroceriesPerAdult.Source, a.GroceriesPerAdult.IsEstimate || len(c.Kids) > 0)
	add("eatingOut", c.EatingOutPerWeek*4.33*AvgMealPrice, assumptionSource, true)
	for _, item := range r.Items {
		if !nonnegative(item.Amount) {
			return CostBreakdown{}, fmt.Errorf("invalid cost component")
		}
	}
	return r, nil
}

// ScoreGuess applies a continuous logarithmic error and server-counted clue penalty.
func ScoreGuess(guess float64, c CostBreakdown, clues int) GuessResult {
	r := GuessResult{Multiplier: math.Max(ClueFloor, 1-ClueCost*float64(max(0, clues)))}
	if !finite(guess) || guess <= 0 || c.Total.Low <= 0 || c.Total.High < c.Total.Low {
		return r
	}
	r.InRange = guess >= c.Total.Low && guess <= c.Total.High
	if r.InRange {
		r.BasePoints = 1000
	} else {
		edge := c.Total.High
		if guess < c.Total.Low {
			edge = c.Total.Low
		}
		r.LogError = math.Abs(math.Log(guess / edge))
		r.BasePoints = int(math.Max(0, math.Round(1000*(1-r.LogError/math.Ln2))))
	}
	r.Points = int(math.Round(float64(r.BasePoints) * r.Multiplier))
	return r
}

// CardToProfile converts game costs to editable estimates without double-counting auto debt payments.
func CardToProfile(c LifeCard, a AreaData) (Profile, error) {
	cost, err := CostOfLife(c, a)
	if err != nil {
		return Profile{}, err
	}
	p := Profile{Age: Estimate{35, true}, TakeHomePay: Estimate{6000, true}, Spending: map[string]Estimate{}, Cash: Estimate{5000, true}, Retirement: Estimate{10000, true}, RetirementShare: Estimate{0, true}, Debts: []Debt{}, ZIP: c.ZIP, DoneMoveIDs: []string{}}
	for _, cat := range Categories {
		p.Spending[cat] = Estimate{0, true}
	}
	for _, item := range cost.Items {
		p.Spending[item.Category] = Estimate{item.Amount, true}
	}
	if c.Car != nil {
		payment := monthlyPayment(c.Car.Price-c.Car.DownPayment, c.Car.APR, c.Car.TermMonths)
		p.Spending["car"] = Estimate{math.Max(0, p.Spending["car"].Value-payment), true}
		p.Debts = append(p.Debts, Debt{ID: "auto", Kind: "auto", Balance: c.Car.Price - c.Car.DownPayment, APR: c.Car.APR, MinPayment: Estimate{payment, true}})
	}
	return p, nil
}
