import { formatDisplayDate, parseISODate } from "../dates";
import { CATEGORIES, type Category } from "../types";

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** Human-readable date scope, e.g. "Jan 1 – Sep 15, 2026" or "Dec 1, 2025 – Jan 31, 2026". */
export function describeRange(from: string, to: string): string {
  if (from && to) {
    if (from === to) return formatDisplayDate(from);
    const start = parseISODate(from);
    const sameYear = start && from.slice(0, 4) === to.slice(0, 4);
    return `${sameYear ? monthDay.format(start) : formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
  }
  if (from) return `From ${formatDisplayDate(from)}`;
  if (to) return `Through ${formatDisplayDate(to)}`;
  return "All dates";
}

export function describeCategories(categories: Category[]): string {
  if (categories.length === CATEGORIES.length) return "All categories";
  if (categories.length === 0) return "No categories";
  if (categories.length <= 3) return CATEGORIES.filter((c) => categories.includes(c)).join(", ");
  return `${categories.length} of ${CATEGORIES.length} categories`;
}
