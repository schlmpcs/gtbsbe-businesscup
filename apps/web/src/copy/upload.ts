// Strings for statement upload and "What we keep" (S9). Owner: Aibek (T6/T7, JF7).
import type { Debt, PayCadence } from '@lifeguessr/types';

/** How a debt reads in the one-line summary: "Capital One card payments", "Toyota Financial". */
const debtNoun: Record<Debt['kind'], string> = {
  card: 'card payments',
  auto: 'car loan',
  student: 'student loan',
  personal: 'personal loan',
  bnpl: 'pay-later payments',
  mortgage: 'mortgage',
};

const cadence: Record<PayCadence, string> = {
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  semimonthly: 'twice a month',
  monthly: 'every month',
};

export const upload = {
  screens: {
    S9: 'Import your spending',
  },

  /** JF7: paychecks and debt payments found in the statement, to confirm or dismiss. */
  findings: {
    title: 'We found',
    sticker: 'Found in your statement',
    /** "We found: paycheck $5,200/mo, Capital One card payments, Toyota Financial." */
    summary: (parts: readonly string[]) => `We found: ${parts.join(', ')}.`,
    summaryPay: (amount: string) => `paycheck ${amount}/mo`,
    summaryDebt: (creditor: string | null, kind: Debt['kind']) =>
      creditor === null
        ? debtNoun[kind]
        : kind === 'card' || kind === 'bnpl'
          ? `${creditor} ${debtNoun[kind]}`
          : creditor,
    note: 'Read in your browser from the lines above. Nothing is added until you confirm it.',
    none: 'No regular paycheck or debt payments in this statement. You can type them on the balance sheet.',

    payTitle: 'Pay',
    payLabel: (payer: string | null, payroll: boolean) =>
      payroll ? (payer ? `Paycheck from ${payer}` : 'Paycheck') : payer ? `Regular deposit from ${payer}` : 'Regular deposit',
    payDetail: (deposits: number, perDeposit: string, every: PayCadence) =>
      `${deposits} deposits of about ${perDeposit}, ${cadence[every]}`,
    perMonth: (amount: string) => `${amount}/mo`,
    confirmPay: 'Use as my take-home pay',
    dismissPay: 'Not my pay',
    payConfirmed: 'Added to your take-home pay.',
    takeHomeSet: (amount: string) => `Take-home pay: ${amount}/mo, from your statement.`,

    debtsTitle: 'Debts',
    debtLabel: (creditor: string | null, kindLabel: string) => (creditor ? `${creditor} · ${kindLabel}` : kindLabel),
    debtDetail: (payments: number, amount: string) => `${payments} payments, ${amount}/mo on average`,
    aprLine: (rate: string) => `APR ${rate}`,
    aprSource: (name: string) => `Typical for this kind: ${name}`,
    balanceLabel: 'How much is left to pay?',
    balanceHint: 'The one number a statement can’t show. Your lender’s app has it.',
    confirmDebt: 'Add this debt',
    confirmDebtLabel: (what: string) => `Add ${what}`,
    dismissDebt: 'Not a debt',
    dismissDebtLabel: (what: string) => `${what} is not a debt`,
    dismissPayLabel: (what: string) => `${what} is not my pay`,
    debtConfirmed: 'Added to your debts. Edit it on the balance sheet.',
    dismissed: 'Left out.',
  },
} as const;
