import { addDays, parseISODate, startOfMonth, startOfYear, toISODate } from "./dates";
import type { Category, Expense } from "./types";

export type DatePreset = "all" | "this-month" | "last-30" | "last-90" | "this-year" | "custom";
export type SortOrder = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export interface ExpenseFilters {
  search: string;
  category: Category | "all";
  preset: DatePreset;
  /** Custom range bounds (YYYY-MM-DD), used when preset is "custom". */
  from: string;
  to: string;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: ExpenseFilters = {
  search: "",
  category: "all",
  preset: "all",
  from: "",
  to: "",
  sort: "date-desc",
};

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "this-month", label: "This month" },
  { value: "last-30", label: "Last 30 days" },
  { value: "last-90", label: "Last 90 days" },
  { value: "this-year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];

export function resolveDateRange(
  filters: Pick<ExpenseFilters, "preset" | "from" | "to">,
  today = new Date(),
): { from?: string; to?: string } {
  const end = toISODate(today);
  switch (filters.preset) {
    case "this-month":
      return { from: toISODate(startOfMonth(today)), to: end };
    case "last-30":
      return { from: toISODate(addDays(today, -29)), to: end };
    case "last-90":
      return { from: toISODate(addDays(today, -89)), to: end };
    case "this-year":
      return { from: toISODate(startOfYear(today)), to: end };
    case "custom":
      return {
        from: parseISODate(filters.from) ? filters.from : undefined,
        to: parseISODate(filters.to) ? filters.to : undefined,
      };
    default:
      return {};
  }
}

export function isCustomRangeInverted(filters: ExpenseFilters): boolean {
  return filters.preset === "custom" && !!filters.from && !!filters.to && filters.from > filters.to;
}

export function applyFilters(expenses: Expense[], filters: ExpenseFilters): Expense[] {
  const { from, to } = resolveDateRange(filters);
  const query = filters.search.trim().toLowerCase();

  const result = expenses.filter((e) => {
    if (filters.category !== "all" && e.category !== filters.category) return false;
    // ISO date strings compare correctly as plain strings.
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (query) {
      const haystack = `${e.description} ${e.category} ${e.amount.toFixed(2)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return sortExpenses(result, filters.sort);
}

const byNewest = (a: Expense, b: Expense) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

/** Sorts in place and returns the same array. */
export function sortExpenses(expenses: Expense[], order: SortOrder): Expense[] {
  return expenses.sort((a, b) => {
    switch (order) {
      case "date-asc":
        return -byNewest(a, b);
      case "amount-desc":
        return b.amount - a.amount || byNewest(a, b);
      case "amount-asc":
        return a.amount - b.amount || byNewest(a, b);
      default:
        return byNewest(a, b);
    }
  });
}

export function countActiveFilters(filters: ExpenseFilters): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.category !== "all") count++;
  if (filters.preset !== "all") count++;
  return count;
}
