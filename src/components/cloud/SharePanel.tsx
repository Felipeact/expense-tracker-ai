"use client";

import {
  Ban,
  Check,
  Download,
  ExternalLink,
  Link2,
  QrCode,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { qrToSvg, QR_MAX_BYTES } from "@/lib/cloud/qr";
import { formatRelative } from "@/lib/cloud/schedule";
import { downloadText, formatBytes } from "@/lib/cloud/serialize";
import {
  buildSharePayload,
  buildShareUrl,
  encodeShare,
  EXPIRY_OPTIONS,
  SHARE_ROW_LIMIT,
} from "@/lib/cloud/share";
import { compileTemplate, TEMPLATES } from "@/lib/cloud/templates";
import type { ShareLink, TemplateId } from "@/lib/cloud/types";
import { CopyButton, Field, Pill, SectionHeader } from "./primitives";
import { QRCode, useQr } from "./QRCode";

export function SharePanel() {
  const { expenses } = useExpenses();
  const { shares, createShare, revokeShare } = useCloud();

  const [templateId, setTemplateId] = useState<TemplateId>("monthly-summary");
  const [includeRows, setIncludeRows] = useState(false);
  const [expiryHours, setExpiryHours] = useState(EXPIRY_OPTIONS[2].hours);
  const [origin, setOrigin] = useState("");
  const [created, setCreated] = useState<ShareLink | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const compiled = useMemo(() => compileTemplate(templateId, expenses), [templateId, expenses]);

  // Preview the exact URL the button would mint, so the meter reacts live.
  const previewUrl = useMemo(() => {
    if (!origin) return "";
    const payload = buildSharePayload(compiled, {
      includeRows,
      expiresAt: new Date(Date.now() + expiryHours * 3_600_000),
    });
    return buildShareUrl(origin, "PREVIEW", encodeShare(payload));
  }, [origin, compiled, includeRows, expiryHours]);

  const liveUrl = created?.url ?? previewUrl;
  const qr = useQr(liveUrl || "about:blank");
  const fits = liveUrl.length <= QR_MAX_BYTES;
  const rowsAvailable =
    compiled.sheets.find((s) => s.columns.includes("Amount"))?.rows.length ?? 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Share a report"
        subtitle="Links carry their own data — nothing is uploaded, so the page works even with the app offline."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="card space-y-4 p-5 lg:col-span-5">
          <Field label="Report">
            <select
              className="input"
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value as TemplateId);
                setCreated(null);
              }}
            >
              {TEMPLATES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Expires after">
            <select
              className="input"
              value={expiryHours}
              onChange={(event) => {
                setExpiryHours(Number(event.target.value));
                setCreated(null);
              }}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.hours} value={option.hours}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition-colors hover:bg-surface-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
              checked={includeRows}
              onChange={(event) => {
                setIncludeRows(event.target.checked);
                setCreated(null);
              }}
            />
            <span className="text-sm">
              <span className="block font-medium text-ink">Include transaction rows</span>
              <span className="mt-0.5 block text-ink-2">
                Up to {SHARE_ROW_LIMIT} lines ({Math.min(rowsAvailable, SHARE_ROW_LIMIT)} available).
                Off means totals and category splits only — small enough to scan.
              </span>
            </span>
          </label>

          <CapacityMeter bytes={liveUrl.length} />

          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => setCreated(createShare({ templateId, includeRows, expiryHours }))}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {created ? "Generate a new link" : "Generate share link"}
          </button>

          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs text-ink-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              The report is encoded into the link itself. Anyone holding it can open it until it
              expires — revoking only removes it from your list here, it cannot un-send a URL.
            </span>
          </p>
        </div>

        <div className="card space-y-4 p-5 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-ink">{created ? "Your link" : "Live preview"}</h3>
            {created ? (
              <Pill tone="live">Expires {formatRelative(created.expiresAt)}</Pill>
            ) : (
              <Pill tone="idle">Not generated yet</Pill>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-xl border border-line bg-white p-3">
              <QRCode value={liveUrl || "about:blank"} result={qr} size={200} />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <span className="label">Link</span>
                <input
                  readOnly
                  value={liveUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="input truncate font-mono text-xs"
                  aria-label="Share link"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <CopyButton value={liveUrl} label="Copy link" />
                <a
                  href={liveUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  aria-disabled={!liveUrl}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Open
                </a>
                {qr && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      downloadText(
                        qrToSvg(qr),
                        `spendwise-share-${created?.token ?? "preview"}.svg`,
                        "image/svg+xml",
                      )
                    }
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    QR as SVG
                  </button>
                )}
              </div>

              <dl className="space-y-1 text-xs text-ink-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Report</dt>
                  <dd className="truncate">{compiled.title}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Payload</dt>
                  <dd>{formatBytes(liveUrl.length)} in the URL</dd>
                </div>
                {qr && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">QR</dt>
                    <dd>
                      Version {qr.version} · error correction {qr.ecl}
                    </dd>
                  </div>
                )}
                {!fits && (
                  <div className="flex items-start gap-2 pt-1 text-bad">
                    <QrCode className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Too large to encode as a QR code — the link still works.
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {shares.length > 0 && (
        <section className="card">
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-semibold text-ink">Links you have created</h3>
            <p className="mt-0.5 text-sm text-ink-2">{shares.length} in this browser</p>
          </div>
          <ul className="divide-y divide-line">
            {shares.map((link) => {
              const expired = new Date(link.expiresAt) < new Date();
              return (
                <li key={link.token} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <Link2 className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{link.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {link.token} · created {formatRelative(link.createdAt)} ·{" "}
                      {link.includeRows ? "with rows" : "summary only"} · {formatBytes(link.bytes)}
                    </p>
                  </div>
                  <Pill tone={link.revoked ? "idle" : expired ? "bad" : "live"}>
                    {link.revoked ? "Revoked" : expired ? "Expired" : `Expires ${formatRelative(link.expiresAt)}`}
                  </Pill>
                  <CopyButton value={link.url} label="Copy" className="!px-2.5 !py-1.5 !text-xs" />
                  {!link.revoked && (
                    <button
                      type="button"
                      className="icon-btn hover:text-bad"
                      onClick={() => revokeShare(link.token)}
                      aria-label={`Revoke ${link.token}`}
                      title="Remove from this list"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function CapacityMeter({ bytes }: { bytes: number }) {
  const ratio = Math.min(1, bytes / QR_MAX_BYTES);
  const fits = bytes <= QR_MAX_BYTES;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink">QR capacity</span>
        <span className="tabular-nums text-muted">
          {bytes.toLocaleString()} / {QR_MAX_BYTES.toLocaleString()} bytes
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${fits ? "bg-good" : "bg-bad"}`}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
        {fits ? (
          <>
            <Check className="h-3.5 w-3.5 text-good" aria-hidden />
            Fits in a scannable QR code
          </>
        ) : (
          <>
            <QrCode className="h-3.5 w-3.5 text-bad" aria-hidden />
            Turn off transaction rows to bring it back under the limit
          </>
        )}
      </p>
    </div>
  );
}
