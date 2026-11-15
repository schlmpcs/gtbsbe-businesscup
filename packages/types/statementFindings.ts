// JF7: what the statement says about income and debts, for the person to confirm (S9 "We found").
// The engine (`findIncomeAndDebts`) builds this in the browser from the statement it just read.
// It is never sent to the server and never stored: only what the person confirms enters the
// profile, and then only as numbers and kinds (take-home pay; a debt's kind, payment, APR and the
// balance they type). The names in it are either a lender name from the engine's own list or text
// from the masked label, never raw statement text (CLAUDE.md rule 6).
import { z } from 'zod';
import { DEBT_KINDS } from './constants';
import { AprSchema, NonNegativeMoneySchema, SourceSchema } from './schemas';

/** How often a paycheck comes in. Semimonthly = twice a month on fixed days (the 15th and the last day). */
export const PAY_CADENCES = ['weekly', 'biweekly', 'semimonthly', 'monthly'] as const;
export const PayCadenceSchema = z.enum(PAY_CADENCES);
export type PayCadence = z.infer<typeof PayCadenceSchema>;

/** One stream of regular deposits from the same payer. */
export const IncomeFindingSchema = z.strictObject({
  /** Stable for the same statement ('income-1', 'income-2', …, largest first). */
  id: z.string().min(1).max(100),
  /** The payer as the masked label shows it ("Acme Logistics Inc"); null when the mask left nothing. */
  payer: z.string().min(1).max(200).nullable(),
  /** The label says payroll or direct deposit. A regular deposit without it is still offered. */
  payroll: z.boolean(),
  cadence: PayCadenceSchema,
  /** Deposits seen in the statement. */
  deposits: z.number().int().positive(),
  /** The average deposit. */
  perDeposit: NonNegativeMoneySchema,
  /** perDeposit × deposits a year ÷ 12: what this stream adds to take-home pay per month. */
  monthly: NonNegativeMoneySchema,
});
export type IncomeFinding = z.infer<typeof IncomeFindingSchema>;

/** Regular payments to one lender (one loan, or one card or BNPL account). */
export const DebtFindingSchema = z.strictObject({
  /** Stable for the same statement ('debt-1', …, largest payment first). */
  id: z.string().min(1).max(100),
  kind: z.enum(DEBT_KINDS),
  /** The lender: a name from the engine's lender list, or the masked label's; null when unknown. */
  creditor: z.string().min(1).max(200).nullable(),
  /** Payments seen in the statement. */
  payments: z.number().int().positive(),
  /** Measured: the average paid per month over the full months the payments span. */
  monthlyPayment: NonNegativeMoneySchema,
  /** A typical APR for the kind (engine `debtAprByKind`). Always an estimate: the statement has no rate. */
  apr: AprSchema,
  aprSource: SourceSchema,
});
export type DebtFinding = z.infer<typeof DebtFindingSchema>;

export const StatementFindingsSchema = z.strictObject({
  income: z.array(IncomeFindingSchema),
  debts: z.array(DebtFindingSchema),
});
export type StatementFindings = z.infer<typeof StatementFindingsSchema>;
