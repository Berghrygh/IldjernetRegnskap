// Download helpers: JSON backup, CSV cashbook, and print-to-PDF.
import type { DbState, Voucher } from "../domain/types";
import { formatNum } from "../domain/money";
import { formatDate } from "../domain/dates";
import { getAccount } from "../domain/engine";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportJson(state: DbState) {
  const stamp = new Date().toISOString().slice(0, 10);
  download(
    `vel-regnskap-backup-${stamp}.json`,
    JSON.stringify(state, null, 2),
    "application/json",
  );
}

/** CSV with ; separator (Excel-friendly in Norwegian locale) + BOM for æøå. */
export function exportCashbookCsv(
  state: DbState,
  yearId: string,
  vouchers: Voucher[],
) {
  const accName = (id: string) => getAccount(state, id)?.name ?? "?";
  const header = [
    "Bilagsnr",
    "Dato",
    "Beskrivelse",
    "Debet-konto",
    "Kredit-konto",
    "Beløp",
    "Status",
  ];
  const rows = vouchers.map((v) => [
    String(v.number),
    formatDate(v.date),
    v.description,
    accName(v.debitAccountId),
    accName(v.creditAccountId),
    formatNum(v.amount),
    v.voided ? "Annullert" : "",
  ]);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv =
    "﻿" +
    [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  download(`kassabok-${yearId}.csv`, csv, "text/csv;charset=utf-8");
}

export function printReport() {
  window.print();
}

export function readJsonFile(file: File): Promise<DbState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.accounts)) {
          throw new Error("Filen ser ikke ut som en gyldig sikkerhetskopi.");
        }
        resolve(parsed as DbState);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
