"use client";

import { AlarmClock, Pause, Play, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { useCloud, type ScheduleInput } from "@/hooks/useCloud";
import { destination, FORMAT_META } from "@/lib/cloud/destinations";
import {
  describeSchedule,
  formatHour,
  formatRelative,
  FREQUENCIES,
  nextRunFor,
  WEEKDAYS,
} from "@/lib/cloud/schedule";
import { TEMPLATES, template } from "@/lib/cloud/templates";
import type { DestinationId, ExportFormat, ScheduleRule } from "@/lib/cloud/types";
import { ConnectorMark, Field, Pill, SectionHeader, type StatusTone } from "./primitives";

const RETENTION_OPTIONS = [3, 7, 12, 30];

export function SchedulesPanel() {
  const { schedules, connections } = useCloud();
  const [composing, setComposing] = useState(false);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Automatic backups"
        subtitle="Rules run in the background while the app is open, and catch up on anything they missed."
        action={
          connections.length > 0 && (
            <button type="button" className="btn-primary" onClick={() => setComposing((v) => !v)}>
              <Plus className="h-4 w-4" aria-hidden />
              New rule
            </button>
          )
        }
      />

      {connections.length === 0 ? (
        <p className="card px-5 py-6 text-center text-sm text-ink-2">
          Connect a destination first — a schedule needs somewhere to deliver to.
        </p>
      ) : (
        <>
          {composing && <ScheduleComposer onDone={() => setComposing(false)} />}

          {schedules.length === 0 && !composing ? (
            <div className="card flex flex-col items-center gap-3 px-5 py-10 text-center">
              <AlarmClock className="h-8 w-8 text-muted" aria-hidden />
              <div>
                <p className="font-medium text-ink">No recurring exports yet</p>
                <p className="mt-1 text-sm text-ink-2">
                  A nightly ledger backup is the one most people set first.
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setComposing(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Create a rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((rule) => (
                <ScheduleCard key={rule.id} rule={rule} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScheduleCard({ rule }: { rule: ScheduleRule }) {
  const { updateSchedule, deleteSchedule, runScheduleNow, isConnected, activeJobs } = useCloud();
  const meta = destination(rule.destinationId);
  const connected = isConnected(rule.destinationId);
  const running = activeJobs.some((job) => job.scheduleId === rule.id);
  const due = nextRunFor(rule);
  const overdue = !rule.paused && due <= new Date();

  let tone: StatusTone = "live";
  let status = `Next ${formatRelative(due)}`;
  if (running) {
    tone = "syncing";
    status = "Running now";
  } else if (!connected) {
    tone = "bad";
    status = "Destination disconnected";
  } else if (rule.paused) {
    tone = "idle";
    status = "Paused";
  } else if (overdue) {
    tone = "warn";
    status = "Catching up";
  }

  return (
    <article className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <ConnectorMark accent={meta.accent} icon={meta.icon} />

      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-ink">{rule.name}</h4>
        <p className="mt-0.5 text-sm text-ink-2">
          {template(rule.templateId).name} · {FORMAT_META[rule.format].label} → {meta.name}
        </p>
        <p className="mt-1.5 text-xs text-muted">
          {describeSchedule(rule)} · keeps last {rule.keepLast} runs
          {rule.lastRunAt && ` · last ran ${formatRelative(rule.lastRunAt)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={tone}>{status}</Pill>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => runScheduleNow(rule.id)}
          disabled={!connected || running}
          title="Run this rule immediately"
        >
          <Zap className="h-4 w-4" aria-hidden />
          Run
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => updateSchedule(rule.id, { paused: !rule.paused })}
        >
          {rule.paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
          {rule.paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          className="icon-btn hover:text-bad"
          onClick={() => deleteSchedule(rule.id)}
          aria-label={`Delete ${rule.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function ScheduleComposer({ onDone }: { onDone: () => void }) {
  const { connections, createSchedule } = useCloud();
  const eligible = connections.filter((c) => destination(c.destinationId).supportsSchedule);
  const first = eligible[0]?.destinationId ?? "vault";

  const [draft, setDraft] = useState<ScheduleInput>(() => ({
    name: "Nightly ledger backup",
    destinationId: first,
    templateId: "raw-ledger",
    format: destination(first).defaultFormat,
    frequency: "daily",
    weekday: 1,
    dayOfMonth: 1,
    hour: 2,
    keepLast: 7,
  }));

  const target = destination(draft.destinationId);
  const formats = template(draft.templateId).formats.filter((f) => target.formats.includes(f));

  const patch = (next: Partial<ScheduleInput>) => setDraft((current) => ({ ...current, ...next }));

  const changeDestination = (id: DestinationId) => {
    const meta = destination(id);
    const shared = template(draft.templateId).formats.filter((f) => meta.formats.includes(f));
    patch({ destinationId: id, format: shared.includes(draft.format) ? draft.format : shared[0] ?? meta.defaultFormat });
  };

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        createSchedule({ ...draft, name: draft.name.trim() || "Untitled rule" });
        onDone();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rule name">
          <input
            className="input"
            value={draft.name}
            data-autofocus
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>

        <Field label="Destination">
          <select
            className="input"
            value={draft.destinationId}
            onChange={(event) => changeDestination(event.target.value as DestinationId)}
          >
            {eligible.map((connection) => (
              <option key={connection.destinationId} value={connection.destinationId}>
                {destination(connection.destinationId).name} · {connection.account}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Template">
          <select
            className="input"
            value={draft.templateId}
            onChange={(event) => {
              const id = event.target.value as ScheduleInput["templateId"];
              const shared = template(id).formats.filter((f) => target.formats.includes(f));
              patch({ templateId: id, format: shared[0] ?? target.defaultFormat });
            }}
          >
            {TEMPLATES.filter((t) => t.formats.some((f) => target.formats.includes(f))).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Format">
          <select
            className="input"
            value={draft.format}
            onChange={(event) => patch({ format: event.target.value as ExportFormat })}
          >
            {formats.map((format) => (
              <option key={format} value={format}>
                {FORMAT_META[format].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Frequency">
          <select
            className="input"
            value={draft.frequency}
            onChange={(event) => patch({ frequency: event.target.value as ScheduleInput["frequency"] })}
          >
            {FREQUENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {draft.frequency === "weekly" && (
          <Field label="Day of week">
            <select
              className="input"
              value={draft.weekday}
              onChange={(event) => patch({ weekday: Number(event.target.value) })}
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
        )}

        {draft.frequency === "monthly" && (
          <Field label="Day of month" hint="Capped at 28 so the rule never skips February.">
            <select
              className="input"
              value={draft.dayOfMonth}
              onChange={(event) => patch({ dayOfMonth: Number(event.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Time">
          <select
            className="input"
            value={draft.hour}
            onChange={(event) => patch({ hour: Number(event.target.value) })}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Retention" hint="Older runs for this rule drop out of history.">
          <select
            className="input"
            value={draft.keepLast}
            onChange={(event) => patch({ keepLast: Number(event.target.value) })}
          >
            {RETENTION_OPTIONS.map((count) => (
              <option key={count} value={count}>
                Keep last {count} runs
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-muted">
          {describeSchedule({ ...draft, id: "", paused: false, createdAt: "" } as ScheduleRule)}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <AlarmClock className="h-4 w-4" aria-hidden />
            Create rule
          </button>
        </div>
      </div>
    </form>
  );
}
