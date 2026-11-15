# Micro-tools Implementation Plan

**Goal:** Three small tools inside the app: the subscription audit, the overpaying check, and a debt payoff planner inside Loan Lab. The first two work cold and are their own pages; the third upgrades Loan Lab's payoff card. Each runs on the shared profile and the tested engine.

**Architecture:** Each tool is a pure engine function plus a view-model hook. Shared plumbing (M2: local tool state, events, per-tool funnel report, e2e harness) sits under them, and one contracts PR (M1) comes first. No server state beyond what exists: tool state is browser-local, so the no-account design and privacy rule 6 hold. There is no tools hub page.

**Spec:** `docs/superpowers/specs/2026-11-14-micro-tools-design.md`. **Designer briefs:** `docs/design/08`, `11`, `12`. **Issues:** #77 to #82, #86 to #89 (prefix `M`).

## Scope change (2026-11-14)

The owner kept three of the six tools. Parked, nothing built: household, runway meter, yearly-bills smoother, the `/tools` hub page. Their issues #83, #84, #85, #90, #91 are to be closed as not planned (waiting for the owner's go). Debt payoff moved from its own page into Loan Lab and is the lowest priority.

## Issues and the 60/40 split

Split by issue count: **Amir 6 of 10 (60%), Aibek 4 of 10 (40%)**. M6 moved from Aibek to Amir in the cut: `apps/web/src/lib` is Amir's in the ownership table, and it restores 60/40. Count is not effort; rebalance by moving an issue if one looks lopsided. Aibek's open items at the time of writing: T13 (#69), T6 (#19), SB (#26).

| ID | Issue | Owner | Area | Depends on |
| --- | --- | --- | --- | --- |
| M1 | #77 Contracts, schemas, events, fixtures | Amir (Aibek reviews) | types | none; **blocks all** |
| M2 | #78 Tool plumbing: local tool state, events, per-tool funnel report, e2e harness | Aibek | api, infra | M1 |
| M3 | #79 `detectSubscriptions` engine | Amir | engine | M1 (fixtures first), M4 for real data |
| M4 | #80 Known-services catalogue + per-label classes from `/api/statement/categorize` | Aibek | data, api | M1 |
| M5 | #81 Subscription audit: view-model, flow, placeholder UI | Amir | ui, engine | M1, M2, M3, M4 |
| M6 | #82 `renewalsToIcs` + download | Amir | ui | M1 |
| M10 | #86 `overpayingCheck` engine + data lookups | Aibek | engine, data | M1 |
| M11 | #87 Overpaying check: view-model, placeholder UI | Amir | ui | M1, M2, M10 |
| M12 | #88 `payoffPlan`, `comparePayoff`, `extraToFinishBy` | Aibek | engine | M1 |
| M13 | #89 Debt payoff planner inside Loan Lab: view-model, placeholder UI (**last**) | Amir | ui | M1, M12 |

Ownership exceptions (new files only, no existing file edited beyond `index.ts` and `assumptions.ts`): Aibek adds `packages/engine/overpaying.ts` (M10). Amir's M13 edits the Loan Lab feature (`features/loan`) additively; its existing outputs and tests stay green.

## Parked issues (waiting for the owner's go to close as not planned)

| ID | Issue | Was |
| --- | --- | --- |
| M7 | #83 | Household merge engine (Amir) |
| M8 | #84 | Household server (Aibek) |
| M9 | #85 | Household view-model (Amir) |
| M14 | #90 | Runway meter (Amir) |
| M15 | #91 | Yearly-bills smoother (Amir) |

## Order and gates (no time estimates: scope, dependencies, blockers)

```
Gate 0      M1 merged                              (everything waits for it)
Parallel A  M3 + M4          subscription core (engine on fixtures, data + classes)
Parallel B  M10              overpaying engine + lookups
Parallel C  M12              payoff engine
Parallel D  M2               plumbing (state slice, events, funnel, harness)
Parallel E  M6               .ics (pure)

Then        M5  (M2, M3, M4)      subscription audit  → the demo-path candidate
            M11 (M2, M10)         overpaying check
Last        M13 (M12)             debt payoff planner in Loan Lab ("if time remains")
Then        skin pass when Kiko's frames land: rewrite each tool's `features/*/ui/*` per the Figma handoff procedure;
            one issue per tool is cut at that point from the frames.
```

**Calendar-bound items:** Kiko's frames (`docs/design/08`, `11`, `12`); the manual price check for the catalogue (M4); the anonymized real statement exports still open on T6 (#19).

## Decisions

| ID | Question | Proposal (what the issues assume) | Blocks |
| --- | --- | --- | --- |
| D2 | Free or Pro? | Running every tool is free; the renewals `.ics` is the one candidate Pro feature. Nothing is gated in code yet. | Any gating work |
| D3 | Do subscription findings leave the browser? | No, browser-local only. | Nothing (default) |
| D4 | Which tool is on the 2-minute demo path? | The subscription audit, extending the statement-upload step. | Demo script, deck |

(D1, the household sync, is parked with the household.)

## Global constraints

- One branch and PR per issue; commit messages start with the issue ID (`M3: …`). Never push to `main`.
- No AI attribution in commits, PRs or issue text. No effort estimates in any doc or issue.
- Contracts first: M1 adds every shape; later issues do not touch `packages/types` except to fix M1's shapes together with its author.
- `Money` is unrounded US dollars; rates are decimals per year. Every number has a `Source` or `isEstimate`.
- Code does the math. No LLM produces a number in these tools; the only LLM use is the existing statement categorizer (labels).
- Privacy rule 6: no names, account numbers or raw statements. Subscription findings, tick choices and overpaying inputs stay in the browser. Events carry enums and counts, never amounts.
- Wording: "educational simulation, not financial advice"; no lender, insurer, landlord, investment or security recommendations; never shame.
- `features/*/ui/` imports only `@/ui-kit/**`, `@/copy` and `../model/types` (lint-enforced). Copy in `src/copy/*`.
- Tests never call a live model. Heavy checks (e2e, full builds) run in CI or on the team server; unit tests run locally.
- The existing forecast, `rankMoves`, `canAfford`, the AI forecast (Y15 to Y20), the goal (T13), Loan Lab (S12) and the statement pipeline (T6, T7) keep their behavior. The only changes to existing code are additive: events, the `classes` field on the categorize response, the store slice, and the payoff section in Loan Lab.

## Dependencies on work in flight

- **T6 (#19)** masking improvements: the audit works on today's masking; findings never leave the browser, so the open masking items do not block it.
- The local working copy used for this plan was 35 commits behind `origin/main`; every code reference was checked on `origin/main`.

## Review focus

1. **False positives in the detector** (rent, loans, insurance shown as subscriptions): M3's negative tests and the class filter from M4.
2. **"Like with like" in the subscription reveal:** M5 labels ticks as catalogue estimates and the C+R figure as a survey.
3. **Loan Lab not broken:** M13 keeps `useLoanLab`'s outputs and the existing Loan Lab tests untouched and green.
4. **No hidden advice:** copy in M5, M11, M13 goes through the wording guardrails.
