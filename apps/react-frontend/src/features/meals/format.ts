/** Date and money formatting for the meals dashboard (mirrors the demo). */

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(currency: string, amount: number): string {
  let fmt = formatterCache.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    formatterCache.set(currency, fmt);
  }
  return fmt.format(amount);
}

/** "2026-10-13" -> "13/10/26" (demo's fmt). */
export function formatDayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** "2026-10" -> "October 2026". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

/** "2026-10-13" -> "Mon". */
export function weekdayShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleString("en", { weekday: "short" });
}

/** Local YYYY-MM for "now". */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Shift a YYYY-MM by ±n months, keeping the day clamped out. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(y, m - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

/** Local YYYY-MM-DD for "now". */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}
