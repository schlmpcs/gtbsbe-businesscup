# 8. Monarch Money teardown (Nov 2026)

Research date: 2026-11-15. Goal: understand our main competitor and decide which **patterns** (not assets) LifeGuessr should borrow for S1, S10, /what-if, S14 and S15.

## How to read this doc (method and limits)

- **Sandbox limits.** Direct fetches failed for help.monarch.com, monarch.com, apps.apple.com, releasebot.io, prnewswire.com and substack.com: DNS fails, so these hosts are outside the session's network allowlist. **Reddit is blocked for the search tool too**, so this doc quotes no Reddit threads. Everything below comes from **web-search result snippets** of the cited URL.
- **Labels:**
  - **[P-snip]**: the snippet comes from Monarch's own page (help center, blog, homepage, release notes, press release). The source is primary, but I did not read the full page.
  - **[S]**: a secondary source, such as a review site, a blog or an aggregator.
  - **[U]**: unverified, with sources that conflict or come from one low-quality page.
- Before anything below goes on a slide, open the source in a normal browser. This applies to prices above all.
- Related earlier research: `3-competitors.md` (Monarch section and positioning), `1-unit-economics.md`, `5-market-retention.md`.

---

## 1. Product and pricing in 2026

### 1.1 Tiers and prices

| | Core | Plus |
| --- | --- | --- |
| Price | **$14.99/mo or $99.99/yr** [S, consistent across many sources] | **$199 to $199.99/yr, annual billing only** [S, most sources]. Some sources show $299/yr [U]. One source says $299 is the "value" of the bundled Trust & Will will, not the Plus price. Another says $299 was the new-member price and existing Core members got $100 off |
| Free tier | **None**. Monarch has no permanent free plan [S] | none |
| Trial | **7 days**. Most sources say a payment method is required up front and billing starts automatically [S; a minority says no card is needed, U] | 7-day trial. Some sources say the Plus trial starts only on desktop web [U] |
| Promo codes | 50% off the first year. Examples: `MINT50` (2023), `WELCOME`, `NEWYEAR2025`. Referral invitees get 50% off year one (~$50) [S] | Codes reportedly don't apply to Plus or to monthly plans [S] |
| Main features | Account aggregation, budgets, Cash Flow, Reports (incl. Sankey), Net Worth, Goals, Recurring calendar, Bill Sync, AI Assistant, Weekly Recap, household sharing | Everything in Core, plus **Forecasting** (life events, scenarios, Monte Carlo "Chance of success"), business and rental tracking, extra investment tools (Morningstar data, gains/losses) [S], a free will via Trust & Will (limited time), and more MCP requests per week [S] |

Sources:
- Core price: https://getfinny.app/blog/monarch-money-pricing-2026 , https://usetweed.com/blog/monarch-money-review/ , https://www.fincomparelab.com/guides/monarch-money-pricing/
- No free tier and 7-day trial with a card: https://spendalyst.com/blog/is-monarch-money-free , https://www.spotsaas.com/product/monarch-money/pricing , https://screensdesign.com/showcase/monarch-budget-track-money (calls it a "hard paywall with a free trial")
- Plus launch (Apr 20–21, 2026): https://www.monarch.com/blog/monarch-plus [P-snip], https://www.prnewswire.com/news-releases/monarch-launches-premium-tier-monarch-plus-302748653.html [P-snip], https://www.tipranks.com/news/private-companies/monarch-debuts-high-priced-monarch-plus-tier-targeting-advanced-personal-and-business-finance-planning [S]
- Plus price, annual only, and promo codes not applying: https://getfinny.app/blog/monarch-money-core-vs-plus-2026 , https://finpresso.com/blog/monarch-money-pricing , https://www.getitplanned.com/compare/monarch [S]
- Help center Plus page (states no price): https://help.monarch.com/hc/en-us/articles/48349699981972-Monarch-Plus-Tier [P-snip]
- Referral and promo terms: https://www.fincomparelab.com/guides/monarch-money-discount/ , https://www.linkedin.com/posts/monarch-money_mint-shutting-down-how-to-migrate-to-monarch-activity-7128885843364089856-RyNh [P-snip]
- Monarch says it gives at least 30 days' notice before a price change [S]: https://envelopebudgeting.com/articles/monarch-money-review

**Takeaway:** the cheapest way into Monarch costs $99.99/yr, and the forecasting tier costs about $199/yr. LifeGuessr at $39.99/yr is **5x cheaper than Monarch Plus**, the product we actually compete with on "forecast your decisions".

### 1.2 What Plus Forecasting actually does

**Inputs**
- Baseline: "your **last 12 complete months** of income and expense actuals from your Monarch budget … annualized" [P-snip, help center]. **This means Forecasting needs a year of categorized transactions.** Without that history, the baseline is thin.
- Accounts: linked balances. Each year's income, expenses and life events are calculated separately [P-snip].
- **Life events** are pre-built: buying a home, having a kid, retiring, Social Security, plus general income and expense events. You can model other things, like buying a car, as a generic "Expense" event [P-snip, blog/forecasting]. The Plus launch post adds "changing jobs" and "taking a career break" [P-snip].
- **Assumptions** live under Forecasting > Edit assumptions: returns, inflation, and growth controls per event ("match inflation, set a custom increase or decrease, or hold flat") [P-snip, Managing Forecasting Assumptions].
- Later updates (Aug–Nov 2026) added early-retirement modeling, including IRA and 401(k) withdrawal penalties [S, releasebot; P-snip, monarch.com/blog/august-product-update].

**Outputs and visuals**
- A **net worth projection chart**. Events sit on a timeline on the chart, and "you can add these events directly to your timeline and watch your projection update in real time" [P-snip, blog/monarch-plus]. You can review or edit events from the chart or from an **Events tab** [P-snip].
- A **forecast table** with yearly income, expenses and net withdrawals [P-snip, help center].
- **Scenarios:** "save different versions of your forecast to explore choices like retiring earlier or taking a career break". You can create one from scratch or **duplicate an existing one**, then **compare two side by side** [P-snip]. Release notes describe the comparison as two plans "on one chart", so you can see how they diverge year by year: projected net worth, when major life events land, and how retirement timelines compare [S, releasebot.io, summarizing Monarch's notes].
- **Chance of success (Monte Carlo):** this feature is rolling out gradually. It runs thousands of paths that vary returns and inflation, then shows a percentage, for example "800 of 1,000 paths → 80%". The help center says this is "not a guaranteed real-world probability". Results appear as **bar-style distribution charts** for net worth at retirement, net worth at plan end and shortfall age, with a "Range" option [P-snip, https://help.monarch.com/hc/en-us/articles/55283130539028-Understanding-Chance-of-Success-Monte-Carlo]. I found **no confirmation of a fan chart or percentile band** [U].
- **Accuracy framing:** Forecasting is "built for directional accuracy, not false precision" and is "a tool to be explored, not perfected" [P-snip].
- **Horizon:** multi-year, through retirement and "plan end" [P-snip/S]. I did not find an exact maximum horizon.
- **Platform:** "**currently available in the Monarch web app only** and is not yet supported on iOS or Android" [P-snip, https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch].

**About the "$500k house → retirement age" example:** a Penny Hoarder review [S] attributes this framing to Monarch ("what happens to my retirement age if I buy a $500,000 house in three years?"): https://www.thepennyhoarder.com/budgeting/monarch-money-review/ . By the help center's description, the mechanics work like this. The user duplicates the base scenario, adds a "Buy a home" event (price, timing, down payment), and compares the two lines or the retirement outcome. **The user must think up and build each scenario. Monarch does not propose or rank moves.**

**Core vs Plus confusion:** some reviews say Core has a "Cash Flow Projection" that looks a few months ahead from recurring bills [S]. Centinel argues that Core's Cash Flow view is a budgeting report, not a balance projection [S]. https://www.centinelmoney.com/resources/centinel-vs-monarch-money

### 1.3 AI features
- **AI Assistant** (chat over your own data: spending, cash flow, net worth, subscriptions). It launched around Dec 2025 [S], had a release on Jun 16, 2026 and became "Faster" on Sep 29, 2026. Release notes say it now "spots ways to save before you ask" [S/P-snip]. https://www.monarch.com/whats-new , https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features
- **AI categorization** and **AI insights** [S].
- **Weekly Recap** is AI-written: it covers what changed, spending trends and "what deserves your attention", and you can ask the assistant follow-up questions [P-snip, https://www.monarch.com/blog/winter-release].
- **Official Monarch MCP connector:** it launched in Jun 2026, was paused at the end of June over a partner data-portability question, and came back on **Oct 21, 2026**. It works with Claude, ChatGPT, Gemini CLI and Cursor, and Core gets fewer requests per week than Plus [S, https://candor.money/monarch-alternative ; P-snip, https://www.monarch.com/whats-new].
- **Ads in ChatGPT:** an ad tracker shows Monarch ads inside ChatGPT, for example "All Of Your Recurring Bills And Subscriptions In One Calendar" [S, https://www.sprites.ai/monarch-money-ads].

---

## 2. UI and UX patterns

| Area | What Monarch does | Source |
| --- | --- | --- |
| Dashboard | A grid of widgets you can drag, reorder and remove: net worth, recent transactions, investments, budget progress, upcoming expenses, Monthly review, Weekly Recap. A "Customize dashboard" button sits top-right on web and at the bottom on mobile | [P-snip] https://www.monarch.com/features/tracking , https://help.monarch.com/hc/en-us/articles/360058127551-Customizing-Your-Dashboard |
| Net worth | Reports on assets, liabilities and net worth. Charts filter by date range, category, account and tag [S]. The Monthly review shows a four-month net worth progress view and an assets/liabilities split | [P-snip] https://help.monarch.com/hc/en-us/articles/4402543752468-Monthly-Progress-Report |
| Cash flow | Income vs spending bars. A summary card below the chart shows **total income, total spending, net cash flow and savings rate**. A **Sankey** chart is under Reports > Cash Flow | [P-snip] https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports |
| Budget | A "Plan" with category budgets. "Plan progress" appears in the Monthly review | [P-snip] (same Monthly Progress Report article) |
| Goals (Goals 3.0) | Two types: **Save Up** and **Pay Down** (debt). A goal links to cash or investment accounts. Add or withdraw money, **plus a dotted projection line showing expected growth**. Growth rates are a V3 feature. Goals connect to budgets | [P-snip] https://help.monarch.com/hc/en-us/articles/44373110771860-Introducing-Goals-3-0 , https://help.monarch.com/hc/en-us/articles/44373182867476-Using-Save-Up-Goals |
| Recurring | Auto-detection on every sync. On web, a list or **calendar** view with upcoming items in blue and paid items with a green check. On mobile, an "Upcoming" page shows a calendar plus a list. **Bill Sync** pulls card and loan statement balances and minimums. A push or email notification comes **3 days before** a recurring charge. There is no cancellation service | [P-snip] https://help.monarch.com/hc/en-us/articles/4890751141908-Tracking-Recurring-Expenses-and-Bills , https://www.monarch.com/blog/introducing-bill-sync ; [S] https://robberger.com/subscription-manager-apps/ |
| Forecast / scenarios | A projection chart with life-event markers on a timeline, a yearly table, an Events tab, two scenarios on one chart, and a Monte Carlo "Chance of success" gauge plus distribution bars. **Web only** | §1.2 |
| Weekly Recap | On the dashboard and in a weekly email. Covers total spending and its drivers, cash-flow trend, recurring changes and week-over-week net worth change. Ends in an AI follow-up chat. Opens in Demo Mode with amounts hidden. You can opt out in Settings > Preferences | [P-snip] https://www.monarch.com/blog/winter-release , https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features |
| Monthly review | A mobile dashboard card titled "[Month]'s progress" (current month) or "[Month]'s review" (past months). It is **swipeable**, like stories, with sections for cash flow (and a four-month trend), plan progress, top income and expense categories, and net worth change | [P-snip] https://help.monarch.com/hc/en-us/articles/4402543752468-Monthly-Progress-Report , https://www.monarch.com/features/tracking ("swipe through your monthly review"); Mobbin shows a "review introduction" screen: https://mobbin.com/explore/screens/9f98438e-3e8d-4f44-af08-a8acb2332beb |
| Notifications | Recurring-bill reminders (3 days ahead), the Weekly Recap email, and behavior-triggered lifecycle messages (Customer.io) | above, plus https://customer.io/learn/case-studies/monarch-money |
| Mobile vs web | Both exist, with feature parity for most things. **Forecasting, and reportedly the Plus trial, are web only.** NerdWallet says Monarch recommends signing up on web rather than through the app stores (likely to avoid store fees, my inference) | [P-snip]/[S] https://www.nerdwallet.com/finance/learn/monarch-money-app-review |
| Visual style | A warm, calm, premium look: **serif headlines**, a warm near-black ink (#22201d per a third-party token export), pastel palette, generous whitespace and subtle color coding. The marketing site uses pastels with serif type | [S/U] https://designmunk.com/monarch/ , https://purelanding.page/inspirations/track-budget-plan-and-do-more-with-your-money-monarch-money , https://refero.design/ (Monarch dashboard page), https://strihi.com/provider/monarch-money |
| Uncertainty | Monte Carlo % plus the disclaimer "not a guaranteed real-world probability", "directional accuracy, not false precision", and outcome distribution bars. I found no evidence of ranges on the default net worth projection line | §1.2 |

Design galleries exist but I could not open them: Mobbin iOS onboarding flow (28 screens) https://mobbin.com/explore/flows/e12ffc88-2d1f-4cc5-96dd-97761b730c5e ; Nicelydone (sign-up 24 screens, connect bank 12 screens) https://nicelydone.club/apps/monarch/flows ; AppLlama https://appllama.io/apps/1459319842/monarch-budget-track-money ; ScreensDesign https://screensdesign.com/showcase/monarch-budget-track-money . **Look at these for inspiration only. Do not copy screenshots.**

---

## 3. Onboarding

Reconstructed from snippets [S unless marked]:
1. Marketing site or app store, then **sign up** with email and verification. Signup starts at `app.monarch.com/signup/onboarding-welcome` [P-snip URL].
2. A **value-prop carousel** (5 props) [S, teardown snippet].
3. A **"get to know you" quiz**: multi-select goals such as "manage money with a partner" or "track investments", plus "something else" with free text. A **"How did you hear about Monarch?"** attribution screen follows [S, https://johnstone.substack.com/p/product-teardown-monarch-money].
4. **Trial start with a visual timeline** of milestones: today you get full access, then a reminder, then the day the trial ends and you are charged. **A payment method is required** [S/U, teardown snippet + pricing sites]. ScreensDesign calls it a "hard paywall with a free trial" before you can use the app.
5. **Connect accounts.** Monarch's own guide says to connect as many accounts as possible first (checking, savings, cards). Data comes from **Plaid, MX and Mastercard/Finicity**, and the app picks the provider with the strongest connection per bank. If a link fails, you can switch provider [P-snip, https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch]. **Manual accounts are allowed**, but linking is the norm.
6. Then categories, rules and a budget. One 2026 review says to "expect to spend an evening setting up categories and rules before it earns its keep" [S].
7. **Mint import (2023–24):** a Chrome extension exports Mint data to CSV, then Accounts → Import Transactions. Accounts must exist before the import. Mint's export was capped at about 10k rows [S] https://www.fastcompany.com/90984918/how-the-upstart-financial-tracker-monarch-swooped-in-when-mint-announced-it-was-shutting-down

**Time to value:** the first useful screen comes only **after paying (trial) and linking banks**. Real budget value takes hours to days (categorizing), and Forecasting needs 12 months of history. Teardowns differ on screen counts: 7 onboarding steps (ScreensDesign) vs 24–28 sign-up screens (Nicelydone/Mobbin). Either way, **it is long**.

**Lifecycle:** Monarch moved from 4 time-based trial emails to **behavior-triggered** messages. Customer.io (vendor-reported) cites a **+4.4% engagement lift and −3.36% trial cancellations**, and says triggered in-app messages produced a **200% increase in referrals** [S] https://customer.io/learn/case-studies/monarch-money

---

## 4. Retention and growth

- **What keeps users:**
  - The habit loop: Weekly Recap, Monthly review, and bill reminders 3 days ahead.
  - **Household collaboration:** invite a partner at no extra cost under one subscription. Each partner has their own login, and individual accounts can be kept private (eye icon) [P-snip https://help.monarch.com/hc/en-us/articles/19985735202068-Monarch-FAQs ; S reviews].
  - Goals with projection lines, and a fast feature cadence ("cranking out the improvements faster than any other app") [S].
- **Referral:** "Give 50%, Get $50". The friend gets 50% off year one (or a 30-day trial in older terms); the referrer gets a $50 gift card or $14.99/$9.99 in credits (**terms conflict, U**). Terms took effect 30 Jun 2026 per one guide. On web it is under Settings > Referrals [S] https://www.fincomparelab.com/guides/monarch-money-discount/ , https://invitation.codes/monarch
- **Mint migration:** the code `MINT50` gave 50% off plus a 30-day trial. Monarch built a Chrome export extension and fast-tracked a launch in Canada [P-snip LinkedIn; S FastCompany, BetaKit https://betakit.com/as-intuit-winds-down-mint-financial-planning-app-monarch-money-comes-to-canada/]. Its paying base reportedly grew about 20x in the following year [U, see `5-market-retention.md`].
- **Scale:** >1M members and **$100M ARR**, stated by the CEO around Oct 1–2, 2026 alongside the MBI (ex-HMBradley) acquisition. See `3-competitors.md` for sources.
- **Channels:**
  - **YouTube creator reads**: CreatorDB estimates ~403 creators, ~5.5K sponsored posts and ~132M views [S/U, https://creatordb.app/brands/monarchmoney.com].
  - **TV spot**: "The Most Satisfying Way to Understand Your Money" [S, https://www.ispot.tv/ad/g1LA/monarch-money-the-most-satisfying-way-to-understand-your-money].
  - **ChatGPT ads** [S].
  - **SEO and affiliate review sites**: almost every review found is an affiliate page.
  - Referral.
- **Positioning lines** (ideas only, do not reuse):
  - Homepage: "Track, Budget, Plan and Manage Money in One Place" / "home base for money clarity" [P-snip https://www.monarch.com/homepage]
  - Facebook: "The modern way to manage your money"
  - LinkedIn: "A financial coach in your pocket" [S]

---

## 5. What users love and hate

I could not reach Reddit or the App Store review pages. The themes below come from snippets of Trustpilot, review sites and store-listing summaries. The quotes are short snippet excerpts.

**Ratings:** iOS about **4.9★** (sources give 70K to 116K ratings) [S]. Google Play **4.8★, ~26K reviews**, listing updated Nov 10, 2026 [P-snip https://play.google.com/store/apps/details?id=com.monarchmoney.mobile]. Trustpilot is much lower; one aggregator cites 2.3/5 [S https://www.topconsumerreviews.com/best-personal-finance-software/reviews/monarch-money]. Store ratings skew positive, and Trustpilot skews negative.

**Love**
- Design and clarity: "intuitive design and comprehensive budgeting tools" [S].
- Couples and household sharing is "excellent" [S].
- Shipping speed: "cranking out the improvements faster than any other app I have ever used" [S, https://www.mymillennialguide.com/monarch-money-review/ via search].
- Cash-flow forecasting: "the only app I've seen with this feature" [S, review roundup].

**Hate**
1. **Bank sync drops**, called "the most common complaint in reviews": connections need re-authenticating, especially with 2FA, small banks, fintechs and Canadian banks. The big US banks are mostly fine [S] https://walletgrower.com/blog/monarch-money-review-2026 , https://floosyo.com/en/blog/monarch-money-app-review , https://fyn.fyi/blog/monarch-money-not-syncing/
2. **Price and no free tier**: "Monarch Money doesn't have a free version". Plus is seen as expensive, and "most people genuinely do not need what it adds" [S] https://usetweed.com/blog/monarch-money-review/
3. **Support**: "Slow responses to support emails", and support is "friendly but ultimately dismissive". Support suggests workarounds like tags or the transfer tool instead of fixes [S, Trustpilot https://www.trustpilot.com/review/www.monarchmoney.com].
4. **Learning curve and setup time**: "can feel overwhelming at first", and you should "expect to spend an evening setting up categories and rules" [S].
5. **Miscategorization and report errors** [S, Trustpilot].
6. **Forecasting gaps**: it is web only, and Boldin or ProjectionLab are "more robust" for retirement and tax [S]. Results depend on "how regular your income and spending patterns are" [S].
7. **US and Canada only, USD only**: there are no plans to expand currency support [P-snip https://help.monarch.com/hc/en-us/articles/360048393552-International-Accounts-and-Currency].

---

## 6. Gaps and weaknesses LifeGuessr can exploit

| Monarch gap | Evidence | LifeGuessr angle |
| --- | --- | --- |
| **No value before paying and linking.** A hard paywall with a card-required trial, then bank linking, then an evening of setup | §3 | Value in about 60 seconds with no sign-up: the game first, then "your number" from sliders or a sample |
| **Forecasting needs 12 months of categorized history** | help center, §1.2 | We forecast from 5 sliders or a balance sheet (S7/S8) with labeled estimates |
| **Scenarios are user-built.** The user has to think up "buy a house" and wire it in | §1.2 | We **rank** moves in dollars and offer **ready-made A/B pairs** (car vs car, Austin vs Chicago, baby now vs later) |
| **Forecasting is web only**, with complex assumption controls | help center | Mobile-first /what-if with two cards and one chart |
| **Price**: $99.99 Core, about $199 Plus | §1.1 | $39.99/yr, so about 1/5 of Plus. Say "forecasting for the price of a dinner out" |
| **Sync fragility** is complaint #1 | §5 | No bank link means nothing to break. CSV upload is optional |
| **Backward-looking core**: budgets, categorizing, transactions | product structure | Lead with the future (your number in 2036) and decisions. Note: don't say "Monarch only looks backward", because Plus forecasts |
| **No local cost-of-living data**: scenarios use only the user's own numbers | inferred from the event list (no city or area data found) | "Move to Austin or Chicago" uses HUD/BLS/Census area data; the event model can't easily do this |
| **No fun, no shareability, no top-of-funnel for non-users** | no game or social artifact found | Daily game plus shareable cards for streamers and TikTok |
| **Uncertainty is shown as a Monte Carlo %**, which is opaque to novices | §1.2 | Show a simple range band ("$180k–$260k") with an "AI estimate" label |
| US/Canada, USD only | help center | Not exploitable in 24h (we are US only too). Ignore |

---

## What LifeGuessr should borrow (patterns, not assets)

Priority order: impact on the demo and the pitch first, then hours to build.

1. **Two scenarios on one chart, with a "difference" callout.** Screen: **/what-if**.
   - Monarch: duplicates a base scenario, edits one event, and plots both net-worth lines on a single chart that shows where they diverge.
   - Adapt (2–3 h): two lines (A and B) from the same baseline, using the same engine or forecast call with one input changed. Put a big delta label at 2036 ("B leaves you **$48k** ahead"), a marker at the decision year, and two summary cards below. Keep the shared Y axis. Use the existing `forecast()` rules engine plus the "AI estimate" label rule.
2. **Life events as preset chips on a timeline.** Screens: **/what-if** and **S10**.
   - Monarch: pre-built events (home, kid, retire, job change, career break) plus a generic expense event, each placed at a year.
   - Adapt (1–2 h): preset chips ("Buy car", "Move city", "Baby", "Raise") that fill in the B side. Better than Monarch: **we offer ready-made pairs**, so the user never starts from a blank scenario. Show the event year as a dot on the line.
3. **Honest uncertainty copy plus a simple range.** Screens: **S10**, **/what-if**.
   - Monarch: "directional accuracy, not false precision", and its success % says "not a guaranteed real-world probability".
   - Adapt (1 h): add a shaded band around the 2036 line (low/high) plus one line of copy in `copy.ts`, written in our own words, for example "A range, not a promise". This fits our rule that AI forecasts carry an "AI estimate" label. Skip Monte Carlo gauges, which confuse novices.
4. **Swipeable monthly review ("stories").** Screen: **S14** check-in.
   - Monarch: a "[Month]'s review" card that opens 4 swipe sections (cash flow, plan progress, top categories, net worth change, with a four-month trend).
   - Adapt (2–3 h, mock OK): 4 swipe cards: "Your month in one number" (saved or overspent vs plan), "Biggest change", "Your 2036 number moved by $X", and "Next move: …". The last card links to S10. A shareable final card doubles as marketing.
5. **Recap that ends in a question or next action.** Screens: **S14**, **S1**.
   - Monarch: the Weekly Recap closes with "ask the AI a follow-up".
   - Adapt (30 min): end the check-in with the top-ranked Next Move and one "Try it in What if?" button. **Our moves are ranked by computed $, so the CTA is deterministic.**
6. **Goal card with a dotted projection line.** Screens: **S10** (goal), **S1**.
   - Monarch: Save Up goals show a solid progress line plus a **dotted line of expected growth** toward the target.
   - Adapt (1–2 h): add a goal ring or bar on S10 ("Emergency fund: $3.2k of $10k"), with a dotted line from today to the projected reach date ("on track for Aug 2028"). Compute it in the engine, not with the AI.
7. **Cash-flow summary strip.** Screen: **S1** month-end card.
   - Monarch: a summary card under the chart with income, spending, net and **savings rate**.
   - Adapt (30 min): a 4-number strip on the month-end card, with savings rate as a percent label from a decimal field (units rule).
8. **Trial timeline on the paywall.** Screen: **S15**.
   - Monarch: a visual timeline during signup showing today (full access), a reminder, then the charge date.
   - Adapt (1 h): show the same three-step timeline on our simulated checkout with $39.99/yr (or $6.99/mo) and a "reminder 2 days before" promise. **Place the paywall after first value** (after "your number" and one What-if), unlike Monarch's paywall before value. Show the annual plan as default with "save 52%" vs monthly ($6.99×12 = $83.88, so $39.99 saves 52%).
9. **Goal-intent quiz with an "Other" free-text option and an attribution question.** Screen: **S1** (post-game) / ladder.
   - Monarch: multi-select goals, "something else" free text, then "How did you hear about us?".
   - Adapt (1 h): after the game, ask "What's on your mind?" with chips (buy a car, move, baby, debt, retire early, other). The choice pre-selects the /what-if pair and the S10 goal. Add one optional "Where did you find us?" chip row (TikTok / Twitch / friend / other). This measures the streamer channel for the pitch.
10. **Referral: "Give 50%, Get …".** Screens: **S15** and the S3 share card.
    - Monarch: the friend gets 50% off year one, the referrer gets credit. Triggered in-app referral prompts reportedly tripled referrals (vendor claim).
    - Adapt (1 h, demo): a share link on the reveal (S3) and S14 cards: "Give a friend 50% off Pro, get a free month". Trigger the prompt at a **peak moment** (a high game score, or a good check-in), not at random. Use our own wording.
11. **Household / partner framing (later).** Screens: S10, /what-if.
    - Monarch: partner sharing is included at no extra cost and is a top-praised feature.
    - Adapt (copy only in 24h): "Plan it with your partner: share this What-if" via a link, with no accounts needed.
12. **Customizable dashboard (skip for 24h).** Monarch's draggable widgets are nice but not needed. Note it as a roadmap item only.

## What NOT to copy

- **Bank-link-first onboarding and a card-required trial before any value.** That is the opposite of our "no sign-up, no login" rule and our 60-second promise.
- **12-month-history baselines and dense assumption panels** (returns, inflation, volatility, growth per event). Too heavy for 25–45 novices. Keep assumptions in an "i" sheet with labeled defaults.
- **Monte Carlo "chance of success" percentages** as the main output. They are opaque to novices and invite "is that a probability?" questions from judges.
- **Trademarks and names:** "Monarch", "Monarch Plus", "Weekly Recap" as a branded name, "Give 50%, Get $50", "Chance of success", the butterfly logo, and the "Track, Budget, Plan…" tagline. Use our own names, for example "Check-in", "Two futures", "Your number".
- **Copy text:** don't paste any Monarch help-center or marketing sentences into `copy.ts`. Paraphrase the idea in our own voice.
- **Screenshots, illustrations, icons and color palette:** don't trace Mobbin or ScreensDesign frames. Kiko's Figma frames and `tokens.json` are the only visual source. Their warm serif and pastel look is fine as a *genre*, but don't match exact colors or fonts.
- **Pricing tiers:** don't add a $199 "Plus" tier. One simple $39.99/yr Pro is our story.
- **Claims about Monarch** in the pitch: don't say "Monarch can't forecast" or "Monarch requires a bank". Say instead: "Monarch Plus lets you *model* a scenario you built from a year of bank data, on desktop, for ~$199/yr. We *rank* your next moves and compare two futures in a minute, with no login, for $39.99."

## Source list (all accessed via search snippets on 2026-11-15)

Monarch-owned [P-snip]:
- https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch
- https://help.monarch.com/hc/en-us/articles/55283130539028-Understanding-Chance-of-Success-Monte-Carlo
- https://help.monarch.com/hc/en-us/articles/55286998184724-Managing-Forecasting-Assumptions
- https://help.monarch.com/hc/en-us/articles/48349699981972-Monarch-Plus-Tier
- https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features
- https://help.monarch.com/hc/en-us/articles/360058127551-Customizing-Your-Dashboard
- https://help.monarch.com/hc/en-us/articles/4402543752468-Monthly-Progress-Report
- https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports
- https://help.monarch.com/hc/en-us/articles/44373110771860-Introducing-Goals-3-0
- https://help.monarch.com/hc/en-us/articles/44373182867476-Using-Save-Up-Goals
- https://help.monarch.com/hc/en-us/articles/4890751141908-Tracking-Recurring-Expenses-and-Bills
- https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch
- https://help.monarch.com/hc/en-us/articles/19985735202068-Monarch-FAQs
- https://help.monarch.com/hc/en-us/articles/360048393552-International-Accounts-and-Currency
- https://www.monarch.com/blog/forecasting
- https://www.monarch.com/blog/monarch-plus
- https://www.monarch.com/blog/winter-release
- https://www.monarch.com/blog/introducing-bill-sync
- https://www.monarch.com/blog/august-product-update
- https://www.monarch.com/blog/june-product-update
- https://www.monarch.com/whats-new
- https://www.monarch.com/homepage
- https://www.monarch.com/features/tracking
- https://www.prnewswire.com/news-releases/monarch-launches-premium-tier-monarch-plus-302748653.html
- https://play.google.com/store/apps/details?id=com.monarchmoney.mobile
- https://apps.apple.com/us/app/monarch-budget-track-money/id1459319842
- https://www.linkedin.com/posts/monarch-money_mint-shutting-down-how-to-migrate-to-monarch-activity-7128885843364089856-RyNh

Secondary [S]: releasebot.io/updates/monarch; thepennyhoarder.com; getfinny.app (pricing and Core vs Plus); usetweed.com; fincomparelab.com (pricing and discount); finpresso.com; getitplanned.com; centinelmoney.com; candor.money; envelopebudgeting.com; walletgrower.com; floosyo.com; fyn.fyi; trustpilot.com; topconsumerreviews.com; nerdwallet.com; robberger.com; johnstone.substack.com; screensdesign.com; mobbin.com; nicelydone.club; appllama.io; designmunk.com; refero.design; purelanding.page; customer.io case study; creatordb.app; ispot.tv; sprites.ai; fastcompany.com; betakit.com; invitation.codes; spendalyst.com; spotsaas.com.

**Not reached:** Reddit (r/MonarchMoney, r/personalfinance) is blocked for both search and fetch in this sandbox; App Store review text; Product Hunt; and Dribbble. Re-check Reddit sentiment manually before quoting "users say" on a slide.
