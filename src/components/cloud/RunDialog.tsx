"use client";

import { FileText, Paperclip, Send, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { destination, FORMAT_META } from "@/lib/cloud/destinations";
import { byteLength, formatBytes, serialize } from "@/lib/cloud/serialize";
import { compileTemplate, countRows, TEMPLATES, template } from "@/lib/cloud/templates";
import type { DestinationId, ExportFormat, TemplateId } from "@/lib/cloud/types";
import { formatCurrency } from "@/lib/format";
import { ConnectorMark, Field, SheetGrid } from "./primitives";

interface RunDialogProps {
  destinationId: DestinationId | null;
  initialTemplate?: TemplateId;
  open: boolean;
  onClose: () => void;
}

export function RunDialog({ destinationId, initialTemplate, open, onClose }: RunDialogProps) {
  const { runExport } = useCloud();
  const { expenses } = useExpenses();

  const meta = destinationId ? destination(destinationId) : null;
  const [templateId, setTemplateId] = useState<TemplateId>(initialTemplate ?? "monthly-summary");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !meta) return;
    const nextTemplate = initialTemplate ?? "monthly-summary";
    setTemplateId(nextTemplate);
    // Land on a format both sides support, preferring the destination's own default.
    const shared = template(nextTemplate).formats.filter((f) => meta.formats.includes(f));
    setFormat(shared.includes(meta.defaultFormat) ? meta.defaultFormat : shared[0] ?? meta.defaultFormat);
    setRecipients([]);
    setRecipientDraft("");
    setMessage("");
  }, [open, meta, initialTemplate]);

  const compiled = useMemo(
    () => (open ? compileTemplate(templateId, expenses) : null),
    [open, templateId, expenses],
  );
  const payloadBytes = useMemo(
    () => (compiled ? byteLength(serialize(compiled, format)) : 0),
    [compiled, format],
  );

  if (!meta || !compiled) return null;

  const availableFormats = template(templateId).formats.filter((f) => meta.formats.includes(f));
  const subject = compiled.title;

  const addRecipient = () => {
    const value = recipientDraft.trim().replace(/,$/, "");
    if (!value) return;
    setRecipients((current) => (current.includes(value) ? current : [...current, value]));
    setRecipientDraft("");
  };

  const submit = () => {
    const extras: Record<string, string> = {};
    if (meta.id === "email") {
      extras.recipients = (recipients.length ? recipients : [meta.accountPlaceholder]).join(", ");
      extras.subject = subject;
      if (message.trim()) extras.message = message.trim();
    }
    runExport({
      destinationId: meta.id,
      templateId,
      format,
      meta: Object.keys(extras).length ? extras : undefined,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send to ${meta.name}`}
      description={meta.effect}
    >
      <div className="space-y-5">
        <Field label="Template">
          <select
            className="input"
            value={templateId}
            data-autofocus
            onChange={(event) => {
              const next = event.target.value as TemplateId;
              setTemplateId(next);
              const shared = template(next).formats.filter((f) => meta.formats.includes(f));
              if (!shared.includes(format)) setFormat(shared[0] ?? meta.defaultFormat);
            }}
          >
            {TEMPLATES.filter((t) => t.formats.some((f) => meta.formats.includes(f))).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.audience}
              </option>
            ))}
          </select>
        </Field>

        {availableFormats.length > 1 && (
          <div>
            <span className="label">Format</span>
            <SegmentedControl
              label="Export format"
              size="sm"
              value={format}
              onChange={setFormat}
              options={availableFormats.map((f) => ({ value: f, label: FORMAT_META[f].label }))}
            />
          </div>
        )}

        {meta.id === "email" && (
          <div className="space-y-3">
            <Field label="Recipients" hint="Press Enter to add each address.">
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
                {recipients.map((recipient) => (
                  <span
                    key={recipient}
                    className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink"
                  >
                    {recipient}
                    <button
                      type="button"
                      onClick={() => setRecipients((c) => c.filter((r) => r !== recipient))}
                      aria-label={`Remove ${recipient}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-ink outline-none placeholder:text-muted"
                  value={recipientDraft}
                  placeholder={recipients.length ? "" : "accountant@example.com"}
                  onChange={(event) => setRecipientDraft(event.target.value)}
                  onBlur={addRecipient}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addRecipient();
                    }
                  }}
                />
              </div>
            </Field>
            <Field label="Message" hint="Optional note above the report.">
              <textarea
                className="input min-h-[72px] resize-y"
                value={message}
                placeholder="Here's last month's summary."
                onChange={(event) => setMessage(event.target.value)}
              />
            </Field>
          </div>
        )}

        <div>
          <span className="label">What lands on the other side</span>
          <DeliveryPreview
            destinationId={meta.id}
            accent={meta.accent}
            compiled={compiled}
            format={format}
            bytes={payloadBytes}
            recipients={recipients}
            subject={subject}
            message={message}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">
            {countRows(compiled).toLocaleString()} rows · {formatBytes(payloadBytes)} ·{" "}
            {compiled.rangeLabel}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={submit}>
              <Send className="h-4 w-4" aria-hidden />
              Run export
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DeliveryPreview({
  destinationId,
  accent,
  compiled,
  format,
  bytes,
  recipients,
  subject,
  message,
}: {
  destinationId: DestinationId;
  accent: string;
  compiled: ReturnType<typeof compileTemplate>;
  format: ExportFormat;
  bytes: number;
  recipients: string[];
  subject: string;
  message: string;
}) {
  const [tab, setTab] = useState(0);
  const meta = destination(destinationId);
  const filename = `spendwise-${compiled.templateId}-${compiled.generatedAt.slice(0, 10)}.${FORMAT_META[format].extension}`;

  if (destinationId === "email") {
    return (
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="space-y-1 border-b border-line bg-surface-2/60 px-4 py-3 text-sm">
          <p className="text-ink-2">
            <span className="text-muted">To</span>{" "}
            {recipients.length ? recipients.join(", ") : <span className="text-muted">nobody yet</span>}
          </p>
          <p className="font-semibold text-ink">{subject}</p>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm text-ink-2">
          {message.trim() && <p className="whitespace-pre-line text-ink">{message.trim()}</p>}
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted">{compiled.rangeLabel}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {formatCurrency(compiled.summary.total)}
            </p>
            <p className="mt-0.5 text-xs">
              across {compiled.summary.count} transactions in {compiled.summary.categories.length} categories
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">
            <Paperclip className="h-3.5 w-3.5 text-muted" aria-hidden />
            {filename}
            <span className="text-muted">{formatBytes(bytes)}</span>
          </span>
        </div>
      </div>
    );
  }

  if (format === "sheet" || destinationId === "google-sheets") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {compiled.sheets.map((sheet, i) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setTab(i)}
              className={`rounded-t-md border-b-2 px-2.5 py-1 text-xs font-medium transition-colors ${
                i === tab
                  ? "border-b-accent text-ink"
                  : "border-b-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
        <SheetGrid sheet={compiled.sheets[Math.min(tab, compiled.sheets.length - 1)]} maxRows={6} />
      </div>
    );
  }

  if (destinationId === "slack") {
    return (
      <div className="rounded-xl border border-line px-4 py-3">
        <div className="flex items-start gap-3">
          <ConnectorMark accent={accent} icon={meta.icon} size="sm" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-ink">
              Spendwise <span className="ml-1 rounded bg-surface-2 px-1 py-0.5 text-[10px] font-medium text-muted">APP</span>
            </p>
            <p className="mt-1 text-ink-2">
              {compiled.title} is ready — {formatCurrency(compiled.summary.total)} across{" "}
              {compiled.summary.count} transactions.
            </p>
            <div className="mt-2 space-y-1 border-l-2 border-accent pl-3">
              {compiled.summary.categories.slice(0, 3).map((category) => (
                <p key={category.category} className="text-xs text-ink-2">
                  {category.category} · {formatCurrency(category.total)} ({(category.share * 100).toFixed(0)}%)
                </p>
              ))}
            </div>
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
              <Paperclip className="h-3 w-3" aria-hidden />
              {filename}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (destinationId === "notion") {
    return (
      <div className="overflow-hidden rounded-xl border border-line">
        <p className="border-b border-line bg-surface-2/60 px-4 py-2 text-xs font-medium text-ink-2">
          Expenses database · {compiled.sheets[compiled.sheets.length - 1].rows.length} rows upserted
        </p>
        <SheetGrid sheet={compiled.sheets[compiled.sheets.length - 1]} maxRows={5} />
      </div>
    );
  }

  if (destinationId === "webhook") {
    const snippet = [
      "POST /spendwise HTTP/1.1",
      "content-type: application/json",
      `x-spendwise-template: ${compiled.templateId}`,
      `x-spendwise-idempotency-key: ${compiled.generatedAt.slice(0, 10)}-${compiled.templateId}`,
      "",
      JSON.stringify(
        {
          title: compiled.title,
          range: compiled.range,
          summary: { total: compiled.summary.total, count: compiled.summary.count },
          sheets: compiled.sheets.map((s) => ({ name: s.name, rows: s.rows.length })),
        },
        null,
        2,
      ),
    ].join("\n");

    return (
      <pre className="max-h-56 overflow-auto rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-xs leading-relaxed text-ink-2">
        <code>{snippet}</code>
      </pre>
    );
  }

  const path =
    destinationId === "dropbox"
      ? `/Apps/Spendwise/${filename}`
      : destinationId === "vault"
        ? `vault://snapshots/${filename}`
        : `Spendwise/${filename}`;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
      <ConnectorMark accent={accent} icon={destinationId === "vault" ? meta.icon : FileText} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{path}</p>
        <p className="mt-0.5 text-xs text-ink-2">
          {FORMAT_META[format].label} · {formatBytes(bytes)} · {countRows(compiled).toLocaleString()} rows
        </p>
      </div>
      <Upload className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </div>
  );
}
