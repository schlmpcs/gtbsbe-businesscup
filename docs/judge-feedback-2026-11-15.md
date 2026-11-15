# Judge-mode walkthrough: feedback (2026-11-15)

Amir played the judge on the live site (Chromium driven by Playwright, phone width then desktop). F1–F22 came from the walkthrough; F23–F32 are the presenter's notes on the remaining screens, written against the judge's comments. Everything is filed under the tracking issue **#132**, with 17 sub-issues (#133–#149).

## The rule behind most of it

**The user does the least possible hand work.** One bank connection or statement upload detects income, spending by category, subscriptions, recurring payments and debts, and the user only confirms what we found. Manual entry is the fallback everywhere, never the main path. Numbers still come from code (golden rule 1); the LLM only parses text and asks follow-up questions.

## Themes → issues

| Theme | What the judge hit | Issues |
|---|---|---|
| **Your own numbers before any forecast** | S5 compares your guess to a sample person's cost; income is spending ÷ 0.9; skipped steps keep a sample family's spending, so the forecast showed −$19.4K | #133, #134, #135 (design #145) |
| **Automate input** | Spending on sliders, debts typed field by field, subscriptions ticked by hand, loan offers typed | #138, #139, #140, #141, #143 (design #149) |
| **Show the impact on me, not a minus** | "−$1,739" next to "Yes, it fits"; −$19.4K with no reason; ±$34K on /decide | #142 (design #146) |
| **Homeowners** | No rent/own choice; home equity missing from net worth | #136, #137 |
| **Less crowded, more straightforward** | /future and /loan pack too much on one screen; inconsistent stepper | #148 |
| **Landing sells only the game** | The product is step 3 of 3 | #147 |
| **Pro has no real paid value** | Pro adds only a wishlist | #143 |
| **Loan Lab bug-looking state** | Three identical payoff columns at $0 extra | #144 |

### Issues by owner

**Amir:** #133 JF1 own numbers (S5) · #134 JF2 "About you" + no income back-solve · #135 JF3 closest life from your facts · #136 JF4 homeowners (types + engine) · #140 JF8 subscription audit detection first · #141 JF9 screenshot/offer parsing + prefilled /afford loan · #142 JF10 impact not minus (view-models)

**Aibek:** #137 JF5 home value / owner-cost data · #138 JF6 statement first + LLM follow-ups · #139 JF7 detect income and debts from the statement · #143 JF11 bank connection (Plaid Sandbox) + Pro = automation · #144 JF12 payoff planner default

**Kiko:** #145 JF13 closest-life cards · #146 JF14 results show impact · #147 JF15 landing shows the product · #148 JF16 declutter + one stepper · #149 JF17 debt entry as confirm

**Suggested order (demo path first):** #133 + #134 → #138 → #142 + #146 → #148 + #147 → the rest. #136 + #137 change a contract; schedule them together.

**Not filed (check first):** F18, a "My profile" tab. A teammate may already be building it. The duel game was skipped on purpose because a teammate is reworking it.

## Full log

Source: **judge** = Amir's comment during the walkthrough; **presenter** = noticed while presenting or on the solo pass, in line with the judge's comments.

| F# | Screen | Comment | Source | Issue |
|---|---|---|---|---|
| 1 | Landing `/` | The hero sells only the game; the paid product (forecast, Next Moves, Afford, Loan Lab) appears only as step 3. A judge may read it as "just a game". "▸ ALL SCREENS" looks like a dev menu; two CTAs with no clear primary. | presenter | #147 |
| — | Game `/play` (duel) | Skipped: a teammate is already reworking it. | note | n/a |
| 2 | S5 `/me/guess` | The big number and slider show $3,980, but the card says "Your guess $3,870" until "Update my guess" is pressed. | presenter | #133 |
| 3 | S5 `/me/guess` | "Update my guess" is a bare text link; the card doesn't update live. | presenter | #133 |
| 4 | S5 `/me/guess` | **"How does it give 'our estimate' if it doesn't know anything about me?"** `compareSelfGuess` compares with the current profile, which before any input is the sample profile. Requested flow: step 1 asks only the gut guess → invite the user to really count it → reveal the gap once the numbers are theirs → project toward their goals. | judge | #133 |
| 5 | S6 `/me/closest` | **"Not really personalized."** Six fixed sample lives, all in Dallas–Fort Worth; the only personal input is the sort order. Build the starting life from the user's own facts. | judge | #135, #145 |
| 6 | Ladder order | **Upload the bank statement before the closest-life step, then personalize from it.** Today the upload is the last step. | judge | #138 |
| 7 | S6 + model | **"What if the person owns a house?"** No tenure, no home value, mortgage only as a debt kind; home equity is missing from net worth. | judge | #136, #137 |
| 8 | S6 `/me/closest` | The art doesn't match the household (a studio shown as a family house with a swing and kid's bike). | presenter | #145 |
| 9 | S6 `/me/closest` | Two identical-looking "1 adult · 1-bedroom, DFW" cards at $4,779 and $1,616, with nothing saying why. | presenter | #145 |
| 10 | S6 `/me/closest` | "Start from this life →" looks disabled; the closest card isn't preselected. | presenter | #145 |
| 11 | S7 `/me/sliders` | **Spending should be imported from the bank statement**; unclear items asked by the LLM; manual entry as the fallback. | judge | #138 |
| 12 | Ladder / profile | **"Where is the step that asks about us — profession, what we earn? How does it know that?"** It doesn't: `takeHomePay = outflow / 0.9` (`packages/engine/cost.ts:193`, a placeholder in `assumptions.ts:145`), so "Left over" is always about 10% of pay. Needs an "About you" step. Gender is an open decision (no math uses it). | judge | #134, #139 |
| 13 | S8 `/me/balance` | **Debts should be easier to fill in or filled automatically, "import from all the banking apps"; least time to the product.** (a) detect from the statement, (b) screenshot/PDF parsing, (c) bank aggregator, (d) faster manual form. | judge | #139, #141, #143, #149 |
| 14 | S8 `/me/balance` | Age and pay come after spending and can be skipped (so the forecast falls back to #12). Stepper states are inconsistent. | presenter | #134, #148 |
| 15 | S10 `/future` | **"Why −$18K in a year if today is $24,000? Is it a mistake?"** The math is right: $6,000 pay against $9,716 outflow (the sample family's spending kept after a skipped step) gives −$3,716 a month. The screen gives no reason, so a correct result reads as a bug. Needs a "why" line. | judge | #142, #146 |
| 16 | S7→S10 flow | The user's pay is combined with a stranger's spending; the saved $3,870 guess is never used (with it: about +$2,100 a month). | presenter | #133 |
| 17 | S10 `/future` | Mixed labels: "Computed from your inputs with fixed assumptions" vs "AI estimate"; "estimate" tag on typed inputs; tooltip "In 0.2 years". | presenter | #142, #146 |
| 18 | New: Profile tab | **A "My profile" tab:** new job or raise, side hustles, daily and weekly spending. Check with the teammate first. | judge | not filed |
| 19 | Whole app | **More straightforward, less crowded.** One main message and one main action per screen. | judge | #148 |
| 20 | S11 `/afford` | **"It's still showing minus… it should show me how it would affect me."** The headline is the delta vs not buying, which is negative for every purchase. Lead with with vs without, the goal effect, and the cost in words. | judge | #142, #146 |
| 21 | `/tools/subscriptions` | **"Why does it ask me to find the subscriptions? It should find them for me."** Detection exists but comes 4th, after a manual checklist. | judge | #140 |
| 22 | Product principle | **"The user should do the least hand work; automate everything that can be automated."** Connect or upload once → detect everything → the user confirms. | judge | #132 (all) |
| 23 | `/me/upload` | The stepper reads "4 of 4 steps" with "3 Your spending" here, but "1 of 5" with "3 Your month / 5 Make it exact" on S5–S8. | presenter | #148 |
| 24 | `/loan` planner | At the default $0 extra, Avalanche, Snowball and Minimums show identical columns (March 2030, $7,257, 40 months). It looks broken. | presenter | #144 |
| 25 | `/loan`, `/afford` | Loan offers are typed by hand; `/afford` → Loan shows empty APR and term with "Fix the highlighted fields" before any typing. Prefill from Loan Lab or typical values; parse offer screenshots. | presenter | #141 |
| 26 | `/afford` | Car $28,000 in cash: "Not right now" but "Cheapest way to pay: Cash · Same as your plan". It recommends the option that failed. | presenter | #142 |
| 27 | `/decide` | "+$34,436" on one path and "−$34,436" on the other: the same signed-delta problem as F20. | presenter | #142, #146 |
| 28 | `/tools/overpaying` | Asks bedrooms, adults and children again ("We have not asked about your household yet"); it should prefill from the profile. | presenter | #134 |
| 29 | `/loan` | Shows debt load 9.7% → 26.3% but not the impact: Offer A ($863 a month) leaves $121 of a $984 monthly surplus. | presenter | #142, #146 |
| 30 | `/tools` | The statement ("Are my numbers right?") is the 7th of 7 tools; with F6 it should be the front door. | presenter | #138 |
| 31 | `/pro` | Pro adds only a wishlist ("Forecast, moves… stay free"), a weak answer to "what do people pay for?". Pro should be the automation: connected bank, auto check-in, alerts. | presenter | #143 |
| 32 | `/checkin` | The monthly check-in needs a manual re-upload ("Add November statement"); with a bank connection it should update itself. | presenter | #143 |

## Test profile used on `/afford`

A single 30-year-old in Dallas (ZIP 75205), all values typed: take-home pay $5,200 a month; spending $3,710 (rent + utilities $1,750, car $450, groceries $450, eating out $300, subscriptions $60, everything else $700); credit card $4,200 at 22.8% ($126 minimum); car loan $14,000 at 7.5% ($380 a month); cash $8,500; retirement $22,000, 30% of the surplus saved. Left over is about $984 a month and net worth today is $12,300. Checked by hand: a $1,200 trip in cash gives "Yes, it fits" at −$1,241 after 1 year and −$1,739 after 10 years compared with not buying; a $28,000 car in cash gives "Not right now" (cash below one month of costs).
