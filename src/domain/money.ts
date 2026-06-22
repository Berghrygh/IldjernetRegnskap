// Norwegian money + number formatting and safe rounding.

/** Round to 2 decimals (øre) avoiding binary float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Two amounts equal within half an øre. */
export function moneyEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

const nf2 = new Intl.NumberFormat("nb-NO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format as "kr 1 000,00". Negative as "kr -1 000,00". */
export function formatKr(n: number): string {
  return `kr ${nf2.format(round2(n))}`;
}

/** Format the bare number "1 000,00" without the kr prefix. */
export function formatNum(n: number): string {
  return nf2.format(round2(n));
}

/** Compact integer-style "1 000" used in member grids. */
export function formatInt(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

/**
 * Parse Norwegian-style input ("1 000,50", "1.000,50", "1000.50", "kr 50")
 * into a number. Returns NaN when not parseable.
 */
export function parseKr(raw: string): number {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  s = s.replace(/kr/gi, "").trim();
  // Remove spaces (incl. non-breaking) used as thousands separators.
  s = s.replace(/[\s ]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Assume "." thousands, "," decimals (Norwegian).
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  // Otherwise "." is treated as a decimal point already.
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
