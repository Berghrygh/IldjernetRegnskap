import { useMemo, useRef, useState } from "react";
import type { Account } from "../domain/types";

interface Props {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}

/** Searchable account picker, keyboard friendly. */
export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Søk konto…",
  autoFocus,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = accounts.find((a) => a.id === value);
  const active = accounts.filter((a) => a.active);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.number.toLowerCase().includes(q),
    );
  }, [active, query]);

  const choose = (a: Account) => {
    onChange(a.id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        className="input"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={open ? query : selected ? `${selected.number ? selected.number + " " : ""}${selected.name}` : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (open && filtered[highlight]) {
              e.preventDefault();
              choose(filtered[highlight]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  i === highlight ? "bg-brand-50 text-brand-800" : "hover:bg-slate-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(a);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span>
                  {a.number && (
                    <span className="mr-2 text-slate-400">{a.number}</span>
                  )}
                  {a.name}
                </span>
                <span className="text-xs text-slate-400">
                  {a.type === "balance" ? "Balanse" : "Resultat"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
