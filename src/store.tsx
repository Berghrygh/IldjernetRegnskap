import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Account,
  Asset,
  AssetEvent,
  DbState,
  FiscalYear,
  Household,
  Voucher,
  VoucherKind,
} from "./domain/types";
import { loadState, resetState, saveState } from "./db/storage";
import { round2 } from "./domain/money";
import {
  accountsSorted,
  assetSchedule,
  closingBalance,
  getYear,
  suggestedDepreciation,
} from "./domain/engine";
import { fiscalYearForStart } from "./domain/dates";
import { CURRENT_DB_VERSION } from "./domain/seed";

function uid(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${rnd}`;
}

export interface NewVoucherInput {
  date: string;
  description: string;
  amount: number;
  debitAccountId: string;
  creditAccountId: string;
  kind?: VoucherKind;
  groupId?: string;
  householdId?: string;
}

interface StoreValue {
  state: DbState;
  loaded: boolean;
  currentYearId: string;
  // settings
  updateSettings: (patch: Partial<DbState["settings"]>) => void;
  // accounts
  addAccount: (a: Omit<Account, "id" | "sortOrder">) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  setOpeningBalance: (yearId: string, accountId: string, amount: number) => void;
  // years
  selectYear: (yearId: string) => void;
  addYear: (startCalendarYear: number) => void;
  closeYear: (yearId: string) => void;
  unlockYear: (yearId: string) => void;
  // vouchers
  addVoucher: (yearId: string, input: NewVoucherInput) => Voucher;
  addSplit: (
    yearId: string,
    base: { date: string; description: string; householdId?: string },
    bankAccountId: string,
    parts: { incomeAccountId: string; amount: number; description?: string }[],
  ) => void;
  updateVoucher: (id: string, patch: Partial<Voucher>) => void;
  voidVoucher: (id: string) => void;
  // reskontro
  addHousehold: (h: Omit<Household, "id" | "payments">) => void;
  updateHousehold: (id: string, patch: Partial<Household>) => void;
  deleteHousehold: (id: string) => void;
  setPayment: (
    householdId: string,
    yearId: string,
    amount: number,
    voucherId?: string,
  ) => void;
  recordKontingent: (
    householdId: string,
    yearId: string,
    input: NewVoucherInput,
  ) => void;
  // assets
  addAsset: (name: string, date: string, acquisitionValue: number) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  addAssetEvent: (assetId: string, ev: Omit<AssetEvent, "id">) => void;
  removeAssetEvent: (assetId: string, eventId: string) => void;
  runDepreciation: (yearId: string) => number;
  // data management
  importState: (state: DbState) => void;
  resetToSeed: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DbState | null>(null);
  const firstSave = useRef(true);

  useEffect(() => {
    loadState().then(setState);
  }, []);

  // Persist on every change (after initial load).
  useEffect(() => {
    if (!state) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    void saveState(state);
  }, [state]);

  const update = useCallback((fn: (s: DbState) => DbState) => {
    setState((prev) => (prev ? fn(prev) : prev));
  }, []);

  const value = useMemo<StoreValue | null>(() => {
    if (!state) return null;
    const currentYearId =
      state.settings.currentYearId ?? state.years[0]?.id ?? "";

    const nextVoucherNumber = (s: DbState, yearId: string): number => {
      const nums = s.vouchers
        .filter((v) => v.yearId === yearId)
        .map((v) => v.number);
      return nums.length ? Math.max(...nums) + 1 : 1;
    };

    const makeVoucher = (
      s: DbState,
      yearId: string,
      input: NewVoucherInput,
    ): Voucher => ({
      id: uid("v"),
      yearId,
      number: nextVoucherNumber(s, yearId),
      date: input.date,
      description: input.description,
      amount: round2(input.amount),
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
      voided: false,
      kind: input.kind ?? "normal",
      groupId: input.groupId,
      householdId: input.householdId,
      createdAt: new Date().toISOString(),
    });

    const v: StoreValue = {
      state,
      loaded: true,
      currentYearId,

      updateSettings: (patch) =>
        update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),

      addAccount: (a) =>
        update((s) => {
          const maxOrder = s.accounts.reduce(
            (m, x) => Math.max(m, x.sortOrder),
            0,
          );
          const account: Account = {
            ...a,
            id: uid("acc"),
            sortOrder: maxOrder + 10,
          };
          return { ...s, accounts: [...s.accounts, account] };
        }),

      updateAccount: (id, patch) =>
        update((s) => ({
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),

      setOpeningBalance: (yearId, accountId, amount) =>
        update((s) => ({
          ...s,
          years: s.years.map((y) =>
            y.id === yearId
              ? {
                  ...y,
                  openingBalances: {
                    ...y.openingBalances,
                    [accountId]: round2(amount),
                  },
                }
              : y,
          ),
        })),

      selectYear: (yearId) =>
        update((s) => ({
          ...s,
          settings: { ...s.settings, currentYearId: yearId },
        })),

      addYear: (startCalendarYear) =>
        update((s) => {
          const fy = fiscalYearForStart(startCalendarYear);
          if (s.years.some((y) => y.id === fy.id)) return s;
          const year: FiscalYear = {
            ...fy,
            locked: false,
            openingBalances: {},
            createdAt: new Date().toISOString(),
          };
          return {
            ...s,
            years: [...s.years, year].sort((a, b) =>
              a.startDate.localeCompare(b.startDate),
            ),
            settings: { ...s.settings, currentYearId: year.id },
          };
        }),

      closeYear: (yearId) =>
        update((s) => {
          const year = getYear(s, yearId);
          if (!year) return s;
          // Roll closing balances of balance accounts into next year's IB.
          const nextStart = Number(yearId.split("-")[0]) + 1;
          const fy = fiscalYearForStart(nextStart);
          const opening: Record<string, number> = {};
          for (const acc of s.accounts) {
            if (acc.type === "balance") {
              opening[acc.id] = closingBalance(s, yearId, acc.id);
            }
          }
          const years = s.years.map((y) =>
            y.id === yearId ? { ...y, locked: true } : y,
          );
          const existing = years.find((y) => y.id === fy.id);
          let nextYears: FiscalYear[];
          if (existing) {
            nextYears = years.map((y) =>
              y.id === fy.id ? { ...y, openingBalances: opening } : y,
            );
          } else {
            nextYears = [
              ...years,
              {
                ...fy,
                locked: false,
                openingBalances: opening,
                createdAt: new Date().toISOString(),
              },
            ].sort((a, b) => a.startDate.localeCompare(b.startDate));
          }
          return {
            ...s,
            years: nextYears,
            settings: { ...s.settings, currentYearId: fy.id },
          };
        }),

      unlockYear: (yearId) =>
        update((s) => ({
          ...s,
          years: s.years.map((y) =>
            y.id === yearId ? { ...y, locked: false } : y,
          ),
        })),

      addVoucher: (yearId, input) => {
        const voucher = makeVoucher(state, yearId, input);
        update((s) => ({
          ...s,
          // Recompute the number against the freshest state to avoid clashes.
          vouchers: [
            ...s.vouchers,
            { ...voucher, number: nextVoucherNumber(s, yearId) },
          ],
        }));
        return voucher;
      },

      addSplit: (yearId, base, bankAccountId, parts) =>
        update((s) => {
          const groupId = uid("grp");
          let next = nextVoucherNumber(s, yearId);
          const created: Voucher[] = parts.map((p) => ({
            id: uid("v"),
            yearId,
            number: next++,
            date: base.date,
            description: p.description
              ? `${base.description} – ${p.description}`
              : base.description,
            amount: round2(p.amount),
            debitAccountId: bankAccountId, // money lands in bank (debit)
            creditAccountId: p.incomeAccountId, // recognised income (credit)
            voided: false,
            kind: "split",
            groupId,
            householdId: base.householdId,
            createdAt: new Date().toISOString(),
          }));
          return { ...s, vouchers: [...s.vouchers, ...created] };
        }),

      updateVoucher: (id, patch) =>
        update((s) => ({
          ...s,
          vouchers: s.vouchers.map((vc) =>
            vc.id === id
              ? {
                  ...vc,
                  ...patch,
                  amount:
                    patch.amount != null ? round2(patch.amount) : vc.amount,
                }
              : vc,
          ),
        })),

      voidVoucher: (id) =>
        update((s) => ({
          ...s,
          vouchers: s.vouchers.map((vc) =>
            vc.id === id ? { ...vc, voided: true } : vc,
          ),
        })),

      addHousehold: (h) =>
        update((s) => ({
          ...s,
          households: [
            ...s.households,
            { ...h, id: uid("hh"), payments: {} },
          ],
        })),

      updateHousehold: (id, patch) =>
        update((s) => ({
          ...s,
          households: s.households.map((h) =>
            h.id === id ? { ...h, ...patch } : h,
          ),
        })),

      deleteHousehold: (id) =>
        update((s) => ({
          ...s,
          households: s.households.filter((h) => h.id !== id),
        })),

      setPayment: (householdId, yearId, amount, voucherId) =>
        update((s) => ({
          ...s,
          households: s.households.map((h) => {
            if (h.id !== householdId) return h;
            const payments = { ...h.payments };
            if (amount <= 0 && !voucherId) {
              delete payments[yearId];
            } else {
              payments[yearId] = { amount: round2(amount), voucherId };
            }
            return { ...h, payments };
          }),
        })),

      recordKontingent: (householdId, yearId, input) =>
        update((s) => {
          const voucher = makeVoucher(s, yearId, {
            ...input,
            householdId,
            kind: "normal",
          });
          const households = s.households.map((h) => {
            if (h.id !== householdId) return h;
            return {
              ...h,
              payments: {
                ...h.payments,
                [yearId]: { amount: voucher.amount, voucherId: voucher.id },
              },
            };
          });
          return { ...s, vouchers: [...s.vouchers, voucher], households };
        }),

      addAsset: (name, date, acquisitionValue) =>
        update((s) => {
          const asset: Asset = {
            id: uid("asset"),
            name,
            acquisitionDate: date,
            active: true,
            events: [
              {
                id: uid("ae"),
                yearId: s.settings.currentYearId ?? "",
                type: "acquisition",
                amount: round2(acquisitionValue),
                date,
                note: "Anskaffelse",
              },
            ],
          };
          return { ...s, assets: [...s.assets, asset] };
        }),

      updateAsset: (id, patch) =>
        update((s) => ({
          ...s,
          assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),

      addAssetEvent: (assetId, ev) =>
        update((s) => ({
          ...s,
          assets: s.assets.map((a) =>
            a.id === assetId
              ? {
                  ...a,
                  events: [...a.events, { ...ev, id: uid("ae"), amount: round2(ev.amount) }],
                }
              : a,
          ),
        })),

      removeAssetEvent: (assetId, eventId) =>
        update((s) => ({
          ...s,
          assets: s.assets.map((a) =>
            a.id === assetId
              ? { ...a, events: a.events.filter((e) => e.id !== eventId) }
              : a,
          ),
        })),

      runDepreciation: (yearId) => {
        let count = 0;
        update((s) => {
          const year = getYear(s, yearId);
          const depAcc = s.settings.depreciationAccountId;
          const eiendeler = s.settings.fixedAssetAccountId;
          if (!year || !depAcc || !eiendeler) return s;
          let next = nextVoucherNumber(s, yearId);
          const newVouchers: Voucher[] = [];
          const assets = s.assets.map((asset) => {
            if (!asset.active) return asset;
            // Skip if depreciation already booked this year.
            const already = asset.events.some(
              (e) =>
                e.type === "depreciation" &&
                e.date >= year.startDate &&
                e.date <= year.endDate,
            );
            if (already) return asset;
            const dep = suggestedDepreciation(asset, year);
            if (dep <= 0) return asset;
            const voucherId = uid("v");
            newVouchers.push({
              id: voucherId,
              yearId,
              number: next++,
              date: year.endDate,
              description: `Avskrivning 10% – ${asset.name}`,
              amount: dep,
              debitAccountId: depAcc,
              creditAccountId: eiendeler,
              voided: false,
              kind: "depreciation",
              createdAt: new Date().toISOString(),
            });
            count++;
            return {
              ...asset,
              events: [
                ...asset.events,
                {
                  id: uid("ae"),
                  yearId,
                  type: "depreciation" as const,
                  amount: dep,
                  date: year.endDate,
                  note: "10% avskrivning",
                  voucherId,
                },
              ],
            };
          });
          return { ...s, assets, vouchers: [...s.vouchers, ...newVouchers] };
        });
        return count;
      },

      importState: (incoming) =>
        update(() => ({ ...incoming, version: CURRENT_DB_VERSION })),

      resetToSeed: async () => {
        const seed = await resetState();
        setState(seed);
      },
    };
    return v;
  }, [state, update]);

  if (!value) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Laster regnskap…
      </div>
    );
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}

// Convenience selectors built on the engine.
export function useAccounts(): Account[] {
  const { state } = useStore();
  return accountsSorted(state);
}

export { assetSchedule };
