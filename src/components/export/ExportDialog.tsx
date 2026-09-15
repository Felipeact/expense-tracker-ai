"use client";

import { AlertCircle, Download, Info, Loader2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useExpenses } from "@/hooks/useExpenses";
import { resolveFilename, suggestFilename } from "@/lib/export/filename";
import { EXPORT_FORMATS } from "@/lib/export/formats";
import { savePreferences } from "@/lib/export/preferences";
import { ExportCancelledError, runExport, type ExportProgress, type ExportStage } from "@/lib/export/run";
import { findExportIssue, ISSUE_MESSAGES, selectForExport } from "@/lib/export/select";
import { formatCurrency } from "@/lib/format";
import { CATEGORIES, type Category } from "@/lib/types";
import { ExportPreview } from "./ExportPreview";
import { ExportSettings } from "./ExportSettings";
import { useExportOptions, type ExportSeed } from "./useExportOptions";

const STAGE_LABELS: Record<ExportStage, string> = {
  preparing: "Preparing records",
  generating: "Generating",
  saving: "Saving file",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface ExportDialogProps {
  open: boolean;
  seed: ExportSeed;
  onClose: () => void;
}

export function ExportDialog({ open, seed, onClose }: ExportDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      flush
      title="Export expenses"
      description="Choose a format and scope, check the preview, then download."
    >
      {open && <ExportWorkspace seed={seed} onDone={onClose} />}
    </Modal>
  );
}

function ExportWorkspace({ seed, onDone }: { seed: ExportSeed; onDone: () => void }) {
  const { expenses } = useExpenses();
  const toast = useToast();
  const { options, filenameEdited, dispatch } = useExportOptions(seed);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [busy, setBusy] = useState(false);
  // Outcomes that leave the dialog open are reported in its footer; a toast would sit on top of the buttons.
  const [notice, setNotice] = useState<"cancelled" | "failed" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selection = useMemo(() => selectForExport(expenses, options), [expenses, options]);
  const issue = findExportIssue(options, selection);

  // The preview can lag a keystroke behind on large datasets without blocking the controls.
  const deferredOptions = useDeferredValue(options);
  const previewSelection = useMemo(() => selectForExport(expenses, deferredOptions), [expenses, deferredOptions]);
  const previewIssue = findExportIssue(deferredOptions, previewSelection);

  const { from, to } = options;
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    const inRange = selectForExport(expenses, { from, to, categories: [...CATEGORIES], sort: "date-desc" }).rows;
    for (const e of inRange) counts[e.category]++;
    return counts;
  }, [expenses, from, to]);

  const format = EXPORT_FORMATS[options.format];
  const suggested = suggestFilename(options);
  const finalName = resolveFilename(options.filename, format.extension, suggested);

  useEffect(() => setNotice(null), [options]);

  // Closing the dialog mid-export cancels it rather than leaving a download to appear later.
  useEffect(() => () => abortRef.current?.abort(), []);

  const startExport = async () => {
    if (issue || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setNotice(null);
    setProgress({ stage: "preparing", ratio: 0 });
    try {
      const result = await runExport(options, selection, { signal: controller.signal, onProgress: setProgress });
      savePreferences(options);
      toast(
        `Exported ${result.count.toLocaleString()} record${result.count === 1 ? "" : "s"} to ${result.filename} (${formatBytes(result.size)}).`,
      );
      onDone();
    } catch (error) {
      if (!(error instanceof ExportCancelledError)) console.error(error);
      setNotice(error instanceof ExportCancelledError ? "cancelled" : "failed");
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:overflow-hidden">
        <fieldset
          disabled={busy}
          className="min-w-0 border-b border-line disabled:opacity-60 lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          <legend className="sr-only">Export settings</legend>
          <ExportSettings
            options={options}
            dispatch={dispatch}
            categoryCounts={categoryCounts}
            rangeInvalid={issue === "invalid-range"}
            filenameEdited={filenameEdited}
            suggestedFilename={suggested}
          />
        </fieldset>
        <div className="bg-surface-2/30 lg:min-h-0">
          <ExportPreview
            options={deferredOptions}
            selection={previewSelection}
            issue={previewIssue}
            totalExpenses={expenses.length}
            isStale={deferredOptions !== options}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-5 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 text-sm" aria-live="polite">
            {progress ? (
              <div className="max-w-md">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">
                    {STAGE_LABELS[progress.stage]}
                    {progress.stage === "generating" && ` ${format.label}`}…
                  </span>
                  <span className="tabular-nums text-ink-2">{Math.round(progress.ratio * 100)}%</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  role="progressbar"
                  aria-label="Export progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress.ratio * 100)}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                    style={{ width: `${progress.ratio * 100}%` }}
                  />
                </div>
              </div>
            ) : notice === "failed" ? (
              <p className="flex items-center gap-2 font-medium text-bad" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                Export failed. Please try again.
              </p>
            ) : notice === "cancelled" ? (
              <p className="flex items-center gap-2 text-ink-2">
                <Info className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                Export cancelled. Nothing was downloaded.
              </p>
            ) : issue ? (
              <p className="flex items-center gap-2 font-medium text-bad">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {ISSUE_MESSAGES[issue]}
              </p>
            ) : (
              <p className="truncate text-ink-2">
                <span className="font-semibold text-ink">{selection.summary.count.toLocaleString()}</span> record
                {selection.summary.count === 1 ? "" : "s"} ·{" "}
                <span className="font-semibold tabular-nums text-ink">{formatCurrency(selection.summary.total)}</span>
                <span className="mx-1.5 text-muted">→</span>
                <span className="font-mono text-xs text-ink" title={finalName}>
                  {finalName}
                </span>
              </p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => (busy ? abortRef.current?.abort() : onDone())}
            >
              {busy ? "Cancel export" : "Cancel"}
            </button>
            <button type="button" className="btn-primary sm:min-w-[11rem]" onClick={startExport} disabled={!!issue || busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden />
                  Export {format.label}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
