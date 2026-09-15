"use client";

import { Braces, CalendarRange, Check, Columns3, FileDown, FileSpreadsheet, FileText, PenLine, RotateCcw, Tags, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CATEGORY_META } from "@/lib/categories";
import { EXPORT_FORMATS } from "@/lib/export/formats";
import { matchPreset, presetRange, RANGE_PRESETS } from "@/lib/export/select";
import { COLUMN_LABELS, EXPORT_COLUMNS, type CsvDelimiter, type ExportFormat, type ExportOptions } from "@/lib/export/types";
import { SORT_OPTIONS, type SortOrder } from "@/lib/filters";
import { CATEGORIES, type Category } from "@/lib/types";
import type { ExportDispatch } from "./useExportOptions";

const FORMAT_CARDS: Record<ExportFormat, { icon: LucideIcon; hint: string }> = {
  csv: { icon: FileSpreadsheet, hint: "Excel, Sheets" },
  json: { icon: Braces, hint: "Backups, scripts" },
  pdf: { icon: FileText, hint: "Printable report" },
};

const DELIMITERS: { value: CsvDelimiter; label: string }[] = [
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab" },
];

interface ExportSettingsProps {
  options: ExportOptions;
  dispatch: ExportDispatch;
  /** Records per category within the selected date range. */
  categoryCounts: Record<Category, number>;
  rangeInvalid: boolean;
  filenameEdited: boolean;
  suggestedFilename: string;
}

export function ExportSettings({
  options,
  dispatch,
  categoryCounts,
  rangeInvalid,
  filenameEdited,
  suggestedFilename,
}: ExportSettingsProps) {
  const ids = useId();
  const activePreset = matchPreset(options.from, options.to);
  const extension = EXPORT_FORMATS[options.format].extension;
  const allCategories = options.categories.length === CATEGORIES.length;

  return (
    <div className="divide-y divide-line">
      <Section icon={FileDown} title="Format">
        <div role="radiogroup" aria-label="File format" className="grid grid-cols-3 gap-2">
          {(Object.keys(FORMAT_CARDS) as ExportFormat[]).map((format) => {
            const { icon: Icon, hint } = FORMAT_CARDS[format];
            const selected = options.format === format;
            return (
              <label
                key={format}
                className={`relative flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                  selected ? "border-accent bg-accent-soft/60" : "border-line hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name={`${ids}-format`}
                  value={format}
                  checked={selected}
                  onChange={() => dispatch({ type: "patch", patch: { format } })}
                  className="sr-only"
                  data-autofocus={selected ? "" : undefined}
                />
                <Icon className={`h-5 w-5 ${selected ? "text-accent-ink" : "text-ink-2"}`} aria-hidden />
                <span className="text-sm font-semibold text-ink">{EXPORT_FORMATS[format].label}</span>
                <span className="text-xs leading-tight text-ink-2">{hint}</span>
                {selected && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div className="mt-3 space-y-2.5 rounded-lg bg-surface-2/60 p-3">
          {options.format === "csv" && (
            <>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`${ids}-delimiter`} className="text-sm text-ink">
                  Delimiter
                </label>
                <select
                  id={`${ids}-delimiter`}
                  className="input w-40 py-1.5"
                  value={options.csv.delimiter}
                  onChange={(e) =>
                    dispatch({ type: "format-option", format: "csv", patch: { delimiter: e.target.value as CsvDelimiter } })
                  }
                >
                  {DELIMITERS.map((d) => (
                    <option key={d.label} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <Checkbox
                label="Include header row"
                checked={options.csv.includeHeader}
                onChange={(includeHeader) => dispatch({ type: "format-option", format: "csv", patch: { includeHeader } })}
              />
            </>
          )}
          {options.format === "json" && (
            <>
              <Checkbox
                label="Include metadata and summary"
                hint="Wraps records with filters, totals, and a timestamp."
                checked={options.json.includeMetadata}
                onChange={(includeMetadata) =>
                  dispatch({ type: "format-option", format: "json", patch: { includeMetadata } })
                }
              />
              <Checkbox
                label="Pretty-print"
                checked={options.json.pretty}
                onChange={(pretty) => dispatch({ type: "format-option", format: "json", patch: { pretty } })}
              />
            </>
          )}
          {options.format === "pdf" && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">Orientation</span>
                <SegmentedControl
                  label="Page orientation"
                  size="sm"
                  value={options.pdf.orientation}
                  onChange={(orientation) => dispatch({ type: "format-option", format: "pdf", patch: { orientation } })}
                  options={[
                    { value: "portrait", label: "Portrait" },
                    { value: "landscape", label: "Landscape" },
                  ]}
                />
              </div>
              <Checkbox
                label="Include category breakdown"
                checked={options.pdf.includeBreakdown}
                onChange={(includeBreakdown) =>
                  dispatch({ type: "format-option", format: "pdf", patch: { includeBreakdown } })
                }
              />
            </>
          )}
        </div>
      </Section>

      <Section icon={CalendarRange} title="Date range">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range presets">
          {RANGE_PRESETS.map((preset) => {
            const active = activePreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={active}
                onClick={() => dispatch({ type: "patch", patch: presetRange(preset.value) })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  active ? "border-accent bg-accent text-white" : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${ids}-from`} className="mb-1 block text-xs font-medium text-ink-2">
              Start date
            </label>
            <input
              id={`${ids}-from`}
              type="date"
              className={`input ${rangeInvalid ? "input-error" : ""}`}
              value={options.from}
              max={options.to || undefined}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? `${ids}-range-error` : undefined}
              onChange={(e) => dispatch({ type: "patch", patch: { from: e.target.value } })}
            />
          </div>
          <div>
            <label htmlFor={`${ids}-to`} className="mb-1 block text-xs font-medium text-ink-2">
              End date
            </label>
            <input
              id={`${ids}-to`}
              type="date"
              className={`input ${rangeInvalid ? "input-error" : ""}`}
              value={options.to}
              min={options.from || undefined}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? `${ids}-range-error` : undefined}
              onChange={(e) => dispatch({ type: "patch", patch: { to: e.target.value } })}
            />
          </div>
        </div>
        {rangeInvalid ? (
          <p id={`${ids}-range-error`} className="mt-2 text-xs font-medium text-bad" role="alert">
            Start date must be on or before the end date.
          </p>
        ) : (
          !options.from &&
          !options.to && <p className="mt-2 text-xs text-muted">Leave both empty to include every date.</p>
        )}
      </Section>

      <Section
        icon={Tags}
        title="Categories"
        action={
          <button
            type="button"
            className="text-xs font-medium text-accent-ink hover:underline"
            onClick={() => dispatch({ type: "set-categories", categories: allCategories ? [] : [...CATEGORIES] })}
          >
            {allCategories ? "Clear all" : "Select all"}
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Categories to include">
          {CATEGORIES.map((category) => {
            const checked = options.categories.includes(category);
            return (
              <label
                key={category}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                  checked ? "border-line bg-surface" : "border-dashed border-line bg-transparent text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 accent-accent"
                  checked={checked}
                  onChange={() => dispatch({ type: "toggle-category", category })}
                />
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${checked ? "" : "opacity-40"}`}
                  style={{ background: CATEGORY_META[category].color }}
                  aria-hidden
                />
                <span className={`min-w-0 flex-1 truncate ${checked ? "text-ink" : ""}`}>{category}</span>
                <span className="text-xs tabular-nums text-muted" aria-label={`${categoryCounts[category]} in range`}>
                  {categoryCounts[category]}
                </span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section icon={Columns3} title="Columns and order">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Columns to include">
          {EXPORT_COLUMNS.map((column) => {
            const active = options.columns.includes(column);
            return (
              <button
                key={column}
                type="button"
                aria-pressed={active}
                onClick={() => dispatch({ type: "toggle-column", column })}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  active ? "border-line bg-surface text-ink shadow-card" : "border-dashed border-line text-muted line-through hover:text-ink-2"
                }`}
              >
                {active && <Check className="h-3 w-3" aria-hidden />}
                {COLUMN_LABELS[column]}
              </button>
            );
          })}
        </div>
        {options.columns.length === 0 && (
          <p className="mt-2 text-xs font-medium text-bad" role="alert">
            Select at least one column.
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <label htmlFor={`${ids}-sort`} className="text-sm text-ink">
            Sort rows by
          </label>
          <select
            id={`${ids}-sort`}
            className="input w-44 py-1.5"
            value={options.sort}
            onChange={(e) => dispatch({ type: "patch", patch: { sort: e.target.value as SortOrder } })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section icon={PenLine} title="File name">
        <div className="flex items-stretch">
          <input
            id={`${ids}-filename`}
            aria-label="File name"
            className="input rounded-r-none"
            value={options.filename}
            placeholder={suggestedFilename}
            spellCheck={false}
            maxLength={120}
            onChange={(e) => dispatch({ type: "filename", value: e.target.value })}
          />
          <span className="flex items-center rounded-r-lg border border-l-0 border-line bg-surface-2 px-3 font-mono text-xs text-ink-2">
            .{extension}
          </span>
        </div>
        <div className="mt-1.5 flex min-h-[1.5rem] items-center justify-between gap-2 text-xs text-muted">
          <span>{filenameEdited ? "Custom name" : "Named automatically from your filters"}</span>
          {filenameEdited && (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline"
              onClick={() => dispatch({ type: "reset-filename" })}
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Use automatic name
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="px-5 py-4 sm:px-6">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
