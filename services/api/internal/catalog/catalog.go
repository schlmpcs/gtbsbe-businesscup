// Package catalog serves versioned offline data; no government calls occur at runtime.
package catalog

import (
	"embed"
	"encoding/json"
	"fmt"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/engine"
)

//go:embed data/*.json
var data embed.FS

type Catalog struct {
	Areas       map[string]engine.AreaData
	Cards       []engine.LifeCard
	DemoProfile engine.Profile
	Loans       []engine.LoanInput
}

func Load() (*Catalog, error) {
	c := &Catalog{Areas: map[string]engine.AreaData{}}
	var areas []engine.AreaData
	for name, target := range map[string]any{"areas.json": &areas, "cards.json": &c.Cards, "profile.demo.json": &c.DemoProfile, "loanOffers.sample.json": &c.Loans} {
		b, err := data.ReadFile("data/" + name)
		if err != nil {
			return nil, err
		}
		if err = json.Unmarshal(b, target); err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
	}
	for _, a := range areas {
		c.Areas[a.ZIP] = a
	}
	if len(c.Cards) < 5 {
		return nil, fmt.Errorf("catalog needs at least five cards")
	}
	for _, card := range c.Cards {
		if _, ok := c.Areas[card.ZIP]; !ok {
			return nil, fmt.Errorf("unknown area %s", card.ZIP)
		}
	}
	return c, nil
}

type SceneProp struct {
	Sprite string `json:"sprite"`
	Room   string `json:"room"`
	Clue   string `json:"clue,omitempty"`
}
type PublicCard struct {
	ID      string      `json:"id"`
	Metro   string      `json:"metro"`
	Layout  string      `json:"layout"`
	Caption string      `json:"caption"`
	Decor   []SceneProp `json:"decor"`
}
type ClueReveal struct {
	CardID string         `json:"cardId"`
	Clue   string         `json:"clue"`
	Props  []SceneProp    `json:"props"`
	Facts  map[string]any `json:"facts"`
}
type Scene struct {
	Public PublicCard            `json:"public"`
	Clues  map[string]ClueReveal `json:"clues"`
}

var ClueIDs = []string{"garage", "kidsRoom", "kitchen", "entry", "mailbox"}
var ClueCategories = map[string][]string{"garage": {"car"}, "kidsRoom": {"childcare", "groceries"}, "kitchen": {"eatingOut"}, "entry": {"groceries"}, "mailbox": {"rentUtilities"}}

const EconomyCarMax = 25000
const MidCarMax = 45000

func SceneOf(card engine.LifeCard, area engine.AreaData) Scene {
	layouts := []string{"studio", "1bed", "2bed", "3bed", "4bed"}
	br := card.Bedrooms
	if br < 0 {
		br = 0
	}
	if br > 4 {
		br = 4
	}
	s := Scene{Public: PublicCard{ID: card.ID, Metro: card.Metro, Layout: layouts[br], Caption: card.Caption, Decor: []SceneProp{{Sprite: "plant", Room: "living"}, {Sprite: "lamp", Room: "living"}}}, Clues: map[string]ClueReveal{}}
	for _, id := range ClueIDs {
		s.Clues[id] = ClueReveal{CardID: card.ID, Clue: id, Props: []SceneProp{}, Facts: map[string]any{}}
	}
	add := func(id, sprite string) {
		r := s.Clues[id]
		r.Props = append(r.Props, SceneProp{Sprite: sprite, Room: id, Clue: id})
		s.Clues[id] = r
	}
	band := "none"
	if card.Car != nil {
		band = "economy"
		if card.Car.Price >= EconomyCarMax {
			band = "mid"
		}
		if card.Car.Price > MidCarMax {
			band = "luxury"
		}
		s.Clues["garage"].Facts["car"] = card.Car
	} else {
		s.Clues["garage"].Facts["car"] = nil
	}
	add("garage", "car-"+band)
	if len(card.Kids) == 0 {
		add("kidsRoom", "home-office")
	}
	for _, age := range card.Kids {
		add("kidsRoom", "kid-"+age)
	}
	s.Clues["kidsRoom"].Facts["kids"] = card.Kids
	takeout := "0-1"
	if card.EatingOutPerWeek >= 2 {
		takeout = "2-3"
	}
	if card.EatingOutPerWeek >= 4 {
		takeout = "4-6"
	}
	if card.EatingOutPerWeek >= 7 {
		takeout = "7-plus"
	}
	add("kitchen", "takeout-"+takeout)
	s.Clues["kitchen"].Facts["eatingOutPerWeek"] = card.EatingOutPerWeek
	for i := 0; i < card.Adults; i++ {
		add("entry", "adult-coat")
	}
	for range card.Kids {
		add("entry", "kid-shoes")
	}
	s.Clues["entry"].Facts["adults"] = card.Adults
	s.Clues["entry"].Facts["kids"] = card.Kids
	add("mailbox", "tier-"+area.Tier)
	s.Clues["mailbox"].Facts["zip"] = card.ZIP
	s.Clues["mailbox"].Facts["tier"] = area.Tier
	return s
}
