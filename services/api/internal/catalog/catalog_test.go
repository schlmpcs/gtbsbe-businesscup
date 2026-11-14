package catalog

import (
	"encoding/json"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/engine"
	"reflect"
	"testing"
)

func TestCatalogAndScene(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Areas) != 60 || len(c.Cards) != 50 {
		t.Fatalf("unexpected coverage: %d areas %d cards", len(c.Areas), len(c.Cards))
	}
	metros := map[string]bool{}
	packs := map[string]bool{}
	seen := map[string]bool{}
	for _, a := range c.Areas {
		metros[a.Metro] = true
		for br := 0; br <= 4; br++ {
			r, ok := a.RentByBedrooms[br]
			if !ok || r.Value <= 0 || r.Source.Name == "" || r.Source.Year == 0 {
				t.Fatalf("bad rent %s/%d", a.ZIP, br)
			}
		}
	}
	for _, card := range c.Cards {
		if seen[card.ID] {
			t.Fatal("duplicate card")
		}
		seen[card.ID] = true
		if card.Pack != "" {
			packs[card.Pack] = true
		}
		cost, err := engine.CostOfLife(card, c.Areas[card.ZIP])
		if err != nil {
			t.Fatal(err)
		}
		categories := map[string]bool{}
		for _, item := range cost.Items {
			categories[item.Category] = true
		}
		for _, targets := range ClueCategories {
			for _, target := range targets {
				if !categories[target] {
					t.Fatalf("clue has no cost line: %s", target)
				}
			}
		}
		scene := SceneOf(card, c.Areas[card.ZIP])
		if !reflect.DeepEqual(scene, SceneOf(card, c.Areas[card.ZIP])) {
			t.Fatal("nondeterministic scene")
		}
		if len(scene.Clues) != 5 {
			t.Fatal("missing clues")
		}
		public, _ := json.Marshal(scene.Public)
		var obj map[string]any
		json.Unmarshal(public, &obj)
		for _, key := range []string{"zip", "car", "kids", "eatingOutPerWeek", "cost", "clues"} {
			if _, ok := obj[key]; ok {
				t.Fatalf("public answer leak: %s", key)
			}
		}
		for _, id := range ClueIDs {
			clue := scene.Clues[id]
			if clue.Clue != id || clue.CardID != card.ID || len(ClueCategories[id]) == 0 {
				t.Fatalf("bad clue %s", id)
			}
			for _, prop := range clue.Props {
				if prop.Clue != id {
					t.Fatal("clue prop mismatch")
				}
			}
		}
	}
	if len(metros) != 15 || len(packs) != 2 {
		t.Fatal("metro/pack coverage")
	}
}
