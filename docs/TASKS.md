# TASKS.md — split and status

Split: **Amir** (ML/AI + SWE) ~19 h (~57%), **Aibek** (backend) ~14.5 h (~43%) + T12 (the house scene, sized at Hour 0), **Kiko** (UI/UX) on Figma, tokens and the sprite kit. Each task is a GitHub issue. Every task can start on fixtures. "Depends on" names the real piece that later replaces a fixture. Update the checkboxes as you go.

## Hour 0 (together)

- [x] Agree stack defaults (ARCHITECTURE.md) or swaps
- [x] Merge `packages/types` contracts; agree units (rates as decimals, monthly vs balance per field)
- [x] Commit fixtures to `packages/data/fixtures/`: `areaData.sample.json`, `cards.sample.json`, `profile.demo.json`, `statement.sample.csv`, `loanOffers.sample.json`
- [ ] LLM provider and key (with a no-training / zero-retention option); Supabase or Vercel KV
- [ ] Agree which Figma frames come first (S1, S2 house scene, S3, S10, S12)
- [ ] Agree the sprite id list for the house kit (layouts, props per clue, decor) with the designer, and size T12

## Amir (ML/AI + SWE)

| Done | ID | Task | Hours | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| [ ] | Y1 | Engine: `costOfLife` + `cardToProfile` + range-based `scoreGuess` with clue multiplier | 2 | Contracts; T2 data later | Tests pass for 3 sample cards; low ≤ mid ≤ high; scoring continuous at the range edges |
| [ ] | Y2 | Engine: `forecast` (inflation, income growth, debt, range band, today's-$) + `applyPatch` | 2.5 | Contracts; T3 loan (stub first) | Golden test stable; range narrows with real inputs |
| [ ] | Y3 | Engine: `rankMoves` level 1 + unlock rules | 1.5 | Y2 | Top 3 sorted by `effect10y` |
| [ ] | Y4 | Engine: `canAfford` | 1 | Y2; T3 | Correct verdict for 3 fixtures, incl. a card purchase that returns "no" |
| [ ] | Y7 | View-model hooks S1–S12 | 1.5 | Contracts | Hooks work on fixtures |
| [ ] | Y8 | Placeholder UI: game S2–S4 (hosts `<HouseScene>`, static-card fallback, guess slider, reveal, share grid) + share button | 2 | Y7; T5; T12 | Game playable on live link |
| [ ] | Y9 | Placeholder UI: ladder S5–S9 | 1.5 | Y7; T6–T7 | Profile builds end to end |
| [ ] | Y10 | Placeholder UI: S1 Today + S10 forecast + Next Moves | 2 | Y2, Y3 | Range band + top 3 render |
| [ ] | Y11 | Placeholder UI: S11 Can I Afford It? + S12 Loan Lab | 2 | Y4; T3 | Compare 3 loans, gauge, slider work |
| [ ] | Y12 | `/api/ai/parse` + `/api/ai/explain` | 1 | Contracts | Typed JSON or clear error; no numbers; parsed values confirmed by the user |
| [ ] | Y14 | Figma skin pass | 2 | Figma frames | Screens match Figma; no model or engine file changed |

## Aibek (backend)

| Done | ID | Task | Hours | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| [x] | T1 | Monorepo, lint (incl. UI import rule), Vitest, CI, Vercel, env (Vercel pending: no account access yet) | 0.5 | — | Live URL by hour 1 |
| [ ] | T2 | Data pipeline (HUD, Census, BLS, childcare) → `areas.json` for ~60 ZIPs + refresh | 2.5 | Contracts | JSON committed, every value has a Source |
| [ ] | T3 | Engine: `loan`, `compareLoans`, debt load, extra payments, payoff order | 1.5 | Contracts | Amortization matches the formula in tests; `payoffMonth: null` when the payment doesn't cover interest |
| [ ] | T4 | Sessions: anon ID, save Profile + wishlist | 1 | T1 | Reload keeps profile without sign-up |
| [ ] | T5 | `/api/daily` (US Eastern date, `PublicCard`s), `/api/daily/clue`, `/api/daily/guess`, leaderboard, share images 9:16 + 1:1 by `resultId`, rate limits | 1.5 | T1; T10 (fixture first) | Same 5 homes for everyone; no answer reaches the browser before the guess; share PNG renders; client can't post a score |
| [ ] | T6 | In-browser CSV parsing, column detection, PII and name masking | 1.5 | Contracts | Sample + 2 real exports parse locally |
| [ ] | T7 | `/api/statement/categorize` + one-off tagging + "What we keep" data | 1.5 | T6 | Returns CategoryTotals; raw data never stored |
| [ ] | T8 | Funnel events + Playwright demo-path test | 1 | T1 | One command runs the demo path green |
| [ ] | T9 | Engine: `monthEnd` (was Y5) | 1 | T7 shape (fixture first) | Flags only real drift; no flags with < 3 months |
| [ ] | T10 | 50 life cards + 2 creator packs (no per-card images: the scene is built from the data) (was Y6) | 1.5 | T2 | Cards load with real costs; day order goes easy → curveball |
| [ ] | T11 | Mockups S13–S15 (was Y13) | 1 | Y7 | Clickable on fixtures |
| [ ] | T12 | House scene: `sceneOf` in `scene.ts` + `<HouseScene>` (layout, closed rooms, tap → zoom → clue) | Sized at Hour 0 | Contracts; D1 for art (placeholder rectangles first) | Playable on a phone with placeholders by Sync 2; consistency test green |

## Kiko (UI/UX, Figma only)

| Done | ID | Task | Depends on | Done when |
| --- | --- | --- | --- | --- |
| [ ] | D1 | House sprite kit: 5 layouts, props per clue state (car bands, kid ages, takeout piles, coats, tier signs), decor set; SVGs named by sprite id | Sprite id list (Hour 0) | Kit in `apps/web/public/scene/` by Sync 2; scene skinned by h17 |
| [ ] | D2 | Figma frames S1–S15, named by screen ID; S1, S2 (house scene), S3, S10, S12 first | Screen list (ARCHITECTURE.md) | Priority frames by h12, the rest by h17, ready for the Y14 skin pass |
| [ ] | D3 | Design tokens: Figma variables → `tokens.json` (colors incl. chart palette, type scale, spacing, radius, shadows) | — | `pnpm tokens` generates `tokens.css`; ui-kit restyle can start by Sync 2 |

After T8–T12, Aibek owns integration and bugs and pairs on Y14.

## Timeline

| Hours | Amir | Aibek | Sync |
| --- | --- | --- | --- |
| 0–1 | Contracts + fixtures | Contracts + T1 | Live URL, types merged |
| 1–6 | Y1, Y2, start Y7 | T2, T3 | **Sync 1 (h6):** engine + real data |
| 6–12 | Finish Y7, Y3, Y8, Y9 | T10, T4, T5, T6, T12 | **Sync 2 (h12):** game (house scene or static fallback) → own profile live on the real engine |
| 12–17 | Y10, Y4, Y11 | T7, T9, T8, T11, finish T12 + sprite kit | **Sync 3 (h17):** logic freeze, demo path green |
| 17–20 | Y12, Y14 Figma pass | Pair on Y14, phone testing | Final design on real screens; AI routes behind the manual-form fallback |
| 20–22 | Demo data, rehearsal | Performance, README | One rehearsal |
| 22–24 | Deck, rehearse | Final deploy, backup recording | Submit: deck PDF, live link, repo |

**Slack warning:** Amir's 1–17 windows are full to the hour, with no slack. If Amir is behind at Sync 1, hand the S12 Loan Lab UI (half of Y11) to Aibek, who already owns the loan engine.

**T12 has to fit in Aibek's spare time:** about 2 h before h17 by the hours above, plus whatever dropping per-card images saves from T10. If T12 is bigger than that once sized at Hour 0, cut from the cut order (creator packs, then leaderboard) before touching the demo path. If the scene isn't playable at Sync 2, ship the static card and keep T12 behind a flag.
