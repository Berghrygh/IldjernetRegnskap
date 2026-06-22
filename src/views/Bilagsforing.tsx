import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Account, Voucher } from "../domain/types";
import {
  accountsSorted,
  allVouchersForYear,
  balanceControl,
  getAccount,
  getYear,
} from "../domain/engine";
import { formatKr } from "../domain/money";
import { formatDate, todayIso } from "../domain/dates";
import { exportCashbookCsv } from "../lib/exporters";
import { PageHeader, LockedNotice } from "../components/ui";
import { Modal } from "../components/Modal";
import { AccountSelect } from "../components/AccountSelect";
import { MoneyInput } from "../components/MoneyInput";

export function Bilagsforing() {
  const store = useStore();
  const { state, currentYearId } = store;
  const year = getYear(state, currentYearId);
  const locked = !!year?.locked;
  const accounts = accountsSorted(state);
  const vouchers = allVouchersForYear(state, currentYearId);
  const control = balanceControl(state, currentYearId);

  const [transferOpen, setTransferOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [editVoucher, setEditVoucher] = useState<Voucher | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter((v) => {
      const d = getAccount(state, v.debitAccountId)?.name ?? "";
      const c = getAccount(state, v.creditAccountId)?.name ?? "";
      return (
        v.description.toLowerCase().includes(q) ||
        d.toLowerCase().includes(q) ||
        c.toLowerCase().includes(q) ||
        String(v.number).includes(q)
      );
    });
  }, [vouchers, filter, state]);

  return (
    <div>
      <PageHeader
        title="Bilagsføring"
        subtitle={`Kassabok for ${year?.label ?? ""}. Streng dobbel bokføring: hvert bilag har lik debet og kredit.`}
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() =>
                exportCashbookCsv(state, currentYearId, vouchers)
              }
            >
              Eksporter CSV
            </button>
            <button
              className="btn-secondary"
              disabled={locked}
              onClick={() => setTransferOpen(true)}
            >
              Kontoregulering
            </button>
            <button
              className="btn-secondary"
              disabled={locked}
              onClick={() => setSplitOpen(true)}
            >
              Splitt Vipps-innbetaling
            </button>
          </>
        }
      />

      {locked && (
        <LockedNotice onUnlock={() => store.unlockYear(currentYearId)} />
      )}

      <div
        className={`mb-4 flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${
          control.balanced
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-800"
        }`}
      >
        <span className="font-medium">
          Balansekontroll:{" "}
          {control.balanced ? "I balanse ✓" : "Ikke i balanse!"}
        </span>
        <span className="num">
          Sum debet {formatKr(control.totalDebit)} = sum kredit{" "}
          {formatKr(control.totalCredit)}
          {!control.balanced && ` (avvik ${formatKr(control.diff)})`}
        </span>
      </div>

      {!locked && (
        <QuickEntry accounts={accounts} yearId={currentYearId} />
      )}

      <div className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700">
            Bilag ({vouchers.filter((v) => !v.voided).length})
          </h2>
          <input
            className="input w-56 py-1.5"
            placeholder="Søk i bilag…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Nr</th>
                <th className="px-3 py-2">Dato</th>
                <th className="px-3 py-2">Beskrivelse</th>
                <th className="px-3 py-2">Debet</th>
                <th className="px-3 py-2">Kredit</th>
                <th className="px-3 py-2 text-right">Beløp</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    Ingen bilag ennå.
                  </td>
                </tr>
              )}
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  className={`border-b border-slate-100 ${
                    v.voided ? "text-slate-400 line-through" : ""
                  }`}
                >
                  <td className="px-3 py-2 num text-slate-400">{v.number}</td>
                  <td className="px-3 py-2 num">{formatDate(v.date)}</td>
                  <td className="px-3 py-2">
                    {v.description}
                    {v.kind !== "normal" && (
                      <span className="badge ml-2 bg-slate-100 text-slate-500">
                        {v.kind === "transfer"
                          ? "Overføring"
                          : v.kind === "split"
                            ? "Splitt"
                            : "Avskrivning"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {getAccount(state, v.debitAccountId)?.name ?? "?"}
                  </td>
                  <td className="px-3 py-2">
                    {getAccount(state, v.creditAccountId)?.name ?? "?"}
                  </td>
                  <td className="px-3 py-2 text-right num font-medium">
                    {formatKr(v.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!locked && !v.voided && (
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn-ghost px-2 py-1"
                          onClick={() => setEditVoucher(v)}
                        >
                          Rediger
                        </button>
                        <button
                          className="btn-ghost px-2 py-1 text-rose-600"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Annullere bilag ${v.number}? Bilagsnummeret beholdes.`,
                              )
                            )
                              store.voidVoucher(v.id);
                          }}
                        >
                          Annuller
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {transferOpen && (
        <TransferModal
          accounts={accounts}
          yearId={currentYearId}
          onClose={() => setTransferOpen(false)}
        />
      )}
      {splitOpen && (
        <SplitModal
          accounts={accounts}
          yearId={currentYearId}
          onClose={() => setSplitOpen(false)}
        />
      )}
      {editVoucher && (
        <EditModal
          accounts={accounts}
          voucher={editVoucher}
          onClose={() => setEditVoucher(null)}
        />
      )}
    </div>
  );
}

// ----- quick entry ----------------------------------------------------------

function QuickEntry({
  accounts,
  yearId,
}: {
  accounts: Account[];
  yearId: string;
}) {
  const store = useStore();
  const [date, setDate] = useState(todayIso());
  const [desc, setDesc] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState("");

  const reset = () => {
    setDesc("");
    setAmount(0);
    // Keep date and account choices for fast repeated entry.
  };

  const submit = () => {
    if (!desc.trim()) return setError("Skriv en beskrivelse.");
    if (!debit || !credit) return setError("Velg både debet- og kredit-konto.");
    if (debit === credit) return setError("Debet og kredit må være ulike kontoer.");
    if (!(amount > 0)) return setError("Beløpet må være større enn 0.");
    setError("");
    store.addVoucher(yearId, {
      date,
      description: desc.trim(),
      amount,
      debitAccountId: debit,
      creditAccountId: credit,
    });
    reset();
  };

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Nytt bilag</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-2">
          <label className="label">Dato</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="md:col-span-4">
          <label className="label">Beskrivelse</label>
          <input
            className="input"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="f.eks. Kontingent Hansen"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Debet-konto</label>
          <AccountSelect
            accounts={accounts}
            value={debit}
            onChange={setDebit}
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Kredit-konto</label>
          <AccountSelect
            accounts={accounts}
            value={credit}
            onChange={setCredit}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Beløp</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div className="flex items-end md:col-span-10">
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-slate-500">
              {debit && credit && amount > 0
                ? `Debet ${getAccount(store.state, debit)?.name} / Kredit ${getAccount(store.state, credit)?.name}`
                : "Velg kontoer for å bokføre."}
            </p>
            <button className="btn-primary" onClick={submit}>
              Bokfør bilag
            </button>
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

// ----- transfer -------------------------------------------------------------

function TransferModal({
  accounts,
  yearId,
  onClose,
}: {
  accounts: Account[];
  yearId: string;
  onClose: () => void;
}) {
  const store = useStore();
  const banks = accounts.filter(
    (a) => a.type === "balance" && a.balanceKind !== "fixedAsset" && a.active,
  );
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState("");

  const submit = () => {
    if (!from || !to) return setError("Velg fra- og til-konto.");
    if (from === to) return setError("Kontoene må være ulike.");
    if (!(amount > 0)) return setError("Beløpet må være større enn 0.");
    store.addVoucher(yearId, {
      date,
      description: `Overføring ${getAccount(store.state, from)?.name} → ${getAccount(store.state, to)?.name}`,
      amount,
      debitAccountId: to, // receiving account increases
      creditAccountId: from, // source account decreases
      kind: "transfer",
    });
    onClose();
  };

  return (
    <Modal
      open
      title="Kontoregulering (overføring mellom kontoer)"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-primary" onClick={submit}>
            Bokfør overføring
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Dato</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Fra konto</label>
          <AccountSelect accounts={banks} value={from} onChange={setFrom} />
        </div>
        <div>
          <label className="label">Til konto</label>
          <AccountSelect accounts={banks} value={to} onChange={setTo} />
        </div>
        <div className="col-span-2">
          <label className="label">Beløp</label>
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
}

// ----- split ----------------------------------------------------------------

function SplitModal({
  accounts,
  yearId,
  onClose,
}: {
  accounts: Account[];
  yearId: string;
  onClose: () => void;
}) {
  const store = useStore();
  const banks = accounts.filter(
    (a) => a.type === "balance" && a.balanceKind !== "fixedAsset" && a.active,
  );
  const incomeAccts = accounts.filter((a) => a.type === "result" && a.active);
  const [date, setDate] = useState(todayIso());
  const [desc, setDesc] = useState("");
  const vipps = banks.find((b) => b.name.toLowerCase().includes("vipps"));
  const [bank, setBank] = useState(vipps?.id ?? banks[0]?.id ?? "");
  const [parts, setParts] = useState<
    { incomeAccountId: string; amount: number; description: string }[]
  >([
    { incomeAccountId: "", amount: 0, description: "" },
    { incomeAccountId: "", amount: 0, description: "" },
  ]);
  const [error, setError] = useState("");

  const total = parts.reduce((s, p) => s + (p.amount || 0), 0);

  const submit = () => {
    if (!bank) return setError("Velg bankkonto pengene kom inn på.");
    if (!desc.trim()) return setError("Skriv en beskrivelse.");
    const valid = parts.filter((p) => p.incomeAccountId && p.amount > 0);
    if (valid.length === 0)
      return setError("Legg til minst én linje med konto og beløp.");
    store.addSplit(yearId, { date, description: desc.trim() }, bank, valid);
    onClose();
  };

  return (
    <Modal
      open
      wide
      title="Splitt brutto innbetaling på flere resultatkontoer"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-primary" onClick={submit}>
            Bokfør {parts.filter((p) => p.amount > 0).length} bilag
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Én brutto innbetaling (f.eks. en Vipps-utbetaling) fordeles på flere
        inntektskontoer via flere koblede bilag. Hvert bilag debiterer
        bankkontoen og krediterer en resultatkonto.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Dato</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Penger inn på konto</label>
          <AccountSelect accounts={banks} value={bank} onChange={setBank} />
        </div>
        <div className="col-span-2">
          <label className="label">Beskrivelse</label>
          <input
            className="input"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="f.eks. Vipps-oppgjør juni"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-5">
              {i === 0 && <label className="label">Resultatkonto</label>}
              <AccountSelect
                accounts={incomeAccts}
                value={p.incomeAccountId}
                onChange={(id) =>
                  setParts((ps) =>
                    ps.map((x, j) =>
                      j === i ? { ...x, incomeAccountId: id } : x,
                    ),
                  )
                }
              />
            </div>
            <div className="col-span-4">
              {i === 0 && <label className="label">Tekst (valgfri)</label>}
              <input
                className="input"
                value={p.description}
                onChange={(e) =>
                  setParts((ps) =>
                    ps.map((x, j) =>
                      j === i ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
            <div className="col-span-3">
              {i === 0 && <label className="label">Beløp</label>}
              <MoneyInput
                value={p.amount}
                onChange={(n) =>
                  setParts((ps) =>
                    ps.map((x, j) => (j === i ? { ...x, amount: n } : x)),
                  )
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          className="btn-ghost"
          onClick={() =>
            setParts((ps) => [
              ...ps,
              { incomeAccountId: "", amount: 0, description: "" },
            ])
          }
        >
          + Legg til linje
        </button>
        <div className="text-sm font-medium text-slate-700 num">
          Sum: {formatKr(total)}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
}

// ----- edit -----------------------------------------------------------------

function EditModal({
  accounts,
  voucher,
  onClose,
}: {
  accounts: Account[];
  voucher: Voucher;
  onClose: () => void;
}) {
  const store = useStore();
  const [date, setDate] = useState(voucher.date);
  const [desc, setDesc] = useState(voucher.description);
  const [debit, setDebit] = useState(voucher.debitAccountId);
  const [credit, setCredit] = useState(voucher.creditAccountId);
  const [amount, setAmount] = useState(voucher.amount);
  const [error, setError] = useState("");

  const submit = () => {
    if (!desc.trim()) return setError("Skriv en beskrivelse.");
    if (debit === credit) return setError("Debet og kredit må være ulike.");
    if (!(amount > 0)) return setError("Beløpet må være større enn 0.");
    store.updateVoucher(voucher.id, {
      date,
      description: desc.trim(),
      debitAccountId: debit,
      creditAccountId: credit,
      amount,
    });
    onClose();
  };

  return (
    <Modal
      open
      title={`Rediger bilag ${voucher.number}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-primary" onClick={submit}>
            Lagre
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Dato</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Beløp</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div className="col-span-2">
          <label className="label">Beskrivelse</label>
          <input
            className="input"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Debet-konto</label>
          <AccountSelect accounts={accounts} value={debit} onChange={setDebit} />
        </div>
        <div>
          <label className="label">Kredit-konto</label>
          <AccountSelect
            accounts={accounts}
            value={credit}
            onChange={setCredit}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
}
