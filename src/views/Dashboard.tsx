import { useState } from "react";
import { useStore } from "../store";
import type { Tab } from "../App";
import {
  accountsSorted,
  balanceControl,
  buildStatement,
  closingBalance,
  getYear,
  unpaidHouseholds,
} from "../domain/engine";
import { formatKr } from "../domain/money";
import { PageHeader, StatCard } from "../components/ui";

export function Dashboard({ goto }: { goto: (t: Tab) => void }) {
  const store = useStore();
  const { state, currentYearId } = store;
  const year = getYear(state, currentYearId)!;
  const accounts = accountsSorted(state);
  const liquid = accounts.filter(
    (a) => a.type === "balance" && a.balanceKind !== "fixedAsset" && a.active,
  );
  const fixed = accounts.filter(
    (a) => a.type === "balance" && a.balanceKind === "fixedAsset" && a.active,
  );
  const statement = buildStatement(state, currentYearId);
  const control = balanceControl(state, currentYearId);
  const unpaid = unpaidHouseholds(
    state,
    currentYearId,
    state.settings.standardKontingent,
  );
  const totalLiquid = liquid.reduce(
    (s, a) => s + closingBalance(state, currentYearId, a.id),
    0,
  );

  const [name, setName] = useState(state.settings.associationName);
  const [editName, setEditName] = useState(false);

  return (
    <div>
      <PageHeader
        title="Dashbord"
        subtitle={`Oversikt for regnskapsår ${year.label}`}
        actions={
          editName ? (
            <div className="flex gap-2">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <button
                className="btn-primary"
                onClick={() => {
                  store.updateSettings({ associationName: name.trim() || "Velforeningen" });
                  setEditName(false);
                }}
              >
                Lagre
              </button>
            </div>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => {
                setName(state.settings.associationName);
                setEditName(true);
              }}
            >
              Endre foreningsnavn
            </button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Likvide midler"
          value={formatKr(totalLiquid)}
          hint="Bank, kasse, Vipps"
        />
        <StatCard
          label="Årsresultat hittil"
          value={formatKr(statement.yearResult)}
          tone={statement.yearResult >= 0 ? "good" : "bad"}
          hint="Inntekter − kostnader − avskrivning"
        />
        <StatCard
          label="Ikke betalt kontingent"
          value={String(unpaid.length)}
          tone={unpaid.length ? "warn" : "good"}
          hint={`av ${state.households.filter((h) => h.status === "Innmeldt").length} husstander`}
        />
        <StatCard
          label="Balansekontroll"
          value={control.balanced ? "OK ✓" : "Avvik"}
          tone={control.balanced ? "good" : "bad"}
          hint={control.balanced ? "Debet = kredit" : formatKr(control.diff)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Saldo per konto
            </h2>
            <button
              className="btn-ghost px-2 py-1 text-xs"
              onClick={() => goto("kontoplan")}
            >
              Kontoplan →
            </button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {liquid.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-right num font-medium">
                    {formatKr(closingBalance(state, currentYearId, a.id))}
                  </td>
                </tr>
              ))}
              {fixed.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-500">{a.name}</td>
                  <td className="py-1.5 text-right num">
                    {formatKr(closingBalance(state, currentYearId, a.id))}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-300">
                <td className="py-1.5 font-semibold">Sum eiendeler</td>
                <td className="py-1.5 text-right num font-semibold">
                  {formatKr(statement.totalClosingAssets)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Resultat hittil i {year.label}
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5">Netto inntekter</td>
                <td className="py-1.5 text-right num">
                  {formatKr(statement.totalIncome)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5">Netto kostnader</td>
                <td className="py-1.5 text-right num text-rose-600">
                  -{formatKr(statement.totalCosts)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5">Avskrivninger</td>
                <td className="py-1.5 text-right num text-rose-600">
                  -{formatKr(statement.totalDepreciation)}
                </td>
              </tr>
              <tr className="border-t border-slate-300">
                <td className="py-1.5 font-semibold">Årsresultat</td>
                <td
                  className={`py-1.5 text-right num font-semibold ${
                    statement.yearResult >= 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {formatKr(statement.yearResult)}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => goto("bilag")}>
              Før bilag
            </button>
            <button
              className="btn-secondary"
              onClick={() => goto("arsoppstilling")}
            >
              Årsoppstilling
            </button>
            <button
              className="btn-secondary"
              onClick={() => goto("arsavslutning")}
            >
              Årsavslutning
            </button>
          </div>
        </div>
      </div>

      {unpaid.length > 0 && (
        <div className="card mt-5 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Mangler kontingent for {year.label}
            </h2>
            <button
              className="btn-ghost px-2 py-1 text-xs"
              onClick={() => goto("reskontro")}
            >
              Reskontro →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {unpaid.slice(0, 12).map((h) => (
              <span key={h.id} className="badge bg-amber-100 text-amber-800">
                {h.primaryMember}
              </span>
            ))}
            {unpaid.length > 12 && (
              <span className="badge bg-slate-100 text-slate-500">
                +{unpaid.length - 12} til
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
