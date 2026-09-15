import type { SortOrder } from "../filters";
import type { Category, Expense } from "../types";

export type ExportFormat = "csv" | "json" | "pdf";

export const EXPORT_COLUMNS = ["date", "category", "description", "amount"] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/** Columns in their canonical output order, however they were toggled. */
export function orderColumns(columns: readonly ExportColumn[]): ExportColumn[] {
  return EXPORT_COLUMNS.filter((c) => columns.includes(c));
}

export const COLUMN_LABELS: Record<ExportColumn, string> = {
  date: "Date",
  category: "Category",
  description: "Description",
  amount: "Amount",
};

export type CsvDelimiter = "," | ";" | "\t";

export interface ExportOptions {
  format: ExportFormat;
  /** Inclusive bounds as YYYY-MM-DD; an empty string leaves that side open. */
  from: string;
  to: string;
  /** Categories to include. Always non-empty for a valid export. */
  categories: Category[];
  columns: ExportColumn[];
  sort: SortOrder;
  /** Base name chosen by the user, without extension. */
  filename: string;
  csv: { delimiter: CsvDelimiter; includeHeader: boolean };
  json: { pretty: boolean; includeMetadata: boolean };
  pdf: { includeBreakdown: boolean; orientation: "portrait" | "landscape" };
}

export interface CategoryTotal {
  category: Category;
  count: number;
  total: number;
}

export interface ExportSummary {
  count: number;
  total: number;
  average: number;
  /** Earliest and latest dates actually present in the selection. */
  firstDate: string | null;
  lastDate: string | null;
  /** Sorted by total, largest first; categories with no records are omitted. */
  byCategory: CategoryTotal[];
}

export interface ExportSelection {
  rows: Expense[];
  summary: ExportSummary;
}

/** Everything a format needs to produce a file. */
export interface ExportContext {
  options: ExportOptions;
  selection: ExportSelection;
  generatedAt: Date;
  /** Called with 0..1 as work progresses. */
  onProgress: (ratio: number) => void;
  /** Yields to the event loop so the UI can paint; throws if the export was cancelled. */
  checkpoint: () => Promise<void>;
}

export interface ExportFormatDefinition {
  id: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  build: (context: ExportContext) => Promise<Blob>;
}
