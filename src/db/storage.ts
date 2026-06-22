// IndexedDB persistence. The whole DbState is small (a velforening's lifetime
// of vouchers is well under a few thousand rows), so we persist it as a single
// JSON document under one key. This keeps load/save/export trivially atomic.
import { openDB, type IDBPDatabase } from "idb";
import type { DbState } from "../domain/types";
import { createSeedState } from "../domain/seed";

const DB_NAME = "vel-regnskap";
const STORE = "state";
const KEY = "current";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function loadState(): Promise<DbState> {
  const conn = await db();
  const existing = (await conn.get(STORE, KEY)) as DbState | undefined;
  if (existing) return existing;
  const seed = createSeedState();
  await conn.put(STORE, seed, KEY);
  return seed;
}

export async function saveState(state: DbState): Promise<void> {
  const conn = await db();
  await conn.put(STORE, state, KEY);
}

export async function replaceState(state: DbState): Promise<void> {
  await saveState(state);
}

export async function resetState(): Promise<DbState> {
  const conn = await db();
  const seed = createSeedState();
  await conn.put(STORE, seed, KEY);
  return seed;
}
