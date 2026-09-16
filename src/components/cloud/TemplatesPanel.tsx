"use client";

import { Download, Printer, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useCloud } from "@/hooks/useCloud";
import { useExpenses } from "@/hooks/useExpenses";
import { destination, FORMAT_META } from "@/lib/cloud/destinations";
import {
  byteLength,
  downloadText,
  filenameFor,
  formatBytes,
  serialize,
} from "@/lib/cloud/serialize";
import { compileTemplate, countRows, TEMPLATES, template } from "@/lib/cloud/templates";
import type { DestinationId, ExportFormat, TemplateId } from "@/lib/cloud/types";
import { formatCurrency } from "@/lib/format";
import { ConnectorMark, SectionHeader, SheetGrid } from "./primitives";
import { RunDialog } from "./RunDialog";

export function TemplatesPanel() {
  const { expenses } = useExpenses();
  const { connections } = useCloud();

  const [templateId, setTemplateId] = useState<TemplateId>("monthly-summary");
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [tab, setTab] = useState(0);
  const [sendTo, setSendTo] = useState<DestinationId | null>(null);

  const meta = template(templateId);
  const compiled = useMemo(() => compileTemplate(templateId, expenses), [templateId, expenses]);
  const payload = useMemo(() => serialize(compiled, format), [compiled, format]);
  const activeSheet = compiled.sheets[Math.min(tab, compiled.sheets.length - 1)];

  const selectTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setFormat(template(id).defaultFormat);
    setTab(0);
  };

  const printReport = () => {
    const html = serialize(compiled, "html");
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    frame.srcdoc = html;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      // Give the print dialog time to take its snapshot before tearing down.
      window.setTimeout(() => frame.remove(), 60_000);
    };
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Export templates"
        subtitle="Each template is a different answer to “who is this for?” — preview the real output before it ships."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-4">
          {TEMPLATES.map((item) => {
            const Icon = item.icon;
            const active = item.id === templateId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTemplate(item.id)}
                aria-pressed={active}
                className={`flex w-full gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  active
                    ? "border-accent bg-accent-soft/50 ring-1 ring-accent/30"
                    : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    active ? "bg-accent text-white" : "bg-surface-2 text-ink-2"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{item.name}</span>
                  <span className="mt-0.5 block text-sm text-ink-2">{item.purpose}</span>
                  <span className="mt-1.5 block text-xs text-muted">For {item.audience}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="card lg:col-span-8">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-base font-semibold text-ink">{compiled.title}</h3>
            <p className="mt-0.5 text-sm text-ink-2">{compiled.subtitle}</p>
          </div>

          <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
            {[
              ["Total", formatCurrency(compiled.summary.total)],
              ["Rows", countRows(compiled).toLocaleString()],
              ["Tabs", String(compiled.sheets.length)],
              ["Size", formatBytes(byteLength(payload))],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-4 px-5 py-4">
            <SegmentedControl
              label="Export format"
              size="sm"
              value={format}
              onChange={setFormat}
              options={meta.formats.map((f) => ({ value: f, label: FORMAT_META[f].label }))}
            />

            <div>
              <div className="flex flex-wrap gap-1 border-b border-line">
                {compiled.sheets.map((sheet, i) => (
                  <button
                    key={sheet.name}
                    type="button"
                    onClick={() => setTab(i)}
                    className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                      i === Math.min(tab, compiled.sheets.length - 1)
                        ? "border-b-accent text-ink"
                        : "border-b-transparent text-ink-2 hover:text-ink"
                    }`}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
              {activeSheet.note && (
                <p className="mt-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-xs text-ink-2">
                  {activeSheet.note}
                </p>
              )}
              <div className="mt-3">
                <SheetGrid sheet={activeSheet} maxRows={7} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  downloadText(payload, filenameFor(compiled, format), FORMAT_META[format].mime)
                }
              >
                <Download className="h-4 w-4" aria-hidden />
                Download
              </button>
              {meta.formats.includes("html") && (
                <button type="button" className="btn-secondary" onClick={printReport}>
                  <Printer className="h-4 w-4" aria-hidden />
                  Print
                </button>
              )}

              <span className="ml-auto text-xs text-muted">Send to</span>
              {connections.length === 0 ? (
                <span className="text-xs text-muted">no connections yet</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {connections.map((connection) => {
                    const target = destination(connection.destinationId);
                    const supported = meta.formats.some((f) => target.formats.includes(f));
                    return (
                      <button
                        key={connection.destinationId}
                        type="button"
                        title={
                          supported
                            ? `Send ${meta.name} to ${target.name}`
                            : `${target.name} does not accept any of this template's formats`
                        }
                        disabled={!supported}
                        onClick={() => setSendTo(connection.destinationId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
                      >
                        <ConnectorMark accent={target.accent} icon={target.icon} size="sm" />
                        {target.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {connections.length === 0 && (
              <p className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-ink-2">
                <Send className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                Connect a destination to deliver this on a schedule instead of downloading it by hand.
              </p>
            )}
          </div>
        </div>
      </div>

      <RunDialog
        destinationId={sendTo}
        initialTemplate={templateId}
        open={sendTo !== null}
        onClose={() => setSendTo(null)}
      />
    </div>
  );
}
