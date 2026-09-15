"use client";

import { useState, type KeyboardEvent } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import type { TrendBucket } from "@/lib/analytics";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { SegmentedControl } from "../ui/SegmentedControl";

const PLOT_HEIGHT = 200;
const Y_AXIS_WIDTH = 48;
const MAX_BAR_WIDTH = 24;

/** Rounds the axis max up to a clean 1 / 2 / 2.5 / 5 × 10^n step so ticks read naturally. */
function niceScale(max: number, tickCount = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 100, ticks: [0, 25, 50, 75, 100] };
  const rough = max / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
  const niceMax = step * Math.ceil(max / step);
  const ticks = Array.from({ length: Math.round(niceMax / step) + 1 }, (_, i) => i * step);
  return { max: niceMax, ticks };
}

interface TrendChartProps {
  buckets: TrendBucket[];
  title: string;
  subtitle: string;
  /** Minimum horizontal room one x-axis label needs, in px. */
  labelWidth: number;
}

export function TrendChart({ buckets, title, subtitle, labelWidth }: TrendChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(() => lastPastIndex(buckets));
  const [plotRef, plotWidth] = useElementWidth<HTMLDivElement>();

  const peak = Math.max(0, ...buckets.map((b) => b.total));
  // 12% headroom keeps the peak label inside the plot.
  const { max, ticks } = niceScale(peak * 1.12);
  const slotWidth = buckets.length ? plotWidth / buckets.length : 0;
  const labelEvery = slotWidth > 0 ? Math.max(1, Math.ceil(labelWidth / slotWidth)) : 1;
  const barWidth = Math.max(2, Math.min(MAX_BAR_WIDTH, slotWidth * 0.6));

  // Direct-label only the extreme; the axis, tooltip, and table carry the rest.
  const peakIndex = buckets.reduce((best, b, i) => (b.total > (buckets[best]?.total ?? 0) ? i : best), -1);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const last = buckets.length - 1;
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? last : Math.min(last, Math.max(0, focusIndex + delta));
    setFocusIndex(next);
    setActive(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-slot="${next}"]`)?.focus();
  };

  const activeBucket = active !== null ? buckets[active] : null;

  return (
    <section className="card flex h-full flex-col p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>
        </div>
        <SegmentedControl
          label="Display as"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>

      {view === "table" ? (
        <div className="max-h-[260px] overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-2">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Expenses</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {buckets
                .filter((b) => !b.isFuture)
                .map((b) => (
                  <tr key={b.key}>
                    <td className="px-3 py-2 text-ink">{b.fullLabel}</td>
                    <td className="px-3 py-2 text-right text-ink-2">{b.count}</td>
                    <td className="px-3 py-2 text-right font-medium text-ink">{formatCurrency(b.total)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex">
          {/* Y axis */}
          <div className="relative shrink-0" style={{ width: Y_AXIS_WIDTH, height: PLOT_HEIGHT }} aria-hidden>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted"
                style={{ top: `${(1 - tick / max) * 100}%` }}
              >
                {formatCurrencyCompact(tick)}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Plot */}
            <div ref={plotRef} className="relative" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className={`absolute inset-x-0 h-px ${tick === 0 ? "bg-line" : "bg-grid"}`}
                  style={{ top: `${(1 - tick / max) * 100}%` }}
                  aria-hidden
                />
              ))}

              <div
                role="group"
                aria-label={`${title}, ${subtitle}. Use arrow keys to move between bars.`}
                className="absolute inset-0 flex"
                onKeyDown={onKeyDown}
                onMouseLeave={() => setActive(null)}
              >
                {buckets.map((bucket, i) => {
                  const height = max > 0 ? (bucket.total / max) * PLOT_HEIGHT : 0;
                  const isActive = active === i;
                  return (
                    <div
                      key={bucket.key}
                      data-slot={i}
                      tabIndex={i === focusIndex ? 0 : -1}
                      role="img"
                      aria-label={
                        bucket.isFuture
                          ? `${bucket.fullLabel}: no data yet`
                          : `${bucket.fullLabel}: ${formatCurrency(bucket.total)}, ${bucket.count} expense${bucket.count === 1 ? "" : "s"}`
                      }
                      className={`relative flex h-full min-w-0 flex-1 items-end justify-center rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        isActive ? "bg-ink/[0.04]" : ""
                      }`}
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => {
                        setActive(i);
                        setFocusIndex(i);
                      }}
                      onBlur={() => setActive(null)}
                    >
                      {bucket.total > 0 && (
                        <div
                          className="rounded-t-[4px] transition-opacity"
                          style={{
                            width: barWidth,
                            height: Math.max(2, height),
                            background: "var(--series)",
                            opacity: active !== null && !isActive ? 0.55 : 1,
                          }}
                        />
                      )}
                      {i === peakIndex && bucket.total > 0 && slotWidth > 0 && (
                        <span
                          className="pointer-events-none absolute -translate-y-1 whitespace-nowrap text-[11px] font-medium tabular-nums text-ink-2"
                          style={{ bottom: Math.max(2, height) + 2 }}
                          aria-hidden
                        >
                          {formatCurrencyCompact(bucket.total)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {activeBucket && slotWidth > 0 && (
                <Tooltip
                  bucket={activeBucket}
                  x={(active! + 0.5) * slotWidth}
                  bottom={Math.min(PLOT_HEIGHT - 24, (activeBucket.total / max) * PLOT_HEIGHT + 12)}
                  containerWidth={plotWidth}
                />
              )}
            </div>

            {/* X axis */}
            <div className="flex h-6 items-end" aria-hidden>
              {buckets.map((bucket, i) => (
                <span key={bucket.key} className="relative h-4 min-w-0 flex-1">
                  {i % labelEvery === 0 && (
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted">
                      {bucket.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface TooltipProps {
  bucket: TrendBucket;
  x: number;
  bottom: number;
  containerWidth: number;
}

function Tooltip({ bucket, x, bottom, containerWidth }: TooltipProps) {
  const width = 168;
  const left = Math.min(Math.max(0, x - width / 2), Math.max(0, containerWidth - width));
  return (
    <div
      className="pointer-events-none absolute z-10 animate-fade-in rounded-lg border border-line bg-surface px-3 py-2 shadow-pop"
      style={{ left, width, bottom }}
      aria-hidden
    >
      <p className="text-sm font-semibold tabular-nums text-ink">
        {bucket.isFuture ? "—" : formatCurrency(bucket.total)}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
        <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: "var(--series)" }} />
        <span className="truncate">{bucket.fullLabel}</span>
      </p>
      {!bucket.isFuture && (
        <p className="mt-0.5 text-xs text-muted">
          {bucket.count} expense{bucket.count === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function lastPastIndex(buckets: TrendBucket[]): number {
  for (let i = buckets.length - 1; i >= 0; i--) if (!buckets[i].isFuture) return i;
  return 0;
}
