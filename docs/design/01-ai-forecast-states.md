# 01 · AI forecast states (S1, S5–S9, S10)

**Priority 1.** These are new states on screens you already designed. No new screens.

## What changes and why

Until now the "You in 10 years" number came from our rules engine: deterministic and instant. Now it comes from an **AI model** (Claude), and code checks the answer against the rules engine. If the model is slow, down, or gives a number that fails the checks, the app quietly switches to the rules engine.

So every 10-year number now has to say **who made it**, and the screens need states they never had: waiting for the model, updating after an edit, and the fallback.

Engineering tasks: Y18 (client and states), Y20 (wording). Spec: `docs/ENGINEERING.md` → AI forecast.

## The new pieces

### 1. Source tag (new component: `Tag`)

A small pill next to every forecast number.

| Variant | Use | Copy (exact, already in code) |
| --- | --- | --- |
| `Tag` solid | Who produced a number | **"AI estimate"** · **"Rules-based estimate"** · **"Rules-based preview"** |
| `Tag` dashed | A value we chose or defaulted (an assumption) | **"our assumption"** |

- Today it is a muted outline pill: `text-muted`, `border`, radius `full`, `xs` medium. Restyle it, but keep solid vs dashed clearly different, since one says "a fact about the number" and the other "something we picked".
- It must sit next to `EstimateTag` without the two looking like the same thing. `EstimateTag` means *your input was guessed by us*; the source tag means *who computed the result*. Show both together in one frame so the difference is visible.
- Hover/tap behavior: optional tooltip. If you design one, write its copy.

### 2. Range band, two meanings

The shaded band on `ForecastChart` now means one of two things. The label under the chart changes:

| Band kind | When | Label | Explanation (exact copy) |
| --- | --- | --- | --- |
| `inputs` | Rules forecast | (existing S10 band label) | (existing copy: the band comes from the numbers we estimated) |
| `model` | AI forecast | **"Range from the AI model's own uncertainty"** | "The shaded band is how far the AI model thinks your net worth could land from its middle number. It is the model's own judgment, not a guarantee, and it does not always narrow when you add real numbers." |
| zero width, model | AI gave one number | — | "The model gave a single number, with no range." |

Design question for you: should the AI band **look** different from the rules band (a different fill, hatching, a dashed edge)? It would help the eye. If yes, add the style as a token (`chart.band-model`) instead of a one-off color.

### 3. "How we calculate" panel (S10)

The intro paragraph switches by source. The AI version (exact copy):

> The 10-year numbers are written by an AI model from your inputs, then checked in code against our rules simulation: an answer that strays too far from it is thrown out, and you see the simulation's numbers instead, labeled as such. Everything else, like this month's spending, is still worked out by our own rules. These are the rates and rules the simulation uses.

Assumption rows get the dashed "our assumption" tag. The panel is long, so check that it still reads well at phone width.

### 4. Next Moves (S10)

Each move card shows its 10-year effect, and that effect now carries its own source tag (moves can be AI or rules). The "Explain" sentence words itself by source:

- AI: "Our AI estimate is that it adds about **$12,400** to your net worth in 10 years."
- Rules: "In our simulation it adds about **$12,400** to your net worth in 10 years."

## States to draw

The forecast loads asynchronously. These are the states the view-model already exposes (`forecastStatus`, `source`, `isRefreshing`, `isStale`):

| State | What happens | What the screen shows |
| --- | --- | --- |
| **Loading (first time)** | First request to the model; can take up to **25 s** before the app falls back | Skeleton for the 10-year stat, the chart and the Next Moves list. Design a skeleton that doesn't feel broken after 10+ seconds: a progress hint or rotating copy ("Checking the AI's numbers against our rules…"). Write that copy. |
| **Ready · AI** | Model answered and passed the checks | Numbers + "AI estimate" tag + model band label |
| **Ready · rules (fallback)** | No key, outage, slow model, or the answer failed the checks | Numbers + "Rules-based estimate" tag + inputs band label. **No error message.** The fallback is a normal state, not a failure. |
| **Refreshing** | User changed an input; previous numbers stay on screen while a new answer is on its way | Previous numbers stay visible, slightly de-emphasized, with **"Updating the forecast…"** (live region, `xs`, muted). Don't hide the numbers or show a spinner over them. |
| **Stale** | The numbers on screen belong to the previous profile | Same as refreshing, but the tag should not claim the old numbers are current. Your call how: dim the stat, or prefix the tag. |
| **Error** | Even the local fallback failed (rare) | Existing error card pattern (`ErrorNote`) with a retry |

Also show the **today's-dollars toggle** (S10 has a toggle between today's dollars and nominal). Switching it is instant and makes no request, so no loading state is needed. Just make sure the source tag stays put when the numbers change.

## Screen by screen

### S1 Today: "You in 10 years" card

- Frames: `S1 · forecast loading`, `S1 · AI`, `S1 · rules`, `S1 · refreshing`.
- The card is small (a `Stat` + hint + CTA). The tag goes under the number. The band label appears only when the band has width.

### S5–S9 Ladder: the progress header

- The ladder's running "in 10 years" number always comes from the rules engine (it has to move instantly while you drag sliders). It is labeled **"Rules-based preview"**.
- Frame: `S5 · progress with preview tag` (one frame is enough; the header is shared by S5–S9).
- Why it matters: without the label, S7 and S10 would show two different unlabeled "in 10 years" numbers, and a judge would spot the mismatch.

### S9 Statement upload: "What we keep"

- One new line about the forecast: the profile's numbers (no names, no account numbers) go to the AI model provider to produce the forecast, and are not stored by us.
- **Exact wording is pending a privacy check** (Amir). Leave a slot for one sentence; don't write a promise about the provider's retention yourself.

### S10 You in 10 years + Next Moves

- Frames: `S10 · loading`, `S10 · AI`, `S10 · rules`, `S10 · refreshing`, `S10 · How we calculate (AI)`.
- Tag placement: under the headline stat, and on each move card.
- Band label under the chart switches by kind (table above).

## Things not to change

- Can I Afford It? (S11), Loan Lab (S12), month-end on S1, the game: all still rules-only. **No AI tag there.**
- Don't make the AI look like a feature to brag about (no sparkles, no "✨ AI-powered"). The label is for honesty, not marketing.

## Checklist

- [ ] `Tag` component, solid + dashed, next to `EstimateTag` in one frame
- [ ] Band style for `model` vs `inputs` (decision + token if new)
- [ ] S1: loading, AI, rules, refreshing
- [ ] S5 progress header with "Rules-based preview"
- [ ] S9 "What we keep" slot for the forecast line
- [ ] S10: loading (with long-wait copy), AI, rules, refreshing, stale, How we calculate (AI)
- [ ] Next Moves card with per-move source tag
