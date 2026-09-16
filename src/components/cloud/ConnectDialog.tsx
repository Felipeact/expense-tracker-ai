"use client";

import { Check, Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useCloud } from "@/hooks/useCloud";
import type { DestinationMeta } from "@/lib/cloud/destinations";
import { ConnectorMark } from "./primitives";

type Phase = "consent" | "granting";

/**
 * Stands in for an OAuth consent screen: account, scopes, and an explicit grant.
 * Nothing leaves the browser — the banner says so rather than implying otherwise.
 */
export function ConnectDialog({
  meta,
  open,
  onClose,
}: {
  meta: DestinationMeta | null;
  open: boolean;
  onClose: () => void;
}) {
  const { connect } = useCloud();
  const [account, setAccount] = useState("");
  const [phase, setPhase] = useState<Phase>("consent");

  useEffect(() => {
    if (open) {
      setAccount("");
      setPhase("consent");
    }
  }, [open, meta?.id]);

  useEffect(() => {
    if (phase !== "granting" || !meta) return;
    // A beat of latency so the handshake reads as a real round trip.
    const timer = window.setTimeout(() => {
      connect(meta.id, account);
      onClose();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [phase, meta, account, connect, onClose]);

  if (!meta) return null;

  return (
    <Modal
      open={open}
      onClose={phase === "granting" ? () => undefined : onClose}
      title={`Connect ${meta.name}`}
      description="Review what Spendwise will be able to do."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-3 rounded-xl border border-line bg-surface-2/60 px-4 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            <span className="h-1 w-1 rounded-full bg-muted" />
            <span className="h-1 w-1 rounded-full bg-muted" />
            <span className="h-1 w-1 rounded-full bg-muted" />
          </span>
          <ConnectorMark accent={meta.accent} icon={meta.icon} />
        </div>

        {!meta.implicit && (
          <label className="block">
            <span className="label">
              {meta.id === "webhook" ? "Endpoint URL" : meta.id === "slack" ? "Channel" : "Account"}
            </span>
            <input
              className="input"
              value={account}
              data-autofocus
              disabled={phase === "granting"}
              placeholder={meta.accountPlaceholder}
              onChange={(event) => setAccount(event.target.value)}
            />
          </label>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            Spendwise is requesting permission to:
          </p>
          <ul className="space-y-2">
            {meta.scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-2.5 text-sm text-ink-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
                {scope}
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-xs text-ink-2">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Simulated connection. No network request is made and no credentials are collected — the
            grant is recorded in this browser so you can see the full flow.
          </span>
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={phase === "granting"}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setPhase("granting")}
            disabled={phase === "granting"}
          >
            {phase === "granting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Connecting
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden />
                {meta.connectLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
