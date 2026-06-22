// Fiscal-year date helpers. The vel's year runs 1 April → 31 March.

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format an ISO date as "01.04.2024". */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** Build the fiscal year that starts in the given calendar year. */
export function fiscalYearForStart(startCalendarYear: number): {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
} {
  const next = startCalendarYear + 1;
  return {
    id: `${startCalendarYear}-${next}`,
    label: `${startCalendarYear}/${next}`,
    startDate: `${startCalendarYear}-04-01`,
    endDate: `${next}-03-31`,
  };
}

/** Which fiscal year (by start calendar year) does an ISO date fall in? */
export function startYearOfDate(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  // April (4) onward belongs to that calendar year's fiscal year.
  return m >= 4 ? y : y - 1;
}

/** True when the ISO date lies within [startDate, endDate]. */
export function dateInRange(iso: string, startDate: string, endDate: string) {
  return iso >= startDate && iso <= endDate;
}
