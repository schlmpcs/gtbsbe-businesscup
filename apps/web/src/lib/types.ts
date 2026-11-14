// Engine wire types are generated from the Go implementation.
import type { components, operations } from "./generated-api";
type Schemas = components["schemas"];
export type Profile = Schemas["Profile"];
export type Forecast = Schemas["ForecastResult"];
export type Move = Schemas["Move"];
export type PublicCard = Schemas["PublicCard"];
export type ClueReveal = Schemas["ClueReveal"];
export type LoanInput = Schemas["LoanInput"];
export type LoanResult = Schemas["LoanResult"];
export type AffordResult = Schemas["AffordResult"];
export type MonthEnd = Schemas["MonthEndResult"];
export type CategoryTotals = Schemas["CategoryTotals"];
export type Purchase = Schemas["Purchase"];
export type GuessReveal = NonNullable<
  operations["api_daily_guess_post"]["responses"][200]["content"]["application/json"]
>;
export type CostCategory =
  | "rentUtilities"
  | "car"
  | "childcare"
  | "groceries"
  | "eatingOut"
  | "subscriptions"
  | "debtPayments"
  | "other";
export type StatementItem = {
  label: string;
  amount: number;
  month: string;
  day: number;
};
