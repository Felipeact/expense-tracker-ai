"use client";

import { ChevronDown, CloudOff, Download, Loader2, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { STAGE_LABEL, useCloud } from "@/hooks/useCloud";
import { destination } from "@/lib/cloud/destinations";
import { formatBytes } from "@/lib/cloud/serialize";
import { isActiveStage, type ExportJob } from "@/lib/cloud/types";
import { ConnectorMark, ProgressBar } from "./primitives";

/**
 * A persistent sync widget, the way a desktop cloud client shows uploads:
 * visible on every page, survives navigation, and keeps finished runs around
 * long enough to notice them.
 */
export function ActivityTray() {
  const { jobs, activeJobs, online, cancelJob, dismissJob, retryJob, downloadJob, ready } = useCloud();
  const [collapsed, setCollapsed] = useState(false);

  // Re-open the tray whenever new work starts.
  useEffect(() => {
    if (activeJobs.length > 0) setCollapsed(false);
  }, [activeJobs.length]);

  const visible = jobs.filter((job) => job.stage !== "canceled").slice(0, 6);
  if (!ready || visible.length === 0) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[22rem]">
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-2.5 border-b border-line px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
        >
          {activeJobs.length > 0 ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-ink" aria-hidden />
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-good" aria-hidden />
          )}
          <span className="flex-1 text-sm font-medium text-ink">
            {activeJobs.length > 0
              ? `${activeJobs.length} export${activeJobs.length === 1 ? "" : "s"} running`
              : "Activity"}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted transition-transform ${collapsed ? "" : "rotate-180"}`}
            aria-hidden
          />
        </button>

        {!collapsed && (
          <>
            {!online && (
              <p className="flex items-center gap-2 border-b border-line bg-bad-soft px-4 py-2 text-xs text-ink">
                <CloudOff className="h-3.5 w-3.5 shrink-0 text-bad" aria-hidden />
                Offline — queued work resumes automatically.
              </p>
            )}
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {visible.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onCancel={() => cancelJob(job.id)}
                  onDismiss={() => dismissJob(job.id)}
                  onRetry={() => retryJob(job.id)}
                  onDownload={() => downloadJob(job.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function JobRow({
  job,
  onCancel,
  onDismiss,
  onRetry,
  onDownload,
}: {
  job: ExportJob;
  onCancel: () => void;
  onDismiss: () => void;
  onRetry: () => void;
  onDownload: () => void;
}) {
  const meta = destination(job.destinationId);
  const active = isActiveStage(job.stage);
  const failed = job.stage === "failed";

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-2.5">
        <ConnectorMark accent={meta.accent} icon={meta.icon} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{job.label}</p>
          <p className="mt-0.5 text-xs text-muted">
            {STAGE_LABEL[job.stage]}
            {active && job.stage !== "offline" && ` · ${Math.round(job.progress)}%`}
            {job.stage === "done" && ` · ${job.rows.toLocaleString()} rows · ${formatBytes(job.bytes)}`}
            {job.attempt > 1 && ` · attempt ${job.attempt}`}
          </p>
        </div>
        {failed && (
          <button type="button" className="icon-btn h-7 w-7" onClick={onRetry} aria-label="Retry export">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        )}
        {job.stage === "done" && (
          <button
            type="button"
            className="icon-btn h-7 w-7"
            onClick={onDownload}
            aria-label="Save a copy of what was delivered"
            title="Save a copy"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          className="icon-btn h-7 w-7"
          onClick={active ? onCancel : onDismiss}
          aria-label={active ? "Cancel export" : "Dismiss"}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {active && (
        <div className="mt-2">
          <ProgressBar value={job.progress} />
        </div>
      )}
      {failed && job.error && <p className="mt-1.5 text-xs text-bad">{job.error}</p>}
    </li>
  );
}
