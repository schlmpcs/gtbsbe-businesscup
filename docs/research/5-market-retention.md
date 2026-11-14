# 5. Market, comparables, retention and pricing research

Researched 2026-11-14 by web search. Notes on method:
- Direct page fetches to sacra.com, revenuecat.com and ffnews.com were blocked in this sandbox, so several figures come from search-engine snippets of those pages rather than the full page. These are marked "(snippet)". Re-check them before putting them on a slide.
- **UNVERIFIED** = third-party estimate, self-reported marketing claim, or a figure I could not trace to a primary source.
- "Est." = analyst estimate (Sacra, Growjo and similar), not a company disclosure.

---

## 1. Market size

### 1a. Market-research reports (treat with skepticism)
| Source | Figure | Comment |
|---|---|---|
| Ken Research / Expert Market Research, "USA personal finance software" | ~$300.4M (2025), ~$414M by 2031, CAGR ~5.5% | **Not credible as a total.** Rocket Money alone reported $96.5M revenue in a single quarter (Q1 2025, see 2a), a ~$386M run-rate. https://www.kenresearch.com/industry-reports/usa-personal-finance-software-market.md |
| Market.us, "US Personal Finance Management" | $0.63B (2025), CAGR 5.5% | Same problem. https://market.us/report/personal-finance-management-market/ |
| IBISWorld, "Personal Finance & Money Management Software Developers in the US" | $4.8B (2025) | Broad industry definition (includes tax and other software). https://www.ibisworld.com/industry-statistics/market-size/personal-finance-money-management-software-developers-united-states/ |

**Recommendation:** don't cite a press-release TAM. Use a **bottom-up "revenue already being paid"** figure built from company-reported numbers (1c).

### 1b. Mint shutdown (the demand shock)
- Intuit announced in Nov 2023 that it was winding down Mint and moving users to Credit Karma. Bloomberg reported Mint had **3.6M monthly active users in 2021**. https://www.bloomberg.com/news/articles/2023-11-01/intuit-winds-down-personal-finance-app-mint-shifts-users-to-credit-karma
- Shutdown date: first announced as Jan 1, 2024, then extended. Intuit told Engadget the app would be available until **March 24, 2024**; other sources say March 23. https://www.engadget.com/intuit-is-closing-down-mint-its-popular-free-budget-tracking-app-054145229.html
- Credit Karma "does not offer the ability to set monthly and category budgets" (Intuit, via Engadget/Bloomberg coverage). That left a gap in budgeting.
- Effect on Monarch: its paying base reportedly grew **~20x in the year after the Mint shutdown** (revenuememo.com, citing Sacra; **UNVERIFIED** magnitude). https://www.revenuememo.com/p/who-owns-monarch-money . American Banker reported that Monarch saw "a boost in users since the Mint announcement" (no number). https://www.americanbanker.com/news/mints-shutdown-is-an-opportunity-for-banks
- Migration split (YNAB ~15%, Monarch ~12%, Copilot ~8%) from pocketclear.app: **UNVERIFIED** (no methodology). https://pocketclear.app/blog/mint-refugees-2026-update.html
- Pitch takeaway: 3.6M people were using a free tool and many proved willing to pay ~$100/yr. That is evidence of willingness to pay. It does not show demand at our price point, which is still to be tested.

### 1c. Bottom-up: US consumers already pay real money for these apps (company-reported unless marked)
| App | Revenue / ARR | Paying subs | Implied ARPU/yr | Source |
|---|---|---|---|---|
| Rocket Money | $96.5M revenue in Q1 2025 (+41% YoY, from $68.2M), ≈$386M run-rate | 4.1M premium members at end of Q4 2024 (+1M YoY) | ≈$94 (my calc: 4×96.5M / 4.1M) | Rocket Companies 10-Q Q1 2025 (snippet) https://www.sec.gov/Archives/edgar/data/1805284/000180528425000065/rkt-20250331.htm ; Q4 2024 release https://capedge.com/filing/1805284/0001805284-25-000004/RKT-8K/file/2 |
| Monarch | $100M ARR (company announcement, Oct 1, 2026); Sacra est. ~$60M ARR at end of 2025 | 500k+ paying (Sacra, Mar 2026, snippet); "1M+ members" | ≈$100–200 (list price $99.99/yr) | dealroom.co news https://dealroom.co/news/158324-monarch-hits-100m-arr-buys-hmbradley-team-in-first-acquisition/ ; https://sacra.com/c/monarch-money/ |
| Cleo (US-focused AI money app) | Company said ARR was "reaching $250M" in Jul 2025; Sacra est. 2025 revenue $254.1M, end-2025 run-rate $333M | 1.3M paying at end of 2025 (from 743k at end of 2024), Sacra est. | n/a: **61.7% of 2025 revenue is cash-advance "express fees"**, not subscriptions | https://sacra.com/c/cleo (snippet); https://www.arr.club/cleo/cleo-arr-hits-250m |
| YNAB | **UNVERIFIED** ~$49M (Growjo-style estimate) | not disclosed | list price $109/yr | https://www.useluminix.com/reports/industry-analysis/competitive-landscape-personal-finance-and-budgeting-apps-2026 |
| Copilot Money | no official ARR | ~100k subscribers (early 2024, secondary) | list price $95/yr | https://yespress.io/copilot-money |
| Credit Karma (before acquisition, ad/lead-gen model, free) | ~**$1B unaudited revenue in CY2019** (+20% YoY) | 100M+ members, 37M MAU | — | Intuit press release, Feb 24, 2020 https://www.businesswire.com/news/home/20200224005884/en/Intuit-Acquire-Credit-Karma |

**Bottom-up conclusion:** the reported or estimated subscription revenue of Rocket Money (~$386M run-rate), Monarch ($100M), Cleo subscriptions (~38% of ~$333M), YNAB (~$49M est.) and Copilot (~$10M, my rough calc) already comes to **roughly $0.6–0.7B/yr of US consumer spending on PFM subscriptions**, before counting EveryDollar, Quicken/Simplifi and others. This is an order-of-magnitude figure assembled from mixed-quality sources. Label it that way.

### 1d. App-store spending (Sensor Tower)
- Sensor Tower publishes only weekly top-5 snapshots for "Personal Finance – Budgeting and Planning" (US, unified iOS+Android). Examples from Q1 2025: EveryDollar weekly revenue peaked ~$342K (mid-January, the New Year effect); Rocket Money ~$172K (early March); YNAB ~$156K (early February). Q2 2025: Rocket Money ~$196K/week peak; Monarch ~$117K/week peak; Copilot $152K→$88K. https://sensortower.com/blog/2025-q1-unified-top-5-personal%20finance%20budgeting%20and%20planning-revenue-us-63e363f0e1714cfff1979caa ; https://sensortower.com/blog/2025-q2-unified-top-5-consumer%20finance-revenue-us-63dd47dee1714cfff1d1c6df
- Caveats: these pages are AI-generated summaries, they cover in-app store revenue only, and web billing is excluded. Monarch and YNAB sell heavily on the web, so the totals understate their revenue. No credible full-year US category total was found. **UNVERIFIED** as a total.
- Useful detail: **January is the budgeting season** (EveryDollar revenue fell from $342K/wk in January to ~$69K/wk in Q2). Plan launch and paid acquisition around New Year and tax season.

---

## 2. Finance and adjacent apps at ~$100M+ ARR: how they got there
- **Monarch ($100M ARR, Oct 2026):** a premium-only subscription with no free tier (7-day trial). Price $14.99/mo or $99.99/yr, plus a Plus tier at ~$199/yr (secondary sources). Growth came from the Mint shutdown and Reddit/word of mouth (Sacra snippet, "Reddit consensus drove Monarch's 20x growth"). It raised a $75M Series B at a reported $850M post-money valuation (May 2025). **About 500k–1M subscribers at a ~$100 ARPU reached $100M.**
- **Rocket Money:** a freemium subscription tracker plus bill negotiation, with "pay what you think is fair" premium at ~$6–12/mo (review sites). It acquired users through heavy paid TV and social ads, plus Rocket Companies cross-sell. **4.1M premium members (end of 2024); ~$94 implied ARPU.**
- **Cleo:** a Gen-Z/millennial "sassy" chat AI with tiers at $5.99 / $8.99 / $14.99 per month (Plus also $44.99/yr). Most revenue comes from cash advances. Sacra est.: **average CAC $17 in 2025 (up from $11)**, and 51% conversion to subscription (snippet). https://sacra.com/c/cleo . Lesson: low-price consumer finance subscriptions can scale, but Cleo's economics depend on advances. We are not a lender.
- **Credit Karma:** free to members. It reached ~$1B revenue from lender lead-gen with 100M+ members (2019). Lesson: an alternative revenue path (affiliate) exists, **but it conflicts with Golden Rule 7 (no lender recommendations)**. Mention it only as a possible future option, if at all.
- **Duolingo (gamification benchmark, not finance):** 11.5M paid subscribers in Q3 2025 (+34% YoY), 50.5M DAU (+36%). **12.2M paid subscribers at end of 2025; FY2025 revenue $1,037.6M.** https://www.sec.gov/Archives/edgar/data/1562088/000162828025049514/q3fy25duolingo9-30x25share.htm ; https://www.sec.gov/Archives/edgar/data/1562088/000162828026012513/q4fy25duolingo12-31x25shar.htm . Freemium game loop → ~8–9% paid conversion of MAU (Duolingo has published figures in this range in filings; exact current % **UNVERIFIED** here).
- **Noom (cautionary):** Sacra est. ~$1B ARR in 2023 with ~1.5M subscribers. Ad spend grew from ~$5M (2017) to ~$330M (2023) (Sacra snippet, est.). It relied on paid acquisition and annual/multi-month prepay, then faced subscription-practice complaints. In 2022 it settled a class action over auto-renewal for $62M; that figure is from my background knowledge and was **not re-verified in this session (UNVERIFIED)**. Lesson: prepaid commitment without real value leads to legal and brand risk.
- **No pure "Duolingo for money" app found at $100M ARR.** Long Game (gamified prize-linked savings) was acquired by Truist; no revenue or ARR is public.

---

## 3. Retention mechanics that drive renewal (evidence)

### 3a. Subscription benchmarks (RevenueCat; mostly app-store data)
- Only **13.8% of monthly subscribers remain after 12 months vs 33.9% of annual subscribers** (RevenueCat; secondary snippet, 2024 data). https://www.revenuecat.com/blog/growth/annual-vs-monthly-renewal-rates
- SOSA 2025: low-priced annual plans retain **up to 36%** after one year, while high-priced monthly plans retain **6.7%**. **Nearly 30% of annual subscriptions are cancelled in the first month** (auto-renew turned off). https://www.revenuecat.com/blog/company/the-state-of-subscription-apps-2025-launch ; https://subscriptioninsider.com/article-type/news/revenuecats-state-of-subscription-apps-2025-report-ais-dominance-retention-challenges-and-the-shift-away-from-pure-subscriptions
- SOSA 2026 (2025 data): **first-year annual retention fell from 31% to 28%**. AI apps reach 21.1% vs 30.7% for non-AI apps. Median Day-35 trial→paid: **10.7% hard paywall vs 2.1% freemium**. Trials of 17–32 days: median 42.5% trial conversion (snippets). https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026 ; https://ppc.land/ai-apps-earn-41-more-per-user-but-churn-30-faster-revenuecat-finds/
- **95% of annual subscribers who cancel never return** (RevenueCat via ppc.land). https://ppc.land/95-of-annual-app-subscribers-who-cancel-never-return-revenuecat-finds/ . Implication: the fight is won before the renewal date, not with win-back.
- Monthly plans fell from 21.1% of subscription revenue (2023) to 11.7% (2025) (Adapty data via secondary source; **UNVERIFIED**).
- No finance-category breakout or web-billing-specific annual/monthly churn split was accessible (it sits in the paid SOSA PDF). **UNVERIFIED.**
- Note for the "AI apps churn faster" finding: our product is a deterministic forecaster with AI used only for language, so we can position it as "not a chatbot".

### 3b. Behavioral-finance evidence (peer-reviewed)
- **Reminders:** Karlan, McConnell, Mullainathan & Zinman, "Getting to the Top of Mind", *Management Science* 62(12), 2016. Monthly reminders raised savings **6%**. Reminders naming the **specific goal** raised savings **16%**, while generic reminders had no effect in that arm. Extra late reminders added nothing. https://www.nber.org/papers/w16205 . This directly supports a **monthly check-in that names the user's own goal and dollars**.
- **Commitment devices:** Ashraf, Karlan & Yin, "Tying Odysseus to the Mast", *QJE* 121(2), 2006. The SEED commitment account raised balances **81 percentage points** vs control after 12 months; 28% of those offered took it up. https://www.povertyactionlab.org/evaluation/commitment-savings-products-philippines
- **Prize-linked savings:** Cole, Iverson & Tufano, *Management Science* 2022 (South Africa). PLS users raised total savings by **~1% of annual income**; PLS substituted for lottery spending and did not cannibalize other savings. https://scholarsarchive.byu.edu/facpub/8970 . A UK MaPS evidence review finds PLS effects somewhat larger than reward schemes but calls the evidence base small. https://evidence-hub.maps.org.uk/en/research-library/review/how-effective-are-reward-based-and-prize-linked-savings-schemes
- Long Game's claim of "+20% savings/yr" is self-reported: **UNVERIFIED**. https://macventurecapital.com/?p=8874
- YNAB's claim that the "average YNABer saves $600 in first month / $6,000 first year" comes from a self-reported survey. Wording varies between "first month" and "first two months" across YNAB pages: **UNVERIFIED**, but it shows that **YNAB sells renewal on dollars saved**. https://www.ynab.com/campaign/ynab-stats

### 3c. Gamification and streaks (engagement, not renewal)
- Duolingo: learners who reach a **7-day streak are 2.4x more likely to continue the next day** (Duolingo blog). A streak-wager A/B test produced **+14% D7 retention**. Decoupling the streak from the daily goal gave +3.3% D14 retention and +1% DAU. https://blog.duolingo.com/improving-the-streak ; https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals
- Caveat for judges: these are **engagement** metrics. No published Duolingo data links streaks to **subscription renewal**. This is consistent with the judges' point.

---

## 4. Plan mix, cancellations, and the law

### 4a. Plan mix
- Monarch: $14.99/mo vs $99.99/yr (annual = 44% off). YNAB: $14.99/mo vs $109/yr (39% off). Cleo Plus: $5.99/mo or $44.99/yr. GeoGuessr: web vs mobile price gap (Reddit; **UNVERIFIED**). Comparable apps discount annual plans by **~40–45%** to push users onto annual billing.
- Our pricing, $39.99/yr vs $6.99/mo ($83.88/yr), gives the annual plan a **52% discount**. That is slightly steeper than peers, which is fine for pushing the annual plan.
- On the web (no app-store trust layer), RevenueCat argues monthly is an easier first step (blog snippet). Offer monthly, but make annual the default.

### 4b. FTC "click-to-cancel": status as of Nov 2026
- **Vacated.** On July 8, 2025, the 8th Circuit vacated the FTC's amended Negative Option Rule in its entirety, on procedural (APA / preliminary regulatory analysis) grounds, days before compliance was due on July 14, 2025. https://www.steptoe.com/en/news-publications/ftcs-click-to-cancel-rule-vacated-by-eighth-circuit.html ; https://www.fenwick.com/insights/publications/eighth-circuit-vacates-ftcs-click-to-cancel-rule
- **Feb 2026:** the FTC formally restored the pre-2024 (1973) Negative Option Rule text. **March 11, 2026:** the FTC issued a new **ANPRM** (Federal Register, March 13, 2026) asking whether to mandate click-to-cancel and whether **"saves" (retention discounts before honoring a cancel)** are unfair or deceptive. https://www.cov.com/en/news-and-insights/insights/2026/03/ftc-launches-new-rulemaking-on-the-negative-option-rule ; https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/ftc-relaunches-negative-option-rulemaking-with-new-questions-new-branding.md
- No proposed or final rule was found as of 2026-11-14 (**check ftc.gov**). ROSCA and FTC Act §5 enforcement continue.
- **California ARL (AB 2863), effective July 1, 2025:** requires separate express affirmative consent to auto-renewal, with records kept of that consent. Free trials that convert are covered. It adds a "click to cancel" requirement (online cancellation where the user signed up), annual reminders that state product, frequency and amount, and a ban on misrepresenting material terms. https://btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect ; https://fenwick.com/insights/publications/california-tightens-requirements-for-automatically-renewing-subscriptions . Exact cancellation mechanics should be checked against Cal. Bus. & Prof. Code §17600 et seq.
- Design implication: build to California's standard nationally. That means a separate auto-renew checkbox, a one-click cancel in Settings, and a pre-renewal email for the annual plan. Offer a pause or downgrade at most once, keep it skippable, and keep the cancel button visible.

---

## 5. Comparable prices (to justify $39.99/yr)
| Product | Price | Source |
|---|---|---|
| Monarch Core | $14.99/mo or $99.99/yr; Plus ~$199/yr (secondary) | https://getfinny.app/blog/monarch-money-pricing-2026 |
| YNAB | $14.99/mo or $109/yr; 34-day free trial (web) | https://www.finder.com/budgeting/ynab-review |
| Copilot Money | $13/mo or $95/yr (secondary) | https://www.mezzi.com/blog/copilot-money-2026-pricing-change-what-annual-subscribers-should-do |
| Rocket Money Premium | "pay what's fair" ~$6–12/mo (review sites) | https://thecollegeinvestor.com/22660/rocket-money-review/ |
| Cleo | Plus $5.99/mo or $44.99/yr; Pro $8.99/mo; Builder $14.99/mo | https://intercom-help.meetcleo.com/en/articles/11864428-what-do-i-get-with-a-cleo-plus-subscription |
| Duolingo Super (US) | ~$83.99/yr is the most-cited figure; App Store tests $79.99–$119.99 (**price varies by test, UNVERIFIED exact**) | https://www.thepricer.org/how-much-does-super-duolingo-cost/ |
| NYT Games | ~$50/yr individual ($4.99/mo list); family $120/yr | https://www.niemanlab.org/2025/09/the-new-york-times-launches-a-family-subscription-with-separate-wordles-for-everyone/ |
| GeoGuessr Pro Unlimited | $35.88/yr ($2.99/mo yearly) until Jan 2026, then **$47.88/yr** ($3.99/mo) | https://geoguessr.freshdesk.com/support/solutions/articles/206000067275-price-changes-2026 |

**Positioning:** $39.99/yr sits at "game subscription" price (GeoGuessr $47.88, NYT Games ~$50) and at **40–60% below the finance incumbents** (Monarch $99.99, YNAB $109, Copilot $95). That is a credible "budget planner for people who won't pay $100" wedge. Risk: the low price requires ~2x Monarch's subscriber count for the same ARR (see below).

---

## Path to $100M ARR (math)

Assumptions: web billing at ~3% + $0.30 per charge (typical card processing, my assumption), so net ≈ $38.5 per annual sale. Monthly subscribers are counted at a run-rate of $6.99×12 = $83.88.

| Plan mix (annual / monthly) | Blended ARR per paying sub | Paying subs for $100M ARR |
|---|---|---|
| 100% / 0% | $39.99 | **2.50M** |
| 70% / 30% | $53.16 | **1.88M** |
| 50% / 50% | $61.94 | **1.61M** |

- **Share of target population:** US adults 25–44 ≈ **90.9M** (Vintage 2024 estimates via secondary source, 46.7M aged 25–34 + 44.2M aged 35–44; **pull the exact row from census.gov**). https://theworlddata.com/us-population-over-18/ . 1.88M subscribers = **~2.1% of US 25–44 year-olds** (2.75% at an all-annual mix).
- **Comparison:** Rocket Money has 4.1M premium members (2024), Cleo 1.3M paying (2025), Monarch 500k+ paying (2026), and Duolingo 12.2M paid globally (2025). **1.6–2.5M paying US subscribers is between Cleo and Rocket Money**, so it is ambitious but has precedent.
- **Steady-state acquisition need:** at a 35% annual renewal rate (≈ RevenueCat 33.9% median), keeping 1.88M subscribers needs ~1.2M new paid subscribers per year. At a 55% renewal rate (the target, from the retention design below) it needs ~0.85M per year.
- **Funnel:** at the RevenueCat freemium median of 2.1% free→paid (Day 35), 1.2M paid needs ~57M game players per year. At a 10.7% hard-paywall-after-trial rate on qualified users (people who completed "guess your own life"), it needs ~11M qualified users per year. The game has to deliver tens of millions of plays, which is GeoGuessr/Wordle territory. The streamer/TikTok loop is the only way this works without Noom-scale ad spend.
- **LTV (net $38.5 per annual renewal; geometric LTV = 38.5 / (1 − r)):** r = 28% → $53; r = 34% → $58; r = 50% → $77; r = 60% → $96. Monthly-plan LTV at 13.8% 12-month survival is roughly $6.99 × ~4–5 months ≈ $30–35 (my rough estimate).
- **LTV > CAC:** blended CAC must stay under **~$20–30** for a ≥2–3x LTV/CAC ratio. Benchmark: Cleo's estimated average CAC was $17 in 2025 (Sacra est.). The game makes organic CAC near zero, so paid CAC can be mixed in only up to the blended cap.
- **Upside levers (state as options, not as the plan):** a price step-up to $59.99 after a proven forecast-accuracy track record (GeoGuessr raised its price 33% in 2026), a family/couple plan (NYT and Duolingo family plans), and January "New Year budget" seasonality.

---

## Retention design recommendations (with evidence)

1. **Default to the annual plan, offer monthly.** Annual subscribers are ~2.5x more likely to remain after 12 months (33.9% vs 13.8%, RevenueCat). Monarch, YNAB and Cleo all discount annual by ~40–45%; ours is 52%.
2. **A monthly "Forecast vs Actual" check-in, tied to payday and the user's named goal, instead of a daily streak.** Reminders that name a specific goal raised savings 16%, and generic ones had no effect (Karlan et al. 2016). Extra reminders added nothing, so **one well-timed monthly ritual beats daily nags**. This matches the judges' point that weekly use with renewal beats daily use with churn.
3. **A renewal-day "receipt of value".** Before renewal, show the dollars the forecasts and moves helped with (e.g. "forecast accuracy ±$X; moves completed worth $Y/yr"). Everything is computed by the engine, with no LLM numbers. YNAB markets renewal value in dollars ("$600/$6,000", self-reported). 95% of annual subscribers who cancel never return, so value has to be proven before renewal.
4. **Commitment devices: user-set goals with a date and an amount ("I'll have $3k emergency fund by June").** Progress shows in each check-in. SEED commitment accounts raised savings by 81 points (Ashraf, Karlan & Yin 2006). This is a soft, in-app commitment and does not hold money.
5. **A low-bar weekly streak (week counts if you open the forecast once) with freezes.** Duolingo reports 7-day streakers are 2.4x more likely to return, and lowering the bar raised streak keeping. Present it as an engagement aid only. Don't claim it drives renewal, because no evidence was found for that.
6. **Prize-linked monthly check-in (optional, legal review needed):** a sweepstakes entry for completing the monthly check-in, which supports evidence-based savings framing (Cole et al. 2022, +~1% of income). Must be no-purchase-necessary under sweepstakes law. Mark as a future option.
7. **Kill the first-month cancel spike.** ~30% of annual subscribers cancel in month 1 (RevenueCat). The first 30 days must reach the "aha" moment: the first check-in, the first ranked move and the 10-year view. Possibly add a 7–14-day trial so conversions happen after users have seen value (trials of 17–32 days convert at a 42.5% median, though that measures conversion, not renewal).
8. **Compliance as a trust feature.** Build to California ARL 2025 nationally: separate auto-renew consent, a 1-click online cancel, a pre-renewal reminder with amount and date, and at most one skippable pause/downgrade offer. The FTC's 2026 ANPRM is questioning "saves", so avoid dark patterns. Noom's legal history (UNVERIFIED specifics) shows the risk.
9. **Don't build an AI-chatbot product identity.** RevenueCat 2026 reports AI apps retain worse on annual plans (21.1% vs 30.7%). The pitch "deterministic engine, AI only for words" is also a retention argument.
10. **Seasonality:** run acquisition in January and around tax season (EveryDollar's US weekly revenue peaked in mid-January at ~5x its Q2 level, per Sensor Tower). Plan the first check-ins so that the first annual renewal comes after a year of check-ins.

---

## Key gaps / to verify before slides
- Monarch's subscriber count at $100M ARR (company press release text, on ffnews/monarch.com, which was blocked here).
- RevenueCat finance-category and web-billing breakouts (paid PDF).
- The exact Census 25–44 (or 25–45) population figure.
- Rocket Money FY2025 revenue and member count (Rocket 10-K FY2025).
- Duolingo's current paid-share-of-MAU; the Noom settlement amount.
