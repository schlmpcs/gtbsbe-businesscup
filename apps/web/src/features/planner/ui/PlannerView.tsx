import type { PlannerModel } from "../model/types";
import { Panel, Money, Field, ForecastChart, HouseScene } from "@/ui-kit";
import { copy } from "@/copy";
export function PlannerView({ vm: v }: { vm: PlannerModel }) {
  const p = v.profile,
    path = v.path;
  return (
    <>
      <header>
        <a className="brand" href="/">
          {copy.planner.brandMark}
          <span>{copy.planner.brandName}</span>
        </a>
        <nav>
          <a href="/play">{copy.planner.navGame}</a>
          <a href="/future">{copy.planner.navFuture}</a>
          <a href="/afford">{copy.planner.navAfford}</a>
          <a href="/loan">{copy.planner.navLoan}</a>
        </nav>
      </header>
      <main>
        <div className="eyebrow">{copy.planner.eyebrow}</div>
        <h1>
          {path === "/play"
            ? copy.planner.gameHeading
            : path === "/loan"
              ? copy.planner.loanHeading
              : path === "/afford"
                ? copy.planner.affordHeading
                : path.startsWith("/me")
                  ? copy.planner.profileHeading
                  : path === "/future"
                    ? copy.planner.forecastHeading
                    : copy.tagline}
        </h1>
        <p className="intro">{copy.planner.intro}</p>
        {v.error && (
          <div role="alert" className="error">
            {v.error}
          </div>
        )}
        {v.notice && (
          <div role="status" className="notice">
            {v.notice}
          </div>
        )}
        {v.busy && <p role="status">{copy.planner.working}</p>}
        {!p && (
          <Panel title={copy.planner.loadingTitle}>
            <p>{copy.planner.connectionHelp}</p>
            <button onClick={() => location.reload()}>
              {copy.planner.retryConnection}
            </button>
          </Panel>
        )}
        {path === "/play" && (
          <Panel
            title={
              v.card
                ? copy.planner.homeProgress(
                    v.card.metro,
                    v.index + 1,
                    v.cards.length,
                  )
                : copy.planner.dailyChallengeComplete
            }
          >
            {v.card ? (
              <>
                <p>{v.card.caption}</p>
                <HouseScene
                  key={v.card.id}
                  layout={v.card.layout}
                  reveals={v.clues}
                  clues={v.clues.map((c) => c.clue)}
                  disabled={v.busy || !!v.reveal}
                  onClue={v.clue}
                />
                <p className="muted">{copy.planner.clueScoringHelp}</p>
                <div className="clues">
                  {v.clues.map((c) => (
                    <div key={c.clue}>
                      <strong>{c.clue}</strong>
                      <pre>{JSON.stringify(c.facts, null, 2)}</pre>
                    </div>
                  ))}
                </div>
                <Field
                  label={copy.planner.yourGuessDollarsPerMonth}
                  value={v.guess}
                  onChange={v.setGuess}
                />
                <button disabled={v.busy || !!v.reveal} onClick={v.submitGuess}>
                  {copy.planner.lockInGuess}
                </button>
                {v.reveal && (
                  <div className="reveal">
                    <h2>
                      <Money value={v.reveal.cost.total.mid} />{" "}
                      {copy.planner.month}
                    </h2>
                    <p>
                      {v.reveal.result.points} {copy.planner.pointsTypicalRange}{" "}
                      <Money value={v.reveal.cost.total.low} />–
                      <Money value={v.reveal.cost.total.high} />
                    </p>
                    {v.reveal.cost.items.map((i) => (
                      <p key={i.category}>
                        {copy.categories[i.category] ?? i.category}:{" "}
                        <Money value={i.amount} />{" "}
                        <small>
                          {i.isEstimate ? copy.planner.estimate : ""}
                          {i.source.name} {i.source.year}
                        </small>
                      </p>
                    ))}
                    <div className="actions">
                      <button onClick={v.next}>{copy.planner.nextHome}</button>
                      <button className="secondary" onClick={v.adopt}>
                        {copy.planner.useAsMyClosestLife}
                      </button>
                      <a
                        href={`/api/share?resultId=${v.reveal.resultId}&format=square`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.planner.shareSquare}
                      </a>
                      <a
                        href={`/api/share?resultId=${v.reveal.resultId}&format=story`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.planner.shareStory}
                      </a>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <a className="button" href="/me/guess">
                {copy.planner.nowGuessYourOwnLife}
              </a>
            )}
            <button className="secondary" onClick={v.refreshLeaderboard}>
              {copy.planner.todaysLeaderboard}
            </button>
            {v.leaderboard != null && (
              <pre>{JSON.stringify(v.leaderboard, null, 2)}</pre>
            )}
          </Panel>
        )}
        {p && (path === "/" || path === "/future") && (
          <>
            <div className="grid">
              <Panel title={copy.planner.youIn10Years}>
                <div className="big-number">
                  <Money value={v.forecast?.in10y.mid} />
                </div>
                <p>{copy.planner.projectedNetWorth}</p>
                {v.forecast && (
                  <>
                    <ForecastChart points={v.forecast.points} />
                    <p>
                      <Money value={v.forecast.in10y.low} />–
                      <Money value={v.forecast.in10y.high} />
                    </p>
                  </>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={v.todaysDollars}
                    onChange={(e) => v.setTodaysDollars(e.target.checked)}
                  />{" "}
                  {copy.planner.showTodaysDollars}
                </label>
                <p className="muted">{copy.estimate}</p>
              </Panel>
              <Panel title={copy.planner.thisMonth}>
                <div className="big-number">
                  <Money value={v.month?.projectedSpend} />
                </div>
                <p>{copy.planner.projectedSpending}</p>
                {v.month?.vsAverage == null ? (
                  <p className="muted">
                    {copy.planner.uploadThreeCompleteMonthsToSeeDrift}
                  </p>
                ) : (
                  <p>
                    {copy.planner.changeVsAverage}{" "}
                    <Money value={v.month.vsAverage} />
                  </p>
                )}
                <a href="/me/upload">{copy.planner.refineWithAStatement}</a>
                <hr />
                <a className="button" href="/play">
                  {copy.planner.playTodaysHomes}
                </a>
              </Panel>
            </div>
            <Panel title={copy.planner.yourNextMoves}>
              <div className="grid">
                {v.moves.map((m) => (
                  <article className="move" key={m.id}>
                    <h3>{copy.moveKinds[m.kind] ?? m.kind}</h3>
                    <strong>
                      <Money value={m.effect10y} />
                    </strong>
                    <p>{copy.planner.potentialDifferenceIn10Years}</p>
                    <button onClick={() => v.move(m.id)}>
                      {copy.planner.tryThisMove}
                    </button>
                  </article>
                ))}
              </div>
            </Panel>
            <details>
              <summary>{copy.planner.howWeCalculate}</summary>
              <p>{copy.planner.calculationExplanation}</p>
              <dl>
                {Object.entries(v.assumptions)
                  .filter(([, value]) => typeof value === "number")
                  .map(([name, value]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          </>
        )}
        {p && path.startsWith("/me") && (
          <>
            <div className="steps">
              <a href="/me/guess">{copy.planner.stepGuess}</a>
              <a href="/me/closest">{copy.planner.stepClosestLife}</a>
              <a href="/me/sliders">{copy.planner.stepSpending}</a>
              <a href="/me/balance">{copy.planner.stepBalances}</a>
              <a href="/me/upload">{copy.planner.stepUpload}</a>
            </div>
            {path === "/me/guess" && (
              <Panel title={copy.planner.ownGuessHeading}>
                <Field
                  label={copy.planner.myMonthlyGuess}
                  value={v.ownGuess}
                  onChange={v.setOwnGuess}
                />
                <p>{copy.planner.ownGuessPersistenceHelp}</p>
                {v.month && (
                  <p>
                    {copy.planner.yourGuess} <Money value={v.ownGuess} />{" "}
                    {copy.planner.modeledMonthlySpending}{" "}
                    <Money value={v.month.projectedSpend} />
                  </p>
                )}
                <p className="muted">{copy.planner.modeledSpendingHelp}</p>
                <a
                  className="button"
                  href="/me/closest"
                  onClick={v.submitOwnGuess}
                >
                  {copy.planner.findMyClosestLife}
                </a>
              </Panel>
            )}
            {path === "/me/closest" && (
              <Panel title={copy.planner.startWithALifeThenMakeItYours}>
                <p>
                  {copy.planner.yourMonthlyGuess} <Money value={v.ownGuess} />
                  {v.month && (
                    <>
                      {" "}
                      {copy.planner.currentModeledSpending}{" "}
                      <Money value={v.month.projectedSpend} />{" "}
                      {copy.planner.excludingDebtPayments}
                    </>
                  )}
                </p>
                <p>{copy.planner.starterExplanation}</p>
                <a className="button" href="/play">
                  {copy.planner.exploreAHome}
                </a>{" "}
                <a href="/me/sliders">{copy.planner.customizeStarterProfile}</a>
              </Panel>
            )}
            {path === "/me/sliders" && (
              <Panel title={copy.planner.spendingHeading}>
                <Field
                  label={copy.planner.monthlyTakeHomePay}
                  value={p.takeHomePay.value}
                  onChange={(n) => v.update("takeHomePay", n)}
                />
                {v.categories
                  .filter((c) => c !== "debtPayments")
                  .map((c) => (
                    <Field
                      key={c}
                      label={`${copy.categories[c]}${p.spending[c]?.isEstimate ? copy.planner.estimated : ""}`}
                      value={p.spending[c]?.value ?? 0}
                      onChange={(n) => v.spending(c, n)}
                    />
                  ))}
                <button onClick={v.save}>{copy.planner.saveSpending}</button>{" "}
                <a href="/me/balance">{copy.planner.nextBalances}</a>
              </Panel>
            )}
            {path === "/me/balance" && (
              <Panel title={copy.planner.yourStartingPoint}>
                <Field
                  label={copy.planner.age}
                  value={p.age.value}
                  max={100}
                  onChange={(n) => v.update("age", n)}
                />
                <Field
                  label={copy.planner.cashBalance}
                  value={p.cash.value}
                  onChange={(n) => v.update("cash", n)}
                />
                <Field
                  label={copy.planner.retirementBalance}
                  value={p.retirement.value}
                  onChange={(n) => v.update("retirement", n)}
                />
                <Field
                  label={copy.planner.shareOfSurplusInvested01}
                  step={0.01}
                  max={1}
                  value={p.retirementShare.value}
                  onChange={(n) => v.update("retirementShare", n)}
                />
                <h3>{copy.planner.yourDebts}</h3>
                <p className="muted">{copy.planner.debtHelp}</p>
                {p.debts.map((d, i) => (
                  <article key={d.id} className="move">
                    <h3>
                      {copy.planner.debt} {i + 1}
                    </h3>
                    <label className="field">
                      {copy.planner.debtType}
                      <select
                        aria-label={copy.planner.debtLabel(i + 1, "type")}
                        value={d.kind}
                        onChange={(e) =>
                          v.updateDebt(d.id, "kind", e.target.value)
                        }
                      >
                        {[
                          "card",
                          "auto",
                          "student",
                          "personal",
                          "bnpl",
                          "mortgage",
                        ].map((kind) => (
                          <option key={kind} value={kind}>
                            {copy.debtKinds[kind]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label={copy.planner.debtLabel(i + 1, "balance")}
                      value={d.balance}
                      onChange={(n) => v.updateDebt(d.id, "balance", n)}
                    />
                    <Field
                      label={copy.planner.debtLabel(i + 1, "apr")}
                      value={d.apr}
                      step={0.001}
                      max={5}
                      onChange={(n) => v.updateDebt(d.id, "apr", n)}
                    />
                    <Field
                      label={copy.planner.debtLabel(i + 1, "minPayment")}
                      value={d.minPayment.value}
                      onChange={(n) => v.updateDebt(d.id, "minPayment", n)}
                    />
                    {d.kind === "card" && (
                      <label>
                        <input
                          type="checkbox"
                          checked={d.minPayment.isEstimate}
                          onChange={(e) =>
                            v.updateDebt(d.id, "estimated", e.target.checked)
                          }
                        />{" "}
                        {
                          copy.planner
                            .useTheCalculationServiceSEstimatedCardMinimum
                        }
                      </label>
                    )}
                    <Field
                      label={copy.planner.debtLabel(i + 1, "extraPayment")}
                      value={d.extraPayment ?? 0}
                      onChange={(n) => v.updateDebt(d.id, "extraPayment", n)}
                    />
                    <button
                      className="secondary"
                      onClick={() => v.removeDebt(d.id)}
                    >
                      {copy.planner.removeDebt} {i + 1}
                    </button>
                  </article>
                ))}
                <button className="secondary" onClick={v.addDebt}>
                  {copy.planner.addDebt}
                </button>
                <p className="muted">
                  {copy.planner.saveYourChangesBeforeOpeningAnotherPage}
                </p>
                <button onClick={v.save}>{copy.planner.saveBalances}</button>{" "}
                <a href="/future">{copy.planner.seeMyForecast}</a>
              </Panel>
            )}
            {path === "/me/upload" && (
              <Panel title={copy.planner.refineYourPlanKeepYourPrivacy}>
                <p>{copy.planner.uploadPrivacy}</p>
                <label className="field">
                  {copy.planner.statementCsv}
                  <input
                    aria-label={copy.planner.statementCsv}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void v.upload(e.target.files[0]);
                    }}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={v.reverse}
                    onChange={(e) => v.setReverse(e.target.checked)}
                  />{" "}
                  {copy.planner.myExportUsesNegativeAmountsForPurchases}
                </label>
                {v.headers.length > 0 && (
                  <details>
                    <summary>{copy.planner.adjustColumnMapping}</summary>
                    {(["date", "label", "amount"] as const).map((key) => (
                      <label className="field" key={key}>
                        {copy.mappingColumns[key]}
                        <select
                          value={v.mapping[key]}
                          onChange={(e) =>
                            v.setMapping({
                              ...v.mapping,
                              [key]: Number(e.target.value),
                            })
                          }
                        >
                          {v.headers.map((h, i) => (
                            <option value={i} key={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <button onClick={v.remap}>
                      {copy.planner.reparseLocally}
                    </button>
                  </details>
                )}
                {v.items.length > 0 && (
                  <>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{copy.planner.maskedMerchant}</th>
                            <th>{copy.planner.amount}</th>
                            <th>{copy.planner.category}</th>
                            <th>{copy.planner.oneOff}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {v.items.map((item, i) => (
                            <tr key={i}>
                              <td>{item.label}</td>
                              <td>
                                <Money value={item.amount} />
                              </td>
                              <td>
                                <select
                                  aria-label={copy.planner.categoryLabel(i + 1)}
                                  value={item.category}
                                  onChange={(e) =>
                                    v.setItems(
                                      v.items.map((x, j) =>
                                        i === j
                                          ? {
                                              ...x,
                                              category: e.target
                                                .value as typeof item.category,
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                >
                                  {v.categories.map((c) => (
                                    <option key={c} value={c}>
                                      {copy.categories[c]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  aria-label={copy.planner.oneOffLabel(i + 1)}
                                  type="checkbox"
                                  checked={item.oneOff}
                                  onChange={(e) =>
                                    v.setItems(
                                      v.items.map((x, j) =>
                                        i === j
                                          ? { ...x, oneOff: e.target.checked }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={v.saveItems}>
                      {copy.planner.saveCategoryTotals}
                    </button>{" "}
                    <a href="/future">{copy.planner.viewRefinedForecast}</a>
                  </>
                )}
              </Panel>
            )}
          </>
        )}
        {p && path === "/loan" && (
          <Panel title={copy.planner.compareThreeOffers}>
            <p>{copy.planner.aprIsADecimal0069Means6}</p>
            <div className="grid">
              {v.loans.map((loan, i) => (
                <article key={i}>
                  <h3>
                    {copy.planner.offer} {i + 1}
                  </h3>
                  {(
                    [
                      "amount",
                      "apr",
                      "termMonths",
                      "fees",
                      "downPayment",
                      "extraPayment",
                    ] as const
                  ).map((key) => (
                    <Field
                      key={key}
                      label={copy.loanFields[key]}
                      value={loan[key] ?? 0}
                      step={key === "apr" ? 0.001 : 1}
                      onChange={(n) =>
                        v.setLoans(
                          v.loans.map((x, j) =>
                            j === i ? { ...x, [key]: n } : x,
                          ),
                        )
                      }
                    />
                  ))}
                  {v.loanResults[i] && (
                    <div className="result">
                      <h3>
                        <Money value={v.loanResults[i].monthly} />{" "}
                        {copy.planner.month}
                      </h3>
                      <p>
                        {copy.planner.interest}{" "}
                        <Money value={v.loanResults[i].totalInterest} />
                      </p>
                      <p>
                        {copy.planner.total}{" "}
                        <Money value={v.loanResults[i].totalCost} />
                      </p>
                      <p>
                        {copy.planner.payoff}{" "}
                        {v.loanResults[i].payoffMonth ??
                          copy.planner.neverPaysOff}{" "}
                        {copy.planner.months}
                      </p>
                      <p>
                        {copy.planner.tenYearEffect}{" "}
                        <Money value={v.loanResults[i].effect10y} />
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <button onClick={v.compare} disabled={v.busy}>
              {copy.planner.compareLoans}
            </button>
          </Panel>
        )}
        {p && path === "/afford" && (
          <Panel title={copy.planner.canYourPlanSupportIt}>
            <label className="field">
              {copy.planner.purchase}
              <input
                value={v.purchase.label}
                onChange={(e) =>
                  v.setPurchase({ ...v.purchase, label: e.target.value })
                }
              />
            </label>
            <Field
              label={copy.planner.amount}
              value={v.purchase.amount}
              onChange={(n) => v.setPurchase({ ...v.purchase, amount: n })}
            />
            <label className="field">
              {copy.planner.howOften}
              <select
                value={v.purchase.recurring || "once"}
                onChange={(e) =>
                  v.setPurchase({
                    ...v.purchase,
                    recurring:
                      e.target.value === "once"
                        ? false
                        : (e.target.value as "monthly" | "yearly"),
                  })
                }
              >
                <option value="once">{copy.planner.oneTime}</option>
                <option value="monthly">{copy.planner.monthly}</option>
                <option value="yearly">{copy.planner.yearly}</option>
              </select>
            </label>
            <label className="field">
              {copy.planner.payWith}
              <select
                value={
                  typeof v.purchase.payWith === "string"
                    ? v.purchase.payWith
                    : "loan"
                }
                onChange={(e) =>
                  v.setPurchase({
                    ...v.purchase,
                    payWith:
                      e.target.value === "loan"
                        ? { loan: v.loans[0] }
                        : (e.target.value as "cash" | "card"),
                  })
                }
              >
                <option value="cash">{copy.planner.cash}</option>
                <option value="card">{copy.planner.creditCard}</option>
                <option value="loan">
                  {copy.planner.loanOffer1FromLoanLab}
                </option>
              </select>
            </label>
            <div className="actions">
              <button onClick={v.evaluate} disabled={v.busy}>
                {copy.planner.checkAffordability}
              </button>
              <button
                className="secondary"
                onClick={v.addWishlist}
                disabled={v.busy}
              >
                {copy.planner.saveToWishlist}
              </button>
            </div>
            {v.afford && (
              <div className="result">
                <h2>{v.afford.verdict}</h2>
                {v.afford.waitMonths && (
                  <p>
                    {copy.planner.wait} {v.afford.waitMonths}{" "}
                    {copy.planner.months}
                  </p>
                )}
                <p>
                  {v.afford.baselineFails
                    ? copy.planner.yourExistingPlanAlreadyBreaksASafetyRule
                    : v.afford.failsOn
                      ? copy.planner.constraint(v.afford.failsOn)
                      : copy.planner.yourPlanPassesTheSafetyRules}
                </p>
                <p>
                  {copy.planner.cheapestModeledPayment} {v.afford.cheapestWay}
                </p>
              </div>
            )}
            <h3>{copy.planner.yourWishlist}</h3>
            {v.wishlist.length === 0 ? (
              <p className="muted">{copy.planner.wishlistEmptyHelp}</p>
            ) : (
              v.wishlist.map((item, i) => (
                <article className="move" key={i}>
                  <h3>{item.label}</h3>
                  <Money value={item.amount} />
                  <p>{item.recurring || copy.planner.oneTime}</p>
                  <div className="actions">
                    <button
                      className="secondary"
                      onClick={() => v.setPurchase(item)}
                    >
                      {copy.planner.reviewPurchase} {i + 1}
                    </button>
                    <button
                      className="secondary"
                      disabled={v.busy}
                      onClick={() => v.removeWishlist(i)}
                    >
                      {copy.planner.removePurchase} {i + 1}
                    </button>
                  </div>
                </article>
              ))
            )}
          </Panel>
        )}
        {path === "/pro" && !v.forecastViewed && (
          <Panel title={copy.planner.seeYourForecastFirst}>
            <p>{copy.planner.paywallGateHelp}</p>
            <a className="button" href="/future">
              {copy.planner.viewMyForecast}
            </a>
          </Panel>
        )}
        {["/decide", "/checkin", "/pro"].includes(path) &&
          (path !== "/pro" || v.forecastViewed) && (
            <Panel
              title={
                path === "/pro"
                  ? copy.planner.keepBuildingYourFuture
                  : path === "/checkin"
                    ? copy.planner.yourMonthlyCheckIn
                    : copy.planner.yourNextCarDecision
              }
            >
              <span className="badge">
                {copy.planner.interactiveConceptNotALiveService}
              </span>
              <p>
                {path === "/pro"
                  ? copy.planner.paywallConceptHelp
                  : path === "/checkin"
                    ? copy.planner.checkinConceptHelp
                    : copy.planner.decisionConceptHelp}
              </p>
              {path === "/checkin" && (
                <a href="/me/balance">
                  {copy.planner.updateBalancesBeforeCheckingIn}
                </a>
              )}
              <a
                className="button"
                href={path === "/decide" ? "/loan" : "/future"}
              >
                {path === "/decide"
                  ? copy.planner.compareCarLoans
                  : copy.planner.reviewMyForecast}
              </a>
            </Panel>
          )}
      </main>
      <footer>
        <p>{copy.disclaimer}</p>
        <a href="/me/sliders">{copy.planner.editProfile}</a> ·{" "}
        <a href="/me/upload">{copy.planner.whatWeKeep}</a> ·{" "}
        <a href="/checkin">{copy.planner.checkInConcept}</a> ·{" "}
        <a href="/pro">{copy.planner.proConcept}</a>
      </footer>
    </>
  );
}
