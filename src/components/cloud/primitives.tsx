"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { formatCurrency } from "@/lib/format";
import type { CompiledSheet } from "@/lib/cloud/templates";

export type StatusTone = "live" | "syncing" | "warn" | "idle" | "bad";

const TONE_COLOR: Record<StatusTone, string> = {
  live: "bg-good",
  syncing: "bg-accent",
  warn: "bg-[color:var(--cat-entertainment)]",
  idle: "bg-muted",
  bad: "bg-bad",
};

/** Small status dot; the syncing tone pulses so background work reads as alive. */
export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 shrink-0 ${className ?? ""}`} aria-hidden>
      {tone === "syncing" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${TONE_COLOR[tone]}`} />
    </span>
  );
}

export function Pill({
  tone = "idle",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-2.5 py-1 text-xs font-medium text-ink-2 ${className ?? ""}`}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "bad" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
          tone === "bad" ? "bg-bad" : "bg-accent"
        }`}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Copy-to-clipboard button that confirms inline rather than via a toast. */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className={`btn-secondary ${className ?? ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard access can be denied; the field stays selectable instead.
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-good" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A spreadsheet-style grid with row numbers and column letters — the preview
 * that makes a "live sheet" destination feel like the real thing.
 */
export function SheetGrid({ sheet, maxRows = 8 }: { sheet: CompiledSheet; maxRows?: number }) {
  const rows = sheet.rows.slice(0, maxRows);
  const hidden = sheet.rows.length - rows.length;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface-2 text-muted">
              <th className="w-9 border-b border-r border-line px-2 py-1.5 text-center font-normal" />
              {sheet.columns.map((_, i) => (
                <th key={i} className="border-b border-r border-line px-2 py-1.5 text-center font-normal">
                  {String.fromCharCode(65 + i)}
                </th>
              ))}
            </tr>
            <tr className="bg-surface">
              <td className="border-b border-r border-line bg-surface-2 px-2 py-1.5 text-center text-muted">1</td>
              {sheet.columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap border-b border-r border-line px-2 py-1.5 text-left font-semibold text-ink"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <td className="border-b border-r border-line bg-surface-2 px-2 py-1.5 text-center text-muted">
                  {r + 2}
                </td>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`whitespace-nowrap border-b border-r border-line px-2 py-1.5 text-ink ${
                      sheet.currencyColumns.includes(c) ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {sheet.currencyColumns.includes(c) && typeof cell === "number"
                      ? formatCurrency(cell)
                      : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={sheet.columns.length + 1}
                  className="border-b border-line px-3 py-6 text-center text-ink-2"
                >
                  No rows in range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <p className="border-t border-line bg-surface-2/60 px-3 py-1.5 text-xs text-muted">
          {hidden.toLocaleString()} more {hidden === 1 ? "row" : "rows"} in the delivered file
        </p>
      )}
    </div>
  );
}

/** Wordless brand tile for a connector, sized to sit in a card header. */
export function ConnectorMark({
  accent,
  icon: Icon,
  size = "md",
}: {
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${box}`}
      style={{ backgroundColor: `${accent}1f`, color: accent }}
      aria-hidden
    >
      <Icon className={glyph} />
    </span>
  );
}
