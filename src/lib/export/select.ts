import { sum } from "../analytics";
import { parseISODate } from "../dates";
import { DATE_PRESETS, resolveDateRange, sortExpenses, type DatePreset } from "../filters";
import { CATEGORIES, type Category, type Expense } from "../types";
import type { ExportOptions, ExportSelection, ExportSummary } from "./types";

export function selectForExport(
  expenses: Expense[],
  options: Pick<ExportOptions, "from" | "to" | "categories" | "sort">,
): ExportSelection {
  const categories = new Set<Category>(options.categories);
  const from = parseISODate(options.from) ? options.from : undefined;
  const to = parseISODate(options.to) ? options.to : undefined;

  const rows = sortExpenses(
    expenses.filter(
      (e) => categories.has(e.category) && (!from || e.date >= from) && (!to || e.date <= to),
    ),
    options.sort,
  );
  return { rows, summary: summarizeRows(rows) };
}

export function summarizeRows(rows: Expense[]): ExportSummary {
  const groups = new Map<Category, Expense[]>();
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const row of rows) {
    const group = groups.get(row.category);
    if (group) group.push(row);
    else groups.set(row.category, [row]);
    if (firstDate === null || row.date < firstDate) firstDate = row.date;
    if (lastDate === null || row.date > lastDate) lastDate = row.date;
  }

  const total = sum(rows);
  return {
    count: rows.length,
    total,
    average: rows.length ? Math.round((total / rows.length) * 100) / 100 : 0,
    firstDate,
    lastDate,
    byCategory: CATEGORIES.filter((c) => groups.has(c))
      .map((category) => ({ category, count: groups.get(category)!.length, total: sum(groups.get(category)!) }))
      .sort((a, b) => b.total - a.total),
  };
}

export type ExportIssue = "invalid-range" | "no-categories" | "no-columns" | "no-records";

export const ISSUE_MESSAGES: Record<ExportIssue, string> = {
  "invalid-range": "The start date must be on or before the end date.",
  "no-categories": "Select at least one category.",
  "no-columns": "Select at least one column.",
  "no-records": "No expenses match these filters.",
};

/** Returns the first problem that blocks exporting, or null when the export can run. */
export function findExportIssue(options: ExportOptions, selection: ExportSelection): ExportIssue | null {
  if (options.from && options.to && options.from > options.to) return "invalid-range";
  if (options.categories.length === 0) return "no-categories";
  if (options.columns.length === 0) return "no-columns";
  if (selection.rows.length === 0) return "no-records";
  return null;
}

export const RANGE_PRESETS = DATE_PRESETS.filter((p) => p.value !== "custom");

export function presetRange(preset: DatePreset, today = new Date()): { from: string; to: string } {
  const { from = "", to = "" } = resolveDateRange({ preset, from: "", to: "" }, today);
  return { from, to };
}

/** The preset that produces exactly this range, if any. */
export function matchPreset(from: string, to: string, today = new Date()): DatePreset | null {
  const match = RANGE_PRESETS.find((p) => {
    const range = presetRange(p.value, today);
    return range.from === from && range.to === to;
  });
  return match?.value ?? null;
}
