import { useState } from "react";
import { useStore } from "../store";
import type { Account, AccountType, BalanceKind, ResultKind } from "../domain/types";
import { accountsSorted, closingBalance, openingBalance } from "../domain/engine";
import { formatKr } from "../domain/money";
import { PageHeader } from "../components/ui";
import { Modal } from "../components/Modal";
import { MoneyInput } from "../components/MoneyInput";

interface Draft {
  number: string;
  name: string;
  type: AccountType;
  resultKind: ResultKind;
  balanceKind: BalanceKind;
  showInNotes: boolean;
}

const emptyDraft: Draft = {
  number: "",
  name: "",
  type: "balance",
  resultKind: "income",
  balanceKind: "liquid",
  showInNotes: false,
};

export function Kontoplan() {
  const store = useStore();
  const { state, currentYearId } = store;
  const accounts = accountsSorted(state);
  const [editing, setEditing] = useState<Account | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(false);

  const startNew = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  };
  const startEdit = (a: Account) => {
    setEditing(a);
    setDraft({
      number: a.number,
      name: a.name,
      type: a.type,
      resultKind: a.resultKind ?? "income",
      balanceKind: a.balanceKind ?? "liquid",
      showInNotes: a.showInNotes ?? false,
    });
    setOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) return;
    const payload: Partial<Account> = {
      number: draft.number.trim(),
      name: draft.name.trim(),
      type: draft.type,
      resultKind: draft.type === "result" ? draft.resultKind : undefined,
      balanceKind: draft.type === "balance" ? draft.balanceKind : undefined,
      showInNotes: draft.showInNotes,
    };
    if (editing) {
      store.updateAccount(editing.id, payload);
    } else {
      store.addAccount({ ...(payload as Omit<Account, "id" | "sortOrder">), active: true });
    }
    setOpen(false);
  };

  const balance = accounts.filter((a) => a.type === "balance");
  const result = accounts.filter((a) => a.type === "result");

  return (
    <div>
      <PageHeader
        title="Kontoplan"
        subtitle="Balansekontoer bærer saldo mellom år. Resultatkontoer nullstilles hvert år."
        actions={
          <button className="btn-primary" onClick={startNew}>
            + Ny konto
          </button>
        }
      />

      <Section
        title="Balansekontoer"
        note="Kasse, bank, Vipps og Anleggsmidler. Inngående/Utgående balanse vises for valgt år."
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Nr</th>
              <th className="px-3 py-2">Konto</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Inngående balanse</th>
              <th className="px-3 py-2 text-right">Utgående balanse</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {balance.map((a) => (
              <tr
                key={a.id}
                className={`border-b border-slate-100 ${a.active ? "" : "opacity-50"}`}
              >
                <td className="px-3 py-2 text-slate-400">{a.number}</td>
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2 text-slate-500">
                  {a.balanceKind === "fixedAsset" ? "Anleggsmiddel" : "Likvid"}
                </td>
                <td className="px-3 py-2 text-right num">
                  <OpeningBalanceCell
                    accountId={a.id}
                    yearId={currentYearId}
                    locked={!!state.years.find((y) => y.id === currentYearId)?.locked}
                  />
                </td>
                <td className="px-3 py-2 text-right num font-medium">
                  {formatKr(closingBalance(state, currentYearId, a.id))}
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions account={a} onEdit={() => startEdit(a)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="Resultatkontoer"
        note="Inntekter og kostnader. Nullstilles ved hvert årsskifte."
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Nr</th>
              <th className="px-3 py-2">Konto</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Periodens netto</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {result.map((a) => (
              <tr
                key={a.id}
                className={`border-b border-slate-100 ${a.active ? "" : "opacity-50"}`}
              >
                <td className="px-3 py-2 text-slate-400">{a.number}</td>
                <td className="px-3 py-2 font-medium">
                  {a.name}
                  {a.showInNotes && (
                    <span className="badge ml-2 bg-slate-100 text-slate-500">
                      Note
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {a.resultKind === "expense" ? "Kostnad" : "Inntekt"}
                </td>
                <td className="px-3 py-2 text-right num font-medium">
                  {formatKr(closingBalance(state, currentYearId, a.id))}
                </td>
                <td className="px-3 py-2 text-right">
                  <RowActions account={a} onEdit={() => startEdit(a)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Modal
        open={open}
        title={editing ? "Rediger konto" : "Ny konto"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Avbryt
            </button>
            <button className="btn-primary" onClick={save}>
              Lagre
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Kontonummer</label>
            <input
              className="input"
              value={draft.number}
              onChange={(e) => setDraft({ ...draft, number: e.target.value })}
              placeholder="f.eks. 1920"
            />
          </div>
          <div>
            <label className="label">Navn</label>
            <input
              className="input"
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="f.eks. Bedriftskonto"
            />
          </div>
          <div>
            <label className="label">Kontotype</label>
            <select
              className="input"
              value={draft.type}
              onChange={(e) =>
                setDraft({ ...draft, type: e.target.value as AccountType })
              }
            >
              <option value="balance">Balansekonto</option>
              <option value="result">Resultatkonto</option>
            </select>
          </div>
          <div>
            {draft.type === "balance" ? (
              <>
                <label className="label">Underart</label>
                <select
                  className="input"
                  value={draft.balanceKind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      balanceKind: e.target.value as BalanceKind,
                    })
                  }
                >
                  <option value="liquid">Likvid (bank/kasse/Vipps)</option>
                  <option value="fixedAsset">Anleggsmiddel (Eiendeler)</option>
                </select>
              </>
            ) : (
              <>
                <label className="label">Resultattype</label>
                <select
                  className="input"
                  value={draft.resultKind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      resultKind: e.target.value as ResultKind,
                    })
                  }
                >
                  <option value="income">Inntekt</option>
                  <option value="expense">Kostnad</option>
                </select>
              </>
            )}
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={draft.showInNotes}
            onChange={(e) =>
              setDraft({ ...draft, showInNotes: e.target.checked })
            }
          />
          Lag egen note (inntekter netto mot kostnader) for denne kontoen
        </label>
      </Modal>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-6 overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <p className="text-xs text-slate-400">{note}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function RowActions({
  account,
  onEdit,
}: {
  account: Account;
  onEdit: () => void;
}) {
  const store = useStore();
  return (
    <div className="flex justify-end gap-1">
      <button className="btn-ghost px-2 py-1" onClick={onEdit}>
        Rediger
      </button>
      <button
        className="btn-ghost px-2 py-1"
        onClick={() =>
          store.updateAccount(account.id, { active: !account.active })
        }
      >
        {account.active ? "Deaktiver" : "Aktiver"}
      </button>
    </div>
  );
}

function OpeningBalanceCell({
  accountId,
  yearId,
  locked,
}: {
  accountId: string;
  yearId: string;
  locked: boolean;
}) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const current = openingBalance(store.state, yearId, accountId);
  const [val, setVal] = useState(current);

  if (locked || !editing) {
    return (
      <button
        className="rounded px-2 py-0.5 text-right hover:bg-slate-100 disabled:hover:bg-transparent"
        disabled={locked}
        onClick={() => {
          setVal(current);
          setEditing(true);
        }}
        title={locked ? "Låst år" : "Klikk for å endre inngående balanse"}
      >
        {formatKr(current)}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <div className="w-28">
        <MoneyInput value={val} onChange={setVal} autoFocus />
      </div>
      <button
        className="btn-ghost px-2 py-1"
        onClick={() => {
          store.setOpeningBalance(yearId, accountId, val);
          setEditing(false);
        }}
      >
        ✓
      </button>
    </div>
  );
}
