"use client";

import { AlertTriangle, Link2, Plug, RefreshCw, Send, Unplug } from "lucide-react";
import { useState } from "react";
import { useCloud } from "@/hooks/useCloud";
import {
  DESTINATION_CATEGORIES,
  DESTINATIONS,
  FORMAT_META,
  type DestinationMeta,
} from "@/lib/cloud/destinations";
import { formatRelative } from "@/lib/cloud/schedule";
import type { DestinationId } from "@/lib/cloud/types";
import { ConnectDialog } from "./ConnectDialog";
import { ConnectorMark, Pill, SectionHeader, type StatusTone } from "./primitives";
import { RunDialog } from "./RunDialog";

export function DestinationsPanel() {
  const [connecting, setConnecting] = useState<DestinationMeta | null>(null);
  const [running, setRunning] = useState<DestinationId | null>(null);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Connections"
        subtitle="Every connector is simulated end to end — consent screen, token expiry, retries and all."
      />

      {DESTINATION_CATEGORIES.map((category) => {
        const items = DESTINATIONS.filter((d) => d.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{category}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((meta) => (
                <DestinationCard
                  key={meta.id}
                  meta={meta}
                  onConnect={() => setConnecting(meta)}
                  onRun={() => setRunning(meta.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <ConnectDialog meta={connecting} open={connecting !== null} onClose={() => setConnecting(null)} />
      <RunDialog destinationId={running} open={running !== null} onClose={() => setRunning(null)} />
    </div>
  );
}

function DestinationCard({
  meta,
  onConnect,
  onRun,
}: {
  meta: DestinationMeta;
  onConnect: () => void;
  onRun: () => void;
}) {
  const { connectionFor, disconnect, reauthorize, driftFor, inSync, activeJobs } = useCloud();
  const connection = connectionFor(meta.id);
  const busy = activeJobs.some((job) => job.destinationId === meta.id);
  const expired = connection ? new Date(connection.expiresAt) < new Date() : false;
  const drift = connection ? driftFor(meta.id) : 0;
  const synced = connection ? inSync(meta.id) : false;

  let tone: StatusTone = "idle";
  let status = "Not connected";
  if (busy) {
    tone = "syncing";
    status = "Syncing";
  } else if (expired) {
    tone = "bad";
    status = "Needs reauthorization";
  } else if (connection && synced) {
    tone = "live";
    status = "Up to date";
  } else if (connection && drift > 0) {
    tone = "warn";
    status = `${drift} ${drift === 1 ? "change" : "changes"} pending`;
  } else if (connection) {
    tone = "live";
    status = "Connected";
  }

  return (
    <article
      className={`card flex flex-col gap-4 p-4 transition-colors ${
        connection ? "" : "border-dashed bg-surface/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <ConnectorMark accent={meta.accent} icon={meta.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-semibold text-ink">{meta.name}</h4>
            {meta.implicit && (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                Local
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-2">{meta.tagline}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={tone}>{status}</Pill>
        {connection && (
          <span className="truncate text-xs text-muted">
            {connection.account}
            {connection.lastSyncAt && ` · synced ${formatRelative(connection.lastSyncAt)}`}
          </span>
        )}
      </div>

      {expired && (
        <p className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-ink">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bad" aria-hidden />
          The access grant expired {formatRelative(connection!.expiresAt)}. Scheduled runs to this
          destination will keep failing until it is renewed.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {meta.formats.map((format) => (
          <span
            key={format}
            className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2"
          >
            {FORMAT_META[format].label}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
        {!connection ? (
          <button type="button" className="btn-primary" onClick={onConnect}>
            <Plug className="h-4 w-4" aria-hidden />
            Connect
          </button>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={onRun} disabled={expired}>
              <Send className="h-4 w-4" aria-hidden />
              Export now
            </button>
            {expired && (
              <button type="button" className="btn-primary" onClick={() => reauthorize(meta.id)}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                Reauthorize
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={() => disconnect(meta.id)}>
              <Unplug className="h-4 w-4" aria-hidden />
              Disconnect
            </button>
          </>
        )}
      </div>

      {connection && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
          <Link2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {meta.effect}
        </p>
      )}
    </article>
  );
}
