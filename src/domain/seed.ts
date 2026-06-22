// Sample data so the app is not empty on first run. The numbers are internally
// consistent: the asset register carrying value equals the Eiendeler opening
// balance, and the example Kontingent bilag is linked to a household.
import type { DbState } from "./types";

export const CURRENT_DB_VERSION = 1;

export function createSeedState(): DbState {
  const yearId = "2026-2027";

  const acc = {
    kasse: "acc-kasse",
    bank: "acc-bedriftskonto",
    spare: "acc-sparekonto",
    vipps: "acc-vipps",
    eiendeler: "acc-eiendeler",
    kontingent: "acc-kontingent",
    arsfest: "acc-arsfest",
    effekter: "acc-effekter",
    bok: "acc-bok",
    renter: "acc-renter",
    bank_omk: "acc-bankomkostninger",
    porto: "acc-porto",
    diverse: "acc-diverse",
    avskrivning: "acc-avskrivning",
  };

  return {
    version: CURRENT_DB_VERSION,
    settings: {
      associationName: "Velforeningen",
      currentYearId: yearId,
      standardKontingent: 500,
      kontingentAccountId: acc.kontingent,
      fixedAssetAccountId: acc.eiendeler,
      depreciationAccountId: acc.avskrivning,
    },
    accounts: [
      // Balance — liquid
      { id: acc.kasse, number: "1900", name: "Kasse", type: "balance", balanceKind: "liquid", active: true, sortOrder: 10 },
      { id: acc.bank, number: "1920", name: "Bedriftskonto", type: "balance", balanceKind: "liquid", active: true, sortOrder: 20 },
      { id: acc.spare, number: "1950", name: "Sparekonto", type: "balance", balanceKind: "liquid", active: true, sortOrder: 30 },
      { id: acc.vipps, number: "1930", name: "Vipps", type: "balance", balanceKind: "liquid", active: true, sortOrder: 40, showInNotes: true },
      // Balance — fixed assets
      { id: acc.eiendeler, number: "1200", name: "Eiendeler (Anleggsmidler)", type: "balance", balanceKind: "fixedAsset", active: true, sortOrder: 50 },
      // Result — income
      { id: acc.kontingent, number: "3000", name: "Kontingent", type: "result", resultKind: "income", active: true, sortOrder: 110 },
      { id: acc.arsfest, number: "3100", name: "Årsfest", type: "result", resultKind: "income", active: true, sortOrder: 120, showInNotes: true },
      { id: acc.effekter, number: "3200", name: "Effekter", type: "result", resultKind: "income", active: true, sortOrder: 130, showInNotes: true },
      { id: acc.bok, number: "3300", name: "Bok", type: "result", resultKind: "income", active: true, sortOrder: 140, showInNotes: true },
      { id: acc.renter, number: "8050", name: "Renteinntekter", type: "result", resultKind: "income", active: true, sortOrder: 150 },
      // Result — expense
      { id: acc.bank_omk, number: "8150", name: "Bankomkostninger/renter", type: "result", resultKind: "expense", active: true, sortOrder: 210 },
      { id: acc.porto, number: "6800", name: "Porto", type: "result", resultKind: "expense", active: true, sortOrder: 220 },
      { id: acc.diverse, number: "7790", name: "Diverse", type: "result", resultKind: "expense", active: true, sortOrder: 230, showInNotes: true },
      { id: acc.avskrivning, number: "6000", name: "Avskrivning", type: "result", resultKind: "expense", active: true, sortOrder: 240 },
    ],
    years: [
      {
        id: yearId,
        label: "2026/2027",
        startDate: "2026-04-01",
        endDate: "2027-03-31",
        locked: false,
        createdAt: "2026-04-01T00:00:00.000Z",
        openingBalances: {
          [acc.kasse]: 2000,
          [acc.bank]: 45000,
          [acc.spare]: 30000,
          [acc.vipps]: 0,
          [acc.eiendeler]: 12000,
        },
      },
    ],
    vouchers: [
      {
        id: "v-seed-1",
        yearId,
        number: 1,
        date: "2026-04-15",
        description: "Kontingent 2026/2027 – Ola Hansen",
        amount: 500,
        debitAccountId: acc.bank,
        creditAccountId: acc.kontingent,
        voided: false,
        kind: "normal",
        householdId: "hh-hansen",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
      {
        id: "v-seed-2",
        yearId,
        number: 2,
        date: "2026-05-02",
        description: "Porto – utsending av innkalling",
        amount: 120,
        debitAccountId: acc.porto,
        creditAccountId: acc.bank,
        voided: false,
        kind: "normal",
        createdAt: "2026-05-02T10:00:00.000Z",
      },
    ],
    assets: [
      {
        id: "asset-inventar",
        name: "Klubbhus inventar",
        acquisitionDate: "2024-04-10",
        active: true,
        events: [
          { id: "ae-1", yearId: "2024-2025", type: "acquisition", amount: 15000, date: "2024-04-10", note: "Anskaffelse" },
          { id: "ae-2", yearId: "2024-2025", type: "depreciation", amount: 1500, date: "2025-03-31", note: "10% avskrivning" },
          { id: "ae-3", yearId: "2025-2026", type: "depreciation", amount: 1500, date: "2026-03-31", note: "10% avskrivning" },
        ],
      },
    ],
    households: [
      {
        id: "hh-hansen",
        primaryMember: "Ola Hansen",
        partner: "Kari Hansen",
        address: "Vellveien 1",
        unit: "1",
        status: "Innmeldt",
        statusYear: 2009,
        notes: "",
        payments: {
          [yearId]: { amount: 500, voucherId: "v-seed-1" },
        },
      },
      {
        id: "hh-berg",
        primaryMember: "Per Berg",
        address: "Vellveien 3",
        unit: "3",
        status: "Innmeldt",
        statusYear: 2015,
        notes: "Sender purring på e-post.",
        payments: {},
      },
      {
        id: "hh-lund",
        primaryMember: "Anne Lund",
        address: "Vellveien 5",
        unit: "5",
        status: "Utmeldt",
        statusYear: 2024,
        notes: "Flyttet.",
        payments: {},
      },
    ],
  };
}
