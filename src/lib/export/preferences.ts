import { SORT_OPTIONS } from "../filters";
import { CATEGORIES } from "../types";
import { EXPORT_COLUMNS, orderColumns, type ExportOptions } from "./types";

const STORAGE_KEY = "expense-tracker:export-preferences:v1";

/** Settings remembered between exports. Scope (dates, categories) and filename are chosen fresh each time. */
type Preferences = Pick<ExportOptions, "format" | "columns" | "sort" | "csv" | "json" | "pdf">;

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "csv",
  from: "",
  to: "",
  categories: [...CATEGORIES],
  columns: [...EXPORT_COLUMNS],
  sort: "date-desc",
  filename: "",
  csv: { delimiter: ",", includeHeader: true },
  json: { pretty: true, includeMetadata: true },
  pdf: { includeBreakdown: true, orientation: "portrait" },
};

export function loadPreferences(): Partial<Preferences> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Partial<Preferences>;
    const d = DEFAULT_EXPORT_OPTIONS;
    // Validate field by field so an outdated or edited entry can't break the dialog.
    return {
      format: ["csv", "json", "pdf"].includes(saved.format as string) ? saved.format : d.format,
      columns: Array.isArray(saved.columns) ? orderColumns(saved.columns) : d.columns,
      sort: SORT_OPTIONS.some((o) => o.value === saved.sort) ? saved.sort : d.sort,
      csv: {
        delimiter: [",", ";", "\t"].includes(saved.csv?.delimiter as string) ? saved.csv!.delimiter : d.csv.delimiter,
        includeHeader: typeof saved.csv?.includeHeader === "boolean" ? saved.csv.includeHeader : d.csv.includeHeader,
      },
      json: {
        pretty: typeof saved.json?.pretty === "boolean" ? saved.json.pretty : d.json.pretty,
        includeMetadata:
          typeof saved.json?.includeMetadata === "boolean" ? saved.json.includeMetadata : d.json.includeMetadata,
      },
      pdf: {
        includeBreakdown:
          typeof saved.pdf?.includeBreakdown === "boolean" ? saved.pdf.includeBreakdown : d.pdf.includeBreakdown,
        orientation: saved.pdf?.orientation === "landscape" ? "landscape" : "portrait",
      },
    };
  } catch {
    return {};
  }
}

export function savePreferences({ format, columns, sort, csv, json, pdf }: ExportOptions): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ format, columns, sort, csv, json, pdf }));
  } catch {
    // Preferences are a convenience; failing to store them is harmless.
  }
}
