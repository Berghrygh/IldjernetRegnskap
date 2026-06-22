import { useStore } from "../store";
import type { Account } from "../domain/types";
import {
  accountMovement,
  accountsSorted,
  assetSchedule,
  getAccount,
  getYear,
  vouchersForYear,
} from "../domain/engine";
import { formatKr, round2 } from "../domain/money";
import { formatDate } from "../domain/dates";
import { printReport } from "../lib/exporters";
import { PageHeader } from "../components/ui";

export function Noter() {
  const store = useStore();
  const { state, currentYearId } = store;
  const year = getYear(state, currentYearId)!;
  const accounts = accountsSorted(state);
  const noteAccounts = accounts.filter((a) => a.showInNotes && a.active);
  const schedules = state.assets.map((a) => assetSchedule(a, year));
  const hasAssets = schedules.some(
    (sc) =>
      sc.openingValue || sc.addition || sc.depreciation || sc.writedown,
  );

  const totals = schedules.reduce(
    (t, sc) => ({
      opening: t.opening + sc.openingValue,
      addition: t.addition + sc.addition,
      depreciation: t.depreciation + sc.depreciation,
      writedown: t.writedown + sc.writedown,
      closing: t.closing + sc.closingValue,
    }),
    { opening: 0, addition: 0, depreciation: 0, writedown: 0, closing: 0 },
  );

  let noteNo = 0;
  const nextNote = () => ++noteNo;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Noter"
          subtitle={`Spesifikasjoner til årsoppstillingen for ${year.label}.`}
          actions={
            <button className="btn-secondary" onClick={printReport}>
              Skriv ut / PDF
            </button>
          }
        />
      </div>

      <div className="print-area mx-auto max-w-3xl space-y-5">
        {/* Note: kontingent principle */}
        <NoteCard n={nextNote()} title="Kontingent – regnskapsprinsipp">
          <p className="text-sm text-slate-600">
            Kontingent inntektsføres etter kontantprinsippet, det vil si i det
            regnskapsåret innbetalingen registreres. Krav som ikke er betalt ved
            årets slutt, er ikke inntektsført og fremgår av reskontroen som
            utestående.
          </p>
        </NoteCard>

        {/* Note: fixed assets schedule */}
        {hasAssets && (
          <NoteCard n={nextNote()} title="Anleggsmidler og avskrivninger">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1.5">Anleggsmiddel</th>
                  <th className="py-1.5 text-right">IB</th>
                  <th className="py-1.5 text-right">Tilgang</th>
                  <th className="py-1.5 text-right">Avskrivning</th>
                  <th className="py-1.5 text-right">Bortskr.</th>
                  <th className="py-1.5 text-right">UB</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((sc) => (
                  <tr key={sc.asset.id} className="border-b border-slate-100">
                    <td className="py-1.5">{sc.asset.name}</td>
                    <td className="py-1.5 text-right num">
                      {formatKr(sc.openingValue)}
                    </td>
                    <td className="py-1.5 text-right num">
                      {formatKr(sc.addition)}
                    </td>
                    <td className="py-1.5 text-right num text-rose-600">
                      {sc.depreciation ? `-${formatKr(sc.depreciation)}` : "–"}
                    </td>
                    <td className="py-1.5 text-right num text-rose-600">
                      {sc.writedown ? `-${formatKr(sc.writedown)}` : "–"}
                    </td>
                    <td className="py-1.5 text-right num font-medium">
                      {formatKr(sc.closingValue)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <td className="py-1.5">Sum</td>
                  <td className="py-1.5 text-right num">
                    {formatKr(totals.opening)}
                  </td>
                  <td className="py-1.5 text-right num">
                    {formatKr(totals.addition)}
                  </td>
                  <td className="py-1.5 text-right num text-rose-600">
                    {totals.depreciation
                      ? `-${formatKr(totals.depreciation)}`
                      : "–"}
                  </td>
                  <td className="py-1.5 text-right num text-rose-600">
                    {totals.writedown ? `-${formatKr(totals.writedown)}` : "–"}
                  </td>
                  <td className="py-1.5 text-right num">
                    {formatKr(totals.closing)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              Avskrivning beregnes lineært med 10 % per år.
            </p>
          </NoteCard>
        )}

        {/* Itemised notes for flagged accounts (income netted vs costs) */}
        {noteAccounts.map((acc) => (
          <AccountNote
            key={acc.id}
            n={nextNote()}
            account={acc}
            yearId={currentYearId}
          />
        ))}
      </div>
    </div>
  );
}

function AccountNote({
  n,
  account,
  yearId,
}: {
  n: number;
  account: Account;
  yearId: string;
}) {
  const store = useStore();
  const { state } = store;
  const lines = vouchersForYear(state, yearId).filter(
    (v) => v.debitAccountId === account.id || v.creditAccountId === account.id,
  );
  const mv = accountMovement(state, yearId, account.id);

  // For result accounts: credit = income, debit = cost.
  // For balance accounts (e.g. Vipps): show throughput in/out.
  const isResult = account.type === "result";
  const income = round2(mv.credit);
  const cost = round2(mv.debit);
  const net = round2(income - cost);

  return (
    <NoteCard n={n} title={`${account.name}`}>
      {lines.length === 0 ? (
        <p className="text-sm text-slate-400">Ingen bevegelser i året.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1.5">Dato</th>
              <th className="py-1.5">Bilag</th>
              <th className="py-1.5">Tekst</th>
              <th className="py-1.5 text-right">
                {isResult ? "Inntekt" : "Inn"}
              </th>
              <th className="py-1.5 text-right">
                {isResult ? "Kostnad" : "Ut"}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((v) => {
              const inn = v.creditAccountId === account.id ? v.amount : 0;
              const ut = v.debitAccountId === account.id ? v.amount : 0;
              const counter =
                v.creditAccountId === account.id
                  ? getAccount(state, v.debitAccountId)
                  : getAccount(state, v.creditAccountId);
              return (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="py-1.5 num">{formatDate(v.date)}</td>
                  <td className="py-1.5 num text-slate-400">{v.number}</td>
                  <td className="py-1.5">
                    {v.description}
                    {counter && (
                      <span className="text-xs text-slate-400">
                        {" "}
                        ({counter.name})
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right num">
                    {inn ? formatKr(inn) : "–"}
                  </td>
                  <td className="py-1.5 text-right num">
                    {ut ? formatKr(ut) : "–"}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-slate-300 font-semibold">
              <td className="py-1.5" colSpan={3}>
                {isResult ? "Netto" : "Netto bevegelse"}
              </td>
              <td className="py-1.5 text-right num">{formatKr(income)}</td>
              <td className="py-1.5 text-right num">{formatKr(cost)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {isResult && (
        <p className="mt-2 text-sm font-medium text-slate-700">
          Netto {account.resultKind === "expense" ? "kostnad" : "resultat"}:{" "}
          <span className="num">{formatKr(account.resultKind === "expense" ? -net : net)}</span>
        </p>
      )}
    </NoteCard>
  );
}

function NoteCard({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h2 className="mb-2 text-sm font-bold text-slate-700">
        Note {n} – {title}
      </h2>
      {children}
    </div>
  );
}
