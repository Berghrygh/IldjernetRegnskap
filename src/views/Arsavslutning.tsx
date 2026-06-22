import { useState } from "react";
import { useStore } from "../store";
import type { Tab } from "../App";
import {
  accountsSorted,
  balanceControl,
  buildStatement,
  closingBalance,
  getYear,
} from "../domain/engine";
import { formatKr } from "../domain/money";
import { PageHeader, StatCard } from "../components/ui";

export function Arsavslutning({ goto }: { goto: (t: Tab) => void }) {
  const store = useStore();
  const { state, currentYearId } = store;
  const year = getYear(state, currentYearId)!;
  const control = balanceControl(state, currentYearId);
  const statement = buildStatement(state, currentYearId);
  const accounts = accountsSorted(state);
  const balanceAccts = accounts.filter((a) => a.type === "balance");

  const pendingDepreciation = state.assets.filter((a) => {
    if (!a.active) return false;
    const already = a.events.some(
      (e) =>
        e.type === "depreciation" &&
        e.date >= year.startDate &&
        e.date <= year.endDate,
    );
    return !already;
  });

  const [step, setStep] = useState(1);
  const nextStart = Number(currentYearId.split("-")[0]) + 1;
  const nextLabel = `${nextStart}/${nextStart + 1}`;

  const runDep = () => {
    const n = store.runDepreciation(currentYearId);
    window.alert(
      n > 0
        ? `Avskrivning bokført for ${n} anleggsmiddel/midler.`
        : "Ingen nye avskrivninger å bokføre.",
    );
  };

  const close = () => {
    if (
      window.confirm(
        `Låse ${year.label} og overføre utgående saldoer som inngående balanse i ${nextLabel}?`,
      )
    ) {
      store.closeYear(currentYearId);
      goto("dashboard");
    }
  };

  if (year.locked) {
    return (
      <div>
        <PageHeader title="Årsavslutning" subtitle={`Regnskapsår ${year.label}`} />
        <div className="card p-6 text-center">
          <p className="text-slate-600">
            Regnskapsåret {year.label} er allerede låst og avsluttet.
          </p>
          <button
            className="btn-secondary mt-4"
            onClick={() => store.unlockYear(currentYearId)}
          >
            Lås opp igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Årsavslutning"
        subtitle={`Guidet avslutning av regnskapsår ${year.label}.`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Balansekontroll"
          value={control.balanced ? "OK ✓" : "Avvik"}
          tone={control.balanced ? "good" : "bad"}
        />
        <StatCard
          label="Kontroll årsoppstilling"
          value={statement.controlOk ? "OK ✓" : "Avvik"}
          tone={statement.controlOk ? "good" : "bad"}
        />
        <StatCard
          label="Årsresultat"
          value={formatKr(statement.yearResult)}
          tone={statement.yearResult >= 0 ? "good" : "bad"}
        />
      </div>

      <ol className="space-y-4">
        <Step
          n={1}
          active={step === 1}
          done={step > 1}
          title="Avskrivninger"
          onActivate={() => setStep(1)}
        >
          <p className="mb-3 text-sm text-slate-600">
            {pendingDepreciation.length > 0
              ? `${pendingDepreciation.length} anleggsmiddel/midler mangler avskrivning for ${year.label}.`
              : "Alle aktive anleggsmidler har avskrivning for året."}
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={runDep}>
              Kjør 10 % avskrivning
            </button>
            <button className="btn-primary" onClick={() => setStep(2)}>
              Neste: gjennomgå
            </button>
          </div>
        </Step>

        <Step
          n={2}
          active={step === 2}
          done={step > 2}
          title="Gjennomgå årsoppstilling"
          onActivate={() => setStep(2)}
        >
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Mini label="Inngående" value={statement.totalOpeningAssets} />
            <Mini label="Inntekter" value={statement.totalIncome} />
            <Mini label="Kostnader" value={statement.totalCosts} />
            <Mini label="Avskrivninger" value={statement.totalDepreciation} />
          </div>
          {!control.balanced || !statement.controlOk ? (
            <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Det finnes avvik i kontrollene. Gå til Bilagsføring/Årsoppstilling
              og rett opp før du låser året.
            </p>
          ) : (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Begge kontroller går opp. Klar for å låse året.
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => goto("arsoppstilling")}
            >
              Åpne full årsoppstilling
            </button>
            <button className="btn-primary" onClick={() => setStep(3)}>
              Neste: lås og overfør
            </button>
          </div>
        </Step>

        <Step
          n={3}
          active={step === 3}
          done={false}
          title="Lås år og overfør saldoer"
          onActivate={() => setStep(3)}
        >
          <p className="mb-3 text-sm text-slate-600">
            Utgående balanse for balansekontoene overføres som inngående balanse
            i {nextLabel}. Året låses mot videre føring (kan låses opp ved behov).
          </p>
          <table className="mb-4 w-full max-w-md text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5">Konto</th>
                <th className="py-1.5 text-right">Overføres som IB</th>
              </tr>
            </thead>
            <tbody>
              {balanceAccts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-right num">
                    {formatKr(closingBalance(state, currentYearId, a.id))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="btn-primary"
            disabled={!control.balanced || !statement.controlOk}
            onClick={close}
          >
            Lås {year.label} og åpne {nextLabel}
          </button>
          {(!control.balanced || !statement.controlOk) && (
            <p className="mt-2 text-xs text-rose-600">
              Kan ikke låse året så lenge kontrollene viser avvik.
            </p>
          )}
        </Step>
      </ol>
    </div>
  );
}

function Step({
  n,
  title,
  active,
  done,
  onActivate,
  children,
}: {
  n: number;
  title: string;
  active: boolean;
  done: boolean;
  onActivate: () => void;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`card overflow-hidden ${active ? "ring-2 ring-brand-300" : ""}`}
    >
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={onActivate}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
            done
              ? "bg-emerald-100 text-emerald-700"
              : active
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {done ? "✓" : n}
        </span>
        <span className="font-semibold text-slate-700">{title}</span>
      </button>
      {active && <div className="border-t border-slate-200 px-4 py-4">{children}</div>}
    </li>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="num font-semibold text-slate-800">{formatKr(value)}</div>
    </div>
  );
}
