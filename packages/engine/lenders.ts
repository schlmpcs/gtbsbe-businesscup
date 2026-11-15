// Who a statement line pays, when it pays down a debt (JF7). A fixed list of US card issuers, car
// lenders, student-loan servicers, mortgage servicers, personal lenders and buy-now-pay-later
// companies, each with the kind of debt it holds and the name we show. Then, for lenders not on the
// list, a few words that only appear on debt payments ("MORTGAGE", "STUDENT LN", "CREDIT CARD").
//
// The patterns run on the raw description in the browser. That is on purpose: a credit union prints
// a loan payment as "ACH DEBIT FORD CREDIT AUTOPAY", and the mask (lib/statement/mask.ts) turns
// every bare ACH debit into "ACH debit [name]" because the other side could be a person. Matching
// the raw text here finds the lender without un-masking anything: what a finding shows is the name
// from this list, never the text it matched.
//
// Order matters: the first entry that matches wins. Specific lenders come before the generic words,
// a bank's car-loan arm before its card ("CAPITAL ONE AUTO CARPAY" is a car loan, "CAPITAL ONE
// MOBILE PMT" a card), and a bank name alone never counts: it needs a card or payment word next to
// it, so a transfer to a Chase savings account or a purchase at a Toyota dealer is not a debt.
import type { Debt } from '@lifeguessr/types';

export type DebtKind = Debt['kind'];

export type Lender = {
  /** Groups payments: two lines with the same id pay the same lender. */
  id: string;
  /** Shown in the review ("Toyota Financial"). Null for the generic words: the label is used instead. */
  name: string | null;
  kind: DebtKind;
  /** Tested against the upper-cased raw description. */
  re: RegExp;
};

const PAY = String.raw`(?:PMT|PYMT|PAYMT|PAYMENT|PAYMENTS|AUTOPAY|AUTO PAY|E-?PAYMENT|EPAY|ONLINE|MOBILE|ACH)`;
const CARD = String.raw`(?:CREDIT ?CA?RD|CRD|CARD|CARDS|CRCARDPMT)`;

const lender = (id: string, name: string | null, kind: DebtKind, re: RegExp): Lender => ({ id, name, kind, re });

export const LENDERS: readonly Lender[] = [
  // Mortgage servicers
  lender('rocket-mortgage', 'Rocket Mortgage', 'mortgage', /\bROCKET MORTGAGE\b|\bQUICKEN LOANS\b/),
  lender('mr-cooper', 'Mr. Cooper', 'mortgage', /\bMR\.? ?COOPER\b|\bNATIONSTAR\b/),
  lender('freedom-mortgage', 'Freedom Mortgage', 'mortgage', /\bFREEDOM MORTGAGE\b/),
  lender('pennymac', 'PennyMac', 'mortgage', /\bPENNYMAC\b/),
  lender('newrez', 'Newrez (Shellpoint)', 'mortgage', /\bNEWREZ\b|\bSHELLPOINT\b/),
  lender('us-bank-mortgage', 'U.S. Bank Home Mortgage', 'mortgage', /\bU\.? ?S\.? BANK HOME (?:MTG|MORTGAGE)\b/),
  lender('wells-fargo-mortgage', 'Wells Fargo Home Mortgage', 'mortgage', /\b(?:WELLS FARGO|WF) HOME (?:MTG|MORTGAGE)\b/),
  lender('chase-mortgage', 'Chase Home Lending', 'mortgage', /\bCHASE (?:HOME|MORTGAGE|MTG)\b/),
  lender('loandepot', 'loanDepot', 'mortgage', /\bLOANDEPOT\b/),
  lender('caliber', 'Caliber Home Loans', 'mortgage', /\bCALIBER HOME\b/),
  lender('lakeview', 'Lakeview Loan Servicing', 'mortgage', /\bLAKEVIEW LOAN\b/),
  lender('cenlar', 'Cenlar', 'mortgage', /\bCENLAR\b/),
  lender('dovenmuehle', 'Dovenmuehle', 'mortgage', /\bDOVENMUEHLE\b/),
  lender('carrington', 'Carrington Mortgage', 'mortgage', /\bCARRINGTON MORTGAGE\b/),

  // Student-loan servicers. "Dept. of Education" last: Aidvantage and MOHELA print it too.
  lender('navient', 'Navient', 'student', /\bNAVIENT\b/),
  lender('nelnet', 'Nelnet', 'student', /\bNELNET\b/),
  lender('mohela', 'MOHELA', 'student', /\bMOHELA\b/),
  lender('aidvantage', 'Aidvantage', 'student', /\bAIDVANTAGE\b/),
  lender('edfinancial', 'Edfinancial', 'student', /\bEDFINANCIAL\b/),
  lender('great-lakes', 'Great Lakes', 'student', /\bGREAT LAKES (?:ED|HIGHER)\b/),
  lender('fedloan', 'FedLoan Servicing', 'student', /\bFEDLOAN\b|\bPHEAA\b/),
  lender('sallie-mae', 'Sallie Mae', 'student', /\bSALLIE ?MAE\b/),
  lender('earnest', 'Earnest', 'student', /\bEARNEST\b.*\bLOAN/),
  lender('laurel-road', 'Laurel Road', 'student', /\bLAUREL ROAD\b/),
  lender('dept-of-education', 'Dept. of Education', 'student', /\bDEPT\.? ?(?:OF )?ED(?:UCATION)?\b|\bUS ?DEPT ?ED\b/),

  // Car lenders and leases. Each needs its finance arm's name, so a dealer's service bill is not a loan.
  lender('capital-one-auto', 'Capital One Auto', 'auto', /\bCAPITAL ONE\b.*\b(?:AUTO|CARPAY)\b/),
  lender('chase-auto', 'Chase Auto', 'auto', /\bCHASE AUTO\b/),
  lender('toyota', 'Toyota Financial', 'auto', /\bTOYOTA (?:FINANCIAL|FIN SVC|MOTOR CREDIT|MOTOR CR)\b|\bTMCC\b/),
  lender('honda', 'Honda Financial', 'auto', /\bHONDA (?:PMT|PAYMENT|FINANCIAL|FIN)\b|\bAHFC\b|\bAMERICAN HONDA FIN/),
  lender('ford', 'Ford Credit', 'auto', /\bFORD (?:MOTOR )?CREDIT\b|\bFMCC\b/),
  lender('gm-financial', 'GM Financial', 'auto', /\bGM ?FINANCIAL\b|\bAMERICREDIT\b/),
  lender('ally', 'Ally Auto', 'auto', new RegExp(String.raw`\bALLY\b.*\b(?:AUTO|${PAY})\b`)),
  lender('hyundai', 'Hyundai Capital', 'auto', /\bHYUNDAI (?:CAPITAL|MOTOR FIN)/),
  lender('kia', 'Kia Finance', 'auto', /\bKIA (?:MOTORS )?FIN/),
  lender('nissan', 'Nissan Motor Acceptance', 'auto', /\bNISSAN (?:MOTOR ACCEPT|INFINITI)|\bNMAC\b/),
  lender('credit-acceptance', 'Credit Acceptance', 'auto', /\bCREDIT ACCEPTANCE\b/),
  lender('exeter', 'Exeter Finance', 'auto', /\bEXETER FINANCE\b/),
  lender('westlake', 'Westlake Financial', 'auto', /\bWESTLAKE (?:FINANCIAL|FIN)\b/),
  lender('santander', 'Santander Consumer', 'auto', /\bSANTANDER CONSUMER\b|\bCHRYSLER CAPITAL\b/),
  lender('bmw', 'BMW Financial Services', 'auto', /\bBMW FIN/),
  lender('mercedes', 'Mercedes-Benz Financial', 'auto', /\bMERCEDES[- ]BENZ FIN/),
  lender('vw-credit', 'VW Credit', 'auto', /\b(?:VW|VOLKSWAGEN) CREDIT\b/),
  lender('subaru', 'Subaru Motors Finance', 'auto', /\bSUBARU MOTORS FIN/),
  lender('carmax', 'CarMax Auto Finance', 'auto', /\bCARMAX AUTO FIN/),
  lender('bridgecrest', 'Bridgecrest', 'auto', /\bBRIDGECREST\b|\bDRIVETIME\b/),

  // Personal loans
  lender('upstart', 'Upstart', 'personal', /\bUPSTART\b/),
  lender('lendingclub', 'LendingClub', 'personal', /\bLENDING ?CLUB\b/),
  lender('prosper', 'Prosper', 'personal', /\bPROSPER (?:FUNDING|MARKETPLACE|LOAN)/),
  lender('onemain', 'OneMain Financial', 'personal', /\bONE ?MAIN\b/),
  lender('best-egg', 'Best Egg', 'personal', /\bBEST ?EGG\b/),
  lender('avant', 'Avant', 'personal', new RegExp(String.raw`\bAVANT\b.*\b(?:LOAN|${PAY})\b`)),
  lender('sofi', 'SoFi', 'personal', /\bSOFI\b.*\b(?:LOAN|PERSONAL|PL)\b/),
  lender('marcus', 'Marcus by Goldman Sachs', 'personal', /\bMARCUS\b.*\bLOAN/),
  lender('lendingpoint', 'LendingPoint', 'personal', /\bLENDINGPOINT\b/),
  lender('mariner', 'Mariner Finance', 'personal', /\bMARINER FINANCE\b/),
  lender('oportun', 'Oportun', 'personal', /\bOPORTUN\b/),

  // Buy now, pay later
  lender('affirm', 'Affirm', 'bnpl', /\bAFFIRM\b/),
  lender('afterpay', 'Afterpay', 'bnpl', /\bAFTERPAY\b/),
  lender('klarna', 'Klarna', 'bnpl', /\bKLARNA\b/),
  lender('sezzle', 'Sezzle', 'bnpl', /\bSEZZLE\b/),
  lender('zip', 'Zip', 'bnpl', /\bZIP\.CO\b|\bQUADPAY\b|\bZIP PAY\b/),
  lender('paypal-pay-later', 'PayPal Pay Later', 'bnpl', /\bPAYPAL\b.*\b(?:PAY ?IN ?4|PAYIN4|PAY ?LATER)\b/),

  // Card issuers: the bank's name next to a card or payment word.
  lender('chase-card', 'Chase', 'card', new RegExp(String.raw`\bCHASE\b.*\b(?:${CARD}|EPAY|AUTOPAY)\b`)),
  lender('capital-one-card', 'Capital One', 'card', new RegExp(String.raw`\bCAPITAL ONE\b.*\b(?:${CARD}|${PAY})\b`)),
  lender('citi-card', 'Citi', 'card', new RegExp(String.raw`\bCITI(?:BANK)?\b.*\b(?:${CARD}|${PAY}|CBNA)\b|\bCITI ?CARDS?\b`)),
  lender('discover-card', 'Discover', 'card', new RegExp(String.raw`\bDISCOVER\b.*\b(?:${CARD}|${PAY}|DCVR)\b|\bDCVR\b`)),
  lender('amex', 'American Express', 'card', new RegExp(String.raw`\b(?:AMEX|AMERICAN EXPRESS)\b.*\b(?:${PAY})\b`)),
  lender('apple-card', 'Apple Card', 'card', /\bAPPLE ?CARD\b|\bGSBANK\b/),
  lender('wells-fargo-card', 'Wells Fargo', 'card', new RegExp(String.raw`\b(?:WF|WELLS FARGO)\b.*\b${CARD}\b`)),
  lender('bank-of-america-card', 'Bank of America', 'card', new RegExp(String.raw`\b(?:BANK OF AMERICA|BK OF AMER|BOFA)\b.*\b${CARD}\b`)),
  lender('us-bank-card', 'U.S. Bank', 'card', new RegExp(String.raw`\bU\.? ?S\.? BANK\b.*\b${CARD}\b`)),
  lender('target-card', 'Target Circle Card', 'card', /\bTD BANK TARGET\b|\bTARGET (?:CARD|CREDIT|CIRCLE CARD)\b/),
  lender('synchrony', 'Synchrony', 'card', /\bSYNCHRONY\b|\bSYNCB\b/),
  lender('comenity', 'Comenity', 'card', /\bCOMENITY\b/),
  lender('barclays', 'Barclays', 'card', /\bBARCLAY(?:S|CARD)\b/),
  lender('credit-one', 'Credit One Bank', 'card', /\bCREDIT ONE\b/),
  lender('merrick', 'Merrick Bank', 'card', /\bMERRICK BANK\b/),

  // Lenders we don't list: words that only debt payments carry. "AUTO PMT" is not one of them
  // (utilities print it for autopay), nor "LOAN" alone (a transfer to your own loan account).
  lender('generic-mortgage', null, 'mortgage', /\bMTG\b|\bMORTGAGE\b|\bHOME ?LOAN\b/),
  lender('generic-student', null, 'student', /\bSTUDENT ?(?:LN|LOANS?)\b/),
  lender('generic-auto', null, 'auto', /\bAUTO ?LOAN\b|\bCAR ?LOAN\b|\bCARPAY\b|\bLEASE (?:PMT|PYMT|PAYMENT)\b/),
  lender('generic-personal', null, 'personal', /\bPERS(?:ONAL)? ?LOAN\b|\bLOAN (?:PMT|PYMT|PAYMENT)\b|\bINSTALL?MENT LOAN\b/),
  lender('generic-card', null, 'card', /\bCREDIT ?CA?RD\b|\bCRCARDPMT\b/),
];

/** The first lender whose pattern matches a raw description, or null. */
export function lenderOf(description: string): Lender | null {
  const text = description.toUpperCase().replace(/\s+/g, ' ');
  return LENDERS.find((l) => l.re.test(text)) ?? null;
}
