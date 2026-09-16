import type { Category } from "@/lib/types";

export type DestinationId =
  | "vault"
  | "email"
  | "google-sheets"
  | "google-drive"
  | "dropbox"
  | "onedrive"
  | "slack"
  | "notion"
  | "webhook";

export type ExportFormat = "csv" | "json" | "ndjson" | "markdown" | "html" | "sheet";

export type TemplateId =
  | "tax-report"
  | "monthly-summary"
  | "category-analysis"
  | "raw-ledger"
  | "reimbursement";

/** Where a run came from, so history can explain itself. */
export type Trigger = "manual" | "schedule" | "retry" | "catch-up";

export type JobStage =
  | "queued"
  | "authorizing"
  | "packaging"
  | "uploading"
  | "verifying"
  | "done"
  | "failed"
  | "canceled"
  | "offline";

export const ACTIVE_STAGES: JobStage[] = [
  "queued",
  "authorizing",
  "packaging",
  "uploading",
  "verifying",
  "offline",
];

export function isActiveStage(stage: JobStage): boolean {
  return ACTIVE_STAGES.includes(stage);
}

export interface Connection {
  destinationId: DestinationId;
  account: string;
  connectedAt: string;
  /** Simulated OAuth token expiry; past means the card shows "Reauthorize". */
  expiresAt: string;
  scopes: string[];
  /** ISO timestamp of the last successful delivery to this destination. */
  lastSyncAt?: string;
  /** Snapshot of the data at last sync, used to compute drift. */
  lastSyncFingerprint?: string;
}

export interface ExportJob {
  id: string;
  destinationId: DestinationId;
  templateId: TemplateId;
  format: ExportFormat;
  label: string;
  trigger: Trigger;
  createdAt: string;
  stage: JobStage;
  /** 0-100 across the whole pipeline, not per stage. */
  progress: number;
  rows: number;
  bytes: number;
  attempt: number;
  /** Simulated wall-clock duration, drawn from the destination's latency range. */
  durationMs: number;
  /** Stage to return to when connectivity comes back. */
  pausedFrom?: JobStage;
  error?: string;
  /** Set once the job lands in history. */
  historyId?: string;
  /** Rule that queued this job, when it came from a schedule. */
  scheduleId?: string;
  /** Extra per-destination context, e.g. email recipients. */
  meta?: Record<string, string>;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  destinationId: DestinationId;
  templateId: TemplateId;
  format: ExportFormat;
  label: string;
  trigger: Trigger;
  status: "delivered" | "failed";
  rows: number;
  bytes: number;
  error?: string;
  shareToken?: string;
  meta?: Record<string, string>;
}

export type Frequency = "daily" | "weekly" | "monthly";

export interface ScheduleRule {
  id: string;
  name: string;
  destinationId: DestinationId;
  templateId: TemplateId;
  format: ExportFormat;
  frequency: Frequency;
  /** 0 = Sunday. Used when frequency is weekly. */
  weekday: number;
  /** 1-28, kept inside every month. Used when frequency is monthly. */
  dayOfMonth: number;
  /** Local hour, 0-23. */
  hour: number;
  paused: boolean;
  createdAt: string;
  lastRunAt?: string;
  /** Number of runs to retain in history for this rule. */
  keepLast: number;
}

export interface ShareLink {
  token: string;
  createdAt: string;
  expiresAt: string;
  templateId: TemplateId;
  title: string;
  /** Rows omitted keeps the payload small enough to fit in a QR code. */
  includeRows: boolean;
  /** The full URL, payload and all. */
  url: string;
  bytes: number;
  revoked: boolean;
  views: number;
}

/** The compact object encoded into a share URL's fragment. */
export interface SharePayload {
  v: 1;
  /** title */
  t: string;
  /** range label */
  r: string;
  /** generated at (ms) */
  g: number;
  /** expires at (ms) */
  x: number;
  /** totals: [total, count, average] */
  s: [number, number, number];
  /** categories: [name, total, count][] */
  c: [Category | string, number, number][];
  /** rows: [date, description, category, amount][] */
  d?: [string, string, string, number][];
}

export interface CloudState {
  connections: Connection[];
  jobs: ExportJob[];
  history: HistoryEntry[];
  schedules: ScheduleRule[];
  shares: ShareLink[];
}

export const EMPTY_CLOUD_STATE: CloudState = {
  connections: [],
  jobs: [],
  history: [],
  schedules: [],
  shares: [],
};
