package engine

import (
	"encoding/json"
	"math"
	"os"
	"testing"
)

func near(t *testing.T, got, want, tol float64) {
	t.Helper()
	if math.Abs(got-want) > tol {
		t.Fatalf("got %.12f want %.12f", got, want)
	}
}
func measuredProfile() Profile {
	return Profile{Age: Estimate{Value: 35}, TakeHomePay: Estimate{Value: 5000}, Spending: map[string]Estimate{"rentUtilities": {Value: 1500}, "groceries": {Value: 500}}, Cash: Estimate{Value: 10000}, Retirement: Estimate{Value: 20000}, Debts: []Debt{}, DoneMoveIDs: []string{}}
}
func TestLoanKnownFormulaFeesAndFinalCap(t *testing.T) {
	p := measuredProfile()
	r, e := Loan(p, LoanInput{Amount: 28000, APR: .069, TermMonths: 36})
	if e != nil {
		t.Fatal(e)
	}
	near(t, r.Monthly, 863.28, .005)
	if r.PayoffMonth == nil || *r.PayoffMonth != 36 {
		t.Fatal(r.PayoffMonth)
	}
	near(t, r.Schedule[35].Balance, 0, 1e-8)
	near(t, r.TotalCost, 36*r.Monthly, .001)
	z, e := Loan(p, LoanInput{Amount: 1200, Fees: 120, DownPayment: 120, TermMonths: 12, ExtraPayment: 900})
	if e != nil {
		t.Fatal(e)
	}
	near(t, z.Monthly, 100, 1e-9)
	if z.PayoffMonth == nil || *z.PayoffMonth != 2 {
		t.Fatal(z)
	}
	near(t, z.Schedule[1].Principal, 200, 1e-9)
	near(t, z.TotalCost, 1320, 1e-9)
	payment := 1.0
	bad, e := Loan(p, LoanInput{Amount: 1000, APR: .24, TermMonths: 12, PaymentOverride: &payment})
	if e != nil || bad.PayoffMonth != nil {
		t.Fatal(bad, e)
	}
}
func TestScoreContinuousAndFloored(t *testing.T) {
	c := CostBreakdown{Total: Range{Low: 1000, Mid: 1250, High: 1500}}
	for _, v := range []float64{999.999, 1000, 1500, 1500.001} {
		if ScoreGuess(v, c, 0).Points != 1000 {
			t.Fatal(v)
		}
	}
	for _, v := range []float64{0, -1, 500, 3000} {
		if ScoreGuess(v, c, 0).Points != 0 {
			t.Fatal(v)
		}
	}
	if ScoreGuess(1200, c, 1).Points != 900 || ScoreGuess(1200, c, 100).Points != 500 {
		t.Fatal("clue penalty")
	}
}
func TestForecastMeasuredRangeAndNoDebtDoubleCount(t *testing.T) {
	p := measuredProfile()
	f, e := Forecast(p, ForecastOptions{Years: 1})
	if e != nil {
		t.Fatal(e)
	}
	if len(f.Points) != 121 {
		t.Fatal(len(f.Points))
	}
	for _, v := range f.Points {
		if v.Low != v.Mid || v.High != v.Mid {
			t.Fatal(v)
		}
	}
	near(t, f.Points[1].Mid, (10000+3000)*math.Pow(1.03, 1.0/12)+20000*math.Pow(1.06, 1.0/12), 1e-8)
	p.Spending["debtPayments"] = Estimate{Value: 999999}
	g, _ := Forecast(p, ForecastOptions{})
	near(t, g.In10Y.Mid, f.In10Y.Mid, 1e-8)
	p.TakeHomePay.IsEstimate = true
	h, _ := Forecast(p, ForecastOptions{})
	if h.In10Y.Low >= h.In10Y.Mid || h.In10Y.High <= h.In10Y.Mid {
		t.Fatal(h.In10Y)
	}
	real, _ := Forecast(measuredProfile(), ForecastOptions{TodaysDollars: true})
	near(t, real.In10Y.Mid, f.In10Y.Mid/math.Pow(1.03, 10), 1e-7)
}
func TestForecastDeficitCreatesDebtWithoutMutatingInput(t *testing.T) {
	p := measuredProfile()
	p.TakeHomePay.Value = 0
	p.Cash.Value = 0
	f, e := Forecast(p, ForecastOptions{})
	if e != nil || f.In10Y.Mid >= 0 {
		t.Fatal(f.In10Y, e)
	}
	if len(p.Debts) != 0 || p.Cash.Value != 0 {
		t.Fatal("mutated input")
	}
}
func TestMovesPatchAndPayoffStrategies(t *testing.T) {
	p := measuredProfile()
	p.Debts = []Debt{{ID: "big", Kind: "card", Balance: 3000, APR: .3, MinPayment: Estimate{Value: 100}}, {ID: "small", Kind: "card", Balance: 500, APR: .1, MinPayment: Estimate{Value: 30}}}
	p.StatementUploaded = true
	p.Spending["subscriptions"] = Estimate{Value: 100}
	p.Spending["eatingOut"] = Estimate{Value: 500}
	moves, e := RankMoves(p)
	if e != nil || len(moves) != 3 {
		t.Fatal(moves, e)
	}
	for i := 1; i < len(moves); i++ {
		if moves[i].Effect10Y > moves[i-1].Effect10Y {
			t.Fatal("unsorted")
		}
	}
	patched, e := ApplyPatch(p, ProfilePatch{Spending: map[string]float64{"eatingOut": 100}})
	if e != nil || patched.Spending["eatingOut"].Value != 100 || p.Spending["eatingOut"].Value != 500 {
		t.Fatal("patch")
	}
	a, e := PayoffOrder(p.Debts, 100, "avalanche")
	if e != nil || a.Order[0] != "big" || a.PayoffMonth == nil {
		t.Fatal(a, e)
	}
	s, e := PayoffOrder(p.Debts, 100, "snowball")
	if e != nil || s.Order[0] != "small" || s.PayoffMonth == nil {
		t.Fatal(s, e)
	}
	empty, _ := PayoffOrder(nil, 0, "snowball")
	if empty.PayoffMonth == nil {
		t.Fatal(empty)
	}
}
func TestAffordCardRevolvesAndCashFits(t *testing.T) {
	p := measuredProfile()
	card, e := CanAfford(p, Purchase{Amount: 2000, Recurring: false, PayWith: "card"})
	if e != nil || card.Verdict != "no" || card.FailsOn != "cardRevolves" || card.BaselineFails {
		t.Fatal(card, e)
	}
	cash, e := CanAfford(p, Purchase{Amount: 100, Recurring: false, PayWith: "cash"})
	if e != nil || cash.Verdict != "fits" {
		t.Fatal(cash, e)
	}
	p.Cash.Value = 0
	bad, _ := CanAfford(p, Purchase{Amount: 1000000, Recurring: "monthly", PayWith: "cash"})
	if bad.Verdict != "no" {
		t.Fatal(bad.Verdict)
	}
}
func TestMonthEndHistoryThresholdOneOffsAndDrift(t *testing.T) {
	p := measuredProfile()
	current := &CurrentMonth{Month: "2026-04", Day: 15, Totals: map[string]float64{"groceries": 300}}
	history := []CategoryTotals{{Month: "2026-01", Totals: map[string]float64{"groceries": 100}}, {Month: "2026-02", Totals: map[string]float64{"groceries": 100}}, {Month: "2026-03", Totals: map[string]float64{"groceries": 100}}}
	r, e := MonthEnd(p, history[:2], current)
	if e != nil || r.VsAverage != nil || len(r.Drifts) != 0 {
		t.Fatal(r, e)
	}
	r, e = MonthEnd(p, history, current)
	if e != nil || len(r.Drifts) != 1 {
		t.Fatal(r, e)
	}
	near(t, r.ProjectedSpend, 600, 1e-9)
	near(t, *r.VsAverage, 500, 1e-9)
	current.OneOffs = []OneOff{{Category: "groceries", Amount: 250}}
	r, _ = MonthEnd(p, history, current)
	if len(r.Drifts) != 0 {
		t.Fatal(r)
	}
	current.Day = 31
	if _, e = MonthEnd(p, history, current); e == nil {
		t.Fatal("invalid date accepted")
	}
}
func TestCanonicalFixturesAndGolden(t *testing.T) {
	var p Profile
	read := func(path string, v any) {
		t.Helper()
		b, e := os.ReadFile("../../../../packages/data/fixtures/" + path)
		if e != nil {
			t.Fatal(e)
		}
		if e = json.Unmarshal(b, v); e != nil {
			t.Fatal(e)
		}
	}
	read("profile.demo.json", &p)
	var areas []AreaData
	var cards []LifeCard
	read("areaData.sample.json", &areas)
	read("cards.sample.json", &cards)
	for _, c := range cards {
		var area *AreaData
		for i := range areas {
			if areas[i].ZIP == c.ZIP {
				area = &areas[i]
				break
			}
		}
		if area == nil {
			t.Fatalf("no area for %s", c.ZIP)
		}
		cost, e := CostOfLife(c, *area)
		if e != nil {
			t.Fatal(e)
		}
		if cost.Total.Low > cost.Total.Mid || cost.Total.Mid > cost.Total.High {
			t.Fatal(cost)
		}
		profile, e := CardToProfile(c, *area)
		if e != nil || ValidateProfile(profile) != nil {
			t.Fatal(profile, e)
		}
	}
	f, e := Forecast(p, ForecastOptions{})
	if e != nil {
		t.Fatal(e)
	}
	near(t, f.In10Y.Low, 356060.394385535968, 1e-6)
	near(t, f.In10Y.Mid, 434039.586988838972, 1e-6)
	near(t, f.In10Y.High, 512558.636092491506, 1e-6)
}
func TestValidation(t *testing.T) {
	p := measuredProfile()
	p.Cash.Value = math.NaN()
	if ValidateProfile(p) == nil {
		t.Fatal("NaN accepted")
	}
	if _, e := Forecast(measuredProfile(), ForecastOptions{Years: 51}); e == nil {
		t.Fatal("unbounded forecast")
	}
	if _, e := CompareLoans(measuredProfile(), []LoanInput{{Amount: 100, APR: -1, TermMonths: 12}}); e == nil {
		t.Fatal("negative APR accepted")
	}
	if _, e := CanAfford(measuredProfile(), Purchase{Amount: 10, PayWith: "bitcoin"}); e == nil {
		t.Fatal("payment accepted")
	}
}

func TestUnlockRulesAndDefaultAssumptions(t *testing.T) {
	p := measuredProfile()
	if Level2Unlocked(p) {
		t.Fatal("premature unlock")
	}
	p.CommittedMoveID = "payCardFirst"
	if Level2Unlocked(p) {
		t.Fatal("commit requires check-in")
	}
	p.CheckedInMoveIDs = []string{"payCardFirst"}
	if !Level2Unlocked(p) {
		t.Fatal("check-in should unlock")
	}
	p.CommittedMoveID = ""
	p.DoneMoveIDs = []string{"cutCategory"}
	if !Level2Unlocked(p) {
		t.Fatal("completed move should unlock")
	}
	if Assumptions()["assumption"] != true {
		t.Fatal("unlabeled assumptions")
	}
}

func TestCompareLoansRealOffersAndWaitVerdict(t *testing.T) {
	p := measuredProfile()
	ls, e := CompareLoans(p, []LoanInput{{Amount: 1200, TermMonths: 12}, {Amount: 2400, TermMonths: 12}})
	if e != nil || len(ls) != 2 {
		t.Fatal(ls, e)
	}
	near(t, ls[0].Monthly, 100, 1e-9)
	near(t, ls[1].Monthly, 200, 1e-9)
	p.Cash.Value = 2000
	p.TakeHomePay.Value = 2500
	afford, e := CanAfford(p, Purchase{Amount: 1500, Recurring: false, PayWith: "cash"})
	if e != nil || afford.Verdict != "wait" || afford.WaitMonths == 0 {
		t.Fatal(afford.Verdict, afford.WaitMonths, e)
	}
}

func TestInternalDebtIDsCannotAlterAffordability(t *testing.T) {
	p := measuredProfile()
	p.Debts = []Debt{{ID: "purchase-0-0", Kind: "card", Balance: 20000, APR: .20, MinPayment: Estimate{Value: 400}}}
	r, e := CanAfford(p, Purchase{Amount: 1, Recurring: false, PayWith: "card"})
	if e != nil || r.Verdict != "fits" {
		t.Fatal(r.Verdict, r.FailsOn, e)
	}
	p = measuredProfile()
	p.Cash.Value = 0
	p.TakeHomePay.Value = 0
	p.Debts = []Debt{{ID: "simulation-deficit", Kind: "personal", Balance: 0, APR: 0}}
	f, e := Forecast(p, ForecastOptions{})
	q := measuredProfile()
	q.Cash.Value = 0
	q.TakeHomePay.Value = 0
	g, _ := Forecast(q, ForecastOptions{})
	if e != nil {
		t.Fatal(e)
	}
	near(t, f.In10Y.Mid, g.In10Y.Mid, 1e-7)
}
func TestForecastRejectsNumericalOverflow(t *testing.T) {
	rate := -.9999999999999999
	if _, e := Forecast(measuredProfile(), ForecastOptions{Years: 50, TodaysDollars: true, InflationAnnual: &rate}); e == nil {
		t.Fatal("nonfinite forecast accepted")
	}
}

func TestMonthEndRejectsInvalidOneOffs(t *testing.T) {
	p := measuredProfile()
	for _, o := range []OneOff{{Category: "groceries", Amount: -10}, {Category: "groceries", Amount: 101}, {Category: "unknown", Amount: 5}} {
		_, err := MonthEnd(p, nil, &CurrentMonth{Month: "2026-01", Day: 15, Totals: map[string]float64{"groceries": 100}, OneOffs: []OneOff{o}})
		if err == nil {
			t.Fatal("invalid current one-off accepted", o)
		}
	}
}
