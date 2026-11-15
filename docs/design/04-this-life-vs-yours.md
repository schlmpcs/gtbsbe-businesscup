# 04 · This Life vs Yours (S18)

**Priority 4.** A new panel, `S18 This Life vs Yours`, shown on the game's reveal (S3), plus a teaser for players who haven't entered their numbers yet. Product: F11 ("each game card compared with your own numbers").

## Why it matters

The funnel is **play → guess your own → build your profile → forecast → paywall**. Right now the game and the app barely touch: you guess a stranger's month, then a button invites you to do your own. This panel makes the jump personal. On the reveal you see the stranger's real monthly costs next to yours, category by category. "They pay $1,900 for rent, you pay $1,450" is the moment the game turns into "wait, what about me?"

## The data (what can and can't be compared)

**The home (from the reveal):** its monthly cost breakdown in five categories, each with a source:

| Category (exact label) | Notes |
| --- | --- |
| Rent + utilities | HUD gross rent for that bedroom count and ZIP |
| Car | Loan payment + insurance + fuel. Zero if they bike or bus. |
| Childcare | Per kid, county data. Zero without kids. |
| Groceries | Per adult + kids |
| Eating out | Meals per week × average price |

Plus the total as a range (low–mid–high) and the household (city, adults, kids, bedrooms).

**Yours (from your profile):** spending in eight categories: the five above plus **Subscriptions**, **Debt payments**, **Everything else**. Some are your real numbers, some are our estimates (shown with `EstimateTag`).

**Rules for a fair comparison:**

1. **Compare only the five shared categories** side by side. Show your other three separately ("Not in their number: subscriptions, debt payments, everything else, $640"), so the totals compare like with like.
2. **Car must match.** The home's car includes its loan payment. In your profile, the car loan sits under debts. Engineering adds your car-loan payment back into your Car line. Add a footnote: "Your car includes your car-loan payment."
3. **Household size differs.** A family of four vs you alone isn't a fair fight. Show both households at the top ("2 adults · 1 kid · 2 bd · Nashville" vs "You · 1 adult"), and consider a "per person" toggle. If you design the toggle, say so; it needs engineering.
4. **No income on the home.** Cards don't have incomes, so no "they earn more" and no savings-rate comparison.
5. Your estimated numbers keep their `EstimateTag`. Their numbers keep their source notes (the reveal already lists sources).

## Layout options (pick one, or propose your own)

**A. Paired bars** (recommended starting point): one row per category, their bar and your bar (two chart colors from tokens), amounts at the ends, the difference as a small `Sticker` on the biggest gap.

**B. Difference list:** one row per category with "+$450 more than you" / "−$200 less", sorted by size. Compact, good for phone.

**C. Single headline + details:** a big sentence ("Their month costs $1,240 more than yours, mostly childcare") with the bars in a disclosure.

Whichever you choose, include **one headline sentence** generated from the numbers. Engineering builds it from a fixed template, never an AI. Give 2–3 template variants: biggest gap is theirs, biggest gap is yours, nearly equal.

## Where it appears

| Place | What | Condition |
| --- | --- | --- |
| **S3 Reveal**, after the cost breakdown | Full panel | The player has a profile (not the demo profile) |
| **S3 Reveal**, same spot | **Teaser**: "How does your month compare? Add your numbers in 30 seconds" + button to S7 Quick sliders (or S5) | No profile yet |
| **S3 Reveal**, streamer mode | **Nothing.** Never show a streamer's own money on stream. | `?stream=1` |
| **Summary (after five homes)**, optional | "Closest to your life: home 3 (Chicago)", the home whose total is nearest yours, with a link back to its comparison | Has profile |

The reveal is already long (cost range, score stickers, range scale, category breakdown, sources, who lived here, share). Decide where the panel goes so the **Next home** button stays easy to reach. Collapsing the sources disclosure is fine.

## States

| Frame | When |
| --- | --- |
| `S18 · full (has profile)` | Phone + desktop |
| `S18 · mostly estimates` | Most of the user's numbers are our estimates: say so ("Most of your side is our estimate. Make it exact →" to S9) |
| `S18 · teaser (no profile)` | |
| `S18 · they spend less` | Comparison where you spend more in total |
| `S18 · zero lines` | Their car or childcare is $0 (bike, no kids) and yours isn't, or the other way round |
| `S18 · per person` | Only if you add the toggle |

## Wording

- Neutral and curious: "They spend more on childcare", not "You're doing better". No judgment either way.
- Units: everything is **per month**. Say it once in the header.
- Not advice. No "you should cut eating out" here; Next Moves on S10 does that.

## Checklist

- [ ] Layout choice (A / B / C or other), full panel phone + desktop
- [ ] Headline sentence templates (3 variants)
- [ ] Household line for both sides; car footnote
- [ ] "Not in their number" row for your other three categories
- [ ] Teaser for no-profile players
- [ ] States listed above
- [ ] Optional summary "closest to your life" line
