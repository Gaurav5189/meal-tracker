import { useEffect, useRef, useState } from "react";

import type { Meal, MealType } from "./api";
import { formatDayDate, formatMoney } from "./format";
import styles from "./meals.module.css";

interface MealSheetProps {
  date: string;
  mealType: MealType;
  meal: Meal;
  currency: string;
  /** Persist the taken state (optimistic; the sheet stays open like the demo). */
  onTaken: (taken: boolean) => void;
  /** Persist a custom price; null resets to the default. */
  onPrice: (price: number | null) => void;
  onClose: () => void;
}

/** Check/uncheck + meal cost editor (demo's bottom sheet / centered modal). */
export default function MealSheet({
  date,
  mealType,
  meal,
  currency,
  onTaken,
  onPrice,
  onClose,
}: MealSheetProps) {
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState(String(Number(meal.price)));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsed = Number(priceInput);
  const priceValid = priceInput !== "" && Number.isFinite(parsed) && parsed >= 0;

  const savePrice = () => {
    if (!priceValid) return;
    onPrice(parsed);
    setEditing(false);
  };

  return (
    <div
      className={styles.sheetOverlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheetCard} role="dialog" aria-modal="true">
        <h2 className={styles.sheetTitle}>
          {mealType === "lunch" ? "Lunch" : "Dinner"} · {formatDayDate(date)}
        </h2>
        <div className={styles.seg}>
          <button
            type="button"
            className={meal.taken ? styles.segCheckOn : ""}
            onClick={() => onTaken(true)}
          >
            Check
          </button>
          <button
            type="button"
            className={meal.taken ? "" : styles.segUncheckOn}
            onClick={() => onTaken(false)}
          >
            Uncheck
          </button>
        </div>
        <div className={styles.cost}>
          {editing ? (
            <>
              <span>Meal cost</span>
              <span className={styles.costControls}>
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label="Meal cost"
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") savePrice();
                  }}
                />
                <button type="button" onClick={savePrice} disabled={!priceValid}>
                  Save
                </button>
              </span>
            </>
          ) : (
            <>
              <span>
                Meal cost: {formatMoney(currency, Number(meal.price))}
                {meal.price_overridden ? " (custom)" : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPriceInput(String(Number(meal.price)));
                  setEditing(true);
                }}
                aria-label="Edit price"
              >
                ✎ Edit
              </button>
            </>
          )}
        </div>
        <div className={styles.sheetActions}>
          <button type="button" className={styles.sheetReset} onClick={() => onPrice(null)}>
            Reset to default price
          </button>
          <button type="button" className={styles.sheetClose} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
