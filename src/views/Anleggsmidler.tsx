import { useState } from "react";
import { useStore } from "../store";
import type { Asset, AssetEventType } from "../domain/types";
import {
  assetSchedule,
  closingBalance,
  getYear,
  suggestedDepreciation,
} from "../domain/engine";
import { formatKr, round2 } from "../domain/money";
import { formatDate, todayIso } from "../domain/dates";
import { PageHeader, StatCard, EmptyState, LockedNotice } from "../components/ui";
import { Modal } from "../components/Modal";
import { MoneyInput } from "../components/MoneyInput";

export function Anleggsmidler() {
  const store = useStore();
  const { state, currentYearId } = store;
  const year = getYear(state, currentYearId)!;
  const locked = !!year?.locked;
  const assets = state.assets;

  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Asset | null>(null);

  const schedules = assets.map((a) => assetSchedule(a, year));
  const totalClosing = round2(
    schedules.reduce((s, sc) => s + sc.closingValue, 0),
  );
  const eiendelerId = state.settings.fixedAssetAccountId;
  const eiendelerBalance = eiendelerId
    ? closingBalance(state, currentYearId, eiendelerId)
    : 0;
  const mismatch = Math.abs(totalClosing - eiendelerBalance) > 0.005;

  const runDep = () => {
    const n = store.runDepreciation(currentYearId);
    window.alert(
      n > 0
        ? `Avskrivning bokført for ${n} anleggsmiddel/midler.`
        : "Ingen nye avskrivninger å bokføre (allerede kjørt, eller ingen verdi igjen).",
    );
  };

  return (
    <div>
      <PageHeader
        title="Anleggsmidler"
        subtitle="Eiendelsregister med 10 % lineær avskrivning per år."
        actions={
          <>
            <button
              className="btn-secondary"
              disabled={locked}
              onClick={runDep}
            >
              Kjør 10 % avskrivning
            </button>
            <button
              className="btn-primary"
              disabled={locked}
              onClick={() => setNewOpen(true)}
            >
              + Nytt anleggsmiddel
            </button>
          </>
        }
      />

      {locked && (
        <LockedNotice onUnlock={() => store.unlockYear(currentYearId)} />
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Bokført verdi (register)"
          value={formatKr(totalClosing)}
          hint={`UB ${year.label}`}
        />
        <StatCard
          label="Saldo Eiendeler-konto"
          value={formatKr(eiendelerBalance)}
          hint="Balansekonto"
          tone={mismatch ? "bad" : "good"}
        />
        <StatCard
          label="Differanse"
          value={formatKr(round2(totalClosing - eiendelerBalance))}
          hint={mismatch ? "Bør være 0" : "Stemmer ✓"}
          tone={mismatch ? "bad" : "good"}
        />
      </div>

      {mismatch && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          Registerets bokførte verdi avviker fra Eiendeler-kontoen. Kjør
          avskrivning, eller kontroller tilgang/bortskrivning og åpningsbalanse.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Anleggsmiddel</th>
                <th className="px-3 py-2">Anskaffet</th>
                <th className="px-3 py-2 text-right">IB verdi</th>
                <th className="px-3 py-2 text-right">Tilgang</th>
                <th className="px-3 py-2 text-right">Avskrivning</th>
                <th className="px-3 py-2 text-right">Bortskrivning</th>
                <th className="px-3 py-2 text-right">UB verdi</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8">
                    <EmptyState>Ingen anleggsmidler registrert.</EmptyState>
                  </td>
                </tr>
              )}
              {schedules.map((sc) => (
                <tr
                  key={sc.asset.id}
                  className={`border-b border-slate-100 ${sc.asset.active ? "" : "opacity-50"}`}
                >
                  <td className="px-3 py-2 font-medium">{sc.asset.name}</td>
                  <td className="px-3 py-2 num">
                    {formatDate(sc.asset.acquisitionDate)}
                  </td>
                  <td className="px-3 py-2 text-right num">
                    {formatKr(sc.openingValue)}
                  </td>
                  <td className="px-3 py-2 text-right num">
                    {sc.addition ? formatKr(sc.addition) : "–"}
                  </td>
                  <td className="px-3 py-2 text-right num text-rose-600">
                    {sc.depreciation ? `-${formatKr(sc.depreciation)}` : "–"}
                  </td>
                  <td className="px-3 py-2 text-right num text-rose-600">
                    {sc.writedown ? `-${formatKr(sc.writedown)}` : "–"}
                  </td>
                  <td className="px-3 py-2 text-right num font-semibold">
                    {formatKr(sc.closingValue)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="btn-ghost px-2 py-1"
                      onClick={() => setDetail(sc.asset)}
                    >
                      Detaljer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {newOpen && <NewAssetModal onClose={() => setNewOpen(false)} />}
      {detail && (
        <AssetDetailModal
          asset={state.assets.find((a) => a.id === detail.id)!}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function NewAssetModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState(0);

  const save = () => {
    if (!name.trim() || !(value > 0)) return;
    store.addAsset(name.trim(), date, value);
    onClose();
  };

  return (
    <Modal
      open
      title="Nytt anleggsmiddel"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-primary" onClick={save}>
            Legg til
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Anskaffelsen registreres som tilgang. Husk å føre selve kjøpet som bilag
        i kassaboken (debet Eiendeler, kredit bank) hvis det ikke alt er gjort.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Navn</label>
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="f.eks. Gressklipper"
          />
        </div>
        <div>
          <label className="label">Anskaffelsesdato</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Anskaffelsesverdi</label>
          <MoneyInput value={value} onChange={setValue} />
        </div>
      </div>
    </Modal>
  );
}

function AssetDetailModal({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const store = useStore();
  const { state, currentYearId } = store;
  const year = getYear(state, currentYearId)!;
  const locked = !!year.locked;
  const [type, setType] = useState<AssetEventType>("addition");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(year.endDate);
  const suggested = suggestedDepreciation(asset, year);

  const addEvent = () => {
    if (!(amount > 0)) return;
    store.addAssetEvent(asset.id, {
      yearId: currentYearId,
      type,
      amount,
      date,
      note:
        type === "addition"
          ? "Tilgang"
          : type === "writedown"
            ? "Bortskrivning"
            : "Avskrivning",
    });
    setAmount(0);
  };

  return (
    <Modal open wide title={asset.name} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">
          Anskaffet {formatDate(asset.acquisitionDate)}
        </span>
        <span className="text-sm text-slate-400">·</span>
        <span className="text-sm text-slate-500">
          Foreslått 10 % avskrivning i år:{" "}
          <span className="num font-medium">{formatKr(suggested)}</span>
        </span>
        <button
          className="btn-ghost ml-auto px-2 py-1"
          onClick={() =>
            store.updateAsset(asset.id, { active: !asset.active })
          }
        >
          {asset.active ? "Deaktiver" : "Aktiver"}
        </button>
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-2 py-1.5">Dato</th>
            <th className="px-2 py-1.5">Type</th>
            <th className="px-2 py-1.5">Notat</th>
            <th className="px-2 py-1.5 text-right">Beløp</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {[...asset.events]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => (
              <tr key={e.id} className="border-b border-slate-100">
                <td className="px-2 py-1.5 num">{formatDate(e.date)}</td>
                <td className="px-2 py-1.5">{eventLabel(e.type)}</td>
                <td className="px-2 py-1.5 text-slate-500">{e.note}</td>
                <td
                  className={`px-2 py-1.5 text-right num ${
                    e.type === "acquisition" || e.type === "addition"
                      ? "text-slate-700"
                      : "text-rose-600"
                  }`}
                >
                  {e.type === "acquisition" || e.type === "addition"
                    ? formatKr(e.amount)
                    : `-${formatKr(e.amount)}`}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {!locked && !e.voucherId && (
                    <button
                      className="btn-ghost px-2 py-0.5 text-rose-600"
                      onClick={() => store.removeAssetEvent(asset.id, e.id)}
                    >
                      Slett
                    </button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {!locked && (
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Registrer hendelse
          </div>
          <div className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-4">
              <label className="label">Type</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as AssetEventType)}
              >
                <option value="addition">Tilgang</option>
                <option value="writedown">Bortskrivning</option>
                <option value="depreciation">Avskrivning (manuell)</option>
              </select>
            </div>
            <div className="col-span-4">
              <label className="label">Dato</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <label className="label">Beløp</label>
              <MoneyInput value={amount} onChange={setAmount} />
            </div>
            <div className="col-span-1">
              <button className="btn-primary w-full" onClick={addEvent}>
                +
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Tips: bruk «Kjør 10 % avskrivning» for å bokføre avskrivningen som
            bilag automatisk. Manuelle hendelser her påvirker bare registeret.
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button className="btn-secondary" onClick={onClose}>
          Lukk
        </button>
      </div>
    </Modal>
  );
}

function eventLabel(t: AssetEventType): string {
  switch (t) {
    case "acquisition":
      return "Anskaffelse";
    case "addition":
      return "Tilgang";
    case "depreciation":
      return "Avskrivning";
    case "writedown":
      return "Bortskrivning";
  }
}
