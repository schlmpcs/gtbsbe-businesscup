package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/catalog"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/engine"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/store"
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	SecureCookies bool
	PublicOrigin  string
	Now           func() time.Time
	AnthropicKey  string
	ZDRVerified   bool
	TrustProxy    bool
}
type Server struct {
	db      *store.Store
	data    *catalog.Catalog
	config  Config
	mux     *http.ServeMux
	eastern *time.Location
}
type Session struct {
	Profile  *engine.Profile         `json:"profile"`
	Wishlist []engine.Purchase       `json:"wishlist"`
	History  []engine.CategoryTotals `json:"history"`
}
type snapshot struct {
	Card engine.LifeCard      `json:"card"`
	Area engine.AreaData      `json:"area"`
	Cost engine.CostBreakdown `json:"cost"`
}
type round struct {
	Clues  []string `json:"clues"`
	Reveal *reveal  `json:"reveal,omitempty"`
}
type dayState struct {
	Date   string                       `json:"date"`
	Cards  []snapshot                   `json:"cards"`
	Rounds map[string]map[string]*round `json:"rounds"`
}
type reveal struct {
	ResultID    string               `json:"resultId"`
	Cost        engine.CostBreakdown `json:"cost"`
	Result      engine.GuessResult   `json:"result"`
	Card        engine.LifeCard      `json:"card"`
	CluesOpened []string             `json:"cluesOpened"`
}
type ctxKey struct{}

func New(db *store.Store, data *catalog.Catalog, cfg Config) (*Server, error) {
	loc, e := time.LoadLocation("America/New_York")
	if e != nil {
		return nil, e
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	s := &Server{db: db, data: data, config: cfg, mux: http.NewServeMux(), eastern: loc}
	s.routes()
	return s, nil
}
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "same-origin")
	if r.Method != "GET" && r.Method != "HEAD" {
		origin := r.Header.Get("Origin")
		if origin != "" {
			u, e := url.Parse(origin)
			expected := s.config.PublicOrigin
			if expected == "" {
				expected = "http://" + r.Host
				if s.config.SecureCookies {
					expected = "https://" + r.Host
				}
			}
			if e != nil || u.Scheme+"://"+u.Host != strings.TrimRight(expected, "/") {
				fail(w, 403, "origin rejected")
				return
			}
		}
	}
	if r.URL.Path == "/api/health" {
		if err := s.db.Ping(r.Context()); err != nil {
			fail(w, 503, "storage unavailable")
			return
		}
		write(w, 200, map[string]string{"status": "ok"})
		return
	}
	var token string
	c, e := r.Cookie("lg_session")
	if e == nil && len(c.Value) == 64 {
		if _, e = hex.DecodeString(c.Value); e == nil {
			token = c.Value
		}
	}
	if token == "" {
		token = randomID()
		http.SetCookie(w, &http.Cookie{Name: "lg_session", Value: token, Path: "/", HttpOnly: true, Secure: s.config.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: 60 * 60 * 24 * 90})
	}
	sum := sha256.Sum256([]byte(token))
	session := hex.EncodeToString(sum[:])
	ip, _, e := net.SplitHostPort(r.RemoteAddr)
	if e != nil {
		ip = r.RemoteAddr
	}
	if s.config.TrustProxy {
		forwarded := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		if len(forwarded) > 0 {
			candidate := strings.TrimSpace(forwarded[len(forwarded)-1])
			if net.ParseIP(candidate) != nil {
				ip = candidate
			}
		}
	}
	ipHash := sha256.Sum256([]byte(ip))
	limit := 240
	if r.URL.Path == "/api/share" {
		limit = 30
	}
	if r.URL.Path == "/api/statement/categorize" || strings.HasPrefix(r.URL.Path, "/api/ai/") {
		limit = 12
	}
	for _, k := range []string{"ip:" + hex.EncodeToString(ipHash[:]), "session:" + session} {
		if e := s.db.Limit(r.Context(), k+":"+strconv.Itoa(limit), limit, time.Minute, s.config.Now()); e != nil {
			if errors.Is(e, store.ErrRateLimited) {
				w.Header().Set("Retry-After", "60")
				fail(w, 429, "too many requests")
			} else {
				fail(w, 503, "storage unavailable")
			}
			return
		}
	}
	s.mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, session)))
}
func sid(r *http.Request) string { return r.Context().Value(ctxKey{}).(string) }
func randomID() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, msg string) {
	write(w, status, map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, out any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(out); e != nil {
		fail(w, 400, "invalid request: "+e.Error())
		return false
	}
	if e := d.Decode(&struct{}{}); e != io.EOF {
		fail(w, 400, "only one JSON value allowed")
		return false
	}
	return true
}
func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/assumptions", func(w http.ResponseWriter, r *http.Request) { write(w, 200, engine.Assumptions()) })
	s.mux.HandleFunc("GET /api/session", s.session)
	s.mux.HandleFunc("POST /api/session", s.session)
	s.mux.HandleFunc("GET /api/demo", func(w http.ResponseWriter, r *http.Request) {
		write(w, 200, map[string]any{"profile": s.data.DemoProfile, "loans": s.data.Loans})
	})
	s.mux.HandleFunc("GET /api/daily", s.daily)
	s.mux.HandleFunc("POST /api/daily/clue", s.clue)
	s.mux.HandleFunc("POST /api/daily/guess", s.guess)
	s.mux.HandleFunc("POST /api/closest", s.closest)
	s.mux.HandleFunc("GET /api/leaderboard", s.leaderboard)
	s.mux.HandleFunc("GET /api/share", s.share)
	s.mux.HandleFunc("POST /api/events", s.event)
	s.mux.HandleFunc("POST /api/calculate/{kind}", s.calculate)
	s.mux.HandleFunc("POST /api/statement/categorize", s.categorize)
	s.mux.HandleFunc("POST /api/ai/parse", s.aiParse)
	s.mux.HandleFunc("POST /api/ai/explain", s.aiExplain)
}
func defaultSession() Session {
	return Session{Wishlist: []engine.Purchase{}, History: []engine.CategoryTotals{}}
}
func (s *Server) session(w http.ResponseWriter, r *http.Request) {
	out := defaultSession()
	var patch struct {
		Profile  *engine.Profile          `json:"profile"`
		Wishlist *[]engine.Purchase       `json:"wishlist"`
		History  *[]engine.CategoryTotals `json:"history"`
	}
	if r.Method == "POST" {
		if !decode(w, r, &patch) {
			return
		}
		if patch.Profile != nil {
			if e := validateProfile(*patch.Profile); e != nil {
				fail(w, 400, e.Error())
				return
			}
		}
		if patch.Wishlist != nil && len(*patch.Wishlist) > 50 {
			fail(w, 400, "too many wishlist entries")
			return
		}
		if patch.Wishlist != nil {
			for _, purchase := range *patch.Wishlist {
				if len(purchase.Label) > 200 {
					fail(w, 400, "purchase label too long")
					return
				}
				if _, err := engine.CanAfford(s.data.DemoProfile, purchase); err != nil {
					fail(w, 400, "invalid wishlist purchase")
					return
				}
			}
		}

		if patch.History != nil {
			if len(*patch.History) > 120 {
				fail(w, 400, "too many months")
				return
			}
			if e := validateHistory(*patch.History); e != nil {
				fail(w, 400, e.Error())
				return
			}
		}
	}
	e := s.db.Update(r.Context(), "session:"+sid(r), out, func(raw json.RawMessage) (any, error) {
		if e := json.Unmarshal(raw, &out); e != nil {
			return nil, e
		}
		if patch.Profile != nil {
			out.Profile = patch.Profile
		}
		if patch.Wishlist != nil {
			for _, p := range *patch.Wishlist {
				if p.Amount < 0 || !finite(p.Amount) {
					return nil, errors.New("invalid purchase")
				}
			}
			out.Wishlist = *patch.Wishlist
		}
		if patch.History != nil {
			out.History = sanitizeHistory(*patch.History)
		}
		return out, nil
	})
	if e != nil {
		fail(w, 500, "session could not be saved")
		return
	}
	write(w, 200, out)
}
func (s *Server) date() string { return s.config.Now().In(s.eastern).Format("2006-01-02") }
func (s *Server) initialDay(date string) (dayState, error) {
	out := dayState{Date: date, Rounds: map[string]map[string]*round{}, Cards: []snapshot{}}
	cards := append([]engine.LifeCard(nil), s.data.Cards...)
	sort.Slice(cards, func(i, j int) bool {
		a := sha256.Sum256([]byte(date + cards[i].ID))
		b := sha256.Sum256([]byte(date + cards[j].ID))
		return hex.EncodeToString(a[:]) < hex.EncodeToString(b[:])
	})
	if len(cards) > 5 {
		cards = cards[:5]
	}
	for _, c := range cards {
		a, ok := s.data.Areas[c.ZIP]
		if !ok {
			return out, errors.New("missing area")
		}
		cost, e := engine.CostOfLife(c, a)
		if e != nil {
			return out, e
		}
		out.Cards = append(out.Cards, snapshot{c, a, cost})
	}
	sort.SliceStable(out.Cards, func(i, j int) bool { return out.Cards[i].Cost.Total.Mid < out.Cards[j].Cost.Total.Mid })
	return out, nil
}
func (s *Server) withDay(r *http.Request, date string, fn func(*dayState) error) error {
	initial, e := s.initialDay(date)
	if e != nil {
		return e
	}
	return s.db.Update(r.Context(), "day:"+date, initial, func(raw json.RawMessage) (any, error) {
		var day dayState
		if e := json.Unmarshal(raw, &day); e != nil {
			return nil, e
		}
		if day.Rounds == nil {
			day.Rounds = map[string]map[string]*round{}
		}
		if e := fn(&day); e != nil {
			return nil, e
		}
		return day, nil
	})
}
func findCard(day *dayState, id string) *snapshot {
	for i := range day.Cards {
		if day.Cards[i].Card.ID == id {
			return &day.Cards[i]
		}
	}
	return nil
}
func playerRound(day *dayState, session, card string) *round {
	if day.Rounds[session] == nil {
		day.Rounds[session] = map[string]*round{}
	}
	if day.Rounds[session][card] == nil {
		day.Rounds[session][card] = &round{Clues: []string{}}
	}
	return day.Rounds[session][card]
}
func (s *Server) daily(w http.ResponseWriter, r *http.Request) {
	cards := []catalog.PublicCard{}
	var progress map[string]*round
	e := s.withDay(r, s.date(), func(day *dayState) error {
		for _, v := range day.Cards {
			cards = append(cards, catalog.SceneOf(v.Card, v.Area).Public)
		}
		progress = day.Rounds[sid(r)]
		if progress == nil {
			progress = map[string]*round{}
		}
		return nil
	})
	if e != nil {
		fail(w, 503, "daily unavailable")
		return
	}
	write(w, 200, map[string]any{"date": s.date(), "cards": cards, "progress": progress})
}

var errNotFound = errors.New("card or clue not found")

func (s *Server) clue(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CardID string `json:"cardId"`
		Clue   string `json:"clue"`
	}
	if !decode(w, r, &in) {
		return
	}
	var out any
	e := s.withDay(r, s.date(), func(day *dayState) error {
		v := findCard(day, in.CardID)
		if v == nil {
			return errNotFound
		}
		scene := catalog.SceneOf(v.Card, v.Area)
		c, ok := scene.Clues[in.Clue]
		if !ok {
			return errNotFound
		}
		rd := playerRound(day, sid(r), in.CardID)
		if rd.Reveal == nil {
			found := false
			for _, k := range rd.Clues {
				found = found || k == in.Clue
			}
			if !found {
				rd.Clues = append(rd.Clues, in.Clue)
			}
		}
		out = c
		return nil
	})
	if e != nil {
		if errors.Is(e, errNotFound) {
			fail(w, 404, e.Error())
		} else {
			fail(w, 503, "clue unavailable")
		}
		return
	}
	write(w, 200, out)
}
func (s *Server) guess(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CardID string  `json:"cardId"`
		Guess  float64 `json:"guess"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !finite(in.Guess) || in.Guess < 0 || in.Guess > 1e8 {
		fail(w, 400, "guess must be between 0 and 100000000")
		return
	}
	var out *reveal
	e := s.withDay(r, s.date(), func(day *dayState) error {
		v := findCard(day, in.CardID)
		if v == nil {
			return errNotFound
		}
		rd := playerRound(day, sid(r), in.CardID)
		if rd.Reveal == nil {
			rd.Reveal = &reveal{randomID(), v.Cost, engine.ScoreGuess(in.Guess, v.Cost, len(rd.Clues)), v.Card, append([]string{}, rd.Clues...)}
		}
		out = rd.Reveal
		return nil
	})
	if e != nil {
		if errors.Is(e, errNotFound) {
			fail(w, 404, e.Error())
		} else {
			fail(w, 503, "guess unavailable")
		}
		return
	}
	e = s.db.Update(r.Context(), "result:"+out.ResultID, *out, func(raw json.RawMessage) (any, error) { return out, nil })
	if e != nil {
		fail(w, 503, "result unavailable; retry safely")
		return
	}
	write(w, 200, out)
}
func (s *Server) closest(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CardID string `json:"cardId"`
	}
	if !decode(w, r, &in) {
		return
	}
	var out engine.Profile
	e := s.withDay(r, s.date(), func(day *dayState) error {
		v := findCard(day, in.CardID)
		if v == nil {
			return errNotFound
		}
		rd := playerRound(day, sid(r), in.CardID)
		if rd.Reveal == nil {
			return errors.New("guess before selecting this life")
		}
		var e error
		out, e = engine.CardToProfile(v.Card, v.Area)
		return e
	})
	if e != nil {
		fail(w, 403, e.Error())
		return
	}
	write(w, 200, out)
}
func (s *Server) leaderboard(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	if date == "" {
		date = s.date()
	}
	if _, e := time.Parse("2006-01-02", date); e != nil || date > s.date() {
		fail(w, 400, "invalid date")
		return
	}
	var day dayState
	if e := s.db.Read(r.Context(), "day:"+date, &day); e != nil {
		write(w, 200, map[string]any{"rank": nil, "todayStats": map[string]int{"points": 0, "played": 0}, "entries": []any{}})
		return
	}
	type entry struct {
		Player string `json:"player"`
		Points int    `json:"points"`
		Played int    `json:"played"`
	}
	entries := []entry{}
	own := entry{}
	for player, rounds := range day.Rounds {
		v := entry{Player: player[:8]}
		for _, rd := range rounds {
			if rd.Reveal != nil {
				v.Points += rd.Reveal.Result.Points
				v.Played++
			}
		}
		if v.Played > 0 {
			entries = append(entries, v)
		}
		if player == sid(r) {
			own = v
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Points == entries[j].Points {
			return entries[i].Player < entries[j].Player
		}
		return entries[i].Points > entries[j].Points
	})
	var rank any
	for i, v := range entries {
		if v.Player == sid(r)[:8] {
			rank = i + 1
		}
	}
	if len(entries) > 100 {
		entries = entries[:100]
	}
	write(w, 200, map[string]any{"rank": rank, "todayStats": own, "entries": entries})
}
func (s *Server) share(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("resultId")
	if len(id) != 64 {
		fail(w, 404, "result not found")
		return
	}
	var result reveal
	if e := s.db.Read(r.Context(), "result:"+id, &result); e != nil {
		fail(w, 404, "result not found")
		return
	}
	format := r.URL.Query().Get("format")
	width, height := 1080, 1080
	if format == "9:16" || format == "story" {
		height = 1920
	} else if format != "" && format != "1:1" && format != "square" {
		fail(w, 400, "format must be 1:1 or 9:16")
		return
	}
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	bg := color.RGBA{19, 37, 38, 255}
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.SetRGBA(x, y, bg)
		}
	}
	drawText(img, 80, 100, "LIFEGUESSR", 8, color.RGBA{247, 229, 186, 255})
	drawText(img, 80, 260, strconv.Itoa(result.Result.Points)+" POINTS", 7, color.RGBA{116, 218, 177, 255})
	drawText(img, 80, 400, "MONTHLY COST", 4, color.RGBA{247, 229, 186, 255})
	drawText(img, 80, 480, fmt.Sprintf("$%.0f", result.Cost.Total.Mid), 10, color.RGBA{255, 255, 255, 255})
	drawText(img, 80, height-160, "PLAY YOUR NEXT LIFE", 4, color.RGBA{247, 229, 186, 255})
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public,max-age=86400,immutable")
	png.Encode(w, img)
}
func (s *Server) event(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name  string                     `json:"name"`
		Props map[string]json.RawMessage `json:"props"`
	}
	if !decode(w, r, &in) {
		return
	}
	allowed := map[string]bool{"play_started": true, "clue_opened": true, "guess_submitted": true, "own_guess": true, "profile_completed": true, "forecast_viewed": true, "statement_uploaded": true, "loan_compared": true, "paywall_viewed": true}
	if !allowed[in.Name] {
		fail(w, 400, "unknown event")
		return
	}
	e := s.db.Update(r.Context(), "events:"+s.date(), map[string]int{}, func(raw json.RawMessage) (any, error) {
		v := map[string]int{}
		if e := json.Unmarshal(raw, &v); e != nil {
			return nil, e
		}
		v[in.Name]++
		return v, nil
	})
	if e != nil {
		fail(w, 503, "event unavailable")
		return
	}
	write(w, 200, map[string]bool{"ok": true})
}
func (s *Server) calculate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Profile       engine.Profile          `json:"profile"`
		TodaysDollars bool                    `json:"todaysDollars"`
		Loans         []engine.LoanInput      `json:"loans"`
		Purchase      engine.Purchase         `json:"purchase"`
		History       []engine.CategoryTotals `json:"history"`
		Current       *engine.CurrentMonth    `json:"current"`
		MoveID        string                  `json:"moveId"`
	}
	if !decode(w, r, &in) {
		return
	}
	if e := validateProfile(in.Profile); e != nil {
		fail(w, 400, e.Error())
		return
	}
	if e := validateHistory(in.History); e != nil {
		fail(w, 400, e.Error())
		return
	}
	if in.Current != nil {
		if e := validateHistory([]engine.CategoryTotals{{Month: in.Current.Month, Totals: in.Current.Totals, OneOffs: in.Current.OneOffs}}); e != nil {
			fail(w, 400, e.Error())
			return
		}
	}

	var out any
	var e error
	switch r.PathValue("kind") {
	case "apply-move":
		var moves []engine.Move
		moves, e = engine.RankMoves(in.Profile)
		if e == nil {
			found := false
			for _, m := range moves {
				if m.ID == in.MoveID {
					out, e = engine.ApplyPatch(in.Profile, m.Patch)
					found = true
					break
				}
			}
			if !found {
				e = errors.New("move not available")
			}
		}
	case "refine":
		if e = validateHistory(in.History); e == nil {
			history := append([]engine.CategoryTotals(nil), in.History...)
			sort.Slice(history, func(i, j int) bool { return history[i].Month > history[j].Month })
			currentMonth := s.config.Now().In(s.eastern).Format("2006-01")
			for _, m := range history {
				if m.Month < currentMonth {
					p := in.Profile
					p.Spending = map[string]engine.Estimate{}
					for k, v := range in.Profile.Spending {
						p.Spending[k] = v
					}
					for k, v := range m.Totals {
						p.Spending[k] = engine.Estimate{Value: v, IsEstimate: false}
					}
					for _, oneOff := range m.OneOffs {
						value := p.Spending[oneOff.Category]
						value.Value = math.Max(0, value.Value-oneOff.Amount)
						p.Spending[oneOff.Category] = value
					}

					p.StatementUploaded = true
					out = p
					break
				}
			}
			if out == nil {
				out = in.Profile
			}
		}
	case "forecast":
		out, e = engine.Forecast(in.Profile, engine.ForecastOptions{TodaysDollars: in.TodaysDollars})
	case "moves":
		out, e = engine.RankMoves(in.Profile)
	case "loans":
		if len(in.Loans) == 0 || len(in.Loans) > 10 {
			fail(w, 400, "provide 1 to 10 loans")
			return
		}
		out, e = engine.CompareLoans(in.Profile, in.Loans)
	case "afford":
		out, e = engine.CanAfford(in.Profile, in.Purchase)
	case "month":
		if e = validateHistory(in.History); e != nil {
			break
		}
		if in.Current == nil {
			now := s.config.Now().In(s.eastern)
			for _, m := range in.History {
				if m.Month == now.Format("2006-01") {
					in.Current = &engine.CurrentMonth{Month: m.Month, Day: now.Day(), Totals: m.Totals, OneOffs: m.OneOffs}
					break
				}
			}
		}
		out, e = engine.MonthEnd(in.Profile, in.History, in.Current)
	default:
		fail(w, 404, "unknown calculation")
		return
	}
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 200, out)
}
func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }

func validateProfile(p engine.Profile) error {
	if len(p.Debts) > 100 || len(p.DoneMoveIDs) > 100 || len(p.ZIP) > 10 || len(p.CommittedMoveID) > 100 {
		return errors.New("profile exceeds supported limits")
	}
	for _, d := range p.Debts {
		if len(d.ID) > 100 {
			return errors.New("debt id too long")
		}
	}
	for _, id := range p.DoneMoveIDs {
		if len(id) > 100 {
			return errors.New("move id too long")
		}
	}
	return engine.ValidateProfile(p)
}
