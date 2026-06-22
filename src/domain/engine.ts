// Accounting engine: all derived numbers are computed here, never stored.
import { round2 } from "./money";
import type {
  Account,
  Asset,
  DbState,
  FiscalYear,
  Household,
  Voucher,
} from "./types";

export const DEPRECIATION_RATE = 0.1; // 10% straight-line per year.

// ----- lookups -------------------------------------------------------------

export function getYear(state: DbState, yearId: string): FiscalYear | undefined {
  return state.years.find((y) => y.id === yearId);
}

export function getAccount(state: DbState, id: string): Account | undefined {
  return state.accounts.find((a) => a.id === id);
}

export function accountsSorted(state: DbState): Account[] {
  return [...state.accounts].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"),
  );
}

/** Non-voided vouchers belonging to a year. */
export function vouchersForYear(state: DbState, yearId: string): Voucher[] {
  return state.vouchers
    .filter((v) => v.yearId === yearId && !v.voided)
    .sort((a, b) => a.number - b.number);
}

/** All vouchers (incl. voided) for a year, for display in the cashbook. */
export function allVouchersForYear(state: DbState, yearId: string): Voucher[] {
  return state.vouchers
    .filter((v) => v.yearId === yearId)
    .sort((a, b) => a.number - b.number);
}

// ----- per-account movement & balance --------------------------------------

export interface AccountMovement {
  debit: number;
  credit: number;
}

/** Sum of debit and credit postings to an account within a year. */
export function accountMovement(
  state: DbState,
  yearId: string,
  accountId: string,
): AccountMovement {
  let debit = 0;
  let credit = 0;
  for (const v of vouchersForYear(state, yearId)) {
    if (v.debitAccountId === accountId) debit += v.amount;
    if (v.creditAccountId === accountId) credit += v.amount;
  }
  return { debit: round2(debit), credit: round2(credit) };
}

export function openingBalance(
  state: DbState,
  yearId: string,
  accountId: string,
): number {
  const year = getYear(state, yearId);
  const acc = getAccount(state, accountId);
  if (!year || !acc) return 0;
  if (acc.type === "result") return 0; // result accounts reset each year
  return round2(year.openingBalances[accountId] ?? 0);
}

/** Utgående balanse = Inngående balanse + Σdebet − Σkredit. */
export function closingBalance(
  state: DbState,
  yearId: string,
  accountId: string,
): number {
  const acc = getAccount(state, accountId);
  const ib = openingBalance(state, yearId, accountId);
  const { debit, credit } = accountMovement(state, yearId, accountId);
  if (acc?.type === "result") {
    // For a result account "balance" we report the net movement only.
    return round2(debit - credit);
  }
  return round2(ib + debit - credit);
}

/**
 * Net result contribution of a result account in the period.
 * Income returns positive when it increased equity (credit-heavy);
 * expense returns positive cost (debit-heavy).
 */
export function resultNet(
  state: DbState,
  yearId: string,
  accountId: string,
): { income: number; cost: number; net: number } {
  const acc = getAccount(state, accountId);
  const { debit, credit } = accountMovement(state, yearId, accountId);
  // Income recognised as credit; cost recognised as debit.
  const income = round2(credit);
  const cost = round2(debit);
  const net =
    acc?.resultKind === "expense"
      ? round2(cost - income) // expense magnitude
      : round2(income - cost); // income magnitude
  return { income, cost, net };
}

// ----- balance control ------------------------------------------------------

export interface BalanceControl {
  totalDebit: number;
  totalCredit: number;
  diff: number;
  balanced: boolean;
}

/** Sum of all debits must equal all credits across the year. */
export function balanceControl(state: DbState, yearId: string): BalanceControl {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const v of vouchersForYear(state, yearId)) {
    totalDebit += v.amount;
    totalCredit += v.amount;
  }
  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  const diff = round2(totalDebit - totalCredit);
  return { totalDebit, totalCredit, diff, balanced: Math.abs(diff) < 0.005 };
}

// ----- fixed assets ---------------------------------------------------------

export interface AssetYearSchedule {
  asset: Asset;
  openingValue: number; // carrying value at start of year
  addition: number;
  depreciation: number;
  writedown: number;
  closingValue: number;
}

/** Carrying value of an asset up to (and including) a year's end. */
export function assetCarryingValueThrough(asset: Asset, endIso: string): number {
  let v = 0;
  for (const e of asset.events) {
    if (e.date > endIso) continue;
    if (e.type === "acquisition" || e.type === "addition") v += e.amount;
    else v -= e.amount; // depreciation / writedown
  }
  return round2(v);
}

/** Carrying value at the very start of a fiscal year (before its events). */
export function assetOpeningValue(
  asset: Asset,
  year: FiscalYear,
): number {
  let v = 0;
  for (const e of asset.events) {
    if (e.date >= year.startDate) continue; // only prior years
    if (e.type === "acquisition" || e.type === "addition") v += e.amount;
    else v -= e.amount;
  }
  return round2(v);
}

export function assetSchedule(asset: Asset, year: FiscalYear): AssetYearSchedule {
  const openingValue = assetOpeningValue(asset, year);
  let addition = 0;
  let depreciation = 0;
  let writedown = 0;
  for (const e of asset.events) {
    if (e.date < year.startDate || e.date > year.endDate) continue;
    if (e.type === "addition" || e.type === "acquisition") addition += e.amount;
    else if (e.type === "depreciation") depreciation += e.amount;
    else if (e.type === "writedown") writedown += e.amount;
  }
  const closingValue = round2(
    openingValue + addition - depreciation - writedown,
  );
  return {
    asset,
    openingValue: round2(openingValue),
    addition: round2(addition),
    depreciation: round2(depreciation),
    writedown: round2(writedown),
    closingValue,
  };
}

/** Standard 10% depreciation suggestion based on carrying value at year start. */
export function suggestedDepreciation(asset: Asset, year: FiscalYear): number {
  const base = assetOpeningValue(asset, year);
  // Include additions made during the year in the base as well.
  let additions = 0;
  for (const e of asset.events) {
    if (
      (e.type === "addition" || e.type === "acquisition") &&
      e.date >= year.startDate &&
      e.date <= year.endDate
    ) {
      additions += e.amount;
    }
  }
  const dep = round2((base + additions) * DEPRECIATION_RATE);
  // Never depreciate below zero.
  return round2(Math.min(dep, base + additions));
}

// ----- annual statement (Årsoppstilling) ------------------------------------

export interface StatementLine {
  account: Account;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  net: number;
}

export interface AnnualStatement {
  year: FiscalYear;
  liquidOpening: StatementLine[];
  liquidClosing: StatementLine[];
  fixedAssetOpening: number;
  fixedAssetClosing: number;
  income: StatementLine[];
  costs: StatementLine[]; // excludes depreciation account
  depreciationLines: StatementLine[];
  totalOpeningAssets: number;
  totalClosingAssets: number;
  totalIncome: number;
  totalCosts: number; // excludes depreciation
  totalDepreciation: number;
  resultBeforeDepreciation: number;
  yearResult: number;
  /** Closing − Opening − yearResult; should be 0. */
  correction: number;
  controlOk: boolean;
}

export function buildStatement(state: DbState, yearId: string): AnnualStatement {
  const year = getYear(state, yearId)!;
  const accounts = accountsSorted(state);

  const mkLine = (acc: Account): StatementLine => {
    const opening = openingBalance(state, yearId, acc.id);
    const { debit, credit } = accountMovement(state, yearId, acc.id);
    const closing = closingBalance(state, yearId, acc.id);
    const net = resultNet(state, yearId, acc.id).net;
    return { account: acc, opening, debit, credit, closing, net };
  };

  const depAccId = state.settings.depreciationAccountId;

  const balanceAccts = accounts.filter((a) => a.type === "balance");
  const liquid = balanceAccts.filter((a) => a.balanceKind !== "fixedAsset");
  const fixed = balanceAccts.filter((a) => a.balanceKind === "fixedAsset");

  const liquidOpening = liquid.map(mkLine);
  const liquidClosing = liquidOpening; // same lines, different fields used

  const fixedAssetOpening = round2(
    fixed.reduce((s, a) => s + openingBalance(state, yearId, a.id), 0),
  );
  const fixedAssetClosing = round2(
    fixed.reduce((s, a) => s + closingBalance(state, yearId, a.id), 0),
  );

  const resultAccts = accounts.filter((a) => a.type === "result");
  const incomeAccts = resultAccts.filter((a) => a.resultKind !== "expense");
  const costAccts = resultAccts.filter(
    (a) => a.resultKind === "expense" && a.id !== depAccId,
  );
  const depAccts = resultAccts.filter((a) => a.id === depAccId);

  const income = incomeAccts.map(mkLine).filter((l) => l.net !== 0 || l.debit || l.credit);
  const costs = costAccts.map(mkLine).filter((l) => l.net !== 0 || l.debit || l.credit);
  const depreciationLines = depAccts.map(mkLine);

  const totalOpeningAssets = round2(
    liquidOpening.reduce((s, l) => s + l.opening, 0) + fixedAssetOpening,
  );
  const totalClosingAssets = round2(
    liquidClosing.reduce((s, l) => s + l.closing, 0) + fixedAssetClosing,
  );
  const totalIncome = round2(income.reduce((s, l) => s + l.net, 0));
  const totalCosts = round2(costs.reduce((s, l) => s + l.net, 0));
  const totalDepreciation = round2(
    depreciationLines.reduce((s, l) => s + l.net, 0),
  );
  const resultBeforeDepreciation = round2(totalIncome - totalCosts);
  const yearResult = round2(resultBeforeDepreciation - totalDepreciation);
  const correction = round2(
    totalClosingAssets - totalOpeningAssets - yearResult,
  );

  return {
    year,
    liquidOpening,
    liquidClosing,
    fixedAssetOpening,
    fixedAssetClosing,
    income,
    costs,
    depreciationLines,
    totalOpeningAssets,
    totalClosingAssets,
    totalIncome,
    totalCosts,
    totalDepreciation,
    resultBeforeDepreciation,
    yearResult,
    correction,
    controlOk: Math.abs(correction) < 0.005,
  };
}

// ----- kontingent reconciliation -------------------------------------------

export interface KontingentRecon {
  bookedIncome: number; // credited to the Kontingent account in the year
  registeredPaid: number; // sum of household payments for the year
  diff: number;
  matches: boolean;
}

export function kontingentRecon(
  state: DbState,
  yearId: string,
): KontingentRecon {
  const accId = state.settings.kontingentAccountId;
  const bookedIncome = accId
    ? resultNet(state, yearId, accId).net
    : 0;
  let registeredPaid = 0;
  for (const h of state.households) {
    const p = h.payments[yearId];
    if (p) registeredPaid += p.amount;
  }
  registeredPaid = round2(registeredPaid);
  const diff = round2(bookedIncome - registeredPaid);
  return {
    bookedIncome,
    registeredPaid,
    diff,
    matches: Math.abs(diff) < 0.005,
  };
}

/** Households that have not paid (or underpaid) for the given year. */
export function unpaidHouseholds(
  state: DbState,
  yearId: string,
  standard: number,
): Household[] {
  return state.households.filter((h) => {
    if (h.status === "Utmeldt") return false;
    const p = h.payments[yearId];
    return !p || p.amount + 0.005 < standard;
  });
}
