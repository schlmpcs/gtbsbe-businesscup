package engine

import (
	"fmt"
	"math"
	"sort"
	"time"
)

func monthTotals(h CategoryTotals) map[string]float64 {
	out := map[string]float64{}
	for c, v := range h.Totals {
		out[c] = v
	}
	for _, o := range h.OneOffs {
		if category(o.Category) {
			out[o.Category] = math.Max(0, out[o.Category]-o.Amount)
		}
	}
	return out
}

func validateOneOffs(totals map[string]float64, oneOffs []OneOff) error {
	sum := map[string]float64{}
	for _, o := range oneOffs {
		if !category(o.Category) || !nonnegative(o.Amount) {
			return fmt.Errorf("invalid one-off")
		}
		sum[o.Category] += o.Amount
	}
	for c, v := range sum {
		if v > totals[c]+1e-8 {
			return fmt.Errorf("one-off amount exceeds category total")
		}
	}
	return nil
}

// MonthEnd projects a partial month and compares only with three prior complete distinct months.
func MonthEnd(p Profile, history []CategoryTotals, current *CurrentMonth) (MonthEndResult, error) {
	r := MonthEndResult{ProjectedSpend: spending(p), Drifts: []Drift{}}
	if e := ValidateProfile(p); e != nil {
		return r, e
	}
	if current == nil {
		return r, nil
	}
	date, e := time.Parse("2006-01", current.Month)
	if e != nil {
		return r, fmt.Errorf("invalid current month")
	}
	days := date.AddDate(0, 1, -1).Day()
	if current.Day < 1 || current.Day > days {
		return r, fmt.Errorf("invalid day")
	}
	for c, v := range current.Totals {
		if !category(c) || !nonnegative(v) {
			return r, fmt.Errorf("invalid category totals")
		}
	}
	if e := validateOneOffs(current.Totals, current.OneOffs); e != nil {
		return r, e
	}
	totals := monthTotals(CategoryTotals{Totals: current.Totals, OneOffs: current.OneOffs})
	projection := map[string]float64{}
	r.ProjectedSpend = 0
	for _, c := range Categories {
		projection[c] = totals[c] / float64(current.Day) * float64(days)
		r.ProjectedSpend += projection[c]
	}
	prior := []CategoryTotals{}
	seen := map[string]bool{}
	for _, h := range history {
		d, err := time.Parse("2006-01", h.Month)
		if err != nil {
			return r, fmt.Errorf("invalid history month")
		}
		if !d.Before(date) || seen[h.Month] {
			continue
		}
		for c, v := range h.Totals {
			if !category(c) || !nonnegative(v) {
				return r, fmt.Errorf("invalid historical total")
			}
		}
		if e := validateOneOffs(h.Totals, h.OneOffs); e != nil {
			return r, e
		}
		seen[h.Month] = true
		prior = append(prior, h)
	}
	if len(prior) < 3 {
		return r, nil
	}
	sort.Slice(prior, func(i, j int) bool { return prior[i].Month > prior[j].Month })
	prior = prior[:3]
	averageTotal := 0.0
	for _, c := range Categories {
		values := []float64{}
		avg := 0.0
		for _, h := range prior {
			v := monthTotals(h)[c]
			values = append(values, v)
			avg += v / 3
		}
		averageTotal += avg
		variance := 0.0
		for _, v := range values {
			variance += (v - avg) * (v - avg) / 3
		}
		delta := projection[c] - avg
		if math.Abs(delta) > math.Max(math.Sqrt(variance), .1*avg)+1e-8 {
			r.Drifts = append(r.Drifts, Drift{c, delta})
		}
	}
	difference := r.ProjectedSpend - averageTotal
	r.VsAverage = &difference
	return r, nil
}
