const CURRENCY = "USD";
const LOCALE = "en-US";

const currency = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const currencyWhole = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const currencyCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currency.format(value);
}

/** Compact form for chart axes and tight spaces: $950, $1.2K, $4.5M. */
export function formatCurrencyCompact(value: number): string {
  return Math.abs(value) < 1000 ? currencyWhole.format(value) : currencyCompact.format(value);
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}
