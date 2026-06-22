// Core domain model for Vel-Regnskap.
// All monetary amounts are NOK kroner stored as numbers, always rounded to 2
// decimals via the helpers in money.ts. Magnitudes for a small velforening are
// far within the exact-integer range of JS doubles, so rounding after each
// operation keeps the double-entry control exact.

export type AccountType = "balance" | "result";

/** For result accounts: whether it is primarily income or a cost. */
export type ResultKind = "income" | "expense";

/** For balance accounts: liquid (bank/cash) vs. fixed assets (Anleggsmidler). */
export type BalanceKind = "liquid" | "fixedAsset";

export interface Account {
  id: string;
  /** Optional account number (Kontonummer). May be empty. */
  number: string;
  /** Visible Norwegian name, e.g. "Kontingent". */
  name: string;
  type: AccountType;
  resultKind?: ResultKind;
  balanceKind?: BalanceKind;
  active: boolean;
  sortOrder: number;
  /** When true, the account gets an itemised Note in the annual statement. */
  showInNotes?: boolean;
}

export interface FiscalYear {
  /** Stable id, e.g. "2024-2025". */
  id: string;
  /** Visible label, e.g. "2024/2025". */
  label: string;
  /** ISO date, always 1 April. */
  startDate: string;
  /** ISO date, always 31 March. */
  endDate: string;
  locked: boolean;
  /** accountId -> opening balance (Inngående balanse) for balance accounts. */
  openingBalances: Record<string, number>;
  createdAt: string;
}

export type VoucherKind = "normal" | "transfer" | "split" | "depreciation";

/** Bilag — a single double-entry voucher. */
export interface Voucher {
  id: string;
  yearId: string;
  /** Sequential within the year. Stable: never reused, never renumbered. */
  number: number;
  /** ISO date. */
  date: string;
  description: string;
  /** Always > 0. The same amount is debited and credited. */
  amount: number;
  debitAccountId: string;
  creditAccountId: string;
  voided: boolean;
  kind: VoucherKind;
  /** Links split/transfer vouchers that belong together. */
  groupId?: string;
  /** Optional link to a Reskontro household (for Kontingent bilag). */
  householdId?: string;
  createdAt: string;
}

export type AssetEventType =
  | "acquisition"
  | "addition"
  | "depreciation"
  | "writedown";

export interface AssetEvent {
  id: string;
  yearId: string;
  type: AssetEventType;
  /** Positive magnitude. */
  amount: number;
  date: string;
  note?: string;
  /** The depreciation/addition voucher this event posted, when applicable. */
  voucherId?: string;
}

/** Anleggsmiddel — a fixed asset in the asset register. */
export interface Asset {
  id: string;
  name: string;
  acquisitionDate: string;
  events: AssetEvent[];
  active: boolean;
}

export type MemberStatus = "Innmeldt" | "Utmeldt";

export interface HouseholdPayment {
  amount: number;
  /** Optional link to the booked Kontingent bilag. */
  voucherId?: string;
}

/** Reskontro — one record per household. */
export interface Household {
  id: string;
  primaryMember: string;
  partner?: string;
  address: string;
  /** Unit / hyttenummer / leilighet. */
  unit?: string;
  status: MemberStatus;
  /** Year of innmelding/utmelding. */
  statusYear?: number;
  notes?: string;
  /** fiscalYearId -> payment for that year. */
  payments: Record<string, HouseholdPayment>;
}

export interface Settings {
  associationName: string;
  currentYearId: string | null;
  /** Standard kontingent amount per household per year. */
  standardKontingent: number;
  /** Key accounts used by automated postings. */
  kontingentAccountId?: string;
  fixedAssetAccountId?: string;
  depreciationAccountId?: string;
}

export interface DbState {
  version: number;
  settings: Settings;
  accounts: Account[];
  years: FiscalYear[];
  vouchers: Voucher[];
  assets: Asset[];
  households: Household[];
}
