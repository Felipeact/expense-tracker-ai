"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/Toast";
import { destination, FORMAT_META } from "@/lib/cloud/destinations";
import { nextRunFor } from "@/lib/cloud/schedule";
import {
  buildSharePayload,
  buildShareUrl,
  createShareToken,
  encodeShare,
} from "@/lib/cloud/share";
import { byteLength, downloadText, filenameFor, serialize } from "@/lib/cloud/serialize";
import {
  changesSince,
  clearCloudState,
  fingerprint,
  HISTORY_LIMIT,
  loadCloudState,
  saveCloudState,
  VAULT_QUOTA_BYTES,
} from "@/lib/cloud/store";
import { compileTemplate, countRows, template } from "@/lib/cloud/templates";
import {
  EMPTY_CLOUD_STATE,
  isActiveStage,
  type CloudState,
  type Connection,
  type DestinationId,
  type ExportFormat,
  type ExportJob,
  type HistoryEntry,
  type JobStage,
  type ScheduleRule,
  type ShareLink,
  type TemplateId,
  type Trigger,
} from "@/lib/cloud/types";
import { createId } from "@/lib/storage";
import type { Expense } from "@/lib/types";
import { useExpenses } from "./useExpenses";

const TICK_MS = 250;
const SCHEDULE_CHECK_MS = 15_000;
/** Deliveries run three at a time; the rest wait their turn, like a real queue. */
const MAX_CONCURRENT = 3;

const TRANSIENT_ERRORS = [
  "Upstream returned 503 — the destination is rate limiting.",
  "Connection reset while uploading the final chunk.",
  "Request timed out after 30s with no response.",
  "Destination rejected the payload checksum.",
];

/**
 * Serialized payloads live in memory only: writing them to localStorage would
 * blow the quota. A job resumed after a reload simply recompiles.
 */
const payloadCache = new Map<string, string>();

function stageForProgress(progress: number): JobStage {
  if (progress < 6) return "queued";
  if (progress < 22) return "authorizing";
  if (progress < 52) return "packaging";
  if (progress < 92) return "uploading";
  if (progress < 100) return "verifying";
  return "done";
}

export const STAGE_LABEL: Record<JobStage, string> = {
  queued: "Queued",
  authorizing: "Authorizing",
  packaging: "Packaging",
  uploading: "Uploading",
  verifying: "Verifying",
  done: "Delivered",
  failed: "Failed",
  canceled: "Canceled",
  offline: "Waiting for connection",
};

function randomBetween([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

export interface RunSpec {
  destinationId: DestinationId;
  templateId: TemplateId;
  format: ExportFormat;
  trigger?: Trigger;
  label?: string;
  scheduleId?: string;
  meta?: Record<string, string>;
}

export interface ScheduleInput {
  name: string;
  destinationId: DestinationId;
  templateId: TemplateId;
  format: ExportFormat;
  frequency: ScheduleRule["frequency"];
  weekday: number;
  dayOfMonth: number;
  hour: number;
  keepLast: number;
}

export interface ShareInput {
  templateId: TemplateId;
  includeRows: boolean;
  expiryHours: number;
}

interface CloudContextValue extends CloudState {
  ready: boolean;
  online: boolean;
  activeJobs: ExportJob[];
  vaultUsage: number;
  vaultQuota: number;
  connectionFor: (id: DestinationId) => Connection | undefined;
  isConnected: (id: DestinationId) => boolean;
  /** Expenses added or edited since this destination last received a copy. */
  driftFor: (id: DestinationId) => number;
  inSync: (id: DestinationId) => boolean;
  connect: (id: DestinationId, account: string) => void;
  disconnect: (id: DestinationId) => void;
  reauthorize: (id: DestinationId) => void;
  runExport: (spec: RunSpec) => ExportJob | null;
  retryJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  /** Saves the exact bytes a job delivered, recompiling if the tab was reloaded. */
  downloadJob: (jobId: string) => void;
  createSchedule: (input: ScheduleInput) => ScheduleRule;
  updateSchedule: (id: string, patch: Partial<ScheduleRule>) => void;
  deleteSchedule: (id: string) => void;
  runScheduleNow: (id: string) => void;
  createShare: (input: ShareInput) => ShareLink | null;
  revokeShare: (token: string) => void;
  clearHistory: () => void;
  seedDemoWorkspace: () => void;
  resetCloud: () => void;
}

const CloudContext = createContext<CloudContextValue | null>(null);

export function CloudProvider({ children }: { children: ReactNode }) {
  const { expenses } = useExpenses();
  const toast = useToast();

  const [state, setState] = useState<CloudState>(EMPTY_CLOUD_STATE);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);

  const stateRef = useRef<CloudState>(EMPTY_CLOUD_STATE);
  const expensesRef = useRef<Expense[]>([]);
  expensesRef.current = expenses;
  const onlineRef = useRef(true);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const commit = useCallback((updater: (current: CloudState) => CloudState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setState(next);
    saveCloudState(next);
  }, []);

  useEffect(() => {
    const loaded = loadCloudState();
    // Anything mid-flight when the tab closed picks up where it left off.
    stateRef.current = loaded;
    setState(loaded);
    setReady(true);

    const sync = () => {
      onlineRef.current = navigator.onLine;
      setOnline(navigator.onLine);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // --- Job engine ----------------------------------------------------------

  const finishJob = useCallback(
    (job: ExportJob, current: CloudState): CloudState => {
      const meta = destination(job.destinationId);
      const failed = Math.random() < meta.flakiness;
      const now = new Date().toISOString();
      const historyId = createId();

      const entry: HistoryEntry = {
        id: historyId,
        createdAt: now,
        destinationId: job.destinationId,
        templateId: job.templateId,
        format: job.format,
        label: job.label,
        trigger: job.trigger,
        status: failed ? "failed" : "delivered",
        rows: job.rows,
        bytes: job.bytes,
        error: failed ? TRANSIENT_ERRORS[Math.floor(Math.random() * TRANSIENT_ERRORS.length)] : undefined,
        meta: job.meta,
      };

      const jobs = current.jobs.map((j) =>
        j.id === job.id
          ? {
              ...j,
              stage: (failed ? "failed" : "done") as JobStage,
              progress: failed ? j.progress : 100,
              error: entry.error,
              historyId,
            }
          : j,
      );

      const connections = failed
        ? current.connections
        : current.connections.map((c) =>
            c.destinationId === job.destinationId
              ? {
                  ...c,
                  lastSyncAt: now,
                  lastSyncFingerprint: fingerprint(expensesRef.current),
                }
              : c,
          );

      if (failed) {
        toastRef.current(`${meta.name} export failed`, { variant: "error" });
      } else {
        toastRef.current(`${template(job.templateId).name} delivered to ${meta.name}`);
      }

      // Per-rule retention, then the global cap.
      let history = [entry, ...current.history];
      if (job.scheduleId) {
        const rule = current.schedules.find((s) => s.id === job.scheduleId);
        if (rule) {
          let kept = 0;
          history = history.filter((h) => {
            if (h.destinationId !== rule.destinationId || h.templateId !== rule.templateId) return true;
            kept += 1;
            return kept <= rule.keepLast;
          });
        }
      }

      return {
        ...current,
        jobs,
        connections,
        history: history.slice(0, HISTORY_LIMIT),
      };
    },
    [],
  );

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      const running = current.jobs.filter((j) => isActiveStage(j.stage));
      if (running.length === 0) return;

      // Oldest first, capped, so the queue drains predictably.
      const advancing = new Set(
        [...running]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(0, MAX_CONCURRENT)
          .map((j) => j.id),
      );

      let next: CloudState = {
        ...current,
        jobs: current.jobs.map((job) => {
          if (!isActiveStage(job.stage)) return job;

          if (!onlineRef.current) {
            return job.stage === "offline"
              ? job
              : { ...job, stage: "offline" as JobStage, pausedFrom: job.stage };
          }
          if (job.stage === "offline") {
            return { ...job, stage: job.pausedFrom ?? "queued", pausedFrom: undefined };
          }
          if (!advancing.has(job.id)) return job;

          const step = (100 / Math.max(job.durationMs, 400)) * TICK_MS;
          const progress = Math.min(100, job.progress + step);
          return { ...job, progress, stage: stageForProgress(progress) };
        }),
      };

      let landed = false;
      for (const job of next.jobs) {
        if (job.progress >= 100 && job.stage === "done" && !job.historyId) {
          next = finishJob(job, next);
          landed = true;
        }
      }

      stateRef.current = next;
      setState(next);

      // Progress moves every tick; only persist when something meaningful changed,
      // so a running export does not hammer localStorage four times a second.
      const stageChanged = next.jobs.some((job) => {
        const before = current.jobs.find((j) => j.id === job.id);
        return before?.stage !== job.stage;
      });
      if (landed || stageChanged) saveCloudState(next);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [ready, finishJob]);

  // --- Actions -------------------------------------------------------------

  const enqueue = useCallback(
    (spec: RunSpec): ExportJob | null => {
      const meta = destination(spec.destinationId);
      const connected = stateRef.current.connections.some((c) => c.destinationId === spec.destinationId);
      if (!connected) return null;

      const compiled = compileTemplate(spec.templateId, expensesRef.current);
      const text = serialize(compiled, spec.format);

      const job: ExportJob = {
        id: createId(),
        destinationId: spec.destinationId,
        templateId: spec.templateId,
        format: spec.format,
        label: spec.label ?? `${template(spec.templateId).name} → ${meta.name}`,
        trigger: spec.trigger ?? "manual",
        createdAt: new Date().toISOString(),
        stage: "queued",
        progress: 0,
        rows: countRows(compiled),
        bytes: byteLength(text),
        attempt: 1,
        durationMs: randomBetween(meta.latency) * 2.2,
        scheduleId: spec.scheduleId,
        meta: spec.meta,
      };

      payloadCache.set(job.id, text);
      commit((current) => ({ ...current, jobs: [job, ...current.jobs].slice(0, 40) }));
      return job;
    },
    [commit],
  );

  const runExport = useCallback((spec: RunSpec) => enqueue(spec), [enqueue]);

  const retryJob = useCallback(
    (jobId: string) => {
      const job = stateRef.current.jobs.find((j) => j.id === jobId);
      if (!job) return;
      commit((current) => ({
        ...current,
        jobs: current.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                stage: "queued" as JobStage,
                progress: 0,
                error: undefined,
                historyId: undefined,
                attempt: j.attempt + 1,
                trigger: "retry" as Trigger,
                createdAt: new Date().toISOString(),
              }
            : j,
        ),
      }));
    },
    [commit],
  );

  const cancelJob = useCallback(
    (jobId: string) => {
      payloadCache.delete(jobId);
      commit((current) => ({
        ...current,
        jobs: current.jobs.map((j) =>
          j.id === jobId ? { ...j, stage: "canceled" as JobStage, pausedFrom: undefined } : j,
        ),
      }));
    },
    [commit],
  );

  const dismissJob = useCallback(
    (jobId: string) => {
      payloadCache.delete(jobId);
      commit((current) => ({ ...current, jobs: current.jobs.filter((j) => j.id !== jobId) }));
    },
    [commit],
  );

  const downloadJob = useCallback((jobId: string) => {
    const job = stateRef.current.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const compiled = compileTemplate(job.templateId, expensesRef.current);
    const text = payloadCache.get(job.id) ?? serialize(compiled, job.format);
    downloadText(text, filenameFor(compiled, job.format), FORMAT_META[job.format].mime);
  }, []);

  const connect = useCallback(
    (id: DestinationId, account: string) => {
      const meta = destination(id);
      const now = new Date();
      const connection: Connection = {
        destinationId: id,
        account: account.trim() || meta.accountPlaceholder,
        connectedAt: now.toISOString(),
        // Simulated grant lifetime, so some connectors eventually ask again.
        expiresAt: new Date(now.getTime() + (14 + Math.random() * 45) * 86_400_000).toISOString(),
        scopes: meta.scopes,
      };
      commit((current) => ({
        ...current,
        connections: [...current.connections.filter((c) => c.destinationId !== id), connection],
      }));
      toastRef.current(`${meta.name} connected`);
    },
    [commit],
  );

  const disconnect = useCallback(
    (id: DestinationId) => {
      commit((current) => ({
        ...current,
        connections: current.connections.filter((c) => c.destinationId !== id),
        jobs: current.jobs.map((j) =>
          j.destinationId === id && isActiveStage(j.stage) ? { ...j, stage: "canceled" as JobStage } : j,
        ),
        schedules: current.schedules.map((s) => (s.destinationId === id ? { ...s, paused: true } : s)),
      }));
      toastRef.current(`${destination(id).name} disconnected`);
    },
    [commit],
  );

  const reauthorize = useCallback(
    (id: DestinationId) => {
      const now = new Date();
      commit((current) => ({
        ...current,
        connections: current.connections.map((c) =>
          c.destinationId === id
            ? { ...c, expiresAt: new Date(now.getTime() + 60 * 86_400_000).toISOString() }
            : c,
        ),
      }));
      toastRef.current(`${destination(id).name} reauthorized for 60 days`);
    },
    [commit],
  );

  // --- Schedules -----------------------------------------------------------

  const createSchedule = useCallback(
    (input: ScheduleInput) => {
      const rule: ScheduleRule = {
        ...input,
        id: createId(),
        paused: false,
        createdAt: new Date().toISOString(),
      };
      commit((current) => ({ ...current, schedules: [...current.schedules, rule] }));
      return rule;
    },
    [commit],
  );

  const updateSchedule = useCallback(
    (id: string, patch: Partial<ScheduleRule>) => {
      commit((current) => ({
        ...current,
        schedules: current.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
    },
    [commit],
  );

  const deleteSchedule = useCallback(
    (id: string) => {
      commit((current) => ({ ...current, schedules: current.schedules.filter((s) => s.id !== id) }));
    },
    [commit],
  );

  const fireSchedule = useCallback(
    (rule: ScheduleRule, trigger: Trigger) => {
      const job = enqueue({
        destinationId: rule.destinationId,
        templateId: rule.templateId,
        format: rule.format,
        trigger,
        scheduleId: rule.id,
        label: rule.name,
      });
      if (job) {
        commit((current) => ({
          ...current,
          schedules: current.schedules.map((s) =>
            s.id === rule.id ? { ...s, lastRunAt: new Date().toISOString() } : s,
          ),
        }));
      }
      return job;
    },
    [enqueue, commit],
  );

  const runScheduleNow = useCallback(
    (id: string) => {
      const rule = stateRef.current.schedules.find((s) => s.id === id);
      if (rule) fireSchedule(rule, "manual");
    },
    [fireSchedule],
  );

  useEffect(() => {
    if (!ready) return;

    const check = () => {
      const now = new Date();
      for (const rule of stateRef.current.schedules) {
        if (rule.paused) continue;
        const due = nextRunFor(rule);
        if (due > now) continue;
        const alreadyRunning = stateRef.current.jobs.some(
          (j) => j.scheduleId === rule.id && isActiveStage(j.stage),
        );
        if (alreadyRunning) continue;
        // More than two hours late means the tab was closed when it was due.
        const trigger: Trigger = now.getTime() - due.getTime() > 2 * 3_600_000 ? "catch-up" : "schedule";
        fireSchedule(rule, trigger);
      }
    };

    check();
    const timer = window.setInterval(check, SCHEDULE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [ready, fireSchedule]);

  // --- Sharing -------------------------------------------------------------

  const createShare = useCallback(
    (input: ShareInput): ShareLink | null => {
      if (typeof window === "undefined") return null;
      const compiled = compileTemplate(input.templateId, expensesRef.current);
      const expiresAt = new Date(Date.now() + input.expiryHours * 3_600_000);
      const payload = buildSharePayload(compiled, { includeRows: input.includeRows, expiresAt });
      const token = createShareToken();
      const url = buildShareUrl(window.location.origin, token, encodeShare(payload));

      const link: ShareLink = {
        token,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        templateId: input.templateId,
        title: compiled.title,
        includeRows: input.includeRows,
        url,
        bytes: byteLength(url),
        revoked: false,
        views: 0,
      };

      commit((current) => ({ ...current, shares: [link, ...current.shares].slice(0, 30) }));
      return link;
    },
    [commit],
  );

  const revokeShare = useCallback(
    (token: string) => {
      commit((current) => ({
        ...current,
        shares: current.shares.map((s) => (s.token === token ? { ...s, revoked: true } : s)),
      }));
    },
    [commit],
  );

  // --- Bulk operations -----------------------------------------------------

  const clearHistory = useCallback(() => {
    commit((current) => ({ ...current, history: [] }));
  }, [commit]);

  const resetCloud = useCallback(() => {
    payloadCache.clear();
    stateRef.current = EMPTY_CLOUD_STATE;
    setState(EMPTY_CLOUD_STATE);
    clearCloudState();
    toastRef.current("Cloud workspace reset");
  }, []);

  const seedDemoWorkspace = useCallback(() => {
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();
    const connections: Connection[] = [
      {
        destinationId: "vault",
        account: "this device",
        connectedAt: iso(9 * 86_400_000),
        expiresAt: iso(-365 * 86_400_000),
        scopes: destination("vault").scopes,
        lastSyncAt: iso(20 * 3_600_000),
      },
      {
        destinationId: "google-sheets",
        account: "you@example.com",
        connectedAt: iso(31 * 86_400_000),
        expiresAt: iso(-11 * 86_400_000),
        scopes: destination("google-sheets").scopes,
        lastSyncAt: iso(3 * 86_400_000),
      },
      {
        destinationId: "dropbox",
        account: "you@example.com",
        connectedAt: iso(48 * 86_400_000),
        // Already past: the card will ask for reauthorization.
        expiresAt: iso(2 * 86_400_000),
        scopes: destination("dropbox").scopes,
        lastSyncAt: iso(6 * 86_400_000),
      },
    ];

    const schedules: ScheduleRule[] = [
      {
        id: createId(),
        name: "Nightly vault backup",
        destinationId: "vault",
        templateId: "raw-ledger",
        format: "json",
        frequency: "daily",
        weekday: 1,
        dayOfMonth: 1,
        hour: 2,
        paused: false,
        createdAt: iso(9 * 86_400_000),
        lastRunAt: iso(20 * 3_600_000),
        keepLast: 7,
      },
      {
        id: createId(),
        name: "Monthly summary to Sheets",
        destinationId: "google-sheets",
        templateId: "monthly-summary",
        format: "sheet",
        frequency: "monthly",
        weekday: 1,
        dayOfMonth: 1,
        hour: 9,
        paused: false,
        createdAt: iso(31 * 86_400_000),
        lastRunAt: iso(3 * 86_400_000),
        keepLast: 12,
      },
    ];

    const history: HistoryEntry[] = [
      {
        id: createId(),
        createdAt: iso(20 * 3_600_000),
        destinationId: "vault",
        templateId: "raw-ledger",
        format: "json",
        label: "Nightly vault backup",
        trigger: "schedule",
        status: "delivered",
        rows: 128,
        bytes: 41_820,
      },
      {
        id: createId(),
        createdAt: iso(3 * 86_400_000),
        destinationId: "google-sheets",
        templateId: "monthly-summary",
        format: "sheet",
        label: "Monthly summary to Sheets",
        trigger: "schedule",
        status: "delivered",
        rows: 64,
        bytes: 8_412,
      },
      {
        id: createId(),
        createdAt: iso(6 * 86_400_000),
        destinationId: "dropbox",
        templateId: "tax-report",
        format: "csv",
        label: "Tax Report → Dropbox",
        trigger: "manual",
        status: "failed",
        rows: 0,
        bytes: 0,
        error: "Token rejected: the grant may have been revoked.",
      },
    ];

    commit((current) => ({ ...current, connections, schedules, history }));
    toastRef.current("Demo workspace loaded — three connectors and two schedules");
  }, [commit]);

  // --- Derived -------------------------------------------------------------

  const connectionFor = useCallback(
    (id: DestinationId) => state.connections.find((c) => c.destinationId === id),
    [state.connections],
  );

  const value = useMemo<CloudContextValue>(() => {
    const activeJobs = state.jobs.filter((j) => isActiveStage(j.stage));
    const vaultUsage = state.history
      .filter((h) => h.destinationId === "vault" && h.status === "delivered")
      .reduce((total, h) => total + h.bytes, 0);
    const current = fingerprint(expenses);

    return {
      ...state,
      ready,
      online,
      activeJobs,
      vaultUsage,
      vaultQuota: VAULT_QUOTA_BYTES,
      connectionFor,
      isConnected: (id) => state.connections.some((c) => c.destinationId === id),
      driftFor: (id) => changesSince(expenses, connectionFor(id)?.lastSyncAt),
      inSync: (id) => connectionFor(id)?.lastSyncFingerprint === current,
      connect,
      disconnect,
      reauthorize,
      runExport,
      retryJob,
      cancelJob,
      dismissJob,
      downloadJob,
      createSchedule,
      updateSchedule,
      deleteSchedule,
      runScheduleNow,
      createShare,
      revokeShare,
      clearHistory,
      seedDemoWorkspace,
      resetCloud,
    };
  }, [
    state,
    ready,
    online,
    expenses,
    connectionFor,
    connect,
    disconnect,
    reauthorize,
    runExport,
    retryJob,
    cancelJob,
    dismissJob,
    downloadJob,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    runScheduleNow,
    createShare,
    revokeShare,
    clearHistory,
    seedDemoWorkspace,
    resetCloud,
  ]);

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud() {
  const context = useContext(CloudContext);
  if (!context) throw new Error("useCloud must be used within CloudProvider");
  return context;
}
