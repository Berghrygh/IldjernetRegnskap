import { useStore } from "../store";
import { buildStatement, getYear } from "../domain/engine";
import { formatKr } from "../domain/money";
import { printReport } from "../lib/exporters";
import { PageHeader } from "../components/ui";

export function Arsoppstilling() {
  const store = useStore();
  const { state, currentYearId } = store;
  const year = getYear(state, currentYearId)!;
  const s = buildStatement(state, currentYearId);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Årsoppstilling"
          subtitle={`Regnskapsår ${year.label} (01.04.${year.startDate.slice(0, 4)} – 31.03.${year.endDate.slice(0, 4)})`}
          actions={
            <button className="btn-secondary" onClick={printReport}>
              Skriv ut / PDF
            </button>
          }
        />
      </div>

      <div className="print-area card mx-auto max-w-3xl p-6">
        <div className="mb-5 border-b border-slate-200 pb-3 text-center">
          <h1 className="text-lg font-bold text-slate-800">
            {state.settings.associationName} – Årsoppstilling
          </h1>
          <p className="text-sm text-slate-500">Regnskapsår {year.label}</p>
        </div>

        {/* Opening assets */}
        <SectionTitle>Inngående balanse (eiendeler)</SectionTitle>
        <table className="mb-4 w-full text-sm">
          <tbody>
            {s.liquidOpening.map((l) => (
              <Row
                key={l.account.id}
                label={l.account.name}
                value={l.opening}
              />
            ))}
            <Row label="Anleggsmidler" value={s.fixedAssetOpening} />
            <Row label="Sum inngående balanse" value={s.totalOpeningAssets} bold border />
          </tbody>
        </table>

        {/* Income */}
        <SectionTitle>Inntekter</SectionTitle>
        <table className="mb-4 w-full text-sm">
          <tbody>
            {s.income.length === 0 && <EmptyRow />}
            {s.income.map((l) => (
              <Row key={l.account.id} label={l.account.name} value={l.net} />
            ))}
            <Row label="Netto inntekter" value={s.totalIncome} bold border />
          </tbody>
        </table>

        {/* Costs */}
        <SectionTitle>Kostnader</SectionTitle>
        <table className="mb-4 w-full text-sm">
          <tbody>
            {s.costs.length === 0 && <EmptyRow />}
            {s.costs.map((l) => (
              <Row
                key={l.account.id}
                label={l.account.name}
                value={l.net}
                negative
              />
            ))}
            <Row
              label="Netto kostnader"
              value={s.totalCosts}
              bold
              border
              negative
            />
          </tbody>
        </table>

        {/* Result */}
        <table className="mb-4 w-full text-sm">
          <tbody>
            <Row
              label="Resultat før avskrivninger"
              value={s.resultBeforeDepreciation}
              bold
            />
            {s.depreciationLines.map((l) => (
              <Row
                key={l.account.id}
                label={l.account.name}
                value={l.net}
                negative
              />
            ))}
            <Row
              label="Årsresultat"
              value={s.yearResult}
              bold
              border
              tone={s.yearResult >= 0 ? "good" : "bad"}
            />
          </tbody>
        </table>

        {/* Closing assets */}
        <SectionTitle>Utgående balanse (eiendeler)</SectionTitle>
        <table className="mb-4 w-full text-sm">
          <tbody>
            {s.liquidClosing.map((l) => (
              <Row key={l.account.id} label={l.account.name} value={l.closing} />
            ))}
            <Row label="Anleggsmidler" value={s.fixedAssetClosing} />
            <Row
              label="Sum utgående balanse"
              value={s.totalClosingAssets}
              bold
              border
            />
          </tbody>
        </table>

        {/* Control block */}
        <div
          className={`mt-6 rounded-lg border p-4 text-sm ${
            s.controlOk
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
          }`}
        >
          <div className="mb-2 font-semibold text-slate-700">Kontroll</div>
          <table className="w-full">
            <tbody>
              <Row label="Inngående balanse" value={s.totalOpeningAssets} />
              <Row label="+ Årsresultat" value={s.yearResult} />
              {s.correction !== 0 && (
                <Row label="± Korrigeringer" value={s.correction} />
              )}
              <Row
                label="= Beregnet utgående balanse"
                value={s.totalOpeningAssets + s.yearResult + s.correction}
                border
              />
              <Row
                label="Faktisk utgående balanse"
                value={s.totalClosingAssets}
              />
              <Row
                label="Differanse"
                value={
                  s.totalClosingAssets -
                  (s.totalOpeningAssets + s.yearResult + s.correction)
                }
                bold
                tone={s.controlOk ? "good" : "bad"}
              />
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            {s.controlOk
              ? "Regnskapet går opp: inngående balanse + årsresultat = utgående balanse."
              : "Avvik oppdaget. Kontroller bilag og åpningsbalanser."}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

function EmptyRow() {
  return (
    <tr>
      <td className="py-1 text-slate-400">Ingen poster.</td>
      <td />
    </tr>
  );
}

function Row({
  label,
  value,
  bold,
  border,
  negative,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  border?: boolean;
  negative?: boolean;
  tone?: "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-rose-700"
        : "";
  return (
    <tr className={border ? "border-t border-slate-300" : ""}>
      <td className={`py-1 ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td
        className={`py-1 text-right num ${bold ? "font-semibold" : ""} ${toneClass}`}
      >
        {negative && value !== 0 ? `-${formatKr(value)}` : formatKr(value)}
      </td>
    </tr>
  );
}
