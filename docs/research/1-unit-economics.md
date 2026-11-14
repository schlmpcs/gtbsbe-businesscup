# Unit economics benchmarks for a $39.99/yr web subscription (research, 2026-11-14)

## Method and reliability notes

- **Access limits.** In this session, direct page fetches to `revenuecat.com` and `adapty.io` were blocked by the network allowlist (DNS refused). All figures below come from web-search result snippets, either quoting the primary page or a secondary write-up of it. Every row names the page the figure was attributed to.
- **Before putting a number on a slide, open the primary URL and confirm it.** This matters most for any row marked *secondary*.
- **Confidence labels:**
  - **[P]** the snippet is from the primary publisher's page (RevenueCat, Adapty, FunnelFox, Paddle, the company itself).
  - **[S]** the figure comes from a secondary summary of a primary report.
  - **UNVERIFIED** I could not confirm the figure, or the sources conflict.
- **Report editions.** RevenueCat SOSA 2026 was published in March 2026 and covers mostly 2025 data: 115,000+ apps, $16B+ revenue, 1B+ transactions. Adapty SOIS 2026 covers 2025 data: 16,000+ apps and about $3B of revenue, mostly iOS.

---

## 1. RevenueCat: State of Subscription Apps (SOSA) 2026, with 2025 where noted

Main sources:
- SOSA 2026 report: https://www.revenuecat.com/state-of-subscription-apps
- RevenueCat's own summary, "The State of Subscription Apps in 10 minutes: lessons, trends, and benchmarks for 2026": https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026

### Conversion

| Metric | Number | What it measures | Source |
|---|---|---|---|
| Download-to-paid by paywall type | **10.7% hard paywall vs 2.1% freemium** | Median Day-35 conversion. RevenueCat's blog wording is "median Day-35 trial-to-paid conversion". Secondary write-ups say it is "downloads to paid within 35 days". The paywall-type split points to download-to-paid. | [P/S] RevenueCat SOSA 2026, blog above. The definition is ambiguous: cite it as "download-to-paid, D35" and flag that. |
| Same metric, 2025 edition | 12.1% hard vs 2.2% freemium | Median download-to-paid | [S] attributed to SOSA 2025, via buildmvpfast.com / RocketShip HQ summaries (https://www.rocketshiphq.com/revenuecat-state-of-subscription-apps-2025-summary/). UNVERIFIED against the primary report. |
| Overall download-to-paid (D35) | **median 2.0%; top 10% > 9.1%** | Share of installs that pay within 35 days, all apps | [S] secondary table summarizing SOSA 2026 (found via search; e.g. https://chuvak-pavel.medium.com/state-of-app-monetization-2026-key-trends-from-revenuecat-and-adapty-8bdc23a4bb6f). UNVERIFIED in primary. |
| Download-to-trial by price tier | **8.9% higher-priced vs 4.3–4.4% lower-priced** | Median share of downloads that start a trial | [S] SaaStr summary of SOSA 2026 (https://www.saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth/). The low-price figure is 4.4% in one source and 4.3% in another: UNVERIFIED exact value. |
| Trial-to-paid by trial length | **42.5% (17–32-day trials) vs 25.5% (≤4-day trials)** | Median trial-to-paid conversion | [P] RevenueCat 2026 blog above |
| Share of apps with short trials | 46.5% in 2026, up from 42.1% in 2025 | Share of apps whose trials are 4 days or shorter | [P] RevenueCat 2026 blog |
| Trial cancellations on Day 1 | 55% of all trial cancellations | Timing of trial cancels | [S] 2026 coverage (ppc.land, heise.de) |
| Overall trial-to-paid, all apps | **37.3%** (SOSA **2024** edition, ~30k apps) | Median trial-to-paid | [S] cited by secondary sources. I found no blended 2026 figure: UNVERIFIED for 2026. |
| Trial-to-paid by category (2025 ed.) | Travel 48.7%, Media & Ent. 43.8%, Health & Fitness 39.9% | Median trial-to-paid | [S] RocketShip HQ SOSA 2025 summary (URL above) |
| Same-day trial starts | ~82% of trials start on Day 0; Business ~90% same-day | Trial timing | [S] secondary summaries of SOSA 2026 |

### Retention

| Metric | Number | What it measures | Source |
|---|---|---|---|
| Annual plans, year-1 retention (all apps) | **28%**, down from 31% the previous year | Median share of annual subscribers who renew at month 12 | [P/S] RevenueCat 2026 blog; ppc.land / heise coverage |
| Annual by paywall type | Freemium 28%, hard paywall 27% | Year-1 median | [P] RevenueCat 2026 blog |
| Annual, AI vs non-AI apps | 21.1% AI vs **30.7% non-AI** | Year-1 median, annual plans | [S] TechCrunch 2026-03-10 (https://techcrunch.com/2026/03/10/ai-powered-apps-struggle-with-long-term-retention-new-report-shows) |
| Monthly, AI vs non-AI apps | 6.1% AI vs **9.5% non-AI** | Year-1 (month-12) retention, monthly plans | [S] TechCrunch / aibase summaries of SOSA 2026 |
| Monthly plan year-1 range | **median 6–14%**, top quartile 11–25% | Month-12 retention of monthly subscribers. The median varies by category, hence a range. | [S] search snippet attributed to RevenueCat SOSA 2026 page. UNVERIFIED exact chart. |
| Annual plan year-1 range | median 20–40% across categories | Year-1 retention, annual | [S] same as above |
| **"Low price retains 36% vs 23%"** | **Low-priced annual plans 36%, mid-priced 26%, high-priced 23%** | Median **year-1 retention (first annual renewal)** of annual plans, by the app's price tier. Not a monthly metric. | [P] RevenueCat, "Average Subscription Renewal Rates by App Category (2026 Benchmarks)" (https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category). Wording found: "Apps with lower pricepoints retain better on annual plans (36% retention, versus 23% for high-priced apps and 26% for mid-priced)". SOSA 2026 labels the metric "Year 1 retention"; the blog calls it "first renewal rate". The SOSA **2025** edition already said "Most apps with cheap annual plans keep up to 36.0% of users subscribed after a year" (https://www.revenuecat.com/blog/company/the-state-of-subscription-apps-2025-launch). The 2025 edition paired it with "high-priced monthly plans: just 6.7% stick around", not 23%. The price-tier cut-offs (what counts as "low") were not visible: UNVERIFIED. |
| Business category renewal | **61% monthly, 40% annual** | Median first-renewal rate, Business apps. RevenueCat: "business apps are universally 'sticky', consistently ranking at or near the top for retention". | [P] same RevenueCat renewal-rates blog |
| Business upper quartile (2024 ed.) | 74% first renewal | Upper-quartile first renewal | [P] RevenueCat SOSA 2024 (https://www.revenuecat.com/state-of-subscription-apps-2024) |
| Annual cancellations in month 1 | 35% of all annual cancellations happen in month 1 (2026); "nearly 30%" in the 2025 ed. | Timing of cancels: auto-renew turned off early | [S] 2026 coverage; [P] 2025 launch blog |
| Reactivation after annual cancel | ~5% (95% never return); monthly subscribers return at 4× that rate | Win-back | [S] 9to5Mac 2026-05-27 (https://9to5mac.com/2026/05/27/new-report-shows-annual-app-subscribers-rarely-return-after-they-cancel/) |
| Monthly churn | "around 6 to 10 percent" per month across most consumer categories | Monthly churn | [S] PricePush glossary (https://pricepush.app/glossary/churn-rate). UNVERIFIED in primary. |

### Revenue per install, value per payer, refunds, prices

| Metric | Number | What it measures | Source |
|---|---|---|---|
| Revenue per install (RPI), 60 days | **median $0.34; top 10% > $2.28** | Revenue in the first 60 days ÷ installs | [S] secondary table of SOSA 2026. UNVERIFIED. |
| RPI by paywall type | $3.09 hard vs $0.38 freemium | 60-day RPI | [S] same. UNVERIFIED. |
| Year-1 value per payer | **North America median $32** (India/SEA $14) | Year-1 realized LTV per paying customer, by developer HQ | [S] PricePush summary of SOSA 2026 (https://newsletter.pricepush.app/p/i-read-all-336-pages-of-revenuecats) |
| Year-1 realized LTV, AI vs median | $30.16 AI vs **$21.37 median** | Year-1 RLTV per payer, global | [S] same PricePush summary |
| Refund rate, overall | **3.5% median** (AI apps 4.2%) | Refunds as % of transactions or revenue | [S] PricePush summary of SOSA 2026 |
| Refunds by price tier | **2.7% low, 3.9% mid, 4.5% high** | Median refund rate | [S] search snippet of the SOSA 2026 page |
| Refunds by region | North America 3.4%, India/SEA 7.7% | Median refund rate | [S] same |
| Median monthly price | **$9.99 North America** (range down to $3.75 in India/SEA) | Median monthly plan price | [S] secondary write-ups of SOSA 2026. UNVERIFIED in primary chart. |
| Median annual price | **$39.99 North America** (down to $18.32 in India/SEA) | Median annual plan price | [S] same. UNVERIFIED. Note: if this is right, **$39.99/yr is exactly the North America median**, so the product may sit in the "mid" tier, not "low". |
| Web revenue share | **3.2% globally, 4.9% North America**, 0.8% India/SEA | Share of subscription revenue billed on the web | [S] secondary coverage of SOSA 2026 |
| Web adoption by app size | 41% of top-tier apps vs 1.3% of the smallest have any web revenue | Adoption | [S] same |
| Subscription-only share, Business | 76.5% (Shopping 79.6%) | Share of category revenue that comes from subscriptions | [S] SOSA 2026 summary |

### Finance category
RevenueCat SOSA 2026 has category pages, for example Business (https://www.revenuecat.com/state-of-subscription-apps-2026-business), Education, Gaming, Utilities and Shopping. Two things I could **not** verify:
- whether there is a separate "Finance" page;
- whether Finance apps are grouped under "Business".

**No Finance-specific RevenueCat figures were found: UNVERIFIED.** The closest proxy is the Business category: 61% monthly and 40% annual renewal.

---

## 2. Adapty: State of In-App Subscriptions (SOIS) 2026, covering 2025 data

Sources:
- Interactive report: https://adapty.io/state-of-in-app-subscriptions-report/
- Key-findings blog: https://adapty.io/blog/mobile-app-monetization-2026/

| Metric | Number | What it measures | Source |
|---|---|---|---|
| Install-to-trial | **10.9%** (global) | Share of installs that start a trial, in apps with trials | [S] RocketShip HQ Adapty summary (https://www.rocketshiphq.com/adapty-subscription-app-benchmark-2025-summary/) |
| Trial-to-paid | **25.6%** global (Health & Fitness 35.0%, Entertainment 19.1%); weekly plans 27.8% | Trial-to-paid conversion | [S] same. The 25.6% and 27.8% figures are different cuts. |
| Paywall view-to-paid | **2.75% US median**, 1.38% Europe | Paywall viewers who pay within 30 days | [S] search snippet attributed to Adapty SOIS 2026. A separate summary gives 4.85% soft vs 3.34% hard. The two conflict: UNVERIFIED. |
| Direct purchase, Lifestyle | monthly and annual direct conversion < 4% in all price tiers | Paywall conversion | [P] Adapty Lifestyle benchmarks (https://adapty.io/blog/lifestyle-app-subscription-benchmarks/) |
| Plan mix (revenue) | **Weekly 55.5%** of revenue (up from 43.3%); annual's share fell from 28% to **15%** since 2023 | Revenue split by plan length | [P/S] Adapty 2026 blog plus summaries. The annual-share figure comes from a secondary summary: UNVERIFIED. |
| 12-month LTV by paywall config | Weekly + trial **$49.27**; Annual + trial **$49.92** vs annual without trial $42.08 (+18.6%) | 12-month LTV per subscriber | [S] Adapty SOIS 2026 summaries |
| Hard vs soft paywall | Hard paywalls give +21% LTV per subscriber | LTV | [S] same |
| First-renewal retention | Utilities 58.1% (highest), Health & Fitness 30.3% (lowest) | First renewal, trial users | [S] same |
| Monthly vs weekly | Monthly subscribers retain at ~2× the weekly rate after 12 months | Long-run retention | [S] same |
| Web vs in-app paywall conversion (iOS, same offer) | **4.95% native IAP vs 3.69% web**, a 26% relative drop. Placement mattered up to ~4× (post-onboarding best). | Paywall view-to-purchase in Adapty's app-to-web tests | [P] Adapty, "Web paywalls on iOS, one year in" (https://adapty.io/blog/app-to-web-paywalls-ios-one-year-data/) |
| Web vs in-app retention | Web month-1 retention is higher (84.5% vs 48.2% in one source; 64.5% vs 46.2% in another). In-app overtakes by month 6–8 (30% vs 20%). | Subscriber retention by channel | [S] Airbridge citing Adapty (https://www.airbridge.io/en/blog/when-to-try-web-to-app) vs an Adapty report page. The sources conflict: UNVERIFIED. |
| Finance category | Not among the categories Adapty breaks out (Health & Fitness, Education, Lifestyle, Photo & Video, Productivity, Utilities, Entertainment, Graphics & Design) | - | No finance data: UNVERIFIED |

Adapty SOIS 2025 (the previous edition) summary: https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/. I did not extract separate 2025 numbers.

---

## 3. Web checkout and web-to-app funnels

| Metric | Number | What it measures | Source |
|---|---|---|---|
| Web funnel vs app funnel final conversion | **3.0% web vs 1.5% app** | Funnel entrants (ad click / landing) who end up paying | [P] FunnelFox, "State of Web2App 2026" (2025 data) (https://funnelfox.com/state-of-web2app/) |
| Funnel stages | ~40–60% pass screen 2; ~20% reach paywall; **1–5% buy**. Biggest drop is in the quiz/onboarding, not at checkout. | Quiz-funnel stage benchmarks | [P] FunnelFox guide (https://funnelfox.com/web-to-app-funnels-guide/) |
| Alternative stage data | ~13% reach paywall, ~3% of sessions purchase, so ~23% paywall-to-purchase | Same | [P] FunnelFox blog. Different methodology from the row above. |
| "Competent" web funnel | ~5% of clicks to paid; top performers near 10% | Click-to-paid | [P] FunnelFox blog (https://blog.funnelfox.com/). Vendor claim. |
| No-trial share | 56.9% of web2app revenue comes from funnels with no trial | Revenue mix | [P] FunnelFox State of Web2App 2026 |
| Web checkout vs IAP, RevenueCat test | Web checkout netted **$0.93 per $1** of IAP revenue (6% lower take-home) and cut conversions by up to one third (12k users) | Head-to-head experiment | [P] RevenueCat blog (https://www.revenuecat.com/blog/growth/iap-vs-web-purchases-conversion-test) |
| Paddle case: Stoic | −5% conversion, **+15% revenue** after moving to web checkout | Single case study | [S] Business of Apps (https://www.businessofapps.com/news/web-payments-are-changing-the-rules-of-app-monetization) |
| Paddle all-in fee claim | "5–6% all-in fees vs 15–30% App Store fees" | Merchant-of-record fee (Paddle covers sales tax / VAT) | [P] Paddle x Helium page (https://www.paddle.com/helium-partnership). The exact "5% + 50¢" list price was not confirmed: UNVERIFIED. |
| US anti-steering ruling | Since the April 2025 court ruling, US App Store apps may link out to web checkout without Apple's commission (US storefront only) | Legal context | [P] Paddle content (https://www.paddle.com/blog/beyond-the-app-store-5-takeaways-from-mau) |

### Fees

| Item | Fee | Source |
|---|---|---|
| Stripe, standard US online card | **2.9% + $0.30** per successful domestic card charge; no monthly fee | Stripe pricing (https://stripe.com/pricing); confirmed via NerdWallet (https://www.nerdwallet.com/article/small-business/stripe-fees) |
| Stripe international card | +1.5%, plus +1% if currency conversion is needed | Same. [S] confirmed by multiple fee guides. |
| Stripe Billing (recurring subscriptions) | **0.7% of billing volume** (pay-as-you-go) | [S] multiple 2026 fee guides. One source said 0.4–0.5%; confirm on stripe.com/billing/pricing. |
| Stripe Tax (optional) | UNVERIFIED (not researched) | - |
| Apple App Store, standard | **30%** in a subscriber's first paid year, **15%** after one year of paid service | RevenueCat (https://www.revenuecat.com/blog/engineering/app-store-fees); MacRumors (https://www.macrumors.com/2020/11/18/apple-drops-app-store-fees/) |
| Apple Small Business Program | **15%** from day one if the developer earned ≤ $1M in proceeds in the prior calendar year | Apple newsroom (https://apple.com/newsroom/2020/11/apple-announces-app-store-small-business-program) |
| Google Play | 15% on subscriptions (by Google's 2022 policy) | UNVERIFIED in this search |

**Worked fee math, US domestic card:**

| Plan | Gross | Stripe card fee | + Billing 0.7% | Net with Stripe | Apple 30% net | Apple 15% net |
|---|---|---|---|---|---|---|
| Annual | $39.99 | $1.16 + $0.30 = $1.46 (3.65%) | $0.28 | **$38.25** (95.6%) | $27.99 | $33.99 |
| Monthly | $6.99 | $0.20 + $0.30 = $0.50 (7.2%) | $0.05 | **$6.44** (92.2%) | $4.89 | $5.94 |

The fixed $0.30 hurts the monthly plan more than the annual one. That is another reason to show the yearly plan first.

---

## 4. Personal finance app comparables

| Company | Metric | Number | Source | Confidence |
|---|---|---|---|---|
| Monarch Money | Paying subscribers | **500,000+** paying subscribers and 1M+ total users by March 2026 | Sacra (https://sacra.com/c/monarch-money/) | [S] Sacra, from company statements |
| Monarch Money | ARR | **~$60M at end of 2025; ~$100M ARR in Sept 2026** (+67%) | Sacra (same URL) | Sacra **estimate** |
| Monarch Money | Funding | $75M Series B, May 2025, ~$850M post-money (FPV, Forerunner) | Sacra (same URL) | [S] |
| Monarch Money | Price | $99.99/yr or $14.99/mo (Core) | Monarch help center (https://help.monarch.com/hc/en-us/articles/9136169422996-Pricing) | [P] |
| Monarch Money | Implied ARPU | $60M ÷ ~500k ≈ **$120/yr per paying sub** (rough; the two figures are from different months) | Derived | Derived, rough |
| Monarch Money | Conflicting revenue estimate | ~$12.6M (Latka/Growjo, Sept 2025) | https://getlatka.com/companies/monarchmoney.com | Low quality; conflicts with Sacra |
| YNAB | Revenue | **~$49M/yr estimate** (Growjo, 2024–Feb 2026); Owler says $5–25M | https://www.useluminix.com/reports/industry-analysis/competitive-landscape-personal-finance-and-budgeting-apps-2026 ; https://www.owler.com/company/youneedabudget | Estimate only. YNAB does not disclose: UNVERIFIED. |
| YNAB | Subscribers | Not disclosed | - | UNVERIFIED |
| YNAB | Price | $109/yr (or $14.99/mo) | YNAB site / reviews | [S] |
| Rocket Money | Users | **10M+ users** (free and paid not split) | Yahoo Finance / CNET review 2025 (https://finance.yahoo.com/news/rocket-money-review-2025-cnets-150000066.html) | [S] company claim |
| Rocket Money | Paid subscribers / revenue | Not disclosed separately within Rocket Companies | - | UNVERIFIED |
| Rocket Money | Price | Premium is pay-what-you-want, about $6–12/mo (2025) or $7–14/mo (2026 review) | The Penny Hoarder (https://www.thepennyhoarder.com/budgeting/rocket-money-review/) | [S] |
| Copilot Money | Subscribers | **100,000+** (early 2024) | TechCrunch (https://techcrunch.com/?p=2681495) | [S] dated |
| Copilot Money | Funding / profit | $6M Series A, March 2024 (led by Adjacent); said to be profitable since 2023 | https://copilot.money/series-a | [P] |
| Copilot Money | Revenue | ~$4.7–5M/yr estimate | Third-party aggregators | UNVERIFIED |

What the comparables show:
- Incumbent prices are about **$100–110/yr**. At $39.99/yr we are about 60% cheaper.
- Monarch shows that a US personal-finance subscription can reach 500k+ payers.
- No company publishes churn or retention numbers. **Finance-app churn: UNVERIFIED.** Use the RevenueCat Business category as a proxy.

---

## 5. Implications for a $39.99/yr web subscription: suggested assumptions for trial/paywall conversion, year-1 renewal, LTV

### Assumptions (base case; each tied to a benchmark)

| Assumption | Base | Range | Basis |
|---|---|---|---|
| Visitor to product (from game) who reaches the paywall | 20% | 13–20% | FunnelFox stage benchmarks |
| Paywall view-to-paid | **2.75%** | 2–5% | Adapty US median 2.75%; FunnelFox 1–5% purchase |
| Funnel entrant-to-paid (product page, not game player) | **~3%** | 1.5–5% | FunnelFox web funnel 3.0% |
| Plan mix (annual : monthly), annual shown first | 60 : 40 | 50–70% annual | **Our assumption** (no finance benchmark found) |
| Refund rate | 3% | 2.7–3.5% | RevenueCat low-price 2.7%, median 3.5% |
| Annual year-1 renewal | **30%** | 23–40% | RevenueCat: all-apps 28%; non-AI 30.7%; low-price 36%; Business 40%. $39.99 may be "mid" tier (26%), so we stay below 36%. |
| Monthly: renewal after month 1 | 61% | - | RevenueCat Business monthly renewal 61% |
| Monthly: retention after month 2 | 85%/month | - | Calibrated so month-12 survival = 12%, inside RevenueCat's 6–14% median band |

### Math

**Annual subscriber, net of Stripe and refunds**
- Net per year: $38.25 × (1 − 0.03) = **$37.10**
- 3-year LTV at constant renewal rate *r* = $37.10 × (1 + r + r²):
  - r = 0.23 (high-price tier): 37.10 × 1.283 = **$47.60**
  - r = 0.30 (base): 37.10 × 1.390 = **$51.57**
  - r = 0.36 (low-price tier): 37.10 × 1.490 = **$55.28**
  - r = 0.40 (Business): 37.10 × 1.560 = **$57.88**

**Monthly subscriber ($6.99; net $6.44 per payment)**
- Survival by month: 100%, 61%, 51.9%, 44.1%, 37.5%, 31.9%, 27.1%, 23.0%, 19.6%, 16.6%, 14.1%, 12.0%. These sum to **4.39 paid months** in year 1.
- Year-1 net per monthly subscriber: 4.39 × $6.44 × 0.97 = **$27.42**. Compare an annual subscriber's $37.10 in year 1, which supports showing the yearly plan first.

**Blended per payer (60/40 mix)**
- Year-1 net: 0.6 × 37.10 + 0.4 × 27.42 = **$33.23**
- Sanity check: RevenueCat's North America median year-1 value per payer is $32 [S]. We land close to the benchmark, not above it.
- 3-year blended LTV, base case: 0.6 × 51.57 + 0.4 × (27.42 + 12% × 12 × 6.44 × 0.97 × ~1.5) ≈ 0.6 × 51.57 + 0.4 × ~40.9 ≈ **~$47**. The year-2+ monthly tail is a rough assumption.

**Per 1,000 visitors who open the forecaster**
- At 3% → 30 payers → 30 × $33.23 = **$997 year-1 net revenue**, about **$1.00 per visitor**.
- At 2% → **$665**, about $0.66 per visitor.
- Benchmark: RevenueCat median 60-day RPI is $0.34 [S]. Mobile installs ≠ web visitors, so present ours as an assumption.
- Break-even CAC per paying user, base case ≈ $33 in year 1 and ≈ $47 over 3 years. **Rule of thumb for the pitch:** paid acquisition must cost under about $0.66–1.00 per forecaster visitor to pay back within year 1. This is why the free game, played by streamers and TikTok audiences, is the acquisition channel.

**Web vs App Store**
- Same $39.99 annual sale: Stripe nets $38.25 vs Apple $27.99 (30%, year 1) or $33.99 (15% SBP).
- That is **+37% vs standard Apple** and **+12.5% vs SBP** per sale.
- Haircut the web conversion: Adapty saw about 26% lower paywall conversion on web vs native, and RevenueCat about a third lower. The fee gain mostly offsets that loss. On the web, with no app at all and the game as the entry point, there is no native paywall to compare against anyway.

### Caveats to state in the pitch
1. All benchmarks are mobile-app medians. No finance-specific figures were found in RevenueCat or Adapty. The Business category is the proxy.
2. $39.99 may be the North America median annual price, i.e. "mid" tier. So use 30% year-1 renewal, not the 36% "low price" figure, unless the tier cut-offs are confirmed.
3. Before quoting any [S] or UNVERIFIED figure on a slide, open https://www.revenuecat.com/state-of-subscription-apps and https://adapty.io/state-of-in-app-subscriptions-report/ and confirm it.
