"use client";

import { useMemo } from "react";
import { encodeQr, type QrResult } from "@/lib/cloud/qr";

interface QRCodeProps {
  value: string;
  /** Rendered edge length in pixels. */
  size?: number;
  /** Pass an already-encoded result to avoid encoding the same value twice. */
  result?: QrResult | null;
  className?: string;
}

/** Encodes once so callers can show capacity details next to the code itself. */
export function useQr(value: string): QrResult | null {
  return useMemo(() => encodeQr(value), [value]);
}

/**
 * Renders a real, scannable QR code. Everything is computed in the browser, so
 * the encoded URL never travels anywhere to become an image.
 */
export function QRCode({ value, size = 220, result: provided, className }: QRCodeProps) {
  const encoded = useQr(value);
  const result = provided !== undefined ? provided : encoded;

  if (!result) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-line bg-surface-2 p-6 text-center text-sm text-ink-2 ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        Payload is larger than any QR code can hold. Switch to summary only.
      </div>
    );
  }

  const quiet = 3;
  const dim = result.size + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${value.slice(0, 48)}`}
      className={`rounded-xl ${className ?? ""}`}
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      {result.matrix.map((row, y) =>
        row.map((dark, x) =>
          dark ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width={1} height={1} fill="#000000" /> : null,
        ),
      )}
    </svg>
  );
}
