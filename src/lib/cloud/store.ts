import type { Expense } from "@/lib/types";
import { EMPTY_CLOUD_STATE, type CloudState } from "./types";

const STORAGE_KEY = "expense-tracker:cloud:v3";

/** Keeps the snapshot small enough that a backup log never eats the quota. */
export const HISTORY_LIMIT = 60;

/** Simulated capacity of the local vault, used by the storage meter. */
export const VAULT_QUOTA_BYTES = 5 * 1024 * 1024;

export function loadCloudState(): CloudState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CLOUD_STATE;
    const parsed = JSON.parse(raw) as Partial<CloudState>;
    return {
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      shares: Array.isArray(parsed.shares) ? parsed.shares : [],
    };
  } catch {
    // A corrupt cloud log should never block the rest of the app.
    return EMPTY_CLOUD_STATE;
  }
}

export function saveCloudState(state: CloudState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private-mode failures are non-fatal: the session keeps working,
    // it just will not survive a reload.
  }
}

export function clearCloudState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the caller already reset the in-memory state.
  }
}

/** FNV-1a over id + updatedAt: cheap, and changes whenever any expense does. */
export function fingerprint(expenses: Expense[]): string {
  let hash = 0x811c9dc5;
  const input = expenses
    .map((e) => `${e.id}:${e.updatedAt}`)
    .sort()
    .join("|");
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** Expenses added or edited since a destination last received a copy. */
export function changesSince(expenses: Expense[], since: string | undefined): number {
  if (!since) return expenses.length;
  return expenses.filter((e) => e.updatedAt > since).length;
}
