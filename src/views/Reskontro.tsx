import { useState } from "react";
import { useStore } from "../store";
import type { Account, Household, MemberStatus } from "../domain/types";
import {
  accountsSorted,
  getYear,
  kontingentRecon,
  unpaidHouseholds,
} from "../domain/engine";
import { formatKr } from "../domain/money";
import { todayIso } from "../domain/dates";
import { PageHeader, StatCard, EmptyState } from "../components/ui";
import { Modal } from "../components/Modal";
import { MoneyInput } from "../components/MoneyInput";
import { AccountSelect } from "../components/AccountSelect";

export function Reskontro() {
  const store = useStore();
  const { state, currentYearId } = store;
  const standard = state.settings.standardKontingent;
  const years = [...state.years].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const households = [...state.households].sort((a, b) =>
    a.primaryMember.localeCompare(b.primaryMember, "nb"),
  );
  const recon = kontingentRecon(state, currentYearId);
  const unpaid = unpaidHouseholds(state, currentYearId, standard);

  const [editHh, setEditHh] = useState<Household | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [recordFor, setRecordFor] = useState<Household | null>(null);

  return (
    <div>
      <PageHeader
        title="Reskontro"
        subtitle="Medlemsregister og kontingent per husstand per år."
        actions={
          <button className="btn-primary" onClick={() => setNewOpen(true)}>
            + Ny husstand
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Husstander"
          value={String(households.filter((h) => h.status === "Innmeldt").length)}
          hint="Innmeldte"
        />
        <StatCard
          label="Ikke betalt"
          value={String(unpaid.length)}
          hint={`for ${getYear(state, currentYearId)?.label ?? ""}`}
          tone={unpaid.length ? "warn" : "good"}
        />
        <StatCard
          label="Registrert betalt"
          value={formatKr(recon.registeredPaid)}
          hint="Sum i reskontro"
        />
        <StatCard
          label="Bokført kontingent"
          value={formatKr(recon.bookedIncome)}
          hint={recon.matches ? "Stemmer ✓" : "Avvik mot reskontro"}
          tone={recon.matches ? "good" : "bad"}
        />
      </div>

      {!recon.matches && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          Avvik mellom bokført kontingent og registrerte innbetalinger:{" "}
          <span className="num font-medium">{formatKr(recon.diff)}</span>. Kontroller
          at alle kontingentbilag er ført og koblet til riktig husstand.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 bg-white px-3 py-2">Husstand</th>
                <th className="px-3 py-2">Enhet</th>
                <th className="px-3 py-2">Status</th>
                {years.map((y) => (
                  <th
                    key={y.id}
                    className={`px-3 py-2 text-right ${
                      y.id === currentYearId ? "bg-brand-50 text-brand-700" : ""
                    }`}
                  >
                    {y.label}
                  </th>
                ))}
                <th className="px-3 py-2">Notat</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {households.length === 0 && (
                <tr>
                  <td colSpan={6 + years.length} className="px-3 py-8">
                    <EmptyState>Ingen husstander registrert ennå.</EmptyState>
                  </td>
                </tr>
              )}
              {households.map((h) => (
                <tr key={h.id} className="border-b border-slate-100 align-top">
                  <td className="sticky left-0 bg-white px-3 py-2">
                    <div className="font-medium">{h.primaryMember}</div>
                    {h.partner && (
                      <div className="text-xs text-slate-500">{h.partner}</div>
                    )}
                    <div className="text-xs text-slate-400">{h.address}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{h.unit}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`badge ${
                        h.status === "Innmeldt"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {h.status}
                      {h.statusYear ? ` ${h.statusYear}` : ""}
                    </span>
                  </td>
                  {years.map((y) => (
                    <PaymentCell
                      key={y.id}
                      household={h}
                      yearId={y.id}
                      isCurrent={y.id === currentYearId}
                      standard={standard}
                    />
                  ))}
                  <td className="px-3 py-2 text-xs text-slate-500">{h.notes}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {h.status === "Innmeldt" &&
                        !state.years.find((y) => y.id === currentYearId)?.locked && (
                          <button
                            className="btn-ghost px-2 py-1"
                            onClick={() => setRecordFor(h)}
                          >
                            Bokfør kontingent
                          </button>
                        )}
                      <button
                        className="btn-ghost px-2 py-1"
                        onClick={() => setEditHh(h)}
                      >
                        Rediger
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unpaid.length > 0 && (
        <div className="card mt-5 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Utestående for {getYear(state, currentYearId)?.label}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {unpaid.map((h) => (
              <li
                key={h.id}
                className="badge bg-amber-100 text-amber-800"
              >
                {h.primaryMember} {h.unit ? `(${h.unit})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(newOpen || editHh) && (
        <HouseholdModal
          household={editHh}
          onClose={() => {
            setNewOpen(false);
            setEditHh(null);
          }}
        />
      )}
      {recordFor && (
        <RecordKontingentModal
          household={recordFor}
          accounts={accountsSorted(state)}
          yearId={currentYearId}
          onClose={() => setRecordFor(null)}
        />
      )}
    </div>
  );
}

function PaymentCell({
  household,
  yearId,
  isCurrent,
  standard,
}: {
  household: Household;
  yearId: string;
  isCurrent: boolean;
  standard: number;
}) {
  const store = useStore();
  const locked = !!store.state.years.find((y) => y.id === yearId)?.locked;
  const payment = household.payments[yearId];
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(payment?.amount ?? standard);

  const paid = payment && payment.amount > 0;
  const linked = !!payment?.voucherId;

  if (editing && !locked) {
    return (
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <div className="w-24">
            <MoneyInput value={val} onChange={setVal} autoFocus />
          </div>
          <button
            className="btn-ghost px-1.5 py-1"
            onClick={() => {
              store.setPayment(household.id, yearId, val, payment?.voucherId);
              setEditing(false);
            }}
          >
            ✓
          </button>
        </div>
      </td>
    );
  }

  return (
    <td
      className={`px-3 py-2 text-right num ${isCurrent ? "bg-brand-50/40" : ""}`}
    >
      <button
        className="rounded px-1.5 py-0.5 hover:bg-slate-100 disabled:hover:bg-transparent"
        disabled={locked}
        title={
          linked
            ? "Koblet til bokført bilag"
            : "Klikk for å registrere betalt beløp"
        }
        onClick={() => {
          setVal(payment?.amount ?? standard);
          setEditing(true);
        }}
      >
        {paid ? (
          <span className={linked ? "text-emerald-700" : "text-slate-700"}>
            {formatKr(payment!.amount)}
            {linked ? " 🔗" : ""}
          </span>
        ) : (
          <span className="text-slate-300">–</span>
        )}
      </button>
    </td>
  );
}

function HouseholdModal({
  household,
  onClose,
}: {
  household: Household | null;
  onClose: () => void;
}) {
  const store = useStore();
  const [primaryMember, setPrimary] = useState(household?.primaryMember ?? "");
  const [partner, setPartner] = useState(household?.partner ?? "");
  const [address, setAddress] = useState(household?.address ?? "");
  const [unit, setUnit] = useState(household?.unit ?? "");
  const [status, setStatus] = useState<MemberStatus>(
    household?.status ?? "Innmeldt",
  );
  const [statusYear, setStatusYear] = useState(
    household?.statusYear ?? new Date().getFullYear(),
  );
  const [notes, setNotes] = useState(household?.notes ?? "");

  const save = () => {
    if (!primaryMember.trim()) return;
    const payload = {
      primaryMember: primaryMember.trim(),
      partner: partner.trim() || undefined,
      address: address.trim(),
      unit: unit.trim() || undefined,
      status,
      statusYear,
      notes: notes.trim(),
    };
    if (household) store.updateHousehold(household.id, payload);
    else store.addHousehold(payload);
    onClose();
  };

  return (
    <Modal
      open
      title={household ? "Rediger husstand" : "Ny husstand"}
      onClose={onClose}
      footer={
        <>
          {household && (
            <button
              className="btn-danger mr-auto"
              onClick={() => {
                if (window.confirm("Slette denne husstanden?")) {
                  store.deleteHousehold(household.id);
                  onClose();
                }
              }}
            >
              Slett
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
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
          <label className="label">Hovedmedlem</label>
          <input
            className="input"
            value={primaryMember}
            autoFocus
            onChange={(e) => setPrimary(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Medmedlem / partner</label>
          <input
            className="input"
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Enhet / hyttenr</label>
          <input
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as MemberStatus)}
          >
            <option value="Innmeldt">Innmeldt</option>
            <option value="Utmeldt">Utmeldt</option>
          </select>
        </div>
        <div>
          <label className="label">År (inn-/utmeldt)</label>
          <input
            type="number"
            className="input"
            value={statusYear}
            onChange={(e) => setStatusYear(Number(e.target.value))}
          />
        </div>
        <div className="col-span-2">
          <label className="label">Notat</label>
          <textarea
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Purring, dobbeltbetaling, refusjon…"
          />
        </div>
      </div>
    </Modal>
  );
}

function RecordKontingentModal({
  household,
  accounts,
  yearId,
  onClose,
}: {
  household: Household;
  accounts: Account[];
  yearId: string;
  onClose: () => void;
}) {
  const store = useStore();
  const { state } = store;
  const banks = accounts.filter(
    (a) => a.type === "balance" && a.balanceKind !== "fixedAsset" && a.active,
  );
  const kontoId = state.settings.kontingentAccountId;
  const year = getYear(state, yearId);
  const [date, setDate] = useState(todayIso());
  const [bank, setBank] = useState(banks[0]?.id ?? "");
  const [amount, setAmount] = useState(state.settings.standardKontingent);
  const [error, setError] = useState("");

  const submit = () => {
    if (!kontoId)
      return setError("Ingen kontingentkonto er valgt i innstillingene.");
    if (!bank) return setError("Velg konto pengene kom inn på.");
    if (!(amount > 0)) return setError("Beløpet må være større enn 0.");
    store.recordKontingent(household.id, yearId, {
      date,
      description: `Kontingent ${year?.label ?? ""} – ${household.primaryMember}`,
      amount,
      debitAccountId: bank,
      creditAccountId: kontoId,
    });
    onClose();
  };

  return (
    <Modal
      open
      title={`Bokfør kontingent – ${household.primaryMember}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-primary" onClick={submit}>
            Bokfør og marker betalt
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Oppretter et kontingentbilag (debet bank, kredit Kontingent) og markerer
        husstanden som betalt for {year?.label}. Kontingent regnskapsføres i det
        året innbetalingen registreres (kontantprinsipp).
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
          <label className="label">Beløp</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div className="col-span-2">
          <label className="label">Penger inn på konto</label>
          <AccountSelect accounts={banks} value={bank} onChange={setBank} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
}
