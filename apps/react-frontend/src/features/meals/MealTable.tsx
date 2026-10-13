import type { Meal, MealDay, MealType } from "./api";
import { formatDayDate, formatMoney, weekdayShort } from "./format";
import styles from "./meals.module.css";

interface MealTableProps {
  days: MealDay[];
  today: string; // YYYY-MM-DD in the user's timezone
  currency: string;
  onChipClick: (day: MealDay, mealType: MealType, meal: Meal) => void;
  /** Receives the today-row element (or null) whenever it mounts/unmounts. */
  todayRowRef?: (el: HTMLDivElement | null) => void;
}

interface MealChipProps {
  meal: Meal;
  mealType: MealType;
  date: string;
  currency: string;
  onClick: () => void;
}

function MealChip({ meal, mealType, date, currency, onClick }: MealChipProps) {
  const disabled = meal.locked || meal.id === null;
  const hint = meal.locked
    ? "Locked: older than 48 hours"
    : meal.id === null
      ? "Meals before you signed up can't be changed"
      : undefined;
  const label = `${mealType === "lunch" ? "Lunch" : "Dinner"} on ${formatDayDate(date)}`;
  return (
    <button
      type="button"
      className={[
        styles.chip,
        meal.taken ? styles.chipTaken : "",
        meal.price_overridden ? styles.chipOverridden : "",
        disabled ? styles.chipLocked : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-disabled={disabled || undefined}
      aria-label={hint ? `${label}: ${hint}` : label}
      title={hint}
      onClick={onClick}
    >
      {meal.taken ? "✓ Taken" : "Skipped"}
      <small>
        {meal.locked ? "🔒 " : ""}
        {formatMoney(currency, Number(meal.price))}
      </small>
    </button>
  );
}

/** One row per date, columns Date / Lunch / Dinner; today's row highlighted. */
export default function MealTable({
  days,
  today,
  currency,
  onChipClick,
  todayRowRef,
}: MealTableProps) {
  return (
    <>
      <div className={styles.head}>
        <span>Date</span>
        <span>Lunch</span>
        <span>Dinner</span>
      </div>
      <div>
        {days.map((day) => (
          <div
            key={day.date}
            ref={day.date === today ? todayRowRef : undefined}
            className={`${styles.row} ${day.date === today ? styles.rowToday : ""}`}
          >
            <div className={styles.dateCell}>
              <b>{day.date === today ? "Today" : weekdayShort(day.date)}</b>
              <span>{formatDayDate(day.date)}</span>
            </div>
            <MealChip
              meal={day.lunch}
              mealType="lunch"
              date={day.date}
              currency={currency}
              onClick={() => onChipClick(day, "lunch", day.lunch)}
            />
            <MealChip
              meal={day.dinner}
              mealType="dinner"
              date={day.date}
              currency={currency}
              onClick={() => onChipClick(day, "dinner", day.dinner)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
