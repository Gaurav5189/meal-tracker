import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";
import { useToast } from "../../components/ToastContext";
import { bulkUpdateMeals, type MealType } from "./api";
import styles from "./meals.module.css";
import ui from "../../components/ui.module.css";

export type BulkMealType = "L" | "D" | "B";

interface BulkActionsProps {
  month: string; // the month currently viewed (presets are relative to it)
  today: string; // YYYY-MM-DD in the user's timezone
}

function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

function applyPreset(preset: "rest" | "week" | "all", month: string, today: string) {
  const { start, end } = monthBounds(month);
  if (preset === "all") return { from: start, to: end };
  if (preset === "rest") {
    // Today inside the viewed month: rest of month; otherwise the whole month.
    const from = today >= start && today <= end ? today : start;
    return { from, to: end };
  }
  // This week (Mon–Sun of today's week, like the demo).
  const [ty, tm, td] = today.split("-").map(Number);
  const now = new Date(ty, tm - 1, td);
  const from = new Date(now);
  from.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

/** Bulk actions block under the month card (demo's .bulk). */
export default function BulkActions({ month, today }: BulkActionsProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mealType, setMealType] = useState<BulkMealType>("B");
  const [action, setAction] = useState<"1" | "0">("1");
  const [from, setFrom] = useState(() => applyPreset("rest", month, today).from);
  const [to, setTo] = useState(() => applyPreset("rest", month, today).to);

  // Demo: navigating months resets the bulk range to "Rest of month".
  // Adjusting state during render (no effect) keeps this lint-clean.
  const [lastMonth, setLastMonth] = useState(month);
  if (lastMonth !== month) {
    setLastMonth(month);
    const preset = applyPreset("rest", month, today);
    setFrom(preset.from);
    setTo(preset.to);
  }

  const mutation = useMutation({
    mutationFn: bulkUpdateMeals,
    onSuccess: (result) => {
      toast(
        `Updated ${result.updated} meals${result.locked_skipped ? `, ${result.locked_skipped} locked skipped` : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["meals"] });
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.message : "Bulk update failed. Please try again.");
    },
  });

  const apply = () => {
    if (!from || !to || from > to) {
      toast("Choose a valid date range");
      return;
    }
    const meal_types: MealType[] =
      mealType === "B" ? ["lunch", "dinner"] : mealType === "L" ? ["lunch"] : ["dinner"];
    mutation.mutate({ from, to, meal_types, taken: action === "1" });
  };

  return (
    <div className={`${ui.card} ${styles.bulk}`}>
      <button
        type="button"
        className={styles.bt}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Bulk actions</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className={styles.bulkBody}>
          <div className={styles.seg} role="group" aria-label="Meal type">
            <button
              type="button"
              className={mealType === "L" ? styles.segCheckOn : ""}
              onClick={() => setMealType("L")}
            >
              Lunch
            </button>
            <button
              type="button"
              className={mealType === "D" ? styles.segCheckOn : ""}
              onClick={() => setMealType("D")}
            >
              Dinner
            </button>
            <button
              type="button"
              className={mealType === "B" ? styles.segCheckOn : ""}
              onClick={() => setMealType("B")}
            >
              Both
            </button>
          </div>
          <div className={styles.g2}>
            <div>
              <label className={ui.label} htmlFor="bulk-from">
                From
              </label>
              <input
                className={ui.input}
                id="bulk-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div>
              <label className={ui.label} htmlFor="bulk-to">
                To
              </label>
              <input
                className={ui.input}
                id="bulk-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
          <div className={styles.pre}>
            <button
              type="button"
              onClick={() => {
                const preset = applyPreset("rest", month, today);
                setFrom(preset.from);
                setTo(preset.to);
              }}
            >
              Rest of month
            </button>
            <button
              type="button"
              onClick={() => {
                const preset = applyPreset("week", month, today);
                setFrom(preset.from);
                setTo(preset.to);
              }}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => {
                const preset = applyPreset("all", month, today);
                setFrom(preset.from);
                setTo(preset.to);
              }}
            >
              Whole month
            </button>
          </div>
          <div className={styles.seg} role="group" aria-label="Action">
            <button
              type="button"
              className={action === "1" ? styles.segCheckOn : ""}
              onClick={() => setAction("1")}
            >
              Mark taken
            </button>
            <button
              type="button"
              className={action === "0" ? styles.segUncheckOn : ""}
              onClick={() => setAction("0")}
            >
              Mark skipped
            </button>
          </div>
          <button type="button" className={styles.bulkBtn} onClick={apply} disabled={mutation.isPending}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
