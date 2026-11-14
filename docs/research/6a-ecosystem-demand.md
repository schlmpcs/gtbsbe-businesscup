# 6a. Ecosystem ideas: is there real demand? (research, 2026-11-14)

Researched 2026-11-14 by web search. Method notes:
- Direct page fetches were blocked in this sandbox (for example seodata.dev did not resolve). Most figures come from **search-engine snippets** of the pages listed. Open the link and check the number before it goes on a slide.
- **UNVERIFIED** = could not trace to a primary source, vendor self-report with no method, or the snippets disagree.
- "Measure" says exactly what the number counts. Many surveys below ask about *plans* or *feelings*, not behavior. Where that matters, it is flagged.
- Judges measure retention as **subscription renewal**. Each verdict asks two questions: is there demand, and does the idea plausibly help renewal or cheap acquisition?

Summary table (details below):

| # | Idea | Demand | Helps renewal? | Build in 24h? |
|---|---|---|---|---|
| 1 | Decision calendar (dated money moments) | **Strong** (moments are real and large) | Plausible, but retention lift evidence is vendor-only | Yes (fixed dates + reminder email) |
| 2 | Subscription audit "keep/cut" with 10-year cost | **Strong** | Medium (one-off "aha", can produce a dollar win) | Yes |
| 3 | Shareable decision links | **Medium** | Indirect (acquisition) | Yes |
| 4 | Couples mode (shared plan) | **Medium-weak** | Possibly (household lock-in) but evidence weak; couples apps have failed | No |
| 5 | Free SEO calculators | **Medium**, shrinking | No (acquisition only) | Partly |
| 6 | City cost-of-life reports | **Medium-strong** for press, weak for signups | No (acquisition only) | One report is feasible |
| 7 | One-off "Decision Pass" | **Weak-medium** | Risky: can cannibalize annual | Yes, but not advised |
| 8 | Referral "give a month, get a month" | **Medium** | Referred users churn less (one bank study) | Yes |

---

## 1. Decision calendar (reminders before dated money moments)

### Evidence for
The money moments are real, dated and large:

| Moment | Number | Exact measure | Source, year | URL |
|---|---|---|---|---|
| Tax refunds: how many | **99.1M refunds** issued (vs 93.6M in 2025); 145.0M returns received | IRS cumulative filing-season table (late-season snapshot; the exact week is not shown in the snippet) | IRS 2026 Filing Season Statistics | https://www.irs.gov/newsroom/filing-season-statistics-for-week-ending-april-17-2026 (series; see also https://www.irs.gov/node/160296) |
| Tax refunds: size | **$3,462 average refund** through Apr 3, 2026 (+11.1% vs $3,116); a later table shows **$3,276** (+11.5%) | Average refund per refund issued, cumulative | IRS via Tax Foundation, 2026 | https://taxfoundation.org/blog/2026-irs-data-tax-filing-season/ . The IRS weekly figures don't line up cleanly (one later table is lower than an earlier one), so check the final week before citing. Safe wording: "about $3,300–3,500, up ~11%". |
| Total refunded | **$324.8B** in 2026 vs $275.0B in 2025 | Total dollars refunded, same late-season table | IRS 2026 | same series |
| What people plan to do with refunds | Save 39%, pay debt 26% (Trustpilot); everyday expenses 34%, debt 34%, savings 32% (LendingTree); save 52%, pay debt 32%, everyday expenses 30% (NRF/Prosper) | Stated *plans*, multi-select, fielded ~March 2026 | Various, 2026 | https://www.lendingtree.com/debt-consolidation/taxpayer-refund-survey/ ; https://albanyceo.com/news/2026/03/trustpilot-tax-refunds-may-not-fuel-spending-surge-year-new-survey-finds ; https://www.cbsnews.com/news/tax-refund-2026-financial-goals-spending |
| Plan vs reality | **35%** actually used last year's refund for day-to-day costs vs **29%** who planned to; "nearly one in four regret" how they spent last year's refund | Recall of last year's use vs stated plan | Survey cited by InvestmentNews, 2026 (survey sponsor not visible in snippet) | https://www.investmentnews.com/retirement-planning/nearly-one-in-four-americans-regrets-last-years-tax-refund-spending-survey-finds/266325 |
| Holiday spending | **$890.49 per person** planned (−1.3% vs 2024 record $901.99); total Nov–Dec sales forecast $1.01–1.02T; **63%** plan to do most shopping by Thanksgiving weekend | Planned spend per person on gifts, food, decor (NRF/Prosper, 8,247 adults, Oct 1–7, 2025) | NRF, 2025 | https://nrf.com/media-center/press-releases/nrf-expects-holiday-sales-to-surpass-1-trillion-for-the-first-time-in-2025 |
| New Year goals | Wells Fargo/Ipsos: among adults 25+ with income < $100k, 37% had 2026 resolutions; of those **97%** had or considered a financial one, **70%** "save more"; only **34%** very confident they'd achieve them. Motley Fool: >50% plan a financial resolution, ~2 in 5 think they'll stick with it. Vanguard: ~3/4 missed their 2025 saving/spending goals | Stated intentions | Ipsos/Wells Fargo Nov 2025; Motley Fool 2026; Vanguard 2026 | https://www.ipsos.com/en-us/new-survey-reveals-nearly-all-2026-new-years-resolutions-will-have-financial-component ; https://www.fool.com/money/research/financial-new-years-resolutions ; https://investmentnews.com/practice-management/ambitious-but-practical-how-americans-are-setting-their-2026-financial-goals/263679 |
| Lease renewal | **56%** of market-rate apartment residents with leases expiring in H1 2026 renewed; renewal rent growth averaged **~3.5%** in 2026 (move-in rents about flat); ~3.9–4% through 2025 | Renewal conversion rate and renewal lease price change, professionally managed apartments | RealPage via LeaseLock, 2026 | https://leaselock.com/greg-willett-signposts-multifamily-resident-retention-renewal-pricing-power/ ; https://leaselock.com/renewal-lease-rent-growth-2025/ |
| Car loan | Avg new-car payment **$767/mo** (record), used **$537/mo**; avg new loan term **68.9 months** | Average across originations, Q4 2025 | Experian Automotive Finance, Q4 2025 | https://www.experian.com/content/dam/noindex/na/us/automotive/summary-report/2025/q4-2025-auto-quarterly-trends-report-summary.pdf |
| Raise season | 2026 salary increase budgets **~3.5%** (WTW 3.5%, Payscale 3.5%, Conference Board 3.4%); Mercer actual 2026 merit **3.1%**; 2027 plan 3.5% total (Mercer, Aug 2026) | Employer budgets (mean % of payroll) | WTW, Mercer, Payscale 2025–2026 | https://www.imercer.com/articleinsights/2026-actual-increase-budgets-us ; https://www.payscale.com/press-releases/2026-salary-budget-survey ; https://www.mercer.com/en-us/about/newsroom/us-employers-stick-with-moderate-pay-increases-for-2027/ |

On whether event-triggered messaging helps retention:
- Airship (63M users): users who got at least one push in the first 90 days had **~3x higher retention**. Measure: retention of push-receivers vs non-receivers. **Correlational, vendor study, original not checked (UNVERIFIED).** Via https://www.mobiloud.com/blog/push-notification-statistics
- OneSignal 2026: behavior-triggered messages beat standard sends by **4–9x on CTR**. Batch 2025: contextual (triggered) campaigns averaged **14.4% open rate vs 4.19%** for generic. Measure: clicks/opens, **not retention**. https://onesignal.com/blog/the-2026-state-of-customer-engagement-report-is-here/
- The more direct point for us is that **low usage drives churn**. A vendor blog says "not enough usage" is the top stated cancellation reason (37%) and usage drops 10–28 days before cancel (**UNVERIFIED**, no method): https://www.airbridge.io/en/blog/how-to-spot-users-who-are-about-to-churn . An annual plan only renews if the user came back during the year, so dated moments are a reason to come back.

### Evidence against
- **No study found that shows seasonal/event reminders raise subscription renewal.** All the "push improves retention" numbers are vendor-published and correlational: engaged users opt in more.
- Our app is **web-only, no login**. Web push opt-in in financial services is cited at **0.5–10%** (vendor roundups, UNVERIFIED): https://sleeknote.com/?p=138964 . iOS web push only works for home-screen web apps. In practice reminders need an email address, which adds friction to "no sign-up".
- Survey plans ≠ behavior: refund "plans" drift toward day-to-day spending (35% vs 29% above). New Year intentions collapse (only ~34–40% expect to follow through).
- Rent renewal is ~once a year and car payoff is ~once every 5–6 years per user. Most calendar entries fire rarely for any one person.
- Year-1 renewal for low-priced annual apps is only ~36% (RevenueCat, see `1-unit-economics.md`), and RevenueCat 2026 says **95% of annual subscribers who cancel never return** (https://9to5mac.com/2026/05/27/new-report-shows-annual-app-subscribers-rarely-return-after-they-cancel/). A calendar helps only if it brings users back *before* the renewal date.

### Verdict: **Strong demand** for the moments (big, dated, near-universal: 99M refunds averaging ~$3.3–3.5k; $890 holiday spend; 56% renew a lease at +3.5%). **Retention effect: plausible, not proven.** Cheap to build: a static calendar plus "email me 7 days before". Pitch it as "your annual plan pays you back 4–5 times a year", not as an engagement trick. Put a calendar moment ~2–4 weeks before the user's renewal date.

---

## 2. Subscription audit ("keep/cut" swipe with 10-year cost)

### Evidence for
| Number | Exact measure | Source, year | URL |
|---|---|---|---|
| Guess **$86/mo** vs itemized **$219/mo** (gap $133/mo, ~$1,600/yr); **42%** forgot they were still paying for a service they stopped using | Off-hand guess vs category-by-category itemized total, 1,000 US consumers, Apr–May 2022 | C+R Research 2022 (via CNBC) | https://www.cnbc.com/2022/09/06/consumers-underestimate-monthly-subscription-costs-by-at-least-100.html |
| **~$90/mo ($1,080/yr)** average subscription spend; **~$205/yr** on forgotten or unused subscriptions | Self-reported, 2,440 US adults, YouGov Apr 28–30, 2025 | CNET 2nd annual subscription survey, 2025. The $205 figure appears only in secondary coverage (**UNVERIFIED** against CNET) | https://975wcos.iheart.com/content/2025-05-16-you-may-be-shocked-to-find-out-what-youre-spending-on-subscriptions ; https://cordcuttersnews.com/americans-spend-over-200-a-year-on-unused-subscriptions-here-is-how-to-easily-stop-them/ |
| **43%** of US consumers feel they pay for subscriptions they don't use; avg **5.2 subscriptions, ~$70/mo** | Survey, Bango, Mar–Apr 2026 (4,000 US+UK households for the 5.2 figure) | Bango via The Desk, 2026 | https://thedesk.net/2026/03/bango-subscription-consumer-price-fatigue-survey-bundles/ |
| **89%** underestimate monthly subscription spend; 66% off by > $200/mo | West Monroe survey (2021 edition per most sources; rises from 84% in 2018) | West Monroe | https://westmonroe.com/perspectives/report/the-state-of-subscription-services-spending-ungated |
| **39%** cancelled a paid streaming service in the past year (**50%** of Gen Z and Millennials); **41%** cancelled at least one SVOD in the past 6 months (2026 ed.); ~40% cut entertainment subs in last 3 months over money concerns | Self-reported behavior, ~3,500 US consumers | Deloitte Digital Media Trends 2025 and 2026 | https://www.tvtechnology.com/news/survey-consumers-express-growing-dissatisfaction-with-streaming-services ; https://senalnews.com/en/data/usa-streaming-at-a-crossroads-as-churn-persists-and-fandom-emerges-as-growth-engine/news@senalnews.com |
| **69%** of streaming subscribers feel "subscription fatigue"; 25% of adults 30–44 cancelled or plan to cancel streaming to ease strain | CivicScience poll, May 2025 | CivicScience 2025 | https://civicscience.com/state-of-streaming-as-uncertainty-mounts-video-streamers-scale-back-and-rethink-loyalty/ |
| Rocket Money: company claims millions of subscriptions cancelled and "$1B+" (later "$2.5B") saved; 4.1M premium members end-2024 | Company marketing claims; members from Rocket Companies filings | Rocket Money | https://onboarding.rocketmoney.com/join ; see `5-market-retention.md` |

People do act: roughly 4 in 10 cancel at least one streaming service a year. And Rocket Money built a ~$386M run-rate business with cancellation as its hook. That is strong proof people pay to find and cut subscriptions.

### Evidence against
- **Crowded and commoditized.** Rocket Money, PocketGuard, Monarch, banks (e.g. card "recurring charges" views) and iOS/Android subscription settings already list subscriptions. Our "10-year cost" framing is the only new part.
- **Without a bank link, we can't find forgotten subscriptions.** The $86 vs $219 gap exists because people don't remember them, so a manual list misses exactly the forgotten ones. We'd need the CSV upload path (already in the product) to make this honest.
- **Most of the cutting is streaming churn-and-return.** Deloitte: 24% "churn and return". S&P: 50% add/drop SVOD seasonally in 2025. The 10-year cost of a service someone rotates is overstated.
- C+R's 2022 numbers are old and were a marketing survey. No 2024–2026 replication with the same "guess vs itemized" method was found.
- One-off value: once you've cut, there's less reason to come back. Rocket Money monetizes bill negotiation and budgeting, not only cancels.
- The FTC "click-to-cancel" rule was **vacated** by the 8th Circuit on **July 8, 2025** (https://www.fenwick.com/insights/publications/eighth-circuit-vacates-ftcs-click-to-cancel-rule). Cancelling stays harder than it should be in many states (California has its own law). This is good for the pain story, but we can't cancel for the user anyway.

### Verdict: **Strong demand.** Best stats: **$86 guess vs $219 actual (C+R 2022)** and **43% feel they pay for subscriptions they don't use (Bango 2026)**. It's a good "aha" screen and a natural top money move ("cut 2 subscriptions = $X in 10 years"). Keep it as a module inside the forecast (reads from the CSV or the manual list), not a separate product.

---

## 3. Shareable decision links ("Should we get this car?")

### Evidence for
| Number | Exact measure | Source, year | URL |
|---|---|---|---|
| **65%** of married/cohabiting adults rank money in their top-3 relationship stressors (#1, ahead of health, work, intimacy); **46%** say money is the most uncomfortable subject with their partner | Morning Consult, 820 married/cohabiting US adults, Sept 2–4, 2026 | CFP Board "To Have and to Hold", Oct 2026 | https://www.cfp.net/news/2026/10/money-outranks-health-work-and-intimacy-as-top-stressor-for-american-couples-new-survey-finds |
| **28%** of couples argue about finances at least monthly; **39%** of Millennials | 1,005 US adults, late 2025 | Credit Karma 2025 | https://www.creditkarma.com/about/commentary/more-prenups-less-joint-accounts-modern-romance-means-financial-protection-and-independence |
| Spending habits (**53%**) and impulse buying (**45%**) top married couples' money arguments | 1,008 married Americans | Western & Southern, 2026 | https://www.westernsouthern.com/money-conversations-before-marriage-2026 |
| **Nearly half** of couples deliberately avoid money conversations to avoid conflict; 58% say contributions are unequal | 3,000+ married/partnered adults | Fidelity Couples & Money 2026 (via InvestmentNews) | https://www.investmentnews.com/practice-management/couples-are-confident-about-money-but-still-hiding-secrets-from-each-other/266737 |

The pain is real: big purchases (car, move, child care) are shared decisions and money talks are hard. A neutral link ("here is what this car does to *our* 10-year forecast") gives couples something concrete to look at instead of arguing. Each link shared is also a free acquisition touch.

### Evidence against
- **No data found on how often people send a "should we buy this?" link to a partner, or on share rates of finance-calculator results.** Car-purchase decision-maker data (Cox Automotive Car Buyer Journey) did not show a spouse-involvement figure in search results.
- Couples increasingly keep money separate (see idea 4), so many purchases are not joint decisions.
- Money is "the most uncomfortable subject" (46%). Some people won't want an app to put a number in front of their partner.
- Privacy: a link exposes income and debts. Our privacy rules mean the link must carry only the decision, not the profile, or be opt-in per field.

### Verdict: **Medium demand.** Best stats: **65% rank money as a top-3 relationship stressor (CFP Board 2026)** and **28% argue about money monthly, 39% of Millennials (Credit Karma 2025)**. It's cheap (read-only result page from URL state), it's a viral loop and it fits no-login. Build it as a share card, not as a collaboration feature.

---

## 4. Couples mode (one shared plan for two)

### Evidence for
- Couples are a big share of 25–45 adults, and money is their #1 stressor (CFP Board 2026, above).
- Monarch markets couples heavily: partner invite at **no extra cost**, separate logins, one household view, "for couples" landing pages. https://www.monarchmoney.com/for-couples ; https://help.monarch.com/hc/en-us/articles/20926382202004-Monarch-for-Couples . Sacra frames shared use as "household lock-in" (https://sacra.com/chat/h/d8600f0b-b848-475c-ab78-098f71bcf66f/, analyst note, no number).
- Family/shared plans are associated with lower churn in telecom (J.D. Power, Yankee Group, PwC reasoning; mostly 2005–2012). Measure is switching *intent* or analyst modeling. https://www.rcrwireless.com/20050801/carriers/brady-bunch-plans-give-operators-lower-arpu-lower-churn . No subscription-app number found (RevenueCat/Phiture household claim is via a third-party blog: **UNVERIFIED**).
- Honeydue (free, tip-based couples app) is still live with **1M+ installs** and a 4.5 iOS rating (aggregator data, **UNVERIFIED**). https://www.experian.com/blogs/ask-experian/honeydue-app-review/

### Evidence against
- **Zeta**, the best-known couples money app (joint accounts + budgeting), **shut down in May 2025**; Acorns bought its assets in June 2025 and the founders joined Acorns. Consumer guides say the couples app was not continued (**UNVERIFIED** detail). https://acorns.com/learn/acorns-zeta-acquisition/
- **Honeydue** survives but is **free with optional $1–10 tips**, not a paid subscription. That says couples tools have trouble charging. Honeyfi/Firstly reportedly closed its consumer app (single user report, **UNVERIFIED**).
- **Couples are merging money less.** Bankrate (YouGov, Dec 2025): only **38%** of couples fully combine finances, **26%** keep everything separate; among married/live-in Millennials **32%** fully combine, Gen Z **22%**. https://www.bankrate.com/press-releases/most-couples-keep-at-least-some-of-their-money-separate/ . Census via Empower: **23%** of couples have no joint account (vs 15% in 1996). https://www.empower.com/the-currency/life/saying-i-do-to-separate-finances-news
- Monarch gives the partner seat **free**: the market price of "couples" is $0 extra, so it is not a separate revenue line.
- Technically a two-person shared plan needs accounts and sync, which conflicts with **no-login** and 24h.
- No public number for the share of Monarch users who use the partner invite.

### Verdict: **Medium-weak demand as a product.** Best stats: **Zeta shut down May 2025** and **only 38% of couples fully combine finances (Bankrate 2026)**. Don't build it for the hackathon. Say "household forecast (two incomes)" inside one profile, plus idea 3's share link. Mention couples mode as roadmap only.

---

## 5. Free SEO calculators (true cost of a car, daycare vs rent by ZIP)

### Evidence for
| Number | Exact measure | Source, year | URL |
|---|---|---|---|
| "living expenses calculator" **74,000/mo** US, CPC $4.67; "budget calculator" **22,200/mo**; "how to make a budget" 165,000/mo | Google Ads API volumes via seodata.dev (search snippet; site blocked here) | seodata.dev 2026 | https://www.seodata.dev/keyword/expense-and-income-calculator . **Exact volumes for "car affordability calculator", "rent affordability calculator" and "cost of living calculator" were NOT found: UNVERIFIED.** Check in Google Keyword Planner/Ahrefs before citing. |
| Finance & Insurance Google Ads CPC **$3.39–3.46** | Paid search benchmark (shows the value of the organic click) | WordStream 2025/2026 | https://www.wordstream.com/blog/2025-google-ads-benchmarks |
| SmartAsset's and MoneyGeek's business model is built on free calculators and data studies (observation) | — | — | https://moneygeek.com/cost-of-living-calculator ; **no traffic number found** |
| MIT Living Wage Calculator: **~100,000 hits/mo** (2018), was #1 Google result for "living wage" | MIT News, 2018 ("hits", not uniques) | MIT 2018 | https://news.mit.edu/2018/mit-corporations-nonprofits-putting-living-wage-calculator-action-0821 |

### Evidence against
- **AI Overviews cut clicks.** Ahrefs (Dec 2025 data, published Feb 2026): an AI Overview correlates with **58% lower CTR** for the #1 result (34.5% in the April 2025 version). Seer Interactive (Nov 2025): organic CTR on AI-Overview queries fell **61%** (1.76% → 0.61%). https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/ ; https://ppc.land/google-ai-overviews-reduce-organic-ctr-61-paid-traffic-68/
- **NerdWallet**, the biggest finance SEO player, called its 2025 organic visibility "pretty brutal", citing "steep organic search declines" as people moved to AI Overviews and LLMs; credit-card revenue fell 25% YoY in Q2 2025 for that reason. https://searchengineland.com/nerdwallet-organic-search-visibility-challenges-447884 ; https://www.marketbeat.com/instant-alerts/nerdwallet-q4-earnings-call-highlights-2026-02-25/
- Partly in our favor: AI Overviews trigger on ~16–20% of queries overall and rarely on 1–3 word queries (Ahrefs, Semrush). Short "X calculator" queries may be less affected, **but no calculator-specific study was found (UNVERIFIED)**. https://ahrefs.com/blog/ai-overview-triggers/
- The SERP is saturated (NerdWallet, Bankrate, Edmunds, Zillow, Omni Calculator, credit unions, Google's own widgets). A new domain won't rank in months, let alone in a hackathon.
- SEO pays back on a 6–18 month horizon. It does nothing for renewal.

### Verdict: **Medium demand, shrinking channel.** Best stats: **AI Overviews → ~58–61% lower CTR (Ahrefs 2026, Seer 2025)** and **NerdWallet's "steep organic search declines" (2025)**. Calculators are worth building *only* because the engine already computes them: expose 2–3 as standalone, shareable, no-login pages (car true cost, daycare vs rent by ZIP). Pitch them as share and LLM-citation magnets (NerdWallet says LLM referrals convert better, small volume), not as a Google traffic plan.

---

## 6. City cost-of-life reports ("What a life costs in Austin 2026")

### Evidence for
- **SmartAsset "salary needed to live comfortably" (June 2025)**, based on MIT Living Wage data + 50/30/20, was picked up widely: CNBC (syndicated on NBC Los Angeles), Nasdaq, Fox 5 DC, Fox 35 Orlando, ClickOrlando, Spokesman-Review, CPA Practice Advisor, plus Stacker syndication to local TV sites (KTVZ, ABC17, KVIA). Headline numbers: Hawaii **$124,467** for a single adult, West Virginia $80,829; San Jose **$147,430** (city study). https://smartasset.com/data-studies/salary-needed-live-comfortably-2025 ; https://www.nbclosangeles.com/news/business/money-report/the-salary-a-single-person-needs-to-live-comfortably-in-all-50-u-s-states-its-over-120000-in-2-places/3717880/
- The format repeats every year with new pickup, so press demand for city/state rankings is durable.
- Journalists want data: Muck Rack State of Journalism 2025 ranks "original data" among top pitch preferences (**66%** in one write-up; another reading says relevance 66% and exclusives 57% overtook research reports, so **UNVERIFIED**); 2026 edition: **40%** value original data or research. https://www.prnewsonline.com/the-state-of-journalism-in-2025-insights-to-optimize-your-media-relations/ ; https://umarcomm.umn.edu/blog/2026/04/13/pitching-journalists-muck-racks-state-journalism-2026
- Agency case studies of finance data campaigns: a personal finance site's "cost of beer by state" earned **108 backlinks**; Homebase wage data **107 backlinks**; a card issuer **495+ pickups** (agency self-reports, **UNVERIFIED**). https://gofishdigital.com/case-study/homebase/ ; https://www.pageonepower.com/hubfs/Case%20Studies%202026/financial-services-case-study.pdf
- We already have the data pipeline (HUD, Census, BLS, child care) and a "what a life costs" game. A city report is a by-product.

### Evidence against
- **Very crowded**: SmartAsset, MIT Living Wage, GOBankingRates, Zillow, Redfin, Numbeo, MoneyGeek, Plasma all publish city cost lists. Journalists can pick the incumbent.
- Press coverage ≠ signups. Coverage links to the report, often nofollow, and readers rarely convert into a paid app. **No data found on signups per data-PR campaign.**
- The 2026 Muck Rack survey shows "original data" valued by only **40%** of journalists, down from the 2025 readings.
- Credibility risk: our numbers are model estimates. Coverage of "AI-made" numbers can backfire if a journalist finds a wrong figure. Golden rule 5 (every number has a source) is the defense.

### Verdict: **Medium-strong for press, weak for direct signups.** Best stats: **SmartAsset's 2025 "live comfortably" study syndicated across CNBC/NBC, Nasdaq, Fox affiliates and Stacker local TV** and **Muck Rack: journalists want original data (40–66%)**. Do one launch report ("What a normal life costs in 50 metros, 2026", child care included, which SmartAsset doesn't break out) for the pitch. Don't count it as a CAC channel with a number.

---

## 7. One-off "Decision Pass" ($9.99 for one big decision, credit toward annual)

### Evidence for
- Fatigue is real: CivicScience **69%** "subscription fatigue" among streamers (2025); S&P Global Q3 2025: **85%** of internet adults say SVOD is too expensive, and seasonal add/drop rose from 21% (2019) to **50%** (2025). https://www.spglobal.com/market-intelligence/en/news-insights/research/2025/11/americans-love-svod-services-but-think-they-are-too-expensive
- Bango 2026: **43%** feel they pay for subscriptions they don't use; Bango 2025: **53%** cancel and restart AI tools as needed (behavior is moving to "pay when I need it"). https://thedesk.net/2026/03/bango-subscription-consumer-price-fatigue-survey-bundles/ ; https://thedesk.net/2025/11/bango-american-survey-subscription-ai-bundles/
- Hybrid monetization works in apps: RevenueCat (SOSA 2025) says subscription + lifetime is the **second most common** monetization model in most categories, and apps that add lifetime/consumables "see stronger revenue and retention" (summary, no number). https://www.revenuecat.com/blog/growth/lifetime-subscriptions ; https://subscriptioninsider.com/article-type/news/revenuecats-state-of-subscription-apps-2025-report-ais-dominance-retention-challenges-and-the-shift-away-from-pure-subscriptions
- Finance precedent: PocketGuard sells a **lifetime plan (~$149.99**, sometimes discounted to $79.99) next to $74.99/yr. https://www.nerdwallet.com/finance/learn/pocketguard-app-review . Big decisions (car, lease, child) are episodic, so per-decision pricing matches how the need arrives.

### Evidence against
- **Judges score renewal.** A one-off pass is by definition non-renewing revenue and teaches users that the product is for one moment.
- **Cannibalization:** $9.99 is 25% of the $39.99 annual. Many users who would have bought annual (and maybe renewed) buy the pass instead. **No head-to-head benchmark of one-time vs subscription conversion was found.**
- Consumers don't uniformly prefer one-time purchases: BSA/FocalData (Oct 2025, Europe, industry-funded) found **65%** prefer subscriptions to one-time purchases for software. https://www.bsa.org/files/reports/10212025bsaeusubservices.pdf . The Chargebee 2025 consumer report says "cancel anytime" flexibility, not one-off pricing, drives loyalty.
- RevenueCat 2026: **72%** of annual subscriptions cancel in year one and 95% of cancelers never return. A pass doesn't fix that, and a pass holder who doesn't upgrade is gone.
- The monthly plan ($6.99) already *is* a cheap "decision pass" with cancel-anytime. A $9.99 one-off is more expensive than one month and adds pricing complexity.

### Verdict: **Weak-medium.** Best stats: **S&P Global: 50% add/drop subscriptions seasonally (2025)** for the case for; **RevenueCat: subscription + lifetime is the #2 monetization model** but no proof it lifts renewal. Recommendation: **don't add it.** Use the monthly plan as the low-commitment entry and offer "upgrade to annual, first month credited". Mention the pass only as an experiment to A/B test later.

---

## 8. Referral "give a month, get a month"

### Evidence for
| Number | Exact measure | Source, year | URL |
|---|---|---|---|
| Referred customers churned about **18% slower** and had higher contribution margin; the margin gap shrinks over time, the retention gap persists | ~10,000 customers of a German bank tracked ~3 years | Schmitt, Skiera, Van den Bulte (Journal of Marketing 2011) / Wharton | https://faculty.wharton.upenn.edu/wp-content/uploads/2012/04/Schmitt-Skiera-vandenBulte-2011-Referral-Programs-Customer-Value.pdf ; https://knowledge.wharton.upenn.edu/article/turning-social-capital-into-economic-capital-straight-talk-about-word-of-mouth-marketing/ |
| Monzo: **~79%** of new customers joined via word of mouth incl. referrals (FY2026); "over two-thirds" FY2025; referral spend +40% to **£29.5M** | Company annual report (UK neobank, not a subscription app) | Monzo 2025–2026 | https://monzo.com/annual-report/2026 ; https://www.pymnts.com/?p=3769163 |
| YNAB runs exactly this mechanic: "you'll each get an additional free month" | Program terms | YNAB, current | https://www.ynab.com/referral/ |
| Monarch: up to **$480/yr** referral rewards, max 10/yr (terms Feb 27, 2026) | Program terms | Monarch 2026 | https://www.monarch.com/referralprogramterms |
| **~35%** say they find new personal-finance apps through friends' suggestions (vs 32% social media, 16% search) | Survey, method and sample unknown | Expert Market Research (**UNVERIFIED**) | https://expertmarketresearch.com/articles/discovering-new-personal-finance-apps |
| Recommendations from people you know are the most trusted ad source: **83–89%** trust | Nielsen Global/US Trust in Advertising (2015 global, 2021 US) | Nielsen | https://develop.nielsen.com/wp-content/uploads/sites/2/2022/02/2021-Nielsen-Trust-In-Advertising-U.S.-sell-sheet.pdf |

### Evidence against
- **No credible benchmark for "referral share of signups" in subscription apps was found.** The only number is a vendor's: "1 in 5 new customers" for GrowSurf's own SaaS clients (https://growsurf.com/statistics/saas-referral-statistics/), which is selection-biased.
- Participation is low: guides cite **5–15%** of subscribers ever referring (vendor, **UNVERIFIED**). A fitness-app case: 49,402 enrolled → 668 shares → 4,742 visits → **151 paid** (~0.3% of enrolled produced a paying referral). https://referralhero.com/blog/fitness-app-referral-program-case-study
- Monzo's 79% includes organic word of mouth and a cash bonus of £10–50, which is far stronger than a free month of a $6.99 app.
- Sacra notes Monarch grew while largely **avoiding ads and referral-led growth** (analyst note, **UNVERIFIED**): https://sacra.com/chat/h/9b4fc67c-1811-47a8-bec4-bae92e27a562/
- The Wharton result is one bank, 2006 cohort. Its applicability to a $40/yr app is assumed, not shown.
- "Give a month" needs accounts or codes to attribute, which adds friction to no-login.

### Verdict: **Medium.** Best stats: **referred customers churn ~18% slower (Wharton/JM, bank)** and **Monzo: ~79% of new customers via word of mouth incl. referrals (FY2026)**. Cheap to add once Stripe exists (coupon code = one free month for both). Model it as a small channel (5–10% of signups is a reasonable *assumption*, not a benchmark). The existing CAC model in `2-cac-channels.md` uses 10% at ~$7; that 10% is our assumption, not a sourced figure.

---

## What to tell judges (one line per idea)

1. **Decision calendar:** "99 million refunds averaging ~$3.4k, a $890 holiday season, a lease renewal at +3.5%: the app shows up before each one. That's why you keep it for a year." (IRS 2026, NRF 2025, RealPage 2026)
2. **Subscription audit:** "People guess $86/month on subscriptions and actually pay $219." (C+R 2022) "43% pay for subscriptions they don't use." (Bango 2026)
3. **Share link:** "Money is the #1 stressor for 65% of couples." (CFP Board 2026)
4. **Couples mode:** roadmap only. Zeta shut down in 2025; only 38% of couples fully combine money.
5. **Calculators:** byproducts of the engine, built to be shared and cited by LLMs. AI Overviews cut organic CTR ~58–61%.
6. **City report:** SmartAsset's yearly "live comfortably" study shows the press format works. We add child care and a 10-year view.
7. **Decision Pass:** not shipped. The monthly plan is the low-commitment entry; renewal is what we're judged on.
8. **Referral:** give-a-month mechanic (like YNAB). Referred customers churn ~18% slower in the one rigorous study we found.
