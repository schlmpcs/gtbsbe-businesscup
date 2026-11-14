# Synthetic bank statements

Fifty CSV exports of invented US checking accounts, one household each, for demos and for testing
the statement pipeline (CSV reading, name masking, categorization, pay detection, forecasting).

**Everything here is fictional.** People, employers, landlords, account numbers and banks are made
up. The merchants are real chains and utilities because that's what real statements contain, and a
categorizer has to recognize them.

## Why synthetic

We looked for public datasets of real US bank statements first, and none fits. Real statements are
personal data, so they are almost never published. What does exist:

| Dataset | What it is | Why it doesn't fit on its own |
|---|---|---|
| [DoDataThings/us-bank-transaction-categories-v2](https://huggingface.co/datasets/DoDataThings/us-bank-transaction-categories-v2) (MIT) | 68k synthetic US transaction descriptions with category labels | No dates, amounts or people; useful only for scoring a categorizer |
| [BLS Consumer Expenditure Survey PUMD](https://www.bls.gov/cex/pumd_data.htm) | Real, anonymized household spending by category | No transactions or merchant text |
| [Mendeley "Bank Transactions Dataset"](https://data.mendeley.com/datasets/dnxtg6n4rv/1) (CC BY 4.0) | ~6.5k real, anonymized rows from one account | Country not stated, no category labels |
| Sparkov / IBM TabFormer | Synthetic card transactions | Card data, not checking; fake-looking merchants |
| Plaid / MX / Yodlee sandboxes | Test APIs | Not downloadable datasets |

## Files

```
hh01-austin-single-renter.csv … hh50-minneapolis-teacher-single-dad.csv   the statements
labels/answer-key.csv     one row per statement row: file, row, category, kind, one_off, label_basis
labels/households.csv     who each household is, plus opening/closing/min balance and fee count
```

`row` in the answer key is the 1-based data row (header excluded) in the order the file lists it.

## Layouts

Each file is in one of five layouts, all of which the app's CSV reader auto-detects (date,
description, and either a signed amount or separate debit/credit columns).

| Layout | Files | Header | Quirks worth testing |
|---|---|---|---|
| Big bank A | 13 | `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #` | Same columns as `../statement.sample.csv`; newest first; signed amounts; check numbers; Chase-style Zelle lines |
| Big bank B | 9 | `Date,Description,Amount,Running Bal.` | Every field quoted, CRLF line endings, thousands separators in the balance; `CHECKCARD` lines with long reference numbers; ACH lines carry `INDN:` (the account holder's own name) |
| Credit union | 10 | `Posting Date,Description,Debit,Credit,Balance` | Unsigned debit/credit columns; `POS PURCHASE` / `ACH DEBIT` prefixes; share drafts |
| Online bank | 8 | `Date,Time,Amount,Type,Description` | UTF-8 BOM, ISO dates, transaction (not posting) dates, monthly interest |
| Neobank | 10 | `Transaction Date,Description,Withdrawals,Deposits` | Cleaned, title-cased merchant names; early direct deposit; "Pay Friends" P2P instead of Zelle; no balance column |

Posting-date layouts never show a weekend or a Fed holiday (Labor Day, Columbus Day, Veterans Day
2026). Transaction-date layouts do, because that's when people actually shop.

## Answer key

`kind` says what a row *is*:

| kind | meaning | `category` |
|---|---|---|
| `income` | Paychecks, gig and freelance payouts, child support, cash tips deposited, interest | blank |
| `spend` | Money spent, including fees, taxes and debt payments | one of the app's 8 |
| `refund` | A merchant giving money back | the original purchase's category |
| `reimbursement` | A friend paying their share back (Venmo/Zelle in) | blank |
| `transfer_out` | To the household's own savings, brokerage, 529 or crypto | blank |
| `transfer_in` | From the household's own savings | blank |

Note that the app's categorize endpoint currently counts every credit as pay and files transfer
lines under `other`. The `kind` column is there to measure exactly that.

Category conventions, following `docs/ARCHITECTURE.md`:

- `rentUtilities`: rent (portal, check, or Zelle/Venmo to a landlord or roommate), HOA dues, electricity, gas, water, internet and phone.
- `car`: running costs only: fuel, car insurance, parking, tolls, oil changes, repairs, registration and car-wash plans.
- `debtPayments`: mortgage, car loans and leases, student loans, personal loans, credit-card payments and BNPL installments.
- `childcare`: daycare and pre-K tuition, after-school programs, summer day camp, and babysitters or grandparents paid by P2P.
- `subscriptions`: streaming, music, cloud storage, gyms, software and Amazon Prime.
- `eatingOut`: restaurants, coffee, bars and food delivery.
- `groceries`: supermarkets, warehouse clubs and Instacart.
- `other`: everything else, including shopping, pharmacy, health, transit and rideshare, travel, pets, P2P to friends, ATM cash, bank fees and estimated tax.

A merchant always gets the same category in every file (the test suite enforces this). The
exceptions are P2P payments and checks, which are labelled by purpose. That makes them
intentionally hard: `CHECK 1043` is rent, and a Zelle to a named person can be rent, childcare or
splitting dinner.

`one_off` marks irregular purchases the month-end projection should ignore: trips, car repairs,
vet and urgent-care bills, back-to-school shopping, annual fees and estimated tax payments.

`label_basis` says what the label can be inferred from, so tests can score each group separately:

| label_basis | rows | meaning |
|---|---:|---|
| `merchant` | ~8,500 | The description names a merchant, employer, biller or own-account transfer |
| `memo` | ~30 | A P2P payment whose memo settles it ("rent", "babysitting", "invoice"…) |
| `context` | ~520 | A P2P payment or check whose purpose is not in the text. Only the household's story tells you, e.g. that a Zelle to a named person is the rent |

Score a categorizer on `merchant` rows. `context` rows are a fair test only of a model that also
sees the household's history, so report them separately. They carry a large share of rent dollars.

## What the data is grounded in

- **Households**: 50 hand-written briefs across all 15 metros and 60 ZIPs in `../../out/areas.json`.
  They cover singles, roommates, couples, families with 1–3 kids, single parents, homeowners and
  renters. Earners include salaried, hourly, tipped, gig, freelance, military, teacher (monthly
  pay) and two-income households, with gross incomes from about $33k to $390k.
- **Area costs**: rent, groceries (USDA moderate plan), childcare (DOL NDCP county medians), gas
  price and car insurance come from `areas.json`, the same values the app shows for that ZIP.
  Rent there is gross rent, so contract rent is drawn at 84–94% of it and utilities are billed
  separately.
- **Pay**: take-home is worked out from 2026 federal brackets and standard deductions, the child
  tax credit, FICA, flat state rates, NYC and Philadelphia local taxes, CA SDI, 401(k)/pension and
  health premiums. It's approximate, but it lands where real paychecks do. Pay schedules follow
  real practice: weekly hourly work, biweekly Fridays, semimonthly on the 15th and last business
  day, military on the 1st and 15th, and teachers monthly.
- **Merchants**: regional chains only in the states where they trade, and destination stores in
  the town where they actually are (Buc-ee's in Katy, IKEA in Schaumburg, Costco for Agoura
  Hills in Westlake Village). Utilities are local to each ZIP, and no chain that closed in 2024–25
  appears. Store-level placement inside a metro is plausible, not verified store by store. Subscription prices are 2026 list prices, with digital sales tax where
  the city charges it. Chick-fil-A is closed on Sundays.
- **Real-life patterns**: weekend-heavy restaurant spending, seasonal electricity and gas bills,
  back-to-school shopping and Halloween costumes, and pay-in-4 BNPL every two weeks. Gig drivers
  take instant payouts and pay estimated tax on Sept 15. Some families get help with childcare
  (subsidy copays, NYC free pre-K, grandparents), and one SNAP household buys most groceries off
  the account.
- **Balances that match the story**: the generator calibrates each household until the balance
  behaves the way its brief says. Tight budgets drift slightly negative and overdraft under their
  bank's fee policy. Big banks and credit unions charge a fee per item. Online banks and
  neobanks charge nothing, float at most $100–200, and decline or return anything past that.
  One household has a few small BNPL and streaming charges returned, as `notes` says. Comfortable households keep a cushion
  and sweep the surplus to savings. `households.csv` records the min balance and fee count, and `notes` explains
  anything unusual (childcare subsidy, grandparent care, SNAP, rent-regulated unit, drawing down
  savings).

## Limitations

- Households that put most spending on a credit card (`notes` says so) show it as a single card
  payment in `debtPayments`. That is how a checking statement really looks, but it understates
  their eating out and shopping.
- Mortgages count as `debtPayments`, per the app's debt model, so a homeowner's `rentUtilities` is
  just utilities.
- Taxes, insurance factors and rent levels are planning estimates, not measurements. Rent inherits
  the illustrative status of `areas.json`.
- Any accuracy measured on these files is accuracy on synthetic data and should be reported that way.

## Regenerating

```
node packages/data/scripts/gen-synthetic-statements.mjs            # rewrites this folder
VERBOSE=1 node packages/data/scripts/gen-synthetic-statements.mjs  # plus per-household budget summary
```

The output is seeded and identical on every run. `fixtures/synthetic-statements.test.ts` checks
the following, and runs with `pnpm test`:

- column detection and row shape
- answer-key coverage, categories, kinds and label basis
- running balances
- business-day posting
- exactly one rent or mortgage payment per month
- merchant–category consistency
- raw names in P2P lines
