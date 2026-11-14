// Package engine contains deterministic financial simulations. Money is unrounded USD; rates are annual decimals.
package engine

type Source struct {
	Name string `json:"name"`
	Year int    `json:"year"`
	URL  string `json:"url,omitempty"`
}
type Sourced struct {
	Value      float64 `json:"value"`
	Source     Source  `json:"source"`
	IsEstimate bool    `json:"isEstimate"`
}
type Estimate struct {
	Value      float64 `json:"value"`
	IsEstimate bool    `json:"isEstimate"`
}

var Categories = []string{"rentUtilities", "car", "childcare", "groceries", "eatingOut", "subscriptions", "debtPayments", "other"}

type RentRange struct {
	Low    float64 `json:"low"`
	High   float64 `json:"high"`
	Source Source  `json:"source"`
}
type Childcare struct {
	Infant     float64 `json:"infant"`
	Toddler    float64 `json:"toddler"`
	Preschool  float64 `json:"preschool"`
	SchoolAge  float64 `json:"schoolAge"`
	Source     Source  `json:"source"`
	IsEstimate bool    `json:"isEstimate"`
}
type AreaData struct {
	ZIP                 string          `json:"zip"`
	Metro               string          `json:"metro"`
	County              string          `json:"county"`
	State               string          `json:"state"`
	Tier                string          `json:"tier"`
	RentByBedrooms      map[int]Sourced `json:"rentByBedrooms"`
	RentRangeRatio      *RentRange      `json:"rentRangeRatio,omitempty"`
	ChildcareMonthly    *Childcare      `json:"childcareMonthly,omitempty"`
	GroceriesPerAdult   Sourced         `json:"groceriesPerAdult"`
	GasPerGallon        Sourced         `json:"gasPerGallon"`
	CarInsuranceMonthly Sourced         `json:"carInsuranceMonthly"`
	CPIYoY              Sourced         `json:"cpiYoY"`
}
type Car struct {
	Price       float64 `json:"price"`
	DownPayment float64 `json:"downPayment"`
	APR         float64 `json:"apr"`
	TermMonths  int     `json:"termMonths"`
}
type LifeCard struct {
	ID               string   `json:"id"`
	ZIP              string   `json:"zip"`
	Metro            string   `json:"metro"`
	Adults           int      `json:"adults"`
	Kids             []string `json:"kids"`
	Bedrooms         int      `json:"bedrooms"`
	Car              *Car     `json:"car,omitempty"`
	EatingOutPerWeek float64  `json:"eatingOutPerWeek"`
	Caption          string   `json:"caption"`
	Pack             string   `json:"pack,omitempty"`
}
type Range struct {
	Low  float64 `json:"low"`
	Mid  float64 `json:"mid"`
	High float64 `json:"high"`
}
type CostItem struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Source     Source  `json:"source"`
	IsEstimate bool    `json:"isEstimate"`
}
type CostBreakdown struct {
	Total Range      `json:"total"`
	Items []CostItem `json:"items"`
}
type GuessResult struct {
	Points     int     `json:"points"`
	BasePoints int     `json:"basePoints"`
	Multiplier float64 `json:"multiplier"`
	InRange    bool    `json:"inRange"`
	LogError   float64 `json:"logError"`
}
type Debt struct {
	ID           string   `json:"id"`
	Kind         string   `json:"kind"`
	Balance      float64  `json:"balance"`
	APR          float64  `json:"apr"`
	MinPayment   Estimate `json:"minPayment"`
	ExtraPayment float64  `json:"extraPayment,omitempty"`
}
type Profile struct {
	Age               Estimate            `json:"age"`
	TakeHomePay       Estimate            `json:"takeHomePay"`
	Spending          map[string]Estimate `json:"spending"`
	Cash              Estimate            `json:"cash"`
	Retirement        Estimate            `json:"retirement"`
	RetirementShare   Estimate            `json:"retirementShare"`
	Debts             []Debt              `json:"debts"`
	ZIP               string              `json:"zip,omitempty"`
	CommittedMoveID   string              `json:"committedMoveId,omitempty"`
	DoneMoveIDs       []string            `json:"doneMoveIds"`
	CheckedInMoveIDs  []string            `json:"checkedInMoveIds,omitempty"`
	StatementUploaded bool                `json:"statementUploaded,omitempty"`
}
type DebtPatch struct {
	ID           string   `json:"id"`
	ExtraPayment *float64 `json:"extraPayment,omitempty"`
	APR          *float64 `json:"apr,omitempty"`
}
type ProfilePatch struct {
	Spending        map[string]float64 `json:"spending,omitempty"`
	Debts           []DebtPatch        `json:"debts,omitempty"`
	RetirementShare *float64           `json:"retirementShare,omitempty"`
}
type ForecastPoint struct {
	Month int     `json:"month"`
	Mid   float64 `json:"mid"`
	Low   float64 `json:"low"`
	High  float64 `json:"high"`
}
type ForecastResult struct {
	Points        []ForecastPoint `json:"points"`
	In10Y         ForecastPoint   `json:"in10y"`
	TodaysDollars bool            `json:"todaysDollars"`
}
type ForecastOptions struct {
	Years           int        `json:"years,omitempty"`
	TodaysDollars   bool       `json:"todaysDollars,omitempty"`
	Extra           []Purchase `json:"extra,omitempty"`
	InflationAnnual *float64   `json:"inflationAnnual,omitempty"`
}
type Move struct {
	ID        string       `json:"id"`
	Kind      string       `json:"kind"`
	Level     int          `json:"level"`
	Category  string       `json:"category,omitempty"`
	Effect10Y float64      `json:"effect10y"`
	Patch     ProfilePatch `json:"patch"`
}
type LoanInput struct {
	Amount          float64  `json:"amount"`
	APR             float64  `json:"apr"`
	TermMonths      int      `json:"termMonths"`
	Fees            float64  `json:"fees,omitempty"`
	DownPayment     float64  `json:"downPayment,omitempty"`
	ExtraPayment    float64  `json:"extraPayment,omitempty"`
	PaymentOverride *float64 `json:"paymentOverride,omitempty"`
}
type Payment struct {
	Month     int     `json:"month"`
	Interest  float64 `json:"interest"`
	Principal float64 `json:"principal"`
	Balance   float64 `json:"balance"`
}
type LoanResult struct {
	Monthly        float64   `json:"monthly"`
	TotalInterest  float64   `json:"totalInterest"`
	TotalCost      float64   `json:"totalCost"`
	PayoffMonth    *int      `json:"payoffMonth"`
	DebtLoadBefore float64   `json:"debtLoadBefore"`
	DebtLoadAfter  float64   `json:"debtLoadAfter"`
	Effect10Y      float64   `json:"effect10y"`
	Schedule       []Payment `json:"schedule"`
}

// Purchase uses recurring=false|"monthly"|"yearly" and payWith="cash"|"card"|{"loan":LoanInput} on the wire.
type Purchase struct {
	Label     string  `json:"label"`
	Amount    float64 `json:"amount"`
	Recurring any     `json:"recurring"`
	PayWith   any     `json:"payWith"`
}
type AffordResult struct {
	Verdict       string         `json:"verdict"`
	WaitMonths    int            `json:"waitMonths,omitempty"`
	FailsOn       string         `json:"failsOn,omitempty"`
	BaselineFails bool           `json:"baselineFails"`
	With          ForecastResult `json:"with"`
	Without       ForecastResult `json:"without"`
	CheapestWay   string         `json:"cheapestWay"`
}
type OneOff struct {
	Label    string  `json:"label,omitempty"`
	Category string  `json:"category,omitempty"`
	Amount   float64 `json:"amount"`
}
type CategoryTotals struct {
	Month       string             `json:"month"`
	Totals      map[string]float64 `json:"totals"`
	OneOffs     []OneOff           `json:"oneOffs"`
	DetectedPay float64            `json:"detectedPay,omitempty"`
}
type CurrentMonth struct {
	Month   string             `json:"month"`
	Day     int                `json:"day"`
	Totals  map[string]float64 `json:"totals"`
	OneOffs []OneOff           `json:"oneOffs,omitempty"`
}
type Drift struct {
	Category string  `json:"category"`
	Delta    float64 `json:"delta"`
}
type MonthEndResult struct {
	ProjectedSpend float64  `json:"projectedSpend"`
	VsAverage      *float64 `json:"vsAverage"`
	Drifts         []Drift  `json:"drifts"`
}
type PayoffResult struct {
	Order         []string `json:"order"`
	PayoffMonth   *int     `json:"payoffMonth"`
	TotalInterest float64  `json:"totalInterest"`
}
