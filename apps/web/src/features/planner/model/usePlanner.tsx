"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "../../../lib/api";
import { copy } from "@/copy";
import {
  categories,
  parseStatement,
  rowsOf,
  type CategorizedItem,
} from "../../../lib/csv";
import type {
  Profile,
  Forecast,
  Move,
  PublicCard,
  ClueReveal,
  GuessReveal,
  LoanInput,
  LoanResult,
  AffordResult,
  MonthEnd,
  CategoryTotals,
  Purchase,
} from "../../../lib/types";
import { PlannerView } from "../ui/PlannerView";
const emptyLoan: LoanInput = { amount: 28000, apr: 0.069, termMonths: 36 };
export function usePlanner() {
  const path = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null),
    [forecast, setForecast] = useState<Forecast | null>(null),
    [moves, setMoves] = useState<Move[]>([]),
    [cards, setCards] = useState<PublicCard[]>([]),
    [index, setIndex] = useState(0),
    [clues, setClues] = useState<ClueReveal[]>([]),
    [reveal, setReveal] = useState<GuessReveal | null>(null),
    [guess, setGuess] = useState(3500),
    [loans, setLoans] = useState<LoanInput[]>([
      emptyLoan,
      { ...emptyLoan, apr: 0.09, termMonths: 48 },
      { ...emptyLoan, apr: 0, termMonths: 36 },
    ]),
    [loanResults, setLoanResults] = useState<LoanResult[]>([]),
    [afford, setAfford] = useState<AffordResult | null>(null),
    [purchase, setPurchase] = useState<Purchase>({
      label: copy.planner.newLaptop,
      amount: 1200,
      recurring: false,
      payWith: "cash",
    }),
    [items, setItems] = useState<CategorizedItem[]>([]),
    [csv, setCsv] = useState(""),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState({ date: 0, label: 1, amount: 2 }),
    [reverse, setReverse] = useState(false),
    [history, setHistory] = useState<CategoryTotals[]>([]),
    [month, setMonth] = useState<MonthEnd | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [todaysDollars, setTodaysDollars] = useState(false),
    [ownGuess, setOwnGuess] = useState(3500),
    [leaderboard, setLeaderboard] = useState<unknown>(null),
    [wishlist, setWishlist] = useState<Purchase[]>([]),
    [forecastViewed, setForecastViewed] = useState(false),
    [assumptions, setAssumptions] = useState<Record<string, number | boolean>>(
      {},
    ),
    [calculating, setCalculating] = useState(false);
  const version = useRef(0),
    pending = useRef(0),
    tracked = useRef(new Set<string>());
  function track(name: string) {
    void fetch("/api/events", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      keepalive: true,
    }).catch(() => {});
  }
  useEffect(() => {
    if (!profile) return;
    const name =
      path === "/play"
        ? "play_started"
        : path === "/future" && forecast
          ? "forecast_viewed"
          : path === "/pro" && forecastViewed
            ? "paywall_viewed"
            : null;
    if (name && !tracked.current.has(name)) {
      tracked.current.add(name);
      track(name);
    }
  }, [path, profile, forecast, forecastViewed]);
  const latest = useRef({ loan: "", afford: "" });
  latest.current = {
    loan: JSON.stringify({ profile, loans }),
    afford: JSON.stringify({ profile, purchase }),
  };
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("lifeguessr-own-guess");
      if (stored !== null && Number.isFinite(Number(stored)))
        setOwnGuess(Number(stored));
      setForecastViewed(
        sessionStorage.getItem("lifeguessr-forecast-viewed") === "yes",
      );
    } catch {
      /* Storage may be disabled. */
    }
  }, []);
  useEffect(() => {
    if (path === "/future" && forecast) {
      setForecastViewed(true);
      try {
        sessionStorage.setItem("lifeguessr-forecast-viewed", "yes");
      } catch {
        /* Browsing still works without storage. */
      }
    }
  }, [path, forecast]);
  function changeOwnGuess(value: number) {
    setOwnGuess(value);
    try {
      sessionStorage.setItem("lifeguessr-own-guess", String(value));
    } catch {
      /* Keep the current input even without storage. */
    }
  }

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setError("");
    pending.current++;
    setBusy(true);
    try {
      return await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      pending.current--;
      setBusy(pending.current > 0);
    }
  }
  useEffect(() => {
    void run(async () => {
      const saved = await api<{
        profile?: Profile;
        history?: CategoryTotals[];
        wishlist?: Purchase[];
      }>("session");
      const [demo, daily, defaults] = await Promise.all([
        api<{ profile: Profile; loans: LoanInput[] }>("demo"),
        api<{
          cards: PublicCard[];
          progress: Record<string, { clues: string[]; reveal?: GuessReveal }>;
        }>("daily"),
        api<Record<string, number | boolean>>("assumptions"),
      ]);
      setAssumptions(defaults);
      const active = daily.cards.findIndex(
        (c) => !daily.progress[c.id]?.reveal,
      );
      setIndex(active < 0 ? daily.cards.length : active);
      if (active >= 0) {
        const ids = daily.progress[daily.cards[active].id]?.clues ?? [];
        setClues(
          await Promise.all(
            ids.map((clue) =>
              api<ClueReveal>("daily/clue", {
                cardId: daily.cards[active].id,
                clue,
              }),
            ),
          ),
        );
      }
      setWishlist(saved.wishlist ?? []);
      setProfile(saved.profile ?? demo.profile);
      if (demo.loans?.length) setLoans(demo.loans);
      setHistory(saved.history ?? []);
      setCards(daily.cards);
    });
  }, []);
  useEffect(() => {
    if (!profile) return;
    setError("");
    setCalculating(true);
    setForecast(null);
    setMoves([]);
    setMonth(null);
    const controller = new AbortController();
    const current = ++version.current;
    const timer = setTimeout(() => {
      void Promise.all([
        api<Forecast>(
          "calculate/forecast",
          { profile, todaysDollars },
          controller.signal,
        ),
        api<Move[]>("calculate/moves", { profile }, controller.signal),
        api<MonthEnd>(
          "calculate/month",
          { profile, history },
          controller.signal,
        ),
      ])
        .then(([f, m, mo]) => {
          if (current === version.current) {
            setForecast(f);
            setMoves(m);
            setMonth(mo);
          }
        })
        .catch((e) => {
          if (current === version.current && e.name !== "AbortError")
            setError(e.message);
        })
        .finally(() => {
          if (current === version.current) setCalculating(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [profile, todaysDollars, history]);
  const card = cards[index];
  useEffect(() => {
    setLoanResults([]);
    setAfford(null);
  }, [profile, loans, purchase]);
  function addDebt() {
    setProfile((p) =>
      p
        ? {
            ...p,
            debts: [
              ...p.debts,
              {
                id: crypto.randomUUID(),
                kind: "card",
                balance: 0,
                apr: 0.228,
                minPayment: { value: 25, isEstimate: true },
              },
            ],
          }
        : p,
    );
  }
  function updateDebt(
    id: string,
    field:
      "kind" | "balance" | "apr" | "minPayment" | "extraPayment" | "estimated",
    value: string | number | boolean,
  ) {
    setProfile((p) =>
      p
        ? {
            ...p,
            debts: p.debts.map((d) => {
              if (d.id !== id) return d;
              if (field === "kind")
                return { ...d, kind: String(value) as typeof d.kind };
              if (field === "minPayment")
                return {
                  ...d,
                  minPayment: { value: Number(value), isEstimate: false },
                };
              if (field === "estimated")
                return {
                  ...d,
                  minPayment: { ...d.minPayment, isEstimate: Boolean(value) },
                };
              return { ...d, [field]: Number(value) };
            }),
          }
        : p,
    );
  }
  function removeDebt(id: string) {
    setProfile((p) =>
      p ? { ...p, debts: p.debts.filter((d) => d.id !== id) } : p,
    );
  }
  async function addWishlist() {
    await run(async () => {
      if (wishlist.length >= 50)
        throw new Error(copy.planner.wishlistLimitError);
      const next = [...wishlist, structuredClone(purchase)];
      await api("session", { wishlist: next });
      setWishlist(next);
      setNotice(copy.planner.wishlistSavedNotice);
    });
  }
  async function removeWishlist(index: number) {
    await run(async () => {
      const next = wishlist.filter((_, i) => i !== index);
      await api("session", { wishlist: next });
      setWishlist(next);
    });
  }

  function update(
    field: "takeHomePay" | "cash" | "retirement" | "age" | "retirementShare",
    value: number,
  ) {
    setProfile((p) =>
      p ? { ...p, [field]: { value, isEstimate: false } } : p,
    );
  }
  function spending(category: string, value: number) {
    setProfile((p) =>
      p
        ? {
            ...p,
            spending: {
              ...p.spending,
              [category]: { value, isEstimate: false },
            },
          }
        : p,
    );
  }
  async function save() {
    if (profile)
      await run(async () => {
        await api("session", { profile, history });
        setNotice(copy.planner.profileSavedNotice);
        track("profile_completed");
      });
  }
  async function clue(id: string) {
    if (!card) return;
    await run(async () => {
      const c = await api<ClueReveal>("daily/clue", {
        cardId: card.id,
        clue: id,
      });
      setClues((cs) => (cs.some((x) => x.clue === c.clue) ? cs : [...cs, c]));
      track("clue_opened");
    });
  }
  async function submitGuess() {
    if (!card) return;
    await run(async () => {
      setReveal(
        await api<GuessReveal>("daily/guess", { cardId: card.id, guess }),
      );
      track("guess_submitted");
    });
  }
  function next() {
    setIndex((i) => i + 1);
    setClues([]);
    setReveal(null);
  }
  async function compare() {
    if (profile)
      await run(async () => {
        setLoanResults([]);
        const current = JSON.stringify({ profile, loans });
        const results = await api<LoanResult[]>("calculate/loans", {
          profile,
          loans,
        });
        if (current === latest.current.loan) {
          setLoanResults(results);
          track("loan_compared");
        }
      });
  }
  async function evaluate() {
    if (profile)
      await run(async () => {
        setAfford(null);
        const current = JSON.stringify({ profile, purchase });
        const result = await api<AffordResult>("calculate/afford", {
          profile,
          purchase,
        });
        if (current === latest.current.afford) setAfford(result);
      });
  }
  async function upload(file: File) {
    await run(async () => {
      if (file.size > 2_000_000) throw new Error(copy.planner.csvSizeError);
      const text = await file.text();
      setItems([]);
      setCsv(text);
      setHeaders(rowsOf(text.replace(/^\uFEFF/, ""))[0] ?? []);
      setItems(parseStatement(text, undefined, reverse));
      setNotice(copy.planner.csvParsedNotice);
    });
  }
  function remap() {
    try {
      setItems(parseStatement(csv, mapping, reverse));
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  async function saveItems() {
    if (!profile) return;
    await run(async () => {
      const totals = await api<CategoryTotals[]>("statement/categorize", {
        items,
      });
      const merged = [
        ...history.filter((h) => !totals.some((t) => t.month === h.month)),
        ...totals,
      ];
      const refined = await api<Profile>("calculate/refine", {
        profile,
        history: merged,
      });
      setHistory(merged);
      setProfile(refined);
      await api("session", { profile: refined, history: merged });
      setNotice(copy.planner.totalsSavedNotice);
      track("statement_uploaded");
      setCsv("");
      setItems([]);
      setHeaders([]);
    });
  }
  async function adopt() {
    if (!card) return;
    await run(async () => {
      const adopted = await api<Profile>("closest", { cardId: card.id });
      setProfile(adopted);
      await api("session", { profile: adopted, history });
      setNotice(copy.planner.closestLifeAppliedNotice);
    });
  }
  async function move(id: string) {
    if (!profile) return;
    await run(async () => {
      const next = await api<Profile>("calculate/apply-move", {
        profile,
        moveId: id,
      });
      setProfile(next);
      await api("session", { profile: next, history });
      setNotice(copy.planner.moveAppliedNotice);
    });
  }
  return {
    path,
    profile,
    forecast,
    moves,
    cards,
    card,
    index,
    clues,
    reveal,
    guess,
    setGuess,
    loans,
    setLoans,
    loanResults,
    afford,
    purchase,
    setPurchase,
    items,
    setItems,
    headers,
    mapping,
    setMapping,
    reverse,
    setReverse,
    history,
    month,
    error,
    notice,
    busy: busy || calculating,
    todaysDollars,
    setTodaysDollars,
    ownGuess,
    setOwnGuess: changeOwnGuess,
    leaderboard,
    wishlist,
    forecastViewed,
    assumptions,
    submitOwnGuess: () => track("own_guess"),
    addWishlist,
    removeWishlist,
    addDebt,
    updateDebt,
    removeDebt,
    update,
    spending,
    save,
    clue,
    submitGuess,
    next,
    compare,
    evaluate,
    upload,
    remap,
    saveItems,
    adopt,
    move,
    categories,
    refreshLeaderboard: () =>
      run(async () => setLeaderboard(await api("leaderboard"))),
  };
}
export function Planner() {
  return <PlannerView vm={usePlanner()} />;
}
