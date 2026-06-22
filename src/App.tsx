import { useRef, useState } from "react";
import { useStore } from "./store";
import { exportJson, readJsonFile } from "./lib/exporters";
import { Dashboard } from "./views/Dashboard";
import { Kontoplan } from "./views/Kontoplan";
import { Bilagsforing } from "./views/Bilagsforing";
import { Reskontro } from "./views/Reskontro";
import { Anleggsmidler } from "./views/Anleggsmidler";
import { Arsoppstilling } from "./views/Arsoppstilling";
import { Noter } from "./views/Noter";
import { Arsavslutning } from "./views/Arsavslutning";

type Tab =
  | "dashboard"
  | "kontoplan"
  | "bilag"
  | "reskontro"
  | "anleggsmidler"
  | "arsoppstilling"
  | "noter"
  | "arsavslutning";

const NAV: { id: Tab; label: string; hint: string }[] = [
  { id: "dashboard", label: "Dashbord", hint: "Oversikt" },
  { id: "kontoplan", label: "Kontoplan", hint: "Kontoer" },
  { id: "bilag", label: "Bilagsføring", hint: "Kassabok" },
  { id: "reskontro", label: "Reskontro", hint: "Medlemmer" },
  { id: "anleggsmidler", label: "Anleggsmidler", hint: "Eiendeler" },
  { id: "arsoppstilling", label: "Årsoppstilling", hint: "Resultat" },
  { id: "noter", label: "Noter", hint: "Spesifikasjoner" },
  { id: "arsavslutning", label: "Årsavslutning", hint: "Avslutt år" },
];

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("dashboard");
  const fileRef = useRef<HTMLInputElement>(null);

  const { state } = store;
  const years = [...state.years].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
  const currentYear = state.years.find((y) => y.id === store.currentYearId);

  const onImportFile = async (file: File) => {
    try {
      const incoming = await readJsonFile(file);
      if (
        window.confirm(
          "Importere denne sikkerhetskopien? Dette erstatter alle data i nettleseren.",
        )
      ) {
        store.importState(incoming);
        setTab("dashboard");
      }
    } catch (e) {
      window.alert("Kunne ikke lese filen: " + (e as Error).message);
    }
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside className="no-print border-b border-slate-200 bg-white lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            VR
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-slate-800">
              Vel-Regnskap
            </div>
            <div className="text-xs text-slate-500">
              {state.settings.associationName}
            </div>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors lg:w-full ${
                tab === n.id
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{n.label}</span>
              <span className="ml-3 hidden text-xs text-slate-400 lg:inline">
                {n.hint}
              </span>
            </button>
          ))}
        </nav>

        <div className="hidden border-t border-slate-200 px-3 py-3 lg:block">
          <div className="label px-1">Sikkerhetskopi</div>
          <div className="flex flex-col gap-1.5">
            <button
              className="btn-secondary justify-start"
              onClick={() => exportJson(state)}
            >
              Eksporter (JSON)
            </button>
            <button
              className="btn-secondary justify-start"
              onClick={() => fileRef.current?.click()}
            >
              Importer (JSON)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1">
        <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Regnskapsår
            </label>
            <select
              className="input w-auto py-1.5"
              value={store.currentYearId}
              onChange={(e) => store.selectYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.locked ? "🔒" : ""}
                </option>
              ))}
            </select>
            {currentYear?.locked && (
              <span className="badge bg-amber-100 text-amber-800">
                Låst år
              </span>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {tab === "dashboard" && <Dashboard goto={setTab} />}
          {tab === "kontoplan" && <Kontoplan />}
          {tab === "bilag" && <Bilagsforing />}
          {tab === "reskontro" && <Reskontro />}
          {tab === "anleggsmidler" && <Anleggsmidler />}
          {tab === "arsoppstilling" && <Arsoppstilling />}
          {tab === "noter" && <Noter />}
          {tab === "arsavslutning" && <Arsavslutning goto={setTab} />}
        </div>
      </main>
    </div>
  );
}

export type { Tab };
