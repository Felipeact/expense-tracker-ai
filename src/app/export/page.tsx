"use client";

import { CloudOff, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DestinationsPanel } from "@/components/cloud/DestinationsPanel";
import { HistoryPanel } from "@/components/cloud/HistoryPanel";
import { OverviewPanel } from "@/components/cloud/OverviewPanel";
import { SchedulesPanel } from "@/components/cloud/SchedulesPanel";
import { SharePanel } from "@/components/cloud/SharePanel";
import { EXPORT_TABS, isExportTab, type ExportTab } from "@/components/cloud/tabs";
import { TemplatesPanel } from "@/components/cloud/TemplatesPanel";
import { StatusDot } from "@/components/cloud/primitives";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";

export default function ExportPage() {
  const { isLoaded, expenses } = useExpenses();
  const { ready, online, activeJobs, connections, resetCloud } = useCloud();
  const [tab, setTab] = useState<ExportTab>("overview");

  // The tab lives in the hash so a panel can be linked to directly.
  useEffect(() => {
    const read = () => {
      const value = window.location.hash.replace(/^#/, "");
      if (isExportTab(value)) setTab(value);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const goTo = useCallback((next: ExportTab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "overview" ? window.location.pathname : `#${next}`);
  }, []);

  if (!isLoaded || !ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-2">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Connecting to your workspace…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Export &amp; Sync</h1>
          <p className="mt-1 text-sm text-ink-2">
            {expenses.length.toLocaleString()} expenses, ready to land wherever you need them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2">
            {online ? (
              <>
                <StatusDot tone={activeJobs.length > 0 ? "syncing" : "live"} />
                {activeJobs.length > 0 ? `Syncing ${activeJobs.length}` : "All systems go"}
              </>
            ) : (
              <>
                <CloudOff className="h-3.5 w-3.5 text-bad" aria-hidden />
                Offline
              </>
            )}
          </span>
          {connections.length > 0 && (
            <button
              type="button"
              className="icon-btn"
              onClick={resetCloud}
              title="Disconnect everything and clear the cloud workspace"
              aria-label="Reset cloud workspace"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Export sections"
          className="inline-flex min-w-full gap-1 border-b border-line sm:min-w-0"
        >
          {EXPORT_TABS.map(({ value, label, icon: Icon }) => {
            const active = value === tab;
            return (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => goTo(value)}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  active
                    ? "border-b-accent text-ink"
                    : "border-b-transparent text-ink-2 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" && <OverviewPanel onGoTo={goTo} />}
      {tab === "destinations" && <DestinationsPanel />}
      {tab === "templates" && <TemplatesPanel />}
      {tab === "schedules" && <SchedulesPanel />}
      {tab === "share" && <SharePanel />}
      {tab === "history" && <HistoryPanel />}
    </div>
  );
}
