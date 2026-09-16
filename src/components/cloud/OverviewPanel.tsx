"use client";

import {
  AlarmClock,
  AlertTriangle,
  CloudOff,
  CloudUpload,
  Database,
  Plug,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { destination } from "@/lib/cloud/destinations";
import { formatRelative, nextRunFor } from "@/lib/cloud/schedule";
import { formatBytes } from "@/lib/cloud/serialize";
import type { DestinationId } from "@/lib/cloud/types";
import { ConnectorMark, Pill, SectionHeader, StatusDot, type StatusTone } from "./primitives";
import { RunDialog } from "./RunDialog";
import type { ExportTab } from "./tabs";

export function OverviewPanel({ onGoTo }: { onGoTo: (tab: ExportTab) => void }) {
  const {
    connections,
    schedules,
    history,
    shares,
    activeJobs,
    online,
    driftFor,
    inSync,
    vaultUsage,
    vaultQuota,
    seedDemoWorkspace,
  } = useCloud();
  const { expenses } = useExpenses();
  const [running, setRunning] = useState<DestinationId | null>(null);

  const now = new Date();
  const totalDrift = useMemo(
    () => connections.reduce((max, c) => Math.max(max, driftFor(c.destinationId)), 0),
    [connections, driftFor],
  );
  const lastDelivery = history.find((h) => h.status === "delivered");
  const expired = connections.filter((c) => new Date(c.expiresAt) < now);
  const overdue = schedules.filter((s) => !s.paused && nextRunFor(s) <= now);
  const failures = history.filter((h) => h.status === "failed").slice(0, 3);

  let tone: StatusTone = "live";
  let headline = "Everything is backed up";
  let detail = lastDelivery
    ? `Last delivery ${formatRelative(lastDelivery.createdAt)} to ${destination(lastDelivery.destinationId).name}.`
    : "No deliveries yet.";

  if (!online) {
    tone = "bad";
    headline = "Offline";
    detail = "Queued exports will resume the moment the connection comes back.";
  } else if (activeJobs.length > 0) {
    tone = "syncing";
    headline = `Syncing ${activeJobs.length} export${activeJobs.length === 1 ? "" : "s"}`;
    detail = activeJobs.map((job) => job.label).join(" · ");
  } else if (expired.length > 0) {
    tone = "bad";
    headline = `${expired.length} connection${expired.length === 1 ? "" : "s"} need attention`;
    detail = "An access grant expired. Scheduled runs will fail until it is renewed.";
  } else if (totalDrift > 0) {
    tone = "warn";
    headline = `${totalDrift} change${totalDrift === 1 ? "" : "s"} not backed up`;
    detail = "Some destinations are behind your latest expenses.";
  }

  if (connections.length === 0) {
    return (
      <div className="space-y-5">
        <div className="card overflow-hidden">
          <div className="border-b border-line bg-gradient-to-br from-accent-soft via-surface to-surface px-6 py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
              <CloudUpload className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
              Put your expenses where you already work
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
              Connect a destination and Spendwise keeps it current — on a schedule, in the format
              that side expects, with a log of everything it sent.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" className="btn-primary" onClick={() => onGoTo("destinations")}>
                <Plug className="h-4 w-4" aria-hidden />
                Connect a destination
              </button>
              <button type="button" className="btn-secondary" onClick={seedDemoWorkspace}>
                <Sparkles className="h-4 w-4" aria-hidden />
                Load a demo workspace
              </button>
            </div>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            {[
              ["Templates", "Tax, monthly, category and claim reports, each shaped for its reader."],
              ["Schedules", "Nightly, weekly or monthly runs that catch up on anything missed."],
              ["Shareables", "Links and QR codes that carry the report without a server."],
            ].map(([title, copy]) => (
              <div key={title} className="bg-surface px-5 py-4">
                <p className="font-medium text-ink">{title}</p>
                <p className="mt-1 text-sm text-ink-2">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-accent-soft/70 via-surface to-surface px-5 py-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-1">
              <StatusDot tone={tone} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{headline}</h2>
              <p className="mt-0.5 truncate text-sm text-ink-2">{detail}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!online}
              onClick={() => setRunning(connections[0].destinationId)}
            >
              {online ? (
                <CloudUpload className="h-4 w-4" aria-hidden />
              ) : (
                <CloudOff className="h-4 w-4" aria-hidden />
              )}
              Back up now
            </button>
            <button type="button" className="btn-secondary" onClick={() => onGoTo("share")}>
              <Share2 className="h-4 w-4" aria-hidden />
              Share
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {[
            ["Connections", String(connections.length)],
            ["Active rules", String(schedules.filter((s) => !s.paused).length)],
            ["Runs logged", String(history.length)],
            ["Links shared", String(shares.length)],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {(expired.length > 0 || overdue.length > 0 || failures.length > 0) && (
        <section className="card border-[color:rgb(var(--bad)/0.3)]">
          <div className="border-b border-line px-5 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-bad" aria-hidden />
              Needs attention
            </h3>
          </div>
          <ul className="divide-y divide-line text-sm">
            {expired.map((connection) => (
              <li key={connection.destinationId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex-1 text-ink-2">
                  <strong className="font-medium text-ink">
                    {destination(connection.destinationId).name}
                  </strong>{" "}
                  grant expired {formatRelative(connection.expiresAt)}.
                </span>
                <button type="button" className="btn-ghost" onClick={() => onGoTo("destinations")}>
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Fix
                </button>
              </li>
            ))}
            {overdue.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex-1 text-ink-2">
                  <strong className="font-medium text-ink">{rule.name}</strong> is catching up on a
                  run due {formatRelative(nextRunFor(rule))}.
                </span>
                <button type="button" className="btn-ghost" onClick={() => onGoTo("schedules")}>
                  <AlarmClock className="h-4 w-4" aria-hidden />
                  View
                </button>
              </li>
            ))}
            {failures.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex-1 text-ink-2">
                  <strong className="font-medium text-ink">{entry.label}</strong> failed{" "}
                  {formatRelative(entry.createdAt)} — {entry.error}
                </span>
                <button type="button" className="btn-ghost" onClick={() => onGoTo("history")}>
                  Retry
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="border-b border-line px-5 py-4">
            <SectionHeader
              title="Connected destinations"
              subtitle="Drift is measured against each destination's last successful delivery."
            />
          </div>
          <ul className="divide-y divide-line">
            {connections.map((connection) => {
              const meta = destination(connection.destinationId);
              const drift = driftFor(connection.destinationId);
              const synced = inSync(connection.destinationId);
              const busy = activeJobs.some((job) => job.destinationId === connection.destinationId);
              return (
                <li key={connection.destinationId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <ConnectorMark accent={meta.accent} icon={meta.icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{meta.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {connection.account}
                      {connection.lastSyncAt
                        ? ` · synced ${formatRelative(connection.lastSyncAt)}`
                        : " · never synced"}
                    </p>
                  </div>
                  <Pill tone={busy ? "syncing" : synced ? "live" : drift > 0 ? "warn" : "idle"}>
                    {busy ? "Syncing" : synced ? "Up to date" : drift > 0 ? `${drift} pending` : "Idle"}
                  </Pill>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setRunning(connection.destinationId)}
                  >
                    Sync
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold text-ink">
            <Database className="h-4 w-4 text-muted" aria-hidden />
            Vault storage
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            Snapshot space used by local backups, trimmed by each rule&apos;s retention.
          </p>
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink">{formatBytes(vaultUsage)} used</span>
              <span className="tabular-nums text-muted">of {formatBytes(vaultQuota)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${Math.max(1.5, Math.min(100, (vaultUsage / vaultQuota) * 100))}%` }}
              />
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">Expenses tracked</dt>
              <dd className="tabular-nums text-ink">{expenses.length.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Snapshots kept</dt>
              <dd className="tabular-nums text-ink">
                {history.filter((h) => h.destinationId === "vault" && h.status === "delivered").length}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <RunDialog destinationId={running} open={running !== null} onClose={() => setRunning(null)} />
    </div>
  );
}
