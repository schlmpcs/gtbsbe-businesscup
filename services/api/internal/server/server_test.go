package server

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/catalog"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/engine"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/store"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func setup(t *testing.T) (*Server, *store.Store) {
	t.Helper()
	c, e := catalog.Load()
	if e != nil {
		t.Fatal(e)
	}
	db := store.Memory()
	s, e := New(db, c, Config{Now: func() time.Time { return time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC) }})
	if e != nil {
		t.Fatal(e)
	}
	return s, db
}
func call(s *Server, method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	var b bytes.Buffer
	if body != nil {
		json.NewEncoder(&b).Encode(body)
	}
	r := httptest.NewRequest(method, path, &b)
	r.RemoteAddr = "127.0.0.1:1234"
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	return w
}
func dailyFor(t *testing.T, s *Server) (string, *http.Cookie) {
	t.Helper()
	w := call(s, "GET", "/api/daily", nil, nil)
	if w.Code != 200 {
		t.Fatalf("daily %d: %s", w.Code, w.Body.String())
	}
	var out struct {
		Cards []catalog.PublicCard `json:"cards"`
	}
	if e := json.Unmarshal(w.Body.Bytes(), &out); e != nil || len(out.Cards) != 5 {
		t.Fatalf("daily malformed %s", w.Body.String())
	}
	for _, secret := range []string{"rentByBedrooms", "eatingOutPerWeek", "downPayment", "total", "price"} {
		if strings.Contains(w.Body.String(), `"`+secret+`"`) {
			t.Fatalf("answer leaked %s", secret)
		}
	}
	return out.Cards[0].ID, w.Result().Cookies()[0]
}
func TestAtomicGuessAndPrivateSession(t *testing.T) {
	s, _ := setup(t)
	card, cookie := dailyFor(t, s)
	_, other := dailyFor(t, s)
	p := s.data.DemoProfile
	w := call(s, "POST", "/api/session", map[string]any{"profile": p}, cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	w = call(s, "GET", "/api/session", nil, other)
	var st Session
	json.Unmarshal(w.Body.Bytes(), &st)
	if st.Profile != nil {
		t.Fatal("profile leaked between sessions")
	}
	for i := 0; i < 2; i++ {
		w = call(s, "POST", "/api/daily/clue", map[string]any{"cardId": card, "clue": "garage"}, cookie)
		if w.Code != 200 {
			t.Fatal(w.Body.String())
		}
	}
	var wg sync.WaitGroup
	ids := make(chan string, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			w := call(s, "POST", "/api/daily/guess", map[string]any{"cardId": card, "guess": 1000 + i*500}, cookie)
			if w.Code != 200 {
				t.Errorf("guess %d: %s", w.Code, w.Body.String())
				return
			}
			var result reveal
			json.Unmarshal(w.Body.Bytes(), &result)
			if len(result.CluesOpened) != 1 {
				t.Errorf("duplicate clue penalty: %v", result.CluesOpened)
			}
			ids <- result.ResultID
		}(i)
	}
	wg.Wait()
	close(ids)
	id := ""
	for v := range ids {
		if id != "" && v != id {
			t.Fatal("concurrent submission generated multiple results")
		}
		id = v
	}
	w = call(s, "GET", "/api/share?resultId="+id+"&format=story", nil, other)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	cfg, e := png.DecodeConfig(w.Body)
	if e != nil || cfg.Width != 1080 || cfg.Height != 1920 {
		t.Fatalf("invalid share: %v %+v", e, cfg)
	}
	w = call(s, "POST", "/api/closest", map[string]any{"cardId": card}, other)
	if w.Code != 403 {
		t.Fatal("unrevealed card returned profile")
	}
}
func TestValidationOriginAndPrivacy(t *testing.T) {
	s, _ := setup(t)
	_, cookie := dailyFor(t, s)
	r := httptest.NewRequest("POST", "/api/session", strings.NewReader(`{}`))
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("cross-origin write accepted")
	}
	w = call(s, "POST", "/api/statement/categorize", map[string]any{"items": []map[string]any{{"label": "Zelle Alice Smith", "amount": 80, "month": "2026-10", "day": 5, "category": "other", "oneOff": true}, {"label": "Payroll", "amount": -4000, "month": "2026-10", "day": 1}}}, cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if strings.Contains(w.Body.String(), "Alice") || strings.Contains(w.Body.String(), "Zelle") {
		t.Fatal("labels leaked into totals")
	}
	var totals []engine.CategoryTotals
	json.Unmarshal(w.Body.Bytes(), &totals)
	if totals[0].DetectedPay != 4000 || totals[0].Totals["other"] != 80 {
		t.Fatalf("aggregation wrong: %s", w.Body.String())
	}
	w = call(s, "POST", "/api/session", map[string]any{"history": totals}, cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	w = call(s, "POST", "/api/statement/categorize", map[string]any{"items": []map[string]any{{"label": "test", "amount": 5, "month": "2026-02", "day": 30}}}, cookie)
	if w.Code != 400 {
		t.Fatal("invalid date accepted")
	}
}
func TestEasternRollover(t *testing.T) {
	s, _ := setup(t)
	s.config.Now = func() time.Time { return time.Date(2026, 11, 15, 4, 59, 0, 0, time.UTC) }
	if s.date() != "2026-11-14" {
		t.Fatal(s.date())
	}
	s.config.Now = func() time.Time { return time.Date(2026, 11, 15, 5, 0, 0, 0, time.UTC) }
	if s.date() != "2026-11-15" {
		t.Fatal(s.date())
	}
}
func TestCalculatorNoPublicCostOracle(t *testing.T) {
	s, _ := setup(t)
	w := call(s, "POST", "/api/calculate/cost", map[string]any{"profile": s.data.DemoProfile}, nil)
	if w.Code != 404 {
		t.Fatalf("public cost oracle exists: %d", w.Code)
	}
	w = call(s, "POST", "/api/calculate/forecast", map[string]any{"profile": s.data.DemoProfile}, nil)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
}
func TestRateLimit(t *testing.T) {
	s, _ := setup(t)
	_, cookie := dailyFor(t, s)
	for i := 0; i < 12; i++ {
		w := call(s, "POST", "/api/ai/parse", map[string]any{"kind": "loan", "text": "test"}, cookie)
		if w.Code != 503 {
			t.Fatalf("unexpected initial limit %d", w.Code)
		}
	}
	w := call(s, "POST", "/api/ai/parse", map[string]any{"kind": "loan", "text": "test"}, cookie)
	if w.Code != 429 {
		t.Fatalf("rate limit not enforced %d", w.Code)
	}
}

func TestPostgresRestartAndConcurrentGameplay(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to a disposable Postgres database")
	}
	data, e := catalog.Load()
	if e != nil {
		t.Fatal(e)
	}
	db, e := store.Open(context.Background(), url)
	if e != nil {
		t.Fatal(e)
	}
	cfg := Config{Now: func() time.Time { return time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC) }}
	s, e := New(db, data, cfg)
	if e != nil {
		t.Fatal(e)
	}
	card, cookie := dailyFor(t, s)
	w := call(s, "POST", "/api/session", map[string]any{"profile": data.DemoProfile}, cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	ids := map[string]bool{}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := call(s, "POST", "/api/daily/guess", map[string]any{"cardId": card, "guess": 4500}, cookie)
			if w.Code != 200 {
				t.Error(w.Body.String())
				return
			}
			var v reveal
			json.Unmarshal(w.Body.Bytes(), &v)
			mu.Lock()
			ids[v.ResultID] = true
			mu.Unlock()
		}()
	}
	wg.Wait()
	if len(ids) != 1 {
		t.Fatalf("postgres concurrency returned %d results", len(ids))
	}
	db.Close()
	db, e = store.Open(context.Background(), url)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	s, e = New(db, data, cfg)
	if e != nil {
		t.Fatal(e)
	}
	w = call(s, "GET", "/api/session", nil, cookie)
	var saved Session
	json.Unmarshal(w.Body.Bytes(), &saved)
	if saved.Profile == nil || saved.Profile.TakeHomePay.Value != data.DemoProfile.TakeHomePay.Value {
		t.Fatal("restart lost profile")
	}
	_, other := dailyFor(t, s)
	w = call(s, "GET", "/api/session", nil, other)
	json.Unmarshal(w.Body.Bytes(), &saved)
	if saved.Profile != nil {
		t.Fatal("postgres profile isolation failed")
	}
	w = call(s, "POST", "/api/daily/guess", map[string]any{"cardId": card, "guess": 99999}, cookie)
	var v reveal
	json.Unmarshal(w.Body.Bytes(), &v)
	if !ids[v.ResultID] {
		t.Fatal("restart lost idempotent result")
	}
}

func TestMonthDerivesCurrentAndRejectsMalformedWishlist(t *testing.T) {
	s, _ := setup(t)
	_, cookie := dailyFor(t, s)
	history := []engine.CategoryTotals{}
	for _, m := range []string{"2026-08", "2026-09", "2026-10", "2026-11"} {
		amount := 100.0
		if m == "2026-11" {
			amount = 280
		}
		history = append(history, engine.CategoryTotals{Month: m, Totals: map[string]float64{"groceries": amount}, OneOffs: []engine.OneOff{}})
	}
	w := call(s, "POST", "/api/calculate/month", map[string]any{"profile": s.data.DemoProfile, "history": history}, cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var result engine.MonthEndResult
	json.Unmarshal(w.Body.Bytes(), &result)
	if result.VsAverage == nil || len(result.Drifts) != 1 || result.ProjectedSpend != 600 {
		t.Fatalf("current not derived %s", w.Body.String())
	}
	w = call(s, "POST", "/api/calculate/refine", map[string]any{"profile": s.data.DemoProfile, "history": history[3:]}, cookie)
	if w.Code != 200 {
		t.Fatal("partial upload should preserve profile:", w.Body.String())
	}
	w = call(s, "POST", "/api/session", map[string]any{"wishlist": []map[string]any{{"amount": 100, "recurring": false, "payWith": map[string]any{"loan": map[string]any{"amount": 100, "apr": -1, "termMonths": 36}}}}}, cookie)
	if w.Code != 400 {
		t.Fatalf("malformed wishlist accepted %d", w.Code)
	}
}

func TestBoundedInputAndAssumptions(t *testing.T) {
	s, _ := setup(t)
	w := call(s, "GET", "/api/assumptions", nil, nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"returnAnnualNominal":0.06`) {
		t.Fatal(w.Body.String())
	}
	p := s.data.DemoProfile
	p.Debts = make([]engine.Debt, 101)
	w = call(s, "POST", "/api/calculate/forecast", map[string]any{"profile": p}, nil)
	if w.Code != 400 {
		t.Fatal("oversized debts accepted")
	}
	w = call(s, "POST", "/api/calculate/month", map[string]any{"profile": s.data.DemoProfile, "current": map[string]any{"month": "2026-11", "day": 14, "totals": map[string]float64{"other": 10}, "oneOffs": []map[string]any{{"category": "other", "amount": -100}}}}, nil)
	if w.Code != 400 {
		t.Fatal("negative oneoff accepted")
	}
	h := make([]engine.CategoryTotals, 121)
	w = call(s, "POST", "/api/calculate/refine", map[string]any{"profile": s.data.DemoProfile, "history": h}, nil)
	if w.Code != 400 {
		t.Fatal("oversized history accepted")
	}
}

func TestRefineDoesNotRepeatOneOff(t *testing.T) {
	s, _ := setup(t)
	history := []engine.CategoryTotals{{Month: "2026-10", Totals: map[string]float64{"other": 1500, "groceries": 400}, OneOffs: []engine.OneOff{{Category: "other", Amount: 1200}}}}
	w := call(s, "POST", "/api/calculate/refine", map[string]any{"profile": s.data.DemoProfile, "history": history}, nil)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var p engine.Profile
	json.Unmarshal(w.Body.Bytes(), &p)
	if p.Spending["other"].Value != 300 || p.Spending["other"].IsEstimate || p.Spending["groceries"].Value != 400 {
		t.Fatal("oneoff repeated:", w.Body.String())
	}
}
