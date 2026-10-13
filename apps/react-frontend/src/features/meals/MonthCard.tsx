import styles from "./meals.module.css";
import { formatMoney, formatMonthLabel, shiftMonth } from "./format";

interface MonthCardProps {
  month: string;
  currency: string;
  total: number;
  takenCount: number;
  onMonthChange: (month: string) => void;
}

/** Month navigation + meal price total + meals taken (demo's .sum block). */
export default function MonthCard({
  month,
  currency,
  total,
  takenCount,
  onMonthChange,
}: MonthCardProps) {
  return (
    <div className={styles.sum}>
      <div className={styles.mon}>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          ‹
        </button>
        <b className={styles.monLabel}>{formatMonthLabel(month)}</b>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          ›
        </button>
      </div>
      <div className={styles.tot}>
        <div>
          <small>Meal price total</small>
          <strong>{formatMoney(currency, total)}</strong>
        </div>
        <div>
          <small>Meals taken</small>
          <strong>{takenCount}</strong>
        </div>
      </div>
    </div>
  );
}
