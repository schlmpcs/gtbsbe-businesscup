// View-model types for /start (onboarding without typing). The UI (../ui) imports only these.
import type { CostCategory, Money } from '@lifeguessr/types';
import type { StatementQuestionVM } from '@/features/ladder/model/types';

export type { CostCategory, Money, StatementQuestionVM };

export type StartStep = 'choose' | 'connect' | 'generate' | 'reading' | 'review';
export type StartSource = 'bank' | 'generated' | 'upload';

export type GenTierVM = 'cheap' | 'mid' | 'expensive' | 'suburb';
export type GenHouseholdVM = 'solo' | 'couple' | 'family' | 'singleParent';
export type GenPayVM = 'lean' | 'steady' | 'comfortable';
export type GenStyleVM = 'saver' | 'typical' | 'spender';

export type GeneratePreviewVM = {
  zip: string;
  bedrooms: number;
  /** Monthly gross rent (rent + utilities) for the ZIP and bedrooms, plus phone lines. */
  rentUtilities: Money;
  childcare: Money | null;
  groceries: Money;
  /** Car insurance + gas a month; null when the household gets around by transit. */
  car: Money | null;
  transit: Money | null;
  takeHome: Money;
  /** Source names of the public figures above. */
  sources: { rent: string; childcare: string | null; groceries: string; car: string | null };
};

export type GenerateVM = {
  metros: string[];
  metro: string;
  setMetro: (metro: string) => void;
  tiers: GenTierVM[];
  tier: GenTierVM;
  setTier: (tier: GenTierVM) => void;
  households: GenHouseholdVM[];
  household: GenHouseholdVM;
  setHousehold: (h: GenHouseholdVM) => void;
  pays: GenPayVM[];
  pay: GenPayVM;
  setPay: (p: GenPayVM) => void;
  /** Household take-home a month for each band (two earners count both). */
  payAmounts: Record<GenPayVM, Money>;
  styles: GenStyleVM[];
  style: GenStyleVM;
  setStyle: (s: GenStyleVM) => void;
  preview: GeneratePreviewVM;
  generate: () => void;
};

export type BankVM = { id: string; name: string; logo: string };

/** Simulated bank connection: pick a demo bank → share its checking account → linking. */
export type ConnectVM = {
  stage: 'pick' | 'accounts' | 'linking';
  banks: BankVM[];
  bank: BankVM | null;
  account: { label: string; last4: string; metro: string } | null;
  pick: (id: string) => void;
  confirm: () => void;
  back: () => void;
};

/** One line exactly as it is sent to the server: masked label, amount (+ = money out), month, day. */
export type MaskedLineVM = { label: string; amount: Money; month: string; day: number };

export type ReadingVM = {
  source: StartSource;
  /** The demo bank's name when the statement came through the simulated connection. */
  bankName: string | null;
  /** Lines read in the browser; null until the file is in. */
  lineCount: number | null;
  /** The first lines as sent (newest first). */
  masked: MaskedLineVM[];
  /** 0 fetch · 1 parse · 2 mask · 3 sort · 4 find; `done` once the review is ready. */
  phase: 0 | 1 | 2 | 3 | 4;
  done: boolean;
};

export type GuessVM = {
  value: Money;
  set: (v: Money) => void;
  locked: boolean;
  lock: () => void;
  min: Money;
  max: Money;
  /** Upload: the user's own month; otherwise someone else's. */
  own: boolean;
};

export type RevealVM = {
  guess: Money | null;
  monthlySpend: Money;
  /** monthlySpend − guess (null without a guess). */
  diff: Money | null;
  payIn: Money | null;
  /** payIn − monthlySpend (null without pay). */
  leftOver: Money | null;
  breakdown: { category: CostCategory; amount: Money }[];
  biggest: { category: CostCategory; share: number } | null;
  oneOffs: { label: string; amount: Money }[];
  months: number;
  categorizedBy: 'ai' | 'rules' | 'mixed' | null;
};

export type StartError = { kind: 'generate' | 'unreadable' | 'network' };

export type StartVM = {
  ready: boolean;
  step: StartStep;
  source: StartSource | null;
  chooseConnect: () => void;
  chooseGenerate: () => void;
  uploadFile: (file: File) => void;
  back: () => void;
  connect: ConnectVM;
  generator: GenerateVM;
  reading: ReadingVM | null;
  guess: GuessVM;
  /** Shown once the statement is read and the guess is locked (or skipped). */
  reveal: RevealVM | null;
  skipGuess: () => void;
  questions: StatementQuestionVM[];
  answerCategory: (id: string, category: CostCategory) => void;
  /** A missing category: "No, none" (0 a month). */
  answerNone: (id: string) => void;
  skipQuestion: (id: string) => void;
  error: StartError | null;
  retry: () => void;
  finish: () => void;
  restart: () => void;
};
