// Generate OpenAPI schemas from the authoritative Go engine types.
package main

import (
	"encoding/json"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/catalog"
	"github.com/schlmpcs/gtbsbe-businesscup/services/api/internal/engine"
	"os"
	"reflect"
	"sort"
	"strings"
)

var schemas = map[string]any{}

func schema(t reflect.Type) map[string]any {
	if t.Kind() == reflect.Pointer {
		inner := schema(t.Elem())
		return map[string]any{"allOf": []any{inner}, "nullable": true}
	}
	switch t.Kind() {
	case reflect.Struct:
		name := t.Name()
		if _, ok := schemas[name]; ok {
			return map[string]any{"$ref": "#/components/schemas/" + name}
		}
		schemas[name] = map[string]any{}
		properties := map[string]any{}
		required := []string{}
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			tag := f.Tag.Get("json")
			if tag == "-" {
				continue
			}
			key := strings.Split(tag, ",")[0]
			if key == "" {
				key = f.Name
			}
			properties[key] = schema(f.Type)
			if !strings.Contains(tag, "omitempty") {
				required = append(required, key)
			}
		}
		schemas[name] = map[string]any{"type": "object", "properties": properties, "required": required}
		return map[string]any{"$ref": "#/components/schemas/" + name}
	case reflect.Map:
		return map[string]any{"type": "object", "additionalProperties": schema(t.Elem())}
	case reflect.Slice, reflect.Array:
		return map[string]any{"type": "array", "items": schema(t.Elem())}
	case reflect.String:
		return map[string]any{"type": "string"}
	case reflect.Bool:
		return map[string]any{"type": "boolean"}
	case reflect.Int, reflect.Int64:
		return map[string]any{"type": "integer"}
	case reflect.Float64:
		return map[string]any{"type": "number"}
	default:
		return map[string]any{}
	}
}
func object(fields map[string]any) map[string]any {
	required := []string{}
	for key := range fields {
		required = append(required, key)
	}
	sort.Strings(required)
	return map[string]any{"type": "object", "properties": fields, "required": required}
}
func main() {
	profile := schema(reflect.TypeOf(engine.Profile{}))
	paths := map[string]any{}
	add := func(path, method string, input, output any) {
		op := map[string]any{"operationId": strings.ReplaceAll(strings.Trim(path, "/"), "/", "_") + "_" + method, "responses": map[string]any{"200": map[string]any{"description": "Success", "content": map[string]any{"application/json": map[string]any{"schema": output}}}, "400": map[string]any{"description": "Invalid input"}, "429": map[string]any{"description": "Rate limited"}}}
		if input != nil {
			if obj, ok := input.(map[string]any); ok {
				props, _ := obj["properties"].(map[string]any)
				req := []string{}
				switch path {
				case "/api/session":
				default:
					for key := range props {
						if key != "todaysDollars" && key != "current" && key != "history" && key != "props" {
							req = append(req, key)
						}
					}
					sort.Strings(req)
				}
				obj["required"] = req
			}
			op["requestBody"] = map[string]any{"required": true, "content": map[string]any{"application/json": map[string]any{"schema": input}}}
		}
		if paths[path] == nil {
			paths[path] = map[string]any{}
		}
		paths[path].(map[string]any)[method] = op
	}
	for _, route := range []struct {
		name          string
		input, output any
	}{{"forecast", object(map[string]any{"profile": profile, "todaysDollars": map[string]any{"type": "boolean"}}), schema(reflect.TypeOf(engine.ForecastResult{}))}, {"moves", object(map[string]any{"profile": profile}), schema(reflect.TypeOf([]engine.Move{}))}, {"loans", object(map[string]any{"profile": profile, "loans": schema(reflect.TypeOf([]engine.LoanInput{}))}), schema(reflect.TypeOf([]engine.LoanResult{}))}, {"afford", object(map[string]any{"profile": profile, "purchase": schema(reflect.TypeOf(engine.Purchase{}))}), schema(reflect.TypeOf(engine.AffordResult{}))}, {"month", object(map[string]any{"profile": profile, "history": schema(reflect.TypeOf([]engine.CategoryTotals{})), "current": schema(reflect.TypeOf(engine.CurrentMonth{}))}), schema(reflect.TypeOf(engine.MonthEndResult{}))}, {"apply-move", object(map[string]any{"profile": profile, "moveId": map[string]any{"type": "string"}}), profile}, {"refine", object(map[string]any{"profile": profile, "history": schema(reflect.TypeOf([]engine.CategoryTotals{}))}), profile}} {
		add("/api/calculate/"+route.name, "post", route.input, route.output)
	}
	add("/api/assumptions", "get", nil, map[string]any{"type": "object", "additionalProperties": map[string]any{"oneOf": []any{map[string]any{"type": "number"}, map[string]any{"type": "boolean"}}}})
	add("/api/demo", "get", nil, object(map[string]any{"profile": profile, "loans": schema(reflect.TypeOf([]engine.LoanInput{}))}))
	add("/api/session", "get", nil, object(map[string]any{"profile": profile, "history": schema(reflect.TypeOf([]engine.CategoryTotals{})), "wishlist": map[string]any{"type": "array", "items": schema(reflect.TypeOf(engine.Purchase{}))}}))
	add("/api/session", "post", object(map[string]any{"profile": profile, "history": schema(reflect.TypeOf([]engine.CategoryTotals{})), "wishlist": map[string]any{"type": "array", "items": schema(reflect.TypeOf(engine.Purchase{}))}}), map[string]any{"type": "object"})
	schemas["Purchase"].(map[string]any)["properties"].(map[string]any)["recurring"] = map[string]any{"oneOf": []any{map[string]any{"type": "boolean", "enum": []any{false}}, map[string]any{"type": "string", "enum": []string{"monthly", "yearly"}}}}
	schemas["Purchase"].(map[string]any)["properties"].(map[string]any)["payWith"] = map[string]any{"oneOf": []any{map[string]any{"type": "string", "enum": []string{"cash", "card"}}, object(map[string]any{"loan": schema(reflect.TypeOf(engine.LoanInput{}))})}}
	str := map[string]any{"type": "string"}
	num := map[string]any{"type": "number"}
	boolSchema := map[string]any{"type": "boolean"}
	anyObject := map[string]any{"type": "object", "additionalProperties": true}
	reveal := object(map[string]any{"resultId": str, "cost": schema(reflect.TypeOf(engine.CostBreakdown{})), "result": schema(reflect.TypeOf(engine.GuessResult{})), "card": schema(reflect.TypeOf(engine.LifeCard{})), "cluesOpened": map[string]any{"type": "array", "items": str}})
	add("/api/daily", "get", nil, object(map[string]any{"date": str, "cards": schema(reflect.TypeOf([]catalog.PublicCard{})), "progress": map[string]any{"type": "object", "additionalProperties": object(map[string]any{"clues": map[string]any{"type": "array", "items": map[string]any{"type": "string"}}, "reveal": reveal})}}))
	add("/api/daily/clue", "post", object(map[string]any{"cardId": str, "clue": str}), schema(reflect.TypeOf(catalog.ClueReveal{})))
	add("/api/daily/guess", "post", object(map[string]any{"cardId": str, "guess": num}), reveal)
	add("/api/closest", "post", object(map[string]any{"cardId": str}), profile)
	add("/api/statement/categorize", "post", object(map[string]any{"items": map[string]any{"type": "array", "items": object(map[string]any{"label": str, "amount": num, "month": str, "day": map[string]any{"type": "integer"}, "category": str, "oneOff": boolSchema})}}), schema(reflect.TypeOf([]engine.CategoryTotals{})))
	add("/api/leaderboard", "get", nil, anyObject)
	add("/api/events", "post", object(map[string]any{"name": str, "props": anyObject}), anyObject)
	add("/api/ai/parse", "post", object(map[string]any{"kind": str, "text": str}), anyObject)
	add("/api/ai/explain", "post", anyObject, object(map[string]any{"text": str}))
	add("/api/share", "get", nil, map[string]any{"type": "string", "format": "binary"})
	share := paths["/api/share"].(map[string]any)["get"].(map[string]any)
	share["parameters"] = []any{map[string]any{"name": "resultId", "in": "query", "required": true, "schema": str}, map[string]any{"name": "format", "in": "query", "required": true, "schema": map[string]any{"type": "string", "enum": []string{"square", "story"}}}}
	share["responses"].(map[string]any)["200"] = map[string]any{"description": "Share image", "content": map[string]any{"image/png": map[string]any{"schema": map[string]any{"type": "string", "format": "binary"}}}}
	doc := map[string]any{"openapi": "3.0.3", "info": map[string]any{"title": "LifeGuessr API", "version": "1.0.0"}, "paths": paths, "components": map[string]any{"schemas": schemas}}
	out, _ := json.MarshalIndent(doc, "", "  ")
	if err := os.WriteFile("packages/contracts/openapi.json", append(out, '\n'), 0644); err != nil {
		panic(err)
	}
}
