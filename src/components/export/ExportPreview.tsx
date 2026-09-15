"use client";

import { AlertCircle, FileSearch, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CATEGORY_META } from "@/lib/categories";
import { formatDisplayDate } from "@/lib/dates";
import { describeRange } from "@/lib/export/describe";
import { EXPORT_FORMATS } from "@/lib/export/formats";
import { planReport } from "@/lib/export/pdf/report";
import { ISSUE_MESSAGES, type ExportIssue } from "@/lib/export/select";
import { COLUMN_LABELS, orderColumns, type ExportOptions, type ExportSelection } from "@/lib/export/types";
import { formatCurrency, formatPercent } from "@/lib/format";

const TABLE_LIMIT = 100;
const FILE_PREVIEW_ROWS = 25;

type View = "table" | "file";

interface ExportPreviewProps {
  options: ExportOptions;
  selection: ExportSelection;
  issue: ExportIssue | null;
  totalExpenses: number;
  /** True while the preview is catching up with the latest settings. */
  isStale: boolean;
}

export function ExportPreview({ options, selection, issue, totalExpenses, isStale }: ExportPreviewProps) {
  const [view, setView] = useState<View>("table");
  const { summary, rows } = selection;
  const blocking = issue && issue !== "no-records" ? issue : null;
  const pages = options.format === "pdf" && summary.count > 0 ? planReport(options, summary).pages.length : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">Preview</h3>
          <span
            className={`inline-flex items-center gap-1 text-xs text-muted transition-opacity ${isStale ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!isStale}
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Updating
          </span>
        </div>
        <SegmentedControl
          label="Preview mode"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table" },
            { value: "file", label: options.format === "pdf" ? "Page layout" : `${EXPORT_FORMATS[options.format].label} output` },
          ]}
        />
      </div>

      <dl
        className="grid shrink-0 grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]"
        aria-live="polite"
      >
        <Stat label="Records" value={summary.count.toLocaleString()} detail={`of ${totalExpenses.toLocaleString()} total`} />
        <Stat label="Total" value={formatCurrency(summary.total)} detail={`${formatCurrency(summary.average)} average`} />
        <Stat
          label="Date span"
          value={summary.firstDate && summary.lastDate ? describeRange(summary.firstDate, summary.lastDate) : "—"}
          detail={summary.firstDate ? "earliest to latest" : "no records"}
        />
        <Stat
          label={pages !== null ? "Document" : "Columns"}
          value={pages !== null ? `${pages} page${pages === 1 ? "" : "s"}` : `${options.columns.length} of 4`}
          detail={
            pages !== null
              ? `Letter, ${options.pdf.orientation}`
              : orderColumns(options.columns).map((c) => COLUMN_LABELS[c]).join(", ") || "none selected"
          }
        />
      </dl>

      {summary.total > 0 && (
        <div className="shrink-0 px-5 pt-3 sm:px-6">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Share of total by category">
            {summary.byCategory.map((c) => (
              <span
                key={c.category}
                style={{ width: `${(c.total / summary.total) * 100}%`, background: CATEGORY_META[c.category].color }}
                title={`${c.category}: ${formatCurrency(c.total)} (${formatPercent(c.total / summary.total)})`}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            {summary.byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_META[c.category].color }} aria-hidden />
                {c.category}
                <span className="tabular-nums text-muted">{formatPercent(c.total / summary.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`m-5 mt-3 flex min-h-[18rem] flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface transition-opacity sm:mx-6 lg:min-h-0 ${
          isStale ? "opacity-60" : ""
        }`}
      >
        {blocking || rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            {blocking ? (
              <AlertCircle className="h-8 w-8 text-bad" aria-hidden />
            ) : (
              <FileSearch className="h-8 w-8 text-muted" aria-hidden />
            )}
            <p className="mt-3 font-medium text-ink">{ISSUE_MESSAGES[blocking ?? "no-records"]}</p>
            <p className="mt-1 max-w-xs text-sm text-ink-2">
              {blocking ? "Fix the highlighted setting to see a preview." : "Try widening the date range or adding categories."}
            </p>
          </div>
        ) : view === "table" ? (
          <PreviewTable options={options} selection={selection} />
        ) : options.format === "pdf" ? (
          <PageLayout options={options} selection={selection} />
        ) : (
          <FileOutput options={options} selection={selection} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-ink" title={value}>
        {value}
      </dd>
      <dd className="truncate text-xs text-ink-2">{detail}</dd>
    </div>
  );
}

function PreviewTable({ options, selection }: { options: ExportOptions; selection: ExportSelection }) {
  const columns = orderColumns(options.columns);
  const visible = selection.rows.slice(0, TABLE_LIMIT);
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-2">
            <tr>
              <th scope="col" className="w-10 px-3 py-2 text-right font-semibold text-muted">
                #
              </th>
              {columns.map((c) => (
                <th key={c} scope="col" className={`whitespace-nowrap px-3 py-2 ${c === "amount" ? "text-right" : ""}`}>
                  {COLUMN_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row, i) => (
              <tr key={row.id} className="hover:bg-surface-2/50">
                <td className="px-3 py-2 text-right text-xs tabular-nums text-muted">{i + 1}</td>
                {columns.map((c) => (
                  <td
                    key={c}
                    className={`px-3 py-2 ${
                      c === "amount"
                        ? "whitespace-nowrap text-right font-medium tabular-nums text-ink"
                        : c === "description"
                          ? "max-w-[18rem] truncate text-ink"
                          : "whitespace-nowrap text-ink-2"
                    }`}
                    title={c === "description" ? row.description : undefined}
                  >
                    {c === "date" ? (
                      formatDisplayDate(row.date)
                    ) : c === "category" ? (
                      <CategoryBadge category={row.category} />
                    ) : c === "amount" ? (
                      formatCurrency(row.amount)
                    ) : (
                      row.description
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="shrink-0 border-t border-line bg-surface-2/40 px-3 py-2 text-xs text-ink-2">
        {selection.rows.length > TABLE_LIMIT
          ? `Showing the first ${TABLE_LIMIT} of ${selection.rows.length.toLocaleString()} records. All of them will be exported.`
          : `Showing all ${selection.rows.length.toLocaleString()} record${selection.rows.length === 1 ? "" : "s"}.`}
      </p>
    </>
  );
}

/** Renders the real CSV/JSON output for the first few records, using the same builder as the download. */
function FileOutput({ options, selection }: { options: ExportOptions; selection: ExportSelection }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sample = { ...selection, rows: selection.rows.slice(0, FILE_PREVIEW_ROWS) };
    EXPORT_FORMATS[options.format]
      .build({ options, selection: sample, generatedAt: new Date(), onProgress: () => {}, checkpoint: async () => {} })
      .then((blob) => blob.text())
      .then((value) => {
        if (!cancelled) setText(value.replace(/^﻿/, ""));
      });
    return () => {
      cancelled = true;
    };
  }, [options, selection]);

  const truncated = selection.rows.length > FILE_PREVIEW_ROWS;
  return (
    <>
      <pre className="min-h-0 flex-1 overflow-auto bg-surface-2/30 p-3 font-mono text-xs leading-relaxed text-ink">
        {text === null ? <span className="text-muted">Rendering…</span> : text.replace(/\t/g, "  →  ")}
      </pre>
      <p className="shrink-0 border-t border-line bg-surface-2/40 px-3 py-2 text-xs text-ink-2">
        {truncated
          ? `Output for the first ${FILE_PREVIEW_ROWS} of ${selection.rows.length.toLocaleString()} records. The file includes all of them.`
          : "Exact file contents."}
        {options.format === "csv" && options.csv.delimiter === "\t" && " Tabs are shown as →."}
      </p>
    </>
  );
}

function PageLayout({ options, selection }: { options: ExportOptions; selection: ExportSelection }) {
  const { pages } = planReport(options, selection.summary);
  const landscape = options.pdf.orientation === "landscape";
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-surface-2/40 p-4">
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
        {pages.map((page, i) => (
          <li key={i} className="flex flex-col items-center gap-2">
            <div
              className={`relative w-full overflow-hidden rounded-sm border border-line bg-white p-2 shadow-card ${
                landscape ? "aspect-[11/8.5]" : "aspect-[8.5/11]"
              }`}
              aria-hidden
            >
              {i === 0 && (
                <>
                  <div className="h-1.5 w-8 rounded-sm bg-[#256abf]" />
                  <div className="mt-1.5 h-2 w-3/5 rounded-sm bg-neutral-800" />
                  <div className="mt-1.5 grid grid-cols-4 gap-0.5">
                    {[0, 1, 2, 3].map((n) => (
                      <div key={n} className="h-3 rounded-[1px] bg-neutral-200" />
                    ))}
                  </div>
                  {options.pdf.includeBreakdown &&
                    selection.summary.byCategory.map((c) => (
                      <div key={c.category} className="mt-0.5 flex items-center gap-0.5">
                        <div className="h-0.5 w-2 bg-neutral-300" />
                        <div
                          className="h-0.5"
                          style={{
                            width: `${(c.total / Math.max(selection.summary.byCategory[0].total, 0.01)) * 50}%`,
                            background: CATEGORY_META[c.category].color,
                          }}
                        />
                      </div>
                    ))}
                </>
              )}
              <div className="mt-1.5 h-1 bg-neutral-200" />
              {Array.from({ length: Math.min(page.end - page.start, 40) }, (_, r) => (
                <div key={r} className={`h-[3px] ${r % 2 ? "bg-neutral-100" : "bg-white"}`}>
                  <div className="mx-0.5 h-px translate-y-px bg-neutral-300" />
                </div>
              ))}
              <div className="absolute inset-x-2 bottom-1.5 h-px bg-neutral-200" />
            </div>
            <p className="text-center text-xs text-ink-2">
              <span className="font-medium text-ink">Page {i + 1}</span>
              <br />
              Rows {page.start + 1}–{page.end}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
