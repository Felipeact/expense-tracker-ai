import { buildCsv } from "./csv";
import { buildJson } from "./json";
import { buildPdf } from "./pdf/report";
import type { ExportFormat, ExportFormatDefinition } from "./types";

export const EXPORT_FORMATS: Record<ExportFormat, ExportFormatDefinition> = {
  csv: { id: "csv", label: "CSV", extension: "csv", mimeType: "text/csv", build: buildCsv },
  json: { id: "json", label: "JSON", extension: "json", mimeType: "application/json", build: buildJson },
  pdf: { id: "pdf", label: "PDF", extension: "pdf", mimeType: "application/pdf", build: buildPdf },
};
