import {
  Cloud,
  FileSpreadsheet,
  FolderClosed,
  HardDrive,
  Mail,
  MessageSquare,
  NotebookPen,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { DestinationId, ExportFormat } from "./types";

export type DestinationCategory = "Spendwise" | "Storage" | "Productivity" | "Messaging" | "Developer";

export interface DestinationMeta {
  id: DestinationId;
  name: string;
  tagline: string;
  category: DestinationCategory;
  icon: LucideIcon;
  /** Brand-ish accent used for the connector tile, not a logo reproduction. */
  accent: string;
  /** OAuth scopes shown on the simulated consent screen. */
  scopes: string[];
  formats: ExportFormat[];
  defaultFormat: ExportFormat;
  supportsSchedule: boolean;
  /** Label on the connect button, e.g. "Continue with Google". */
  connectLabel: string;
  /** Placeholder for the account field on the consent screen. */
  accountPlaceholder: string;
  /** Simulated round-trip time range in ms, so connectors feel different. */
  latency: [number, number];
  /** Chance a delivery fails and needs a retry, 0-1. */
  flakiness: number;
  /** What actually happens on the far side, shown in the run sheet. */
  effect: string;
  /** True when the connector never needs an account (local-only). */
  implicit?: boolean;
}

export const DESTINATIONS: DestinationMeta[] = [
  {
    id: "vault",
    name: "Spendwise Vault",
    tagline: "Encrypted-at-rest backups in your own browser storage",
    category: "Spendwise",
    icon: Cloud,
    accent: "#256abf",
    scopes: ["Store export snapshots", "Restore from a snapshot"],
    formats: ["json", "csv"],
    defaultFormat: "json",
    supportsSchedule: true,
    connectLabel: "Enable Vault",
    accountPlaceholder: "this device",
    latency: [500, 1100],
    flakiness: 0,
    effect: "Snapshot written to the local vault and kept under the retention limit.",
    implicit: true,
  },
  {
    id: "email",
    name: "Email",
    tagline: "Send a report straight to an inbox",
    category: "Productivity",
    icon: Mail,
    accent: "#eb6834",
    scopes: ["Send mail on your behalf", "Read your sending address"],
    formats: ["csv", "html", "markdown", "json"],
    defaultFormat: "html",
    supportsSchedule: true,
    connectLabel: "Connect a sending address",
    accountPlaceholder: "you@example.com",
    latency: [900, 2000],
    flakiness: 0.08,
    effect: "Message queued with the report attached, delivery receipt logged.",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    tagline: "Live spreadsheet that refreshes on every run",
    category: "Productivity",
    icon: FileSpreadsheet,
    accent: "#1baf7a",
    scopes: [
      "See, edit, create and delete your spreadsheets",
      "See your primary email address",
    ],
    formats: ["sheet", "csv"],
    defaultFormat: "sheet",
    supportsSchedule: true,
    connectLabel: "Continue with Google",
    accountPlaceholder: "you@example.com",
    latency: [1200, 2600],
    flakiness: 0.06,
    effect: "Tabs replaced in place, so formulas pointing at the sheet keep working.",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    tagline: "Versioned files in a folder you choose",
    category: "Storage",
    icon: HardDrive,
    accent: "#eda100",
    scopes: ["See and upload files in a folder you pick"],
    formats: ["csv", "json", "html", "markdown"],
    defaultFormat: "csv",
    supportsSchedule: true,
    connectLabel: "Continue with Google",
    accountPlaceholder: "you@example.com",
    latency: [1000, 2200],
    flakiness: 0.05,
    effect: "Uploaded as a new revision, so earlier exports stay in file history.",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    tagline: "App-folder sync with conflict-free naming",
    category: "Storage",
    icon: FolderClosed,
    accent: "#2a78d6",
    scopes: ["Write to its own app folder", "Read your account name"],
    formats: ["csv", "json", "html", "markdown"],
    defaultFormat: "csv",
    supportsSchedule: true,
    connectLabel: "Connect Dropbox",
    accountPlaceholder: "you@example.com",
    latency: [800, 1900],
    flakiness: 0.07,
    effect: "Written to /Apps/Spendwise with a date-stamped filename.",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    tagline: "Personal or work storage with retention rules",
    category: "Storage",
    icon: Cloud,
    accent: "#e87ba4",
    scopes: ["Have full access to files you pick", "Maintain access while offline"],
    formats: ["csv", "json", "html"],
    defaultFormat: "csv",
    supportsSchedule: true,
    connectLabel: "Sign in with Microsoft",
    accountPlaceholder: "you@example.com",
    latency: [1100, 2400],
    flakiness: 0.09,
    effect: "Saved to Documents/Spendwise and indexed for search.",
  },
  {
    id: "slack",
    name: "Slack",
    tagline: "Drop the summary in a channel after every run",
    category: "Messaging",
    icon: MessageSquare,
    accent: "#d55181",
    scopes: ["Post messages to channels you choose", "Upload files"],
    formats: ["markdown", "csv"],
    defaultFormat: "markdown",
    supportsSchedule: true,
    connectLabel: "Add to Slack",
    accountPlaceholder: "#finance",
    latency: [600, 1400],
    flakiness: 0.05,
    effect: "Summary posted as an unfurled message with the file attached.",
  },
  {
    id: "notion",
    name: "Notion",
    tagline: "Append rows to a database, keyed by expense id",
    category: "Productivity",
    icon: NotebookPen,
    accent: "#898781",
    scopes: ["Read content", "Insert content", "Update content"],
    formats: ["markdown", "json"],
    defaultFormat: "markdown",
    supportsSchedule: true,
    connectLabel: "Connect Notion",
    accountPlaceholder: "Finance workspace",
    latency: [1300, 2800],
    flakiness: 0.1,
    effect: "Rows upserted by expense id, so re-runs never duplicate entries.",
  },
  {
    id: "webhook",
    name: "Webhook",
    tagline: "POST the payload anywhere you can host an endpoint",
    category: "Developer",
    icon: Webhook,
    accent: "#008300",
    scopes: ["Send HTTP POST requests to the URL you provide"],
    formats: ["json", "ndjson", "csv"],
    defaultFormat: "json",
    supportsSchedule: true,
    connectLabel: "Register endpoint",
    accountPlaceholder: "https://api.example.com/spendwise",
    latency: [300, 900],
    flakiness: 0.12,
    effect: "Signed POST with an idempotency key; non-2xx responses are retried.",
  },
];

const BY_ID = new Map(DESTINATIONS.map((d) => [d.id, d]));

export function destination(id: DestinationId): DestinationMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`Unknown destination: ${id}`);
  return meta;
}

export const DESTINATION_CATEGORIES: DestinationCategory[] = [
  "Spendwise",
  "Storage",
  "Productivity",
  "Messaging",
  "Developer",
];

export const FORMAT_META: Record<ExportFormat, { label: string; extension: string; mime: string }> = {
  csv: { label: "CSV", extension: "csv", mime: "text/csv;charset=utf-8" },
  json: { label: "JSON", extension: "json", mime: "application/json" },
  ndjson: { label: "NDJSON", extension: "ndjson", mime: "application/x-ndjson" },
  markdown: { label: "Markdown", extension: "md", mime: "text/markdown;charset=utf-8" },
  html: { label: "HTML report", extension: "html", mime: "text/html;charset=utf-8" },
  sheet: { label: "Live sheet", extension: "csv", mime: "text/csv;charset=utf-8" },
};
