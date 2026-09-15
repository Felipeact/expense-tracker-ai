import { parseISODate } from "./dates";
import { isCategory, type Expense } from "./types";

const STORAGE_KEY = "expense-tracker:expenses:v1";

export class StorageError extends Error {}

function isExpense(value: unknown): value is Expense {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.date === "string" &&
    parseISODate(e.date) !== null &&
    typeof e.amount === "number" &&
    Number.isFinite(e.amount) &&
    isCategory(e.category) &&
    typeof e.description === "string" &&
    typeof e.createdAt === "string" &&
    typeof e.updatedAt === "string"
  );
}

/**
 * Reads expenses from localStorage. Malformed entries are dropped rather than
 * failing the whole load, so one bad record never locks the user out of their data.
 */
export function loadExpenses(): { expenses: Expense[]; skipped: number } {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { expenses: [], skipped: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageError("Saved expense data is corrupted and could not be read.");
  }
  if (!Array.isArray(parsed)) {
    throw new StorageError("Saved expense data has an unexpected format.");
  }

  const expenses = parsed.filter(isExpense);
  return { expenses, skipped: parsed.length - expenses.length };
}

export function saveExpenses(expenses: Expense[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (err) {
    const quota = err instanceof DOMException && err.name === "QuotaExceededError";
    throw new StorageError(
      quota
        ? "Browser storage is full. Export and remove some expenses to continue."
        : "Could not save to browser storage. Changes may be lost when you close this tab.",
    );
  }
}

export function isStorageEvent(event: StorageEvent): boolean {
  return event.key === STORAGE_KEY || event.key === null;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
