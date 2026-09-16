"use client";

import { AlertCircle, CheckCircle2, Download, History, RotateCw, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { destination, FORMAT_META } from "@/lib/cloud/destinations";
import { formatRelative } from "@/lib/cloud/schedule";
import { downloadText, filenameFor, formatBytes, serialize } from "@/lib/cloud/serialize";
import { compileTemplate, template } from "@/lib/cloud/templates";
import type { HistoryEntry, Trigger } from "@/lib/cloud/types";
import { ConnectorMark, SectionHeader } from "./primitives";

const TRIGGER_LABEL: Record<Trigger, string> = {
  manual: "Manual",
  schedule: "Scheduled",
  retry: "Retry",
  "catch-up": "Catch-up",
};

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function HistoryPanel() {
  const { history, clearHistory } = useCloud();

  const grouped = useMemo(() => {
    const groups = new Map<string, HistoryEntry[]>();
    for (const entry of history) {
      const key = entry.createdAt.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [history]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Export history"
        subtitle={`${history.length} ${history.length === 1 ? "run" : "runs"} recorded, newest first.`}
        action={
          history.length > 0 && (
            <button type="button" className="btn-ghost" onClick={clearHistory}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear history
            </button>
          )
        }
      />

      {history.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-5 py-12 text-center">
          <History className="h-8 w-8 text-muted" aria-hidden />
          <div>
            <p className="font-medium text-ink">Nothing has shipped yet</p>
            <p className="mt-1 text-sm text-ink-2">
              Every delivery — manual, scheduled or retried — gets logged here with its size and row count.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, entries]) => (
            <section key={day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {dayFormat.format(new Date(`${day}T12:00:00`))}
              </h3>
              <ul className="card divide-y divide-line overflow-hidden">
                {entries.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { runExport, isConnected } = useCloud();
  const { expenses } = useExpenses();
  const meta = destination(entry.destinationId);
  const delivered = entry.status === "delivered";
  const connected = isConnected(entry.destinationId);

  const regenerate = () => {
    const compiled = compileTemplate(entry.templateId, expenses);
    downloadText(
      serialize(compiled, entry.format),
      filenameFor(compiled, entry.format),
      FORMAT_META[entry.format].mime,
    );
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <ConnectorMark accent={meta.accent} icon={meta.icon} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{entry.label}</p>
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            {TRIGGER_LABEL[entry.trigger]}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {timeFormat.format(new Date(entry.createdAt))} · {template(entry.templateId).name} ·{" "}
          {FORMAT_META[entry.format].label}
          {delivered && ` · ${entry.rows.toLocaleString()} rows · ${formatBytes(entry.bytes)}`}
          {entry.meta?.recipients && ` · to ${entry.meta.recipients}`}
        </p>
        {entry.error && (
          <p className="mt-1 flex items-start gap-1.5 text-xs text-bad">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {entry.error}
          </p>
        )}
      </div>

      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          delivered ? "text-good" : "text-bad"
        }`}
      >
        {delivered ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        ) : (
          <AlertCircle className="h-4 w-4" aria-hidden />
        )}
        <span className="hidden sm:inline">{delivered ? "Delivered" : "Failed"}</span>
      </span>

      <span className="hidden text-xs text-muted md:inline">{formatRelative(entry.createdAt)}</span>

      <div className="flex gap-1">
        <button
          type="button"
          className="icon-btn"
          onClick={regenerate}
          title="Rebuild this report from today's data and download it"
          aria-label="Download again"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={!connected}
          onClick={() =>
            runExport({
              destinationId: entry.destinationId,
              templateId: entry.templateId,
              format: entry.format,
              trigger: "retry",
              label: entry.label,
              meta: entry.meta,
            })
          }
          title={connected ? "Run this export again" : `${meta.name} is not connected`}
          aria-label="Run again"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
