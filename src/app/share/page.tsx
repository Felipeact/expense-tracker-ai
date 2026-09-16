"use client";

import { Clock, Download, FileWarning, Link2Off, Lock, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadText } from "@/lib/cloud/serialize";
import { isExpired, parseShareHash } from "@/lib/cloud/share";
import type { SharePayload } from "@/lib/cloud/types";
import { CATEGORY_META } from "@/lib/categories";
import { escapeCell } from "@/lib/csv";
import { formatDisplayDate } from "@/lib/dates";
import { formatCurrency, formatPercent } from "@/lib/format";
import { isCategory } from "@/lib/types";

type ViewState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "expired"; payload: SharePayload }
  | { status: "ready"; token: string; payload: SharePayload };

export default function SharedReportPage() {
  const [view, setView] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    const read = () => {
      const parsed = parseShareHash(window.location.hash);
      if (!parsed) return setView({ status: "invalid" });
      if (isExpired(parsed.payload)) return setView({ status: "expired", payload: parsed.payload });
      setView({ status: "ready", token: parsed.token, payload: parsed.payload });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2.5 px-4 sm:px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <Wallet className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-semibold text-ink">Spendwise</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">
            Shared report
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {view.status === "loading" && <p className="text-sm text-ink-2">Decoding link…</p>}
        {view.status === "invalid" && <InvalidLink />}
        {view.status === "expired" && <ExpiredLink payload={view.payload} />}
        {view.status === "ready" && <Report token={view.token} payload={view.payload} />}
      </main>
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Icon className="h-9 w-9 text-muted" aria-hidden />
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      <p className="max-w-sm text-sm text-ink-2">{children}</p>
    </div>
  );
}

function InvalidLink() {
  return (
    <Notice icon={Link2Off} title="This link has nothing to show">
      The report data lives inside the link itself, and this one is missing or was truncated when it
      was copied. Ask whoever sent it for the full URL.
    </Notice>
  );
}

function ExpiredLink({ payload }: { payload: SharePayload }) {
  return (
    <Notice icon={FileWarning} title="This link has expired">
      “{payload.t}” stopped being viewable on{" "}
      {new Date(payload.x).toLocaleDateString(undefined, { dateStyle: "long" })}. The sender can
      generate a fresh link at any time.
    </Notice>
  );
}

function Report({ token, payload }: { token: string; payload: SharePayload }) {
  const [total, count, average] = payload.s;
  const rows = payload.d ?? [];

  const saveCsv = () => {
    const header = ["Date", "Description", "Category", "Amount"];
    const body = rows.map((row) => [row[0], row[1], row[2], row[3].toFixed(2)]);
    const csv = [header, ...body].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    downloadText(csv, `spendwise-shared-${token}.csv`, "text/csv;charset=utf-8");
  };

  return (
    <article className="space-y-5">
      <header className="card px-5 py-5">
        <p className="text-xs uppercase tracking-wider text-muted">{payload.r}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{payload.t}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Generated {new Date(payload.g).toLocaleString()}
          </span>
          <span>Reference {token}</span>
          {payload.x > 0 && (
            <span>Viewable until {new Date(payload.x).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
          )}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {[
          ["Total", formatCurrency(total)],
          ["Transactions", count.toLocaleString()],
          ["Average", formatCurrency(average)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-4 py-3.5">
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="card px-5 py-5">
        <h2 className="text-base font-semibold text-ink">Where it went</h2>
        <ul className="mt-4 space-y-3">
          {payload.c.map(([name, amount, entries]) => {
            const share = total > 0 ? amount / total : 0;
            const color = isCategory(name) ? CATEGORY_META[name].color : "var(--cat-other)";
            return (
              <li key={name} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-sm text-ink">{name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(2, share * 100)}%`, backgroundColor: color }}
                  />
                </span>
                <span className="text-right text-sm tabular-nums text-ink-2">
                  {formatCurrency(amount)}
                  <span className="ml-2 text-xs text-muted">
                    {formatPercent(share)} · {entries}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {rows.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink">Transactions</h2>
              <p className="mt-0.5 text-sm text-ink-2">{rows.length.toLocaleString()} lines included</p>
            </div>
            <button type="button" className="btn-secondary" onClick={saveCsv}>
              <Download className="h-4 w-4" aria-hidden />
              Save as CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-2 text-left font-medium">Date</th>
                  <th className="px-5 py-2 text-left font-medium">Description</th>
                  <th className="px-5 py-2 text-left font-medium">Category</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row, index) => (
                  <tr key={`${row[0]}-${index}`}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-2">{formatDisplayDate(row[0])}</td>
                    <td className="px-5 py-2.5 text-ink">{row[1]}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-2">{row[2]}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-ink">
                      {formatCurrency(row[3])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-2">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          This report travelled inside the link you opened — it was never uploaded to a server, and
          nothing about this visit is recorded anywhere.
        </span>
      </p>
    </article>
  );
}
