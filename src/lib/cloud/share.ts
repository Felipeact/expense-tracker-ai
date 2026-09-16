import type { CompiledExport } from "./templates";
import type { SharePayload, TemplateId } from "./types";

/**
 * Share links carry their whole payload in the URL fragment. Nothing is
 * uploaded and no server sees the data — the trade-off is that the link is only
 * as private as wherever it gets pasted, and it cannot be revoked once sent.
 */

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alike glyphs

export function createShareToken(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** How many transaction rows a shared report carries when rows are included. */
export const SHARE_ROW_LIMIT = 200;

export function buildSharePayload(
  compiled: CompiledExport,
  options: { includeRows: boolean; expiresAt: Date },
): SharePayload {
  // Prefer a sheet that actually looks like a transaction list.
  const transactionSheet =
    compiled.sheets.find((s) => s.columns[0] === "Date" && s.columns.includes("Amount")) ??
    compiled.sheets.find((s) => s.columns.includes("Amount"));

  const payload: SharePayload = {
    v: 1,
    t: compiled.title,
    r: compiled.rangeLabel,
    g: Date.parse(compiled.generatedAt),
    x: options.expiresAt.getTime(),
    s: [
      Math.round(compiled.summary.total * 100) / 100,
      compiled.summary.count,
      compiled.summary.average,
    ],
    c: compiled.summary.categories.map((c) => [c.category, c.total, c.count]),
  };

  if (options.includeRows && transactionSheet) {
    const dateIndex = transactionSheet.columns.indexOf("Date");
    const descIndex = transactionSheet.columns.indexOf("Description");
    const catIndex = transactionSheet.columns.indexOf("Category");
    const amountIndex = transactionSheet.columns.indexOf("Amount");
    payload.d = transactionSheet.rows.slice(0, SHARE_ROW_LIMIT).map((row) => [
      String(row[dateIndex] ?? ""),
      String(row[descIndex] ?? ""),
      String(row[catIndex] ?? ""),
      Number(row[amountIndex] ?? 0),
    ]);
  }

  return payload;
}

export function encodeShare(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as SharePayload;
    if (parsed?.v !== 1 || typeof parsed.t !== "string" || !Array.isArray(parsed.c)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(origin: string, token: string, encoded: string): string {
  return `${origin}/share#t=${token}&p=${encoded}`;
}

/** Parses the fragment written by {@link buildShareUrl}. */
export function parseShareHash(hash: string): { token: string; payload: SharePayload } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("p");
  if (!encoded) return null;
  const payload = decodeShare(encoded);
  if (!payload) return null;
  return { token: params.get("t") ?? "—", payload };
}

export const EXPIRY_OPTIONS: { hours: number; label: string }[] = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
  { hours: 24 * 365 * 10, label: "No expiry" },
];

export function isExpired(payload: SharePayload, now = Date.now()): boolean {
  return payload.x > 0 && payload.x < now;
}

export interface ShareDraftMeta {
  templateId: TemplateId;
  includeRows: boolean;
  rowsIncluded: number;
  rowsAvailable: number;
}
