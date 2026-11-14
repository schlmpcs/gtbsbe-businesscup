# 6b. Copy-risk check for 8 candidate ideas (as of 2026-11-14)

Purpose: before we build, check which existing products already do each candidate idea, and how close they are. The judges (Zimran) penalize copying, especially copying Zimran's own apps (Finelo, Coursiv, Prosperi Academy, SubPilot). Originality is 10% of the score.

## How this was researched (read first)

- Only web **search** worked in this session. Direct page fetches failed because apps.apple.com, appgoblin.info and screensdesign.com are outside the session's network allowlist. Each fact below comes from search-result snippets of the cited URL. Open the source in a browser before putting anything on a slide.
- Labels: **VERIFIED-ish** means a company page, help center or press release appeared in results. **SECONDARY** means review, aggregator or affiliate sites (often conflicting). **UNVERIFIED** means one weak source, conflicting sources, or nothing found.
- Many 2026 "best apps" pages are SEO or affiliate content (joingerald.com, *.pages.dev, costbench, fincomparelab, getfinny, toolradar). Treat their numbers as SECONDARY at best.
- Earlier findings in `3-competitors.md` (Monarch, YNAB, Copilot, Finelo pricing, etc.) are not repeated in full here.

---

## Idea 1. Decision calendar (proactive reminders before dated money moments, with a computed recommendation)

**What already exists**

| Product | What it does that overlaps | Price / traction | Source |
|---|---|---|---|
| Monarch Money | "Upcoming" calendar of recurring bills and subscriptions, auto-detected from linked accounts. Reportedly notifies 3 days before a recurring charge (SECONDARY). Bill Sync shows statement balances and minimum payments on the calendar. Monarch Plus adds forecasting (see `3-competitors.md`). | Core $14.99/mo or $99.99/yr (SECONDARY). Company says >1M members, ~$100M ARR (see `3-competitors.md`). | https://monarchmoney.com/features/recurring , https://help.monarch.com/hc/en-us/articles/4890751141908 , https://robberger.com/best-bill-reminder-apps/ |
| Credit Karma (Intuit) | **Refund Assistant / "Refund Agent"**: for members who filed and expect a refund, it gives an AI-generated plan for the money (pay down debt, emergency fund, build credit, invest) **before the refund arrives**. **Debt Assistant / "Debt Agent"**: personalized pay-down plan, paired with loan offers. Bill due-date reminders for linked accounts. This is the closest match to "computed recommendation before a dated moment", but only for tax refunds and debt. | Free (ad and lending-offer funded). Announced Nov 2025; live by tax season 2026 (VERIFIED-ish, company release; exact launch date UNVERIFIED). | https://www.creditkarma.com/about/releases/less-debt-more-clarity-and-a-plan-for-your-paycheck , https://www.cpapracticeadvisor.com/2025/11/06/intuit-unveils-consumer-platform-incorporates-agentic-ai-across-credit-karma-and-turbotax/172546/ , https://www.accountingtoday.com/news/intuit-infuses-credit-karma-turbotax-with-ai-agents |
| Origin | A "proactive system" running expert-built checks across spending, savings, credit, housing, etc. Models life events (home purchase, child, career change). Markets itself as an SEC-regulated AI advisor. | Reported $99/yr or $12.99/mo, $1 first-year promo (SECONDARY, one site). | https://useorigin.com/resources/blog/personal-finance-apps-that-actually-tell-you-what-to-do , https://www.businesswire.com/news/home/20250909759834/en/ , https://www.fincomparelab.com/?p=959 |
| YNAB | Date-based **Targets**: set an amount and a "by" date for a big one-off purchase or yearly expense, and YNAB computes the monthly amount and reminds you to assign it. That is a dated money moment with a computed number, but user-created and with no recommendation. | $14.99/mo or $109/yr (SECONDARY). | https://www.ynab.com/ynab-targets/ , https://support.ynab.com/en_us/getting-started-with-targets-ryAEP08xC.md |
| Cleo | AI chat money coach. Proactive nudges are widely described, but **no 2026 source was found that details payday or event nudges** (UNVERIFIED). | Plus $5.99/mo, Pro $8.99, Builder $14.99 (SECONDARY, matches across several sources). | https://www.thepennyhoarder.com/save-money/cleo-app-review/ , https://toolradar.com/tools/cleo-ai/pricing |
| Rocket Money | Upcoming-bill and subscription tracking (see Idea 2). | See Idea 2. | |
| Copilot Money | Recurring detection. No reliable 2026 detail on an "upcoming" calendar or event reminders (UNVERIFIED). | $13/mo or $95/yr (SECONDARY). | https://getfinny.app/blog/copilot-money-pricing-2026 |
| Bill/payday calendar apps | CalendarBudget, Bill Organizer, NEKO: bills and paydays on a calendar, push reminders, "safe to spend". No recommendations. | Small apps. | https://apps.apple.com/gb/app/id1437594497 , https://appshunter.io/ios/app/1451776066 |
| Price-drop and wishlist trackers | Keepa, Carted, Shopie, Wishpicks, BigBangPrice: tell you *when* to buy an item (price drops, Black Friday). They do not check whether you can afford it. | Wishpicks Plus $4.99/mo (SECONDARY). | https://wishpicks.com/plus , https://apps.apple.com/us/app/big-bang-price/id1658694147 |
| NerdWallet, Empower | No evidence found of event-dated reminders with a recommendation (absence UNVERIFIED). | | |

**Verdict:** Pieces exist: bill calendars (Monarch), a refund-moment recommendation (Credit Karma), date-based savings targets (YNAB) and "when to buy" trackers. **No product was found that combines a calendar of *life* decision dates (lease renewal, car loan payoff, raise, Black Friday for a wishlisted item) with a deterministic dollar recommendation computed from the user's own forecast.** None of it is Zimran territory.

**Copy risk: MEDIUM-LOW.** It is generic, so the danger is looking like "Monarch upcoming bills" or "Credit Karma refund plan". Differentiate on: (a) the events are *decisions*, not bills; (b) each reminder carries a number from `packages/engine` ("Your car is paid off in March: redirecting $412/mo adds $X in 10 years"); (c) no bank link, so the events come from the profile the user entered; (d) calendar export (.ics) works without an account.

---

## Idea 2. Subscription audit (swipe keep/cut, each subscription shows its 10-year cost, feeding the ranked moves)

**SubPilot (Zimran / Finelo Limited) — the most important finding in this document**

- App: "SubPilot: Cancel Subscriptions" (KZ storefront title: "Subpilot by Finelo"), iOS app id 6751181747, Android package `io.zimran.subpilot`. The seller is **Finelo Limited**; one tracker lists ZIMRAN LIMITED. Support domain: `support.subpilot.finelo.com`. (VERIFIED-ish via App Store snippets and the company's support site.)
  - https://apps.apple.com/us/app/-/id6751181747 , https://apps.apple.com/kz/app/subpilot-by-finelo/id6751181747 , https://appgoblin.info/apps/io.zimran.subpilot
- **What it does:**
  - It detects subscriptions via **bank or card linking** (help article "Connecting bank accounts and credit cards") and **email scanning** (Gmail and Outlook, per iLounge). A June 2026 guide says it also uses Apple subscription and receipt signals.
  - It shows recurring charges and upcoming renewals.
  - **Cancellation "Concierge":** it cancels subscriptions for you.
  - It offers **bill negotiation** as a premium feature.
  - It has cancellation guides (one source says 500+ services).
  - Sources: https://support.subpilot.finelo.com/support/solutions/articles/73000662670-how-to-cancel-subscriptions-via-subpilot- , https://support.subpilot.finelo.com/en/support/solutions/articles/73000659147-connecting-bank-accounts-and-credit-cards , https://support.subpilot.finelo.com/en/support/solutions/articles/73000664529-bill-negotiations , https://www.ilounge.com/articles/subpilot-review-2026-find-forgotten-subscriptions-and-save-real-money
- **Price:**
  - Listed as "Free with In-App Purchases", but a listing says "access to the app requires a subscription". The base subscription price was not found (UNVERIFIED; iLounge says the price is shown at checkout).
  - **Concierge Pro** is a one-time payment. Support lists a "standard price" of $119.99, and App Store IAPs show $59.99 and $49.99 (SECONDARY). It includes 10 automatic cancellations by text request plus a bill-negotiation credit.
- **Traction:**
  - App Store: 4.53★ from 4,460 ratings as of 2026-08-20, per a search snippet summarizing iLounge (SECONDARY). Other pages show 800–1.3K ratings (older snapshots).
  - Trustpilot (subpilot.finelo.com): ~6,300 reviews, TrustScore 4.4. A separate subpilot.tech page has ~2,000 reviews. Many reviews come from new signups in May 2026, which suggests heavy paid acquisition (inference).
  - Sources: https://www.trustpilot.com/review/subpilot.finelo.com , https://www.trustpilot.com/review/subpilot.tech
- **Swipe keep/cut UI or 10-year cost?** No evidence found either way (UNVERIFIED; screensdesign.com, which shows its screens, was blocked).

**Others**

| Product | Overlap | Price / status | Source |
|---|---|---|---|
| Rocket Money (ex-Truebill) | The category leader. It does subscription detection, cancellation concierge and bill negotiation; it also offers budgets. | Premium is pay-what-you-choose, ~$6–12 or $7–14/mo (sources conflict). One source says bill negotiation moved to a $15/mo **Premium+** tier on 2026-11-02 (single source, UNVERIFIED). Rocket does not break out member numbers in Q3 2026 results. | https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost , https://www.fincomparelab.com/guides/rocket-money-pricing/ , https://finviz.com/news/412017/rocket-companies-announces-third-quarter-2026-results |
| Trim (AskTrim) | Subscription cancelling and bill negotiation. | Consumer service reportedly shut down in 2022 (single source, UNVERIFIED). Don't confuse it with "Trim - Subscription Tracker", a different new app. | https://walletgrower.com/blog/trim-a-free-virtual-assistant-designed-to-help-you-save-money |
| Bobby | Manual subscription tracker, iOS only. | ~$3.99 one-time (SECONDARY). Last update 2026-07-21 per AppFollow. | https://apps.appfollow.io/ios/bobby-track-subscriptions/1059152023?country=us |
| Hiatus | Subscription tracking and bill negotiation. | Free, or ~$10/mo premium (SECONDARY). Still listed; 2026 status UNVERIFIED. | https://www.bestmoney.com/financial-advisor/learn-more/subscription-manager-apps |
| Monarch | "Recurring" page with subscriptions and bills. | See Idea 1. | https://www.monarchmoney.com/whats-new/track-recurring-bills-and-subscriptions |
| PocketGuard | Subscription and bill detection; "In My Pocket". | Plus $12.99/mo, $74.99/yr, or $99.99 lifetime (SECONDARY, July 2026). | https://subger.com/en/service/pocketguard |
| Cleo, Copilot | Both detect recurring charges. Cleo's chat can "roast" your spending. | See Idea 1. | |
| "Tinder for subscriptions" | **No paid-subscription swipe app was found.** The swipe-to-unsubscribe pattern exists for **email** (Unroll.Me, and an older iPhone app covered by Business Insider). | — | https://businessinsider.in/This-new-iPhone-app-lets-you-kill-all-your-annoying-email-subscriptions-with-just-a-few-swipes/articleshow/49680576.cms |
| "Opportunity cost" calculators | Many small web tools show what a subscription would grow to if invested over 10 years (Richify, sum.money, many *.pages.dev). Richify has per-service SEO pages ("Netflix opportunity cost"). | Free SEO tools. | https://www.richify.ai/opportunity-cost/subscriptions/amazon-prime , https://sum.money/subscription-cost-calculator/ |

**Verdict:** The **subscription audit is Zimran's own product category (SubPilot)** and Rocket Money's core feature. The "10-year cost of a subscription" angle is a common free calculator. A swipe deck would be new as a UI, but the *job* (find and cut subscriptions) is exactly SubPilot's.

**Copy risk: HIGH** if it is a standalone feature or headline. Differentiate, or drop it:
- Don't detect, cancel or negotiate anything. No email scanning, no concierge. Those are SubPilot's mechanics.
- If kept, fold it into "money moves". A subscription total is one input to the ranked list, next to car, rent and loan moves. Never make it its own screen or pitch slide.
- Frame it as a *trade-off*, not a cut: "Keeping Netflix + Hulu = $X in 10 years = 1.4 months of daycare." Compare against the user's own goals (wishlist, Loan Lab), not against investing returns.
- Never say "cancel subscriptions" in the pitch.

---

## Idea 3. Shareable decision links / couples decision comparison (Path A vs Path B sent to a partner)

| Product | Overlap | Source |
|---|---|---|
| sum.money (Rent vs Buy) | **Every input is encoded in the URL; "click Share, send the link to your partner or advisor"**. This is the closest match, but it covers one calculator and one decision type, with no A/B of two personal paths. | https://sum.money/us/rent-vs-buy-calculator/ |
| ProjectionLab | "What If" scenarios and Compare Mode (Premium, $129/yr) overlay a baseline plan against a variant. **No share-link or partner feature found** (UNVERIFIED). | https://projectionlab.com/help/using-what-if , https://projectionlab.com/blog/compare-mode-upgrades |
| Monarch | Partner and advisor (read-only) access to the whole household, at no extra cost. This shares *data*, not a single decision. | https://www.monarchmoney.com/solutions/couples |
| EstatePass | Agent-branded shareable reports (B2B, real estate). | https://www.estatepass.ai/best/buy-vs-rent-calculator/ |
| NerdWallet, RentCafe, Postly | Calculators with no share link. Postly exports CSV, JSON or PDF. | https://www.nerdwallet.com/mortgages/rent-vs-buy-calculator , https://tools.postly.ai/tools/rent-vs-buy |

**Verdict:** URL-encoded share links exist on single calculators, and household sharing exists in Monarch. **We found no consumer product that sends a two-path *personal* decision ("lease the RAV4 vs keep the Civic, 10-year net worth difference") as a link the partner can open, tweak and answer**, without logging in. Not Zimran territory.

**Copy risk: LOW.** Differentiate by:
- Make the link stateless (inputs in the URL hash, nothing stored server-side), which fits our privacy rule.
- Let the partner add their own numbers or vote ("I'd pick B").
- Generate an OG image card with both paths for iMessage and WhatsApp previews. That also makes it a growth loop.

---

## Idea 4. Couples mode — status of incumbents in 2026

| Product | 2026 status | Source |
|---|---|---|
| Honeydue | **Still operating.** Acquired by Mission Lane in 2021, then **divested to Moneydue, Inc. in 2024** (company About page). Free. Joint Cash (debit) stopped new enrollments in Sep 2023 and is "waitlist-only". iOS update v2.83 shipped 2026-06-19. 2026 reviews complain that support doesn't respond. | https://honeydue.com/about , https://www.fincomparelab.com/reviews/honeydue-review/ , https://www.retailbankerinternational.com/news/mission-lane-buys-honeydue/ |
| Zeta | **Shut down.** The couples service ended around **May 9, 2025** (third-party sources). **Acorns announced an asset acquisition on June 24, 2025** (Acorns page). Whether any couples features survive inside Acorns is UNVERIFIED. | https://www.acorns.com/learn/acorns-zeta-acquisition , https://pocketclear.app/blog/zeta-app-alternative-couples.html |
| YNAB Together | Active. Share one subscription with up to 6 people at no extra cost, each with a separate login. | https://www.ynab.com/budgeting-together/ |
| Monarch household | Active. Invite a partner free. Shared goals; "yours, mine, ours" labeling in 2026 (Origin blog, SECONDARY). | https://www.monarchmoney.com/solutions/couples |
| Copilot Money | **Single-user**, with no partner access (getfinny, SECONDARY). One review page claims "family sharing up to 5" but contradicts itself (UNVERIFIED). | https://getfinny.app/blog/best-budgeting-apps-for-couples-2026 |
| Simplifi | Household partner access (SECONDARY). | https://work-club.com/best-budgeting-apps-couples-2026/ |
| Tandem (Ride in Tandem Inc., Chicago) | Active. Splitting expenses, shared to-dos, planning purchases. Updated 2026-01-15. | https://techcrunch.com/2024/01/17/tandem-modern-couples-app-fintech , https://apps.apple.com/app/id1636705869 |
| Many new 2026 micro-apps | Fairmony, Halfway, WeBudget, OurWallet, Fair Split, "Tandem: For Couples" (BPet, Feb 2026). These are expense-splitting and shared trackers. | https://apps.apple.com/app/id6758418831 , https://mwm.ai/apps/halfway-couples-budgeting-app/6756980368 |
| Origin | Lets you add a partner (its own blog). | https://useorigin.com/resources/blog/finance-apps-that-let-you-add-a-partner-in-2026 |

**Verdict:** "Couples budgeting" (shared accounts and expense splitting) is crowded, and incumbents are consolidating or fading (Zeta closed, Honeydue stagnant). **Couples *decision-making* (not shared ledgers) is open.** No Zimran overlap.

**Copy risk: MEDIUM** if we build a shared budget; **LOW** if we build "decide together" (Idea 3) with no shared accounts or logins.

---

## Idea 5. Free SEO calculators (car affordability, rent affordability, daycare vs rent by ZIP, cost of living)

| Calculator type | Who already ranks | Source |
|---|---|---|
| Car affordability | NerdWallet (starts from the monthly payment), Edmunds (list price incl. tax, title, registration), LendingTree (20/4/10 rule), KBB, Autotrader, Experian, Omni, CalculatorSoup, many credit unions. | https://www.nerdwallet.com/article/loans/auto-loans/much-spend-car , https://edmunds.com/calculators/affordability.html , https://lendingtree.com/auto/calculators/affordability , https://kbb.com/car-affordability-calculator/ |
| Rent affordability / rent vs buy | Zillow rent calculator, NerdWallet, RentCafe, SmartAsset, sum.money. | https://www.nerdwallet.com/mortgages/rent-vs-buy-calculator , https://www.rentcafe.com/rent-vs-buy-calculator/ |
| Daycare cost by ZIP | Care.com Cost of Care calculator (ZIP + care type), CareLuLu (ZIP, age, type), **DaycareCalc** (ZIP pages, "Am I overpaying", and **shows local median rent next to daycare**). | https://www.carelulu.com/daycare-cost , https://daycarecalc.com/analyze/60632 , https://fatherly.com/news/child-care-calculator-cost-of-care-report |
| Daycare vs rent (content) | **Redfin: "Sending 2 kids to daycare costs more than rent in most major U.S. metros"** (metro-level, 2025). | https://www.redfin.com/news/childcare-housing-costs-2025/ |
| Cost of living / living wage | MIT Living Wage (county and metro, 12 family types, data updated 2026-02-15), SmartAsset, Numbeo, NerdWallet COL calculator. | https://livingwage.mit.edu/ |

**Verdict:** Head terms ("how much car can I afford", "rent vs buy") are owned by NerdWallet, Edmunds, Bankrate and Zillow; a hackathon site will not rank for them. **"Daycare vs rent by ZIP" is less saturated** (only DaycareCalc comes close), and **"full cost of a life in a ZIP" (rent + daycare + car + food for a household type)** is a combination we did not find. None of this is Zimran territory.

**Copy risk: LOW** (calculators are commodity; no one owns the idea) but **low originality value** too. Differentiate by building long-tail programmatic pages from our own sourced data ("What a family of 4 with 2 toddlers spends in 60632"), each linking to the daily game. Don't pitch the calculators as innovation.

---

## Idea 6. City cost-of-life reports

| Product | What it publishes | Source |
|---|---|---|
| SmartAsset | Annual "salary to live comfortably" by state and city. It applies the 50/30/20 rule to MIT Living Wage data. Nov 2026 edition: a single adult needs ≥$80k in every state; a family of four needs $329,555 in MA and $187,533 in MS. Widely syndicated by local TV (Gray stations). | https://www.hawaiinewsnow.com/2026/11/01/heres-salary-it-takes-live-comfortably-each-us-state-2026/ |
| MIT Living Wage | County and metro living wage and expense budgets by family type. | https://livingwage.mit.edu/ |
| Redfin | Monthly "income needed to buy the typical home" (June 2026: $109,796 vs median household income $87,599), by metro; childcare-vs-rent report. | https://www.redfin.com/news/homebuying-affordability-improving-2026/ , https://www.redfin.com/news/childcare-housing-costs-2025/ |
| Zillow (via ConsumerAffairs) | Income needed to buy a home in the 200 largest metros (28% rule). | https://consumeraffairs.com/homeowners/income-needed-to-buy-a-home.html |
| Numbeo | Crowdsourced global COL index (NYC = 100). The 2026 index is widely covered by press. | https://www.timeout.com/news/the-cities-with-the-highest-cost-of-living-right-now-revealed-with-the-top-six-all-in-one-european-country-012626 |
| Expatistan | Crowdsourced city comparison. No 2026 results were returned (status UNVERIFIED). | — |

**Verdict:** City-level "what it costs to live here" reports are a mature PR genre (SmartAsset's gets syndicated every year). Our angle can't be "another index".

**Copy risk: MEDIUM** (the format is well worn; not Zimran). Differentiate with **crowd-guessed vs actual**: "Players guessed a Denver family of 4 spends $6,100/mo; HUD+BLS+childcare data says $7,450." That data comes from our game, so nobody else can publish it. It is a PR asset as well as a report.

---

## Idea 7. One-off "Decision Pass" ($9.99 per big decision)

| Product | Model | Source |
|---|---|---|
| Domain Money | Historically **one-time flat-fee plans** ($2,500 / $4,500 / $7,500, per 2024–25 reviews), plus up to 5 extra scenarios (e.g., "buying new home"). Moved to annual memberships in 2025 (e.g., Essential $3,200 first year). Human CFPs, so a different price tier. | https://www.businesswire.com/news/home/20250408075222/en/ , https://walnutinvest.com/resources/domain-money-pricing , https://www.nerdwallet.com/financial-advisors/reviews/domain-money |
| Facet | Flat-fee annual membership; home purchase planning included. ~$2k–6k/yr (SECONDARY, UNVERIFIED). | https://facet.com/flat-fee-financial-planning/ |
| SubPilot Concierge Pro (Zimran) | **One-time** payment ($49.99–$119.99) for a bundle of 10 cancellations. This shows Zimran already uses one-time IAP bundles on top of subscriptions. | See Idea 2 |
| Finelo | One-time IAPs ($9.99–$119.99), including a "Personal AI Coach" for $19.99. | https://apps.apple.com/us/app/-/id6670422243 , `3-competitors.md` |
| Indie one-off reports | "Affordability Snapshot" home affordability report for $39 (Tally form); spreadsheet packs (Car Buying Calculator Pack $9.99 on Payhip; home affordability template $12). | https://tally.so/r/nW6dDv , https://payhip.com/b/ReoLQ , https://www.financialaha.com/essentials-spreadsheet-templates/mortgage-home/ |
| Carfax / AutoCheck | Per-car report, ~$45 / ~$25–30. A consumer habit of paying per car-purchase decision already exists. | https://www.carwhere.com/guides/carfax-report-cost |
| ProjectionLab, Boldin | Annual subscriptions (ProjectionLab Premium $129/yr). Boldin's price was not found (UNVERIFIED). | https://projectionlab.com/blog/compare-mode-upgrades |

**Verdict:** **No consumer app was found selling software-only, per-decision passes at ~$10** ("one car decision, one lease decision"). Human-planner flat fees exist at 100–700× the price, and per-*car* reports (Carfax) prove people pay once per big purchase. Zimran uses one-time IAP bundles (Concierge Pro, AI Coach), so the *mechanic* is familiar to the judges, but not this framing.

**Copy risk: LOW.** Make sure the price is honest: a one-time charge, not an auto-renewing trial dressed up as a pass. Zimran products have been criticized for exactly that (UK ASA ruling against Zimran Ltd t/a Prosperi Academy for a misleading ad; Coursiv billing complaints). Show the pass as an alternative to the subscription, not a decoy.

---

## Idea 8. What Zimran's own products do in 2026 (stay out of these lanes)

### Finelo ("Finelo: Master Trading")
- **What it is:** investing and trading **education**.
- **Features:**
  - bite-sized lessons
  - **28-day challenges**
  - **trading simulator with virtual funds**
  - streaks and achievements
  - AI tools for market analysis
- **New in the latest listing (date UNVERIFIED):**
  - **"AI Bots store"**: explore and set up trading bots
  - **smart signal alerts**
  - redesigned onboarding
  - **"Personal AI Coach" IAP at $19.99**
- Says it is "an educational app, not a brokerage". It published a "2026 Review Transparency Update" press release in July 2026.
- **Budgeting:** one promotional article claims zero-based budgeting and subscription tracking, but this is **UNVERIFIED and likely inaccurate**.
- **Price:** ~$19.99 per 4 weeks on the web; IAPs $9.99–$119.99 (see `3-competitors.md`).
- **Traction:** 1.5M+ learners (company PR, Feb 2026). ~480K Android installs (tracker, SECONDARY).
- **Sources:** https://apps.apple.com/us/app/-/id6670422243 , https://ffnews.com/news/finelo-enhances-trust-with-2026-review-transparency-update-and-independent-resources , https://support.finelo.com/en/support/solutions/articles/73000639763-what-benefits-and-features-will-i-receive-through-finelo- , https://appwisp.com/app/android/io.zimran.finelo

### Coursiv ("Coursiv – AI Tools Mastery")
- **What it is:** an AI-skills learning app.
- **Features:**
  - daily 5–15 min lessons on ChatGPT, Midjourney and similar tools
  - built-in AI playground
  - **28-day AI mastery challenge**
  - certificates
  - **Coursiv Junior**, a kids' app (free with IAP)
- **Price:**
  - quiz-funnel personalized pricing
  - US IAPs ~$9.99–$79.99
  - one review cites $19.99 for the first month, renewing at $39.99
- **Ads and complaints:** a funnel teardown counts ~9,597 ads and a "$150 upsell ladder" (SECONDARY). Billing complaints are common.
- **Sources:** https://apps.apple.com/us/app/coursiv/id6478281150 , https://nibble-app.com/blog/coursiv-pricing , https://web2appworld.pages.dev/breakdowns/coursiv

### Prosperi Academy
- **What it is:** investing education.
- **Features:**
  - interactive courses
  - a "real-world" **simulator**
  - an **AI mentor**
- Not a brokerage.
- **Price:** $9.99/week or $24.99/month after a 3-day trial (Motley Fool; date UNVERIFIED).
- **UK ASA ruling (A24-1265945, Zimran Ltd t/a Prosperi Academy):** a YouTube ad from 25 Oct 2024 was banned and all three issues were upheld. The ad made return claims the company said were "illustrative simulation results".
- **Sources:** https://www.asa.org.uk/rulings/zimran-ltd-a24-1265945-zimran-ltd.html , https://www.fool.com/money/buying-stocks/prosperi-academy-review , https://fxnewsgroup.com/forex-news/regulatory/asa-slams-prosperi-academy-for-misleading-ad-of-investment-training-courses/

### SubPilot
- Subscription detection (bank link and email scan), concierge cancellation and bill negotiation. See Idea 2.

### Lanes to avoid

| Zimran pattern | Where it appears |
|---|---|
| Lessons + streaks + 28-day challenge | Finelo, Coursiv |
| Investment or trading simulator | Finelo, Prosperi |
| AI coach or mentor sold as an IAP | Finelo, Prosperi |
| Trading bots and signals | Finelo |
| Subscription detection, cancellation and bill negotiation | SubPilot |
| Quiz-funnel personalized pricing with upsell ladders | All of them |

**Implication for our game:** our daily game must not look like a "daily lesson + streak" loop. Keep it a *guessing game about strangers' households*, with a leaderboard and shares rather than lesson streaks.

---

## Final table

| # | Idea | Closest existing products | Copy risk | How to differentiate |
|---|---|---|---|---|
| 1 | Decision calendar | Monarch Upcoming/recurring calendar; Credit Karma Refund Agent + Debt Agent; YNAB date Targets; Origin proactive checks; price-drop trackers (Keepa, Wishpicks) | **Medium-low** | Events are *life decisions* (lease end, loan payoff, raise, wishlist + Black Friday), not bills. Each comes with an engine-computed $ recommendation from the user's forecast. No bank link; .ics export with no account. |
| 2 | Subscription audit (swipe keep/cut, 10-yr cost) | **SubPilot (Zimran)**, Rocket Money, PocketGuard, Monarch recurring, Bobby, Hiatus; opportunity-cost calculators (Richify, sum.money) | **High** | Don't build a standalone subscription feature, and never detect, cancel or negotiate. At most, subscriptions are one line inside "money moves", framed as a trade-off against the user's own goals ("= 1.4 months of daycare"). Keep "subscriptions" off pitch slides. |
| 3 | Shareable decision link / couples A vs B | sum.money URL-share (single calculator); ProjectionLab Compare (no share found); Monarch partner/advisor access | **Low** | A stateless link holds two personal paths. The partner opens it without login, edits their own numbers and votes. An OG image card makes it a growth loop. |
| 4 | Couples mode | Monarch household, YNAB Together, Honeydue (alive, stagnant, Moneydue Inc.), Simplifi, Tandem, many 2026 split apps; Zeta **shut down 2025** (assets → Acorns); Copilot single-user | **Medium** (shared budget) / **Low** (decide-together) | Skip shared ledgers and account linking. Do "decide together" (Idea 3) plus a joint "You in 10 years" forecast. |
| 5 | Free SEO calculators | NerdWallet, Edmunds, LendingTree, KBB, Zillow, RentCafe, Care.com, CareLuLu, DaycareCalc, MIT Living Wage | **Low** (commodity) | Skip the head terms. Build programmatic ZIP × household-type pages ("daycare + rent + car for a family of 4 in 60632") from our sourced data, each linking to the game. Don't pitch the calculators as the innovation. |
| 6 | City cost-of-life reports | SmartAsset annual "live comfortably" study, MIT Living Wage, Redfin income-needed, Zillow/ConsumerAffairs, Numbeo | **Medium** | Publish "crowd guess vs real cost" from game data. Nobody else has guess data, so it is unique and makes a good PR hook. |
| 7 | Decision Pass ($9.99 per decision) | Domain Money one-time plans ($2.5k+, now memberships), Facet; Carfax per-car; SubPilot Concierge Pro and Finelo AI Coach one-time IAPs; indie $39 affordability report | **Low** | Software-only, priced per decision, a true one-time charge with no auto-renew trap. Position it as the honest alternative to subscribing. |
| 8 | Zimran's own lanes | Finelo (lessons, 28-day challenge, trading sim, AI bots, signals, AI coach IAP), Coursiv (AI lessons, 28-day challenge, Junior), Prosperi (investing courses, sim, AI mentor), SubPilot (subscription cancelling) | — | Avoid lessons + streaks, investment simulators, AI coach IAPs and subscription cancelling. Our lane is household cash flow, big-ticket decisions and a guessing game about strangers' homes. |

## Open items to verify in a browser
- SubPilot base subscription price, and whether it has a swipe UI (screensdesign.com showcase).
- Rocket Money Premium+ ($15/mo, 2026-11-02): one source only.
- Credit Karma Refund Agent: exact launch date and whether it is still live after tax season.
- Copilot Money: whether family sharing exists.
- Expatistan 2026 status; Boldin price.
