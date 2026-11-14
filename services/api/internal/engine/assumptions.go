package engine

const (
	LoanAPRDefault  = .10
	LoanTermDefault = 36

	InflationAnnual     = .03
	ReturnAnnualNominal = .06
	CashYieldAnnual     = .03
	CardAPRDefault      = .228
	EstimateSpread      = .15
	ClueCost            = .10
	ClueFloor           = .50
	DebtLoadRed         = .36
	AvgMealPrice        = 16.0
	MonthlyGallons      = 40.0
	KidGroceryFactor    = .65
)

// Assumptions exposes simulation defaults, explicitly identified as assumptions rather than measured data.
func Assumptions() map[string]any {
	return map[string]any{"inflationAnnual": InflationAnnual, "returnAnnualNominal": ReturnAnnualNominal, "cashYieldAnnual": CashYieldAnnual, "cardAprDefault": CardAPRDefault, "estimateSpread": EstimateSpread, "clueCost": ClueCost, "clueFloor": ClueFloor, "debtLoadRed": DebtLoadRed, "avgMealPrice": AvgMealPrice, "monthlyGallons": MonthlyGallons, "kidGroceryFactor": KidGroceryFactor, "loanAprDefault": LoanAPRDefault, "loanTermDefault": LoanTermDefault, "assumption": true}
}
